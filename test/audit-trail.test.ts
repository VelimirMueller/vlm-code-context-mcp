import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { registerScrumTools } from "../src/scrum/tools.js";
import Database from "better-sqlite3";

// T-269: audit-trail catches around event_log writes must surface on stderr, never vanish.
// These tests force an event_log INSERT failure (by dropping the table) and assert that:
//   1. the tool's primary mutation still succeeds (best-effort trail — never blocks the write), and
//   2. a "[audit]" line lands on stderr instead of nothing (the bug fixed by migration v22 stayed
//      invisible for sprints precisely because these inserts were swallowed silently).

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

class FakeServer {
  tools = new Map<string, Handler>();
  tool(name: string, _desc: string, _schema: unknown, handler: Handler): void {
    this.tools.set(name, handler);
  }
}

function setupHandlers(db: Database.Database): Map<string, Handler> {
  const server = new FakeServer();
  registerScrumTools(server as never, db);
  return server.tools;
}

const text = (res: { content: Array<{ text: string }> }): string => res.content.map((c) => c.text).join("\n");

describe("audit-trail unsilencing (T-269)", () => {
  let db: Database.Database;
  let tools: Map<string, Handler>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    tools = setupHandlers(db);
    // Silence + capture stderr so the [audit] lines don't pollute the test reporter.
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
    db.close();
  });

  /** Lines passed to console.error, flattened to strings, that begin with the [audit] prefix. */
  function auditStderrLines(): string[] {
    return errSpy.mock.calls
      .map((args) => args.map((a) => String(a)).join(" "))
      .filter((line) => line.startsWith("[audit]"));
  }

  it("update_ticket: status-change event_log failure surfaces on stderr but the status update still commits", async () => {
    db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES ('S', 'g', 'implementation', 8)`).run();
    const sprintId = Number((db.prepare(`SELECT last_insert_rowid() AS id`).get() as any).id);
    db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points) VALUES (?, 'T-1', 't', 'P1', 'TODO', 3)`).run(sprintId);
    const ticketId = Number((db.prepare(`SELECT last_insert_rowid() AS id`).get() as any).id);

    // Make the audit insert fail — the table the catch wraps is simply gone.
    db.exec("DROP TABLE event_log");

    const res = await tools.get("update_ticket")!({ ticket_id: ticketId, status: "IN_PROGRESS" });

    // Primary mutation committed despite the trail write failing.
    expect(res.isError).toBeFalsy();
    expect(text(res)).toContain(`Ticket #${ticketId} updated`);
    expect((db.prepare(`SELECT status FROM tickets WHERE id = ?`).get(ticketId) as any).status).toBe("IN_PROGRESS");

    // The failure is now visible on stderr instead of vanishing.
    const lines = auditStderrLines();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes(`update_ticket ticket #${ticketId}`) && l.includes("TODO→IN_PROGRESS"))).toBe(true);
  });

  it("update_sprint: status-change event_log failure surfaces on stderr but the sprint update still commits", async () => {
    db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES ('S', 'g', 'planning', 8)`).run();
    const sprintId = Number((db.prepare(`SELECT last_insert_rowid() AS id`).get() as any).id);

    db.exec("DROP TABLE event_log");

    const res = await tools.get("update_sprint")!({ sprint_id: sprintId, status: "implementation" });

    expect(res.isError).toBeFalsy();
    expect((db.prepare(`SELECT status FROM sprints WHERE id = ?`).get(sprintId) as any).status).toBe("implementation");

    const lines = auditStderrLines();
    expect(lines.some((l) => l.includes(`update_sprint sprint #${sprintId}`) && l.includes("planning→implementation"))).toBe(true);
  });

  it("does NOT emit [audit] noise on the happy path (event_log intact)", async () => {
    db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES ('S', 'g', 'implementation', 8)`).run();
    const sprintId = Number((db.prepare(`SELECT last_insert_rowid() AS id`).get() as any).id);
    db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points) VALUES (?, 'T-1', 't', 'P1', 'TODO', 3)`).run(sprintId);
    const ticketId = Number((db.prepare(`SELECT last_insert_rowid() AS id`).get() as any).id);

    const res = await tools.get("update_ticket")!({ ticket_id: ticketId, status: "IN_PROGRESS" });

    expect(res.isError).toBeFalsy();
    // The trail wrote cleanly — a real event row exists and no [audit] line was logged.
    expect((db.prepare(`SELECT COUNT(*) AS c FROM event_log WHERE entity_type='ticket' AND entity_id=?`).get(ticketId) as any).c).toBe(1);
    expect(auditStderrLines()).toHaveLength(0);
  });
});
