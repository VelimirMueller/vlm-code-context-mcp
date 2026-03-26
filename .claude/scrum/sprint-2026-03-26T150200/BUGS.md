# Bugs -- Sprint 2

QA Phase completed. 2 bugs found, both MEDIUM severity, both tracked for Sprint 3 (T-008).

---

## Bug Log

| ID | Severity | Ticket | Description | Steps to Reproduce | Expected | Actual | Status |
|----|----------|--------|-------------|--------------------|----------|--------|--------|
| BUG-001 | MEDIUM | T-002 | `export async function` not captured by parser | Write `export async function fetchData() {}` in a .ts file, index, query exports | Export "fetchData" with kind "function" appears in exports table | Export is missing — regex `/export\s+(function\|const\|...)` doesn't match when `async` sits between `export` and `function` | OPEN — deferred to Sprint 3 (T-008) |
| BUG-002 | MEDIUM | T-002 | Re-exports with `from` clause not added to exports table | Write `export { foo } from './bar'` in a .ts file, index, query exports | "foo" appears in exports table with kind "re-export" | Export is missing — `reExportRe` regex explicitly excludes `from` clauses via negative lookahead `(?!\s*from)` | OPEN — deferred to Sprint 3 (T-008) |

## QA Notes

- Both bugs are in the regex parser, not in the test infrastructure or MCP tools
- Neither bug causes crashes — they are silent omissions (data not captured)
- Both are documented as skipped tests in `test/parser.test.ts` with explanations
- Fix is straightforward: update regex patterns in `src/server/indexer.ts` (T-008 scope)
- No CRITICAL or HIGH bugs found — sprint can ship
