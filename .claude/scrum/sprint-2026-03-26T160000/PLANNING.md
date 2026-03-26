# Sprint 3 Planning

## Sprint Goal

Deliver read-only MCP tools for scrum data backed by a new SQLite database, a modular server architecture separating code-context from scrum, and an MVP dashboard page visualizing sprint tickets and retro findings.

---

## Sprint Dates

| Day | Date | Focus |
|-----|------|-------|
| Day 1 | 2026-04-07 | Sprint Planning |
| Day 2 | 2026-04-08 | Implementation |
| Day 3 | 2026-04-09 | Implementation |
| Day 4 | 2026-04-10 | QA + Polish |
| Day 5 | 2026-04-11 | Ship + Retro |

---

## Team Capacity

| Role | Max Points (Cap) | Committed Points | Tickets |
|------|-----------------|-----------------|---------|
| Backend Developer | 8 | 8 | T-017 |
| Frontend Developer | 8 | 5 | T-019 |
| Architect | 8 | 6 | T-016, T-020 |
| Lead Developer | 8 | 0 | Code review, conflict resolution |
| QA Engineer | N/A | N/A | Day 4 verification |
| PO | N/A | N/A | Backlog, acceptance criteria |
| Scrum Master | N/A | N/A | Blockers, status checks |
| Manager | N/A | N/A | Overengineering review |

**Sprint Capacity Target**: 18 story points (conservative after Sprint 2 velocity of 11/27)
**Sprint Commitment**: 19 story points (6% over target -- acceptable given all tickets are well-scoped)
**Max per developer**: 8 points (enforced -- retro action from Sprint 2)

---

## Committed Tickets

| Ticket | Title | Points | Assignee | Priority | Dependencies |
|--------|-------|--------|----------|----------|-------------|
| T-016 | Design Scrum Database Schema | 3 | architect | P0 | none |
| T-017 | Scrum MCP Read Tools | 8 | backend-dev | P0 | T-016 |
| T-019 | Dashboard Sprint View -- MVP | 5 | frontend-dev | P1 | T-017 |
| T-020 | Modular Server Architecture | 3 | architect | P0 | T-017 |

**Total: 19 story points across 4 tickets**

---

## Dependency Graph

```
T-016 (scrum DB schema) -- Day 1 afternoon
  |
  v
T-017 (scrum read tools) -- Day 2-3, needs T-016 schema finalized
  |
  +-- T-019 (dashboard sprint view) -- Day 2-3, needs T-017 API
  |
  +-- T-020 (modular architecture) -- Day 3, needs T-017 tools to register
```

**Critical path**: T-016 must be completed by end of Day 1. Architect starts T-016 during planning afternoon so backend-dev can start T-017 on Day 2 morning. Frontend-dev can work on T-019 layout and UI independently on Day 2, then integrate with T-017 API on Day 3.

---

## Retro Actions Being Applied (from Sprint 2)

1. **Max 8 points per developer**: Enforced in capacity table. No developer exceeds 8 committed points. Backend-dev is at exactly 8 (T-017). Architect is at 6 (T-016 + T-020). Frontend-dev is at 5 (T-019).

2. **Mandatory Day 2 status check**: Scrum Master will verify at end of Day 2 that every assigned developer has at least one subtask IN_PROGRESS or DONE with evidence on disk. Zero-progress roles are escalated immediately. This was the most impactful finding from Sprint 2 retro.

3. **Verify subagent output on disk**: All work delegated to subagents must be verified by the developer before marking done. `ls`, `test -f`, `npm test` are required evidence. "Subagent said it's done" is not accepted. QA will reject tickets without on-disk evidence.

4. **Frontend must deliver**: Frontend-dev had 0 output in Sprint 2. T-019 is a single, focused ticket with clear acceptance criteria. If blocked on T-017 API, frontend-dev builds the UI layout and loading/empty states first (these are independent of the API).

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| T-016 schema not finalized by end of Day 1, blocking T-017 | Low | High | Schema is well-understood from existing markdown structure. Architect has clear input. PO reviews criteria before planning ends. |
| T-017 is 8 pts and the heaviest ticket -- backend-dev overloaded | Medium | High | 6 of the tools are structurally identical (query DB, format JSON). Seed script is the real complexity. Backend-dev starts with DB init + 2 simplest tools, builds momentum. |
| T-019 blocked waiting for T-017 API | Medium | Medium | Frontend-dev builds UI layout, loading states, and mock data on Day 2 independently. Integrates with real API on Day 3 when T-017 is available. |
| T-020 refactoring breaks existing tests | Low | High | T-020 acceptance criteria explicitly requires all 34 tests to pass. Architect does refactor in small steps with test runs after each move. |
| New epic is ambitious for a team that just did 41% velocity | Medium | Medium | Commitment is 19 pts vs Sprint 2's 27 pts (30% reduction). All tickets are new, well-scoped, and don't carry Sprint 2 baggage. Clean slate reduces risk. |
| Subagent output not verified (repeat of Sprint 2 failure) | Low | High | Retro action explicitly addresses this. Day 2 status check catches it early. QA rejects unverified work on Day 4. |

---

## Deferred Tickets (Manager Decision)

| Ticket | Points | Reason for Deferral | Target Sprint |
|--------|--------|---------------------|---------------|
| T-004 | 5 | New Scrum MCP epic takes priority over technical debt | Sprint 4 |
| T-008 | 3 | New epic priority; parser fixes are not blocking | Sprint 4 |
| T-018 | 5 | Read-first approach; validate schema before building writes | Sprint 4 |
| T-007 | 3 | New epic priority; docs can follow implementation | Sprint 4 |
| T-013 | 3 | T-019 is the frontend priority this sprint | Sprint 4-5 |
| T-014 | 3 | T-019 is the frontend priority this sprint | Sprint 4-5 |
| T-015 | 2 | T-019 is the frontend priority this sprint | Sprint 4-5 |

**Total deferred**: 24 story points. This is intentional -- Sprint 2 taught us that overcommitting destroys velocity. Better to ship 19 pts at 100% than commit 40 pts at 41%.

---

## Definition of Done

A ticket is "Done" when ALL of the following are true:

1. All acceptance criteria from TICKETS.md are checked off with evidence
2. Code is reviewed by lead-dev (or architect for infra tickets)
3. Tests pass locally and in CI (`npm test` exits 0)
4. No CRITICAL or HIGH bugs remain against the ticket after QA Day
5. Files exist on disk -- verified by QA with `ls`, `test -f`, or equivalent
6. Sign-off recorded in TICKETS.md by someone OTHER than the implementer
7. The implementer cannot sign off their own work (cross-verification required)

---

## Sprint Summary

_To be filled on Day 5 (2026-04-11) after QA verification and retro._

**Completed tickets (QA verified)**:
- _(pending)_

**Partial tickets**:
- _(pending)_

**Not completed**:
- _(pending)_

**Velocity**: _TBD_ / 19 committed
**Bugs found**: _TBD_
**Bugs fixed**: _TBD_
**Tickets completed vs committed**: _TBD_ / 4

**Key learnings**:
- _(to be filled during retro)_
