# Sprint 2 Planning

## Sprint Goal

Establish a comprehensive test infrastructure with 85%+ coverage on import/export parsing, harden all error paths so no MCP tool ever returns a stack trace, and make the dashboard stateful across page refreshes with keyboard-first navigation.

---

## Sprint Dates

| Day | Date | Focus |
|-----|------|-------|
| Day 1 | 2026-03-31 | Sprint Planning |
| Day 2 | 2026-04-01 | Implementation |
| Day 3 | 2026-04-02 | Implementation |
| Day 4 | 2026-04-03 | QA + Polish |
| Day 5 | 2026-04-04 | Ship + Retro |

---

## Team Capacity

| Role | Implementation Days | Available Points | Committed Points |
|------|-------------------|-----------------|-----------------|
| Backend Developer | 2.5 | 8-13 | 13 |
| Frontend Developer | 2.5 | 8-13 | 8 |
| Architect | 1.5 | 3-5 | 3 |
| Lead Developer | 1.0 | 2-3 | 3 |
| QA Engineer | 1.0 (Day 4) | N/A | N/A (writes test specs Day 2-3) |
| PO | 0 | N/A | N/A |
| Scrum Master | 0 | N/A | N/A |
| Manager | 0 | N/A | N/A |

**Sprint Capacity Target**: 25 story points
**Sprint Commitment**: 27 story points (8% over target -- acceptable given motivated team and zero unknowns on test infra)

---

## Committed Tickets

| Ticket | Title | Points | Assignee | Priority | Dependencies |
|--------|-------|--------|----------|----------|-------------|
| T-001 | Set Up Test Infrastructure | 3 | backend-dev | P0 | none |
| T-002 | Unit Tests Import/Export Parsing | 5 | backend-dev | P0 | T-001 |
| T-004 | Error Handling Hardening | 5 | backend-dev | P0 | T-001 |
| T-006 | CI/CD Pipeline | 3 | architect | P1 | T-001 |
| T-007 | Documentation for Senior Engineers | 3 | lead-dev | P1 | none |
| T-013 | Dashboard Hash Routing + State Persistence | 3 | frontend-dev | P1 | none |
| T-014 | Dashboard Keyboard Shortcuts + Search | 3 | frontend-dev | P1 | none |
| T-015 | Dashboard Loading/Error States | 2 | frontend-dev | P2 | none |

**Total: 27 story points across 8 tickets**

---

## Dependency Graph

```
T-001 (test infra)
  |-- T-002 (import/export tests)
  |-- T-004 (error handling tests)
  |-- T-006 (CI needs tests to run)

T-007 (docs) -- independent
T-013 (hash routing) -- independent
T-014 (keyboard shortcuts) -- independent
T-015 (loading/error states) -- independent
```

**Critical path**: T-001 must be completed early Day 2 to unblock T-002, T-004, and T-006. Backend-dev starts with T-001 on Day 1 afternoon / Day 2 morning.

---

## Retro Actions Being Applied (from Sprint 1)

1. **Unified ticket IDs across all sprint files**: All files in this sprint use the same T-XXX identifiers. No separate numbering in SUBTASKS.md or PLANNING.md. If a subtask references a ticket, it uses the ticket ID from TICKETS.md.

2. **QA writes test specs during Day 2-3**: Instead of waiting until Day 4 to discover what needs testing, QA writes acceptance test specifications for T-001, T-002, and T-004 during Day 2-3. This gives backend-dev a concrete checklist and reduces Day 4 surprises.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| T-001 blocks three tickets; any delay cascades | Medium | High | Backend-dev starts T-001 immediately on Day 1 afternoon. It is only 3 points and well-scoped. |
| Backend-dev at 13 points (max capacity) | Medium | Medium | T-004 can shed scope: focus on the 5 most critical error paths first, defer edge cases to Sprint 3 if needed. |
| better-sqlite3 in-memory mode behaves differently than file-based | Low | Medium | Smoke test in T-001 catches this immediately. If issues arise, use temp file databases instead. |
| Dashboard changes (T-013, T-014, T-015) have no automated tests | Medium | Low | QA manually verifies on Day 4. Frontend tickets are independent so partial delivery is acceptable. |
| CI pipeline (T-006) depends on T-001 being merged | Low | Low | Architect can set up the workflow YAML and test with the smoke test from T-001 before full suite exists. |

---

## Definition of Done

A ticket is "Done" when ALL of the following are true:

1. All acceptance criteria from TICKETS.md are met
2. Code is reviewed by lead-dev (or architect for infra tickets)
3. Tests pass locally and (once T-006 is done) in CI
4. No CRITICAL or HIGH bugs remain against the ticket after QA Day
5. Relevant documentation is updated (README for T-007, inline comments for code changes)

---

## Sprint Summary

**Completed tickets (QA verified)**:
- T-001: Set Up Test Infrastructure (3 pts) -- DONE, QA VERIFIED
- T-002: Unit Tests for Import/Export Parsing (5 pts) -- DONE, QA VERIFIED (2 known limitations documented)
- T-006: CI/CD Pipeline (3 pts) -- DONE, QA VERIFIED

**Partial tickets**:
- T-007: Documentation for Senior Engineers (3 pts) -- PARTIAL (README improved, schema reference and full tool reference still needed)

**Not completed (carry to Sprint 3)**:
- T-004: Error Handling Hardening (5 pts) -- NOT DONE (subagent could not write files; needs fresh implementation)
- T-013: Dashboard Hash Routing (3 pts) -- NOT DONE (frontend dev capacity unused)
- T-014: Dashboard Keyboard Shortcuts (3 pts) -- NOT DONE
- T-015: Dashboard Loading/Error States (2 pts) -- NOT DONE

**Velocity**: 11 / 27 committed (3 DONE tickets = 11 pts)
**Bugs found**: 2 (BUG-001: async export parsing, BUG-002: re-export from clause)
**Bugs fixed**: 0 (both MEDIUM, deferred to T-008 in Sprint 3)

**Key learnings**:
- Subagent-based implementation is unreliable for source code changes — agents that need to modify src/ files should run with explicit file write capability or be done directly
- Backend dev was overloaded at 13 pts while frontend dev had 0 output — rebalance in Sprint 3
- Test infrastructure and parser tests delivered real value: discovered 2 actual parser bugs
- CI/CD was clean execution — straightforward infrastructure tickets work well as subagent tasks
