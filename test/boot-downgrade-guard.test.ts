/**
 * CLI fatal-error UX (discoveries #23/#28/#29): a newer-version DB must refuse
 * the MCP-server boot with the same groomed two-line ERROR that setup prints —
 * no raw stack trace, no -wal/-shm litter — and --help must describe the real
 * setup/update behavior. Spawns the real entry points (pattern:
 * setup-update-mode.test.ts).
 */
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSX = path.join(REPO_ROOT, "node_modules/.bin/tsx");
const SERVER_ENTRY = path.join(REPO_ROOT, "src/server/index.ts");
const SETUP = path.join(REPO_ROOT, "src/server/setup.ts");

describe("MCP server boot downgrade guard (discovery #28)", () => {
  it("refuses a newer-version DB with a groomed error and leaves no WAL litter", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "boot-guard-"));
    const dbPath = path.join(dir, "context.db");
    try {
      const db = new Database(dbPath);
      db.exec("CREATE TABLE schema_versions (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)");
      db.prepare("INSERT INTO schema_versions (version, name) VALUES (?, ?)").run(9999, "from-the-future");
      db.close();

      let failed = false;
      let output = "";
      try {
        execFileSync(TSX, [SERVER_ENTRY, dbPath], {
          encoding: "utf-8",
          cwd: REPO_ROOT,
          timeout: 30_000,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err: any) {
        failed = true;
        output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
        expect(err.status).toBe(1);
      }
      expect(failed).toBe(true);
      expect(output).toMatch(/ERROR: Database is at schema v9999/);
      expect(output).toMatch(/newer code-context version/);
      expect(output).not.toMatch(/at runMigrations/); // groomed, not a raw stack trace

      // Refused boot must not create WAL siblings next to the untouched DB
      expect(existsSync(dbPath + "-wal")).toBe(false);
      expect(existsSync(dbPath + "-shm")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("--help text (discovery #29)", () => {
  it("describes setup/update behavior instead of the stale 'Index a directory'", () => {
    const out = execFileSync(TSX, [SETUP, "--help"], {
      encoding: "utf-8",
      cwd: REPO_ROOT,
      timeout: 30_000,
    });
    expect(out).not.toMatch(/Index a directory/);
    expect(out).toMatch(/update mode/i);
    expect(out).toMatch(/--defaults/);
    expect(out).toMatch(/--force/);
    expect(out).toMatch(/context\.db\.bak-<timestamp>/);
  });
});
