# Bugs -- Sprint 6

## Security Review (T-029)

`npm audit`: 0 vulnerabilities

### SQL Injection Audit
- All code-context tools use parameterized queries (better-sqlite3 `.prepare().run/all/get` with `?` params) — PASS
- `query` tool: rejects non-SELECT + blocks DROP/ALTER/DELETE/INSERT/UPDATE/CREATE keywords — PASS
- `execute` tool: rejects SELECT + blocks DROP TABLE/ALTER TABLE — PASS
- `update_sprint` and `update_ticket` in scrum tools build dynamic SET clauses, but field names are hardcoded from zod-validated params, values are parameterized — PASS (safe pattern)

### Input Validation Audit
- All code-context tools use zod schemas via McpServer.tool() — PASS
- All scrum tools use zod schemas — PASS
- File paths validated (index_directory checks existence + isDirectory) — PASS

### Error Exposure Audit
- All tool handlers have try/catch returning `{ isError: true, content: [...] }` — PASS
- No raw stack traces in MCP responses — PASS
- Dashboard API endpoints catch errors and return JSON error messages — PASS

### Resource Limits
- Files > 5MB skipped during indexing — PASS
- Query results limited (LIMIT clauses in all list queries) — PASS
- Symlinks skipped to prevent infinite loops — PASS

**Findings**: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW. No bugs found.

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| -- | -- | -- | -- |
