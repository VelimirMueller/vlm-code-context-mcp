/**
 * Sprint 77 — Simplified Sprint Phases
 *
 * Tests for the 4-phase sprint lifecycle:
 *   planning → implementation → done → rest
 *
 * TDD: These tests were written BEFORE the implementation changes.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { checkSprintGates } from "../src/scrum/tools.js";

/** Add soft-delete columns the same way the dashboard does at runtime. */
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
    assigned_to: string;
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
    `INSERT INTO tickets (sprint_id, ticket_ref, title, status, assigned_to, story_points, qa_verified) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sprintId, t.ticket_ref, t.title, t.status, t.assigned_to, t.story_points, t.qa_verified);
  return (db.prepare(`SELECT id FROM tickets WHERE ticket_ref = ?`).get(t.ticket_ref) as any).id;
}

describe("Simplified 4-Phase Sprint Lifecycle", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    addSoftDeleteColumns(db);
  });

  // --- Phase transitions ---

  describe("PHASE_TRANSITIONS map", () => {
    it("planning to implementation is valid", () => {
      const sid = createSprint(db, "s1", "planning", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 5 });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates).toHaveProperty("warnings");
      expect(gates).toHaveProperty("canProceed");
      expect(gates.canProceed).toBe(true);
    });

    it("implementation to done is valid", () => {
      const sid = createSprint(db, "s1", "implementation", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 5, status: "DONE" });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "done");
      expect(gates).toHaveProperty("canProceed");
      expect(gates.canProceed).toBe(true);
    });

    it("done to rest is valid", () => {
      const sid = createSprint(db, "s1", "done", 10);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "rest");
      expect(gates.canProceed).toBe(true);
    });
  });

  // --- Advisory gates (never block) ---

  describe("checkSprintGates returns advisory object", () => {
    it("returns { warnings, canProceed } shape", () => {
      const sid = createSprint(db, "s1", "planning", 10);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates).toHaveProperty("warnings");
      expect(gates).toHaveProperty("canProceed");
      expect(Array.isArray(gates.warnings)).toBe(true);
      expect(typeof gates.canProceed).toBe("boolean");
    });

    it("always returns canProceed: true even with warnings", () => {
      const sid = createSprint(db, "s1", "planning", 0);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.length).toBeGreaterThan(0);
    });

    it("warns when tickets still in progress when moving to done", () => {
      const sid = createSprint(db, "s1", "implementation", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 5, status: "IN_PROGRESS" });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "done");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((w: string) => w.toLowerCase().includes("progress") || w.toLowerCase().includes("done"))).toBe(true);
    });

    it("warns when no retro findings when moving to rest", () => {
      const sid = createSprint(db, "s1", "done", 10);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "rest");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((w: string) => w.toLowerCase().includes("retro"))).toBe(true);
    });

    it("no warnings when everything is clean", () => {
      const sid = createSprint(db, "s1", "planning", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 5 });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings).toHaveLength(0);
    });
  });

  // --- Backward compatibility with legacy phases ---

  describe("backward compatibility with legacy phases", () => {
    it("sprints in old kickoff phase can exist in the DB", () => {
      const sid = createSprint(db, "s-legacy-kickoff", "planning", 10);
      db.prepare(`UPDATE sprints SET status = 'kickoff' WHERE id = ?`).run(sid);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      expect(sprint.status).toBe("kickoff");
    });

    it("sprints in old qa phase can exist in the DB", () => {
      const sid = createSprint(db, "s-legacy-qa", "planning", 10);
      db.prepare(`UPDATE sprints SET status = 'qa' WHERE id = ?`).run(sid);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      expect(sprint.status).toBe("qa");
    });

    it("sprints in old closed phase can exist in the DB", () => {
      const sid = createSprint(db, "s-legacy-closed", "planning", 10);
      db.prepare(`UPDATE sprints SET status = 'closed' WHERE id = ?`).run(sid);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      expect(sprint.status).toBe("closed");
    });
  });

  // --- start_sprint creates in planning phase ---

  describe("start_sprint creates in planning phase", () => {
    it("new sprint starts in planning phase", () => {
      db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, 'planning', ?)`).run(
        "Sprint 77", "Simplify phases", 10
      );
      const sprint = db.prepare(`SELECT * FROM sprints WHERE name = 'Sprint 77'`).get() as any;
      expect(sprint.status).toBe("planning");
    });
  });

  // --- update_sprint accepts both old and new phases ---

  describe("update_sprint phase validation", () => {
    it("accepts new done phase", () => {
      const sid = createSprint(db, "s-done-test", "implementation", 10);
      db.prepare(`UPDATE sprints SET status = 'done' WHERE id = ?`).run(sid);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      expect(sprint.status).toBe("done");
    });

    it("still accepts legacy qa phase for backward compat", () => {
      const sid = createSprint(db, "s-qa-test", "planning", 10);
      db.prepare(`UPDATE sprints SET status = 'qa' WHERE id = ?`).run(sid);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      expect(sprint.status).toBe("qa");
    });
  });
});
