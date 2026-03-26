# Sprint 2 Rejected Tickets

Reviewed by: Manager
Date: 2026-03-26

---

## T-008: Re-exports and Barrel Files Fix (3 pts) -- DEFERRED to Sprint 3

**Reason**: Backend-dev is already committed at 13 story points (maximum capacity per RESOURCE_PLANNING.md). Adding T-008 would push to 16 points, exceeding the safe range by 23%. Additionally, T-008 depends on both T-001 and T-002, meaning it could not start until late Day 2 at the earliest, leaving insufficient implementation time.

**Action**: Moved to Sprint 3 backlog. T-002 (import/export tests) will likely reveal specific re-export patterns that fail, which will sharpen T-008's acceptance criteria for next sprint.

---

## T-009: Summary Improvements -- DEFERRED

**Reason**: Not prioritized for Sprint 2. This is a quality-of-life improvement that depends on having a stable, tested foundation first. The current summaries work; they can be improved after Milestone 1 core quality is achieved.

**Action**: Remains in backlog, re-evaluate for Sprint 3 or 4.

---

## T-010: Large Codebase Optimization -- DEFERRED

**Reason**: Performance optimization should be driven by measurement, not assumption. Sprint 2 establishes the test infrastructure (T-001) that enables us to write benchmarks. Without benchmarks, optimizing is guesswork. Build the measurement tooling first, then optimize what the numbers say is slow.

**Action**: Remains in backlog. After T-001 and T-002 land, we can create a benchmark suite that identifies actual bottlenecks, then scope T-010 precisely.

---

## T-011: Cross-Platform Validation -- DEFERRED

**Reason**: The CI pipeline (T-006) runs on Ubuntu. Cross-platform validation (macOS, Windows WSL) requires either additional CI matrix entries or manual testing on multiple machines. This is valuable but lower priority than core test coverage and error handling. Better to defer until CI is running and stable.

**Action**: Remains in backlog. Consider adding macOS and Windows runners to CI in Sprint 3 as an extension of T-006.

---

## T-012: Dashboard Stability (2 pts) -- DEFERRED

**Reason**: T-012 depends on T-003 (integration tests), which is not in this sprint. The dependency cannot be satisfied.

**Action**: Remains in backlog. Will be eligible when T-003 is scheduled.

---

## Overengineering Review of Committed Tickets

The Manager reviewed all 8 committed tickets for overengineering concerns.

**Finding: No overengineering concerns identified.**

- T-001 (3 pts) is minimal scaffolding -- vitest config, one helper, fixture files, one smoke test. No framework, no complex abstractions.
- T-002 (5 pts) is proportional to the number of import/export syntax variants that exist in JS/TS. This is not gold-plating; it is covering the real surface area.
- T-004 (5 pts) could theoretically be scoped down, but the acceptance criteria are all concrete error scenarios that users will actually hit. No speculative error handling is included.
- T-006 (3 pts) is a standard GitHub Actions setup. Matrix on Node 18+20 is the minimum for an npm package. No Kubernetes, no Docker, no deployment automation.
- T-007 (3 pts) is documentation, which by nature cannot be overengineered for a developer tool. The scope is limited to README updates, not a documentation site.
- T-013, T-014, T-015 (8 pts total for frontend) are surgical improvements to the existing dashboard HTML file, not a rewrite. Each ticket adds one specific capability. This aligns with the DESIGN.md "Migration Path" section which explicitly calls for these exact changes.

**Conclusion**: Sprint 2 commitment is clean. All tickets solve real, current problems with the simplest approach that works.
