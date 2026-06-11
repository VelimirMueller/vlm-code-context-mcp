import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import {
  autoApplyRetroActions,
  getUntriagedTryNext,
  getOpenDiscoveries,
  checkPlanningGate,
  buildPlanningGateContext,
  buildSprintPulseData,
} from "../src/scrum/tools.js";
import Database from "better-sqlite3";

function setupDb(): Database.Database {
  const db = createTestDb();
  initScrumSchema(db);
  runMigrations(db);
  return db;
}

function createSprint(db: Database.Database, name: string, status = "rest"): number {
  db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run(name, status);
  return (db.prepare(`SELECT id FROM sprints WHERE name = ?`).get(name) as any).id;
}

function createTicket(db: Database.Database, title: string, status = "TODO"): number {
  db.prepare(`INSERT INTO tickets (title, status) VALUES (?, ?)`).run(title, status);
  return (db.prepare(`SELECT id FROM tickets WHERE title = ?`).get(title) as any).id;
}

function addTryNext(db: Database.Database, sprintId: number, finding: string, owner?: string): number {
  db.prepare(
    `INSERT INTO retro_findings (sprint_id, category, finding, action_owner) VALUES (?, 'try_next', ?, ?)`
  ).run(sprintId, finding, owner || null);
  return (db.prepare(`SELECT id FROM retro_findings WHERE finding = ?`).get(finding) as any).id;
}

function addDiscovery(db: Database.Database, sprintId: number, finding: string, priority: string): number {
  db.prepare(
    `INSERT INTO discoveries (discovery_sprint_id, finding, priority, status, category) VALUES (?, ?, ?, 'discovered', 'general')`
  ).run(sprintId, finding, priority);
  return (db.prepare(`SELECT id FROM discoveries WHERE finding = ?`).get(finding) as any).id;
}

describe("migration v21 — retro finding lifecycle", () => {
  it("adds status/dropped_reason/deferred_at to a legacy retro_findings table", () => {
    const db = setupDb();
    // Simulate a pre-v21 table: rebuild retro_findings without the lifecycle columns
    db.exec(`
      DROP TABLE retro_findings;
      CREATE TABLE retro_findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sprint_id INTEGER NOT NULL,
        role TEXT,
        category TEXT NOT NULL CHECK (category IN ('went_well', 'went_wrong', 'try_next', 'auto_analysis')),
        finding TEXT NOT NULL,
        action_owner TEXT,
        action_applied INTEGER NOT NULL DEFAULT 0,
        linked_ticket_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const sid = createSprint(db, "Legacy Sprint");
    db.prepare(`INSERT INTO retro_findings (sprint_id, category, finding) VALUES (?, 'try_next', 'old item')`).run(sid);

    runMigrations(db);

    const cols = (db.pragma("table_info(retro_findings)") as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain("status");
    expect(cols).toContain("dropped_reason");
    expect(cols).toContain("deferred_at");
    // Existing rows backfill to the un-triaged state
    const row = db.prepare(`SELECT status FROM retro_findings WHERE finding = 'old item'`).get() as any;
    expect(row.status).toBe("open");
  });

  it("is idempotent — running migrations twice does not throw", () => {
    const db = setupDb();
    expect(() => runMigrations(db)).not.toThrow();
  });
});

describe("getUntriagedTryNext", () => {
  let db: Database.Database;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    sprintId = createSprint(db, "Sprint 1");
  });

  it("returns open try_next findings with sprint age", () => {
    addTryNext(db, sprintId, "do the thing", "devops");
    createSprint(db, "Sprint 2");
    createSprint(db, "Sprint 3");

    const items = getUntriagedTryNext(db);
    expect(items).toHaveLength(1);
    expect(items[0].finding).toBe("do the thing");
    expect(items[0].age_sprints).toBe(2);
    expect(items[0].action_owner).toBe("devops");
  });

  it("excludes adopted and dropped findings", () => {
    const a = addTryNext(db, sprintId, "adopted one");
    const b = addTryNext(db, sprintId, "dropped one");
    addTryNext(db, sprintId, "open one");
    db.prepare(`UPDATE retro_findings SET status = 'adopted' WHERE id = ?`).run(a);
    db.prepare(`UPDATE retro_findings SET status = 'dropped' WHERE id = ?`).run(b);

    const items = getUntriagedTryNext(db);
    expect(items).toHaveLength(1);
    expect(items[0].finding).toBe("open one");
  });

  it("excludes recently deferred but includes stale deferrals", () => {
    const fresh = addTryNext(db, sprintId, "deferred just now");
    const stale = addTryNext(db, sprintId, "deferred two days ago");
    db.prepare(`UPDATE retro_findings SET deferred_at = datetime('now') WHERE id = ?`).run(fresh);
    db.prepare(`UPDATE retro_findings SET deferred_at = datetime('now', '-2 days') WHERE id = ?`).run(stale);

    const items = getUntriagedTryNext(db);
    expect(items).toHaveLength(1);
    expect(items[0].finding).toBe("deferred two days ago");
  });

  it("ignores non-try_next categories", () => {
    db.prepare(`INSERT INTO retro_findings (sprint_id, category, finding) VALUES (?, 'went_wrong', 'a problem')`).run(sprintId);
    expect(getUntriagedTryNext(db)).toHaveLength(0);
  });
});

describe("getOpenDiscoveries / escalation", () => {
  let db: Database.Database;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    sprintId = createSprint(db, "Sprint 1");
  });

  it("flags P0/P1 discoveries older than 3 sprints as escalated", () => {
    addDiscovery(db, sprintId, "old p0", "P0");
    addDiscovery(db, sprintId, "old p2", "P2");
    for (let i = 2; i <= 5; i++) createSprint(db, `Sprint ${i}`);

    const all = getOpenDiscoveries(db);
    const p0 = all.find((d: any) => d.finding === "old p0");
    const p2 = all.find((d: any) => d.finding === "old p2");
    expect(p0.age_sprints).toBe(4);
    expect(p0.escalated).toBe(true);
    expect(p2.escalated).toBe(false);
  });

  it("does not flag young P0 discoveries", () => {
    addDiscovery(db, sprintId, "fresh p0", "P0");
    createSprint(db, "Sprint 2");
    const [d] = getOpenDiscoveries(db);
    expect(d.escalated).toBe(false);
  });

  it("excludes planned/implemented/dropped discoveries", () => {
    const id = addDiscovery(db, sprintId, "already planned", "P0");
    db.prepare(`UPDATE discoveries SET status = 'planned' WHERE id = ?`).run(id);
    expect(getOpenDiscoveries(db)).toHaveLength(0);
  });
});

describe("checkPlanningGate", () => {
  let db: Database.Database;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    sprintId = createSprint(db, "Sprint 1");
  });

  it("blocks on untriaged try_next findings", () => {
    addTryNext(db, sprintId, "never triaged");
    const gate = checkPlanningGate(db);
    expect(gate.blocked).toBe(true);
    expect(gate.sections.join("\n")).toContain("Untriaged try_next");
    expect(gate.sections.join("\n")).toContain("never triaged");
  });

  it("blocks on escalated discoveries and names them", () => {
    addDiscovery(db, sprintId, "ancient p0 debt", "P0");
    for (let i = 2; i <= 6; i++) createSprint(db, `Sprint ${i}`);
    const gate = checkPlanningGate(db);
    expect(gate.blocked).toBe(true);
    expect(gate.sections.join("\n")).toContain("ancient p0 debt");
    expect(gate.sections.join("\n")).toContain("Escalated open discoveries");
  });

  it("does not block on young, non-escalated discoveries", () => {
    addDiscovery(db, sprintId, "fresh p2 idea", "P2");
    const gate = checkPlanningGate(db);
    expect(gate.blocked).toBe(false);
  });

  it("passes when everything is triaged or freshly deferred", () => {
    const a = addTryNext(db, sprintId, "adopted");
    const b = addTryNext(db, sprintId, "deferred");
    const ticket = createTicket(db, "the adoption ticket");
    db.prepare(`UPDATE retro_findings SET status = 'adopted', linked_ticket_id = ? WHERE id = ?`).run(ticket, a);
    db.prepare(`UPDATE retro_findings SET deferred_at = datetime('now') WHERE id = ?`).run(b);
    const gate = checkPlanningGate(db);
    expect(gate.blocked).toBe(false);
    expect(gate.sections).toHaveLength(0);
  });

  it("lists at most 10 findings and summarizes the rest", () => {
    for (let i = 0; i < 13; i++) addTryNext(db, sprintId, `finding number ${i}`);
    const gate = checkPlanningGate(db);
    const text = gate.sections.join("\n");
    expect(text).toContain("and 3 more");
  });
});

describe("autoApplyRetroActions", () => {
  let db: Database.Database;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    sprintId = createSprint(db, "Sprint 1");
  });

  it("flips action_applied when the adopted ticket reaches DONE", () => {
    const f = addTryNext(db, sprintId, "ship it");
    const t = createTicket(db, "implementation ticket", "DONE");
    db.prepare(`UPDATE retro_findings SET status = 'adopted', linked_ticket_id = ? WHERE id = ?`).run(t, f);

    const changed = autoApplyRetroActions(db);
    expect(changed).toBe(1);
    const row = db.prepare(`SELECT action_applied FROM retro_findings WHERE id = ?`).get(f) as any;
    expect(row.action_applied).toBe(1);
  });

  it("does not flip while the ticket is unfinished, and is idempotent", () => {
    const f = addTryNext(db, sprintId, "ship it later");
    const t = createTicket(db, "wip ticket", "IN_PROGRESS");
    db.prepare(`UPDATE retro_findings SET status = 'adopted', linked_ticket_id = ? WHERE id = ?`).run(t, f);

    expect(autoApplyRetroActions(db)).toBe(0);
    db.prepare(`UPDATE tickets SET status = 'DONE' WHERE id = ?`).run(t);
    expect(autoApplyRetroActions(db)).toBe(1);
    expect(autoApplyRetroActions(db)).toBe(0); // already applied — no double count
  });

  it("never touches open or dropped findings", () => {
    const f = addTryNext(db, sprintId, "open item");
    const t = createTicket(db, "done ticket", "DONE");
    db.prepare(`UPDATE retro_findings SET linked_ticket_id = ? WHERE id = ?`).run(t, f); // still status=open
    expect(autoApplyRetroActions(db)).toBe(0);
  });
});

describe("buildPlanningGateContext", () => {
  let db: Database.Database;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    sprintId = createSprint(db, "Sprint 1");
  });

  it("lists open try_next with deferred markers and open discoveries with escalation", () => {
    addTryNext(db, sprintId, "an open action", "qa");
    const deferred = addTryNext(db, sprintId, "a deferred action");
    db.prepare(`UPDATE retro_findings SET deferred_at = datetime('now') WHERE id = ?`).run(deferred);
    addDiscovery(db, sprintId, "p0 from long ago", "P0");
    for (let i = 2; i <= 6; i++) createSprint(db, `Sprint ${i}`);

    const ctx = buildPlanningGateContext(db);
    expect(ctx).toContain("## Open try_next (2)");
    expect(ctx).toContain("an open action");
    expect(ctx).toContain("(deferred) a deferred action");
    expect(ctx).toContain("## Open discoveries (1)");
    expect(ctx).toContain("⚠ ESCALATED P0");
    expect(ctx).toContain("Triage directive");
    expect(ctx).toContain("acknowledge_open_items");
  });

  it("shows the all-clear when nothing is open", () => {
    const ctx = buildPlanningGateContext(db);
    expect(ctx).toContain("## Open try_next (0)");
    expect(ctx).toContain("None — all triaged. ✓");
    expect(ctx).not.toContain("Triage directive");
  });

  it("auto-applies adopted+done findings as a side effect", () => {
    const f = addTryNext(db, sprintId, "done deal");
    const t = createTicket(db, "landed", "DONE");
    db.prepare(`UPDATE retro_findings SET status = 'adopted', linked_ticket_id = ? WHERE id = ?`).run(t, f);
    buildPlanningGateContext(db);
    const row = db.prepare(`SELECT action_applied FROM retro_findings WHERE id = ?`).get(f) as any;
    expect(row.action_applied).toBe(1);
  });
});

describe("buildSprintPulseData (B1 card wiring)", () => {
  let db: Database.Database;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    db.prepare(`INSERT INTO sprints (name, status, velocity_committed, start_date) VALUES ('Pulse Sprint', 'implementation', 12, date('now', '-1 day'))`).run();
    sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = 'Pulse Sprint'`).get() as any).id;
  });

  function addSprintTicket(title: string, status: string, points: number, qa = 0): void {
    db.prepare(`INSERT INTO tickets (sprint_id, title, status, story_points, qa_verified) VALUES (?, ?, ?, ?, ?)`)
      .run(sprintId, title, status, points, qa);
  }

  it("assembles counts, points, day, and warnings", () => {
    addSprintTicket("a", "DONE", 3, 1);
    addSprintTicket("b", "DONE", 2, 0); // QA pending → warning
    addSprintTicket("c", "IN_PROGRESS", 3);
    addSprintTicket("d", "TODO", 2);
    addSprintTicket("e", "BLOCKED", 2);
    db.prepare(`INSERT INTO blockers (sprint_id, description, status) VALUES (?, 'stuck', 'open')`).run(sprintId);

    const pulse = buildSprintPulseData(db, sprintId)!;
    expect(pulse.sprintName).toBe("Pulse Sprint");
    expect(pulse.counts).toEqual({ done: 2, inProgress: 1, todo: 1, blocked: 1 });
    expect(pulse.donePoints).toBe(5);
    expect(pulse.totalPoints).toBe(12);
    expect(pulse.day).toBe(2); // started yesterday
    expect(pulse.dayTotal).toBe(5);
    expect(pulse.warnings).toContain("1 open blocker(s)");
    expect(pulse.warnings).toContain("QA pending on 1 done ticket(s)");
  });

  it("clamps day into [1, dayTotal] and handles missing start_date", () => {
    db.prepare(`UPDATE sprints SET start_date = date('now', '-30 day') WHERE id = ?`).run(sprintId);
    expect(buildSprintPulseData(db, sprintId)!.day).toBe(5);
    db.prepare(`UPDATE sprints SET start_date = NULL WHERE id = ?`).run(sprintId);
    expect(buildSprintPulseData(db, sprintId)!.day).toBe(1);
  });

  it("maps burndown snapshots to the series and returns null for unknown sprints", () => {
    db.prepare(`INSERT INTO sprint_metrics (sprint_id, date, completed_points, remaining_points) VALUES (?, date('now', '-1 day'), 3, 9)`).run(sprintId);
    db.prepare(`INSERT INTO sprint_metrics (sprint_id, date, completed_points, remaining_points) VALUES (?, date('now'), 5, 7)`).run(sprintId);
    expect(buildSprintPulseData(db, sprintId)!.burndown).toEqual([3, 5]);
    expect(buildSprintPulseData(db, 99999)).toBeNull();
  });
});
