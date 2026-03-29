import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  ensureGithubTables,
  syncGithubData,
  getGithubRepos,
  getGithubIssues,
  getGithubPRs,
  getGithubCommits,
  getGithubSyncStatus,
} from "../src/dashboard/github.js";

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockRepo = {
  id: 12345, owner: "testuser", name: "test-repo", full_name: "testuser/test-repo",
  description: "A test repository", stars: 42, forks: 7, language: "TypeScript",
  default_branch: "main", html_url: "https://github.com/testuser/test-repo",
  updated_at: "2026-03-29T10:00:00Z",
};

const mockRepo2 = {
  id: 67890, owner: "testuser", name: "other-repo", full_name: "testuser/other-repo",
  description: "Another repo", stars: 10, forks: 2, language: "JavaScript",
  default_branch: "main", html_url: "https://github.com/testuser/other-repo",
  updated_at: "2026-03-28T10:00:00Z",
};

const mockIssue = {
  id: 100, repo_id: 12345, number: 1, title: "Bug: something broken",
  body: "Description here", state: "open", author: "alice",
  labels: ["bug", "critical"], assignees: ["alice", "bob"],
  milestone: "v1.0", html_url: "https://github.com/testuser/test-repo/issues/1",
  created_at: "2026-03-28T10:00:00Z", updated_at: "2026-03-29T10:00:00Z",
};

const mockIssue2 = {
  id: 101, repo_id: 67890, number: 5, title: "Feature request",
  body: "Add this feature", state: "closed", author: "charlie",
  labels: ["enhancement"], assignees: ["charlie"], milestone: null,
  html_url: "https://github.com/testuser/other-repo/issues/5",
  created_at: "2026-03-27T10:00:00Z", updated_at: "2026-03-28T10:00:00Z",
};

const mockPR = {
  id: 200, repo_id: 12345, number: 10, title: "Fix the broken thing",
  body: "This fixes it", state: "open", author: "bob",
  head_branch: "fix/broken", base_branch: "main",
  mergeable: true, review_status: null, ci_status: null, draft: false,
  html_url: "https://github.com/testuser/test-repo/pull/10",
  created_at: "2026-03-29T08:00:00Z", updated_at: "2026-03-29T09:00:00Z",
};

const mockPR2 = {
  id: 201, repo_id: 12345, number: 11, title: "WIP: new feature",
  body: "Work in progress", state: "open", author: "alice",
  head_branch: "feature/new", base_branch: "main",
  mergeable: null, review_status: "approved", ci_status: "success", draft: true,
  html_url: "https://github.com/testuser/test-repo/pull/11",
  created_at: "2026-03-29T07:00:00Z", updated_at: "2026-03-29T08:00:00Z",
};

const mockCommit = {
  sha: "abc123def4567890", repo_id: 12345,
  message: "Fix: resolve issue #1", author: "alice",
  date: "2026-03-29T09:30:00Z",
};

const mockCommit2 = {
  sha: "xyz789ghi0123456", repo_id: 67890,
  message: "Initial commit", author: "bob",
  date: "2026-03-27T10:00:00Z",
};

// ─── Test suite ─────────────────────────────────────────────────────────────

describe("GitHub Integration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    ensureGithubTables(db);
  });

  // ─── Schema ───────────────────────────────────────────────────────────

  describe("ensureGithubTables", () => {
    it("creates all 4 tables", () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'github_%'").all() as { name: string }[];
      const names = tables.map(t => t.name).sort();
      expect(names).toEqual(["github_commits", "github_issues", "github_pull_requests", "github_repos"]);
    });

    it("tables have correct columns", () => {
      const repoColumns = (db.prepare("PRAGMA table_info(github_repos)").all() as { name: string }[]).map(c => c.name);
      expect(repoColumns).toContain("id");
      expect(repoColumns).toContain("owner");
      expect(repoColumns).toContain("stars");
      expect(repoColumns).toContain("synced_at");

      const issueColumns = (db.prepare("PRAGMA table_info(github_issues)").all() as { name: string }[]).map(c => c.name);
      expect(issueColumns).toContain("repo_id");
      expect(issueColumns).toContain("labels");
      expect(issueColumns).toContain("assignees");
    });

    it("creates indexes", () => {
      const indexes = (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_github_%'").all() as { name: string }[]).map(i => i.name);
      expect(indexes).toContain("idx_github_issues_repo");
      expect(indexes).toContain("idx_github_issues_state");
      expect(indexes).toContain("idx_github_prs_repo");
      expect(indexes).toContain("idx_github_prs_state");
      expect(indexes).toContain("idx_github_commits_repo");
    });

    it("is idempotent", () => {
      expect(() => ensureGithubTables(db)).not.toThrow();
      const tables = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name LIKE 'github_%'").get() as { c: number };
      expect(tables.c).toBe(4);
    });
  });

  // ─── Sync ─────────────────────────────────────────────────────────────

  describe("syncGithubData", () => {
    it("syncs repos with all fields", () => {
      const result = syncGithubData(db, { repos: [mockRepo] });
      expect(result.ok).toBe(true);
      expect(result.synced).toContain("repos");
      expect(result.counts.repos).toBe(1);

      const repos = getGithubRepos(db);
      expect(repos).toHaveLength(1);
      expect(repos[0].id).toBe(12345);
      expect(repos[0].owner).toBe("testuser");
      expect(repos[0].stars).toBe(42);
    });

    it("syncs issues with labels/assignees as JSON", () => {
      syncGithubData(db, { repos: [mockRepo], issues: [mockIssue] });
      const raw = db.prepare("SELECT labels, assignees FROM github_issues WHERE id = 100").get() as { labels: string; assignees: string };
      expect(raw.labels).toContain("bug");
      expect(raw.assignees).toContain("alice");
    });

    it("syncs PRs with boolean fields", () => {
      syncGithubData(db, { repos: [mockRepo], pullRequests: [mockPR, mockPR2] });
      const raw = db.prepare("SELECT id, mergeable, draft FROM github_pull_requests ORDER BY id").all() as { id: number; mergeable: number | null; draft: number }[];
      expect(raw[0].mergeable).toBe(1);
      expect(raw[0].draft).toBe(0);
      expect(raw[1].mergeable).toBeNull(); // null stays null
      expect(raw[1].draft).toBe(1);
    });

    it("syncs commits", () => {
      const result = syncGithubData(db, { repos: [mockRepo], commits: [mockCommit] });
      expect(result.synced).toContain("commits");
      const commits = getGithubCommits(db);
      expect(commits).toHaveLength(1);
      expect(commits[0].sha).toBe("abc123def4567890");
    });

    it("returns correct synced array and counts", () => {
      const result = syncGithubData(db, {
        repos: [mockRepo, mockRepo2], issues: [mockIssue, mockIssue2],
        pullRequests: [mockPR], commits: [mockCommit, mockCommit2],
      });
      expect(result.synced).toEqual(["repos", "issues", "pullRequests", "commits"]);
      expect(result.counts).toEqual({ repos: 2, issues: 2, prs: 1, commits: 2 });
    });

    it("upsert: sync twice, no duplicates, data updated", () => {
      syncGithubData(db, { repos: [mockRepo] });
      syncGithubData(db, { repos: [{ ...mockRepo, stars: 100, description: "Updated" }] });
      const repos = getGithubRepos(db);
      expect(repos).toHaveLength(1);
      expect(repos[0].stars).toBe(100);
    });
  });

  // ─── Sanitization ────────────────────────────────────────────────────

  describe("XSS sanitization", () => {
    it("sanitizes script tags in issue title", () => {
      syncGithubData(db, { repos: [mockRepo], issues: [{ ...mockIssue, id: 999, title: '<script>alert("xss")</script>' }] });
      const issues = getGithubIssues(db);
      const xss = issues.find(i => i.id === 999);
      expect(xss!.title).not.toContain("<script>");
      expect(xss!.title).toContain("&lt;script&gt;");
    });

    it("sanitizes XSS in commit message", () => {
      syncGithubData(db, { repos: [mockRepo], commits: [{ ...mockCommit, sha: "xss1", message: '<img onerror="alert(1)">' }] });
      const commits = getGithubCommits(db);
      const xss = commits.find(c => c.sha === "xss1");
      expect(xss!.message).not.toContain("<img");
      expect(xss!.message).toContain("&lt;img");
    });

    it("handles null fields gracefully", () => {
      expect(() => syncGithubData(db, {
        repos: [{ ...mockRepo, description: null, language: null }],
        issues: [{ ...mockIssue, id: 888, body: null, milestone: null, labels: [], assignees: [] }],
      })).not.toThrow();
    });
  });

  // ─── Query functions ──────────────────────────────────────────────────

  describe("query functions", () => {
    beforeEach(() => {
      syncGithubData(db, {
        repos: [mockRepo, mockRepo2], issues: [mockIssue, mockIssue2],
        pullRequests: [mockPR, mockPR2], commits: [mockCommit, mockCommit2],
      });
    });

    it("getGithubIssues returns parsed labels/assignees arrays", () => {
      const issues = getGithubIssues(db);
      const issue = issues.find(i => i.id === 100);
      expect(Array.isArray(issue!.labels)).toBe(true);
      expect(issue!.labels).toEqual(["bug", "critical"]);
      expect(Array.isArray(issue!.assignees)).toBe(true);
      expect(issue!.assignees).toEqual(["alice", "bob"]);
    });

    it("getGithubPRs returns boolean mergeable/draft", () => {
      const prs = getGithubPRs(db);
      const pr = prs.find(p => p.id === 200);
      expect(pr!.mergeable).toBe(true);
      expect(pr!.draft).toBe(false);
      const pr2 = prs.find(p => p.id === 201);
      expect(pr2!.mergeable).toBeNull();
      expect(pr2!.draft).toBe(true);
    });

    it("getGithubIssues filters by repoId", () => {
      const issues = getGithubIssues(db, 12345);
      expect(issues).toHaveLength(1);
      expect(issues[0].repo_id).toBe(12345);
    });

    it("getGithubCommits filters by repoId", () => {
      const commits = getGithubCommits(db, 67890);
      expect(commits).toHaveLength(1);
      expect(commits[0].repo_id).toBe(67890);
    });

    it("getGithubRepos sorts by updated_at DESC", () => {
      const repos = getGithubRepos(db);
      expect(repos[0].id).toBe(12345); // 2026-03-29 before 2026-03-28
      expect(repos[1].id).toBe(67890);
    });
  });

  // ─── Sync status ──────────────────────────────────────────────────────

  describe("getGithubSyncStatus", () => {
    it("returns synced=false when empty", () => {
      const status = getGithubSyncStatus(db);
      expect(status.synced).toBe(false);
      expect(status.repoCount).toBe(0);
      expect(status.issueCount).toBe(0);
      expect(status.prCount).toBe(0);
      expect(status.commitCount).toBe(0);
    });

    it("returns correct counts after sync", () => {
      syncGithubData(db, {
        repos: [mockRepo, mockRepo2], issues: [mockIssue],
        pullRequests: [mockPR, mockPR2], commits: [mockCommit],
      });
      const status = getGithubSyncStatus(db);
      expect(status.synced).toBe(true);
      expect(status.repoCount).toBe(2);
      expect(status.issueCount).toBe(1);
      expect(status.prCount).toBe(2);
      expect(status.commitCount).toBe(1);
    });

    it("returns syncedAt timestamp", () => {
      syncGithubData(db, { repos: [mockRepo] });
      const status = getGithubSyncStatus(db);
      expect(status.syncedAt).not.toBeNull();
      expect(status.syncedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });
});
