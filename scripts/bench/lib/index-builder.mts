/**
 * Build data/index.json and data/latest.json from a merged set of run files.
 *
 * Legacy runs (schema `overdrive-bench/2`, or `prereg`+`nv` fallback) map to
 * kind `agent-claude` and are read-only; they never change. `ts` falls back to
 * `date` for legacy files that lack a full timestamp.
 */
import type { IndexEntry, IndexJson, IndexKind } from './types.mts';

function asRecord(x: unknown): Record<string, unknown> {
  return (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
}

export function legacyKindOf(run: unknown): boolean {
  if (!run || typeof run !== 'object') return false;
  const r = run as Record<string, unknown>;
  if (r.schema === 'overdrive-bench/2') return true;
  return r.prereg !== undefined && r.nv !== undefined;
}

function legacyHeadline(run: Record<string, unknown>): unknown {
  const nv = asRecord(run.nv);
  if (typeof nv.mean !== 'number') return null;
  return {
    nv_mean: nv.mean,
    nv_lo: typeof nv.lo === 'number' ? nv.lo : null,
    nv_hi: typeof nv.hi === 'number' ? nv.hi : null,
    verdict: typeof run.verdict === 'string' ? run.verdict : null,
  };
}

function tsOf(run: Record<string, unknown>): string {
  if (typeof run.ts === 'string') return run.ts;
  if (typeof run.date === 'string') return run.date;
  return '';
}

function idOf(run: Record<string, unknown>): string {
  return typeof run.run_id === 'string' ? run.run_id : '';
}

function toEntry(run: unknown): IndexEntry {
  const r = asRecord(run);
  if (typeof r.run_id !== 'string') throw new Error('buildIndex: run missing run_id');
  const legacy = legacyKindOf(run);
  const kind: IndexKind = legacy ? 'agent-claude' : (r.kind as IndexKind);
  return {
    run_id: r.run_id,
    kind,
    date: typeof r.date === 'string' ? r.date : '',
    ts: tsOf(r),
    model: typeof r.model === 'string' ? r.model : null,
    trigger: typeof r.trigger === 'string' ? r.trigger : '',
    headline: legacy ? legacyHeadline(r) : r.headline ?? null,
  };
}

export function buildIndex(runs: unknown[]): IndexJson {
  const seen = new Set<string>();
  const entries: IndexEntry[] = [];
  for (const run of runs) {
    const entry = toEntry(run);
    if (seen.has(entry.run_id)) {
      throw new Error(`buildIndex: duplicate run_id ${entry.run_id}`);
    }
    seen.add(entry.run_id);
    entries.push(entry);
  }
  entries.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts > b.ts ? -1 : 1;
    return a.run_id > b.run_id ? -1 : 1;
  });
  return { schema: 'ccc-bench-index/1', runs: entries };
}

export function pickLatest(runs: unknown[]): object {
  if (runs.length === 0) throw new Error('pickLatest: no runs');
  const sorted = [...runs].sort((a, b) => {
    const ra = asRecord(a);
    const rb = asRecord(b);
    const ta = tsOf(ra);
    const tb = tsOf(rb);
    if (ta !== tb) return ta > tb ? -1 : 1;
    const ia = idOf(ra);
    const ib = idOf(rb);
    return ia > ib ? -1 : 1;
  });
  return sorted[0] as object;
}
