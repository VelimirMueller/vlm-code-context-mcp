# Sprint 3 Tickets

Sprint: 2026-04-07 to 2026-04-11
Milestone: M2 -- Scrum MCP Service (New Epic)
Total Committed: 19 story points

---

## T-016: Design Scrum Database Schema
**Priority**: P0
**Assigned to**: architect
**Story Points**: 3
**Milestone**: M2 -- Scrum MCP Service
**Status**: TODO
**QA Verified**: NO
**Description**: Design and document the SQLite schema for the scrum MCP service. This database is separate from the code-context database. It stores agents, sprints, tickets, subtasks, retro findings, blockers, bugs, skills, and processes. Schema must follow RESTful resource naming conventions and support the full CRUD lifecycle. Deliver a `scrum-schema.sql` file and a schema documentation section.
**Acceptance Criteria**:
- [ ] `scrum-schema.sql` file exists with all CREATE TABLE statements
- [ ] Tables: `agents`, `sprints`, `tickets`, `subtasks`, `retro_findings`, `blockers`, `bugs`, `skills`, `processes`
- [ ] All tables have `id` (INTEGER PRIMARY KEY), `created_at`, `updated_at` columns
- [ ] `tickets` table includes: title, description, priority, status, assignee, story_points, sprint_id (FK), milestone, qa_verified, acceptance_criteria (JSON)
- [ ] `sprints` table includes: goal, start_date, end_date, status, velocity, committed_points
- [ ] `retro_findings` table includes: sprint_id (FK), category (keep/stop/try), finding, action_taken
- [ ] `blockers` table includes: ticket_id (FK), description, status (open/resolved), resolution
- [ ] Foreign key relationships are correctly defined with ON DELETE behavior
- [ ] Schema includes indexes on frequently queried columns (sprint_id, status, assignee)
- [ ] Schema documented with inline SQL comments explaining each table's purpose
**Dependencies**: none

---

## T-017: Implement Scrum MCP Tools -- Read Operations
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 8
**Milestone**: M2 -- Scrum MCP Service
**Status**: TODO
**QA Verified**: NO
**Description**: Implement the scrum SQLite database (from T-016 schema) and build read-only MCP tools for querying scrum data. This is a read-first approach -- write operations come in Sprint 4 after the schema is validated through real use. Includes database initialization, seed data from existing `.claude/scrum/` markdown files, and 6 MCP tool handlers.
**Acceptance Criteria**:
- [ ] Scrum SQLite database is created and initialized on server start (separate file from code-context DB)
- [ ] Database initialization applies the schema from T-016
- [ ] Seed script parses existing `.claude/scrum/` markdown files and populates the database
- [ ] MCP tool `list_agents` returns all agents with their roles and descriptions
- [ ] MCP tool `list_sprints` returns all sprints with goal, dates, status, velocity
- [ ] MCP tool `get_sprint` returns a single sprint with its tickets, subtasks, and retro findings
- [ ] MCP tool `list_tickets` supports filtering by sprint_id, status, assignee
- [ ] MCP tool `get_ticket` returns full ticket detail including acceptance criteria and bugs
- [ ] MCP tool `list_retro_findings` supports filtering by sprint_id and category
- [ ] All tools return structured JSON matching REST response conventions
- [ ] All tools have input validation with clear error messages for missing/invalid params
- [ ] Unit tests for each tool (at least 12 tests total, 2 per tool)
- [ ] Integration test: seed data, query via tools, verify response structure
**Dependencies**: T-016 (schema must be finalized before implementation begins)

---

## T-019: Dashboard Sprint View -- MVP
**Priority**: P1
**Assigned to**: frontend-dev
**Story Points**: 5
**Milestone**: M2 -- Scrum MCP Service
**Status**: TODO
**QA Verified**: NO
**Description**: Add a new page or tab to the existing dashboard that visualizes the current sprint. This is the MVP -- show tickets with their status, assignee, and points, plus retro findings. Data comes from the scrum MCP tools (T-017). Use the same vanilla HTML/CSS/JS approach as the existing dashboard. No frameworks.
**Acceptance Criteria**:
- [ ] New "Sprint" tab or page accessible from the dashboard navigation
- [ ] Sprint header shows: sprint goal, dates, total committed points, current velocity
- [ ] Ticket list displays: ID, title, assignee, points, status (color-coded: TODO=gray, IN_PROGRESS=blue, DONE=green, BLOCKED=red)
- [ ] Clicking a ticket expands to show acceptance criteria with checkbox states
- [ ] Retro findings section shows findings grouped by category (keep/stop/try)
- [ ] Page fetches data from the scrum MCP API endpoint (same pattern as existing dashboard API)
- [ ] Loading state shown while data is being fetched
- [ ] Empty state shown when no sprint data exists ("No sprint data available. Run your first sprint to see results here.")
- [ ] Responsive layout that works on screens 1024px and wider
- [ ] No external CSS or JS dependencies -- consistent with existing dashboard approach
**Dependencies**: T-017 (needs read API to fetch sprint data)

---

## T-020: Modular Server Architecture
**Priority**: P0
**Assigned to**: architect
**Story Points**: 3
**Milestone**: M2 -- Scrum MCP Service
**Status**: TODO
**QA Verified**: NO
**Description**: Refactor the server entry point to support a modular architecture where code-context and scrum are separate service modules. Both modules share the server process but have independent tool registrations, separate SQLite databases, and clean boundaries. Single `npx` entry point starts both. This is the foundation for adding more MCP service modules in the future.
**Acceptance Criteria**:
- [ ] `src/server/` directory reorganized into `src/server/code-context/` and `src/server/scrum/` modules
- [ ] Each module exports a `registerTools(server)` function that registers its MCP tools
- [ ] Main entry point (`src/server/index.ts`) imports both modules and registers their tools on a single MCP server
- [ ] Code-context module retains all existing 10 tools with zero behavior change
- [ ] Scrum module registers the 6 read tools from T-017
- [ ] Each module manages its own SQLite database file (separate DB files, no shared tables)
- [ ] Shared utilities (e.g., database helpers, error formatting) are in `src/server/shared/`
- [ ] All 34 existing tests continue to pass without modification
- [ ] New architectural test: verify both modules register tools independently
- [ ] `npm start` launches the server with both modules active
**Dependencies**: T-017 (scrum tools must exist to be registered)

---

# Deferred Tickets (Sprint 4 Backlog)

The following tickets are intentionally deferred from Sprint 3. See REJECTED_TICKETS.md for rationale.

## T-004: Error Handling Hardening (5 pts, backend-dev)
Carried from Sprint 2. Deferred in favor of new Scrum MCP epic.

## T-008: Re-exports + Async Function Parser Fix (3 pts, backend-dev)
Carried from Sprint 2. Fixes BUG-001 and BUG-002. Deferred in favor of new Scrum MCP epic.

## T-018: Implement Scrum MCP Tools -- Write Operations (5 pts, backend-dev)
New ticket. Deferred to Sprint 4: read-first approach, validate schema through real use before building write tools.
Tools planned: create_sprint, create_ticket, update_ticket, add_retro_finding, create_blocker, resolve_blocker.

## T-007: Documentation for Senior Engineers (3 pts, lead-dev)
Partial from Sprint 2. Schema reference and full 10-tool reference still needed. Deferred -- new epic takes priority.

## T-013: Dashboard Hash Routing and State Persistence (3 pts, frontend-dev)
Carried from Sprint 2. Deferred -- T-019 (Sprint View) is the frontend priority for Sprint 3.

## T-014: Dashboard Keyboard Shortcuts and Search (3 pts, frontend-dev)
Carried from Sprint 2. Deferred -- T-019 is the frontend priority.

## T-015: Dashboard Loading and Error States (2 pts, frontend-dev)
Carried from Sprint 2. Deferred -- T-019 is the frontend priority.
