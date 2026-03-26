# Retrospective Findings -- Sprint 4 (Debt Clearance Sprint)

## Sprint Metrics
- **Velocity**: 24 / 24 committed (100%)
- **Tickets DONE**: 7 / 7 (T-004, T-007, T-008, T-013, T-014, T-015, T-018)
- **Bugs found**: 0
- **Tests**: 44 passing, 1 skipped

---

## Product Owner
**What went well**: Every piece of carry-over debt is now cleared. Zero undone tickets across all 4 sprints. Product is feature-complete for Milestone 1 + the scrum MCP epic.
**What went wrong**: Sprint 4 was a cleanup sprint that shouldn't have been necessary. If Sprint 2 had been scoped properly (15 pts instead of 27), we'd be one sprint ahead.
**What to try**: Never commit more than 20 pts until the team has 3 sprints of velocity data. We now have that data: S1=21, S2=11, S3=19, S4=24. Rolling average: 19 pts.

## Scrum Master
**What went well**: The "write directly, verify on disk" rule from Sprint 3 retro worked perfectly. Every file change was verified with `ls`, `npm test`, and `npm run build` before being marked done.
**What went wrong**: Sprint 4 was not formally planned with a separate TICKETS.md — it was executed as "finish everything." Process was skipped for speed.
**What to try**: Even cleanup sprints need a TICKETS.md with acceptance criteria. Without it, there's no QA sign-off standard.

## Manager
**What went well**: The parser fix (T-008) was 2 lines of regex change + 2 test updates. The error handling (T-004) was surgical — SQL injection protection added without rewriting tools. Cost-effective fixes.
**What went wrong**: The scrum data import had a race condition — `INSERT OR REPLACE` on sprints caused CASCADE deletes that wiped ticket statuses. This was a data integrity bug that took multiple iterations to fix.
**What to try**: Any import function that touches foreign-key-linked data must use `ON CONFLICT ... DO UPDATE`, never `INSERT OR REPLACE`. Add this as a coding standard.

## Backend Developer
**What went well**: T-018 (scrum write tools) added 9 tools in one clean implementation. T-008 regex fixes were minimal and precise. Both BUG-001 and BUG-002 are resolved.
**What went wrong**: The import.ts data bridge was brittle — it parsed markdown with regex and broke on edge cases (Sprint 1 tickets had no Status field). Should have been more defensive from the start.
**What to try**: Markdown parsing should always have fallback defaults. If a field is missing, default to a sensible value, don't produce wrong data.

## Architect
**What went well**: The `ON CONFLICT(sprint_id, ticket_ref) DO UPDATE` pattern solved the data integrity issue cleanly. Adding UNIQUE constraint to the tickets table was the right architectural fix.
**What went wrong**: Should have designed the import with idempotency from the start. The UNIQUE constraint should have been in the original schema, not added as a hotfix.
**What to try**: Every table that will be populated via import MUST have a UNIQUE constraint on the natural key (not just the autoincrement id). Design for re-import from day one.

## Frontend Developer
**What went well**: T-013 (hash routing), T-014 (keyboard shortcuts), and T-015 (loading states) all shipped. Cmd+K search works, arrow navigation works, hash state survives refresh.
**What went wrong**: The sprint tab still doesn't have a loading skeleton — it just shows nothing while fetching. Sprint 3 retro action "all 4 states" was not fully applied.
**What to try**: Add sprint tab skeleton in Sprint 5. This is the last UI gap.

## QA Engineer
**What went well**: Verified every file on disk before marking DONE. The "subagent output is not evidence" rule prevented false completions. Final state: 44 tests, 1 skip (dynamic imports — documented limitation).
**What went wrong**: No new tests were written for T-004 (error handling) or T-018 (scrum write tools). These are tested implicitly through the build + existing tests, but explicit error path tests would be better.
**What to try**: Sprint 5 should add error handling tests and scrum tool integration tests.

---

## Actionable Changes for Sprint 5

### ACTION 1: Import functions must be idempotent by design
Tables populated via import MUST have UNIQUE constraints on natural keys. Use `ON CONFLICT DO UPDATE` with field-level preservation logic (e.g., don't overwrite DONE status).
**Owner**: Architect

### ACTION 2: Add sprint tab loading skeleton
The sprint dashboard section needs a skeleton state while API calls are in flight. Same pattern as the file detail panel.
**Owner**: Frontend Developer

### ACTION 3: Write error handling + scrum tool integration tests
Add test/errors.test.ts for T-004 error paths and test/scrum-tools.test.ts for T-018 write operations.
**Owner**: QA + Backend Developer

### ACTION 4: Rolling velocity target = 19 pts
Based on 4 sprints of data (21, 11, 19, 24), the rolling average is 19. Use this as the Sprint 5 commitment target.
**Owner**: PO + Scrum Master
