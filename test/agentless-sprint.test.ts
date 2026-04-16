import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { checkSprintGates } from "../src/scrum/tools.js";
import {
  AGENT_DEFAULTS,
  seedDefaults,
} from "../src/scrum/defaults.js";

/**
 * Sprint 79 — Strip Agent Ceremony
 * TDD tests: agentless sprints work without role-play.
 */

function addSoftDeleteColumns(db: Database.Database): void {
  for (const table of ["milestones", "sprints", "epics", "tickets"] as const) {
    const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "deleted_at")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT DEFAULT NULL`);
    }
  }
}

function createSprint(db: Database.Database, name: string, status: string, velocityCommitted = 0): number {
  db.prepare(`INSERT INTO sprints (name, status, velocity_committed) VALUES (?, ?, ?)`).run(name, status, velocityCommitted);
  return (db.prepare(`SELECT id FROM sprints WHERE name = ?`).get(name) as any).id;
}

function createTicket(
  db: Database.Database,
  sprintId: number,
  overrides: Partial<{
    ticket_ref: string;
    title: string;
    status: string;
    assigned_to: string | null;
    story_points: number;
    qa_verified: number;
  }> = {}
): number {
  const defaults = {
    ticket_ref: `T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Test ticket",
    status: "TODO",
    assigned_to: null as string | null,
    story_points: null as number | null,
    qa_verified: 0,
  };
  const t = { ...defaults, ...overrides };
  db.prepare(
    `INSERT INTO tickets (sprint_id, ticket_ref, title, status, assigned_to, story_points, qa_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sprintId, t.ticket_ref, t.title, t.status, t.assigned_to, t.story_points, t.qa_verified);
  return (db.prepare(`SELECT id FROM tickets WHERE ticket_ref = ?`).get(t.ticket_ref) as any).id;
}

describe("Agentless Sprint — Sprint 79", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    addSoftDeleteColumns(db);
  });

  it("default agents seeded = 9 (fe-engineer, be-engineer, developer, qa, devops, security, architect, team-lead, product-owner)", () => {
    expect(AGENT_DEFAULTS.length).toBe(9);
    const roles = AGENT_DEFAULTS.map((a) => a.role).sort();
    expect(roles).toEqual(["architect", "be-engineer", "developer", "devops", "fe-engineer", "product-owner", "qa", "security", "team-lead"]);
  });

  it("create sprint with no agents works", () => {
    // Empty agents table — sprint creation should work fine
    const sid = createSprint(db, "Agentless Sprint", "planning", 10);
    const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
    expect(sprint).toBeDefined();
    expect(sprint.name).toBe("Agentless Sprint");
    expect(sprint.status).toBe("planning");
  });

  it("create ticket without assigned_to works", () => {
    const sid = createSprint(db, "S1", "planning", 10);
    const tid = createTicket(db, sid, {
      ticket_ref: "T-NOASSIGN",
      title: "Unassigned task",
      story_points: 3,
    });
    const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(tid) as any;
    expect(ticket).toBeDefined();
    expect(ticket.assigned_to).toBeNull();
    expect(ticket.title).toBe("Unassigned task");
  });

  it("advance sprint without assigned tickets works (with warning)", () => {
    const sid = createSprint(db, "S1", "planning", 10);
    createTicket(db, sid, { ticket_ref: "T-UA1", story_points: 3 }); // no assigned_to
    const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
    const gates = checkSprintGates(db, sprint, "implementation");
    // Should proceed without blocking
    expect(gates.canProceed).toBe(true);
    // No unassigned warning anymore — assignment is optional
    expect(gates.warnings.every((w) => !w.includes("unassigned"))).toBe(true);
  });

  it("start_sprint with unassigned tickets works", () => {
    const sid = createSprint(db, "S1", "planning", 10);
    createTicket(db, sid, { ticket_ref: "T-1", story_points: 5 }); // no assigned_to
    createTicket(db, sid, { ticket_ref: "T-2", story_points: 3 }); // no assigned_to

    // Simulate advance to implementation
    const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
    const gates = checkSprintGates(db, sprint, "implementation");
    expect(gates.canProceed).toBe(true);
    // No unassigned blocking gate
    expect(gates.warnings.filter((w) => w.includes("unassigned"))).toHaveLength(0);

    // Actually advance
    db.prepare(`UPDATE sprints SET status = 'implementation' WHERE id = ?`).run(sid);
    const updated = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
    expect(updated.status).toBe("implementation");
  });

  it("seedDefaults seeds exactly 9 agents", () => {
    seedDefaults(db);
    const count = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number }).c;
    expect(count).toBe(9);

    const roles = (db.prepare("SELECT role FROM agents ORDER BY role").all() as any[]).map((r) => r.role);
    expect(roles).toEqual(["architect", "be-engineer", "developer", "devops", "fe-engineer", "product-owner", "qa", "security", "team-lead"]);
  });
});
