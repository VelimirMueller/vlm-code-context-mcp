import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { rmSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { listIndexableFiles } from "../src/server/indexer.js";
import { readGitHead, gitChangedFiles, gitIsIgnored } from "../src/server/git.js";
import { makeRepo, write, commitAll, git } from "./helpers/git-repo.js";

const roots: string[] = [];
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });
const repo = () => { const r = makeRepo(); roots.push(r); return r; };

describe("listIndexableFiles in a git checkout", () => {
  it("honours nested .gitignore files and the hard deny list", () => {
    const r = repo();
    write(r, "src/a.ts", "export const a = 1;\n");
    write(r, "src/gen/.gitignore", "*.generated.ts\n");
    write(r, "src/gen/x.generated.ts", "export const x = 1;\n");
    write(r, "src/gen/keep.ts", "export const k = 1;\n");
    write(r, "node_modules/lib/index.js", "module.exports = 1;\n"); // not gitignored, still denied
    write(r, "vendor/pkg/A.php", "<?php\n");
    write(r, "package-lock.json", "{}\n");
    write(r, "public/app.min.js", "x\n");
    commitAll(r);
    write(r, "untracked.md", "# new\n");
    const rel = listIndexableFiles(r).map(f => path.relative(r, f));
    expect(rel).toEqual(["src/a.ts", "src/gen/keep.ts", "untracked.md"]);
  });

  it("descends into nested checkouts (submodules) with their own ignore rules", () => {
    const r = repo();
    write(r, "a.ts", "export const a = 1;\n");
    commitAll(r);
    const inner = path.join(r, "sub");
    git(r, "init", "-q", "sub");
    write(inner, ".gitignore", "secret.ts\n");
    write(inner, "b.ts", "export const b = 1;\n");
    write(inner, "secret.ts", "export const s = 1;\n");
    const rel = listIndexableFiles(r).map(f => path.relative(r, f));
    expect(rel).toContain("sub/b.ts");
    expect(rel).not.toContain("sub/secret.ts");
  });

  it("skips files deleted from the working tree but still in the git index", () => {
    const r = repo();
    write(r, "a.ts", "1\n");
    write(r, "b.ts", "2\n");
    commitAll(r);
    unlinkSync(path.join(r, "b.ts"));
    expect(listIndexableFiles(r).map(f => path.basename(f))).toEqual(["a.ts"]);
  });
});

describe("git helpers", () => {
  it("readGitHead follows loose refs, packed refs and detached HEAD without spawning git", () => {
    const r = repo();
    write(r, "a.ts", "1\n");
    const first = commitAll(r);
    expect(readGitHead(r)).toBe(first);
    git(r, "pack-refs", "--all");
    expect(readFileSync(path.join(r, ".git/packed-refs"), "utf-8")).toContain(first);
    expect(readGitHead(r)).toBe(first);
    write(r, "a.ts", "2\n");
    const second = commitAll(r);
    git(r, "checkout", "-q", first);
    expect(readGitHead(r)).toBe(first);
    git(r, "checkout", "-q", "main");
    expect(readGitHead(r)).toBe(second);
  });

  it("readGitHead resolves a linked worktree through its .git file and commondir", () => {
    const r = repo();
    write(r, "a.ts", "1\n");
    const head = commitAll(r);
    git(r, "worktree", "add", "-q", "-b", "wt", path.join(r, ".worktrees/wt"));
    expect(readGitHead(path.join(r, ".worktrees/wt"))).toBe(head);
  });

  it("gitChangedFiles lists absolute paths and returns null for an unknown commit", () => {
    const r = repo();
    write(r, "a.ts", "1\n");
    const a = commitAll(r);
    write(r, "b.ts", "2\n");
    const b = commitAll(r);
    expect(gitChangedFiles(r, a, b)).toEqual([path.join(r, "b.ts")]);
    expect(gitChangedFiles(r, "deadbeef".repeat(5), b)).toBeNull();
  });

  it("gitIsIgnored reports .gitignore matches", () => {
    const r = repo();
    writeFileSync(path.join(r, ".gitignore"), "*.log\n");
    write(r, "x.log", "1\n");
    expect(gitIsIgnored(r, path.join(r, "x.log"))).toBe(true);
    expect(gitIsIgnored(r, path.join(r, "x.ts"))).toBe(false);
  });
});
