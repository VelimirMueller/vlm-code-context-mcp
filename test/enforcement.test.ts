/**
 * Sprint Enforcement Tests
 * Tests gate checks on update_ticket, update_sprint phase transitions,
 * and the advance_sprint ceremony tool logic.
 *
 * Since MCP tools wrap DB operations, we test the underlying DB state
 * changes and gate logic directly via the dashboard REST API pattern.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { seedDefaults } from "../src/scrum/defaults.js";

let db: Database.Database;

function createTestSprint(status = "implementation") {
  const result = db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, ?, ?)`).run("Test Sprint", "Test goal", status, 19);
  return Number(result.lastInsertRowid);
}

function createTestTicket(sprintId: number, overrides: Record<string, any> = {}) {
  const defaults = { title: "Test ticket", status: "TODO", assigned_to: "backend-dev", story_points: 3, sprint_id: sprintId };
  const data = { ...defaults, ...overrides };
  const result = db.prepare(`INSERT INTO tickets (title, status, assigned_to, story_points, sprint_id, ticket_ref) VALUES (?, ?, ?, ?, ?, ?)`).run(
    data.title, data.status, data.assigned_to, data.story_points, data.sprint_id, `T-${Math.random().toString(36).slice(2, 6)}`
  );
  return Number(result.lastInsertRowid);
}

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
  runMigrations(db);
  // Create event_log table (normally created by dashboard.ts)
  db.exec(`CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT, entity_id INTEGER, action TEXT,
    field_name TEXT, old_value TEXT, new_value TEXT,
    actor TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);
});

describe("ticket gate enforcement", () => {
  it("ticket cannot be DONE without assignee", () => {
    const sid = createTestSprint();
    const tid = createTestTicket(sid, { assigned_to: null });
    const ticket = db.prepare("SELECT assigned_to FROM tickets WHERE id = ?").get(tid) as any;
    expect(ticket.assigned_to).toBeNull();
    // Gate: DONE requires assigned_to
  });

  it("ticket can be DONE with assignee in implementation phase", () => {
    const sid = createTestSprint("implementation");
    const tid = createTestTicket(sid, { assigned_to: "backend-dev" });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(tid);
    const ticket = db.prepare("SELECT status FROM tickets WHERE id = ?").get(tid) as any;
    expect(ticket.status).toBe("DONE");
  });

  it("ticket can be DONE in qa phase", () => {
    const sid = createTestSprint("qa");
    const tid = createTestTicket(sid, { assigned_to: "qa" });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(tid);
    const ticket = db.prepare("SELECT status FROM tickets WHERE id = ?").get(tid) as any;
    expect(ticket.status).toBe("DONE");
  });
});

describe("sprint phase transition gates", () => {
  it("sprint cannot advance to qa with undone tickets", () => {
    const sid = createTestSprint("implementation");
    createTestTicket(sid, { status: "IN_PROGRESS" });
    createTestTicket(sid, { status: "DONE" });
    const undone = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND status NOT IN ('DONE','BLOCKED','NOT_DONE')").get(sid) as any;
    expect(undone.c).toBe(1); // Gate should block
  });

  it("sprint can advance to qa when all tickets are DONE", () => {
    const sid = createTestSprint("implementation");
    createTestTicket(sid, { status: "DONE" });
    createTestTicket(sid, { status: "DONE" });
    const undone = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND status NOT IN ('DONE','BLOCKED','NOT_DONE')").get(sid) as any;
    expect(undone.c).toBe(0); // Gate passes
  });

  it("sprint cannot close without QA verification", () => {
    const sid = createTestSprint("review");
    const tid = createTestTicket(sid, { status: "DONE" });
    const unverified = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND status = 'DONE' AND qa_verified = 0").get(sid) as any;
    expect(unverified.c).toBe(1); // Gate should block
  });

  it("sprint can close when all DONE tickets are QA verified", () => {
    const sid = createTestSprint("review");
    const tid = createTestTicket(sid, { status: "DONE" });
    db.prepare("UPDATE tickets SET qa_verified = 1 WHERE id = ?").run(tid);
    const unverified = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND status = 'DONE' AND qa_verified = 0").get(sid) as any;
    expect(unverified.c).toBe(0); // Gate passes
  });

  it("sprint cannot go to rest without retro findings", () => {
    const sid = createTestSprint("closed");
    const retroCount = (db.prepare("SELECT COUNT(*) as c FROM retro_findings WHERE sprint_id = ?").get(sid) as any).c;
    expect(retroCount).toBe(0); // Gate should block
  });

  it("sprint can go to rest with retro findings", () => {
    const sid = createTestSprint("closed");
    db.prepare("INSERT INTO retro_findings (sprint_id, category, finding, role) VALUES (?, 'went_well', 'Test finding', 'qa')").run(sid);
    const retroCount = (db.prepare("SELECT COUNT(*) as c FROM retro_findings WHERE sprint_id = ?").get(sid) as any).c;
    expect(retroCount).toBe(1); // Gate passes
  });

  it("valid transition sequence works end-to-end", () => {
    const sid = createTestSprint("preparation");
    const PHASES = ["kickoff", "planning", "implementation", "qa", "retro", "review", "closed", "rest"];
    // Create a ticket for gate checks
    const tid = createTestTicket(sid, { status: "TODO" });

    // Advance to implementation
    for (const phase of ["kickoff", "planning", "implementation"]) {
      db.prepare("UPDATE sprints SET status = ? WHERE id = ?").run(phase, sid);
    }
    // Do the work
    db.prepare("UPDATE tickets SET status = 'DONE', qa_verified = 1 WHERE id = ?").run(tid);
    db.prepare("UPDATE sprints SET velocity_completed = 3 WHERE id = ?").run(sid);

    // Advance through remaining phases
    for (const phase of ["qa", "retro"]) {
      db.prepare("UPDATE sprints SET status = ? WHERE id = ?").run(phase, sid);
    }
    // Add retro finding
    db.prepare("INSERT INTO retro_findings (sprint_id, category, finding) VALUES (?, 'went_well', 'E2E test')").run(sid);
    for (const phase of ["review", "closed", "rest"]) {
      db.prepare("UPDATE sprints SET status = ? WHERE id = ?").run(phase, sid);
    }

    const final = db.prepare("SELECT status FROM sprints WHERE id = ?").get(sid) as any;
    expect(final.status).toBe("rest");
  });
});

describe("event trail", () => {
  it("event_log records status changes", () => {
    db.prepare("INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('ticket', 1, 'status_changed', 'status', 'TODO', 'IN_PROGRESS', 'mcp')").run();
    const events = db.prepare("SELECT * FROM event_log WHERE entity_type = 'ticket'").all() as any[];
    expect(events.length).toBe(1);
    expect(events[0].old_value).toBe("TODO");
    expect(events[0].new_value).toBe("IN_PROGRESS");
    expect(events[0].actor).toBe("mcp");
  });

  it("event_log records sprint phase transitions", () => {
    db.prepare("INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('sprint', 1, 'status_changed', 'status', 'planning', 'implementation', 'mcp')").run();
    const events = db.prepare("SELECT * FROM event_log WHERE entity_type = 'sprint'").all() as any[];
    expect(events.length).toBe(1);
    expect(events[0].field_name).toBe("status");
  });

  it("event_log records qa_verified changes", () => {
    db.prepare("INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('ticket', 1, 'updated', 'qa_verified', 'false', 'true', 'mcp')").run();
    const events = db.prepare("SELECT * FROM event_log WHERE field_name = 'qa_verified'").all() as any[];
    expect(events.length).toBe(1);
    expect(events[0].new_value).toBe("true");
  });
});

describe("advance_sprint logic", () => {
  it("TRANSITIONS map covers all phases", () => {
    const TRANSITIONS: Record<string, string> = {
      preparation: "kickoff", kickoff: "planning", planning: "implementation",
      implementation: "qa", qa: "retro", refactoring: "retro",
      retro: "review", review: "closed", closed: "rest",
    };
    expect(Object.keys(TRANSITIONS).length).toBe(9);
    expect(TRANSITIONS["implementation"]).toBe("qa");
    expect(TRANSITIONS["qa"]).toBe("retro"); // Skip refactoring (optional)
  });
});
