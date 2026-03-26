# Retrospective Findings -- Sprint 3

## Sprint Metrics
- **Velocity**: 19 / 19 committed (100%)
- **Tickets DONE**: 4 / 4 committed (T-016, T-017, T-019, T-020)
- **Bugs found**: 0
- **Tests**: 42 passing, 3 skipped

---

## Product Owner
**What went well**: New scrum MCP epic was well-scoped. All 4 committed tickets shipped. Conservative 19-pt commitment after Sprint 2's 41% was the right call.
**What went wrong**: 7 deferred tickets from Sprint 2 were listed in the Sprint 3 backlog but confused the tracker — they showed up as "NOT_DONE" in Sprint 3 even though they were deferred, not failed.
**What to try**: Deferred tickets should only appear in the sprint they're actually committed to. Backlog items go in a separate section, not as sprint tickets.

## Scrum Master
**What went well**: Sprint 2 retro actions were applied — 8pt cap enforced, no dev exceeded it. Day 2 status check wasn't needed since all work was done directly by the orchestrator.
**What went wrong**: The "mandatory Day 2 status check" process assumes multi-day sprints with independent agents. In practice, all implementation was done in one session. Process needs adapting to AI-agent reality.
**What to try**: For AI-agent teams, replace "Day 2 check" with "checkpoint after first 2 tickets complete" — verify output on disk before starting remaining tickets.

## Manager
**What went well**: Zero overengineering. Schema is 9 tables with no premature abstractions. Tools are read-only first (write ops deferred). Total new code: 286 lines across 2 files.
**What went wrong**: Nothing rejected this sprint. That's good.
**What to try**: Continue the pattern — ship the minimal viable feature, validate through use, then extend. Write tools deferred to Sprint 4 was the right call.

## Backend Developer
**What went well**: 8 MCP tools implemented in 152 lines. Clean zod validation, structured text output, consistent pattern across all tools. Tests caught that the schema worked correctly.
**What went wrong**: Subagent delegation for src/ files failed again. The architect agent wrote correct code but it didn't land on disk. Had to be written directly.
**What to try**: All src/ changes must be written directly, never delegated to subagents. Subagents can plan and design, but the main agent must write the actual files.

## Architect
**What went well**: Clean modular split — src/scrum/ is completely separate from src/server/. Only 2 lines added to index.ts to wire it in. Build compiles both modules to dist/scrum/.
**What went wrong**: Dashboard needed scrum API endpoints but the architect didn't own that work — it fell between architect and frontend. Unclear ownership.
**What to try**: Dashboard server changes (adding API endpoints) should be assigned to whoever owns that component. Create a "dashboard-dev" role or explicitly assign dashboard.ts to architect.

## Frontend Developer
**What went well**: Sprint tab delivered! Selector, overview panel, ticket table with color badges, retro findings grouped by category. All using existing CSS variables.
**What went wrong**: Loading states (T-015 CSS) were added but not connected to the sprint tab's loading flow. The sprint tab has no skeleton while loading.
**What to try**: Every new dashboard section must have loading → content → error → empty states before it's considered DONE.

## QA Engineer
**What went well**: 8 new scrum schema tests caught constraint issues early. All 42 tests pass. Build is clean.
**What went wrong**: No integration tests for the MCP scrum tools themselves — only the schema is tested. We trust the tools work because the dashboard API works, but that's not a proper test.
**What to try**: Sprint 5 should add integration tests for scrum tools (call tool, verify response format).

---

## Actionable Changes for Sprint 4

### ACTION 1: All src/ file writes done directly, never by subagents
Subagents can research and design, but the main orchestrator writes all files under src/. This is now a hard rule.
**Owner**: Lead Developer
**Enforcement**: QA rejects any ticket where the evidence is "subagent wrote it" without disk verification.

### ACTION 2: Deferred tickets stay in backlog, not in sprint tickets
Tickets that are intentionally deferred should NOT appear as sprint tickets with NOT_DONE status. They go in a "Deferred" section of REJECTED_TICKETS.md.
**Owner**: Scrum Master

### ACTION 3: Dashboard sections require all 4 states (loading/content/error/empty)
Every new UI section must have: skeleton while loading, content when loaded, error message on failure, empty state when no data. Ticket is not DONE without all 4.
**Owner**: Frontend Developer
