/**
 * Normalise the two tracked simulated-benchmark documents (deterministic +
 * stochastic) into a single `kind: "simulated"` run JSON per PLAN.md.
 *
 * Pure: no filesystem, no network. The caller supplies the package version,
 * git ref and clock so the result is deterministic in tests.
 */
import type { GitRef, SimulatedHeadline, SimulatedRun } from './types.mts';
import { formatDate, formatStamp, formatTs } from './stamp.mts';

export interface NormalizeSimulatedCtx {
  trigger: 'manual' | 'ci';
  git: GitRef;
  durationMs: number;
  codeContextVersion: string;
  now?: Date;
  notes?: string[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function asRecord(x: unknown): Record<string, unknown> {
  return (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
}

/** Legacy runs (schema overdrive-bench/2, or prereg+nv) are never valid input here. */
function isLegacyShaped(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return r.schema === 'overdrive-bench/2' || (r.prereg !== undefined && r.nv !== undefined);
}

export function normalizeSimulated(
  detJson: unknown,
  stoJson: unknown,
  ctx: NormalizeSimulatedCtx,
): SimulatedRun {
  if (isLegacyShaped(detJson) || isLegacyShaped(stoJson)) {
    throw new Error(
      'normalizeSimulated: legacy run document passed as benchmark input ' +
        '(schema overdrive-bench/2 or prereg+nv present)',
    );
  }

  const det = asRecord(detJson);
  const summary = det.summary as Record<string, unknown> | undefined;
  if (
    !summary ||
    typeof summary.totalSavingsPct !== 'number' ||
    typeof summary.callSavingsPct !== 'number'
  ) {
    throw new Error(
      'normalizeSimulated: deterministic input missing summary.totalSavingsPct or summary.callSavingsPct',
    );
  }

  const sto = asRecord(stoJson);
  const statistics = sto.statistics as Record<string, unknown> | undefined;
  const wilcoxon = statistics?.wilcoxon as Record<string, unknown> | undefined;
  if (
    !statistics ||
    typeof statistics.effectSize !== 'number' ||
    !wilcoxon ||
    typeof wilcoxon.p !== 'number'
  ) {
    throw new Error(
      'normalizeSimulated: stochastic input missing statistics.wilcoxon.p or statistics.effectSize',
    );
  }

  const results = sto.results as Record<string, unknown> | undefined;
  const config = sto.config as Record<string, unknown> | undefined;
  const wins = results?.mcpWins;
  const trials = config?.trials;
  if (typeof wins !== 'number' || typeof trials !== 'number' || trials <= 0) {
    throw new Error(
      'normalizeSimulated: stochastic input missing results.mcpWins or config.trials',
    );
  }

  const now = ctx.now ?? new Date();

  const headline: SimulatedHeadline = {
    tokensSavedPct: round1(summary.totalSavingsPct),
    callsSavedPct: round1(summary.callSavingsPct),
    mcpWinsPct: round1((wins / trials) * 100),
    wilcoxonP: wilcoxon.p,
    effectSizeR: statistics.effectSize,
  };

  return {
    schema: 'ccc-bench/1',
    run_id: `sim-${formatStamp(now)}`,
    kind: 'simulated',
    date: formatDate(now),
    ts: formatTs(now),
    trigger: ctx.trigger,
    duration_ms: ctx.durationMs,
    code_context_version: ctx.codeContextVersion,
    git: ctx.git,
    notes: ctx.notes ?? [],
    model: null,
    deterministic: detJson,
    stochastic: stoJson,
    headline,
  };
}
