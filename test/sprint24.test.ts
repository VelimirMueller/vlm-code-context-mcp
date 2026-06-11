import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import {
  applyTicketAssignments,
  buildModelRoutingSection,
  buildChangedTicketsBlock,
  registerScrumTools,
} from "../src/scrum/tools.js";
import Database from "better-sqlite3";

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

class FakeServer {
  tools = new Map<string, Handler>();
  tool(name: string, _desc: string, _schema: unknown, handler: Handler): void {
    this.tools.set(name, handler);
  }
}

function setupDb(): Database.Database {
  const db = createTestDb();
  initScrumSchema(db);
  runMigrations(db);
  return db;
}

function setupHandlers(db: Database.Database): Map<string, Handler> {
  const server = new FakeServer();
  registerScrumTools(server as never, db);
  return server.tools;
}

const text = (res: { content: Array<{ text: string }> }): string => res.content.map((c) => c.text).join("\n");

function seedAgents(db: Database.Database, roles: string[]): void {
  for (const role of roles) {
    db.prepare(`INSERT OR IGNORE INTO agents (role, name, model) VALUES (?, ?, ?)`).run(role, role, role === "developer" ? "claude-opus-4-8" : "claude-sonnet-4-6");
  }
}

function seedTicket(db: Database.Database, overrides: Record<string, unknown> = {}): number {
  const t = { sprint_id: null, title: "t", assigned_to: null, story_points: 1, ...overrides };
  db.prepare(`INSERT INTO tickets (sprint_id, title, assigned_to, story_points) VALUES (?, ?, ?, ?)`)
    .run(t.sprint_id, t.title, t.assigned_to, t.story_points);
  return Number((db.prepare(`SELECT last_insert_rowid() as id`).get() as any).id);
}

describe("migration v23", () => {
  it("adds change flags, revisions, and assignments with lead backfill", () => {
    const db = setupDb();
    const cols = (db.pragma("table_info(tickets)") as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain("change_seq");
    expect(cols).toContain("pending_change");

    // Legacy ticket with assigned_to but no assignment row → backfilled as lead on re-run
    db.prepare(`INSERT INTO tickets (title, assigned_to) VALUES ('legacy', 'developer')`).run();
    runMigrations(db);
    const row = db.prepare(`
      SELECT ta.role, ta.is_lead FROM ticket_assignments ta
      JOIN tickets t ON t.id = ta.ticket_id WHERE t.title = 'legacy'
    `).get() as any;
    expect(row).toEqual({ role: "developer", is_lead: 1 });

    // Idempotent — no duplicate lead rows
    runMigrations(db);
    const count = db.prepare(`
      SELECT COUNT(*) as c FROM ticket_assignments ta JOIN tickets t ON t.id = ta.ticket_id WHERE t.title = 'legacy'
    `).get() as any;
    expect(count.c).toBe(1);
  });
});

describe("applyTicketAssignments (D2)", () => {
  let db: Database.Database;
  let ticketId: number;

  beforeEach(() => {
    db = setupDb();
    seedAgents(db, ["developer", "security-specialist", "qa"]);
    ticketId = seedTicket(db, { title: "multi", assigned_to: "developer" });
  });

  it("replace-sets assignments and mirrors the lead into assigned_to", () => {
    applyTicketAssignments(db, ticketId, [
      { role: "developer", lead: true, model: "claude-opus-4-8" },
      { role: "security-specialist" },
    ]);
    const rows = db.prepare(`SELECT role, model, is_lead FROM ticket_assignments WHERE ticket_id = ? ORDER BY is_lead DESC`).all(ticketId) as any[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ role: "developer", is_lead: 1, model: "claude-opus-4-8" });
    expect(rows[1]).toMatchObject({ role: "security-specialist", is_lead: 0, model: null });
    const t = db.prepare(`SELECT assigned_to FROM tickets WHERE id = ?`).get(ticketId) as any;
    expect(t.assigned_to).toBe("developer");
  });

  it("treats a single assignment as the implicit lead", () => {
    applyTicketAssignments(db, ticketId, [{ role: "qa" }]);
    const row = db.prepare(`SELECT role, is_lead FROM ticket_assignments WHERE ticket_id = ?`).get(ticketId) as any;
    expect(row).toEqual({ role: "qa", is_lead: 1 });
  });

  it("rejects zero or multiple leads, unknown roles, duplicates, and empty arrays", () => {
    expect(() => applyTicketAssignments(db, ticketId, [{ role: "developer" }, { role: "qa" }])).toThrow(/Exactly one lead/);
    expect(() => applyTicketAssignments(db, ticketId, [{ role: "developer", lead: true }, { role: "qa", lead: true }])).toThrow(/Exactly one lead/);
    expect(() => applyTicketAssignments(db, ticketId, [{ role: "ghost", lead: true }])).toThrow(/Unknown agent role/);
    expect(() => applyTicketAssignments(db, ticketId, [{ role: "qa", lead: true }, { role: "qa" }])).toThrow(/Duplicate role/);
    expect(() => applyTicketAssignments(db, ticketId, [])).toThrow(/must not be empty/);
  });
});

describe("buildModelRoutingSection (D2)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDb();
    seedAgents(db, ["developer", "security-specialist", "qa"]);
  });

  it("renders the multi-agent block with resolved models, lead first", () => {
    const id = seedTicket(db, { title: "pair", assigned_to: "developer" });
    applyTicketAssignments(db, id, [
      { role: "developer", lead: true },
      { role: "security-specialist", model: "claude-haiku-4-5-20251001" },
    ]);
    const block = buildModelRoutingSection(db, { id, assigned_to: "developer" })!;
    expect(block).toContain("Model routing (multi-agent)");
    expect(block).toContain("LEAD developer — implements via subagent at `claude-opus-4-8`");
    expect(block).toContain("support security-specialist — verifies/reviews the diff via parallel subagent at `claude-haiku-4-5-20251001`");
    expect(block.indexOf("LEAD")).toBeLessThan(block.indexOf("support"));
    expect(block).toContain("QA gate requires every supporting verdict");
  });

  it("resolves a single assignment's override over the agent default", () => {
    const id = seedTicket(db, { title: "solo", assigned_to: "developer" });
    applyTicketAssignments(db, id, [{ role: "developer", model: "claude-sonnet-4-6" }]);
    const block = buildModelRoutingSection(db, { id, assigned_to: "developer" })!;
    expect(block).toContain("claude-sonnet-4-6");
    expect(block).not.toContain("multi-agent");
  });

  it("falls back to assigned_to when no assignment rows exist", () => {
    const id = seedTicket(db, { title: "bare", assigned_to: "qa" });
    const block = buildModelRoutingSection(db, { id, assigned_to: "qa" })!;
    expect(block).toContain("qa");
  });

  it("returns null for unassigned tickets", () => {
    const id = seedTicket(db, { title: "nobody" });
    expect(buildModelRoutingSection(db, { id, assigned_to: null })).toBeNull();
  });
});

describe("changed-tickets reaction (D1)", () => {
  let db: Database.Database;
  let handlers: Map<string, Handler>;
  let sprintId: number;
  let ticketId: number;

  beforeEach(() => {
    db = setupDb();
    seedAgents(db, ["developer"]);
    handlers = setupHandlers(db);
    db.prepare(`INSERT INTO sprints (name, status, velocity_committed) VALUES ('Live', 'implementation', 5)`).run();
    sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = 'Live'`).get() as any).id;
    ticketId = seedTicket(db, { sprint_id: sprintId, title: "board-edited", assigned_to: "developer", story_points: 5 });
    // Simulate a dashboard edit: flag + revision + pending action (what the PATCH endpoint writes)
    db.prepare(`UPDATE tickets SET pending_change = 1, change_seq = 1, story_points = 8 WHERE id = ?`).run(ticketId);
    db.prepare(`INSERT INTO ticket_revisions (ticket_id, source, changed_fields, old_values, new_values) VALUES (?, 'ui', ?, ?, ?)`)
      .run(ticketId, JSON.stringify(["story_points"]), JSON.stringify({ story_points: 5 }), JSON.stringify({ story_points: 8 }));
    db.prepare(`INSERT INTO pending_actions (action, entity_type, entity_id, source, status) VALUES ('ticket_changed', 'ticket', ?, 'dashboard', 'pending')`).run(ticketId);
  });

  it("buildChangedTicketsBlock lists the edit with its field diff", () => {
    const block = buildChangedTicketsBlock(db, sprintId)!;
    expect(block).toContain("CHANGED TICKETS (1)");
    expect(block).toContain("board-edited");
    expect(block).toContain("story_points: 5 → 8");
    expect(block).toContain("acknowledge_ticket_changes");
  });

  it("scopes to the sprint and goes quiet when nothing is pending", () => {
    expect(buildChangedTicketsBlock(db, 9999)).toBeNull();
    db.prepare(`UPDATE tickets SET pending_change = 0 WHERE id = ?`).run(ticketId);
    expect(buildChangedTicketsBlock(db, sprintId)).toBeNull();
  });

  it("surfaces in load_phase_context(implementation) and the playbook", async () => {
    const impl = text(await handlers.get("load_phase_context")!({ phase: "implementation", sprint_id: sprintId }));
    expect(impl).toContain("CHANGED TICKETS");
    const playbook = text(await handlers.get("get_sprint_playbook")!({ sprint_id: sprintId }));
    expect(playbook).toContain("CHANGED TICKETS");
  });

  it("acknowledge_ticket_changes clears flags and completes bridge actions", async () => {
    const res = await handlers.get("acknowledge_ticket_changes")!({ ticket_ids: [ticketId] });
    expect(text(res)).toContain("Acknowledged 1");
    const t = db.prepare(`SELECT pending_change FROM tickets WHERE id = ?`).get(ticketId) as any;
    expect(t.pending_change).toBe(0);
    const action = db.prepare(`SELECT status FROM pending_actions WHERE action = 'ticket_changed' AND entity_id = ?`).get(ticketId) as any;
    expect(action.status).toBe("completed");
    expect(buildChangedTicketsBlock(db, sprintId)).toBeNull();
  });
});

describe("handler-level multi-agent flows (D2)", () => {
  let db: Database.Database;
  let handlers: Map<string, Handler>;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    seedAgents(db, ["developer", "security-specialist", "qa"]);
    handlers = setupHandlers(db);
    db.prepare(`INSERT INTO sprints (name, status) VALUES ('S', 'implementation')`).run();
    sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = 'S'`).get() as any).id;
  });

  it("create_ticket(agents) creates assignment rows; get_ticket shows the multi-agent directive", async () => {
    await handlers.get("create_ticket")!({
      sprint_id: sprintId, title: "paired work", priority: "P1",
      agents: [{ role: "developer", lead: true }, { role: "security-specialist" }],
    });
    const id = (db.prepare(`SELECT id FROM tickets WHERE title = 'paired work'`).get() as any).id;
    const detail = text(await handlers.get("get_ticket")!({ ticket_id: id }));
    expect(detail).toContain("Model routing (multi-agent)");
    expect(detail).toContain("LEAD developer");
  });

  it("update_ticket(agents) replace-sets and reports; invalid lead count errors", async () => {
    const id = seedTicket(db, { sprint_id: sprintId, title: "rework", assigned_to: "developer" });
    const ok = await handlers.get("update_ticket")!({ ticket_id: id, agents: [{ role: "qa", lead: true }, { role: "developer" }] });
    expect(text(ok)).toContain("assignments updated (2 agent(s), lead: qa)");
    expect((db.prepare(`SELECT assigned_to FROM tickets WHERE id = ?`).get(id) as any).assigned_to).toBe("qa");

    const bad = await handlers.get("update_ticket")!({ ticket_id: id, agents: [{ role: "qa" }, { role: "developer" }] });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("Exactly one lead");
  });

  it("legacy assigned_to updates re-point the lead and keep supporters", async () => {
    const id = seedTicket(db, { sprint_id: sprintId, title: "legacy-flow", assigned_to: "developer" });
    db.prepare(`INSERT INTO ticket_assignments (ticket_id, role, is_lead) VALUES (?, 'developer', 1), (?, 'security-specialist', 0)`).run(id, id);
    await handlers.get("update_ticket")!({ ticket_id: id, assigned_to: "qa" });
    const rows = db.prepare(`SELECT role, is_lead FROM ticket_assignments WHERE ticket_id = ? ORDER BY is_lead DESC, role`).all(id) as any[];
    expect(rows).toEqual([
      { role: "qa", is_lead: 1 },
      { role: "security-specialist", is_lead: 0 },
    ]);
  });
});
