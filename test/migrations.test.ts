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
