import { describe, it, expect } from 'vitest';
import { normalizeSimulated } from '../scripts/bench/lib/normalize-simulated.mts';

const deterministic = {
  meta: { fixture: 'test/fixtures/sample-project', fileCount: 3 },
  tasks: [{ id: 'T01', label: 'lookup', mcp: { tokens: 10 }, vanilla: { tokens: 20 } }],
  summary: { totalMcpTokens: 10, totalVanillaTokens: 20, totalSavingsPct: 44.9, callSavingsPct: 27.9 },
};

const stochastic = {
  config: { trials: 3, seed: 42 },
  results: { mcpWins: 1, vanillaWins: 2, ties: 0, mcpWinRate: 33.3 },
  tokens: { mcpMean: 10, vanillaMean: 20, savingsPct: 50 },
  calls: { mcpMean: 1, vanillaMean: 2 },
  statistics: { wilcoxon: { W: 1, z: 1.1, p: 0.03, n: 3 }, effectSize: 0.953, significant: true },
  byTemplate: { a: { count: 3 } },
};

const ctx = {
  trigger: 'manual' as const,
  git: { commit: 'abc1234', branch: 'feat/x', dirty: false },
  durationMs: 1234,
  codeContextVersion: '2.8.0',
  now: new Date(2026, 9, 10, 14, 3, 22), // 2026-10-10T14:03:22 local
};

describe('normalizeSimulated', () => {
  it('builds the simulated envelope with verbatim docs and a derived headline', () => {
    const run = normalizeSimulated(deterministic, stochastic, ctx);
    expect(run.schema).toBe('ccc-bench/1');
    expect(run.kind).toBe('simulated');
    expect(run.model).toBeNull();
    expect(run.run_id).toMatch(/^sim-\d{8}-\d{6}$/);
    expect(run.run_id).toBe('sim-20261010-140322');
    expect(run.date).toBe('2026-10-10');
    expect(run.code_context_version).toBe('2.8.0');
    expect(run.trigger).toBe('manual');
    expect(run.duration_ms).toBe(1234);
    expect(run.git).toEqual(ctx.git);
    expect(run.deterministic).toEqual(deterministic);
    expect(run.stochastic).toEqual(stochastic);
    // headline: pct fields rounded to 1 decimal, science fields passed through
    expect(run.headline.tokensSavedPct).toBe(44.9);
    expect(run.headline.callsSavedPct).toBe(27.9);
    expect(run.headline.mcpWinsPct).toBe(33.3); // 1 win / 3 trials
    expect(run.headline.wilcoxonP).toBe(0.03);
    expect(run.headline.effectSizeR).toBe(0.953);
  });

  it('rounds the derived mcp win rate to 1 decimal (not hardcoded)', () => {
    const sto = {
      ...stochastic,
      config: { trials: 8 },
      results: { mcpWins: 1, vanillaWins: 7, ties: 0 },
    };
    const run = normalizeSimulated(deterministic, sto, ctx);
    expect(run.headline.mcpWinsPct).toBe(12.5);
  });

  it('stamps ts as local ISO-8601 with a +HHMM offset', () => {
    const run = normalizeSimulated(deterministic, stochastic, ctx);
    expect(run.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$/);
  });

  it('throws when deterministic input is missing summary', () => {
    expect(() => normalizeSimulated({ tasks: [] }, stochastic, ctx)).toThrow(/summary/);
    expect(() =>
      normalizeSimulated({ summary: { totalSavingsPct: 1 } }, stochastic, ctx),
    ).toThrow(/summary/);
  });

  it('throws when stochastic input is missing statistics', () => {
    expect(() => normalizeSimulated(deterministic, { config: { trials: 2 } }, ctx)).toThrow(
      /statistics/,
    );
    expect(() =>
      normalizeSimulated(
        deterministic,
        { config: { trials: 2 }, statistics: { wilcoxon: { p: 0 } } },
        ctx,
      ),
    ).toThrow(/statistics/);
  });

  it('rejects legacy-shaped input instead of silently accepting it', () => {
    const legacy = { schema: 'overdrive-bench/2', run_id: 'x', prereg: {}, nv: { mean: 0 } };
    expect(() => normalizeSimulated(legacy, stochastic, ctx)).toThrow(/legacy/);
    expect(() => normalizeSimulated(deterministic, legacy, ctx)).toThrow(/legacy/);
    const legacyByKeys = { prereg: { version: 'v2' }, nv: { mean: 0 }, stats: {} };
    expect(() => normalizeSimulated(legacyByKeys, stochastic, ctx)).toThrow(/legacy/);
  });
});
