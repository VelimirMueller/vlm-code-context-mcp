# Sprint 6 Tickets

Sprint: 2026-04-21 to 2026-04-25
Total Committed: 19 story points

---

## T-025: Landing Page with Enterprise Animation
**Priority**: P0
**Assigned to**: frontend-dev
**Story Points**: 8
**Status**: TODO
**Description**: Create a landing/splash page that loads before the dashboard. Features a CSS-only animation previewing the app scope (code indexing, sprint boards, team agents). Enterprise-grade dark aesthetic with a centered "Enter Dashboard" button. No Remotion dependency — pure CSS keyframes + SVG for zero-dependency constraint.
**Acceptance Criteria**:
- [ ] Landing page loads as the default view at /
- [ ] Animated visualization shows: code files indexing, sprint board assembling, agent nodes connecting
- [ ] Dark theme matching existing design tokens (--bg, --accent, --surface)
- [ ] "Enter Dashboard" button transitions smoothly to the main app
- [ ] Animation is performant (CSS transforms only, no JS animation loops)
- [ ] Mobile responsive (animation scales down, button remains accessible)
- [ ] No external dependencies (pure CSS + inline SVG)

---

## T-026: Mobile Responsive Polish
**Priority**: P1
**Assigned to**: frontend-dev
**Story Points**: 0 (bundled with T-025)
**Status**: TODO
**Description**: Ensure all dashboard pages work on mobile. Sidebar collapses, tables scroll horizontally, sprint cards stack vertically, agent grid adapts.
**Acceptance Criteria**:
- [ ] Sidebar hidden on screens < 768px
- [ ] Sprint cards stack vertically on mobile
- [ ] Ticket tables scroll horizontally on small screens
- [ ] Page navigation scrollable on narrow screens
- [ ] Touch targets minimum 44px

---

## T-027: Scrum Tool Integration Tests
**Priority**: P1
**Assigned to**: backend-dev
**Story Points**: 3
**Status**: TODO
**Description**: Write integration tests that call scrum tool functions directly and verify structured output.
**Acceptance Criteria**:
- [ ] Test list_agents returns agents after import
- [ ] Test list_sprints returns sprints with ticket counts
- [ ] Test get_sprint returns full sprint details
- [ ] Test create_ticket + get_ticket roundtrip
- [ ] Test search_scrum finds tickets by title
- [ ] All tests pass

---

## T-028: Error Handling Tests
**Priority**: P1
**Assigned to**: backend-dev
**Story Points**: 2
**Status**: TODO
**Description**: Write tests for error paths in the MCP tools.
**Acceptance Criteria**:
- [ ] Test index_directory with non-existent path returns error
- [ ] Test index_directory with file path returns error
- [ ] Test query tool rejects non-SELECT
- [ ] Test execute tool rejects DROP TABLE
- [ ] Test get_file_context for unindexed file returns helpful message

---

## T-029: Security Review
**Priority**: P1
**Assigned to**: security-specialist
**Story Points**: 3
**Status**: TODO
**Description**: First security audit. Run the security review checklist against all MCP tools and the dashboard.
**Acceptance Criteria**:
- [ ] SQL injection audit: all queries parameterized or validated
- [ ] Input validation: all tool inputs use zod schemas
- [ ] Error exposure: no stack traces in MCP responses
- [ ] npm audit run with no CRITICAL/HIGH issues
- [ ] Findings documented in BUGS.md or as notes on tickets

---

## T-030: Final Documentation Update
**Priority**: P1
**Assigned to**: lead-dev
**Story Points**: 3
**Status**: TODO
**Description**: Update README and all docs to reflect the current state: scrum MCP tools, dashboard pages, agent team, sprint process.
**Acceptance Criteria**:
- [ ] README reflects current tool count (10 code-context + 17 scrum = 27 tools)
- [ ] README documents the dashboard pages (Code Explorer, Sprint Process)
- [ ] README documents the agent team (9 roles including security)
- [ ] MILESTONES.md updated with completion status
- [ ] PRODUCT_VISION.md updated with current state
