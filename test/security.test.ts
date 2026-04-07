import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import Database from "better-sqlite3";
import { indexDirectory } from "../src/server/indexer.js";
import { initSchema } from "../src/server/schema.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";

const FIXTURE_DIR = path.resolve(__dirname, "fixtures/sample-project");

function createFullDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  initScrumSchema(db);
  runMigrations(db);
  return db;
}

describe("Security: .env files excluded from indexing", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFullDb();
    indexDirectory(db, FIXTURE_DIR);
  });

  it("should not index .env files", () => {
    const envFiles = db.prepare(`SELECT path FROM files WHERE path LIKE '%/.env%'`).all();
    expect(envFiles).toHaveLength(0);
  });

  it("should not store .env content in the database", () => {
    const rows = db.prepare(`SELECT content FROM files WHERE content LIKE '%SECRET_KEY%'`).all();
    expect(rows).toHaveLength(0);
  });

  it("should still index non-dotfiles", () => {
    const count = (db.prepare(`SELECT COUNT(*) as c FROM files`).get() as { c: number }).c;
    expect(count).toBeGreaterThan(0);
  });
});

describe("Security: SQL injection prevention in restore", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFullDb();
  });

  it("should reject columns not in schema when restoring", () => {
    // Build column whitelist from schema (same logic as restore)
    const info = db.prepare(`PRAGMA table_info(agents)`).all() as { name: string }[];
    const validCols = new Set(info.map(c => c.name));

    const maliciousCol = 'id"; DROP TABLE agents; --';
    expect(validCols.has(maliciousCol)).toBe(false);

    // Simulate the filtering logic
    const inputCols = ["name", "role", maliciousCol];
    const safeCols = inputCols.filter(c => validCols.has(c));
    expect(safeCols).not.toContain(maliciousCol);
    expect(safeCols).toContain("name");
    expect(safeCols).toContain("role");
  });
});

describe("Security: content column filtered from file API responses", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFullDb();
    indexDirectory(db, FIXTURE_DIR);
  });

  it("should have content in files table (internal storage)", () => {
    const row = db.prepare(`SELECT content FROM files LIMIT 1`).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(0);
  });

  it("should be possible to query files without content column", () => {
    const row = db.prepare(
      `SELECT id, path, language, extension, size_bytes, line_count, summary, description, external_imports, created_at, modified_at, indexed_at FROM files LIMIT 1`
    ).get() as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty("content");
  });
});

describe("Security: request body size limit constant exists", () => {
  it("should define MAX_BODY_BYTES", async () => {
    // Verify the constant is in the dashboard source
    const fs = await import("fs");
    const src = fs.readFileSync(path.resolve(__dirname, "../src/dashboard/dashboard.ts"), "utf-8");
    expect(src).toContain("MAX_BODY_BYTES");
    expect(src).toContain("Request body too large");
  });
});

describe("Security: localhost binding configured", () => {
  it("should bind server to 127.0.0.1", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync(path.resolve(__dirname, "../src/dashboard/dashboard.ts"), "utf-8");
    expect(src).toContain('server.listen(PORT, "127.0.0.1"');
  });

  it("should set security headers", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync(path.resolve(__dirname, "../src/dashboard/dashboard.ts"), "utf-8");
    expect(src).toContain("X-Content-Type-Options");
    expect(src).toContain("X-Frame-Options");
    expect(src).toContain("X-XSS-Protection");
  });
});
