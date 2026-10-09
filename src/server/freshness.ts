/**
 * Read-time freshness guard.
 *
 * The pipeline tells Claude to ask code-context BEFORE reading files, so a stale
 * row is worse than no row: it silently steers specs and builds. On 2026-10-09
 * the last full index was a month old. This guard makes every file-returning
 * tool check what it is about to return, and fix it first:
 *
 * 1. Per file (every call): stat each result row. Gone → drop the row. Size or
 *    mtime differ from what was indexed → re-index that file. Then the tool
 *    re-runs its query, so the answer reflects the disk.
 * 2. Per repo (throttled, default every 2 s): read each indexed repo's HEAD
 *    straight from .git (no process spawn). If it moved since the repo was
 *    indexed, re-index exactly the files `git diff --name-only old..new` lists
 *    and say so in one line. Over `maxDiffFiles` (500) it does not block the
 *    call: it warns, every call, until someone runs a full reindex.
 *
 * What it does not see: uncommitted edits to files the query did not return,
 * and new untracked files. The watcher (dashboard) and the reindex CLI cover
 * those; the guard covers everything a response actually shows.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { readGitHead, gitChangedFiles, gitIsIgnored } from "./git.js";
import { refreshFiles, toISOLocal, isPathInside } from "./indexer.js";
import { isDeniedPath } from "./index-policy.js";

export interface FreshRow {
  path: string;
  size_bytes: number | null;
  modified_at: string | null;
}

export interface FreshnessOptions {
  /** Minimum time between two per-repo HEAD sweeps. */
  repoTtlMs?: number;
  /** Above this many changed files a moved HEAD only warns. */
  maxDiffFiles?: number;
  now?: () => number;
}

export interface RepoCheck {
  /** One line per repo whose index is behind its HEAD (or was just caught up). */
  warnings: string[];
  reindexed: number;
  dropped: number;
}

interface RepoRow {
  root: string;
  head: string | null;
}

const short = (sha: string): string => sha.slice(0, 7);

export class FreshnessGuard {
  private readonly ttl: number;
  private readonly maxDiff: number;
  private readonly now: () => number;
  private lastSweep = -Infinity;
  private roots: RepoRow[] = [];
  /** root → { head the warning is about, the warning } for HEAD moves we could not apply. */
  private readonly pending = new Map<string, { head: string; warning: string }>();
  private readonly selectRepos: Database.Statement;
  private readonly setHead: Database.Statement;

  constructor(private readonly db: Database.Database, opts: FreshnessOptions = {}) {
    this.ttl = opts.repoTtlMs ?? 2_000;
    this.maxDiff = opts.maxDiffFiles ?? 500;
    this.now = opts.now ?? Date.now;
    this.selectRepos = db.prepare(`SELECT root, head FROM indexed_repos ORDER BY length(root) DESC`);
    this.setHead = db.prepare(`UPDATE indexed_repos SET head = ?, indexed_at = datetime('now') WHERE root = ?`);
  }

  /** Longest indexed root that contains `file`, or null. */
  rootFor(file: string): string | null {
    for (let attempt = 0; attempt < 2; attempt++) {
      // A miss re-reads the table once: a root indexed since the last sweep
      // (index_directory in this process, or the CLI) is found immediately.
      if (attempt === 1 || this.roots.length === 0) {
        try { this.roots = this.selectRepos.all() as RepoRow[]; } catch { return null; }
      }
      for (const r of this.roots) if (isPathInside(file, r.root)) return r.root;
    }
    return null;
  }

  /** Per-repo HEAD sweep. Cheap when called inside the TTL: returns the open warnings only. */
  checkRepos(force = false): RepoCheck {
    const out: RepoCheck = { warnings: [], reindexed: 0, dropped: 0 };
    const t = this.now();
    if (!force && t - this.lastSweep < this.ttl) {
      for (const p of this.pending.values()) out.warnings.push(p.warning);
      return out;
    }
    this.lastSweep = t;
    try {
      this.roots = this.selectRepos.all() as RepoRow[];
    } catch {
      return out; // table missing on a foreign db: no guard rather than a broken tool
    }
    for (const repo of this.roots) {
      if (!repo.head) continue;
      const current = readGitHead(repo.root);
      if (!current || current === repo.head) {
        this.pending.delete(repo.root);
        continue;
      }
      const name = path.basename(repo.root);
      const open = this.pending.get(repo.root);
      if (open && open.head === current) {
        out.warnings.push(open.warning);
        continue;
      }
      const changed = gitChangedFiles(repo.root, repo.head, current);
      const moved = `HEAD ${short(repo.head)}→${short(current)}`;
      if (changed === null || changed.length > this.maxDiff) {
        const why = changed === null ? "cannot diff against the indexed commit" : `${changed.length} files changed (> ${this.maxDiff})`;
        const warning = `⚠ STALE ${name}: ${moved}, ${why} — results may be outdated; run code-context-reindex.sh ${repo.root}`;
        this.pending.set(repo.root, { head: current, warning });
        out.warnings.push(warning);
        continue;
      }
      const r = refreshFiles(this.db, changed, repo.root);
      this.setHead.run(current, repo.root);
      repo.head = current;
      this.pending.delete(repo.root);
      out.reindexed += r.reindexed;
      out.dropped += r.dropped;
      out.warnings.push(
        `⚠ STALE ${name}: ${moved} — re-indexed ${r.reindexed} changed file${r.reindexed === 1 ? "" : "s"}` +
          (r.dropped ? `, dropped ${r.dropped}` : "") + " before answering",
      );
    }
    return out;
  }

  /**
   * Stat every row about to be returned; re-index the changed ones and drop the
   * vanished ones. `changed: true` tells the caller to re-run its query.
   */
  checkFiles(rows: FreshRow[]): { changed: boolean; reindexed: number; dropped: number } {
    const stale = new Map<string, string[]>(); // root → paths
    for (const row of rows) {
      let st: fs.Stats | undefined;
      try {
        st = fs.statSync(row.path, { throwIfNoEntry: false });
      } catch {
        continue; // EACCES/ELOOP etc.: cannot judge — keep the row, never fail the tool call
      }
      if (st && st.size === row.size_bytes && toISOLocal(st.mtime) === row.modified_at) continue;
      const root = this.rootFor(row.path) ?? path.dirname(row.path);
      const list = stale.get(root) ?? [];
      list.push(row.path);
      stale.set(root, list);
    }
    if (stale.size === 0) return { changed: false, reindexed: 0, dropped: 0 };
    let reindexed = 0;
    let dropped = 0;
    for (const [root, paths] of stale) {
      // Only stale rows reach here (rare), so one `git check-ignore` per file
      // is affordable: a file that became git-ignored leaves the index, as a
      // full reindex would drop it.
      const r = refreshFiles(this.db, paths, root, (f) => gitIsIgnored(root, f));
      reindexed += r.reindexed;
      dropped += r.dropped;
    }
    return { changed: true, reindexed, dropped };
  }

  /**
   * A file asked for by path that is not in the index: index it now when it
   * exists, sits inside an indexed repo, passes the policy and is not ignored
   * by git. Returns true when a row was written.
   */
  indexIfEligible(file: string): boolean {
    const abs = path.resolve(file);
    const root = this.rootFor(abs);
    if (!root) return false;
    const st = fs.statSync(abs, { throwIfNoEntry: false });
    if (!st?.isFile()) return false;
    if (isDeniedPath(abs, root, st.size)) return false;
    if (gitIsIgnored(root, abs)) return false;
    return refreshFiles(this.db, [abs], root).reindexed > 0;
  }
}

/** Compose the leading notice lines for a response. Empty string when all is fresh. */
export function freshnessNotice(repo: RepoCheck, files?: { reindexed: number; dropped: number }): string {
  const lines = [...repo.warnings];
  if (files && (files.reindexed || files.dropped)) {
    const parts: string[] = [];
    if (files.reindexed) parts.push(`re-indexed ${files.reindexed} changed file${files.reindexed === 1 ? "" : "s"}`);
    if (files.dropped) parts.push(`dropped ${files.dropped} deleted`);
    lines.push(`↻ fresh: ${parts.join(", ")} before answering`);
  }
  return lines.length ? lines.join("\n") + "\n\n" : "";
}
