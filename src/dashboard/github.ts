/**
 * GitHub integration layer.
 *
 * Data is pushed into SQLite via POST /api/github/sync (called from the
 * sync_github_data MCP tool) and read by the frontend through GET /api/github/* endpoints.
 */

import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";

function sanitize(str: string | null | undefined, maxLen = 500): string | null {
  if (str == null) return null;
  return str.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return map[c] ?? c;
  }).slice(0, maxLen);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GithubRepo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  default_branch: string;
  html_url: string;
  updated_at: string;
}

export interface GithubIssue {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GithubPullRequest {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  head_branch: string;
  base_branch: string;
  mergeable: boolean | null;
  review_status: string | null;
  ci_status: string | null;
  draft: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GithubCommit {
  sha: string;
  repo_id: number;
  message: string;
  author: string;
  date: string;
}

export interface GithubSyncPayload {
  repos?: GithubRepo[];
  issues?: GithubIssue[];
  pullRequests?: GithubPullRequest[];
  commits?: GithubCommit[];
}

// ─── Schema ─────────────────────────────────────────────────────────────────

export function ensureGithubTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS github_repos (
      id INTEGER PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      description TEXT,
      stars INTEGER DEFAULT 0,
      forks INTEGER DEFAULT 0,
      language TEXT,
      default_branch TEXT,
      html_url TEXT,
      updated_at TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS github_issues (
      id INTEGER PRIMARY KEY,
      repo_id INTEGER NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      state TEXT NOT NULL,
      author TEXT,
      labels TEXT,
      assignees TEXT,
      milestone TEXT,
      html_url TEXT,
      created_at TEXT,
      updated_at TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS github_pull_requests (
      id INTEGER PRIMARY KEY,
      repo_id INTEGER NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      state TEXT NOT NULL,
      author TEXT,
      head_branch TEXT,
      base_branch TEXT,
      mergeable INTEGER,
      review_status TEXT,
      ci_status TEXT,
      draft INTEGER DEFAULT 0,
      html_url TEXT,
      created_at TEXT,
      updated_at TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS github_commits (
      sha TEXT PRIMARY KEY,
      repo_id INTEGER NOT NULL,
      message TEXT,
      author TEXT,
      date TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_github_issues_repo ON github_issues(repo_id);
    CREATE INDEX IF NOT EXISTS idx_github_issues_state ON github_issues(state);
    CREATE INDEX IF NOT EXISTS idx_github_prs_repo ON github_pull_requests(repo_id);
    CREATE INDEX IF NOT EXISTS idx_github_prs_state ON github_pull_requests(state);
    CREATE INDEX IF NOT EXISTS idx_github_commits_repo ON github_commits(repo_id);
  `);
}

// ─── Sync ───────────────────────────────────────────────────────────────────

export function syncGithubData(db: Database.Database, payload: GithubSyncPayload): { ok: boolean; synced: string[]; counts: Record<string, number> } {
  const synced: string[] = [];
  const counts: Record<string, number> = { repos: 0, issues: 0, prs: 0, commits: 0 };

  const upsertRepo = db.prepare(`INSERT INTO github_repos (id, owner, name, full_name, description, stars, forks, language, default_branch, html_url, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, name=excluded.name, full_name=excluded.full_name, description=excluded.description, stars=excluded.stars, forks=excluded.forks, language=excluded.language, default_branch=excluded.default_branch, html_url=excluded.html_url, updated_at=excluded.updated_at, synced_at=datetime('now')`);

  const upsertIssue = db.prepare(`INSERT INTO github_issues (id, repo_id, number, title, body, state, author, labels, assignees, milestone, html_url, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET repo_id=excluded.repo_id, number=excluded.number, title=excluded.title, body=excluded.body, state=excluded.state, author=excluded.author, labels=excluded.labels, assignees=excluded.assignees, milestone=excluded.milestone, html_url=excluded.html_url, created_at=excluded.created_at, updated_at=excluded.updated_at, synced_at=datetime('now')`);

  const upsertPR = db.prepare(`INSERT INTO github_pull_requests (id, repo_id, number, title, body, state, author, head_branch, base_branch, mergeable, review_status, ci_status, draft, html_url, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET repo_id=excluded.repo_id, number=excluded.number, title=excluded.title, body=excluded.body, state=excluded.state, author=excluded.author, head_branch=excluded.head_branch, base_branch=excluded.base_branch, mergeable=excluded.mergeable, review_status=excluded.review_status, ci_status=excluded.ci_status, draft=excluded.draft, html_url=excluded.html_url, created_at=excluded.created_at, updated_at=excluded.updated_at, synced_at=datetime('now')`);

  const upsertCommit = db.prepare(`INSERT INTO github_commits (sha, repo_id, message, author, date, synced_at) VALUES (?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(sha) DO UPDATE SET repo_id=excluded.repo_id, message=excluded.message, author=excluded.author, date=excluded.date, synced_at=datetime('now')`);

  const tx = db.transaction(() => {
    if (payload.repos?.length) {
      for (const r of payload.repos) {
        upsertRepo.run(r.id, sanitize(r.owner, 200), sanitize(r.name, 200), sanitize(r.full_name, 200), sanitize(r.description, 2000), r.stars ?? 0, r.forks ?? 0, sanitize(r.language, 100), sanitize(r.default_branch, 200), r.html_url, r.updated_at);
      }
      counts.repos = payload.repos.length;
      synced.push("repos");
    }
    if (payload.issues?.length) {
      for (const i of payload.issues) {
        upsertIssue.run(i.id, i.repo_id, i.number, sanitize(i.title, 300), sanitize(i.body, 2000), i.state, sanitize(i.author, 200), JSON.stringify((i.labels || []).map(l => sanitize(l, 100))), JSON.stringify((i.assignees || []).map(a => sanitize(a, 200))), sanitize(i.milestone, 200), i.html_url, i.created_at, i.updated_at);
      }
      counts.issues = payload.issues.length;
      synced.push("issues");
    }
    if (payload.pullRequests?.length) {
      for (const p of payload.pullRequests) {
        upsertPR.run(p.id, p.repo_id, p.number, sanitize(p.title, 300), sanitize(p.body, 2000), p.state, sanitize(p.author, 200), sanitize(p.head_branch, 200), sanitize(p.base_branch, 200), p.mergeable === null ? null : p.mergeable ? 1 : 0, p.review_status, p.ci_status, p.draft ? 1 : 0, p.html_url, p.created_at, p.updated_at);
      }
      counts.prs = payload.pullRequests.length;
      synced.push("pullRequests");
    }
    if (payload.commits?.length) {
      for (const c of payload.commits) {
        upsertCommit.run(c.sha, c.repo_id, sanitize(c.message, 500), sanitize(c.author, 200), c.date);
      }
      counts.commits = payload.commits.length;
      synced.push("commits");
    }
  });
  tx();
  return { ok: true, synced, counts };
}

// ─── Query functions ────────────────────────────────────────────────────────

export function getGithubRepos(db: Database.Database): GithubRepo[] {
  return db.prepare(`SELECT * FROM github_repos ORDER BY updated_at DESC`).all() as GithubRepo[];
}

export function getGithubIssues(db: Database.Database, repoId?: number): GithubIssue[] {
  let sql = `SELECT * FROM github_issues`;
  const params: any[] = [];
  if (repoId != null) { sql += ` WHERE repo_id = ?`; params.push(repoId); }
  sql += ` ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(r => ({ ...r, labels: r.labels ? JSON.parse(r.labels) : [], assignees: r.assignees ? JSON.parse(r.assignees) : [] }));
}

export function getGithubPRs(db: Database.Database, repoId?: number): GithubPullRequest[] {
  let sql = `SELECT * FROM github_pull_requests`;
  const params: any[] = [];
  if (repoId != null) { sql += ` WHERE repo_id = ?`; params.push(repoId); }
  sql += ` ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(r => ({ ...r, mergeable: r.mergeable === null ? null : r.mergeable === 1, draft: r.draft === 1 }));
}

export function getGithubCommits(db: Database.Database, repoId?: number): GithubCommit[] {
  let sql = `SELECT * FROM github_commits`;
  const params: any[] = [];
  if (repoId != null) { sql += ` WHERE repo_id = ?`; params.push(repoId); }
  sql += ` ORDER BY date DESC`;
  return db.prepare(sql).all(...params) as GithubCommit[];
}

export function getGithubSyncStatus(db: Database.Database): { synced: boolean; repoCount: number; issueCount: number; prCount: number; commitCount: number; syncedAt: string | null } {
  const repoCount = (db.prepare(`SELECT COUNT(*) as c FROM github_repos`).get() as any).c;
  const issueCount = (db.prepare(`SELECT COUNT(*) as c FROM github_issues`).get() as any).c;
  const prCount = (db.prepare(`SELECT COUNT(*) as c FROM github_pull_requests`).get() as any).c;
  const commitCount = (db.prepare(`SELECT COUNT(*) as c FROM github_commits`).get() as any).c;
  const latestSync = db.prepare(`SELECT MAX(synced_at) as t FROM (SELECT MAX(synced_at) as synced_at FROM github_repos UNION ALL SELECT MAX(synced_at) FROM github_issues UNION ALL SELECT MAX(synced_at) FROM github_pull_requests UNION ALL SELECT MAX(synced_at) FROM github_commits)`).get() as any;
  return { synced: repoCount > 0 || issueCount > 0, repoCount, issueCount, prCount, commitCount, syncedAt: latestSync?.t ?? null };
}

// ─── Configuration ──────────────────────────────────────────────────────────

export function isGithubConfigured(): boolean {
  if (process.env.GITHUB_TOKEN?.trim()) return true;
  try {
    const { execSync } = require("child_process");
    const token = execSync("gh auth token", { encoding: "utf-8", timeout: 3000 }).trim();
    return token.length > 0;
  } catch { return false; }
}

// ─── Local Config ──────────────────────────────────────────────────────────

export interface GithubLocalConfig {
  owner: string;
  repo: string;
  token?: string;
  autoSync?: boolean;
  syncIntervalMinutes?: number;
}

const CONFIG_FILENAME = ".github.local.json";

function resolveConfigPath(dbPath: string): string {
  return path.resolve(path.dirname(dbPath), CONFIG_FILENAME);
}

export function loadGithubConfig(dbPath: string): GithubLocalConfig | null {
  const configPath = resolveConfigPath(dbPath);
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.owner || !parsed.repo) return null;
    return {
      owner: String(parsed.owner),
      repo: String(parsed.repo),
      token: parsed.token ? String(parsed.token) : undefined,
      autoSync: parsed.autoSync !== false,
      syncIntervalMinutes: Math.max(1, Number(parsed.syncIntervalMinutes) || 5),
    };
  } catch {
    return null;
  }
}

export function saveGithubConfig(dbPath: string, config: GithubLocalConfig): void {
  const configPath = resolveConfigPath(dbPath);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

// ─── Server-side GitHub fetch (reusable by auto-sync + trigger endpoint) ───

function getGithubToken(configToken?: string): string | null {
  if (configToken?.trim()) return configToken.trim();
  if (process.env.GITHUB_TOKEN?.trim()) return process.env.GITHUB_TOKEN.trim();
  try {
    const { execFileSync } = require("child_process");
    return execFileSync("gh", ["auth", "token"], { encoding: "utf-8", timeout: 5000 }).trim() || null;
  } catch { return null; }
}

export async function fetchAndSyncGithub(
  db: Database.Database,
  owner: string,
  repo: string,
  configToken?: string,
): Promise<{ ok: boolean; error?: string; counts?: Record<string, number> }> {
  const token = getGithubToken(configToken);
  if (!token) return { ok: false, error: "No GitHub token. Set GITHUB_TOKEN or run `gh auth login`." };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "vlm-mcp-server",
  };

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      const msg = repoRes.status === 401 ? "Invalid GITHUB_TOKEN" : repoRes.status === 404 ? `Repository ${owner}/${repo} not found` : `GitHub API error: ${repoRes.status}`;
      return { ok: false, error: msg };
    }
    const repoData = await repoRes.json() as any;
    const repoId = repoData.id;

    const repos = [{
      id: repoData.id, owner: repoData.owner?.login ?? owner, name: repoData.name,
      full_name: repoData.full_name, description: repoData.description,
      stars: repoData.stargazers_count ?? 0, forks: repoData.forks_count ?? 0,
      language: repoData.language, default_branch: repoData.default_branch,
      html_url: repoData.html_url, updated_at: repoData.updated_at,
    }];

    const issueRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`, { headers });
    const issueData = issueRes.ok ? await issueRes.json() as any[] : [];
    const issues = issueData.filter((i: any) => !i.pull_request).map((i: any) => ({
      id: i.id, repo_id: repoId, number: i.number, title: i.title,
      body: i.body, state: i.state, author: i.user?.login ?? "",
      labels: (i.labels || []).map((l: any) => l.name),
      assignees: (i.assignees || []).map((a: any) => a.login),
      milestone: i.milestone?.title ?? null,
      html_url: i.html_url, created_at: i.created_at, updated_at: i.updated_at,
    }));

    const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=100`, { headers });
    const prData = prRes.ok ? await prRes.json() as any[] : [];
    const pullRequests = prData.map((p: any) => ({
      id: p.id, repo_id: repoId, number: p.number, title: p.title,
      body: p.body, state: p.state, author: p.user?.login ?? "",
      head_branch: p.head?.ref ?? "", base_branch: p.base?.ref ?? "",
      mergeable: p.mergeable ?? null, review_status: null,
      ci_status: null, draft: p.draft ?? false,
      html_url: p.html_url, created_at: p.created_at, updated_at: p.updated_at,
    }));

    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=50`, { headers });
    const commitData = commitRes.ok ? await commitRes.json() as any[] : [];
    const commits = commitData.map((c: any) => ({
      sha: c.sha, repo_id: repoId, message: c.commit?.message ?? "",
      author: c.commit?.author?.name ?? c.author?.login ?? "",
      date: c.commit?.author?.date ?? "",
    }));

    const result = syncGithubData(db, { repos, issues, pullRequests, commits });
    return { ok: true, counts: result.counts };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── Auto-sync timer ───────────────────────────────────────────────────────

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

export function startGithubAutoSync(
  db: Database.Database,
  dbPath: string,
  onSync: () => void,
): void {
  stopGithubAutoSync();
  const config = loadGithubConfig(dbPath);
  if (!config?.autoSync) return;

  const intervalMs = (config.syncIntervalMinutes ?? 5) * 60_000;
  console.log(`[github] Auto-sync enabled for ${config.owner}/${config.repo} every ${config.syncIntervalMinutes ?? 5}m`);

  // Immediate first sync
  fetchAndSyncGithub(db, config.owner, config.repo, config.token).then((r) => {
    if (r.ok) {
      console.log(`[github] Initial sync: ${JSON.stringify(r.counts)}`);
      onSync();
    } else {
      console.warn(`[github] Initial sync failed: ${r.error}`);
    }
  });

  autoSyncTimer = setInterval(async () => {
    const freshConfig = loadGithubConfig(dbPath);
    if (!freshConfig?.autoSync) { stopGithubAutoSync(); return; }
    const r = await fetchAndSyncGithub(db, freshConfig.owner, freshConfig.repo, freshConfig.token);
    if (r.ok) {
      console.log(`[github] Auto-sync: ${JSON.stringify(r.counts)}`);
      onSync();
    } else {
      console.warn(`[github] Auto-sync failed: ${r.error}`);
    }
  }, intervalMs);
}

export function stopGithubAutoSync(): void {
  if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
}
