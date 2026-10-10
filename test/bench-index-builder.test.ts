import { describe, it, expect } from 'vitest';
import {
  buildIndex,
  legacyKindOf,
  pickLatest,
  runFileProblem,
} from '../scripts/bench/lib/index-builder.mts';

const sim = (ts: string, run_id: string) => ({
  schema: 'ccc-bench/1',
  run_id,
  kind: 'simulated',
  ts,
  date: ts.slice(0, 10),
  model: null,
  trigger: 'manual',
  headline: { tokens_saved_pct: 44.9 },
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

  it('a legacy run newer than a ccc-bench run wins (owner decision: newest across ALL kinds)', () => {
    const runs = [
      sim('2026-10-10T00:00:00+0200', 's1'),
      glm('2026-10-08T00:00:00+0200', 'g1'),
      legacy('l-new', '2026-10-12T10:00:00+0200'),
    ];
    expect((pickLatest(runs) as { run_id: string }).run_id).toBe('l-new');
    expect(buildIndex(runs).runs.map((r) => r.run_id)).toEqual(['l-new', 's1', 'g1']);
    expect(buildIndex(runs).runs.map((r) => r.kind)).toEqual([
      'agent-claude',
      'simulated',
      'agent-glm',
    ]);
  });

  it('a legacy run older than a ccc-bench run loses, including date-only stamps', () => {
    const runs = [
      legacy('l-old', '2026-10-12'), // date-only legacy stamp = UTC midnight
      sim('2026-10-12T00:00:01Z', 's1'), // one second past that midnight: newer
      legacy('l-older', '2026-10-01T10:00:00+0200'),
    ];
    expect((pickLatest(runs) as { run_id: string }).run_id).toBe('s1');
    expect(buildIndex(runs).runs.map((r) => r.run_id)).toEqual(['s1', 'l-old', 'l-older']);
  });

  it('compares stamps as instants, not strings: +0200 vs Z', () => {
    // 12:00+0200 is 10:00Z, so the 11:00Z run is the newer instant — even
    // though the +0200 string would sort lexicographically greater.
    const runs = [glm('2026-10-12T12:00:00+0200', 'g1'), sim('2026-10-12T11:00:00Z', 's1')];
    expect((pickLatest(runs) as { run_id: string }).run_id).toBe('s1');
  });

  it('breaks exact timestamp ties on run_id, deterministically', () => {
    const ts = '2026-10-10T00:00:00Z';
    const runs = [legacy('l-a', ts), sim(ts, 's-b'), glm(ts, 'g-c')];
    expect((pickLatest(runs) as { run_id: string }).run_id).toBe('s-b');
    expect(buildIndex(runs).runs.map((r) => r.run_id)).toEqual(['s-b', 'l-a', 'g-c']);
  });

  it('a run without any timestamp counts as the oldest', () => {
    const noTs = { schema: 'ccc-bench/1', run_id: 's9', kind: 'simulated', date: '' };
    const runs = [noTs, legacy('l1', '2026-10-01T10:00:00+0200')];
    expect((pickLatest(runs) as { run_id: string }).run_id).toBe('l1');
    expect(buildIndex(runs).runs.map((r) => r.run_id)).toEqual(['l1', 's9']);
  });
});

describe('runFileProblem', () => {
  it('accepts new-kind runs and legacy runs', () => {
    expect(runFileProblem(sim('2026-10-10T00:00:00Z', 's1'))).toBeNull();
    expect(runFileProblem(glm('2026-10-10T00:00:00Z', 'g1'))).toBeNull();
    expect(runFileProblem(legacy('l1', '2026-10-01T10:00:00+0200'))).toBeNull();
  });

  it('rejects non-run JSON with a reason', () => {
    expect(runFileProblem({ hello: 'world' })).toMatch(/run_id/);
    expect(runFileProblem({ run_id: 'x', kind: 'mystery' })).toMatch(/unknown kind/);
    expect(runFileProblem(null)).toMatch(/not a JSON object/);
    expect(runFileProblem('nope')).toMatch(/not a JSON object/);
  });

  it('run_id must be inert: ^[a-z0-9][a-z0-9-]{0,80}$ (security audit 2026-10-10)', () => {
    // accepted: bench-generated stamps, legacy ids, digits-first ids
    for (const ok of [
      's1',
      'g1',
      'l-new',
      'glm-20261010-120000',
      'dsk-20261010-120000',
      '20261009-101417', // published legacy stamp
      'a'.repeat(81), // max length
    ]) {
      expect(runFileProblem(sim('2026-10-10T00:00:00Z', ok)), `${ok} must be accepted`).toBeNull();
    }
    // rejected: traversal, shell fodder, wrong charset, too long
    for (const bad of [
      '', // missing value (empty string)
      '../../x',
      '..\\..\\x',
      'a b',
      'A-1',
      'SIM-1',
      'a_b',
      'a.b',
      'a\nb',
      '-leading-dash',
      'a'.repeat(82), // over max length
    ]) {
      expect(runFileProblem(sim('2026-10-10T00:00:00Z', bad)), `${JSON.stringify(bad)} must be rejected`).toMatch(
        /invalid run_id|missing string run_id/,
      );
    }
    // the two dangerous shapes are specifically called invalid run_id
    expect(runFileProblem(sim('2026-10-10T00:00:00Z', '../../x'))).toMatch(/invalid run_id/);
    expect(runFileProblem(sim('2026-10-10T00:00:00Z', 'a\nb'))).toMatch(/invalid run_id/);
  });
});
