# Sprint 2 Tickets

Sprint: 2026-03-31 to 2026-04-04
Milestone: M1 -- Rock Solid Foundation
Total Committed: 27 story points

---

## T-001: Set Up Test Infrastructure
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 3
**Milestone**: M1 -- Rock Solid Foundation
**Status**: DONE
**QA Verified**: YES
**Description**: Install vitest and configure the test runner for the project. Create reusable test helpers (in-memory SQLite factory, fixture loading utilities) and a fixture directory with representative sample files (TypeScript, JavaScript, JSON, Markdown). This is the foundation every other test ticket depends on.
**Acceptance Criteria**:
- [x] vitest installed and configured with TypeScript support
- [x] `npm test`, `npm run test:coverage`, and `npm run test:watch` scripts work
- [x] `test/helpers/db.ts` exports a `createTestDb()` factory that returns a fresh in-memory SQLite database with the full schema applied
- [x] `test/fixtures/` contains at least 5 representative sample files covering TS, JS, JSON, and MD
- [x] One smoke test passes: index fixture directory, query file count, assert > 0
- [x] Coverage reporter outputs to `coverage/` directory
**Dependencies**: none
**Verified by**: QA — `npm test` passes (11 smoke tests), `npm run test:coverage` generates report, all fixture files present (10 files across TS, JSON, MD, CSS)

---

## T-002: Unit Tests for Import/Export Parsing
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 5
**Milestone**: M1 -- Rock Solid Foundation
**Status**: DONE
**QA Verified**: YES
**Description**: Write comprehensive unit tests for the import and export parsing logic in `src/server/indexer.ts`.
**Acceptance Criteria**:
- [x] Tests cover named exports (`export function`, `export const`, `export class`)
- [x] Tests cover default exports (`export default`)
- [x] Tests cover named imports (`import { x } from './y'`)
- [x] Tests cover star imports (`import * as x from './y'`)
- [x] Tests cover type-only imports/exports (`import type`, `export type`)
- [ ] Tests cover dynamic imports (`import('./x')`) — KNOWN LIMITATION: regex parser does not detect dynamic imports. Documented as skipped test.
- [x] Tests verify import resolution (relative paths resolve to correct file IDs in DB)
- [x] Tests verify that malformed/empty files do not crash the parser
- [ ] All tests pass and coverage for import/export parsing functions is above 85% — 23/26 tests pass, 3 skipped (documented limitations)
**Dependencies**: T-001
**Verified by**: QA — 23 tests passing. 3 documented limitations: (1) `export async function` not captured, (2) `export { x } from './y'` re-exports not in exports table, (3) dynamic imports not detected. All tracked for T-008.
**Bugs Found**:
- BUG-001: `export async function` not captured by regex (MEDIUM — tracked for T-008)
- BUG-002: Re-exports with `from` clause not added to exports table (MEDIUM — tracked for T-008)

---

## T-004: Error Handling Hardening
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 5
**Milestone**: M1 -- Rock Solid Foundation
**Status**: NOT DONE
**QA Verified**: NO
**Description**: Audit every MCP tool handler and the indexer for unhandled exceptions. Ensure every tool returns a meaningful error message instead of a stack trace.
**Acceptance Criteria**:
- [ ] Every MCP tool handler wrapped in try/catch with structured error response
- [ ] Missing file path returns clear "File not found" error, not a stack trace
- [ ] Corrupt or locked database returns "Database unavailable" with recovery hint
- [ ] Permission denied on file/directory returns actionable message
- [ ] Files exceeding a size threshold (e.g., 1MB) are skipped with a warning, not a crash
- [ ] Invalid or missing tool arguments return validation errors listing what is wrong
- [ ] Unit tests for each error scenario (at least 8 error path tests)
- [ ] No unhandled promise rejections in any tool handler
**Dependencies**: T-001
**Note**: Implementation was attempted by subagent but changes did not land on disk. Ticket moves to Sprint 3.

---

## T-006: CI/CD Pipeline
**Priority**: P1
**Assigned to**: architect
**Story Points**: 3
**Milestone**: M1 -- Rock Solid Foundation
**Status**: DONE
**QA Verified**: YES
**Description**: Create a GitHub Actions CI pipeline that runs on every push and PR.
**Acceptance Criteria**:
- [x] `.github/workflows/ci.yml` exists and runs on push to `main` and on all PRs
- [x] Pipeline runs `tsc --noEmit` for type checking
- [x] Pipeline runs `npm test` and fails the build if any test fails
- [x] Pipeline runs on Node.js 18 and 20 (matrix build) — also includes Node 22
- [x] Pipeline caches `node_modules` for faster runs
- [ ] Pipeline completes in under 3 minutes on GitHub Actions — not yet verified (needs first push)
- [x] Badge added to README showing CI status
**Dependencies**: T-001
**Verified by**: QA — ci.yml and publish.yml both created. CI tests Node 18/20/22 matrix. Publish triggers on `v*` tags with npm provenance. README badge added.

---

## T-007: Documentation for Senior Engineers
**Priority**: P1
**Assigned to**: lead-dev
**Story Points**: 3
**Milestone**: M1 -- Rock Solid Foundation
**Status**: PARTIAL
**QA Verified**: NO
**Description**: Rewrite the project documentation targeting senior engineers.
**Acceptance Criteria**:
- [x] README has a "Why this tool?" section with the concrete problem statement
- [x] README has a quick-start section
- [ ] Architecture doc explains the 5-table schema with a diagram or table — existing README has partial coverage, needs schema reference table
- [ ] Tool reference section lists all 10 MCP tools with parameters and examples — existing docs/ has individual tool pages but README tool reference is incomplete
- [ ] All code examples are copy-pasteable and tested
- [x] No marketing language -- technical and direct
**Dependencies**: none
**Note**: README was improved with CI badge and already had good problem statement/quick-start. Schema reference and full 10-tool reference still needed. Carries to Sprint 3.

---

## T-013: Dashboard Hash Routing and State Persistence
**Priority**: P1
**Assigned to**: frontend-dev
**Story Points**: 3
**Milestone**: M1 -- Rock Solid Foundation
**Status**: NOT DONE
**QA Verified**: NO
**Description**: Add hash-based routing to the dashboard so that selected state survives page refresh.
**Acceptance Criteria**:
- [ ] Selecting a file updates the URL hash to `#file/{fileId}`
- [ ] Switching tabs updates the hash
- [ ] Refreshing the page restores the selected file and active tab from the hash
- [ ] Browser back/forward buttons navigate between previous states
- [ ] Sharing a URL with a hash opens the dashboard in the correct state
- [ ] Hash updates are debounced
- [ ] Default state (no hash) loads the overview/file list as today
**Dependencies**: none
**Note**: Not implemented. Frontend dev capacity was not used this sprint. Carries to Sprint 3.

---

## T-014: Dashboard Keyboard Shortcuts and Search
**Priority**: P1
**Assigned to**: frontend-dev
**Story Points**: 3
**Milestone**: M1 -- Rock Solid Foundation
**Status**: NOT DONE
**QA Verified**: NO
**Description**: Add keyboard-first navigation to the dashboard.
**Acceptance Criteria**:
- [ ] Cmd+K / Ctrl+K focuses the search input
- [ ] Typing in search filters the file tree in real time
- [ ] Matched characters in file names are visually highlighted
- [ ] Arrow Up/Down navigates through visible file tree items
- [ ] Enter selects the currently highlighted file
- [ ] Esc clears the search input
- [ ] Keyboard shortcuts do not conflict with browser defaults
- [ ] A small shortcut hint is displayed near the search input
**Dependencies**: none
**Note**: Not implemented. Carries to Sprint 3.

---

## T-015: Dashboard Loading and Error States
**Priority**: P2
**Assigned to**: frontend-dev
**Story Points**: 2
**Milestone**: M1 -- Rock Solid Foundation
**Status**: NOT DONE
**QA Verified**: NO
**Description**: Add proper loading and error states for all API calls in the dashboard.
**Acceptance Criteria**:
- [ ] File tree shows a skeleton loading state
- [ ] File detail panel shows a skeleton
- [ ] API errors display a clear message in the affected panel
- [ ] Error messages include a "Retry" action
- [ ] Empty states show a helpful message
- [ ] SSE disconnection shows a visible indicator
- [ ] All loading states use CSS animations, no external dependencies
**Dependencies**: none
**Note**: Not implemented. Carries to Sprint 3.
