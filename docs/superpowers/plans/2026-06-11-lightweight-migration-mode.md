# Lightweight Migration Mode & Seamless Migrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `code-context-mcp` setup detects an existing `context.db` and runs migrate+config-repair instead of the full pipeline; the migration engine gains a version constant, fresh-DB baseline, downgrade guard, and canonical schema; legacy-fixture tests prove old DBs migrate seamlessly.

**Architecture:** All schema knowledge consolidates into `src/scrum/schema.ts` (`initScrumSchema` becomes the complete canonical schema; `runMigrations` keeps the versioned array + idempotent patches and gains `{ freshDb }` baseline stamping). `setup.ts` branches on `fs.existsSync(DB_PATH)` into update mode. Fixtures are SQL dumps generated from historical `schema.ts` via `git show`.

**Tech Stack:** TypeScript ESM, better-sqlite3, vitest, tsx. Spec: `docs/superpowers/specs/2026-06-11-lightweight-migration-mode-design.md`.

**Ground rules for the executor:**
- Branch: work on the current branch `feat/sprint-23-honest-metrics-token-diet`.
- The repo has in-flight uncommitted WIP (`src/scrum/schema.ts` v22, `src/scrum/tools.ts`, `test/retro-gate.test.ts`, `test/benchmark.test.ts`). Task 0 commits it first so plan commits stay clean. Do NOT revert any of it.
- `docs/superpowers/` is gitignored — plan/spec commits need `git add -f`.
- Run tests with `npx vitest run <file>` (repo root). Full suite: `npm test`.
- Scrum process is mandatory: Task 0 creates tickets before any code.

---

### Task 0: Scrum ticketing + WIP checkpoint

**Files:** none (MCP tools + git only)

- [ ] **Step 0.1: Commit the in-flight sprint-23 WIP as a checkpoint**

```bash
git add src/scrum/schema.ts src/scrum/tools.ts test/retro-gate.test.ts test/benchmark.test.ts
git commit -m "feat(scrum): sprint-23 WIP checkpoint — event_log v22 rebuild + retro gate tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: clean `git status` apart from untracked `scripts/_*.mts` scratch files (leave those).

- [ ] **Step 0.2: Create the two tickets via MCP tools**

Use `mcp__code-context__get_project_status` to find the active sprint id, then `mcp__code-context__list_tickets` for that sprint to find the next free `T-` ref (recent refs are T-228…T-234; use the next two free numbers, called `T-A`/`T-B` below). Create:

- `T-A` — title: `Setup update mode + --force defang`, priority P1, story_points 3, description: "Detect existing context.db → migrate+config-repair only (no re-index/seed/wizard); rolling .bak backup before pending migrations; --force renames instead of deletes. Spec: docs/superpowers/specs/2026-06-11-lightweight-migration-mode-design.md"
- `T-B` — title: `Migration engine hardening + canonical schema + legacy fixtures`, priority P1, story_points 5, description: "LATEST_SCHEMA_VERSION + downgrade guard; canonical initScrumSchema (absorb v6/v9/v11-13 + dashboard ad-hoc ALTERs incl. tickets.review_status); freshDb baseline; fixture generator + pre-versioning/v1.2.1/v1.3.1 fixtures; migrations.test.ts parity suite. Spec: same."

If the sprint phase gate blocks ticket creation/status changes (sprint at `rest`), use `mcp__code-context__advance_sprint` / `mcp__code-context__update_sprint` to move the active sprint to `implementation` first. Set both tickets `IN_PROGRESS` when their task group starts (T-B = Tasks 1–6, T-A = Task 7).

---

### Task 1: `LATEST_SCHEMA_VERSION` + downgrade guard (T-B)

**Files:**
- Modify: `src/scrum/schema.ts` (top of file + `runMigrations`)
- Create: `test/migrations.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `test/migrations.test.ts`:

```ts
/**
 * Migration engine guarantees (spec 2026-06-11-lightweight-migration-mode):
 *  - LATEST_SCHEMA_VERSION is the single source of truth
 *  - downgrade guard: newer DB → clear throw
 *  - fresh-DB baseline stamps versions without replaying migrations
 *  - canonical initScrumSchema == full migration replay (schema parity)
 *  - legacy fixtures (pre-versioning / v1.2.1 / v1.3.1) migrate with data intact
 */
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../src/server/schema.js";
import {
  initScrumSchema,
  runMigrations,
  LATEST_SCHEMA_VERSION,
} from "../src/scrum/schema.js";

function freshDb(opts: { freshDb?: boolean } = {}): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  initScrumSchema(db);
  runMigrations(db, opts);
  return db;
}

describe("LATEST_SCHEMA_VERSION", () => {
  it("is exported and matches the applied max version", () => {
    const db = freshDb();
    const v = (db.prepare("SELECT MAX(version) v FROM schema_versions").get() as any).v;
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(22);
    expect(v).toBe(LATEST_SCHEMA_VERSION);
  });
});

describe("downgrade guard", () => {
  it("throws a clear error when the DB is newer than the binary", () => {
    const db = freshDb();
    db.prepare("INSERT INTO schema_versions (version, name) VALUES (?, ?)")
      .run(LATEST_SCHEMA_VERSION + 1, "from_the_future");
    expect(() => runMigrations(db)).toThrow(/newer code-context version/i);
  });

  it("is idempotent at the current version (running twice is a no-op)", () => {
    const db = freshDb();
    expect(() => runMigrations(db)).not.toThrow();
    const v = (db.prepare("SELECT MAX(version) v FROM schema_versions").get() as any).v;
    expect(v).toBe(LATEST_SCHEMA_VERSION);
  });
});
```

- [ ] **Step 1.2: Run to verify failure**

Run: `npx vitest run test/migrations.test.ts`
Expected: FAIL — `LATEST_SCHEMA_VERSION` is not exported (SyntaxError/undefined).

- [ ] **Step 1.3: Implement constant + guard in `src/scrum/schema.ts`**

Above `initScrumSchema` add:

```ts
/** Single source of truth for the schema version. Must equal the max version in
 *  runMigrations' array — runMigrations asserts this at every call. */
export const LATEST_SCHEMA_VERSION = 22;
```

In `runMigrations`, directly after the `migrations` array is defined and `current` is read (keep the existing `const current = ...` line), insert:

```ts
  const maxDefined = Math.max(...migrations.map((m) => m.version));
  if (maxDefined !== LATEST_SCHEMA_VERSION) {
    throw new Error(
      `LATEST_SCHEMA_VERSION (${LATEST_SCHEMA_VERSION}) is out of sync with the migrations array (max ${maxDefined}) — update the constant when adding a migration.`,
    );
  }
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `context.db schema is v${current}, but this code-context version only knows v${LATEST_SCHEMA_VERSION}. ` +
        `It was created by a newer code-context version — update the package (npm i -g code-context-mcp@latest) or open it with a matching version.`,
    );
  }
```

Note: `current` is read after `initScrumSchema` has created `schema_versions`, so the SELECT is always safe.

- [ ] **Step 1.4: Run to verify pass**

Run: `npx vitest run test/migrations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 1.5: Commit**

```bash
git add src/scrum/schema.ts test/migrations.test.ts
git commit -m "feat(scrum): LATEST_SCHEMA_VERSION constant + newer-DB downgrade guard (T-B)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Canonical `initScrumSchema` (schema parity fresh-init vs full replay) (T-B)

The invariant: a DB built by `initScrumSchema` alone must be structurally identical to one built by `initScrumSchema` + full migration replay. Today the replay adds things init misses: `tickets.estimated_hours/actual_hours` (v6), `velocity_trends` view (v9), `discoveries` (v11, + `resolution_plan` patch), `pending_actions` (v12), `workflow_runs`/`workflow_step_log` (v13), default tags (v8), and the dashboard-only `tickets.review_status`. `tickets.epic_id` and `sprints.milestone_id` are patched post-CREATE — move them into the CREATE TABLEs.

**Files:**
- Modify: `src/scrum/schema.ts` (`initScrumSchema`)
- Modify: `test/migrations.test.ts` (add parity helper + test)

- [ ] **Step 2.1: Add the parity helper and failing test to `test/migrations.test.ts`**

```ts
type ColInfo = { name: string; type: string; notnull: number; dflt_value: unknown };

/** Structural snapshot: tables, per-table columns (sorted by name — ALTER appends
 *  while CREATE inlines, so order must not matter), named indexes, views. */
export function schemaSnapshot(db: Database.Database) {
  const objs = db
    .prepare(
      "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as Array<{ type: string; name: string }>;
  const tables = objs.filter((o) => o.type === "table").map((o) => o.name).sort();
  const columns: Record<string, Array<{ name: string; type: string; notnull: number; dflt: string }>> = {};
  for (const t of tables) {
    columns[t] = (db.pragma(`table_info(${t})`) as ColInfo[])
      .map((c) => ({ name: c.name, type: c.type, notnull: c.notnull, dflt: String(c.dflt_value) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const indexes = objs.filter((o) => o.type === "index").map((o) => o.name).sort();
  const views = objs.filter((o) => o.type === "view").map((o) => o.name).sort();
  return { tables, columns, indexes, views };
}

describe("canonical schema parity", () => {
  it("initScrumSchema alone matches init + full migration replay", () => {
    const replayed = freshDb(); // init + replay (current behavior)
    const initOnly = new Database(":memory:");
    initSchema(initOnly);
    initScrumSchema(initOnly);
    expect(schemaSnapshot(initOnly)).toEqual(schemaSnapshot(replayed));
  });

  it("fresh init seeds the default tags (absorbed migration v8)", () => {
    const initOnly = new Database(":memory:");
    initScrumSchema(initOnly);
    const names = (initOnly.prepare("SELECT name FROM tags ORDER BY name").all() as any[]).map((r) => r.name);
    expect(names).toEqual(["bug", "documentation", "performance", "security", "tech-debt", "ux"]);
  });
});
```

- [ ] **Step 2.2: Run to verify failure**

Run: `npx vitest run test/migrations.test.ts -t "canonical"`
Expected: FAIL — snapshot diff shows missing `discoveries`, `pending_actions`, `workflow_runs`, `workflow_step_log` tables, `velocity_trends` view, and missing `tickets` columns (`estimated_hours`, `actual_hours`, `review_status`, `epic_id`), `sprints.milestone_id`, tags empty.

- [ ] **Step 2.3: Make `initScrumSchema` canonical**

All edits inside the big `db.exec(\`...\`)` template in `initScrumSchema`:

a) `tickets` CREATE TABLE — after the `milestone_id INTEGER,` line add:

```sql
      epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL,
      estimated_hours REAL,
      actual_hours REAL,
      review_status TEXT DEFAULT NULL CHECK(review_status IS NULL OR review_status IN ('pending','approved','rejected')),
```

b) `sprints` CREATE TABLE — after `archived_at TEXT DEFAULT NULL,` add:

```sql
      milestone_id INTEGER REFERENCES milestones(id),
```

c) After the `token_usage` CREATE TABLE (end of the exec block), append the absorbed v9/v11/v12/v13 objects and tag seeds:

```sql
    CREATE TABLE IF NOT EXISTS discoveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discovery_sprint_id INTEGER NOT NULL REFERENCES sprints(id),
      finding TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('architecture', 'ux', 'performance', 'testing', 'integration', 'general')),
      status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'planned', 'implemented', 'dropped')),
      priority TEXT DEFAULT 'P1' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
      implementation_ticket_id INTEGER REFERENCES tickets(id),
      drop_reason TEXT,
      created_by TEXT,
      resolution_plan TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_discoveries_sprint ON discoveries(discovery_sprint_id);
    CREATE INDEX IF NOT EXISTS idx_discoveries_status ON discoveries(status);

    CREATE TABLE IF NOT EXISTS pending_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'failed', 'expired')),
      source TEXT NOT NULL DEFAULT 'dashboard',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      claimed_at TEXT,
      completed_at TEXT,
      result TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status, created_at);

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      steps TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'awaiting_agent', 'paused', 'completed', 'failed')),
      context TEXT,
      trigger_action_id INTEGER REFERENCES pending_actions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

    CREATE TABLE IF NOT EXISTS workflow_step_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflow_runs(id),
      step_index INTEGER NOT NULL,
      agent_role TEXT,
      action TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
      input TEXT,
      output TEXT,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_step_log_workflow ON workflow_step_log(workflow_id);

    CREATE VIEW IF NOT EXISTS velocity_trends AS
    SELECT
      s.id as sprint_id, s.name as sprint_name, s.status,
      s.velocity_committed as committed, s.velocity_completed as completed,
      CASE WHEN s.velocity_committed > 0 THEN ROUND(CAST(s.velocity_completed AS REAL) / s.velocity_committed * 100, 1) ELSE 0 END as completion_rate,
      (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE' AND deleted_at IS NULL) as tickets_done,
      (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND deleted_at IS NULL) as tickets_total,
      (SELECT COUNT(*) FROM bugs WHERE sprint_id = s.id) as bugs_found,
      (SELECT COUNT(*) FROM bugs WHERE sprint_id = s.id AND status = 'fixed') as bugs_fixed,
      s.start_date, s.end_date, s.created_at
    FROM sprints s WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC;

    INSERT OR IGNORE INTO tags (name, color) VALUES ('tech-debt', '#ef4444');
    INSERT OR IGNORE INTO tags (name, color) VALUES ('security', '#f59e0b');
    INSERT OR IGNORE INTO tags (name, color) VALUES ('ux', '#8b5cf6');
    INSERT OR IGNORE INTO tags (name, color) VALUES ('bug', '#dc2626');
    INSERT OR IGNORE INTO tags (name, color) VALUES ('performance', '#10b981');
    INSERT OR IGNORE INTO tags (name, color) VALUES ('documentation', '#6366f1');
```

d) The existing post-exec patch blocks in `initScrumSchema` (milestone_id/epic_id ALTERs, `idx_tickets_milestone_id`/`idx_tickets_epic_id` indexes, sprints milestone_id) STAY — they serve legacy DBs. The `review_status`/hours columns also need legacy patches; those are added to `runMigrations`' idempotent section in Step 2.4.

The CREATE VIEW must match migration v9/v17's text exactly (it does above — copied from the v17 rebuild block) so replay and init produce the same view definition.

- [ ] **Step 2.4: Add idempotent legacy patches to `runMigrations`**

In `runMigrations`, inside the transaction, next to the existing `retroCols` patch block, add (read `ticketCols` fresh — don't reuse a stale snapshot):

```ts
  // Absorbed from dashboard.ts ad-hoc patches + v6 (legacy DBs created before these
  // columns were canonical). Fresh DBs get them via initScrumSchema's CREATE TABLE.
  const ticketCols = db.pragma("table_info(tickets)") as Array<{ name: string }>;
  if (!ticketCols.some((c) => c.name === "estimated_hours")) {
    db.exec("ALTER TABLE tickets ADD COLUMN estimated_hours REAL");
  }
  if (!ticketCols.some((c) => c.name === "actual_hours")) {
    db.exec("ALTER TABLE tickets ADD COLUMN actual_hours REAL");
  }
  if (!ticketCols.some((c) => c.name === "review_status")) {
    db.exec(
      "ALTER TABLE tickets ADD COLUMN review_status TEXT DEFAULT NULL CHECK(review_status IS NULL OR review_status IN ('pending','approved','rejected'))",
    );
  }
  // deleted_at safety net for all four soft-delete tables (was dashboard-only)
  for (const table of ["milestones", "sprints", "epics", "tickets"]) {
    const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "deleted_at")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT DEFAULT NULL`);
    }
  }
```

Also fix the false v7 comment: change
`{ version: 7, name: 'add_review_status_to_tickets', sql: \`\n      SELECT 1\n    \` }, // review_status already exists from earlier migration`
to
`{ version: 7, name: 'add_review_status_to_tickets', sql: \`SELECT 1\` }, // review_status applied in the idempotent section below (was dashboard-only before 2026-06-11)`

Migration v6 (`add_time_tracking_to_tickets`) uses plain `ALTER TABLE ... ADD COLUMN` which throws on a duplicate column — on legacy DBs `current >= 6` so it never re-runs, and fresh/canonical DBs replay it… which would now THROW because the canonical CREATE TABLE already has the columns. Replace v6's sql with `SELECT 1` and a comment:

```ts
    { version: 6, name: 'add_time_tracking_to_tickets', sql: `SELECT 1` }, // estimated/actual_hours now canonical in initScrumSchema + idempotent patch below
```

Same hazard check for v8 (INSERT OR IGNORE — safe to replay) and v9 (CREATE VIEW IF NOT EXISTS — safe). v11/v12/v13 are CREATE TABLE IF NOT EXISTS — safe to replay. Only v6 needed neutering.

- [ ] **Step 2.5: Run to verify pass**

Run: `npx vitest run test/migrations.test.ts`
Expected: PASS (all tests incl. both parity tests).

- [ ] **Step 2.6: Run the full suite to catch regressions**

Run: `npm test`
Expected: PASS. If `mcp-tools-coverage` or seed tests fail on tags counts, inspect — `seedDefaults` must not conflict with the new tag seeds (INSERT OR IGNORE both sides — no conflict expected).

- [ ] **Step 2.7: Commit**

```bash
git add src/scrum/schema.ts test/migrations.test.ts
git commit -m "feat(scrum): canonical initScrumSchema — absorb v6/v8/v9/v11-13 + review_status, parity-tested (T-B)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Fresh-DB baseline (`runMigrations(db, { freshDb })`) (T-B)

**Files:**
- Modify: `src/scrum/schema.ts` (`runMigrations` signature + body)
- Modify: `src/server/index.ts`, `src/server/setup.ts` (pass flag), `src/dashboard/dashboard.ts` (pass flag)
- Modify: `test/migrations.test.ts`

- [ ] **Step 3.1: Write failing test**

```ts
describe("fresh-DB baseline", () => {
  it("stamps all versions without replaying, and matches the replay path structurally", () => {
    const baseline = freshDb({ freshDb: true });
    const replayed = freshDb();
    const count = (baseline.prepare("SELECT COUNT(*) c FROM schema_versions").get() as any).c;
    expect(count).toBe(LATEST_SCHEMA_VERSION);
    const v = (baseline.prepare("SELECT MAX(version) v FROM schema_versions").get() as any).v;
    expect(v).toBe(LATEST_SCHEMA_VERSION);
    expect(schemaSnapshot(baseline)).toEqual(schemaSnapshot(replayed));
  });

  it("ignores freshDb on an already-versioned DB (no double-stamping)", () => {
    const db = freshDb();
    runMigrations(db, { freshDb: true }); // wrong flag on existing DB must be harmless
    const count = (db.prepare("SELECT COUNT(*) c FROM schema_versions").get() as any).c;
    expect(count).toBe(LATEST_SCHEMA_VERSION);
  });
});
```

- [ ] **Step 3.2: Run to verify failure**

Run: `npx vitest run test/migrations.test.ts -t "baseline"`
Expected: FAIL — `runMigrations` doesn't accept options (TS error) or stamping count wrong.

- [ ] **Step 3.3: Implement baseline in `runMigrations`**

Change the signature:

```ts
export function runMigrations(
  db: Database.Database,
  opts: { freshDb?: boolean } = {},
): void {
```

Inside the transaction, wrap the versioned replay loop (the `agentCols` department patch + `for (const m of migrations)` block) in a branch — the idempotent patch section after it always runs in both branches:

```ts
  if (opts.freshDb && current === 0) {
    // Brand-new DB: initScrumSchema already created the canonical schema.
    // Stamp all versions instead of replaying (avoids the v5/v17 rebuild dance).
    const stamp = db.prepare("INSERT INTO schema_versions (version, name) VALUES (?, ?)");
    for (const m of migrations) stamp.run(m.version, m.name);
  } else {
    // ... existing agentCols department patch + versioned for-loop, unchanged ...
  }
```

- [ ] **Step 3.4: Pass the flag from all three entry points**

`src/server/index.ts` — add `import fs from "fs";` to the imports, then change lines 14–21 to:

```ts
const DB_PATH = process.argv[2] ?? "./context.db";
const resolvedDbPath = path.resolve(DB_PATH);
const isFreshDb = !fs.existsSync(resolvedDbPath);
const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initSchema(db);
initScrumSchema(db);
runMigrations(db, { freshDb: isFreshDb });
```

`src/server/setup.ts` — before `const db = new Database(DB_PATH);` (line 73) add `const isFreshDb = !fs.existsSync(DB_PATH);` (after the `--force` unlink block so a force-reset counts as fresh), and change `runMigrations(db);` to `runMigrations(db, { freshDb: isFreshDb });`. (Task 7 restructures this file further; keep this minimal here.)

`src/dashboard/dashboard.ts` — find the `writeDb` open (search `new Database(` near line 50–60). Immediately before it add `const isFreshDb = !fs.existsSync(dbPath);` (dashboard already resolves `dbPath`; add `import fs from "node:fs";` only if no fs import exists — check first with grep). Change its `runMigrations(writeDb);` to `runMigrations(writeDb, { freshDb: isFreshDb });`.

- [ ] **Step 3.5: Run tests**

Run: `npx vitest run test/migrations.test.ts && npm test`
Expected: PASS everywhere (default `opts = {}` keeps all existing callers on the replay path).

- [ ] **Step 3.6: Commit**

```bash
git add src/scrum/schema.ts src/server/index.ts src/server/setup.ts src/dashboard/dashboard.ts test/migrations.test.ts
git commit -m "feat(scrum): fresh-DB baseline stamping — skip 22-migration replay on new DBs (T-B)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Remove dashboard's ad-hoc schema patches (T-B)

**Files:**
- Modify: `src/dashboard/dashboard.ts:64-78`

- [ ] **Step 4.1: Delete the two patch blocks**

Remove the `// Soft-delete migration: add deleted_at columns if missing` for-loop and the `// M13-038: add review_status column` block (dashboard.ts lines ~64–78). They are now covered by `runMigrations`' idempotent section, which dashboard already calls two lines above.

- [ ] **Step 4.2: Verify dashboard still boots and serves**

Run: `npx vitest run test/dashboard-auth.test.ts test/sse-data-flow.test.ts test/sprint-archive.test.ts`
Expected: PASS (these spawn the real dashboard against temp DBs).

- [ ] **Step 4.3: Commit**

```bash
git add src/dashboard/dashboard.ts
git commit -m "refactor(dashboard): drop ad-hoc schema ALTERs — engine owns review_status/deleted_at now (T-B)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Legacy fixture generator + fixtures (T-B)

**Files:**
- Create: `scripts/make-legacy-fixture.mts`
- Create: `test/fixtures/legacy-dbs/pre-versioning.sql`, `v1.2.1.sql`, `v1.3.1.sql` (generated)

- [ ] **Step 5.1: Write the generator**

Create `scripts/make-legacy-fixture.mts`:

```ts
/**
 * Generate a legacy context.db fixture from a historical schema version.
 *
 * Usage: npx tsx scripts/make-legacy-fixture.mts <git-ref> <out-name>
 *   npx tsx scripts/make-legacy-fixture.mts cc8c557 pre-versioning   # before schema_versions existed
 *   npx tsx scripts/make-legacy-fixture.mts v1.2.1 v1.2.1
 *   npx tsx scripts/make-legacy-fixture.mts v1.3.1 v1.3.1
 *
 * Extracts src/scrum/schema.ts (+ src/server/schema.ts when present) at <git-ref>,
 * runs the era's init/migrate functions against a temp DB, seeds deterministic data,
 * and dumps SQL to test/fixtures/legacy-dbs/<out-name>.sql.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

const [ref, outName] = process.argv.slice(2);
if (!ref || !outName) {
  console.error("Usage: npx tsx scripts/make-legacy-fixture.mts <git-ref> <out-name>");
  process.exit(1);
}

function gitShow(p: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${p}`], { encoding: "utf-8" });
  } catch {
    return null;
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-fixture-"));
const scrumSrc = gitShow("src/scrum/schema.ts");
if (!scrumSrc) {
  console.error(`No src/scrum/schema.ts at ${ref}`);
  process.exit(1);
}
const serverSrc = gitShow("src/server/schema.ts");
fs.writeFileSync(path.join(tmp, "scrum-schema.ts"), scrumSrc);
if (serverSrc) fs.writeFileSync(path.join(tmp, "server-schema.ts"), serverSrc);

const scrum = await import(pathToFileURL(path.join(tmp, "scrum-schema.ts")).href);
const server = serverSrc ? await import(pathToFileURL(path.join(tmp, "server-schema.ts")).href) : null;

const db = new Database(path.join(tmp, "context.db"));
if (server?.initSchema) server.initSchema(db);
scrum.initScrumSchema(db);
if (typeof scrum.runMigrations === "function") scrum.runMigrations(db); // pre-versioning eras lack it

// Deterministic seed data — uses only columns that exist in every supported era.
// If an era rejects a statement, FAIL LOUDLY: adjust here, never silently skip.
db.exec(`
  INSERT INTO sprints (name, goal, status) VALUES ('Fixture Sprint 1', 'Legacy fixture goal', 'planning');
  INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points)
    VALUES (1, 'T-1', 'Legacy ticket one', 'P1', 'DONE', 3),
           (1, 'T-2', 'Legacy ticket two', 'P2', 'TODO', 5);
  INSERT INTO retro_findings (sprint_id, category, finding) VALUES (1, 'try_next', 'Legacy try-next finding');
  INSERT INTO agents (role, name) VALUES ('legacy-dev', 'Legacy Dev');
  INSERT INTO skills (name, content) VALUES ('LEGACY_SKILL', 'legacy content');
`);
const has = (t: string) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
if (has("decisions")) db.exec("INSERT INTO decisions (title) VALUES ('Legacy decision')");
if (has("discoveries"))
  db.exec("INSERT INTO discoveries (discovery_sprint_id, finding) VALUES (1, 'Legacy discovery')");
if (has("event_log"))
  db.exec("INSERT INTO event_log (entity_type, entity_id, action) VALUES ('ticket', 1, 'created')");

function sqlLit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const lines: string[] = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
const objs = db
  .prepare(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
     ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, rowid`,
  )
  .all() as Array<{ type: string; name: string; sql: string }>;
for (const o of objs.filter((o) => o.type === "table")) {
  lines.push(o.sql + ";");
  const rows = db.prepare(`SELECT * FROM "${o.name}"`).all() as Array<Record<string, unknown>>;
  for (const row of rows) {
    const cols = Object.keys(row);
    lines.push(
      `INSERT INTO "${o.name}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((c) => sqlLit(row[c])).join(", ")});`,
    );
  }
}
try {
  for (const r of db.prepare("SELECT name, seq FROM sqlite_sequence").all() as any[]) {
    lines.push(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('${r.name}', ${r.seq});`);
  }
} catch {
  /* no AUTOINCREMENT tables in this era */
}
for (const o of objs.filter((o) => o.type !== "table")) lines.push(o.sql + ";");
lines.push("COMMIT;");

const outDir = path.resolve(import.meta.dirname, "../test/fixtures/legacy-dbs");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${outName}.sql`);
fs.writeFileSync(outPath, lines.join("\n") + "\n");
db.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${outPath} (${lines.length} statements) from ${ref}`);
```

- [ ] **Step 5.2: Generate the three fixtures**

```bash
npx tsx scripts/make-legacy-fixture.mts cc8c557 pre-versioning
npx tsx scripts/make-legacy-fixture.mts v1.2.1 v1.2.1
npx tsx scripts/make-legacy-fixture.mts v1.3.1 v1.3.1
```

Expected: three `Wrote .../<name>.sql` lines. If a seed INSERT fails for an era (e.g. CHECK constraint mismatch), adjust the seed values in the generator to era-universal ones — do not weaken to silent skips. Sanity-check each file: `grep -c "INSERT INTO" test/fixtures/legacy-dbs/*.sql` (each ≥ 8) and `grep -c "schema_versions" test/fixtures/legacy-dbs/pre-versioning.sql` (must be 0).

- [ ] **Step 5.3: Commit**

```bash
git add scripts/make-legacy-fixture.mts test/fixtures/legacy-dbs/
git commit -m "test(scrum): legacy DB fixture generator + pre-versioning/v1.2.1/v1.3.1 fixtures (T-B)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Legacy migration tests (T-B)

**Files:**
- Modify: `test/migrations.test.ts`

- [ ] **Step 6.1: Add the legacy suite**

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/legacy-dbs",
);
const FIXTURES = ["pre-versioning", "v1.2.1", "v1.3.1"] as const;

function loadFixture(name: string): Database.Database {
  const sql = fs.readFileSync(path.join(FIXTURE_DIR, `${name}.sql`), "utf-8");
  const db = new Database(":memory:");
  db.exec(sql); // dump sets PRAGMA foreign_keys=OFF internally
  return db;
}

describe.each(FIXTURES)("legacy fixture: %s", (name) => {
  it("migrates to LATEST_SCHEMA_VERSION without errors", () => {
    const db = loadFixture(name);
    db.pragma("foreign_keys = ON");
    initSchema(db);
    initScrumSchema(db);
    expect(() => runMigrations(db)).not.toThrow();
    const v = (db.prepare("SELECT MAX(version) v FROM schema_versions").get() as any).v;
    expect(v).toBe(LATEST_SCHEMA_VERSION);
  });

  it("preserves the seeded data", () => {
    const db = loadFixture(name);
    initSchema(db);
    initScrumSchema(db);
    runMigrations(db);
    const sprint = db.prepare("SELECT name, goal FROM sprints WHERE id = 1").get() as any;
    expect(sprint).toMatchObject({ name: "Fixture Sprint 1", goal: "Legacy fixture goal" });
    const tickets = db
      .prepare("SELECT ticket_ref, title, status, story_points FROM tickets ORDER BY id")
      .all() as any[];
    expect(tickets).toEqual([
      { ticket_ref: "T-1", title: "Legacy ticket one", status: "DONE", story_points: 3 },
      { ticket_ref: "T-2", title: "Legacy ticket two", status: "TODO", story_points: 5 },
    ]);
    const finding = db.prepare("SELECT finding, status FROM retro_findings WHERE sprint_id = 1").get() as any;
    expect(finding.finding).toBe("Legacy try-next finding");
    expect(finding.status).toBe("open"); // v21 default applied to legacy rows
    expect((db.prepare("SELECT name FROM skills WHERE name='LEGACY_SKILL'").get() as any).name).toBe("LEGACY_SKILL");
  });

  it("reaches structural parity with a fresh baseline DB", () => {
    const db = loadFixture(name);
    initSchema(db);
    initScrumSchema(db);
    runMigrations(db);
    const baseline = freshDb({ freshDb: true });
    expect(schemaSnapshot(db)).toEqual(schemaSnapshot(baseline));
  });

  it("is idempotent — second runMigrations changes nothing", () => {
    const db = loadFixture(name);
    initSchema(db);
    initScrumSchema(db);
    runMigrations(db);
    const before = schemaSnapshot(db);
    const rowsBefore = (db.prepare("SELECT COUNT(*) c FROM tickets").get() as any).c;
    runMigrations(db);
    expect(schemaSnapshot(db)).toEqual(before);
    expect((db.prepare("SELECT COUNT(*) c FROM tickets").get() as any).c).toBe(rowsBefore);
  });
});
```

- [ ] **Step 6.2: Run**

Run: `npx vitest run test/migrations.test.ts`
Expected: PASS. Likely first-run failures and their fixes:
- *Parity diff on legacy-only objects* (e.g. an index that existed historically but is gone now, or `sprints_new` leftovers): fix in `runMigrations`' idempotent section with `DROP INDEX IF EXISTS`/`DROP TABLE IF EXISTS` for the orphan — the parity test defines the contract.
- *Legacy `tickets` lacking a UNIQUE/CHECK that pragma doesn't surface*: structural snapshot ignores those by design; only name/type/notnull/default count.
- *`retro_findings.status` missing on v1.3.1*: confirms the idempotent patch path — must pass via existing code.

- [ ] **Step 6.3: Full suite + commit**

```bash
npm test
git add test/migrations.test.ts src/scrum/schema.ts
git commit -m "test(scrum): legacy fixture migration suite — parity, data survival, idempotency (T-B)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Mark `T-B` DONE via `mcp__code-context__update_ticket` (status DONE; gates require sprint in implementation/qa phase). Set `T-A` IN_PROGRESS.

---

### Task 7: Setup update mode + `--force` defang + startup report (T-A)

**Files:**
- Modify: `src/server/setup.ts`
- Modify: `src/server/index.ts` (one log line)
- Create: `test/setup-update-mode.test.ts`

- [ ] **Step 7.1: Write failing integration test**

Create `test/setup-update-mode.test.ts`:

```ts
/**
 * Setup update mode (spec 2026-06-11): existing context.db → migrate + config repair,
 * no re-index/seed/wizard; backup only when migrations pending; --force renames.
 * Spawns the real setup script against a temp project dir (pattern: sprint-archive.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LATEST_SCHEMA_VERSION } from "../src/scrum/schema.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSX = path.join(REPO_ROOT, "node_modules/.bin/tsx");
const SETUP = path.join(REPO_ROOT, "src/server/setup.ts");

function runSetup(dir: string, ...extra: string[]): string {
  return execFileSync(TSX, [SETUP, dir, "--defaults", ...extra], {
    encoding: "utf-8",
    cwd: REPO_ROOT,
    timeout: 120_000,
  });
}

describe("setup update mode", () => {
  let dir: string;
  let dbPath: string;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "setup-update-"));
    writeFileSync(path.join(dir, "hello.ts"), "export const hi = 1;\n");
    runSetup(dir); // initial full setup
    dbPath = path.join(dir, "context.db");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("first run is full setup and creates the DB", () => {
    expect(existsSync(dbPath)).toBe(true);
  });

  it("second run enters update mode: no re-index, no backup when schema is current", () => {
    const filesBefore = countFiles(dbPath);
    writeFileSync(path.join(dir, "new-file.ts"), "export const two = 2;\n"); // would be indexed by a full run
    const out = runSetup(dir);
    expect(out).toMatch(/migration mode|Update/i);
    expect(out).toMatch(new RegExp(`up to date \\(v${LATEST_SCHEMA_VERSION}\\)`, "i"));
    expect(out).not.toMatch(/Indexing target directory/);
    expect(countFiles(dbPath)).toBe(filesBefore); // new-file.ts NOT indexed
    expect(existsSync(dbPath + ".bak")).toBe(false);
  });

  it("backs up and reports when migrations are pending", () => {
    const db = new Database(dbPath);
    db.prepare("DELETE FROM schema_versions WHERE version > 19").run();
    db.close();
    const out = runSetup(dir);
    expect(out).toMatch(new RegExp(`Migrated v19 → v${LATEST_SCHEMA_VERSION}`, "i"));
    expect(existsSync(dbPath + ".bak")).toBe(true);
    const v = (new Database(dbPath).prepare("SELECT MAX(version) v FROM schema_versions").get() as any).v;
    expect(v).toBe(LATEST_SCHEMA_VERSION);
  });

  it("update mode preserves user data", () => {
    const db = new Database(dbPath);
    db.prepare("INSERT INTO sprints (name, goal, status) VALUES ('Keep Me', 'survives update', 'planning')").run();
    db.close();
    runSetup(dir);
    const row = new Database(dbPath).prepare("SELECT goal FROM sprints WHERE name='Keep Me'").get() as any;
    expect(row.goal).toBe("survives update");
  });

  it("--force renames the old DB instead of deleting it", () => {
    const out = runSetup(dir, "--force");
    expect(out).toMatch(/context\.db\.bak-/);
    const backups = readdirSync(dir).filter((f) => f.startsWith("context.db.bak-"));
    expect(backups.length).toBeGreaterThanOrEqual(1);
    const row = new Database(dbPath).prepare("SELECT COUNT(*) c FROM sprints WHERE name='Keep Me'").get() as any;
    expect(row.c).toBe(0); // fresh DB
  });
});

function countFiles(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true });
  const c = (db.prepare("SELECT COUNT(*) c FROM files").get() as any).c;
  db.close();
  return c;
}
```

- [ ] **Step 7.2: Run to verify failure**

Run: `npx vitest run test/setup-update-mode.test.ts`
Expected: first test PASSES (full setup works today), the update-mode tests FAIL (second run re-indexes, no "migration mode" output, `--force` deletes).

- [ ] **Step 7.3: Restructure `setup.ts`**

Apply these changes to `src/server/setup.ts` (line refs are pre-change):

a) Add import: `import { initScrumSchema, runMigrations, LATEST_SCHEMA_VERSION } from "../scrum/schema.js";` (extend the existing import).

b) Replace the `--force` unlink block (lines 68–71) and DB init (lines 66–80) with:

```ts
// 1. Initialize or migrate database (code-context + scrum schemas)
const dbExisted = fs.existsSync(DB_PATH);

if (FORCE && dbExisted) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const suffix of ["", "-wal", "-shm"]) {
    const src = DB_PATH + suffix;
    if (fs.existsSync(src)) fs.renameSync(src, `${DB_PATH}.bak-${stamp}${suffix}`);
  }
  console.log(`  Existing database moved to context.db.bak-${stamp} (--force).\n`);
}

const updateMode = dbExisted && !FORCE;
const totalSteps = updateMode ? 2 : 7;
let stepNo = 1;
const step = (label: string) => console.log(`[${stepNo++}/${totalSteps}] ${label}`);

if (updateMode) {
  console.log("  Existing database detected → migration mode (use --force for a full reset)\n");
}

step(updateMode ? "Database schema..." : "Initializing database...");

// Pre-migration backup: only when migrations are pending (update mode)
if (updateMode) {
  const peek = new Database(DB_PATH);
  let currentV = 0;
  try {
    currentV = (peek.prepare("SELECT MAX(version) v FROM schema_versions").get() as any)?.v ?? 0;
  } catch {
    currentV = 0; // pre-versioning database
  }
  if (currentV > LATEST_SCHEMA_VERSION) {
    peek.close();
    console.error(
      `  context.db schema is v${currentV}, but this code-context version only knows v${LATEST_SCHEMA_VERSION}.\n` +
        `  Update the package (npm i -g code-context-mcp@latest) or use a matching version.`,
    );
    process.exit(1);
  }
  if (currentV < LATEST_SCHEMA_VERSION) {
    peek.pragma("wal_checkpoint(TRUNCATE)");
    peek.close();
    fs.copyFileSync(DB_PATH, DB_PATH + ".bak");
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    initScrumSchema(db);
    runMigrations(db);
    db.close();
    console.log(
      `  Migrated v${currentV} → v${LATEST_SCHEMA_VERSION} (${LATEST_SCHEMA_VERSION - currentV} migrations). Backup: context.db.bak\n`,
    );
  } else {
    peek.close();
    console.log(`  Schema up to date (v${LATEST_SCHEMA_VERSION}).\n`);
  }
} else {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  initScrumSchema(db);
  runMigrations(db, { freshDb: true });
  console.log("  Code-context schema ready.");
  console.log("  Scrum schema ready.\n");
  fullSetup(db); // defined below — indexing/seeding/wizard, then db.close()
}
```

c) Wrap the current steps 2–3 + vision wizard (lines 82–133, including the final `db.close()`) into `function fullSetup(db: Database.Database) { ... }` placed right after the block above. Inside it, replace the hardcoded `[2/7]`/`[3/7]` prints with `step("Indexing target directory...")` / `step("Seeding factory defaults...")`. Keep all logic identical.

d) Steps 4–7 (mcp.json, bridge hook, commands, statusline — lines 135 to end) run in BOTH modes, unchanged except: in update mode collapse the heading to a single `step("Refreshing client config...")` printed once before the `.mcp.json` block, and guard the four old `console.log("[N/7] ...")` lines with the counter: replace each `[4/7]`…`[7/7]` literal with `step(...)` only when NOT in update mode, e.g.:

```ts
if (updateMode) {
  step("Refreshing client config...");
} 
// then inside each of the four blocks:
if (!updateMode) step("Configuring MCP client...");
```

(The four config blocks themselves — mcp.json write, bridge-hook rewrite, commands copy, statusline — stay byte-identical; they are already idempotent.)

e) Final banner: in update mode print `=== Update complete! (${PROJECT_NAME}) ===` instead of `Setup complete!`, and skip the "Restart your AI client" hint only if you must — keep it; harmless.

f) The top banner (line 60): `console.log(\`=== Code Context MCP — ${updateMode ? "Update" : "Setup"} (${PROJECT_NAME}) ===\n\`);` — move it BELOW the `updateMode` computation (it currently prints before; reorder so `updateMode` exists first; the Database/Target/Server info lines stay).

- [ ] **Step 7.4: Startup version report in `src/server/index.ts`**

After `runMigrations(db, { freshDb: isFreshDb });` add:

```ts
const schemaV = (db.prepare("SELECT MAX(version) v FROM schema_versions").get() as any)?.v ?? 0;
console.error(`[schema] v${schemaV}${isFreshDb ? " (new database)" : ""}`);
```

(stderr — stdout is the MCP transport and must stay clean.)

- [ ] **Step 7.5: Run the integration test until green**

Run: `npx vitest run test/setup-update-mode.test.ts`
Expected: PASS (5 tests). Then `npm test` for the full suite.

- [ ] **Step 7.6: Commit**

```bash
git add src/server/setup.ts src/server/index.ts test/setup-update-mode.test.ts
git commit -m "feat(setup): update mode — migrate+config-repair on existing DB, --force renames not deletes (T-A)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Docs, changelog, wrap-up

**Files:**
- Modify: `CHANGELOG.md` (repo root — check it exists; recent commit `0103927` touched it)
- Modify: `docs/user-guide.md` (only if it documents setup re-runs — grep `--force` first)

- [ ] **Step 8.1: Changelog entry**

Under the unreleased/next heading (match the existing 1.4.0 section style) add:

```markdown
### Changed
- `code-context-mcp` on an existing project now runs **update mode**: schema migrations
  (with automatic `context.db.bak` backup when migrations are pending) + idempotent config
  repair. It no longer re-indexes, re-seeds, or re-runs the wizard — use `--force` for a
  full reset or the `index_directory` tool to refresh the index.
- `--force` renames the old database to `context.db.bak-<timestamp>` instead of deleting it.

### Fixed
- `tickets.review_status` is now created by the migration engine — previously only the
  dashboard added it, so server-only databases were missing the column.
- Opening a `context.db` created by a newer code-context version now fails fast with a
  clear upgrade message instead of running against an unknown schema.
```

- [ ] **Step 8.2: Full verification**

Run: `npm test && npm run lint && npm run build`
Expected: all green. Fix anything that isn't before proceeding.

- [ ] **Step 8.3: Commit + scrum closeout**

```bash
git add CHANGELOG.md docs/user-guide.md
git commit -m "docs(changelog): update mode, --force backup, review_status engine fix

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Mark `T-A` DONE (`mcp__code-context__update_ticket`). Log a decision via `mcp__code-context__log_decision`: title "Setup runs migrate+config-repair on existing DBs", rationale: spec path, alternatives "migrate-only / full re-run", outcome "update mode shipped".

---

## Self-Review (executed at plan time)

- **Spec coverage:** detection (T7), backup (T7), config repair kept (T7d), re-index/seed/wizard skipped (T7c), `--force` rename (T7b), startup report (T7.4), `LATEST_SCHEMA_VERSION` + array assert (T1), canonical schema incl. review_status/dashboard absorption (T2, T4), fresh baseline (T3), newer-DB guard (T1 engine + T7 setup peek), generator + 3 fixtures (T5), parity/data/idempotency/guard tests (T1, T2, T6), setup integration tests incl. data-preservation and force (T7), changelog (T8), tickets-before-code (T0). No gaps found.
- **Placeholder scan:** none — every code step has full code; the two "check first" instructions (dashboard fs import, user-guide grep) specify the exact check and both outcomes.
- **Type consistency:** `runMigrations(db, opts?: { freshDb?: boolean })` used identically in T1/T3/T5/T6/T7; `schemaSnapshot` defined once (T2) and imported nowhere else (same file); `LATEST_SCHEMA_VERSION` exported in T1, imported in T7 tests and setup.
