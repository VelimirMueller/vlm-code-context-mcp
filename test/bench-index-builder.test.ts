import { describe, it, expect } from 'vitest';
import { buildIndex, legacyKindOf, pickLatest } from '../scripts/bench/lib/index-builder.mts';

const sim = (ts: string, run_id: string) => ({
  schema: 'ccc-bench/1',
  run_id,
  kind: 'simulated',
  ts,
  date: ts.slice(0, 10),
  model: null,
  trigger: 'manual',
  headline: { tokensSavedPct: 44.9 },
});

const glm = (ts: string, run_id: string) => ({
  schema: 'ccc-bench/1',
  run_id,
  kind: 'agent-glm',
  ts,
  date: ts.slice(0, 10),
  model: 'zai-coding-plan/glm-5.3',
  trigger: 'ci',
  headline: { tokens_saved_pct: 12.3 },
});

const legacy = (run_id: string, ts: string, opts: Record<string, unknown> = {}) => ({
  schema: 'overdrive-bench/2',
  run_id,
  ts,
  date: ts.slice(0, 10),
  kind: 'weekly',
  model: 'opus',
  trigger: 'manual',
  prereg: { version: 'v2', sha256: 'a'.repeat(64) },
  nv: { mean: 0.04, lo: -0.03, hi: 0.11 },
  verdict: 'INCONCLUSIVE',
  ...opts,
});

describe('legacyKindOf', () => {
  it('detects legacy by schema', () => {
    expect(legacyKindOf({ schema: 'overdrive-bench/2' })).toBe(true);
  });

  it('detects legacy by prereg + nv fallback', () => {
    expect(legacyKindOf({ prereg: {}, nv: {} })).toBe(true);
    expect(legacyKindOf({ prereg: {} })).toBe(false);
    expect(legacyKindOf({ nv: {} })).toBe(false);
  });

  it('does not flag new kinds', () => {
    expect(legacyKindOf(sim('2026-10-10T00:00:00+0200', 's1'))).toBe(false);
  });
});

describe('buildIndex', () => {
  it('sorts newest-first across mixed kinds and maps legacy to agent-claude', () => {
    const runs = [
      legacy('l1', '2026-10-01T10:00:00+0200'),
      sim('2026-10-10T00:00:00+0200', 's1'),
      legacy('l2', '2026-10-05T10:00:00+0200'),
      glm('2026-10-12T00:00:00+0200', 'g1'),
    ];
    const index = buildIndex(runs);
    expect(index.schema).toBe('ccc-bench-index/1');
    expect(index.runs.map((r) => r.run_id)).toEqual(['g1', 's1', 'l2', 'l1']);
    expect(index.runs.map((r) => r.kind)).toEqual([
      'agent-glm',
      'simulated',
      'agent-claude',
      'agent-claude',
    ]);
  });

  it('maps legacy headline to nv/verdict shape', () => {
    const index = buildIndex([legacy('l1', '2026-10-01T10:00:00+0200')]);
    expect(index.runs[0].headline).toEqual({
      nv_mean: 0.04,
      nv_lo: -0.03,
      nv_hi: 0.11,
      verdict: 'INCONCLUSIVE',
    });
  });

  it('gives a legacy entry without nv a null headline', () => {
    const noNv = legacy('l1', '2026-10-01T10:00:00+0200', { nv: undefined, prereg: { version: 'v2' } });
    const index = buildIndex([noNv]);
    expect(index.runs[0].headline).toBeNull();
  });

  it('throws on duplicate run_id', () => {
    const a = sim('2026-10-10T00:00:00+0200', 'dup');
    const b = sim('2026-10-11T00:00:00+0200', 'dup');
    expect(() => buildIndex([a, b])).toThrow(/duplicate run_id dup/);
  });

  it('breaks ties on equal ts by run_id', () => {
    const ts = '2026-10-10T00:00:00+0200';
    const index = buildIndex([sim(ts, 's1'), sim(ts, 's2')]);
    expect(index.runs.map((r) => r.run_id)).toEqual(['s2', 's1']);
  });
});

describe('pickLatest', () => {
  it('returns the full run object with the greatest (ts || date, run_id)', () => {
    const runs = [
      legacy('l1', '2026-10-01T10:00:00+0200'),
      sim('2026-10-10T00:00:00+0200', 's1'),
      glm('2026-10-12T00:00:00+0200', 'g1'),
    ];
    const latest = pickLatest(runs) as { run_id: string };
    expect(latest.run_id).toBe('g1');
  });

  it('falls back to date for legacy files without ts', () => {
    const noTs = legacy('l9', '2026-10-01T10:00:00+0200', { ts: undefined });
    const latest = pickLatest([noTs, sim('2026-10-02T00:00:00+0200', 's1')]) as {
      run_id: string;
    };
    expect(latest.run_id).toBe('s1');
  });
});
