# Sprint 3 Rejected / Deferred Tickets

Reviewed by: Manager
Date: 2026-03-26

---

## T-004: Error Handling Hardening (5 pts) -- DEFERRED to Sprint 4

**Original Sprint**: Sprint 2 (NOT DONE -- subagent output did not land on disk)
**Assigned to**: backend-dev
**Reason**: The new Scrum MCP Service epic is the top business priority as directed by the product owner. Backend-dev capacity is capped at 8 points (retro action). T-017 (Scrum Read Tools, 8 pts) consumes the full backend allocation. T-004 is important technical debt but does not block the new epic.
**Risk of deferral**: Users may encounter stack traces instead of error messages when using existing code-context tools. This is a quality issue, not a functionality blocker. Acceptable for one more sprint.
**Action**: Moves to Sprint 4 backlog at P0 priority. Must not be deferred again.

---

## T-008: Re-exports + Async Function Parser Fix (3 pts) -- DEFERRED to Sprint 4

**Original Sprint**: Sprint 2 (deferred before Sprint 2 started, then again now)
**Assigned to**: backend-dev
**Reason**: Same capacity constraint as T-004. Fixes BUG-001 (async export parsing) and BUG-002 (re-export from clause). Both are MEDIUM severity -- they cause incomplete metadata but do not crash the server.
**Risk of deferral**: Codebases using `export async function` or `export { x } from './y'` patterns will have incomplete export metadata. Workaround: users can set manual descriptions.
**Action**: Moves to Sprint 4 backlog. Pair with T-004 if backend capacity allows.

---

## T-018: Scrum MCP Tools -- Write Operations (5 pts) -- DEFERRED to Sprint 4

**Reason**: Deliberate read-first design strategy. T-017 delivers read-only tools so the team can validate the schema design through actual use before building write operations. Shipping writes on an unvalidated schema risks rework -- if the schema is wrong, we change it once (Sprint 3) instead of changing both schema and write tools (Sprint 4).
**Risk of deferral**: Scrum data can only be read, not created via MCP during Sprint 3. Data must be seeded from markdown files or manually inserted. This is acceptable for an MVP.
**Action**: Sprint 4 priority ticket. Schema feedback from Sprint 3 usage informs final write tool design.

---

## T-007: Documentation for Senior Engineers (3 pts) -- DEFERRED to Sprint 4

**Original Sprint**: Sprint 2 (PARTIAL -- README improved, schema reference and 10-tool reference still needed)
**Assigned to**: lead-dev
**Reason**: Lead-dev capacity is reserved for code review and conflict resolution on the new epic. Documentation updates make more sense after the new scrum tools and modular architecture are implemented -- documenting a moving target wastes effort.
**Risk of deferral**: Developer onboarding documentation remains incomplete. Mitigated by existing README which covers quick-start and basic usage.
**Action**: Sprint 4 backlog. Scope expands to include new scrum MCP tools in the documentation.

---

## T-013: Dashboard Hash Routing and State Persistence (3 pts) -- DEFERRED to Sprint 4-5

**Original Sprint**: Sprint 2 (NOT DONE -- frontend dev had 0 output)
**Assigned to**: frontend-dev
**Reason**: Frontend-dev's Sprint 3 allocation is fully consumed by T-019 (Dashboard Sprint View, 5 pts). T-019 is a higher priority because it delivers user-facing value for the new epic. Hash routing is a quality-of-life improvement for the existing dashboard -- important but not urgent.
**Risk of deferral**: Dashboard state is lost on page refresh. Users must re-navigate after refresh. Annoying but not blocking.
**Action**: Sprint 4 or 5 backlog, depending on frontend capacity after T-019 learnings.

---

## T-014: Dashboard Keyboard Shortcuts and Search (3 pts) -- DEFERRED to Sprint 4-5

**Original Sprint**: Sprint 2 (NOT DONE)
**Assigned to**: frontend-dev
**Reason**: Same as T-013 -- T-019 is the frontend priority. Keyboard shortcuts are a power-user feature; the dashboard works fine without them.
**Risk of deferral**: Low. Mouse navigation works. No user complaints about this.
**Action**: Sprint 4 or 5 backlog.

---

## T-015: Dashboard Loading and Error States (2 pts) -- DEFERRED to Sprint 4-5

**Original Sprint**: Sprint 2 (NOT DONE)
**Assigned to**: frontend-dev
**Reason**: Same as T-013 and T-014. However, note that T-019 acceptance criteria include loading and empty states for the sprint view specifically. The pattern established in T-019 can be applied to the rest of the dashboard in a future sprint.
**Risk of deferral**: Existing dashboard shows raw API errors on failure. Acceptable for a developer tool.
**Action**: Sprint 4 or 5 backlog. Consider combining with T-013 into a single "Dashboard Polish" ticket.

---

## Overengineering Review of Committed Tickets

The Manager reviewed all 4 committed tickets for overengineering concerns.

### T-016 (Scrum DB Schema, 3 pts) -- CLEAN
9 tables is proportional to the 9 artifact types in the existing `.claude/scrum/` system. No speculative tables. Schema mirrors the markdown files that already exist. Inline comments requirement is documentation, not gold-plating.

### T-017 (Scrum Read Tools, 8 pts) -- WATCH ITEM
8 points is at the developer cap. The seed script (parsing markdown into SQLite) could become a time sink if the markdown formats are inconsistent. **Mitigation**: If the seed script takes more than 1 day, descope it to manual SQL inserts and move seed script to Sprint 4. The 6 tools themselves are structurally identical -- query, format, return -- and should not be a problem.

### T-019 (Dashboard Sprint View, 5 pts) -- CLEAN
MVP scope is appropriate. No charts, no animations, no drag-and-drop. Just a data table with color-coded statuses and an expandable detail view. This is the right amount of UI for a first iteration.

### T-020 (Modular Architecture, 3 pts) -- WATCH ITEM
Refactoring a working codebase carries inherent risk. The "all 34 tests must pass" acceptance criterion is the safety net. **Concern**: If the refactor touches too many files, the diff becomes hard to review and easy to break. **Mitigation**: Architect should do the refactor in 3-4 small, tested steps (move files, update imports, verify tests, then register scrum module). Not one big bang commit.

**Conclusion**: Sprint 3 commitment is appropriately scoped. Two watch items (T-017 seed script, T-020 refactor risk) have clear mitigations. No tickets rejected for overengineering.
