# Sprint 1 Subtasks -- Milestone 1: Rock Solid Foundation

Sprint goal: Make vlm-code-context-mcp trustworthy for senior engineers. Tests, error handling, performance, docs, CI/CD.

---

## Backend Developer

### T-001: Test Infrastructure Setup
- [ ] Add vitest as dev dependency and configure `vitest.config.ts` (target: ESM, globals enabled)
- [ ] Create `tests/` directory structure: `tests/unit/`, `tests/integration/`
- [ ] Write test helper: `createTestDb()` that returns an in-memory better-sqlite3 instance with schema initialized
- [ ] Write test helper: `createFixtureDir(files: Record<string, string>)` that creates a temp directory with given file contents and cleans up after test
- [ ] Add `npm test` and `npm run test:watch` scripts to package.json
- [ ] Verify vitest runs and exits cleanly with zero tests

### T-002: Core Indexer Unit Tests
- [ ] Test `parseImports()`: standard import, named imports, default import, namespace import, re-exports, dynamic import (should be ignored), import with alias
- [ ] Test `parseImports()` edge cases: multiline imports, trailing commas, comments containing import statements, string literals containing "import"
- [ ] Test `parseExports()`: export function, export const, export class, export interface, export type, export enum, export default, re-export via `export {}`
- [ ] Test `parseExports()` edge cases: export inside comments (should be ignored by regex -- document if it fails), conditional exports, `export * from`
- [ ] Test `extractSummary()`: JSON files (name+description), markdown (heading extraction), JS/TS (JSDoc, // comment blocks, fallback to exports list), config files (filename fallback)
- [ ] Test `resolveImportPath()`: relative path with extension, without extension (tries .ts, .tsx, .js, etc.), directory index resolution, absolute path from root, non-existent file returns null, bare specifier returns null
- [ ] Test `extractExternalImports()`: npm packages, scoped packages (`@scope/pkg`), relative imports excluded, Node built-ins
- [ ] Test `countLines()` and `getFileMeta()` with known fixtures

### T-003: Integration Tests for indexDirectory()
- [ ] Test indexing an empty directory: returns `{ files: 0, exports: 0, deps: 0 }`, no rows in files table
- [ ] Test indexing a directory with one TypeScript file: correct file row (path, language, extension, line_count, size_bytes, summary), correct exports rows, no dependencies
- [ ] Test indexing two files where file A imports from file B: verify dependency row created with correct source_id, target_id, and symbols
- [ ] Test re-indexing after a file changes: verify changes table has a "change" event with correct old/new values for summary, line_count, size_bytes
- [ ] Test re-indexing after a file is deleted from disk: verify changes table has a "delete" event (note: current implementation may not handle this -- document as bug if so)
- [ ] Test that SKIP_DIRS are actually skipped (create a node_modules/ dir with a .ts file, verify it is not indexed)
- [ ] Test that binary files are skipped (create a .png file, verify not indexed)
- [ ] Test directory statistics: after indexing, verify directories table has correct file_count, total_size_bytes, total_lines, language_breakdown JSON
- [ ] Test that manual descriptions (set via UPDATE) survive re-indexing (the ON CONFLICT clause should not overwrite description)

### T-004: Error Handling and Recovery in Indexer
- [ ] Add try/catch around individual file reads in Phase 1 (currently `try { content = fs.readFileSync(...) } catch { continue; }` exists but silently drops errors) -- add error counting and return in stats: `{ files, exports, deps, errors }`
- [ ] Handle permission-denied errors on directories gracefully (catch in walkDir, skip with warning, do not crash full index)
- [ ] Handle corrupt/truncated files (readFileSync succeeds but content is garbage for parseImports) -- parseImports/parseExports should never throw
- [ ] Add transaction rollback safety: if Phase 2 (dependencies) crashes, Phase 1 data (files, exports) should still be committed. Wrap each phase in its own transaction (already done -- verify with test)
- [ ] Handle database locked errors: if two indexDirectory calls run concurrently, the second should fail gracefully with a clear message, not corrupt the DB
- [ ] Add logging parameter to indexDirectory: `opts.onProgress?: (msg: string) => void` for dashboard watcher to report status
- [ ] Handle symlinks in walkDir: detect and skip to avoid infinite loops

### T-005: MCP Tool Input Validation and Error Handling
- [ ] Add path validation to `index_directory` tool: reject relative paths, reject paths containing `..`, verify directory exists before starting
- [ ] Add SQL injection defense to `query` tool: reject statements containing `;` (prevent chained statements), reject ATTACH, PRAGMA, and other dangerous statements beyond the existing SELECT check
- [ ] Add SQL injection defense to `execute` tool: reject DROP TABLE, DROP INDEX, and other DDL statements
- [ ] Add input length limits: symbol name max 500 chars, path max 4096 chars, SQL max 10000 chars, description max 10000 chars
- [ ] Test each tool with malformed/empty input and verify clean error responses (no stack traces in MCP output)
- [ ] Add timeout to `index_directory`: if indexing takes > 60s, abort and return partial results with warning

### T-006: Performance Optimization for Large Repos
- [ ] Profile indexDirectory with a synthetic 5K-file repo (generate with fixture helper): measure wall time, memory peak
- [ ] Batch INSERT statements: currently each file is one `upsertFile.run()` call inside a transaction -- this is already efficient with better-sqlite3 but verify with benchmark
- [ ] Add incremental re-indexing: compare file mtime against stored `modified_at` in DB, skip files that have not changed. This is the single biggest performance win for large repos.
- [ ] Add `--incremental` flag to indexDirectory (or make it default): only re-parse files where `fs.statSync(path).mtime > stored modified_at`
- [ ] Optimize walkDir: currently reads every file's content in Phase 1 AND Phase 2. Refactor to read content once and pass to both phases.
- [ ] Optimize computeDiff: current LCS is O(n*m) with a 500K cell limit. For files > 500 lines, use the line-level fallback instead of the full DP table. Add a fast path: if old content === new content, return empty string immediately.

---

## Frontend Developer

### T-007: Dashboard API Layer and Error Handling
- [ ] Extract all `fetch()` calls into an `api` object at the top of the `<script>` block with methods: `api.files()`, `api.file(id)`, `api.graph()`, `api.stats()`, `api.changes(limit)`, `api.directories()`
- [ ] Add fetch timeout (5 seconds) using AbortController to every API call
- [ ] Add error handling: on fetch failure, show a non-blocking error banner at the top of the main panel (red background, dismiss button, auto-dismiss after 10s)
- [ ] Add loading states: when file detail is loading, show a skeleton placeholder (gray pulsing blocks) instead of empty space
- [ ] Add retry logic: on SSE disconnect, reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s), show yellow "Reconnecting..." indicator replacing the green live dot
- [ ] Add connection status to statusbar: "Connected", "Reconnecting...", "Disconnected"

### T-008: Dashboard Performance for Large Repos
- [ ] Implement virtual scrolling for the sidebar file tree: only render DOM nodes for visible items (viewport height / item height + 20 buffer rows), update on scroll
- [ ] Pre-compute lowercase paths for search: build once on data load, reuse on every keystroke
- [ ] Debounce search input to 150ms
- [ ] Lazy-initialize the graph view: do not fetch `/api/graph` or start force simulation until the Graph tab is clicked for the first time
- [ ] Add a file count threshold warning: if > 5K files, show a note in the graph tab "Large project: graph may be slow. Showing top 500 most-connected files."

### T-009: Dashboard UX Improvements
- [ ] Add hash-based routing: `#file/{id}`, `#graph`, `#changes` -- update hash on navigation, restore state on page load
- [ ] Add keyboard shortcut: `Cmd+K` / `Ctrl+K` to focus search input
- [ ] Add keyboard shortcut: `Escape` to clear search and blur input
- [ ] Add keyboard navigation: Up/Down arrows to move through file list, Enter to select
- [ ] Add basic ARIA attributes: `role="tree"` on sidebar, `role="treeitem"` on files, `aria-expanded` on folders, `aria-selected` on active file, `role="tablist"` and `role="tab"` on tabs
- [ ] Self-host Geist fonts: convert the woff2 files to base64 data URIs and embed in the `<style>` block (removes CDN dependency, enables offline use)
- [ ] Add a "No files indexed" empty state with instructions: "Run `index_directory` via your MCP client to get started"

---

## Architect

### T-010: CI/CD Pipeline
- [ ] Create `.github/workflows/ci.yml`: trigger on push to main and pull requests
- [ ] CI step 1: `npm ci` (install dependencies)
- [ ] CI step 2: `npm run build` (TypeScript compilation, verify no type errors)
- [ ] CI step 3: `npm test` (run vitest suite)
- [ ] CI step 4: `npx tsc --noEmit` (redundant with build but explicit type check)
- [ ] Add Node.js version matrix: test on 18.x and 20.x (minimum supported versions)
- [ ] Add badge to README: CI status badge from GitHub Actions

### T-011: Project Structure and Developer Experience
- [ ] Add `.nvmrc` file pinning Node 20
- [ ] Add `tsconfig.json` strict mode audit: enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` if not already set -- fix any resulting type errors
- [ ] Extract shared types into `src/types.ts`: `FileRow`, `ExportRow`, `DependencyRow`, `DirectoryRow`, `ChangeRow`, `IndexStats` -- replace all `as any` casts in index.ts and dashboard.ts
- [ ] Add JSDoc comments to all exported functions in indexer.ts (parseImports, parseExports, extractSummary, resolveImportPath, indexDirectory)
- [ ] Create `CONTRIBUTING.md` with: how to run locally, how to run tests, architecture overview, how to add a new MCP tool

### T-012: Schema and Data Integrity
- [ ] Audit all SQL queries for potential issues: verify all user-provided values use parameterized queries (already mostly true -- verify `query` and `execute` tools)
- [ ] Add a `schema_version` table with a single row, value `1`. On startup in `initSchema()`, check version and run migrations if needed. This enables safe schema evolution in future releases.
- [ ] Add ON DELETE CASCADE verification test: delete a file row, verify its exports and dependencies are also deleted
- [ ] Add index effectiveness test: EXPLAIN QUERY PLAN on the most common queries (find_symbol, get_file_context, search_files) to verify indexes are used
- [ ] Document the schema in a comment block at the top of schema.ts: table purposes, column semantics, index rationale

---

## Lead Developer

### T-013: Code Quality and Review
- [ ] Review all `as any` casts across the codebase (index.ts has ~8, dashboard.ts has ~12) -- replace with proper types from T-011
- [ ] Review error messages in all 10 MCP tools: ensure they are actionable ("File not in index. Run index_directory first." is good; "Error: undefined" is not)
- [ ] Review the `execute` tool security: currently allows arbitrary INSERT/UPDATE/DELETE. Add a warning in the tool description that this is an escape hatch and can corrupt the database.
- [ ] Review the `query` tool: the SELECT-only check is bypassable (e.g., `SELECT * FROM files; DROP TABLE files`). Fix by using db.prepare() which only allows single statements (already the case -- verify and document).
- [ ] Ensure all tools return consistent response format: `{ content: [{ type: "text", text: "..." }] }` with `isError: true` on failures
- [ ] Write CHANGELOG.md entry for v1.1.0 covering all Sprint 1 changes

### T-014: Documentation
- [ ] Update README.md: add "Development" section with setup instructions, test commands, architecture diagram (ASCII)
- [ ] Update README.md: add "Dashboard" section with screenshot placeholder and feature list
- [ ] Add inline documentation to indexer.ts: document the 4-phase indexing process (files, dependencies, directories, change tracking)
- [ ] Document known limitations in README: regex-based parsing (not AST), JS/TS only for imports/exports, no authentication on dashboard
- [ ] Add `--help` flag to both CLI entry points (code-context-mcp, code-context-dashboard) that prints usage information

---

## QA

### T-015: Test Coverage Targets and Acceptance Criteria
- [ ] Verify all T-002 unit tests pass and cover the documented edge cases
- [ ] Verify all T-003 integration tests pass with clean DB setup/teardown (no test pollution)
- [ ] Verify T-004 error handling: manually test with permission-denied directory, corrupt file, concurrent indexing
- [ ] Verify T-005 input validation: send malformed input to each MCP tool via direct function call in test, verify no crashes
- [ ] Run the full test suite 3x consecutively to verify no flaky tests
- [ ] Verify dashboard loads with empty database (no indexed files) without JS errors
- [ ] Verify dashboard loads with a 1K+ file indexed database and file tree renders in < 1s
- [ ] Verify SSE reconnection: kill and restart the dashboard server, confirm client reconnects and data refreshes
- [ ] Verify CI pipeline: push a branch, confirm all steps pass, confirm a failing test breaks the build
- [ ] Create BUGS.md entries for any issues found during QA
