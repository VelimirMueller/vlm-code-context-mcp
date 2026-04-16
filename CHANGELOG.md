# Changelog

All notable changes to `vlm-code-context-mcp` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-04-16

### Fixed
- Package description still referenced "7-agent scrum team" — now ships with 9 agents (Security Engineer + Architect added in 1.1.2)

## [1.1.2] - 2026-04-16

### Added
- **Security Engineer** and **Architect** agent roles — 7→9 default agents. Existing 7-agent databases auto-migrate on startup.
- Benchmark JSON files (`benchmark-results.json`, `benchmark-stochastic-results.json`) now included in npm package

### Changed
- Setup no longer auto-creates "M1 — Getting Started" milestone — milestones are created via `/kickoff` or MCP tools for a clean starting state

### Fixed
- **Flaky CI benchmark test** — "larger tasks save more" assertion compared group totals (4 small vs 3 large tasks) instead of per-task averages, causing failures on CI where indexer output differs slightly across Node versions

## [1.1.0] - 2026-04-16

### Added
- **10-task deterministic benchmark** (`test/benchmark.test.ts`) — MCP vs vanilla comparison across 6 categories (retrieval, analysis, exploration, implementation, debugging, refactoring), 32 story points total. Replaces the old 3-task hand-estimated comparison. Outputs `benchmark-results.json` for dashboard consumption.
- **200-trial stochastic benchmark** (`test/benchmark-stochastic.test.ts`) — random file role assignment, Poisson exploration noise (λ=1.5), Wilcoxon signed-rank test, bootstrap 95% CI, seeded PRNG for reproducibility. Result: 90.5% MCP win rate, p < 0.001, effect size r=0.953.
- **Benchmark guide** (`BENCHMARK-GUIDE.md`) — methodology, task descriptions, how to add tasks, honest reporting guidelines
- `/api/benchmark` and `/api/benchmark-stochastic` dashboard endpoints serving new benchmark data
- `benchmarkStore` (Zustand) for fetching deterministic + stochastic results

### Changed
- **Benchmark dashboard page** rewritten — now shows 10-task card grid, category breakdown, statistical proof panel with Wilcoxon results, hypothesis testing, and per-template savings
- **README benchmark section** updated with reproducible numbers (44.9% token savings, 27.9% fewer calls, p < 0.001) and `npm test` commands to verify

## [1.0.2] - 2026-04-15

### Removed
- **Velocity tab** — removed `Velocity` page, `velocityStore`, `/api/velocity` endpoint, and navigation entry. Sprint velocity data (committed/completed points, badges) remains available on sprint cards and Gantt chart.

### Fixed
- `comparison.json` now ships in npm package and dashboard falls back to bundled copy when not found next to database — fixes empty Benchmark page on npm installs

## [1.0.0] - 2026-04-14

### Added
- Composite database indexes on `tickets(sprint_id, deleted_at)` and `sprints(status, deleted_at)` for faster soft-delete queries
- Migration v19 for existing databases to add ticket composite index
- `DASHBOARD_PORT` env var support in dashboard.ts (previously only accepted CLI arg)

### Changed
- **Transactional database operations** — `runMigrations`, `start_sprint`, `update_ticket`, and `advance_sprint` now wrap multi-step writes in `db.transaction()` for atomicity; partial failures roll back cleanly
- **Token efficiency** — `get_file_context` output consolidated (removed redundant `Indexed` timestamp, merged metadata to single line, removed dependency summaries); `index_directory` output reduced structural padding
- Version bumped to 1.0.0 for launch readiness
- ESLint `no-console` rule enabled (warn level, allowing `warn`/`error`)
- All documentation reconciled: tool count 76/81/83 → 93, agent count 9/16 → 7, stale sprint/ticket/milestone numbers removed from LAUNCH.md
- Setup and dashboard console output now respects `DASHBOARD_PORT` env var instead of hardcoding `localhost:3333`

### Fixed
- `retro_findings.linked_ticket_id` FK now uses `ON DELETE SET NULL` (fresh installs)
- Sprints table rebuild (`sprints_v3` migration) now always includes `deleted_at` column — previously dropped by migration 5 and never restored, causing broken `velocity_trends` view on fresh databases
- Removed 5 noisy debug `console.log` statements from dashboard.ts (SSE change notifications, re-index, marketing stats rebuild, client connect)

## [0.3.1] - 2026-04-14

### Added
- `update_sprint_config` and `get_sprint_config` MCP tools for runtime sprint configuration
- `department` field on agents (development, quality, business) for team organization
- Agent mood history seeding with per-sprint workload data on first startup
- TeamGrid dashboard component now displays agent department badges

### Changed
- Default agent team updated from 4/6/15-agent presets to a focused 7-agent roster (FE Engineer, BE Engineer, Developer, DevOps, QA, Team Lead, Product Owner)
- Agent seed migration auto-detects and upgrades old 4-, 6-, and 15-agent factory defaults
- Dashboard `/api/comparison` endpoint returns live benchmark data from `comparison.json`

### Fixed
- Agent reset validation now asserts exactly 7 agents and 5 skills after re-seed

## [0.3.0] - 2026-04-13

### Added
- **Benchmark comparison interface** — new `Benchmark` page visualizing MCP vs traditional development metrics (token usage, context switches, tool calls, completion time)
- **Velocity tracking** — new `Velocity` page with sprint-over-sprint throughput charts (story points completed, planned vs actual, trend lines)
- `comparisonStore` (Zustand) for fetching and caching benchmark data from `/api/comparison`
- `velocityStore` (Zustand) for fetching sprint velocity trends from `/api/velocity`
- Benchmark and Velocity tabs added to the top navigation
- `comparison.json` data file for persisting MCP vs traditional run results
- Dashboard API routes: `/api/comparison` and `/api/velocity`

### Changed
- Navigation updated to include Benchmark and Velocity as top-level tabs
- README updated with benchmark findings and efficiency metrics

## [0.2.0] - 2026-04-12

### Added

#### React Dashboard
- Full React rewrite — Vite + React 19 + TypeScript + Tailwind CSS 4 single-page application replacing the original HTML dashboard
- 5 Zustand stores (`fileStore`, `sprintStore`, `agentStore`, `planningStore`, `uiStore`) with typed API client
- 8 custom React hooks (`useFiles`, `useSprints`, `useAgents`, `usePlanning`, `useSearch`, `useHashRouter`, `useEventSource`, `useKeyboard`)
- **Code Explorer** page with collapsible file tree, search, and tabbed detail panel (imports, exports, metadata)
- **Sprint** page with kanban board, team workload grid, and bento insight cards
- **Project Management** page with milestone progress, epic tracking, and Gantt timeline
- **Planning** page with velocity analytics, health metrics, and capacity insights
- **Kanban board** with HTML5 drag-and-drop, optimistic updates, and atomic rollback on failure
- Planning wizard with step-aware workflow and inline ticket editing
- Sprint lifecycle automation — dashboard buttons advance sprints through phases without requiring Claude
- Animated hero text with count-up stat numbers on each tab
- Micro-interactions and landing animation polish
- Error boundaries and toast notification system
- SSE (Server-Sent Events) live-reload for real-time dashboard updates
- MCP-to-Dashboard HTTP notification bridge for instant UI refresh

#### MCP Server & Tools
- 27+ MCP tools organized across codebase intelligence and scrum management
- `create_sprint`, `start_sprint`, `advance_sprint`, `plan_sprint` — full sprint lifecycle
- `create_ticket`, `update_ticket`, `get_ticket`, `list_tickets` — ticket CRUD
- `create_epic`, `update_epic`, `list_epics` — epic management
- `create_milestone`, `update_milestone`, `link_ticket_to_milestone` — milestone tracking
- `create_blocker`, `resolve_blocker` — blocker management
- `create_discovery`, `update_discovery`, `link_discovery_to_ticket` — discovery tracking with resolution plans
- `add_retro_finding`, `list_retro_findings`, `analyze_retro_patterns` — retrospective tooling
- `record_mood`, `get_mood_trends` — agent mood and workload tracking
- `log_time`, `get_time_report` — time logging per ticket
- `log_decision`, `list_decisions` — architectural decision records
- `log_event`, `list_recent_events` — audit trail
- `get_sprint_summary`, `get_sprint_playbook`, `export_sprint_report` — sprint reporting
- `get_velocity_trends`, `get_burndown`, `snapshot_sprint_metrics` — analytics
- `dump_database`, `restore_database`, `export_to_file`, `import_from_file` — data portability
- `get_onboarding_status`, `run_onboarding` — guided project setup
- `get_backlog`, `get_dependency_graph`, `search_scrum` — backlog and dependency tools
- `add_tag`, `remove_tag`, `list_tags`, `add_dependency`, `remove_dependency` — metadata management
- `reset_agents`, `reset_skills`, `reset_sprint_process` — factory reset tools
- `get_agent`, `list_agents` — agent introspection
- `get_audit_trail`, `get_token_usage`, `log_token_usage` — observability

#### Scrum System
- 9-agent virtual scrum team (later refined to 7: FE Engineer, BE Engineer, Developer, DevOps, QA, Team Lead, Product Owner)
- 4-phase sprint process: Planning → Implementation → Done → Rest
- Sprint process stored as configurable skill (`SPRINT_PROCESS_JSON`)
- Agent assignment to tickets with workload tracking
- SQLite-backed persistence for all scrum data (sprints, tickets, epics, milestones, discoveries, mood history)

#### Infrastructure
- `code-context-mcp` CLI with `--help`, `--force`, `--name` flags for project setup
- `code-context-dashboard` CLI binary for launching the dashboard server
- `postinstall` script for npm — shows setup hint when installed as a dependency
- Automatic port detection — finds next open port when 3333 is blocked
- CI pipeline with ESLint, Prettier, and Husky pre-commit hooks
- 58+ unit tests (Vitest) covering MCP tools and dashboard API
- 23 Playwright E2E tests covering all dashboard tabs
- BentoGrid made fully dynamic — no hardcoded project data on clean installs
- Claude Code bridge hook for bidirectional dashboard–Claude communication

### Changed
- Dashboard architecture migrated from single HTML file to component-based React app with atomic design (atoms → molecules → organisms → pages)
- Sprint phases simplified from multi-step ceremony model to 4 clear phases
- Default agent count reduced from 15 to 4, then made configurable (assignment optional)
- Navigation flattened to single-level with persistent quick actions
- Standardized API error responses across all dashboard endpoints
- Removed Linear integration code (external dependency eliminated for MVP)
- Removed Marketing section from dashboard

### Fixed
- API response shape mismatches that crashed the React dashboard
- SSE plain-text event handling for live reload
- Milestone loading from skill content and vision fetch
- Sprint sorting by status then date in Gantt timeline
- File tree default collapsed state with auto-expand on search
- `dragLeave` flicker in kanban drag-and-drop
- Object-shaped `imports`/`importedBy` handling in Code Explorer detail tab
- Null safety guards in Code Explorer to prevent crashes
- Ticket milestone/epic assignment and discovery archiving
- Team workload/mood and Retro tab reactivity

### Removed
- 461 lines of dead and duplicated code identified and cleaned up
- Original single-file HTML dashboard (replaced by React app)
- Linear integration (all external sync code removed)

## [0.1.0] - 2026-04-08

### Added

#### MCP Server
- SQLite-backed codebase indexer — scans and indexes file metadata, exports, imports, and dependencies
- `index_directory` — recursively index a project directory into the SQLite database
- `get_file_context` — retrieve file metadata, exports, imports, and dependency graph
- `find_symbol` — search for symbols (functions, classes, variables) across indexed files
- `search_files` — full-text search across indexed file content and descriptions
- `get_changes` — track file changes grouped by path with size and line diffs
- `query` / `execute` — raw SQL access to the underlying SQLite database
- `set_description` — set a human-readable description for any indexed file
- `set_directory_description` — set a description for any indexed directory
- `set_change_reason` — annotate why a file changed
- Pre-indexed file and folder descriptions written automatically on first install
- Relative path support for portable project references

#### Dashboard
- HTML-based dashboard with file tree browser and detail panel
- Directory and file description display in the detail panel
- Portfolio-aligned styling and design

#### Infrastructure
- TypeScript codebase with Vitest test suite (parser and smoke tests)
- `better-sqlite3` for zero-dependency embedded database
- `@modelcontextprotocol/sdk` integration for MCP server protocol
- `chokidar` file watcher for detecting changes
- `zod` schema validation
- MIT license

[1.0.0]: https://github.com/VelimirMueller/mcp-server/compare/v0.3.1...v1.0.0
[0.3.1]: https://github.com/VelimirMueller/mcp-server/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/VelimirMueller/mcp-server/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/VelimirMueller/mcp-server/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/VelimirMueller/mcp-server/releases/tag/v0.1.0
