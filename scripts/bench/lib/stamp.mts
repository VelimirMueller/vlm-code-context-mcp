/**
 * UTC-only run stamps (data contract: run_id stamp + `ts`).
 *
 * Everything here uses UTC getters and a `Z` suffix — no local-time or
 * timezone-offset logic. Run ordering (index building, latest picking, the
 * site's newest-first sort) compares `ts` as a plain string, so one fixed
 * UTC format keeps ordering stable across machines and timezones.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** "YYYY-MM-DD" (UTC). */
export function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "YYYYMMDD-HHMMSS" (UTC) — the run_id stamp per the data contract. */
export function formatStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

/** ISO-8601 UTC, "YYYY-MM-DDTHH:MM:SSZ". */
export function formatTs(d: Date): string {
  return `${formatDate(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}
