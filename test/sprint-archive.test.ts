/**
 * Sprint Archiving — T-218 (migration v20) + T-219 (archive/unarchive/bulk API).
 *
 * T-218 cases run in-process against an in-memory DB (pattern: discovery-sse.test.ts):
 *   - migration is version-gated (idempotent across repeated runMigrations runs)
 *   - fresh DB and migrated DB end up with identical sprint columns
 *   - archived_at exists, defaults to NULL, idx_sprints_archived index created
 *
 * T-219 cases spawn the real dashboard (tsx src/dashboard/dashboard.ts <tempDb> <port>)
 * with a known CODE_CONTEXT_DASHBOARD_TOKEN and a throwaway temp DB, then drive it over
 * HTTP (pattern: server-spawn/temp-DB, dashboard-auth.test.ts harness intent). The repo
 * root context.db is never touched.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DASHBOARD_ENTRY = path.join(REPO_ROOT, "src/dashboard/dashboard.ts");

// ── T-218: migration v20 (in-process) ─────────────────────────────────────

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
  runMigrations(db);
  return db;
}

function sprintColumns(db: Database.Database): string[] {
  return (db.pragma("table_info(sprints)") as Array<{ name: string }>)
    .map((c) => c.name)
    .sort();
}

describe("T-218 migration v20: add archived_at to sprints", () => {
  it("adds an archived_at column that defaults to NULL", () => {
    const db = freshDb();
    const cols = sprintColumns(db);
    expect(cols).toContain("archived_at");

    db.prepare("INSERT INTO sprints (name, status) VALUES (?, 'planning')").run("s-default");
    const row = db.prepare("SELECT archived_at FROM sprints WHERE name = ?").get("s-default") as any;
    expect(row.archived_at).toBeNull();
    db.close();
  });

  it("creates the idx_sprints_archived index", () => {
    const db = freshDb();
    const idx = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sprints_archived'")
      .get();
    expect(idx).toBeTruthy();
    db.close();
  });

  it("records schema version 20 exactly once and is idempotent across reruns", () => {
    const db = freshDb();
    // Re-run migrations several times: version gating must prevent duplicate work.
    runMigrations(db);
    runMigrations(db);
    const rows = db
      .prepare("SELECT version FROM schema_versions WHERE version = 20")
      .all() as any[];
    expect(rows).toHaveLength(1);
    // Column still present and singular after reruns.
    const archivedCols = (db.pragma("table_info(sprints)") as Array<{ name: string }>).filter(
      (c) => c.name === "archived_at",
    );
    expect(archivedCols).toHaveLength(1);
    db.close();
  });

  it("fresh DB and a DB migrated from an older schema have identical sprint columns", () => {
    const fresh = freshDb();
    const freshCols = sprintColumns(fresh);

    // Simulate an older (pre-'done', pre-archived_at) DB: a sprints table with the older
    // CHECK constraint and deleted_at but no archived_at, and no schema_versions rows. This is
    // the state migration 17's rebuild + migration 20 must bring forward. (A sprints table
    // predating deleted_at is not reachable through initScrumSchema, so we don't simulate that.)
    const old = new Database(":memory:");
    old.pragma("journal_mode = WAL");
    old.pragma("foreign_keys = ON");
    old.exec(`
      CREATE TABLE sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        goal TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('preparation', 'kickoff', 'planning', 'implementation', 'qa', 'refactoring', 'retro', 'review', 'closed', 'rest')),
        velocity_committed INTEGER DEFAULT 0,
        velocity_completed INTEGER DEFAULT 0,
        deleted_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        milestone_id INTEGER
      );
    `);
    old.prepare("INSERT INTO sprints (name, status) VALUES (?, 'closed')").run("legacy-sprint");
    // Bring the rest of the schema + run all migrations forward.
    initScrumSchema(old);
    runMigrations(old);

    expect(sprintColumns(old)).toEqual(freshCols);
    // The legacy row survived the rebuild and now has the new column (NULL).
    const row = old.prepare("SELECT name, archived_at FROM sprints WHERE name = ?").get("legacy-sprint") as any;
    expect(row).toBeTruthy();
    expect(row.archived_at).toBeNull();

    fresh.close();
    old.close();
  });
});

// ── T-219: archive/unarchive/bulk API (spawned dashboard, temp DB) ─────────

const TOKEN = "test-archive-token-0123456789abcdef";
// Randomized high port per run: avoids colliding with the dev dashboard (3333) or a stray
// server from a prior run. (The dashboard auto-increments on EADDRINUSE, so we additionally
// confirm in waitForServer that the server answering is the one we pointed at our temp DB.)
const PORT = 40000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;

let proc: ChildProcess;
let tmpRoot: string;
let dbPath: string;
let serverLog = "";

// Resolve the tsx CLI from node_modules and run it under the current node binary —
// more robust under vitest than spawning `npx` (no resolution overhead / prompts).
const TSX_CLI = path.join(REPO_ROOT, "node_modules/tsx/dist/cli.mjs");

/** Direct connection to the same temp DB the server uses, for seeding + assertions. */
function seedDb(): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function authHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${TOKEN}`, ...extra };
}

/** True once OUR spawned server has initialised the schema in OUR temp DB. */
function ourDbHasSchema(): boolean {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      return !!db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sprints'")
        .get();
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 25000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`dashboard process exited early (code ${proc.exitCode}):\n${serverLog}`);
    }
    try {
      const res = await fetch(`${BASE}/api/sprints`, { headers: authHeaders() });
      // A 200 alone could come from an unrelated server; require our own temp DB to be
      // schema-initialised too, so a port collision can never give a false ready signal.
      if (res.ok && ourDbHasSchema()) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`dashboard server did not become ready in ${timeoutMs}ms:\n${serverLog}`);
}

beforeAll(async () => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), "cc-archive-"));
  dbPath = path.join(tmpRoot, "context.db");
  // Spawn the real dashboard against the temp DB (tsx runs the TS entry directly).
  proc = spawn(process.execPath, [TSX_CLI, DASHBOARD_ENTRY, dbPath, String(PORT)], {
    cwd: tmpRoot, // token file + .env.local land in the throwaway dir, never the repo
    env: { ...process.env, CODE_CONTEXT_DASHBOARD_TOKEN: TOKEN, DASHBOARD_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group so teardown can kill any children
  });
  proc.stdout?.on("data", (d) => { serverLog += String(d); });
  proc.stderr?.on("data", (d) => { serverLog += String(d); });
  proc.on("error", (e) => { serverLog += `[spawn error] ${e.message}\n`; });
  await waitForServer();
}, 40000);

afterAll(() => {
  // Kill the whole process group (negative pid) so no listener is orphaned.
  if (proc?.pid) {
    try { process.kill(-proc.pid, "SIGKILL"); } catch { /* group already gone */ }
  }
  proc?.kill("SIGKILL");
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

/** Insert a sprint directly and return its id. */
function insertSprint(name: string, status: string, opts: { deleted?: boolean; archived?: boolean } = {}): number {
  const db = seedDb();
  try {
    const id = Number(
      db.prepare("INSERT INTO sprints (name, status) VALUES (?, ?)").run(name, status).lastInsertRowid,
    );
    if (opts.deleted) db.prepare("UPDATE sprints SET deleted_at = datetime('now') WHERE id = ?").run(id);
    if (opts.archived) db.prepare("UPDATE sprints SET archived_at = datetime('now') WHERE id = ?").run(id);
    return id;
  } finally {
    db.close();
  }
}

function getSprintRow(id: number): any {
  const db = seedDb();
  try {
    return db.prepare("SELECT * FROM sprints WHERE id = ?").get(id);
  } finally {
    db.close();
  }
}

function auditRows(id: number): any[] {
  const db = seedDb();
  try {
    return db
      .prepare(
        "SELECT * FROM event_log WHERE entity_type = 'sprint' AND entity_id = ? AND field_name = 'archived_at' ORDER BY id",
      )
      .all(id) as any[];
  } finally {
    db.close();
  }
}

describe("T-219 POST /api/sprint/:id/archive", () => {
  it("archives a closed sprint: 200, archived_at set, audit event written", async () => {
    const id = insertSprint("arch-closed", "closed");
    const res = await fetch(`${BASE}/api/sprint/${id}/archive`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const row = getSprintRow(id);
    expect(row.archived_at).not.toBeNull();

    const events = auditRows(id);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("updated");
    expect(events[0].field_name).toBe("archived_at");
    expect(events[0].old_value).toBeNull();
    expect(events[0].new_value).not.toBeNull();
  });

  it.each(["rest", "done"])("archives a %s sprint (eligible status)", async (status) => {
    const id = insertSprint(`arch-${status}`, status);
    const res = await fetch(`${BASE}/api/sprint/${id}/archive`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(200);
    expect(getSprintRow(id).archived_at).not.toBeNull();
  });

  it("returns 400 with a clear message when status is not finished", async () => {
    const id = insertSprint("arch-active", "implementation");
    const res = await fetch(`${BASE}/api/sprint/${id}/archive`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(String(body.error)).toMatch(/closed.*rest.*done|finished|status/i);
    // Not archived.
    expect(getSprintRow(id).archived_at).toBeNull();
  });

  it("returns 404 for a soft-deleted sprint", async () => {
    const id = insertSprint("arch-deleted", "closed", { deleted: true });
    const res = await fetch(`${BASE}/api/sprint/${id}/archive`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a missing sprint", async () => {
    const res = await fetch(`${BASE}/api/sprint/9999999/archive`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(404);
  });
});

describe("T-219 POST /api/sprint/:id/unarchive", () => {
  it("round-trips archived_at back to NULL and writes an audit event", async () => {
    const id = insertSprint("unarch-closed", "closed", { archived: true });
    expect(getSprintRow(id).archived_at).not.toBeNull();

    const res = await fetch(`${BASE}/api/sprint/${id}/unarchive`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect(getSprintRow(id).archived_at).toBeNull();

    const events = auditRows(id);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("updated");
    expect(events[0].new_value).toBeNull();
    expect(events[0].old_value).not.toBeNull();
  });

  it("returns 404 for a soft-deleted sprint", async () => {
    const id = insertSprint("unarch-deleted", "closed", { deleted: true, archived: true });
    const res = await fetch(`${BASE}/api/sprint/${id}/unarchive`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(404);
  });
});

describe("T-219 POST /api/sprints/archive-completed (bulk)", () => {
  it("archives exactly the eligible non-archived, non-deleted set and returns the count", async () => {
    const db = seedDb();
    try {
      db.exec("DELETE FROM event_log; DELETE FROM sprints;");
    } finally {
      db.close();
    }

    const closedId = insertSprint("bulk-closed", "closed");
    const restId = insertSprint("bulk-rest", "rest");
    const doneId = insertSprint("bulk-done", "done");
    const activeId = insertSprint("bulk-active", "implementation"); // ineligible status
    const alreadyArchivedId = insertSprint("bulk-already", "closed", { archived: true }); // skip
    const deletedId = insertSprint("bulk-deleted", "closed", { deleted: true }); // skip

    const res = await fetch(`${BASE}/api/sprints/archive-completed`, { method: "POST", headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archived).toBe(3);

    expect(getSprintRow(closedId).archived_at).not.toBeNull();
    expect(getSprintRow(restId).archived_at).not.toBeNull();
    expect(getSprintRow(doneId).archived_at).not.toBeNull();
    expect(getSprintRow(activeId).archived_at).toBeNull();
    expect(getSprintRow(deletedId).archived_at).toBeNull();

    // One audit event per newly-archived sprint (3), none for the already-archived one.
    expect(auditRows(closedId)).toHaveLength(1);
    expect(auditRows(restId)).toHaveLength(1);
    expect(auditRows(doneId)).toHaveLength(1);
    expect(auditRows(alreadyArchivedId)).toHaveLength(0);
  });
});

describe("T-219 auth + response shape", () => {
  it("rejects an unauthenticated archive request (401/403)", async () => {
    const id = insertSprint("noauth", "closed");
    const res = await fetch(`${BASE}/api/sprint/${id}/archive`, { method: "POST" });
    expect([401, 403]).toContain(res.status);
    // Unchanged.
    expect(getSprintRow(id).archived_at).toBeNull();
  });

  it("GET /api/sprints includes archived_at on every row", async () => {
    insertSprint("listed-sprint", "closed");
    const res = await fetch(`${BASE}/api/sprints`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const rows = (await res.json()) as any[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.prototype.hasOwnProperty.call(r, "archived_at")).toBe(true);
    }
  });
});
