import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { rmSync, unlinkSync, utimesSync } from "node:fs";
import Database from "better-sqlite3";
import { indexDirectory } from "../src/server/indexer.js";
import { FreshnessGuard, freshnessNotice, type FreshRow } from "../src/server/freshness.js";
import { createTestDb } from "./helpers/db.js";
import { makeRepo, write, commitAll } from "./helpers/git-repo.js";

let root: string;
let db: Database.Database;
let clock = 0;
const guard = (maxDiffFiles = 500) => new FreshnessGuard(db, { repoTtlMs: 1000, maxDiffFiles, now: () => clock });
const row = (p: string) =>
  db.prepare(`SELECT path, size_bytes, modified_at, content, indexed_at FROM files WHERE path = ?`).get(p) as
    | (FreshRow & { content: string })
    | undefined;
const exportsOf = (p: string) =>
  (db.prepare(`SELECT e.name FROM exports e JOIN files f ON f.id = e.file_id WHERE f.path = ? ORDER BY e.name`).all(p) as { name: string }[]).map(r => r.name);
const headOf = () => (db.prepare(`SELECT head FROM indexed_repos WHERE root = ?`).get(root) as { head: string }).head;
const bumpMtime = (p: string) => { const t = new Date(Date.now() + 5_000); utimesSync(p, t, t); };

beforeEach(() => {
  root = makeRepo("cc-fresh-");
  process.env.CODE_CONTEXT_ALLOWED_ROOTS = root;
  db = createTestDb();
  clock = 0;
});
afterEach(() => {
  delete process.env.CODE_CONTEXT_ALLOWED_ROOTS;
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("FreshnessGuard.checkFiles (per file, every call)", () => {
  it("re-indexes a file whose content changed on disk", () => {
    const a = write(root, "a.ts", "export const one = 1;\n");
    commitAll(root);
    indexDirectory(db, root);
    write(root, "a.ts", "export const one = 1;\nexport function two() {}\n");
    bumpMtime(a);
    const r = guard().checkFiles([row(a)!]);
    expect(r).toEqual({ changed: true, reindexed: 1, dropped: 0 });
    expect(exportsOf(a)).toEqual(["one", "two"]);
    expect(row(a)!.content).toContain("two");
    const change = db.prepare(`SELECT event FROM changes WHERE file_path = ? ORDER BY id DESC LIMIT 1`).get(a) as { event: string };
    expect(change.event).toBe("change");
  });

  it("drops a file deleted from disk", () => {
    const a = write(root, "a.ts", "export const a = 1;\n");
    commitAll(root);
    indexDirectory(db, root);
    const before = row(a)!;
    unlinkSync(a);
    expect(guard().checkFiles([before])).toEqual({ changed: true, reindexed: 0, dropped: 1 });
    expect(row(a)).toBeUndefined();
  });

  it("does nothing for unchanged files", () => {
    const a = write(root, "a.ts", "export const a = 1;\n");
    commitAll(root);
    indexDirectory(db, root);
    expect(guard().checkFiles([row(a)!]).changed).toBe(false);
  });
});

describe("FreshnessGuard.checkRepos (per repo HEAD)", () => {
  it("records HEAD at index time", () => {
    write(root, "a.ts", "export const a = 1;\n");
    const head = commitAll(root);
    indexDirectory(db, root);
    expect(headOf()).toBe(head);
  });

  it("re-indexes exactly the files git diff lists when HEAD moved, warns once, then is clean", () => {
    const a = write(root, "a.ts", "export const a = 1;\n");
    const b = write(root, "b.ts", "export const b = 1;\n");
    commitAll(root);
    indexDirectory(db, root);
    write(root, "a.ts", "export const renamedA = 1;\n");
    unlinkSync(b);
    const c = write(root, "c.ts", "export const c = 1;\n");
    const head = commitAll(root);

    const g = guard();
    const r = g.checkRepos();
    expect(r.reindexed).toBe(2);
    expect(r.dropped).toBe(1);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/^⚠ STALE cc-fresh-.*: HEAD [0-9a-f]{7}→[0-9a-f]{7} — re-indexed 2 changed files, dropped 1/);
    expect(exportsOf(a)).toEqual(["renamedA"]);
    expect(row(b)).toBeUndefined();
    expect(exportsOf(c)).toEqual(["c"]);
    expect(headOf()).toBe(head);

    clock += 5000;
    expect(g.checkRepos().warnings).toEqual([]);
  });

  it("over the bound: warns on every call, does not re-index, keeps the old HEAD", () => {
    write(root, "a.ts", "1\n");
    const old = commitAll(root);
    indexDirectory(db, root);
    write(root, "b.ts", "2\n");
    write(root, "c.ts", "3\n");
    commitAll(root);
    const g = guard(1);
    const first = g.checkRepos();
    expect(first.reindexed).toBe(0);
    expect(first.warnings[0]).toContain("2 files changed (> 1)");
    expect(first.warnings[0]).toContain(`code-context-reindex.sh ${root}`);
    expect(g.checkRepos().warnings).toEqual(first.warnings); // inside TTL: cached warning
    clock += 5000;
    expect(g.checkRepos().warnings).toEqual(first.warnings); // after TTL: still stale
    expect(headOf()).toBe(old);
    expect(row(path.join(root, "b.ts"))).toBeUndefined();
  });

  it("is throttled: inside the TTL it does not read HEAD again", () => {
    write(root, "a.ts", "1\n");
    commitAll(root);
    indexDirectory(db, root);
    const g = guard();
    expect(g.checkRepos().warnings).toEqual([]);
    write(root, "b.ts", "2\n");
    commitAll(root);
    expect(g.checkRepos().warnings).toEqual([]); // still within TTL
    clock += 1500;
    expect(g.checkRepos().warnings).toHaveLength(1);
  });
});

describe("FreshnessGuard.indexIfEligible", () => {
  it("indexes a new file inside an indexed repo, never an ignored or denied one", () => {
    write(root, ".gitignore", "*.log\n");
    write(root, "a.ts", "1\n");
    commitAll(root);
    indexDirectory(db, root);
    const g = guard();
    const n = write(root, "new.ts", "export const fresh = 1;\n");
    const log = write(root, "x.log", "noise\n");
    const dep = write(root, "node_modules/p/i.js", "x\n");
    expect(g.indexIfEligible(n)).toBe(true);
    expect(exportsOf(n)).toEqual(["fresh"]);
    expect(g.indexIfEligible(log)).toBe(false);
    expect(g.indexIfEligible(dep)).toBe(false);
    expect(g.indexIfEligible("/definitely/not/indexed.ts")).toBe(false);
  });
});

describe("freshnessNotice", () => {
  it("is empty when nothing happened and one line per event otherwise", () => {
    expect(freshnessNotice({ warnings: [], reindexed: 0, dropped: 0 })).toBe("");
    expect(freshnessNotice({ warnings: ["⚠ STALE x"], reindexed: 0, dropped: 0 }, { reindexed: 2, dropped: 1 }))
      .toBe("⚠ STALE x\n↻ fresh: re-indexed 2 changed files, dropped 1 deleted before answering\n\n");
  });
});

describe("indexDirectory with the new policy", () => {
  it("prunes rows that a .gitignore now excludes (untracked files; tracked ones stay, as in git)", () => {
    const a = write(root, "a.ts", "1\n");
    commitAll(root);
    const gen = write(root, "gen.ts", "2\n");
    indexDirectory(db, root);
    expect(row(gen)).toBeDefined();
    write(root, ".gitignore", "gen.ts\n");
    const stats = indexDirectory(db, root);
    expect(stats.prunedFiles).toBe(1);
    expect(row(gen)).toBeUndefined();
    expect(row(a)).toBeDefined();
  });
});
