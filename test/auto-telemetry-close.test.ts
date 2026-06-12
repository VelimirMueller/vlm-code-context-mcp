/**
 * T-279: auto-telemetry on ticket close (#122).
 *
 * Closing a ticket (update_ticket status=DONE) now auto-snapshots sprint burndown
 * via the shared snapshotSprintMetrics helper — no manual snapshot_sprint_metrics
 * ceremony call — and update_ticket accepts actual_hours, recorded on the same
 * column log_time writes so get_time_report attributes it to the assigned agent.
 * advance_sprint snapshots at every phase transition. All telemetry is fail-open:
 * a snapshot/time write may NEVER block or fail a close (mirrors the T-274 commit
 * gate; errors swallowed to stderr per the T-269 audit pattern).
 *
 * AC coverage:
 *   1. closing tickets produces burndown rows (get_burndown stops reporting "No
 *      burndown data") and a non-zero time report when actual_hours is supplied.
 *   2. no telemetry write blocks/fails a close — a forced snapshot failure still
 *      returns success, mutates the row, and logs to stderr (fail-open).
 *   3. (covered by the full suite staying green.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { registerScrumTools, snapshotSprintMetrics } from "../src/scrum/tools.js";

// ─── Tool-handler harness (mirrors commit-format-gate.test.ts) ────────────────

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
class FakeServer {
  tools = new Map<string, Handler>();
  tool(name: string, _d: string, _s: unknown, h: Handler): void {
    this.tools.set(name, h);
  }
}
const text = (r: { content: Array<{ text: string }> }): string => r.content.map((c) => c.text).join("\n");

describe("T-279 auto-telemetry on ticket close", () => {
  let db: Database.Database;
  let tools: Map<string, Handler>;
  let sprintId: number;

  /** Insert a ticket in the implementation-phase sprint; return its id. */
  function newTicket(ref: string, points = 3, status = "IN_PROGRESS", assignee = "dev"): number {
    db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points, assigned_to) VALUES (?, ?, 't', 'P1', ?, ?, ?)`).run(sprintId, ref, status, points, assignee);
    return Number((db.prepare(`SELECT last_insert_rowid() AS id`).get() as any).id);
  }

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initScrumSchema(db);
    runMigrations(db);
    db.exec(`CREATE TABLE IF NOT EXISTS event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT, entity_id INTEGER, action TEXT, field_name TEXT, old_value TEXT, new_value TEXT, actor TEXT, created_at TEXT DEFAULT (datetime('now')))`);
    db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES ('S','g','implementation',8)`).run();
    sprintId = Number((db.prepare(`SELECT last_insert_rowid() AS id`).get() as any).id);
    const server = new FakeServer();
    registerScrumTools(server as never, db);
    tools = server.tools;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
  });

  // ─── Shared helper (pure DB) ────────────────────────────────────────────────

  describe("snapshotSprintMetrics (shared helper)", () => {
    it("upserts one burndown row capturing remaining vs completed points", () => {
      newTicket("T-1", 3, "DONE");
      newTicket("T-2", 5, "IN_PROGRESS");
      const out = snapshotSprintMetrics(db, sprintId, "2026-06-12");
      expect(out).toEqual({ date: "2026-06-12", remaining: 5, completed: 3 });
      const row = db.prepare(`SELECT remaining_points, completed_points FROM sprint_metrics WHERE sprint_id = ? AND date = ?`).get(sprintId, "2026-06-12") as any;
      expect(row).toMatchObject({ remaining_points: 5, completed_points: 3 });
    });

    it("is idempotent for a (sprint, date) — re-snapshot overwrites, never duplicates", () => {
      const t = newTicket("T-1", 4, "IN_PROGRESS");
      snapshotSprintMetrics(db, sprintId, "2026-06-12");
      db.prepare(`UPDATE tickets SET status = 'DONE' WHERE id = ?`).run(t);
      const out = snapshotSprintMetrics(db, sprintId, "2026-06-12");
      expect(out).toEqual({ date: "2026-06-12", remaining: 0, completed: 4 });
      const count = (db.prepare(`SELECT COUNT(*) AS c FROM sprint_metrics WHERE sprint_id = ? AND date = ?`).get(sprintId, "2026-06-12") as any).c;
      expect(count).toBe(1);
    });

    it("snapshots an empty sprint as 0/0 (still a valid data point)", () => {
      const out = snapshotSprintMetrics(db, sprintId, "2026-06-12");
      expect(out).toEqual({ date: "2026-06-12", remaining: 0, completed: 0 });
    });
  });

  // ─── AC1: closing tickets accumulates burndown + time ───────────────────────

  describe("update_ticket close → burndown accrues (AC1)", () => {
    it("a DONE close writes a burndown row so get_burndown stops reporting 'No burndown data'", async () => {
      const id = newTicket("T-10", 3);
      // Baseline: nothing snapshotted yet.
      expect(text(await tools.get("get_burndown")!({ sprint_id: sprintId }))).toContain("No burndown data");

      const res = await tools.get("update_ticket")!({ ticket_id: id, status: "DONE" });
      expect(res.isError).toBeFalsy();

      const rows = db.prepare(`SELECT remaining_points, completed_points FROM sprint_metrics WHERE sprint_id = ?`).all(sprintId) as any[];
      expect(rows.length).toBe(1);
      expect(rows[0]).toMatchObject({ completed_points: 3, remaining_points: 0 });

      const burndown = text(await tools.get("get_burndown")!({ sprint_id: sprintId }));
      expect(burndown).not.toContain("No burndown data");
      expect(burndown).toContain("3pts done");
    });

    it("records actual_hours via the log_time column → non-zero get_time_report for the assignee", async () => {
      const id = newTicket("T-11", 5, "IN_PROGRESS", "backend");
      const res = await tools.get("update_ticket")!({ ticket_id: id, status: "DONE", actual_hours: 4.5 });
      expect(res.isError).toBeFalsy();
      expect(text(res)).toContain("actual 4.5h logged");

      // Stored on the same column log_time writes.
      expect((db.prepare(`SELECT actual_hours FROM tickets WHERE id = ?`).get(id) as any).actual_hours).toBe(4.5);

      const report = text(await tools.get("get_time_report")!({ sprint_id: sprintId }));
      expect(report).not.toContain("No time data");
      expect(report).toContain("backend");
      expect(report).toContain("actual 4.5h");
    });

    it("actual_hours can be logged without a status change (plain field update)", async () => {
      const id = newTicket("T-12", 2, "IN_PROGRESS", "qa");
      const res = await tools.get("update_ticket")!({ ticket_id: id, actual_hours: 2 });
      expect(res.isError).toBeFalsy();
      expect((db.prepare(`SELECT actual_hours, status FROM tickets WHERE id = ?`).get(id) as any)).toMatchObject({ actual_hours: 2, status: "IN_PROGRESS" });
      // No status transition → no burndown snapshot.
      expect(db.prepare(`SELECT COUNT(*) AS c FROM sprint_metrics WHERE sprint_id = ?`).get(sprintId) as any).toMatchObject({ c: 0 });
    });

    it("snapshots only on a real transition to DONE — re-confirming DONE does not re-snapshot the same date", async () => {
      const id = newTicket("T-13", 3, "DONE");
      // Already DONE → flipping to DONE again is not a transition.
      const res = await tools.get("update_ticket")!({ ticket_id: id, status: "DONE", notes: "re-touch" });
      expect(res.isError).toBeFalsy();
      expect(db.prepare(`SELECT COUNT(*) AS c FROM sprint_metrics WHERE sprint_id = ?`).get(sprintId) as any).toMatchObject({ c: 0 });
    });

    it("a non-DONE transition (e.g. BLOCKED) does not snapshot", async () => {
      const id = newTicket("T-14", 3, "IN_PROGRESS");
      await tools.get("update_ticket")!({ ticket_id: id, status: "BLOCKED" });
      expect(db.prepare(`SELECT COUNT(*) AS c FROM sprint_metrics WHERE sprint_id = ?`).get(sprintId) as any).toMatchObject({ c: 0 });
    });

    it("multiple closes on the same day upsert one row that tracks the running total", async () => {
      const a = newTicket("T-15", 3);
      const b = newTicket("T-16", 5);
      await tools.get("update_ticket")!({ ticket_id: a, status: "DONE" });
      await tools.get("update_ticket")!({ ticket_id: b, status: "DONE" });
      const rows = db.prepare(`SELECT completed_points, remaining_points FROM sprint_metrics WHERE sprint_id = ?`).all(sprintId) as any[];
      expect(rows.length).toBe(1); // same date → upsert
      expect(rows[0]).toMatchObject({ completed_points: 8, remaining_points: 0 });
    });
  });

  // ─── AC2: fail-open — telemetry never blocks or fails a close ───────────────

  describe("fail-open: a telemetry failure never blocks the close (AC2)", () => {
    it("a failing burndown snapshot still returns success, mutates the row, and logs to stderr", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const id = newTicket("T-20", 3, "IN_PROGRESS");
      // Force the snapshot INSERT to throw: remove the table it writes to.
      db.exec(`DROP TABLE sprint_metrics`);

      const res = await tools.get("update_ticket")!({ ticket_id: id, status: "DONE" });

      // Close succeeded despite the telemetry blow-up.
      expect(res.isError).toBeFalsy();
      expect((db.prepare(`SELECT status FROM tickets WHERE id = ?`).get(id) as any).status).toBe("DONE");
      // The failure surfaced to stderr via the audit pattern, not through the result.
      expect(errSpy).toHaveBeenCalled();
      const logged = errSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(logged).toContain("[audit]");
      expect(logged).toContain("auto-snapshot");
    });

    it("the status mutation is committed before telemetry — a snapshot failure cannot roll it back", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const id = newTicket("T-21", 3, "IN_PROGRESS");
      db.exec(`DROP TABLE sprint_metrics`);
      await tools.get("update_ticket")!({ ticket_id: id, status: "DONE" });
      // event_log status_changed row exists → mutation + audit happened pre-telemetry.
      const evt = db.prepare(`SELECT new_value FROM event_log WHERE entity_type='ticket' AND entity_id=? AND field_name='status'`).get(id) as any;
      expect(evt?.new_value).toBe("DONE");
    });
  });

  // ─── advance_sprint snapshots at every phase transition ─────────────────────

  describe("advance_sprint snapshots at each phase transition", () => {
    it("advancing implementation → done writes a burndown row", async () => {
      newTicket("T-30", 3, "DONE");
      newTicket("T-31", 2, "IN_PROGRESS");
      const res = await tools.get("advance_sprint")!({ sprint_id: sprintId });
      expect(res.isError).toBeFalsy();
      const rows = db.prepare(`SELECT completed_points, remaining_points FROM sprint_metrics WHERE sprint_id = ?`).all(sprintId) as any[];
      expect(rows.length).toBe(1);
      expect(rows[0]).toMatchObject({ completed_points: 3, remaining_points: 2 });
    });

    it("fail-open: a snapshot failure never blocks the advance", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      newTicket("T-32", 3, "DONE");
      db.exec(`DROP TABLE sprint_metrics`);
      const res = await tools.get("advance_sprint")!({ sprint_id: sprintId });
      expect(res.isError).toBeFalsy();
      // The phase still advanced past implementation.
      expect((db.prepare(`SELECT status FROM sprints WHERE id = ?`).get(sprintId) as any).status).toBe("done");
      const logged = errSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(logged).toContain("[audit]");
      expect(logged).toContain("auto-snapshot");
    });
  });
});
