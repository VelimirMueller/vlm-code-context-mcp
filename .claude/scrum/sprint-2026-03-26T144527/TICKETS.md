# Sprint 1 Tickets -- Milestone 1: Rock Solid Foundation

Sprint Goal: Make the existing feature set production-grade. Tests, error handling, performance, documentation.

---

## T-001: Set Up Test Infrastructure
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 3
**Description**: Set up vitest (or comparable) with TypeScript support, coverage reporting, and a test runner script. Configure test database fixtures so every test gets a clean SQLite instance. This is the foundation everything else builds on -- no test infra means no confidence in any change.
**Acceptance Criteria**:
- [ ] `npm test` runs all tests and reports results
- [ ] `npm run test:coverage` generates coverage report
- [ ] Test helper creates isolated in-memory SQLite databases for each test
- [ ] At least one smoke test passes (index a fixture directory, query a result)
- [ ] Tests run in CI (GitHub Actions workflow)
**Dependencies**: none

---

## T-002: Unit Tests for Import/Export Parsing
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 5
**Description**: The import and export regex parsers in `indexer.ts` are the core of the indexing pipeline. They need comprehensive tests covering named imports, default imports, namespace imports, re-exports, dynamic imports, TypeScript-specific patterns (type imports, enum exports), and edge cases (string imports, comments containing import-like strings, multiline imports).
**Acceptance Criteria**:
- [ ] Tests cover: named imports, default imports, namespace imports (`* as X`), mixed imports
- [ ] Tests cover: named exports, default exports, re-exports, `export { x } from './y'`
- [ ] Tests cover edge cases: multiline imports, inline comments, string literals containing "import"
- [ ] Tests cover: TypeScript `export type`, `export interface`, `export enum`
- [ ] Tests document known limitations (dynamic imports, computed re-exports)
- [ ] Coverage for `parseImports` and `parseExports` functions is 95%+
**Dependencies**: T-001

---

## T-003: Integration Tests for Index-Query Cycle
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 5
**Description**: End-to-end tests that create a fixture directory with known files, run `indexDirectory`, then verify every MCP tool returns correct results. This validates the full pipeline: file walking, parsing, SQLite storage, and query tools.
**Acceptance Criteria**:
- [ ] Fixture directory with 10+ files across multiple languages (TS, JS, JSON, MD, CSS)
- [ ] Test: `index_directory` returns correct file/export/dep counts
- [ ] Test: `find_symbol` returns correct file paths and kinds
- [ ] Test: `get_file_context` returns correct exports, dependencies, and dependents
- [ ] Test: `search_files` matches by path and by summary
- [ ] Test: `query` tool executes valid SQL and rejects non-SELECT
- [ ] Test: `execute` tool runs write statements and rejects SELECT
- [ ] Test: `set_description` persists across re-index
- [ ] Test: `get_changes` captures add/change/delete events after re-index
- [ ] Test: re-indexing the same directory updates existing records (no duplicates)
**Dependencies**: T-001

---

## T-004: Error Handling Hardening
**Priority**: P0
**Assigned to**: backend-dev
**Story Points**: 5
**Description**: Audit every tool handler and the indexer for unhandled edge cases. No tool should ever return a raw stack trace. Every error should produce a clear, actionable message. Handle: missing directories, permission denied, corrupt/locked database, files deleted mid-index, symlinks, extremely large files (>10MB), binary files that slip through extension filter.
**Acceptance Criteria**:
- [ ] `index_directory` with non-existent path returns clear error (not stack trace)
- [ ] `index_directory` with a file (not directory) returns clear error
- [ ] Files that fail to read (permissions) are skipped with warning, not crash
- [ ] Symlinks are handled (either followed or skipped with clear behavior)
- [ ] Files >10MB are skipped with a logged warning
- [ ] `get_file_context` for unindexed file suggests running `index_directory`
- [ ] `query` with malformed SQL returns the SQLite error message, not a crash
- [ ] `execute` with DROP/ALTER statements is rejected
- [ ] All error responses set `isError: true` in the MCP response
- [ ] Test coverage for each error scenario
**Dependencies**: T-001

---

## T-005: Performance Benchmarks
**Priority**: P1
**Assigned to**: backend-dev
**Story Points**: 3
**Description**: Create an automated benchmark suite that measures indexing time, query latency, and memory usage on real-world codebases. Establish baselines so we can detect regressions. Target: index 100K lines in <30s, any single tool query <100ms.
**Acceptance Criteria**:
- [ ] Benchmark script that clones and indexes at least 2 open-source repos (e.g., Express ~30K lines, a medium Next.js app ~80K lines)
- [ ] Measures and reports: total index time, files/second, peak memory usage
- [ ] Measures query latency for each tool (find_symbol, get_file_context, search_files, query)
- [ ] Results written to a markdown file for tracking
- [ ] `npm run bench` runs the full benchmark suite
- [ ] Baseline numbers documented in README
**Dependencies**: T-001, T-003

---

## T-006: CI/CD Pipeline
**Priority**: P1
**Assigned to**: backend-dev
**Story Points**: 3
**Description**: GitHub Actions workflow that runs on every push and PR. Ensures nothing merges without passing tests, type checks, and lint. Automate npm publishing on tagged releases.
**Acceptance Criteria**:
- [ ] GitHub Actions workflow: install, typecheck (`tsc --noEmit`), test, build
- [ ] Workflow runs on push to main and on all PRs
- [ ] Failed checks block PR merge (branch protection rule documented)
- [ ] Publish workflow: on git tag `v*`, runs build and `npm publish`
- [ ] Cache node_modules across runs for speed
- [ ] Badge in README showing build status
**Dependencies**: T-001

---

## T-007: Documentation for Senior Engineers
**Priority**: P1
**Assigned to**: lead-dev
**Story Points**: 3
**Description**: Rewrite README and add architecture docs targeting senior engineers. No "getting started" fluff. Lead with the problem, show the numbers, explain the schema, document every tool with examples. A senior engineer reading the README should understand the value prop in 30 seconds and be running it in 2 minutes.
**Acceptance Criteria**:
- [ ] README leads with problem statement and efficiency numbers (3x/8x)
- [ ] Quick start: install, configure in Claude/MCP client, index, query (under 2 minutes)
- [ ] Tool reference: each of the 10 tools with description, parameters, and example output
- [ ] Schema reference: all 5 tables with column descriptions
- [ ] Architecture section: how indexing works (4 phases), how change tracking works
- [ ] "Why not just read files?" section with concrete token comparison
- [ ] No broken links, no placeholder text
**Dependencies**: none

---

## T-008: Edge Case Fixes -- Re-exports and Barrel Files
**Priority**: P1
**Assigned to**: backend-dev
**Story Points**: 3
**Description**: The current regex parser misses `export { X } from './module'` re-exports (the regex explicitly excludes `from` clauses). Barrel files (`index.ts` that re-export from submodules) are the most common pattern in real codebases and we're partially blind to them. Fix the parser and add dependency links for re-export sources.
**Acceptance Criteria**:
- [ ] `export { Foo, Bar } from './module'` creates dependency link to `./module`
- [ ] `export * from './module'` is detected and creates dependency link
- [ ] `export { default as Foo } from './module'` is parsed correctly
- [ ] Barrel file `index.ts` re-exporting from 5 submodules shows all 5 as dependencies
- [ ] Re-exported symbols appear in the exports table with kind "re-export"
- [ ] Tests for all re-export patterns
**Dependencies**: T-001, T-002

---

## T-009: Summary Extraction Quality Improvements
**Priority**: P2
**Assigned to**: backend-dev
**Story Points**: 3
**Description**: The current summary extraction falls back to filename too often. Improve heuristics: for TS/JS files with no top-level comment, generate summary from the primary export + its JSDoc. For config files (tsconfig, eslint, prettier), extract meaningful info instead of just the filename. For CSS/SCSS, extract a comment or the first few selectors.
**Acceptance Criteria**:
- [ ] TS/JS files: if no top comment, summary includes primary export name and its JSDoc @description if present
- [ ] `tsconfig.json`: summary includes target, module, and strict mode
- [ ] `package.json`: already works (name + description) -- add test to confirm
- [ ] CSS/SCSS: summary extracts first comment block or lists first 3 selectors
- [ ] HTML: summary extracts `<title>` content
- [ ] Files with only a shebang line: skip shebang, try next comment
- [ ] Tests for each improved heuristic
**Dependencies**: T-002

---

## T-010: Handle Large Codebases Gracefully
**Priority**: P1
**Assigned to**: backend-dev
**Story Points**: 5
**Description**: The current indexer reads all file content into memory, stores it in SQLite, and then reads it again in phase 2 for dependency resolution. For large codebases (100K+ lines, 1000+ files), this causes high memory usage and slow performance. Optimize: stream files instead of bulk-loading, use SQLite transactions efficiently, add progress reporting.
**Acceptance Criteria**:
- [ ] Memory usage stays under 512MB when indexing a 100K-line codebase
- [ ] Phase 2 (dependency resolution) reads content from SQLite instead of re-reading files from disk
- [ ] Indexing uses batched transactions (commit every N files) to avoid holding one massive transaction
- [ ] Progress callback or logging: "Indexed 150/1200 files..." every 100 files
- [ ] Files >5MB are skipped with a warning (configurable threshold)
- [ ] Benchmark comparison: before vs. after optimization on a large repo
**Dependencies**: T-005

---

## T-011: Validate Cross-Platform Path Handling
**Priority**: P2
**Assigned to**: qa
**Story Points**: 2
**Description**: The indexer uses `path.resolve`, `path.join`, and string-based path comparisons throughout. Verify behavior on Windows (WSL and native), macOS, and Linux. Ensure: path separators are consistent in the database, `resolveImportPath` works with both forward and backslashes, directory depth calculation is correct on all platforms.
**Acceptance Criteria**:
- [ ] All paths stored in SQLite use forward slashes (normalized)
- [ ] `resolveImportPath` resolves correctly on Windows paths
- [ ] Directory depth calculation handles path.sep differences
- [ ] `walkDir` handles Windows drive letters (C:\...) and UNC paths
- [ ] Manual test on macOS, Linux, and Windows WSL documented
- [ ] Any fixes include regression tests
**Dependencies**: T-003

---

## T-012: Dashboard Stability and Edge Cases
**Priority**: P2
**Assigned to**: frontend-dev
**Story Points**: 2
**Description**: The web dashboard on port 3333 needs testing for edge cases: empty database (no indexed files), very large result sets (1000+ files), special characters in file paths, and concurrent access. Ensure it loads fast and doesn't crash on unusual data.
**Acceptance Criteria**:
- [ ] Dashboard loads without error on empty database (shows "no files indexed" message)
- [ ] Dashboard handles 1000+ files without hanging (pagination or virtual scroll)
- [ ] File paths with spaces, unicode, and special characters render correctly
- [ ] Dashboard shows accurate counts matching SQL queries
- [ ] Live reload works: change a file, re-index, dashboard updates
- [ ] Port conflict handled gracefully (clear error if 3333 is in use)
**Dependencies**: T-003
