// SQL guards for the `query` (read-only) and `execute` (write) escape-hatch
// tools. Allowlist-based, not denylist: a statement must positively match an
// allowed shape, and the run* helpers additionally verify better-sqlite3's
// stmt.reader flag — the driver's own read/write classification — before
// executing. Closes denylist-bypass vectors (stacked statements, comments,
// ATTACH/PRAGMA/DDL, and CTE-prefixed writes) flagged in discovery #15a.

import type Database from "better-sqlite3";

export type SqlGuardResult = { ok: true; sql: string } | { ok: false; error: string };

const COMMENT = /--|\/\*/;

/** Trim and drop a single trailing semicolon (the only semicolon we tolerate). */
function normalize(rawSql: string): string {
  return rawSql.trim().replace(/;\s*$/, "");
}

export function validateReadOnlyQuery(rawSql: string): SqlGuardResult {
  const sql = normalize(rawSql);
  if (!sql) return { ok: false, error: "Empty query." };
  if (sql.includes(";")) {
    return { ok: false, error: "Multiple statements are not allowed; submit a single SELECT." };
  }
  if (COMMENT.test(sql)) return { ok: false, error: "SQL comments are not allowed." };
  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, error: "Only SELECT queries are allowed. Use execute() for writes." };
  }
  return { ok: true, sql };
}

export function validateWriteStatement(rawSql: string): SqlGuardResult {
  const sql = normalize(rawSql);
  if (!sql) return { ok: false, error: "Empty statement." };
  if (sql.includes(";")) {
    return { ok: false, error: "Multiple statements are not allowed; submit a single write statement." };
  }
  if (COMMENT.test(sql)) return { ok: false, error: "SQL comments are not allowed." };
  if (!/^(insert|update|delete)\b/i.test(sql)) {
    return { ok: false, error: "Only INSERT, UPDATE, or DELETE are allowed. Use query() for SELECT." };
  }
  return { ok: true, sql };
}

export type QueryResult = { ok: true; rows: unknown[] } | { ok: false; error: string };

/** Validate, then run a read-only query — refusing anything the driver reports as a writer. */
export function runReadOnlyQuery(db: Database.Database, rawSql: string): QueryResult {
  const check = validateReadOnlyQuery(rawSql);
  if (!check.ok) return check;
  let stmt: Database.Statement;
  try {
    stmt = db.prepare(check.sql);
  } catch (err) {
    return { ok: false, error: `SQL Error: ${(err as Error).message}` };
  }
  // Driver ground truth: a non-reader (e.g. a CTE-prefixed DELETE) is rejected
  // BEFORE execution, so it cannot mutate the database.
  if (!stmt.reader) {
    return { ok: false, error: "Only read-only queries are allowed. Use execute() for writes." };
  }
  try {
    return { ok: true, rows: stmt.all() };
  } catch (err) {
    return { ok: false, error: `SQL Error: ${(err as Error).message}` };
  }
}

export type ExecResult =
  | { ok: true; changes: number; lastInsertRowid: number | bigint }
  | { ok: false; error: string };

/** Validate, then run a single write statement — refusing readers (e.g. RETURNING). */
export function runWriteStatement(db: Database.Database, rawSql: string, params: unknown[] = []): ExecResult {
  const check = validateWriteStatement(rawSql);
  if (!check.ok) return check;
  let stmt: Database.Statement;
  try {
    stmt = db.prepare(check.sql);
  } catch (err) {
    return { ok: false, error: `SQL Error: ${(err as Error).message}` };
  }
  if (stmt.reader) {
    return { ok: false, error: "Use query() for SELECT." };
  }
  try {
    // params are user-supplied bind values; cast to satisfy the variadic signature.
    const result = stmt.run(...(params as never[]));
    return { ok: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  } catch (err) {
    return { ok: false, error: `SQL Error: ${(err as Error).message}` };
  }
}
