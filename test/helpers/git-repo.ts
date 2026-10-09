import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
};

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A fresh git repo in a temp dir (realpath'd: macOS /var → /private/var). */
export function makeRepo(prefix = "cc-repo-"): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  git(root, "init", "-q", "-b", "main");
  return root;
}

export function write(root: string, rel: string, content: string): string {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

export function commitAll(root: string, msg = "c"): string {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", msg);
  return git(root, "rev-parse", "HEAD");
}
