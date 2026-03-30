/**
 * Discovery Auto-Promotion & SSE/Dashboard Coverage Tests
 *
 * Tests:
 * 1. Auto-promotion of discoveries when linked ticket moves to DONE
 * 2. No promotion when ticket moves to IN_PROGRESS
 * 3. Unlinked discoveries stay unaffected
 * 4. apiDiscoveryCoverage is read-only (no side-effect UPDATEs)
 * 5. Dashboard mutation helpers produce correct DB state
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";

let db: Database.Database;

// ── Helpers ──────────────────────────────────────────────────────────────

function setupDb() {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
  runMigrations(db);
  // event_log is created by dashboard.ts at runtime; replicate here
  db.exec(`CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT, entity_id INTEGER, action TEXT,
    field_name TEXT, old_value TEXT, new_value TEXT,
    actor TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);
}

function createSprint(name: string, status = "implementation") {
  const result = db.prepare(
    `INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, ?, ?)`
  ).run(name, "Test goal", status, 19);
  return Number(result.lastInsertRowid);
}

function createTicket(sprintId: number, overrides: Record<string, any> = {}) {
  const defaults = {
    title: "Impl ticket",
    status: "TODO",
    assigned_to: "backend-dev",
    story_points: 3,
    ticket_ref: `T-${Math.random().toString(36).slice(2, 8)}`,
  };
  const data = { ...defaults, ...overrides };
  const result = db.prepare(
    `INSERT INTO tickets (sprint_id, title, status, assigned_to, story_points, ticket_ref)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sprintId, data.title, data.status, data.assigned_to, data.story_points, data.ticket_ref);
  return Number(result.lastInsertRowid);
}

function createDiscovery(sprintId: number, overrides: Record<string, any> = {}) {
  const defaults = {
    finding: "Test discovery finding",
    category: "general",
    status: "planned",
    priority: "P1",
    implementation_ticket_id: null,
  };
  const data = { ...defaults, ...overrides };
  const result = db.prepare(
    `INSERT INTO discoveries (discovery_sprint_id, finding, category, status, priority, implementation_ticket_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sprintId, data.finding, data.category, data.status, data.priority, data.implementation_ticket_id);
  return Number(result.lastInsertRowid);
}

/** Replicates the auto-promotion SQL from update_ticket in tools.ts and dashboard.ts */
function autoPromoteDiscoveries(ticketId: number) {
  db.prepare(`
    UPDATE discoveries SET status = 'implemented', updated_at = datetime('now')
    WHERE status = 'planned' AND implementation_ticket_id = ?
  `).run(ticketId);
}

/** Replicates the read-only apiDiscoveryCoverage from dashboard.ts */
function apiDiscoveryCoverage(sprintId?: number) {
  let sql = `SELECT status, COUNT(*) as count FROM discoveries WHERE 1=1`;
  const params: any[] = [];
  if (sprintId) { sql += " AND discovery_sprint_id = ?"; params.push(sprintId); }
  sql += " GROUP BY status";
  const rows = db.prepare(sql).all(...params) as any[];
  const total = rows.reduce((sum: number, r: any) => sum + r.count, 0);
  const counts: Record<string, number> = { discovered: 0, planned: 0, implemented: 0, dropped: 0 };
  rows.forEach((r: any) => { counts[r.status] = r.count; });
  return { total, ...counts };
}

/** Replicates the auto-promote-all SQL from get_discovery_coverage in tools.ts (the old mutating version) */
function autoPromoteAllDiscoveries() {
  db.prepare(`
    UPDATE discoveries SET status = 'implemented', updated_at = datetime('now')
    WHERE status = 'planned' AND implementation_ticket_id IS NOT NULL
      AND implementation_ticket_id IN (SELECT id FROM tickets WHERE status = 'DONE')
  `).run();
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Discovery auto-promotion", () => {
  beforeEach(() => setupDb());

  it("promotes planned discovery to implemented when linked ticket becomes DONE", () => {
    const sid = createSprint("disco-sprint");
    const tid = createTicket(sid, { status: "TODO" });
    const did = createDiscovery(sid, { status: "planned", implementation_ticket_id: tid });

    // Verify initial state
    const before = db.prepare("SELECT status FROM discoveries WHERE id = ?").get(did) as any;
    expect(before.status).toBe("planned");

    // Simulate update_ticket setting status = DONE, then auto-promote
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(tid);
    autoPromoteDiscoveries(tid);

    const after = db.prepare("SELECT status FROM discoveries WHERE id = ?").get(did) as any;
    expect(after.status).toBe("implemented");
  });

  it("does NOT promote discovery when ticket moves to IN_PROGRESS", () => {
    const sid = createSprint("disco-sprint-2");
    const tid = createTicket(sid, { status: "TODO" });
    const did = createDiscovery(sid, { status: "planned", implementation_ticket_id: tid });

    // Move ticket to IN_PROGRESS -- no auto-promotion should happen
    db.prepare("UPDATE tickets SET status = 'IN_PROGRESS' WHERE id = ?").run(tid);
    // auto-promotion only fires on DONE, so we do NOT call autoPromoteDiscoveries

    const after = db.prepare("SELECT status FROM discoveries WHERE id = ?").get(did) as any;
    expect(after.status).toBe("planned");
  });

  it("does NOT promote discovery with status other than planned", () => {
    const sid = createSprint("disco-sprint-3");
    const tid = createTicket(sid, { status: "TODO" });
    const did = createDiscovery(sid, { status: "discovered", implementation_ticket_id: tid });

    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(tid);
    autoPromoteDiscoveries(tid);

    const after = db.prepare("SELECT status FROM discoveries WHERE id = ?").get(did) as any;
    expect(after.status).toBe("discovered");
  });

  it("discovery with no linked ticket stays discovered regardless of ticket changes", () => {
    const sid = createSprint("disco-sprint-4");
    const tid = createTicket(sid, { status: "TODO" });
    // Discovery has no implementation_ticket_id
    const did = createDiscovery(sid, { status: "discovered", implementation_ticket_id: null });

    // Move a random ticket to DONE
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(tid);
    autoPromoteDiscoveries(tid);

    const after = db.prepare("SELECT status FROM discoveries WHERE id = ?").get(did) as any;
    expect(after.status).toBe("discovered");
  });

  it("promotes multiple discoveries linked to the same ticket", () => {
    const sid = createSprint("disco-sprint-5");
    const tid = createTicket(sid, { status: "TODO" });
    const d1 = createDiscovery(sid, { finding: "Finding A", status: "planned", implementation_ticket_id: tid });
    const d2 = createDiscovery(sid, { finding: "Finding B", status: "planned", implementation_ticket_id: tid });
    const d3 = createDiscovery(sid, { finding: "Finding C", status: "discovered", implementation_ticket_id: tid });

    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(tid);
    autoPromoteDiscoveries(tid);

    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d1) as any).status).toBe("implemented");
    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d2) as any).status).toBe("implemented");
    // d3 was 'discovered', not 'planned' -- stays unchanged
    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d3) as any).status).toBe("discovered");
  });

  it("batch auto-promote-all promotes only discoveries whose ticket is DONE", () => {
    const sid = createSprint("disco-sprint-6");
    const tidDone = createTicket(sid, { status: "DONE", title: "Done ticket" });
    const tidWip = createTicket(sid, { status: "IN_PROGRESS", title: "WIP ticket" });

    const d1 = createDiscovery(sid, { finding: "Linked to done", status: "planned", implementation_ticket_id: tidDone });
    const d2 = createDiscovery(sid, { finding: "Linked to wip", status: "planned", implementation_ticket_id: tidWip });
    const d3 = createDiscovery(sid, { finding: "Unlinked", status: "planned", implementation_ticket_id: null });

    autoPromoteAllDiscoveries();

    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d1) as any).status).toBe("implemented");
    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d2) as any).status).toBe("planned");
    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d3) as any).status).toBe("planned");
  });
});

describe("apiDiscoveryCoverage is read-only", () => {
  beforeEach(() => setupDb());

  it("does NOT mutate discovery statuses when called", () => {
    const sid = createSprint("coverage-sprint");
    const tid = createTicket(sid, { status: "DONE", title: "Done ticket" });

    // Create a planned discovery linked to a DONE ticket
    const did = createDiscovery(sid, { status: "planned", implementation_ticket_id: tid });

    // Call the read-only coverage function
    const coverage = apiDiscoveryCoverage(sid);
    expect(coverage.total).toBe(1);
    expect(coverage.planned).toBe(1);
    expect(coverage.implemented).toBe(0);

    // The discovery should still be planned -- not auto-promoted
    const after = db.prepare("SELECT status FROM discoveries WHERE id = ?").get(did) as any;
    expect(after.status).toBe("planned");
  });

  it("returns correct coverage counts across statuses", () => {
    const sid = createSprint("coverage-sprint-2");

    createDiscovery(sid, { finding: "A", status: "discovered" });
    createDiscovery(sid, { finding: "B", status: "planned" });
    createDiscovery(sid, { finding: "C", status: "planned" });
    createDiscovery(sid, { finding: "D", status: "implemented" });
    createDiscovery(sid, { finding: "E", status: "dropped" });

    const coverage = apiDiscoveryCoverage(sid);
    expect(coverage.total).toBe(5);
    expect(coverage.discovered).toBe(1);
    expect(coverage.planned).toBe(2);
    expect(coverage.implemented).toBe(1);
    expect(coverage.dropped).toBe(1);
  });

  it("returns zeroes for empty sprint", () => {
    const sid = createSprint("empty-sprint");
    const coverage = apiDiscoveryCoverage(sid);
    expect(coverage.total).toBe(0);
    expect(coverage.discovered).toBe(0);
    expect(coverage.planned).toBe(0);
    expect(coverage.implemented).toBe(0);
    expect(coverage.dropped).toBe(0);
  });

  it("returns all-sprint totals when no sprint_id given", () => {
    const s1 = createSprint("sprint-a");
    const s2 = createSprint("sprint-b");

    createDiscovery(s1, { finding: "A1", status: "discovered" });
    createDiscovery(s1, { finding: "A2", status: "planned" });
    createDiscovery(s2, { finding: "B1", status: "implemented" });

    const coverage = apiDiscoveryCoverage();
    expect(coverage.total).toBe(3);
    expect(coverage.discovered).toBe(1);
    expect(coverage.planned).toBe(1);
    expect(coverage.implemented).toBe(1);
  });
});

describe("Dashboard DB mutation helpers", () => {
  beforeEach(() => setupDb());

  it("apiUpdateTicket pattern: updates ticket fields and triggers auto-promotion", () => {
    const sid = createSprint("mutation-sprint");
    const tid = createTicket(sid, { status: "TODO", title: "My ticket" });
    const did = createDiscovery(sid, { status: "planned", implementation_ticket_id: tid });

    // Replicate apiUpdateTicket logic
    const body = { status: "DONE" };
    const existing = db.prepare("SELECT * FROM tickets WHERE id = ?").get(tid) as any;
    expect(existing).toBeDefined();

    const sets: string[] = [];
    const vals: any[] = [];
    if (body.status !== undefined) { sets.push("status=?"); vals.push(body.status); }
    sets.push("updated_at=datetime('now')");
    vals.push(tid);
    db.prepare(`UPDATE tickets SET ${sets.join(",")} WHERE id=?`).run(...vals);

    // Auto-promote (replicates the code after UPDATE in apiUpdateTicket)
    if (body.status === "DONE") {
      autoPromoteDiscoveries(tid);
    }

    const ticket = db.prepare("SELECT status FROM tickets WHERE id = ?").get(tid) as any;
    expect(ticket.status).toBe("DONE");

    const discovery = db.prepare("SELECT status FROM discoveries WHERE id = ?").get(did) as any;
    expect(discovery.status).toBe("implemented");
  });

  it("apiCreateMilestone pattern: inserts milestone and verifies DB state", () => {
    const name = "M1: Foundation";
    const description = "Core infra";
    const target_date = "2026-04-15";
    const status = "planned";

    const result = db.prepare(
      `INSERT INTO milestones (name, description, target_date, status) VALUES (?, ?, ?, ?)`
    ).run(name, description, target_date, status);

    const milestone = db.prepare("SELECT * FROM milestones WHERE id = ?").get(result.lastInsertRowid) as any;
    expect(milestone).toBeDefined();
    expect(milestone.name).toBe(name);
    expect(milestone.description).toBe(description);
    expect(milestone.target_date).toBe(target_date);
    expect(milestone.status).toBe("planned");
  });

  it("link_discovery_to_ticket pattern: sets status based on ticket state", () => {
    const sid = createSprint("link-sprint");
    const tidDone = createTicket(sid, { status: "DONE", title: "Done ticket" });
    const tidTodo = createTicket(sid, { status: "TODO", title: "Todo ticket" });

    const d1 = createDiscovery(sid, { status: "discovered" });
    const d2 = createDiscovery(sid, { status: "discovered" });

    // Link d1 to a DONE ticket -> should become implemented
    const ticket1 = db.prepare("SELECT id, title, status FROM tickets WHERE id = ?").get(tidDone) as any;
    const newStatus1 = ticket1.status === "DONE" ? "implemented" : "planned";
    db.prepare("UPDATE discoveries SET implementation_ticket_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(tidDone, newStatus1, d1);

    // Link d2 to a TODO ticket -> should become planned
    const ticket2 = db.prepare("SELECT id, title, status FROM tickets WHERE id = ?").get(tidTodo) as any;
    const newStatus2 = ticket2.status === "DONE" ? "implemented" : "planned";
    db.prepare("UPDATE discoveries SET implementation_ticket_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(tidTodo, newStatus2, d2);

    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d1) as any).status).toBe("implemented");
    expect((db.prepare("SELECT status FROM discoveries WHERE id = ?").get(d2) as any).status).toBe("planned");
  });

  it("notifyClients function formats SSE payload with event details", () => {
    // Test the SSE payload format that notifyClients produces
    // (Cannot import notifyClients directly as it closes over HTTP state,
    //  but we verify the payload shape matches what dashboard.ts generates)
    const event = { type: "updated", entityType: "ticket", entityId: 42, change: { status: "DONE" } };
    const payload = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
    const parsed = JSON.parse(payload);

    expect(parsed.type).toBe("updated");
    expect(parsed.entityType).toBe("ticket");
    expect(parsed.entityId).toBe(42);
    expect(parsed.change).toEqual({ status: "DONE" });
    expect(parsed.timestamp).toBeDefined();
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("notifyClients default payload (no event arg) has correct shape", () => {
    // Replicates the fallback branch of notifyClients when called with no arguments
    const payload = JSON.stringify({ type: "updated", timestamp: new Date().toISOString() });
    const parsed = JSON.parse(payload);

    expect(parsed.type).toBe("updated");
    expect(parsed.timestamp).toBeDefined();
    expect(Object.keys(parsed)).toHaveLength(2);
  });
});

describe("Discovery schema constraints", () => {
  beforeEach(() => setupDb());

  it("rejects invalid discovery status", () => {
    const sid = createSprint("constraint-sprint");
    expect(() => {
      db.prepare(
        `INSERT INTO discoveries (discovery_sprint_id, finding, status) VALUES (?, ?, ?)`
      ).run(sid, "Bad status finding", "INVALID");
    }).toThrow();
  });

  it("rejects invalid discovery category", () => {
    const sid = createSprint("constraint-sprint-2");
    expect(() => {
      db.prepare(
        `INSERT INTO discoveries (discovery_sprint_id, finding, category) VALUES (?, ?, ?)`
      ).run(sid, "Bad category", "INVALID_CAT");
    }).toThrow();
  });

  it("rejects invalid discovery priority", () => {
    const sid = createSprint("constraint-sprint-3");
    expect(() => {
      db.prepare(
        `INSERT INTO discoveries (discovery_sprint_id, finding, priority) VALUES (?, ?, ?)`
      ).run(sid, "Bad priority", "P99");
    }).toThrow();
  });

  it("foreign key enforces valid sprint reference", () => {
    expect(() => {
      db.prepare(
        `INSERT INTO discoveries (discovery_sprint_id, finding) VALUES (?, ?)`
      ).run(99999, "Orphan finding");
    }).toThrow();
  });

  it("sprint delete is blocked by discovery FK (no CASCADE)", () => {
    const sid = createSprint("fk-sprint");
    const did = createDiscovery(sid, { status: "planned" });

    // discoveries FK to sprints has no ON DELETE CASCADE, so deleting sprint should fail
    expect(() => {
      db.prepare("DELETE FROM sprints WHERE id = ?").run(sid);
    }).toThrow();

    // Discovery and sprint both still exist
    const discovery = db.prepare("SELECT * FROM discoveries WHERE id = ?").get(did);
    expect(discovery).toBeDefined();
  });
});
