# Sprint 54 Subtasks — GitHub Integration

---

## Backend Developer (T-054: 5pt + T-055: 3pt = 8pt)

### T-055: GitHub Data Schema + Sync Pipeline
| # | Subtask | Status | Notes |
|---|---------|--------|-------|
| 1 | Create `src/dashboard/github.ts` with `ensureGithubTables()` — tables: github_repos, github_issues, github_pull_requests, github_commits | TODO | Follow linear.ts pattern, normalized schema |
| 2 | Add `sanitize()` function (reuse from linear.ts or extract shared) | TODO | HTML entity encoding, max length limits |
| 3 | Implement `syncGithubData(db, payload)` — upsert logic for all 4 tables | TODO | Handle JSON fields (labels, assignees) |
| 4 | Implement query functions: `getGithubRepos()`, `getGithubIssues()`, `getGithubPRs()`, `getGithubCommits()` | TODO | Support filtering by repo |
| 5 | Add REST endpoints in `dashboard.ts`: GET /api/github/repos, /issues, /prs, /commits | TODO | Localhost-only for writes |
| 6 | Call `ensureGithubTables()` at dashboard startup | TODO | |

### T-054: GitHub MCP Tools — Auth + Core Sync
| # | Subtask | Status | Notes |
|---|---------|--------|-------|
| 1 | Add `sync_github_data` tool in `src/scrum/tools.ts` with zod schema (owner, repo, since params) | TODO | |
| 2 | Implement GitHub REST API fetch helpers: fetchGithubUser(), fetchRepo(), fetchIssues(), fetchPRs(), fetchCommits() | TODO | Use native fetch, no octokit. GITHUB_TOKEN from env |
| 3 | Wire API responses through sanitization into syncGithubData() via POST to dashboard | TODO | |
| 4 | Add ETag/conditional request headers for rate limit mitigation | TODO | |
| 5 | Handle errors: missing token, rate limit (403), network failure | TODO | Clear error messages, never expose token |
| 6 | Return structured summary: entity counts + last sync timestamp | TODO | |

---

## Frontend Developer (T-056: 5pt)

### T-056: Dashboard GitHub Tab
| # | Subtask | Status | Notes |
|---|---------|--------|-------|
| 1 | Create `githubStore.ts` — state: repos, issues, prs, commits; actions: fetch*, syncNow; filters: repo selector | TODO | Follow linearStore.ts pattern |
| 2 | Add GitHub types to `src/types/index.ts` — GithubRepo, GithubIssue, GithubPR, GithubCommit | TODO | |
| 3 | Add "GitHub" nav item to sidebar, route to /github | TODO | |
| 4 | Issues sub-tab: kanban board (Open / In Progress / Closed columns) | TODO | Reuse KanbanBoard organism pattern |
| 5 | PRs sub-tab: list view with status badges (draft, review requested, approved, merged) | TODO | New molecule: GithubPRCard |
| 6 | Commits sub-tab: timeline view with author + message | TODO | New molecule: GithubCommitItem |
| 7 | Repo selector dropdown + "Sync Now" button | TODO | |
| 8 | Loading states and empty states | TODO | |
| 9 | Write 3+ component tests (githubStore, card, board) | TODO | |

---

## QA (T-057: 3pt)

### T-057: GitHub Integration Tests
| # | Subtask | Status | Notes |
|---|---------|--------|-------|
| 1 | Create `test/github.test.ts` scaffold with mock GitHub API response fixtures | TODO | |
| 2 | Test ensureGithubTables() — tables exist with correct columns | TODO | |
| 3 | Test syncGithubData() with mock data — all 4 tables populated | TODO | |
| 4 | Test upsert behavior — sync twice, verify no duplicates | TODO | |
| 5 | Test REST endpoints return synced data correctly | TODO | |
| 6 | Test error handling: invalid token (401), rate limit (403/429), network failure | TODO | |
| 7 | Test XSS sanitization — script tags in issue titles stripped | TODO | |
| 8 | Verify 15+ test cases total, all pass with `npm test` | TODO | |

---

## Security Specialist (T-058: 3pt)

### T-058: Security Review — GitHub Token Handling
| # | Subtask | Status | Notes |
|---|---------|--------|-------|
| 1 | Audit: GITHUB_TOKEN never logged, stored in DB, or returned in API responses | TODO | |
| 2 | Verify zod validation on all MCP tool inputs (owner, repo, since) | TODO | |
| 3 | Verify GitHub API response sanitization before SQLite storage | TODO | |
| 4 | Check rate limit error handling doesn't expose token | TODO | |
| 5 | Run `npm audit` — no new CRITICAL/HIGH vulnerabilities | TODO | |
| 6 | Verify REST endpoints don't expose tokens or internal GitHub IDs | TODO | |
| 7 | Document findings in BUGS.md with severity ratings | TODO | |
