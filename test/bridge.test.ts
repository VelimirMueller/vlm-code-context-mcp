import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import Database from "better-sqlite3";

/**
 * Replicate the core hook logic so we can unit-test it without subprocess overhead.
 * This mirrors src/bridge/hook.ts main() but operates on an injected db instance.
 */
interface PendingAction {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  payload: string | null;
  source: string;
  created_at: string;
}

interface HookResult {
  exitCode: number;
  stdout: string;
}

function runHookLogic(db: Database.Database): HookResult {
  try {
    // Check for pending actions (max 5 at a time)
    const pending = db.prepare(
      `SELECT id, action, entity_type, entity_id, payload, source, created_at
       FROM pending_actions
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 5`
    ).all() as PendingAction[];

    if (pending.length === 0) {
      return { exitCode: 0, stdout: "" };
    }

    // Expire old actions (>1 hour)
    db.prepare(
      `UPDATE pending_actions SET status = 'expired'
       WHERE status = 'pending' AND created_at < datetime('now', '-1 hour')`
    ).run();

    // Claim these actions
    const ids = pending.map((a) => a.id);
    db.prepare(
      `UPDATE pending_actions SET status = 'claimed', claimed_at = datetime('now')
       WHERE id IN (${ids.map(() => "?").join(",")})`
    ).run(...ids);

    // Build context string
    const lines = ["[DASHBOARD ACTION QUEUE] The dashboard has queued the following actions for you:"];
    for (const action of pending) {
      const parts = [`- Action: ${action.action}`];
      if (action.entity_type) parts.push(`  Entity: ${action.entity_type} #${action.entity_id}`);
      if (action.payload) {
        try {
          const p = JSON.parse(action.payload);
          parts.push(`  Details: ${JSON.stringify(p)}`);
        } catch {
          parts.push(`  Details: ${action.payload}`);
        }
      }
      parts.push(`  Source: ${action.source} at ${action.created_at}`);
      lines.push(parts.join("\n"));
    }
    lines.push("");
    lines.push("Execute these actions using the appropriate MCP tools, then mark them complete:");
    lines.push(`Use: execute({sql: "UPDATE pending_actions SET status='completed', completed_at=datetime('now') WHERE id IN (${ids.join(",")})"})`);

    const response = {
      hookSpecificOutput: {
        additionalContext: lines.join("\n"),
      },
    };
    return { exitCode: 0, stdout: JSON.stringify(response) };
  } catch {
    return { exitCode: 0, stdout: "" };
  }
}

/** Insert a pending action into the DB and return its id */
function insertAction(
  db: Database.Database,
  overrides: Partial<{
    action: string;
    entity_type: string | null;
    entity_id: number | null;
    payload: string | null;
    status: string;
    source: string;
    created_at: string;
  }> = {}
): number {
  const defaults = {
    action: "update_ticket",
    entity_type: "ticket" as string | null,
    entity_id: 1 as number | null,
    payload: null as string | null,
    status: "pending",
    source: "dashboard",
    created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
  const a = { ...defaults, ...overrides };
  db.prepare(
    `INSERT INTO pending_actions (action, entity_type, entity_id, payload, status, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(a.action, a.entity_type, a.entity_id, a.payload, a.status, a.source, a.created_at);
  return (db.prepare(`SELECT last_insert_rowid() as id`).get() as any).id;
}

// ─── pending_actions table tests ─────────────────────────────────────────────

describe("pending_actions table", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
  });

  it("inserts a pending action and verifies it is readable", () => {
    const id = insertAction(db, {
      action: "create_ticket",
      entity_type: "ticket",
      entity_id: 42,
      payload: JSON.stringify({ title: "New feature" }),
    });

    const row = db.prepare(`SELECT * FROM pending_actions WHERE id = ?`).get(id) as any;
    expect(row).toBeDefined();
    expect(row.action).toBe("create_ticket");
    expect(row.entity_type).toBe("ticket");
    expect(row.entity_id).toBe(42);
    expect(row.status).toBe("pending");
    expect(JSON.parse(row.payload)).toEqual({ title: "New feature" });
  });

  it("transitions status: pending -> claimed -> completed", () => {
    const id = insertAction(db);

    // Claim
    db.prepare(
      `UPDATE pending_actions SET status = 'claimed', claimed_at = datetime('now') WHERE id = ?`
    ).run(id);
    let row = db.prepare(`SELECT * FROM pending_actions WHERE id = ?`).get(id) as any;
    expect(row.status).toBe("claimed");
    expect(row.claimed_at).not.toBeNull();

    // Complete
    db.prepare(
      `UPDATE pending_actions SET status = 'completed', completed_at = datetime('now'), result = ? WHERE id = ?`
    ).run("Success", id);
    row = db.prepare(`SELECT * FROM pending_actions WHERE id = ?`).get(id) as any;
    expect(row.status).toBe("completed");
    expect(row.completed_at).not.toBeNull();
    expect(row.result).toBe("Success");
  });

  it("transitions status: pending -> failed (with error message)", () => {
    const id = insertAction(db);

    db.prepare(
      `UPDATE pending_actions SET status = 'failed', error = ? WHERE id = ?`
    ).run("Ticket not found", id);

    const row = db.prepare(`SELECT * FROM pending_actions WHERE id = ?`).get(id) as any;
    expect(row.status).toBe("failed");
    expect(row.error).toBe("Ticket not found");
  });

  it("rejects invalid status values via CHECK constraint", () => {
    expect(() => {
      insertAction(db, { status: "bogus" });
    }).toThrow();
  });

  it("concurrent reads: claimed status prevents double-claim", () => {
    const id = insertAction(db);

    // First reader claims it
    const claimResult1 = db.prepare(
      `UPDATE pending_actions SET status = 'claimed', claimed_at = datetime('now')
       WHERE id = ? AND status = 'pending'`
    ).run(id);
    expect(claimResult1.changes).toBe(1);

    // Second reader tries to claim the same action — gets 0 changes
    const claimResult2 = db.prepare(
      `UPDATE pending_actions SET status = 'claimed', claimed_at = datetime('now')
       WHERE id = ? AND status = 'pending'`
    ).run(id);
    expect(claimResult2.changes).toBe(0);
  });
});

// ─── Hook logic tests ────────────────────────────────────────────────────────

describe("bridge hook logic", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
  });

  it("produces valid JSON with hookSpecificOutput.additionalContext", () => {
    insertAction(db, { action: "advance_sprint", entity_type: "sprint", entity_id: 1 });

    const result = runHookLogic(db);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("hookSpecificOutput");
    expect(parsed.hookSpecificOutput).toHaveProperty("additionalContext");
    expect(typeof parsed.hookSpecificOutput.additionalContext).toBe("string");
  });

  it("additionalContext contains the action details", () => {
    insertAction(db, {
      action: "update_ticket",
      entity_type: "ticket",
      entity_id: 7,
      source: "dashboard",
    });

    const result = runHookLogic(db);
    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;

    expect(ctx).toContain("DASHBOARD ACTION QUEUE");
    expect(ctx).toContain("update_ticket");
    expect(ctx).toContain("ticket #7");
    expect(ctx).toContain("dashboard");
  });

  it("empty queue produces no output (exit 0, no stdout)", () => {
    const result = runHookLogic(db);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("payload JSON is properly included in context", () => {
    const payload = { title: "Fix bug", priority: "P0" };
    insertAction(db, {
      action: "create_ticket",
      payload: JSON.stringify(payload),
    });

    const result = runHookLogic(db);
    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;

    expect(ctx).toContain("Details:");
    expect(ctx).toContain("Fix bug");
    expect(ctx).toContain("P0");
  });

  it("expired actions: actions older than 1 hour are auto-expired by hook", () => {
    // Insert actions with timestamps >1 hour in the past
    // These will NOT be picked up by the SELECT (limit 5) alongside fresh ones,
    // but the hook runs an UPDATE to expire them.
    // To test expiration in isolation: insert only old actions, plus one fresh one
    // beyond the LIMIT 5 so the old ones get selected and the expire UPDATE runs.

    // Insert 6 old actions — only 5 will be selected (LIMIT 5), but all 6 are expired
    const oldTime = "2020-01-01 00:00:00";
    const oldIds: number[] = [];
    for (let i = 0; i < 6; i++) {
      oldIds.push(insertAction(db, { action: `old_action_${i}`, created_at: oldTime }));
    }

    const result = runHookLogic(db);
    expect(result.exitCode).toBe(0);

    // The hook selects 5 of the 6, then runs expire UPDATE on all pending with old timestamps.
    // The 5 selected get claimed (overwriting any expire), the 6th stays expired.
    const sixthRow = db.prepare(`SELECT status FROM pending_actions WHERE id = ?`).get(oldIds[5]) as any;
    expect(sixthRow.status).toBe("expired");

    // The first 5 get claimed because the claim UPDATE runs after the expire UPDATE
    const firstRow = db.prepare(`SELECT status FROM pending_actions WHERE id = ?`).get(oldIds[0]) as any;
    expect(firstRow.status).toBe("claimed");
  });

  it("expire UPDATE marks stale pending actions that were not selected", () => {
    // Directly test the expiration SQL pattern
    const oldTime = "2020-01-01 00:00:00";
    const oldId = insertAction(db, { action: "stale", created_at: oldTime });

    // Run just the expire query
    db.prepare(
      `UPDATE pending_actions SET status = 'expired'
       WHERE status = 'pending' AND created_at < datetime('now', '-1 hour')`
    ).run();

    const row = db.prepare(`SELECT status FROM pending_actions WHERE id = ?`).get(oldId) as any;
    expect(row.status).toBe("expired");
  });

  it("claims up to 5 actions at a time", () => {
    // Insert 7 pending actions
    for (let i = 0; i < 7; i++) {
      insertAction(db, { action: `action_${i}` });
    }

    runHookLogic(db);

    const claimed = db.prepare(
      `SELECT COUNT(*) as cnt FROM pending_actions WHERE status = 'claimed'`
    ).get() as any;
    const stillPending = db.prepare(
      `SELECT COUNT(*) as cnt FROM pending_actions WHERE status = 'pending'`
    ).get() as any;

    expect(claimed.cnt).toBe(5);
    expect(stillPending.cnt).toBe(2);
  });

  it("concurrent reads: two hook invocations don't claim the same action", () => {
    insertAction(db, { action: "single_action" });

    // First hook call claims it
    const result1 = runHookLogic(db);
    expect(result1.stdout).not.toBe("");

    // Second hook call finds nothing pending
    const result2 = runHookLogic(db);
    expect(result2.stdout).toBe("");
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("bridge hook edge cases", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
  });

  it("malformed payload (non-JSON string) does not crash the hook", () => {
    insertAction(db, {
      action: "do_something",
      payload: "this is not json {{{",
    });

    const result = runHookLogic(db);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toBe("");

    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    // The raw payload should be included as-is since JSON.parse fails
    expect(ctx).toContain("this is not json {{{");
  });

  it("missing entity_type and entity_id still works", () => {
    insertAction(db, {
      action: "global_refresh",
      entity_type: null,
      entity_id: null,
    });

    const result = runHookLogic(db);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("global_refresh");
    // Should NOT contain "Entity:" line since entity_type is null
    expect(ctx).not.toContain("Entity:");
  });

  it("hook handles missing pending_actions table gracefully", () => {
    // Use a bare DB without scrum schema — no pending_actions table
    const bareDb = new Database(":memory:");
    const result = runHookLogic(bareDb);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    bareDb.close();
  });

  it("action with empty string payload is treated as falsy", () => {
    // SQLite stores empty string, but hook checks `if (action.payload)`
    // Empty string is falsy in JS, so no Details line should appear
    insertAction(db, {
      action: "noop",
      payload: "",
    });

    const result = runHookLogic(db);
    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    expect(ctx).not.toContain("Details:");
  });

  it("hook output includes completion SQL with correct action ids", () => {
    const id1 = insertAction(db, { action: "a1" });
    const id2 = insertAction(db, { action: "a2" });

    const result = runHookLogic(db);
    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;

    expect(ctx).toContain(`id IN (${id1},${id2})`);
    expect(ctx).toContain("status='completed'");
  });
});
