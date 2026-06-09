# query / execute

Escape-hatch tools for direct SQL access to the context database.

Both tools are guarded by an allowlist-based SQL validator (introduced in v1.2.1,
`src/server/sql-guard.ts`). A statement must positively match an allowed shape; the
validator also checks better-sqlite3's internal read/write flag before execution so
that no bypass vector — stacked statements, SQL comments, DDL, PRAGMA, ATTACH, or a
CTE-prefixed write — can reach the database.

## query

Run a single read-only `SELECT` (or `WITH` CTE) statement against the context database.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sql` | string | yes | A single SELECT or WITH (CTE) SQL statement |

**Constraints (enforced by the SQL guard):**

- Must start with `SELECT` or `WITH` (case-insensitive).
- Exactly one statement — no semicolons in the body (a single trailing semicolon is stripped).
- SQL comments (`--`, `/*`) are rejected.
- DDL, PRAGMA, and ATTACH are not permitted.
- The statement is additionally verified as a reader by the database driver before execution, so a CTE-prefixed write is caught and refused.

```
query sql="SELECT path, line_count FROM files ORDER BY line_count DESC LIMIT 5"
```

## execute

Run a single `INSERT`, `UPDATE`, or `DELETE` statement against the context database.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sql` | string | yes | A single INSERT, UPDATE, or DELETE SQL statement |
| `params` | array | no | Optional positional bind parameters |

**Constraints (enforced by the SQL guard):**

- Must start with `INSERT`, `UPDATE`, or `DELETE` (case-insensitive).
- Exactly one statement — no semicolons in the body (a single trailing semicolon is stripped).
- SQL comments (`--`, `/*`) are rejected.
- DDL, PRAGMA, ATTACH, and SELECT/WITH are not permitted.
- The statement is additionally verified as a writer by the database driver before execution.

**Return value:** `Rows affected: N, last id: M`

```
execute sql="UPDATE files SET description = ? WHERE path = ?" params=["Main entry point", "/home/user/project/src/index.ts"]
```
