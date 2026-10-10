import path from "path";

/** The sample-project fixture root, shared by both simulated benchmarks. */
export const FIXTURE_DIR = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "sample-project",
);

/**
 * Fixed canonical root under which every simulated file path is rendered.
 *
 * The real code-context server returns ABSOLUTE file paths in get_file_context,
 * search_files, find_symbol and index output. Rendering the simulated MCP output
 * with bare relative paths (or no path at all) would understate the real token
 * cost of those absolute-path strings, making MCP look cheaper than it is.
 * Instead every path — in BOTH arms — is rendered as an absolute path under this
 * one fixed root, so the token estimate carries a realistic path cost while
 * staying identical on every machine (never leaking the checkout location).
 */
export const CANONICAL_ROOT = "/workspace/sample-project";

/**
 * Fixed canonical timestamps mirroring the real server output. get_file_context
 * and search_files both emit `modified <modified_at> | indexed <indexed_at>` and
 * find_symbol emits `indexed <indexed_at>`, with values in `YYYY-MM-DD HH:MM:SS`
 * (see toISOLocal in src/server/indexer.ts). Rendering fixed values keeps the
 * realistic token cost of those fields without leaking real mtimes.
 */
export const CANONICAL_MODIFIED_AT = "2026-01-01 00:00:00";
export const CANONICAL_INDEXED_AT = "2026-01-01 00:00:00";

/**
 * Render a DB (absolute) path as an absolute path under CANONICAL_ROOT, so the
 * benchmark's token estimate is realistic (absolute-path cost) but identical on
 * every machine.
 */
export function canonicalPath(p: string): string {
  const rel = path.relative(FIXTURE_DIR, p).replace(/\\/g, "/");
  return path.posix.join(CANONICAL_ROOT, rel);
}

/**
 * True when `text` still carries machine- or checkout-dependent content that
 * would leak into the token estimate: the real absolute fixture path, or any
 * timestamp other than the fixed canonical ones. Canonical paths (CANONICAL_ROOT)
 * and the fixed canonical timestamps are expected and allowed.
 */
export function hasMachineDependentText(text: string): boolean {
  if (text.includes(FIXTURE_DIR)) return true;
  const timestamps = text.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/g) ?? [];
  return timestamps.some(
    (t) => t !== CANONICAL_MODIFIED_AT && t !== CANONICAL_INDEXED_AT,
  );
}
