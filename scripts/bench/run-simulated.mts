/**
 * `npm run bench` — run the two simulated benchmark tests, then fold their
 * tracked result documents into one `kind: "simulated"` run under data/.
 *
 * Outputs (git-ignored `/data/`):
 *   data/runs/<run_id>.json   the run
 *   data/index.json           all local runs, newest first
 *   data/latest.json          the newest run across all local kinds
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, pickLatest } from './lib/index-builder.mts';
import { normalizeSimulated } from './lib/normalize-simulated.mts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function readJson(p: string): unknown {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function main(): void {
  const start = Date.now();

  try {
    execFileSync(
      'npx',
      ['vitest', 'run', 'test/benchmark.test.ts', 'test/benchmark-stochastic.test.ts'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        env: { ...process.env, BENCHMARK_WRITE_RESULTS: '1' },
      },
    );
  } catch {
    console.error('bench: benchmark tests failed — no run file written');
    process.exit(1);
  }

  const detJson = readJson(path.join(repoRoot, 'benchmark-results.json'));
  const stoJson = readJson(path.join(repoRoot, 'benchmark-stochastic-results.json'));
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'),
  ) as { version: string };

  let branch = '';
  let commit = '';
  let dirty = false;
  try {
    branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  } catch {
    /* detached or unborn */
  }
  try {
    commit = git('rev-parse', 'HEAD');
  } catch {
    /* no commits yet */
  }
  try {
    dirty = git('status', '--porcelain').length > 0;
  } catch {
    /* not a git repo */
  }

  const run = normalizeSimulated(detJson, stoJson, {
    trigger: 'manual',
    git: { commit, branch, dirty },
    durationMs: Date.now() - start,
    codeContextVersion: pkg.version,
    now: new Date(),
  });

  const runsDir = path.join(repoRoot, 'data', 'runs');
  fs.mkdirSync(runsDir, { recursive: true });
  const runPath = path.join(runsDir, `${run.run_id}.json`);
  fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

  const runs = fs
    .readdirSync(runsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson(path.join(runsDir, f)));
  const index = buildIndex(runs);
  const latest = pickLatest(runs);
  fs.writeFileSync(path.join(repoRoot, 'data', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  fs.writeFileSync(
    path.join(repoRoot, 'data', 'latest.json'),
    `${JSON.stringify(latest, null, 2)}\n`,
  );

  const h = run.headline;
  const row = (label: string, value: string): string =>
    `│ ${label.padEnd(22)} ${value.padStart(9)} │`;
  console.log('┌───────────────────────────────────┐');
  console.log(row('tokens saved', `${h.tokensSavedPct} %`));
  console.log(row('calls saved', `${h.callsSavedPct} %`));
  console.log(row('mcp win rate', `${h.mcpWinsPct} %`));
  console.log('└───────────────────────────────────┘');
  console.log(`run:    data/runs/${run.run_id}.json`);
  console.log(`index:  data/index.json (${index.runs.length} run${index.runs.length === 1 ? '' : 's'})`);
  console.log(`latest: data/latest.json (${run.run_id})`);
}

main();
