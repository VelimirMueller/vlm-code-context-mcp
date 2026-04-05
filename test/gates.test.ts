import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { checkSprintGates } from "../src/scrum/tools.js";
import Database from "better-sqlite3";

/**
 * Add soft-delete columns the same way the dashboard does at runtime.
 * Required because checkSprintGates queries `deleted_at IS NULL`.
 */
function addSoftDeleteColumns(db: Database.Database): void {
  for (const table of ["milestones", "sprints", "epics", "tickets"] as const) {
    const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "deleted_at")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT DEFAULT NULL`);
    }
  }
}

/** Helper: create a sprint and return its id */
function createSprint(db: Database.Database, name: string, status: string, velocityCommitted = 0): number {
  db.prepare(
    `INSERT INTO sprints (name, status, velocity_committed) VALUES (?, ?, ?)`
  ).run(name, status, velocityCommitted);
  return (db.prepare(`SELECT id FROM sprints WHERE name = ?`).get(name) as any).id;
}

/** Helper: create a ticket and return its id */
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
    ticket_ref: `T-${Date.now()}`,
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

describe("checkSprintGates", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    addSoftDeleteColumns(db);
  });

  // ─── planning → implementation ───────────────────────────────────────

  describe("planning -> implementation", () => {
    it("warns if no tickets", () => {
      const sid = createSprint(db, "s1", "planning", 10);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("No tickets"))).toBe(true);
    });

    it("warns if tickets are unassigned", () => {
      const sid = createSprint(db, "s1", "planning", 10);
      createTicket(db, sid, { ticket_ref: "T-1", story_points: 3 }); // no assigned_to
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("unassigned"))).toBe(true);
    });

    it("warns if tickets are missing story points", () => {
      const sid = createSprint(db, "s1", "planning", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev" }); // no story_points
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("missing story points"))).toBe(true);
    });

    it("warns if velocity_committed is 0", () => {
      const sid = createSprint(db, "s1", "planning", 0);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3 });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("velocity_committed"))).toBe(true);
    });

    it("passes when all conditions are met", () => {
      const sid = createSprint(db, "s1", "planning", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 5 });
      createTicket(db, sid, { ticket_ref: "T-2", assigned_to: "dev2", story_points: 3 });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "implementation");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings).toHaveLength(0);
    });
  });

  // ─── implementation → qa ─────────────────────────────────────────────

  describe("implementation -> qa", () => {
    it("warns if tickets are still IN_PROGRESS", () => {
      const sid = createSprint(db, "s1", "implementation", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "IN_PROGRESS" });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "qa");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("still in progress"))).toBe(true);
    });

    it("warns if open blockers exist", () => {
      const sid = createSprint(db, "s1", "implementation", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "DONE" });
      db.prepare(`INSERT INTO blockers (sprint_id, description, status) VALUES (?, ?, ?)`).run(sid, "External API down", "open");
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "qa");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("open blocker"))).toBe(true);
    });

    it("passes when all tickets are DONE/BLOCKED and no open blockers", () => {
      const sid = createSprint(db, "s1", "implementation", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "DONE" });
      createTicket(db, sid, { ticket_ref: "T-2", assigned_to: "dev2", story_points: 2, status: "BLOCKED" });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "qa");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings).toHaveLength(0);
    });
  });

  // ─── qa → retro ─────────────────────────────────────────────────────

  describe("qa -> retro", () => {
    it("warns if tickets are IN_PROGRESS", () => {
      const sid = createSprint(db, "s1", "qa", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "IN_PROGRESS" });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "retro");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("IN_PROGRESS"))).toBe(true);
    });

    it("passes when no tickets are IN_PROGRESS", () => {
      const sid = createSprint(db, "s1", "qa", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "DONE" });
      createTicket(db, sid, { ticket_ref: "T-2", assigned_to: "dev2", story_points: 2, status: "NOT_DONE" });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "retro");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings).toHaveLength(0);
    });
  });

  // ─── review/closed (QA verification) ─────────────────────────────────

  describe("review/closed gates (QA verification)", () => {
    it("warns if DONE tickets are not QA verified (review)", () => {
      const sid = createSprint(db, "s1", "qa", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "DONE", qa_verified: 0 });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "review");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("QA verification"))).toBe(true);
    });

    it("warns if DONE tickets are not QA verified (closed)", () => {
      const sid = createSprint(db, "s1", "review", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 5, status: "DONE", qa_verified: 0 });
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "closed");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("QA verification"))).toBe(true);
    });

    it("passes when all DONE tickets are QA verified", () => {
      const sid = createSprint(db, "s1", "review", 10);
      createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 5, status: "DONE", qa_verified: 1 });
      createTicket(db, sid, { ticket_ref: "T-2", assigned_to: "dev2", story_points: 2, status: "NOT_DONE" }); // NOT_DONE doesn't need QA
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "closed");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings).toHaveLength(0);
    });
  });

  // ─── closed → rest ───────────────────────────────────────────────────

  describe("closed -> rest", () => {
    it("warns if no retro findings exist", () => {
      const sid = createSprint(db, "s1", "closed", 10);
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "rest");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings.some((g) => g.includes("retro"))).toBe(true);
    });

    it("passes when retro findings exist", () => {
      const sid = createSprint(db, "s1", "closed", 10);
      db.prepare(`INSERT INTO retro_findings (sprint_id, role, category, finding) VALUES (?, ?, ?, ?)`).run(
        sid, "team", "went_well", "Good communication"
      );
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
      const gates = checkSprintGates(db, sprint, "rest");
      expect(gates.canProceed).toBe(true);
      expect(gates.warnings).toHaveLength(0);
    });
  });
});

describe("log_bug CRITICAL auto-regression", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    addSoftDeleteColumns(db);
  });

  /**
   * Simulate the log_bug handler logic directly against the DB,
   * matching the implementation in src/scrum/tools.ts lines 542-556.
   */
  function logBug(sprintId: number, severity: string, description: string): string {
    db.prepare(
      `INSERT INTO bugs (sprint_id, severity, description) VALUES (?, ?, ?)`
    ).run(sprintId, severity, description);

    let regressionNote = "";
    if (severity === "CRITICAL") {
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sprintId) as any;
      if (sprint && sprint.status === "qa") {
        db.prepare(
          `UPDATE sprints SET status = 'implementation', updated_at = datetime('now') WHERE id = ? AND status = 'qa'`
        ).run(sprintId);
        try {
          db.prepare(
            `INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('sprint', ?, 'status_changed', 'status', 'qa', 'implementation', 'mcp')`
          ).run(sprintId);
        } catch {
          // event_log insert is best-effort
        }
        regressionNote = " Sprint regressed to implementation due to CRITICAL bug.";
      }
    }
    return regressionNote;
  }

  it("regresses sprint from QA to implementation on CRITICAL bug", () => {
    const sid = createSprint(db, "qa-sprint", "qa", 10);
    createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "DONE" });

    const note = logBug(sid, "CRITICAL", "App crashes on login");

    const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
    expect(sprint.status).toBe("implementation");
    expect(note).toContain("regressed to implementation");
  });

  it("does NOT regress sprint on MEDIUM bug during QA", () => {
    const sid = createSprint(db, "qa-sprint", "qa", 10);
    createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "DONE" });

    const note = logBug(sid, "MEDIUM", "Minor styling issue");

    const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
    expect(sprint.status).toBe("qa");
    expect(note).toBe("");
  });

  it("does NOT change sprint status when CRITICAL bug logged during implementation", () => {
    const sid = createSprint(db, "impl-sprint", "implementation", 10);
    createTicket(db, sid, { ticket_ref: "T-1", assigned_to: "dev", story_points: 3, status: "IN_PROGRESS" });

    const note = logBug(sid, "CRITICAL", "Critical crash in feature");

    const sprint = db.prepare(`SELECT * FROM sprints WHERE id = ?`).get(sid) as any;
    expect(sprint.status).toBe("implementation");
    expect(note).toBe(""); // no regression since already in implementation
  });

  it("records the bug in the bugs table regardless of severity", () => {
    const sid = createSprint(db, "qa-sprint", "qa", 10);

    logBug(sid, "CRITICAL", "Critical bug");
    logBug(sid, "MEDIUM", "Medium bug");
    logBug(sid, "LOW", "Low bug");

    const bugs = db.prepare(`SELECT * FROM bugs WHERE sprint_id = ? ORDER BY id`).all(sid) as any[];
    expect(bugs).toHaveLength(3);
    expect(bugs[0].severity).toBe("CRITICAL");
    expect(bugs[1].severity).toBe("MEDIUM");
    expect(bugs[2].severity).toBe("LOW");
  });

  it("logs event_log entry when CRITICAL bug triggers regression", () => {
    const sid = createSprint(db, "qa-sprint", "qa", 10);

    logBug(sid, "CRITICAL", "Server down");

    const events = db.prepare(
      `SELECT * FROM event_log WHERE entity_type = 'sprint' AND entity_id = ? AND action = 'status_changed'`
    ).all(sid) as any[];
    expect(events).toHaveLength(1);
    expect(events[0].old_value).toBe("qa");
    expect(events[0].new_value).toBe("implementation");
    expect(events[0].actor).toBe("mcp");
  });
});
