# Sprint 3 Subtasks

Status: TODO / IN_PROGRESS / DONE / BLOCKED

---

## Architect

### T-016: Design Scrum Database Schema (3 pts)
- [x] Design 9-table schema (agents, sprints, tickets, subtasks, retro_findings, blockers, bugs, skills, processes)
- [x] Add CHECK constraints for status, priority, severity enums
- [x] Add foreign keys with CASCADE/SET NULL delete behavior
- [x] Add indexes on sprint_id, status, assigned_to
- [x] Export initScrumSchema(db) function
- [x] Write 8 tests covering table creation, CRUD, cascades, constraints

### T-020: Modular Server Architecture (3 pts)
- [x] Create src/scrum/ directory for scrum module
- [x] Wire initScrumSchema into server startup (src/server/index.ts)
- [x] Wire registerScrumTools into server (same McpServer instance)
- [ ] Verify build output includes dist/scrum/*.js
- [ ] Verify MCP tools are accessible via protocol

## Backend Developer

### T-017: Scrum MCP Read Tools (8 pts)
- [x] Implement list_agents tool with structured text output
- [x] Implement get_agent tool with role-based lookup
- [x] Implement list_sprints tool with status filter and ticket counts
- [x] Implement get_sprint tool with full details (tickets, bugs, blockers, retro)
- [x] Implement list_tickets tool with sprint/status/assignee filters
- [x] Implement get_ticket tool with subtasks and linked bugs
- [x] Implement list_retro_findings tool with sprint/category filters
- [x] Implement search_scrum tool with cross-entity text search
- [ ] Write integration tests for all 8 tools

## Frontend Developer

### T-019: Dashboard Sprint View -- MVP (5 pts)
- [ ] Add Sprint tab to dashboard.html tab bar
- [ ] Add sprint selector dropdown (populated from /api/sprints)
- [ ] Add sprint overview panel (name, goal, dates, status badge)
- [ ] Add velocity metrics (committed vs completed, progress bar)
- [ ] Add ticket count cards by status (TODO, IN_PROGRESS, DONE, BLOCKED)
- [ ] Add ticket table (ID, Title, Priority badge, Assignee, Points, Status badge, QA checkmark)
- [ ] Add click-to-expand ticket details (acceptance criteria, subtasks, notes)
- [ ] Add retro findings section grouped by category (went_well/went_wrong/try_next)
- [ ] Add /api/sprints, /api/sprint/:id, /api/sprint/:id/tickets, /api/sprint/:id/retro endpoints to dashboard.ts
- [ ] Add empty state handling ("No sprints found")

## QA Engineer

### Test Specs (Day 2-3)
- [x] Verify scrum schema creates all 9 tables
- [x] Verify constraints (invalid status/priority rejected)
- [x] Verify cascade deletes (sprint delete removes tickets)
- [ ] Verify all 8 MCP tools return structured output
- [ ] Verify empty database returns helpful messages
- [ ] Verify dashboard sprint tab loads without errors
