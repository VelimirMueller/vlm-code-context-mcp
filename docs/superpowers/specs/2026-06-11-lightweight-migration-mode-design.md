# Lightweight Migration Mode & Seamless Schema Migrations — Design

**Date:** 2026-06-11
**Status:** Approved (design review with user)
**Scope decision:** Existing-DB setup runs *migrate + config repair* (no re-index, no seeding, no wizard).

## Problem

The `code-context-mcp` bin **is** `setup.ts`. Every invocation on an already-initialized
project re-runs the full 7-step pipeline: schema init, **full directory re-index**, factory
seeding, vision wizard, and rewrites of `.mcp.json`, the bridge hook, commands, and
statusline config. There is no "this project already exists" detection — only `--force`,
which silently **deletes** the database.

The migration engine (`runMigrations` in `src/scrum/schema.ts`) is real and versioned
(`schema_versions`, currently v22, transaction-wrapped, runs at server startup), but has
four weak spots:

1. **Fresh DBs replay all 22 migrations**, including the v5 `sprints` rebuild that
   *downgrades* the freshly-created modern table, followed by the idempotent v17 rebuild
   that upgrades it again. Works today; every new migration compounds the fragility.
2. **Schema drift between entry points.** `dashboard.ts` carries its own ad-hoc ALTERs
   outside the engine: a `deleted_at` patch loop and — critically — `tickets.review_status`,
   which is created **only** by the dashboard. Migration v7 (`add_review_status_to_tickets`)
   is a `SELECT 1` no-op whose comment ("already exists from earlier migration") is false
   for server-only DBs. A DB that never met the dashboard has no `review_status` column.
   Similarly, `tickets.estimated_hours`/`actual_hours` exist only via migration v6, not in
   the canonical CREATE TABLE.
3. **No legacy-DB tests.** All ~345 tests run against fresh DBs. Nothing proves a
   v1.2.x / v1.3.x / pre-versioning `context.db` migrates cleanly.
4. **No downgrade guard.** An older binary opening a newer DB half-runs against an
   unknown schema with no warning.

## Goals

- Running `code-context-mcp` / `code-context-mcp setup` on an existing project must be
  fast, non-destructive, and clearly communicate what it did.
- A `context.db` from any released version (v1.2.1+, plus pre-versioning era) migrates to
  the current schema with data intact — **provably**, via fixture tests.
- One canonical schema definition; identical end-state no matter which entry point
  (server, setup, dashboard) touched the DB first.

## Non-goals

- No new migration DSL/framework — keep the existing `schema_versions` array + idempotent
  patch section.
- No incremental re-index in update mode (explicitly descoped in design review; `--force`
  or `index_directory` cover it).
- No automatic npm publishing or version bump policy changes.

## Design

### 1. Setup: existing-DB detection → update mode (`src/server/setup.ts`)

Check `fs.existsSync(DB_PATH)` **before** `new Database(...)` (opening creates the file,
so the check must precede it).

**Fresh project** → full setup, unchanged.

**Existing `context.db` (no `--force`)** → update mode:

```
=== Code Context MCP — Update (my-project) ===
  Existing database detected → migration mode (use --force for a full reset)

[1/2] Database schema...
  Migrated v19 → v22 (3 migrations). Backup: context.db.bak
[2/2] Refreshing client config...
  .mcp.json / bridge hook / commands / statusline (idempotent)
```

- **Step 1 — migrate with backup.** Open DB, read
  `MAX(version) FROM schema_versions` (0 if the table is missing). If behind
  `LATEST_SCHEMA_VERSION`: `PRAGMA wal_checkpoint(TRUNCATE)`, close, copy file to
  `context.db.bak` (single rolling backup, overwrites previous), reopen, run
  `initSchema` + `initScrumSchema` + `runMigrations`. If current: print
  `Schema up to date (v22)` and skip the backup.
- **Step 2 — config repair (kept).** `.mcp.json` server entry, bridge-hook rewrite,
  commands copy (already skips existing files), statusline (already opt-in). These are
  the upgrade-repair mechanism for configs broken by older versions.
- **Skipped entirely:** directory indexing, `seedDefaults`, vision wizard. User data and
  index content are never touched in update mode.

**`--force` defanged.** Instead of `fs.unlinkSync`: checkpoint, then rename `context.db`
(plus `-wal`/`-shm` siblings) to `context.db.bak-<ISO-timestamp>` and print the location.
Full reset remains one command but becomes recoverable. No confirmation prompt (setup must
stay scriptable).

### 2. Migration engine hardening (`src/scrum/schema.ts`)

- **`LATEST_SCHEMA_VERSION` exported constant** — single source of truth.
  `runMigrations` asserts `Math.max(...migrations.version) === LATEST_SCHEMA_VERSION`
  and throws on mismatch (cheap, runs everywhere).
- **Canonical schema.** `initScrumSchema`'s CREATE TABLEs become the complete current
  schema: add `tickets.estimated_hours`, `tickets.actual_hours`, `tickets.review_status`
  (with its CHECK). Absorb the dashboard's ad-hoc patches (`deleted_at` loop,
  `review_status`) into the engine's idempotent section; delete them from `dashboard.ts`
  (it already calls `runMigrations` first, so the engine now covers it). Migration v7's
  misleading comment is corrected.
- **Fresh-DB baseline.** Callers detect freshness via `fs.existsSync` before opening and
  pass it through (`runMigrations(db, { freshDb })`). For a fresh DB the engine stamps all
  versions into `schema_versions` without executing migration SQL — no more
  downgrade-then-rebuild dance. The idempotent patch section still runs (cheap no-ops on a
  canonical fresh schema; belt-and-braces on legacy ones). The schema-parity test (below)
  permanently enforces that baseline-fresh equals migrated-legacy.
- **Newer-DB guard.** If `MAX(schema_versions.version) > LATEST_SCHEMA_VERSION`, throw:
  `context.db schema is v{N}, but this code-context version only knows v{M}. Update the
  package (npm i -g code-context-mcp@latest) or open with a matching version.` Applies to
  server startup, setup, and dashboard (all funnel through `runMigrations`).
- Single-transaction wrapping stays as-is.

### 3. Server startup report (`src/server/index.ts`)

One stderr line after migration: `[schema] v22 (up to date)` or
`[schema] migrated v19 → v22`. No behavior change otherwise — startup auto-migration is
what keeps plain package upgrades seamless for users who never re-run setup.

### 4. Proof: legacy-fixture migration tests

**Fixture generation** — `scripts/make-legacy-fixture.mts` (checked in, reusable):
extracts a historical `schema.ts` via `git show <ref>:src/scrum/schema.ts` (tags or
commit SHAs — the pre-versioning era predates tags), runs its
`initScrumSchema`/`runMigrations` against a temp DB, inserts deterministic seed data
(sprints, tickets with all statuses, retro findings, discoveries, event_log rows), and
dumps SQL to `test/fixtures/legacy-dbs/<era>.sql`.

**Checked-in fixtures (SQL dumps, not binary DBs):**
- `pre-versioning.sql` — no `schema_versions` table at all (scariest case).
- `v1.2.1.sql` — Sprint-20 era.
- `v1.3.1.sql` — Sprint-21 era (latest released).

**`test/migrations.test.ts`:**
- *Migration succeeds*: each fixture → `initSchema` + `initScrumSchema` +
  `runMigrations` → no throw, `MAX(version) === LATEST_SCHEMA_VERSION`.
- *Data survives*: row counts and spot-checked values (ticket refs, sprint statuses,
  retro findings) match the seeded fixture data.
- *Schema parity*: normalized table/column/index sets (via `pragma table_info` +
  `sqlite_master`) of each migrated fixture **equal a fresh baseline DB**. This is the
  seamlessness guarantee and permanently enforces canonical `initScrumSchema`.
- *Idempotency*: `runMigrations` twice → schema and data unchanged.
- *Fresh baseline*: new DB → fully stamped `schema_versions`, parity with itself across
  reopen.
- *Newer-DB guard*: fixture stamped to `LATEST_SCHEMA_VERSION + 1` → clear throw.
- *Setup update mode* (integration): temp dir with existing DB → run setup main path →
  assert no re-index (file count unchanged), backup created only when migrations pending,
  configs written, data intact. `--force` → old DB renamed, not deleted.

## Error handling

- Backup copy failure (disk full, permissions) → abort before migrating, print the error,
  leave DB untouched.
- Migration SQL failure → existing single-transaction rollback; setup reports the error
  and points to `context.db.bak`.
- Corrupted/foreign `context.db` (not SQLite, or SQLite without our tables) →
  `better-sqlite3` open error or guard failure surfaces with a hint to use `--force`
  (which preserves the old file via timestamped rename).

## Compatibility notes

- Update mode changes setup's behavior on existing projects from "re-run everything" to
  "migrate + config repair". Anyone relying on setup to re-index must use `--force` or
  the `index_directory` MCP tool (with built-in freshness check). CHANGELOG entry
  required.
- `--force` semantics shift from delete to timestamped rename — strictly safer.
- Removing dashboard's ad-hoc ALTERs is safe in the same release because the engine
  applies the identical columns first (dashboard calls `runMigrations` before its old
  patch site).

## Implementation tickets (scrum process)

1. **T-A: Setup update mode + `--force` defang** — `setup.ts` detection, backup, output,
   integration tests.
2. **T-B: Engine hardening + canonical schema + legacy fixtures** — `schema.ts` constant,
   baseline, guard, dashboard patch absorption, fixture generator, `migrations.test.ts`.

T-B lands first or together with T-A (setup's version report depends on
`LATEST_SCHEMA_VERSION`).
