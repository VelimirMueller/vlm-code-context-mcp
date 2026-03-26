# Sprint 2 Subtasks

Each team member breaks their committed tickets into concrete implementation steps.
Status: TODO / IN_PROGRESS / DONE / BLOCKED

---

## Backend Developer

### T-001: Set Up Test Infrastructure (3 pts)

- [ ] Install vitest, @vitest/coverage-v8, and relevant @types as devDependencies
- [ ] Create `vitest.config.ts` at project root with TypeScript support, coverage config outputting to `coverage/`, and test file glob `test/**/*.test.ts`
- [ ] Create `test/helpers/db.ts` with `createTestDb()` factory: opens in-memory better-sqlite3, runs schema from `src/server/schema.ts`, returns db instance
- [ ] Create `test/helpers/fixtures.ts` with `getFixturePath(name)` utility and `createTempFixtureDir()` for isolated test directories
- [ ] Create `test/fixtures/` directory with sample files:
  - `sample.ts` (named exports, default export, imports)
  - `sample.js` (CommonJS require + module.exports)
  - `sample.json` (valid JSON config file)
  - `sample.md` (Markdown with frontmatter)
  - `empty.ts` (empty file -- edge case)
- [ ] Write `test/smoke.test.ts`: index the fixture directory using the indexer, query file count from DB, assert count matches fixture file count
- [ ] Add npm scripts to `package.json`: `"test": "vitest run"`, `"test:coverage": "vitest run --coverage"`, `"test:watch": "vitest"`
- [ ] Verify `npm test` passes, `npm run test:coverage` generates `coverage/` output

### T-002: Unit Tests for Import/Export Parsing (5 pts)

- [ ] Create `test/unit/exports.test.ts`:
  - Test `export function foo()` is detected as named export with kind "function"
  - Test `export const bar = ...` is detected with kind "const"
  - Test `export class Baz` is detected with kind "class"
  - Test `export default function` is detected as default export
  - Test `export default class` is detected as default export
  - Test `export { x, y, z }` grouped exports are detected individually
  - Test `export type { Foo }` type exports are detected with correct kind
- [ ] Create `test/unit/imports.test.ts`:
  - Test `import { x } from './y'` resolves to correct file ID
  - Test `import * as ns from './y'` star import is recorded
  - Test `import type { T } from './y'` type-only import is recorded
  - Test `import('./dynamic')` dynamic import is detected
  - Test `import x from './y'` default import is recorded
  - Test import of non-existent file does not crash, records unresolved dependency
- [ ] Create `test/unit/edge-cases.test.ts`:
  - Test empty file produces zero exports and zero imports
  - Test file with syntax errors does not crash parser
  - Test file with only comments produces zero exports
  - Test very long lines (10K+ chars) do not hang the parser
  - Test binary file (e.g., `.png` in fixtures) is skipped gracefully
- [ ] Create fixture files for each test scenario in `test/fixtures/exports/` and `test/fixtures/imports/`
- [ ] Run coverage check: import/export parsing functions must be above 85%

### T-004: Error Handling Hardening (5 pts)

- [ ] Audit `src/server/index.ts`: list every MCP tool handler and identify which ones lack try/catch
- [ ] Create `src/server/errors.ts`: define structured error response helper `toolError(code, message, details?)` that returns MCP-compliant error format
- [ ] Wrap every tool handler in try/catch, returning `toolError()` instead of letting exceptions propagate
- [ ] Add specific error handling for:
  - File not found (ENOENT) -> "File not found: {path}"
  - Permission denied (EACCES) -> "Permission denied: {path}"
  - Database locked/corrupt (SQLITE_BUSY, SQLITE_CORRUPT) -> "Database unavailable. Try again or re-index."
  - Invalid tool arguments (missing required params, wrong types) -> validation error listing issues
- [ ] Add file size check in indexer: skip files > 1MB with a logged warning instead of attempting to parse
- [ ] Ensure no unhandled promise rejections: add `process.on('unhandledRejection')` handler in server entry point
- [ ] Create `test/unit/error-handling.test.ts`:
  - Test tool call with missing required argument returns validation error
  - Test tool call referencing non-existent file returns "File not found"
  - Test indexing a directory with permission-denied file skips it gracefully
  - Test indexing a file > 1MB skips it with warning
  - Test tool call on corrupt database returns "Database unavailable"
  - Test query with no indexed data returns empty result, not error
  - Test tool call with extra/unknown arguments is handled gracefully
  - Test concurrent tool calls do not corrupt shared state

---

## Architect

### T-006: CI/CD Pipeline (3 pts)

- [ ] Create `.github/workflows/ci.yml` with trigger on push to `main` and on all pull requests
- [ ] Configure Node.js matrix strategy: test on Node 18.x and 20.x
- [ ] Add steps: checkout, setup-node with cache (npm), `npm ci`, `tsc --noEmit`, `npm test`
- [ ] Configure `node_modules` caching using `actions/setup-node` built-in cache
- [ ] Add better-sqlite3 build dependencies for CI environment (build-essential on Ubuntu runner)
- [ ] Test the workflow locally using `act` or by pushing to a feature branch
- [ ] Add CI status badge to README.md (`![CI](https://github.com/VelimirMueller/mcp-server/actions/workflows/ci.yml/badge.svg)`)
- [ ] Verify pipeline completes in under 3 minutes on GitHub Actions

---

## Lead Developer

### T-007: Documentation for Senior Engineers (3 pts)

- [ ] Write "Why this tool?" section for README: the problem (agents waste tokens reading raw files), the solution (pre-indexed SQLite metadata via MCP), the proof (3x fewer tokens, 8x less data from actual benchmarks)
- [ ] Write quick-start section: npm install command, Claude Desktop config snippet, Cursor config snippet, verify with "ask your agent to describe your project structure"
- [ ] Write architecture section: explain the 5-table schema (`files`, `exports`, `imports`, `directories`, `changes`) with a text-based diagram showing relationships
- [ ] Write tool reference: for each of the 10 MCP tools, document name, description, parameters (with types), example invocation, example response
- [ ] Review all code examples are copy-pasteable: test each one manually
- [ ] Remove any marketing language, ensure tone is direct and technical
- [ ] Review and update the existing README content to align with new sections (avoid duplication)

---

## Frontend Developer

### T-013: Dashboard Hash Routing and State Persistence (3 pts)

- [ ] Add a `// ====== ROUTER ======` section in `src/dashboard/dashboard.html` inline JS
- [ ] Implement `router.navigate(hash)` that calls `history.pushState` and `window.location.hash`
- [ ] Implement `router.parse()` that reads `window.location.hash` and returns `{ view, fileId, tab }` object
- [ ] Define hash patterns: `#file/{id}`, `#file/{id}/{tab}`, `#graph`, `#changes`, `#` (default/overview)
- [ ] On file selection, call `router.navigate('#file/' + id)`
- [ ] On tab switch, update hash to include tab: `#file/{id}/exports`, `#file/{id}/imports`, etc.
- [ ] On page load, call `router.parse()` and restore state: select the file, activate the tab, switch the view
- [ ] Listen to `popstate` event to handle browser back/forward
- [ ] Debounce hash updates: batch rapid state changes within 100ms before writing to URL
- [ ] Test manually: select file, refresh, verify state restored; use back button, verify previous state

### T-014: Dashboard Keyboard Shortcuts and Search (3 pts)

- [ ] Add global `keydown` listener for Cmd+K / Ctrl+K: focus search input, select all text, prevent default
- [ ] Add Esc handler: if search is focused, clear input and blur; if modal/overlay open, dismiss it
- [ ] Refactor existing search filter to use pre-computed lowercase path array for sub-50ms filtering
- [ ] Add character highlighting in search results: wrap matched characters in `<mark>` tags
- [ ] Add arrow key navigation: Up/Down moves a `data-active` attribute through visible file tree items
- [ ] Add Enter handler: when a file tree item is active (via keyboard), select it (same as click)
- [ ] Add visual indicator for keyboard-active item (subtle background highlight, distinct from hover)
- [ ] Add shortcut hint near search input: small gray text "Cmd+K" (or "Ctrl+K" on non-Mac)
- [ ] Detect platform (Mac vs other) for correct modifier key display
- [ ] Test: Cmd+K focuses, type to filter, arrow to navigate, Enter to select, Esc to clear -- full flow

### T-015: Dashboard Loading and Error States (2 pts)

- [ ] Create CSS class `.skeleton` with pulsing animation (keyframes, gray-to-lighter-gray, 1.5s cycle)
- [ ] Add skeleton markup for file tree: 8-10 rows of varying width gray bars
- [ ] Add skeleton markup for file detail panel: header block, 3 table rows, 2 section blocks
- [ ] Show skeletons on initial page load, replace with real content when API responds
- [ ] Add `showError(panel, message, retryFn)` utility: renders error message with Retry button in the specified panel
- [ ] On API fetch failure, call `showError()` in the affected panel instead of silently failing
- [ ] On Retry click, clear the error and re-fetch
- [ ] Add empty state for file tree: "No files indexed yet. Run the indexer to get started."
- [ ] Add empty state for file detail: "Select a file from the tree to view details."
- [ ] Update SSE connection indicator in statusbar: green dot = connected, yellow = reconnecting, red = disconnected

---

## QA Engineer

### Test Spec Writing (Day 2-3, Retro Action 2)

QA writes detailed acceptance test specifications during implementation, not on Day 4.

### Test Specs for T-001: Test Infrastructure
- [ ] Verify `npm test` runs and exits with code 0
- [ ] Verify `npm run test:coverage` produces a `coverage/` directory with an HTML report
- [ ] Verify `npm run test:watch` starts in watch mode (interactive)
- [ ] Verify `createTestDb()` returns a database where all 5 tables exist (`files`, `exports`, `imports`, `directories`, `changes`)
- [ ] Verify smoke test indexes at least 5 fixture files

### Test Specs for T-002: Import/Export Parsing
- [ ] Verify named export `export function foo` appears in exports table with kind "function"
- [ ] Verify default export appears with name "default"
- [ ] Verify import `import { x } from './y'` creates a row in imports table linking to the correct file
- [ ] Verify empty file produces zero rows in exports and imports
- [ ] Verify file with syntax errors does not crash (parser returns partial results or zero results, no exception)
- [ ] Verify coverage of parsing functions is above 85% (check coverage report)

### Test Specs for T-004: Error Handling
- [ ] Call each MCP tool with deliberately missing arguments -- verify structured error, not stack trace
- [ ] Call `get_file_context` with a path that does not exist -- verify "File not found" message
- [ ] Index a directory containing a file the process cannot read -- verify file is skipped, rest of indexing succeeds
- [ ] Place a >1MB file in the fixture directory -- verify it is skipped with a warning in output
- [ ] Verify `process.on('unhandledRejection')` is registered in server entry point

### Day 4 Verification
- [ ] Run full test suite and confirm all tests pass
- [ ] Run coverage report and verify thresholds are met
- [ ] Manually test dashboard changes (T-013, T-014, T-015) against acceptance criteria
- [ ] Log any bugs found in BUGS.md with severity, steps to reproduce, and related ticket ID
