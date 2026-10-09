import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { admitFile } from "../src/server/index-policy.js";
import { indexDirectory, refreshFiles, listIndexableFiles } from "../src/server/indexer.js";
import { FreshnessGuard } from "../src/server/freshness.js";
import { runReindex } from "../src/server/reindex.js";
import { createTestDb } from "./helpers/db.js";
import { makeRepo, write, commitAll } from "./helpers/git-repo.js";

let root: string;
let outside: string;
let db: Database.Database;
const indexed = () => (db.prepare(`SELECT path FROM files ORDER BY path`).all() as { path: string }[]).map((r) => path.relative(root, r.path));

beforeEach(() => {
  root = makeRepo("cc-gate-");
  outside = realpathSync(mkdtempSync(path.join(tmpdir(), "cc-gate-out-")));
  writeFileSync(path.join(outside, "secret.ts"), "export const secret = 1;\n");
  process.env.CODE_CONTEXT_ALLOWED_ROOTS = root;
  db = createTestDb();
  write(root, "src/a.ts", "export const a = 1;\n");
  write(root, "node_modules/lib/index.js", "export const lib = 1;\n");
  write(root, "vendor/pkg/A.php", "<?php\n");
});
afterEach(() => {
  delete process.env.CODE_CONTEXT_ALLOWED_ROOTS;
  db.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("admitFile: one gate for every index write", () => {
  it("normalises ../ and ./ before judging", () => {
    expect(admitFile(path.join(root, "vendor/../src/a.ts"), root).ok).toBe(true); // it IS src/a.ts
    expect(admitFile(`${root}/./node_modules/lib/index.js`, root)).toEqual({ ok: false, reason: "denied" });
    expect(admitFile(`${root}/src/../vendor/pkg/A.php`, root)).toEqual({ ok: false, reason: "denied" });
    expect(admitFile(`${root}/src/../../${path.basename(outside)}/secret.ts`, root)).toEqual({ ok: false, reason: "outside" });
  });

  it("matches deny names case-insensitively (APFS)", () => {
    write(root, "Node_Modules/x/i.js", "1\n");
    write(root, "VENDOR/y/B.php", "<?php\n");
    write(root, "Package-Lock.json", "{}\n");
    expect(admitFile(path.join(root, "Node_Modules/x/i.js"), root).ok).toBe(false);
    expect(admitFile(path.join(root, "VENDOR/y/B.php"), root).ok).toBe(false);
    expect(admitFile(path.join(root, "Package-Lock.json"), root).ok).toBe(false);
  });

  it("refuses symlinked files and files under symlinked dirs that resolve outside or into a denied dir", () => {
    symlinkSync(path.join(outside, "secret.ts"), path.join(root, "src/link.ts"));
    symlinkSync(outside, path.join(root, "src/out"));
    symlinkSync(path.join(root, "node_modules/lib"), path.join(root, "src/lib"));
    expect(admitFile(path.join(root, "src/link.ts"), root)).toEqual({ ok: false, reason: "not-file" });
    expect(admitFile(path.join(root, "src/out/secret.ts"), root)).toEqual({ ok: false, reason: "outside" });
    expect(admitFile(path.join(root, "src/lib/index.js"), root)).toEqual({ ok: false, reason: "denied" });
  });
});

describe("every entry point goes through the gate", () => {
  const plant = () => {
    write(root, "Node_Modules/x/i.js", "1\n");
    symlinkSync(outside, path.join(root, "src/out"));
    symlinkSync(path.join(root, "node_modules/lib"), path.join(root, "src/lib"));
    commitAll(root);
  };

  it("index_directory (git listing)", () => {
    plant();
    indexDirectory(db, root);
    expect(indexed()).toEqual(["src/a.ts"]);
  });

  it("index_directory (plain walk, no git)", () => {
    const plain = realpathSync(mkdtempSync(path.join(tmpdir(), "cc-plain-")));
    try {
      write(plain, "a.ts", "1\n");
      write(plain, "Node_Modules/x.js", "1\n");
      symlinkSync(outside, path.join(plain, "out"));
      expect(listIndexableFiles(plain).map((f) => path.relative(plain, f))).toEqual(["a.ts"]);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  it("refreshFiles / read-time guard", () => {
    plant();
    indexDirectory(db, root);
    const sneaky = [
      path.join(root, "src/out/secret.ts"),
      path.join(root, "src/lib/index.js"),
      `${root}/src/../node_modules/lib/index.js`,
      path.join(root, "Node_Modules/x/i.js"),
    ];
    expect(refreshFiles(db, sneaky, root).reindexed).toBe(0);
    const g = new FreshnessGuard(db);
    for (const p of sneaky) expect(g.indexIfEligible(p)).toBe(false);
    expect(indexed()).toEqual(["src/a.ts"]);
  });

  it("git-diff driven refresh", () => {
    commitAll(root);
    indexDirectory(db, root);
    plant();
    const r = new FreshnessGuard(db, { repoTtlMs: 0 }).checkRepos(true);
    expect(r.reindexed).toBe(0);
    expect(indexed()).toEqual(["src/a.ts"]);
  });

  it("reindex CLI path (runReindex)", () => {
    plant();
    const s = runReindex(db, { root: path.dirname(root), repos: [root] });
    expect(s.ok).toBe(true);
    expect(indexed()).toEqual(["src/a.ts"]);
  });

  it("index_directory refuses a symlinked root that resolves outside the sandbox", () => {
    const link = path.join(root, "escape");
    symlinkSync(outside, link);
    expect(() => indexDirectory(db, link)).toThrow(/Refusing to index/);
  });
});
