import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import { indexDirectory } from "../src/server/indexer.js";
import { createTestDb } from "./helpers/db.js";
import Database from "better-sqlite3";

const FIXTURE_DIR = path.resolve(__dirname, "fixtures/sample-project");

describe("Smoke test: indexer on sample-project fixture", () => {
  let db: Database.Database;
  let stats: { files: number; exports: number; deps: number };

  beforeEach(() => {
    db = createTestDb();
    stats = indexDirectory(db, FIXTURE_DIR);
  });

  it("should index all non-binary, non-hidden files", () => {
    // Fixture has: src/index.ts, src/types.ts, src/utils/helpers.ts,
    // src/utils/index.ts, src/services/api.ts, package.json, tsconfig.json,
    // README.md, styles.css, config.json = 10 files
    expect(stats.files).toBe(10);
  });

  it("should record file rows in the database", () => {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM files").get() as { cnt: number };
    expect(count.cnt).toBe(stats.files);
  });

  it("should extract exports from TypeScript files", () => {
    const exportCount = db.prepare("SELECT COUNT(*) as cnt FROM exports").get() as { cnt: number };
    expect(exportCount.cnt).toBeGreaterThan(0);
    expect(stats.exports).toBe(exportCount.cnt);
  });

  it("should build dependency edges between files", () => {
    const depCount = db.prepare("SELECT COUNT(*) as cnt FROM dependencies").get() as { cnt: number };
    expect(depCount.cnt).toBeGreaterThan(0);
    expect(stats.deps).toBe(depCount.cnt);
  });

  it("should find the 'ApiClient' export by name", () => {
    const rows = db.prepare(`
      SELECT e.name, e.kind, f.path
      FROM exports e JOIN files f ON e.file_id = f.id
      WHERE e.name = 'ApiClient'
    `).all() as { name: string; kind: string; path: string }[];

    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe("class");
    expect(rows[0].path).toContain("services/api.ts");
  });

  it("should find the 'formatDate' export by name", () => {
    const rows = db.prepare(`
      SELECT e.name, e.kind FROM exports e WHERE e.name = 'formatDate'
    `).all() as { name: string; kind: string }[];

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].kind).toBe("function");
  });

  it("should detect the HttpMethod enum export", () => {
    const rows = db.prepare(`
      SELECT e.name, e.kind FROM exports e WHERE e.name = 'HttpMethod'
    `).all() as { name: string; kind: string }[];

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].kind).toBe("enum");
  });

  it("should resolve dependency from index.ts to utils/index.ts", () => {
    const dep = db.prepare(`
      SELECT d.symbols, src.path as src_path, tgt.path as tgt_path
      FROM dependencies d
      JOIN files src ON d.source_id = src.id
      JOIN files tgt ON d.target_id = tgt.id
      WHERE src.path LIKE '%src/index.ts'
        AND tgt.path LIKE '%utils/index.ts'
    `).get() as { symbols: string; src_path: string; tgt_path: string } | undefined;

    expect(dep).toBeDefined();
    expect(dep!.symbols).toContain("formatDate");
  });

  it("should resolve dependency from index.ts to services/api.ts", () => {
    const dep = db.prepare(`
      SELECT d.symbols
      FROM dependencies d
      JOIN files src ON d.source_id = src.id
      JOIN files tgt ON d.target_id = tgt.id
      WHERE src.path LIKE '%src/index.ts'
        AND tgt.path LIKE '%services/api.ts'
    `).get() as { symbols: string } | undefined;

    expect(dep).toBeDefined();
    expect(dep!.symbols).toContain("ApiClient");
  });

  it("should index directories", () => {
    const dirCount = db.prepare("SELECT COUNT(*) as cnt FROM directories").get() as { cnt: number };
    expect(dirCount.cnt).toBeGreaterThan(0);
  });

  it("should detect correct languages", () => {
    const tsFiles = db.prepare("SELECT COUNT(*) as cnt FROM files WHERE language = 'typescript'").get() as { cnt: number };
    const cssFiles = db.prepare("SELECT COUNT(*) as cnt FROM files WHERE language = 'css'").get() as { cnt: number };
    const jsonFiles = db.prepare("SELECT COUNT(*) as cnt FROM files WHERE language = 'json'").get() as { cnt: number };
    const mdFiles = db.prepare("SELECT COUNT(*) as cnt FROM files WHERE language = 'markdown'").get() as { cnt: number };

    expect(tsFiles.cnt).toBe(5); // index.ts, types.ts, helpers.ts, utils/index.ts, services/api.ts
    expect(cssFiles.cnt).toBe(1);
    expect(jsonFiles.cnt).toBe(3); // package.json, tsconfig.json, config.json
    expect(mdFiles.cnt).toBe(1);
  });
});
