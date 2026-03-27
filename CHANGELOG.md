# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-27

### Added

#### M1 — Foundation (Sprints 1-7)
- SQLite-backed code intelligence: file indexing, export/import parsing, dependency graphs
- 10 MCP tools for code context (`index_directory`, `find_symbol`, `get_file_context`, `search_files`, `query`, `execute`, `set_description`, `set_directory_description`, `set_change_reason`, `get_changes`)
- Multi-page dashboard with Code Explorer and Sprint Process sections
- Kanban board with TODO, IN_PROGRESS, DONE, and BLOCKED columns
- 9-agent virtual scrum team: Product Owner, Scrum Master, Manager, Lead Developer, Backend Developer, Frontend Developer, Architect, QA Engineer, Security Specialist
- 10 scrum database tables for sprints, tickets, blockers, bugs, retro findings, skills, processes, and milestones
- Landing page with enterprise-grade Framer Motion animation sequence
- Sprint board with planning, QA, and retrospective views
- Team mood system with computed sentiment scores and workload distribution
- File watcher for automatic re-indexing on save

#### M2 — Scale (Sprints 8-10)
- Full React rewrite: Vite + React 19 + TypeScript + Zustand + Tailwind CSS
- 38 React components following atomic design (atoms, molecules, organisms)
- 6 Zustand stores (file, sprint, agent, planning, ui, toast)
- Code Explorer page with file tree sidebar, dependency graph, and keyboard navigation (Cmd+K search, arrow keys)
- Sprint page with kanban board, team grid, and BentoGrid insights
- Project Management page with interactive workflows
- Framer Motion micro-interactions and animated hero text with count-up numbers
- Velocity trend chart across all sprints
- Gantt-style milestone timeline
- Sprint report export as markdown
- Dark theme with consistent design language
- 58 integration tests via Vitest

#### M3 — Platform (Sprints 11-15)
- MCP bootstrap system: `npx code-context-mcp setup .` for one-command project setup
- Database dump/restore through MCP tools (`dump_database`, `restore_database`, `export_to_file`, `import_from_file`)
- Onboarding status detection and `run_onboarding` MCP tool
- CLI with `--help`, `--force`, and `--name` flags
- Dashboard API endpoints for dump/restore and project status
- 28 sprint management MCP tools (create/update sprints, tickets, blockers, bugs, retro findings, milestones)
- Milestone-ticket linking with progress tracking
- Planning Insights tab with velocity, health, and capacity analytics
- Navigation flattening: single-level nav with persistent quick actions, reducing click depth from 7 to 2-3
- Product vision editor with version history

#### M4 — Quality & Marketing (Sprints 16-20)
- Marketing page with Google Ads AI integration and campaign strategy automation
- Ad suggestions section: Performance Max, Smart Bidding, keyword strategies
- Full TypeScript error cleanup and runtime bug fixes
- Navigation routing fixes for Marketing, Team, and Retro pages
- QA verification pass across all dashboard pages
- Release notes for sprints 1-15

#### M5 — UX Polish (Sprints 21-25)
- SVG icons replacing all emoji icons across nav, quick actions, and Gantt chart
- Breadcrumb navigation with proper sub-tab tracking
- Sprint sidebar grouped by milestone with collapsible sections and progress indicators
- Planning tab reorder: Vision, Milestones, Planning, Gantt, Insights
- Sprint Planning sub-tab grouped by milestone
- Code Explorer folder arrow and name horizontal layout fix
- Gantt chart and Insights filtered to active and planning sprints only
- QuickFilters streamlined to All Tickets and Me only

#### M6 — Marketing & Growth (Sprint 20)
- Google Ads AI skill integration on Marketing page
- Growth metrics dashboard section
- Campaign budget recommendations for npm package promotion

#### M7 — Visual Polish & QA (Sprints 26-27, 36)
- Visual polish pass: consistent spacing, typography, border-radius, hover states
- Database dump/restore roundtrip verification across all 15 tables
- Foreign key integrity validation
- Agent, skill, and sprint data persistence through restore cycles
- React.lazy code splitting: main bundle reduced from 509KB to 211KB across 18 chunks
- `/api/retro/all` endpoint eliminating N+1 query fetches
- SSE auto-refresh for live dashboard updates

#### M8 — First Startup Experience (Sprint 37)
- Startup audit verifying fresh `npm install` experience end-to-end
- All 16 agents and 7 skills bootstrap correctly on first run
- Sprint instructions auto-loaded during setup
- Code explorer and dashboard functional immediately after setup
- LICENSE file (MIT) added
- npm publish readiness: correct tool count (43), package metadata

#### M11 — Linear Integration & Dashboard Hardening (Sprints 34-36)
- Linear MCP integration with Me sub-tab inside Dashboard
- 5 new API endpoints for Linear workspace data (assigned issues, cycles, projects, activity)
- SQLite sync cache for Linear data with 50 issues and 4 projects
- `sync_linear_data` MCP tool for on-demand Linear synchronization
- 7 new React components for Linear data display
- API client hardening: request timeouts, automatic retry with backoff
- Localhost-only sync restriction for security
- XSS sanitization on all user-facing data
- Clickable Linear URLs and sync timestamps in Me tab
- 13 new Linear sync tests (80 total test suite)
- BentoGrid API client fix

### Changed

- Architecture evolved from monolithic `dashboard.html` to Vite + React 19 SPA
- MCP tool count grew from 10 (code-only) to 43 (10 code + 28 sprint + 4 bootstrap + 1 sync)
- Database schema expanded from 5 tables (code context) to 15 tables (5 code + 10 scrum)
- Navigation restructured from nested tabs to flat single-level layout
- Package repositioned from code context explorer to AI-powered virtual IT department
- README rewritten as enterprise npm package with badges, architecture diagram, and efficiency benchmarks
- Dashboard titles and branding updated across all surfaces
- Planning tabs reordered to Vision, Milestones, Planning, Gantt, Insights
- Gantt chart and Insights views filtered to exclude closed sprints
- Sprint sidebar redesigned with milestone grouping and collapsible sections
- Main bundle size reduced 59% through code splitting (509KB to 211KB)

### Fixed

- API response shape mismatches causing React dashboard crashes on all pages
- Milestone and vision data loading from skills API instead of direct DB
- Sprint sorting by status then date for correct chronological display
- Gantt timeline rendering with proper date ranges
- Plain text SSE event handling for live reload
- Hash router stale page name references
- Navigation routing for Marketing, Team, and Retro pages
- Breadcrumbs not updating on sub-tab changes
- Code Explorer folder collapse behavior (all folders collapsed by default)
- Code Explorer folder arrow and name horizontal alignment
- Filter bar padding and offset from border
- QuickFilters removed from KanbanBoard to prevent UI clutter
- BentoGrid API client data fetching
- TypeScript compilation errors across the codebase
- Foreign key integrity issues in database dump/restore
- N+1 query problem on retrospective data fetching

## [1.0.0] - 2026-03-26

### Added

- Initial SQLite-backed file indexer for JavaScript and TypeScript projects
- Basic MCP server with `index_directory`, `find_symbol`, `get_file_context` tools
- Single-page dashboard with file tree and detail panel
- File and directory description persistence
- Change tracking with diff text and reason annotations
- README with installation and usage instructions

[2.0.0]: https://github.com/VelimirMueller/mcp-server/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/VelimirMueller/mcp-server/releases/tag/v1.0.0
