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
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(23);
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
