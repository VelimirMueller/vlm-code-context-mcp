# Sprint 5 Tickets

Sprint: 2026-04-14 to 2026-04-18
Milestone: M2 — Intelligence Layer (Dashboard Evolution)
Total Committed: 19 story points (per retro velocity target)

---

## T-021: Restructure Dashboard — Separate Pages with Tab Navigation
**Priority**: P0
**Assigned to**: frontend-dev
**Story Points**: 8
**Status**: TODO
**QA Verified**: NO
**Milestone**: M2
**Description**: Replace the current single-view dashboard with a proper multi-page layout. Top-level navigation: "Code Explorer" (existing file/graph/changes tabs) and "Sprint Process" (new sprint views). The Sprint Process page gets its own sub-navigation: Sprint Board, Milestones, Product Vision, Team. Each view is a distinct section of the HTML. Mobile-responsive layout with collapsible sidebar.
**Acceptance Criteria**:
- [ ] Top navigation bar with "Code Explorer" and "Sprint Process" as primary sections
- [ ] Code Explorer retains all existing functionality (file tree, detail, graph, changes)
- [ ] Sprint Process section has sub-tabs: Board, Milestones, Vision, Team
- [ ] Sprint Board shows sprint list as visual cards (not a dropdown) — each card shows name, status badge, velocity bar, ticket counts
- [ ] Clicking a sprint card loads the sprint detail (tickets table, retro findings)
- [ ] Milestones view reads MILESTONES.md content from skills table and renders it
- [ ] Product Vision view reads PRODUCT_VISION.md content from skills table and renders it
- [ ] Team view shows agent cards with role, model, description, and a health indicator (green=has recent tickets, yellow=idle, red=blocked)
- [ ] Layout is responsive — sidebar collapses on screens < 768px
- [ ] All sections have loading skeleton, content, error, and empty states (retro action)
**Dependencies**: none

---

## T-022: Sprint Board — Planning & QA Views
**Priority**: P0
**Assigned to**: frontend-dev
**Story Points**: 5
**Status**: TODO
**QA Verified**: NO
**Milestone**: M2
**Description**: Enhance the sprint board with separate planning and QA sub-views. Planning view shows committed tickets grouped by assignee with point totals. QA view shows ticket acceptance criteria as a checklist with pass/fail status. Retro view shows findings grouped by category with action tracking.
**Acceptance Criteria**:
- [ ] Planning sub-view: tickets grouped by assigned_to, showing point totals per role vs 8-pt cap
- [ ] QA sub-view: each ticket expanded with acceptance criteria as checkboxes, bug list, QA verified badge
- [ ] Retro sub-view: findings grouped by went_well/went_wrong/try_next with role badges and applied status
- [ ] Sprint velocity bar shows committed vs completed with percentage
- [ ] Sprint status badge (planning/active/review/closed) with appropriate colors
- [ ] Sub-views accessible via pill buttons within the sprint detail panel
**Dependencies**: T-021

---

## T-023: Onboard Security Specialist Agent
**Priority**: P1
**Assigned to**: architect
**Story Points**: 3
**Status**: TODO
**QA Verified**: NO
**Milestone**: M2
**Description**: Create a security-specialist agent definition in .claude/agents/security-specialist.md and register it via the scrum MCP write tools. The agent should focus on: dependency vulnerability scanning, SQL injection review, input validation audit, authentication patterns, and secure defaults. Update the agent team documentation.
**Acceptance Criteria**:
- [ ] .claude/agents/security-specialist.md created with proper frontmatter (name, description, model, tools)
- [ ] Agent has clear responsibilities: dependency audit, SQL injection review, input validation, auth patterns
- [ ] Agent imported into scrum database (verify with list_agents MCP tool)
- [ ] RESOURCE_PLANNING.md updated with the new role in the team capacity table
- [ ] SPRINT_PROCESS.md updated — security review added as a step before Day 5 ship
**Dependencies**: none

---

## T-024: Dashboard API — Skills & Agent Health Endpoints
**Priority**: P1
**Assigned to**: backend-dev
**Story Points**: 3
**Status**: TODO
**QA Verified**: NO
**Milestone**: M2
**Description**: Add API endpoints to dashboard.ts for reading skills content and computing agent health status. Skills endpoint returns rendered markdown content. Agent health computes status from recent ticket assignments and blocker count.
**Acceptance Criteria**:
- [ ] GET /api/skills — returns all skills with name and content
- [ ] GET /api/skill/:name — returns single skill content (for milestones, vision, etc.)
- [ ] GET /api/agents — returns all agents with computed health status (active/idle/blocked based on ticket assignments and blockers)
- [ ] Health logic: agent with DONE tickets in last sprint = active (green), no tickets = idle (yellow), has open blockers = blocked (red)
- [ ] All endpoints return proper JSON with error handling
**Dependencies**: none

---

## Deferred to Sprint 6
- T-025: Landing page with Remotion animation (8 pts) — requires dashboard restructure to be complete first
- T-026: Mobile-first responsive polish (3 pts) — after layout restructure settles
- T-027: Scrum tool integration tests (3 pts) — retro action from Sprint 4
- T-028: Error handling tests (2 pts) — retro action from Sprint 4
