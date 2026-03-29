# Sprint 54 Tickets — GitHub Integration

Sprint: 2026-03-29 to 2026-04-02
Total Committed: 19 story points

---

## T-054: GitHub MCP Tools — Auth + Core Sync
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 5
**Status**: TODO
**Milestone**: Milestone 4 — Ecosystem Growth
**Description**: Add `sync_github_data` MCP tool following the Linear sync pattern (`src/dashboard/linear.ts`). Authenticate via GitHub PAT (env var `GITHUB_TOKEN`). Sync: authenticated user profile, repository metadata, open issues, open PRs, and recent commits. Data flows through the MCP tool into SQLite for dashboard consumption.
**Acceptance Criteria**:
- [ ] `sync_github_data` MCP tool registered in `src/scrum/tools.ts`
- [ ] Accepts params: `owner` (string), `repo` (string), optional `since` (ISO date)
- [ ] Fetches and stores: user profile, repo metadata (stars, forks, language, description)
- [ ] Fetches and stores: open issues with labels, assignees, milestone
- [ ] Fetches and stores: open PRs with review status, merge status, CI checks
- [ ] Fetches and stores: last 50 commits on default branch
- [ ] Uses GitHub REST API via fetch (no octokit dependency — zero-dependency principle)
- [ ] Returns structured summary: counts of synced entities + last sync timestamp
- [ ] Handles missing/invalid token with clear error message

---

## T-055: GitHub Data Schema + Sync Pipeline
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 3
**Status**: TODO
**Milestone**: Milestone 4 — Ecosystem Growth
**Description**: Create normalized SQLite tables for GitHub data (not a single JSON cache like Linear). Tables: `github_repos`, `github_issues`, `github_pull_requests`, `github_commits`. Schema lives in `src/dashboard/github.ts` following the Linear pattern. Include dashboard REST endpoints for frontend consumption.
**Acceptance Criteria**:
- [ ] `github_repos` table: id, owner, name, description, stars, forks, language, default_branch, updated_at
- [ ] `github_issues` table: id, repo_id, number, title, body, state, author, labels (JSON), assignees (JSON), milestone, created_at, updated_at
- [ ] `github_pull_requests` table: id, repo_id, number, title, body, state, author, head_branch, base_branch, mergeable, review_status, ci_status, created_at, updated_at
- [ ] `github_commits` table: id, repo_id, sha, message, author, date
- [ ] Dashboard REST endpoints: `GET /api/github/repos`, `GET /api/github/issues`, `GET /api/github/prs`, `GET /api/github/commits`
- [ ] All string fields sanitized (XSS prevention, matching Linear pattern)
- [ ] Schema creation in `ensureGithubTables()` called at dashboard startup

---

## T-056: Dashboard GitHub Tab
**Priority**: P1
**Assigned to**: frontend-dev
**Story Points**: 5
**Status**: TODO
**Milestone**: Milestone 4 — Ecosystem Growth
**Description**: Add a "GitHub" tab to the dashboard with three sub-views: Issues board (kanban: open/in-progress/closed), PR list with review + CI status badges, and commit timeline. Follow atomic design: atoms for status badges, molecules for issue/PR cards, organism for the board, page for the tab. Add a Zustand `githubStore` for state management.
**Acceptance Criteria**:
- [ ] "GitHub" nav item added to sidebar, routes to `/github`
- [ ] `githubStore.ts` with fetch actions for repos, issues, PRs, commits
- [ ] Issues sub-tab: kanban board with columns (Open, In Progress, Closed)
- [ ] PRs sub-tab: list view with status badges (draft, review requested, approved, merged)
- [ ] Commits sub-tab: timeline view showing recent commits with author + message
- [ ] Repo selector dropdown when multiple repos are synced
- [ ] "Sync Now" button triggers `sync_github_data` via API
- [ ] Loading states and empty states handled
- [ ] At least 3 component tests (githubStore, one card component, one board component)

---

## T-057: GitHub Integration Tests
**Priority**: P1
**Assigned to**: qa
**Story Points**: 3
**Status**: TODO
**Milestone**: Milestone 4 — Ecosystem Growth
**Description**: Write integration tests for the GitHub sync pipeline. Mock GitHub API responses, verify data lands in SQLite correctly, verify dashboard API endpoints return correct data. Follow existing test patterns in `test/linear.test.ts` and `test/linear-proxy.test.ts`.
**Acceptance Criteria**:
- [ ] `test/github.test.ts` created with at least 15 test cases
- [ ] Test sync_github_data with mock API responses (user, repo, issues, PRs, commits)
- [ ] Test schema creation (tables exist with correct columns)
- [ ] Test upsert behavior (sync twice, no duplicates)
- [ ] Test dashboard REST endpoints return synced data
- [ ] Test error handling: invalid token, API rate limit, network failure
- [ ] Test data sanitization (XSS payloads in issue titles stripped)
- [ ] All tests pass with `npm test`

---

## T-058: Security Review — GitHub Token Handling
**Priority**: P1
**Assigned to**: security-specialist
**Story Points**: 3
**Status**: TODO
**Milestone**: Milestone 4 — Ecosystem Growth
**Description**: Security audit focused on GitHub integration. Verify token handling, API input validation, stored data sanitization, and no token leakage in logs/responses/database.
**Acceptance Criteria**:
- [ ] GitHub PAT never logged, never stored in SQLite, never returned in API responses
- [ ] All user-supplied inputs (owner, repo, since) validated with zod schemas
- [ ] GitHub API responses sanitized before SQLite storage (HTML entities, script tags)
- [ ] Rate limit handling doesn't expose token in error messages
- [ ] `npm audit` run with no new CRITICAL/HIGH vulnerabilities
- [ ] API endpoints don't expose raw GitHub tokens or internal IDs
- [ ] Findings documented in BUGS.md with severity ratings
