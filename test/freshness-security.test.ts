import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { indexDirectory, refreshFiles } from "../src/server/indexer.js";
import { FreshnessGuard } from "../src/server/freshness.js";
import { gitChangedFiles, readGitHead } from "../src/server/git.js";
import { createTestDb } from "./helpers/db.js";
import { makeRepo, write, commitAll } from "./helpers/git-repo.js";

let root: string;
let outside: string;
let db: Database.Database;
const paths = () => (db.prepare(`SELECT path FROM files ORDER BY path`).all() as { path: string }[]).map((r) => r.path);
const contentOf = (p: string) => (db.prepare(`SELECT content FROM files WHERE path = ?`).get(p) as { content: string } | undefined)?.content;

beforeEach(() => {
  root = makeRepo("cc-sec-");
  outside = realpathSync(mkdtempSync(path.join(tmpdir(), "cc-outside-")));
  writeFileSync(path.join(outside, "id_rsa"), "PRIVATE KEY\n");
  process.env.CODE_CONTEXT_ALLOWED_ROOTS = root;
  db = createTestDb();
});
afterEach(() => {
  delete process.env.CODE_CONTEXT_ALLOWED_ROOTS;
  db.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("git command injection", () => {
  it("refuses refs that are not full hex SHAs and never runs them", () => {
    write(root, "a.ts", "1\n");
    const head = commitAll(root);
    const marker = path.join(outside, "pwned");
    for (const bad of [`HEAD;touch ${marker}`, "HEAD", "$(touch x)", "--output=/tmp/x", head.slice(0, 7), `${head} ; rm -rf /`]) {
      expect(gitChangedFiles(root, bad, head)).toBeNull();
      expect(gitChangedFiles(root, head, bad)).toBeNull();
    }
    expect(existsSync(marker)).toBe(false);
  });

  it("a HEAD file whose ref escapes the git dir is not followed", () => {
    write(root, "a.ts", "1\n");
    commitAll(root);
    writeFileSync(path.join(root, ".git/HEAD"), "ref: refs/../../../../etc/passwd\n");
    expect(readGitHead(root)).toBeNull();
    writeFileSync(path.join(root, ".git/HEAD"), "ref: /etc/passwd\n");
    expect(readGitHead(root)).toBeNull();
  });
});

describe("path traversal and symlinks", () => {
  it("a ../ path out of the repo is never read or indexed", () => {
    write(root, "a.ts", "1\n");
    commitAll(root);
    indexDirectory(db, root);
    const traversal = path.join(root, "../", path.basename(outside), "id_rsa");
    expect(refreshFiles(db, [traversal], root)).toEqual({ reindexed: 0, dropped: 0 });
    expect(new FreshnessGuard(db).indexIfEligible(path.join(root, "../../.ssh/id_rsa"))).toBe(false);
    expect(new FreshnessGuard(db).indexIfEligible(traversal)).toBe(false);
    expect(paths().some((p) => p.includes("id_rsa"))).toBe(false);
  });

  it("a symlinked file pointing outside the repo is dropped, never read", () => {
    write(root, "a.ts", "1\n");
    commitAll(root);
    indexDirectory(db, root);
    const link = path.join(root, "key.ts");
    symlinkSync(path.join(outside, "id_rsa"), link);
    expect(refreshFiles(db, [link], root).reindexed).toBe(0);
    expect(new FreshnessGuard(db).indexIfEligible(link)).toBe(false);
    expect(contentOf(link)).toBeUndefined();
  });

  it("a file under a symlinked DIRECTORY pointing outside is dropped (realpath check)", () => {
    write(root, "a.ts", "1\n");
    commitAll(root);
    indexDirectory(db, root);
    symlinkSync(outside, path.join(root, "linked"));
    const viaLink = path.join(root, "linked", "id_rsa");
    // Even a pre-existing row (planted by an older version) is dropped, not refreshed.
    db.prepare(`INSERT INTO files (path, size_bytes, modified_at) VALUES (?, 1, 'x')`).run(viaLink);
    const r = refreshFiles(db, [viaLink], root);
    expect(r).toEqual({ reindexed: 0, dropped: 1 });
    expect(contentOf(viaLink)).toBeUndefined();
    expect(paths()).not.toContain(viaLink);
  });

  it("paths from git diff go through the same containment (symlink committed into the repo)", () => {
    write(root, "a.ts", "1\n");
    commitAll(root);
    indexDirectory(db, root);
    symlinkSync(path.join(outside, "id_rsa"), path.join(root, "evil.ts"));
    commitAll(root);
    const r = new FreshnessGuard(db, { repoTtlMs: 0 }).checkRepos(true);
    expect(r.reindexed).toBe(0);
    expect(paths().some((p) => p.endsWith("evil.ts"))).toBe(false);
  });
});

describe("transient read errors keep the row", () => {
  it("an unreadable (EACCES) file is not dropped from the index", () => {
    if (process.getuid?.() === 0) return; // root ignores file modes
    const a = write(root, "a.ts", "export const a = 1;\n");
    commitAll(root);
    indexDirectory(db, root);
    mkdirSync(path.join(root, "x"));
    chmodSync(a, 0o000);
    try {
      expect(refreshFiles(db, [a], root)).toEqual({ reindexed: 0, dropped: 0 });
      expect(contentOf(a)).toContain("export const a");
    } finally {
      chmodSync(a, 0o644);
    }
  });
});
