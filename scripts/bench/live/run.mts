/**
 * `npm run bench:live` — real agent benchmark (PLAN.md task 8).
 *
 * CLI: npm run bench:live -- --provider glm|deepseek [--tasks L1,L2,L3]
 *      [--repeats 1] [--timeout 300] [--data-dir <dir>]
 *
 * For every task × arm (vanilla, cc), in a fresh temp copy of the fixture:
 *   - cc arm: build <ws>/context.db via the indexer, register ONLY code-context
 *     in the per-workspace opencode.json (node <repo>/dist/server/index.js <db>)
 *   - vanilla arm: no MCP config, no db
 *   - run `opencode run --dir <ws> -m <model> --auto --format json "<prompt>"`
 *     with an isolated HOME (the user's global opencode config — with its own
 *     MCP servers — must not leak into either arm) and only the provider key
 *     in the child env; never echoed, never logged
 *   - parse the event stream (task 7), run the deterministic checker (task 6)
 *
 * Emits the run JSON (kind agent-<provider>) into <data-dir>/runs/ and
 * rebuilds index.json + latest.json there. Publish goes through the same
 * `npm run bench:publish` — this script never pushes.
 *
 * Costs real tokens. Requires `npm run build` first (dist server for the cc arm).
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { initSchema } from '../../../src/server/schema.js';
import { indexDirectory } from '../../../src/server/indexer.js';
import { buildIndex, pickLatest } from '../lib/index-builder.mts';
import { formatStamp } from '../lib/stamp.mts';
import { normalizeLive, type LiveProvider, type LiveSessions } from '../normalize-live.mts';
import { DEFAULT_LIVE_TASKS, tasksByIds, type LiveTask } from './tasks.mts';
import { runChecker } from './checkers.mts';
import { parseEventStream } from './parse-events.mts';
import { writeOpencodeConfig } from './opencode-config.mts';
import type { SessionResult } from '../lib/types.mts';

/**
 * Verified with one live capture per provider (opencode 1.18.30):
 * glm answers on zai-coding-plan/glm-5.3, but that provider only appears and
 * authenticates when the key is exported as ZHIPU_API_KEY (the rig's mapping:
 * ZAI_API_KEY → ZHIPU_API_KEY) — with ZAI_API_KEY alone opencode fails with
 * ProviderModelNotFoundError. deepseek needs the pinned provider block
 * (opencode-config.mts) and answers on deepseek/deepseek-v4-pro with
 * DEEPSEEK_API_KEY. `keyEnv` is the documented SOURCE name (run JSON auth);
 * `exportAs` is the name the opencode child actually reads.
 */
const PROVIDERS: Record<LiveProvider, { model: string; keyEnv: string; exportAs: string }> = {
  glm: { model: 'zai-coding-plan/glm-5.3', keyEnv: 'ZAI_API_KEY', exportAs: 'ZHIPU_API_KEY' },
  deepseek: {
    model: 'deepseek/deepseek-v4-pro',
    keyEnv: 'DEEPSEEK_API_KEY',
    exportAs: 'DEEPSEEK_API_KEY',
  },
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'sample-project');
const DIST_SERVER = path.join(repoRoot, 'dist', 'server', 'index.js');

function fail(message: string): never {
  console.error(`bench:live: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  provider: LiveProvider;
  tasks: string;
  repeats: number;
  timeoutSec: number;
  dataDir: string;
} {
  const out = {
    provider: '',
    tasks: DEFAULT_LIVE_TASKS,
    repeats: 1,
    timeoutSec: 300,
    dataDir: path.join(repoRoot, 'data'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    /** Consume and return the next argv value; fails on a missing value. */
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) fail(`${a} needs a value`);
      i++;
      return v;
    };
    /** Whole-number next value; rejects non-numeric input (NaN never passes). */
    const whole = (min: number): number => {
      const raw = next().trim();
      if (!/^\d+$/.test(raw) || Number(raw) < min) {
        fail(`${a} must be a whole number >= ${min} (got "${raw}")`);
      }
      return Number(raw);
    };
    if (a === '--provider') out.provider = next();
    else if (a === '--tasks') out.tasks = next();
    else if (a === '--repeats') out.repeats = whole(1);
    else if (a === '--timeout') out.timeoutSec = whole(1);
    else if (a === '--data-dir') out.dataDir = path.resolve(next());
    else fail(`unknown argument ${a} (--provider, --tasks, --repeats, --timeout, --data-dir)`);
  }
  if (out.provider !== 'glm' && out.provider !== 'deepseek') {
    fail('--provider glm|deepseek is required');
  }
  return out as {
    provider: LiveProvider;
    tasks: string;
    repeats: number;
    timeoutSec: number;
    dataDir: string;
  };
}

/** Env value only — never printed, never logged; goes straight to the child env. */
function resolveKey(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const rigKeys = path.join(os.homedir(), '.config', 'rig', 'keys.env');
  try {
    const m = new RegExp(`^${name}=(.+)$`, 'm').exec(fs.readFileSync(rigKeys, 'utf-8'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* no rig key store (CI) — env was the only chance */
  }
  return undefined;
}

function git(...args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function freshWorkspace(parent: string): string {
  const ws = fs.mkdtempSync(path.join(parent, 'bench-ws-'));
  fs.cpSync(FIXTURE, ws, { recursive: true });
  return ws;
}

function buildIndexDb(ws: string): { indexMs: number; dbBytes: number } {
  const dbPath = path.join(ws, 'context.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  initSchema(db);
  const t0 = Date.now();
  indexDirectory(db, ws);
  const indexMs = Date.now() - t0;
  db.close();
  return { indexMs, dbBytes: fs.statSync(dbPath).size };
}

interface SessionOutcome {
  result: SessionResult;
  checkDetail: string;
}

async function runSession(opts: {
  task: LiveTask;
  ws: string;
  model: string;
  keyExportName: string;
  key: string;
  timeoutSec: number;
  eventsFile: string;
  stderrFile: string;
}): Promise<SessionOutcome> {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-home-'));
  const t0 = Date.now();
  let timedOut = false;
  let spawnError = ''; // e.g. ENOENT when opencode is not spawnable

  const child = spawn(
    'opencode',
    ['run', '--dir', opts.ws, '-m', opts.model, '--auto', '--format', 'json', opts.task.prompt],
    {
      env: {
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
        HOME: fakeHome,
        TMPDIR: os.tmpdir(),
        CODE_CONTEXT_ALLOWED_ROOTS: process.env.CODE_CONTEXT_ALLOWED_ROOTS ?? os.tmpdir(),
        [opts.keyExportName]: opts.key,
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let killTimer: NodeJS.Timeout | undefined;
  const killer = setTimeout(() => {
    timedOut = true;
    try {
      if (child.pid) process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    killTimer = setTimeout(() => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }, 5_000);
  }, opts.timeoutSec * 1_000);

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on('data', (c: Buffer) => stdoutChunks.push(c));
  child.stderr.on('data', (c: Buffer) => stderrChunks.push(c));

  await new Promise<void>((resolve) => {
    child.on('close', () => resolve());
    child.on('error', (err: Error) => {
      spawnError = err.message;
      resolve();
    });
  });
  clearTimeout(killer);
  clearTimeout(killTimer);

  const wallMs = Date.now() - t0;
  const stdout = Buffer.concat(stdoutChunks);
  const stderr = Buffer.concat(stderrChunks);
  fs.writeFileSync(opts.eventsFile, stdout);
  fs.writeFileSync(
    opts.stderrFile,
    spawnError ? `${stderr.toString('utf-8')}spawn error: ${spawnError}\n` : stderr,
  ); // diagnostics only, never printed
  fs.rmSync(fakeHome, { recursive: true, force: true });

  if (spawnError) {
    // The child never ran (nothing spawned): not a model FAIL — record the
    // cause and mark the session unsuccessful.
    return {
      result: {
        task_id: opts.task.id,
        success: false,
        timeout: false,
        tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
        tool_calls: 0,
        mcp_tool_calls: 0,
        wall_ms: wallMs,
        session_id: '',
        events_path: path.basename(opts.eventsFile),
      },
      checkDetail: `opencode failed to start: ${spawnError}`,
    };
  }

  const usage = parseEventStream(stdout.toString('utf-8').split('\n'));
  const check = await runChecker(opts.task, opts.ws, usage.assistantText);

  return {
    result: {
      task_id: opts.task.id,
      success: !timedOut && check.pass,
      timeout: timedOut,
      tokens: {
        input: usage.inputTokens,
        output: usage.outputTokens,
        cache_read: usage.cacheReadTokens,
        cache_write: usage.cacheWriteTokens,
      },
      tool_calls: usage.toolCalls,
      mcp_tool_calls: usage.mcpToolCalls,
      wall_ms: wallMs,
      session_id: usage.sessionId ?? '',
      events_path: path.basename(opts.eventsFile),
    },
    checkDetail: check.detail,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const providerMeta = PROVIDERS[args.provider];
  const tasks = tasksByIds(
    args.tasks
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const key = resolveKey(providerMeta.keyEnv);
  if (!key) {
    fail(
      `${providerMeta.keyEnv} is not set — export it (locally it lives in ~/.config/rig/keys.env) and retry. No partial run was started.`,
    );
  }
  if (!fs.existsSync(DIST_SERVER)) {
    fail(
      'dist/server/index.js is missing — run `npm run build` first (the cc arm serves the MCP server from dist).',
    );
  }

  let opencodeVersion = 'unknown';
  try {
    opencodeVersion = execFileSync('opencode', ['--version'], { encoding: 'utf-8' }).trim();
  } catch {
    fail('opencode CLI not found on PATH — install it (brew install sst/tap/opencode).');
  }

  const start = Date.now();
  const stamp = new Date();
  const runId = `${args.provider === 'glm' ? 'glm' : 'dsk'}-${formatStamp(stamp)}`;

  // The indexer sandbox (src/server/indexer.ts) only allows the process cwd by
  // default; the temp workspaces need an explicit allowance, both for the
  // in-process pre-index here and for the cc arm's MCP server child below.
  const allowedRoots = [os.tmpdir(), ...(process.env.CODE_CONTEXT_ALLOWED_ROOTS?.split(',') ?? [])]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(',');
  process.env.CODE_CONTEXT_ALLOWED_ROOTS = allowedRoots;

  const artefactDir = fs.mkdtempSync(path.join(os.tmpdir(), `bench-live-${runId}-`));
  console.log(
    `run:      ${runId} (${providerMeta.model}, tasks ${tasks.map((t) => t.id).join(',')}, repeats ${args.repeats})`,
  );
  console.log(`artefacts: ${artefactDir}`);

  const vanilla: SessionResult[] = [];
  const cc: SessionResult[] = [];
  let indexMs: number | null = null;
  let dbBytes: number | null = null;

  for (const task of tasks) {
    for (let r = 1; r <= args.repeats; r++) {
      for (const arm of ['vanilla', 'cc'] as const) {
        const ws = freshWorkspace(os.tmpdir());
        if (arm === 'cc') {
          const indexInfo = buildIndexDb(ws);
          indexMs = indexInfo.indexMs;
          dbBytes = indexInfo.dbBytes;
          writeOpencodeConfig(ws, {
            mcp: { command: [process.execPath, DIST_SERVER, path.join(ws, 'context.db')] },
            includeDeepseekProvider: args.provider === 'deepseek',
          });
        } else if (args.provider === 'deepseek') {
          writeOpencodeConfig(ws, { includeDeepseekProvider: true }); // model resolution only — no MCP
        }

        const suffix = args.repeats > 1 ? `-r${r}` : '';
        const outcome = await runSession({
          task,
          ws,
          model: providerMeta.model,
          keyExportName: providerMeta.exportAs,
          key,
          timeoutSec: args.timeoutSec,
          eventsFile: path.join(artefactDir, `${arm}-${task.id}${suffix}.jsonl`),
          stderrFile: path.join(artefactDir, `${arm}-${task.id}${suffix}.stderr.log`),
        });
        (arm === 'cc' ? cc : vanilla).push(outcome.result);

        const res = outcome.result;
        console.log(
          `  ${arm.padEnd(7)} ${task.id}${suffix ? ` r${r}` : ''}  ` +
            `${res.success ? 'PASS' : res.timeout ? 'TIMEOUT' : 'FAIL'}  ` +
            `tok ${res.tokens.input}→${res.tokens.output}  tools ${res.tool_calls} (mcp ${res.mcp_tool_calls})  ` +
            `${(res.wall_ms / 1000).toFixed(1)}s  — ${outcome.checkDetail}`,
        );
        fs.rmSync(ws, { recursive: true, force: true });
      }
    }
  }

  const sessions: LiveSessions = { vanilla, cc, indexMs, dbBytes };
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8')) as {
    version: string;
  };
  const run = normalizeLive(args.provider, providerMeta.model, tasks, sessions, {
    trigger: 'manual',
    git: {
      commit: git('rev-parse', 'HEAD'),
      branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
      dirty: git('status', '--porcelain').length > 0,
    },
    now: stamp, // one clock for the artefact dir name and the run_id
    durationMs: Date.now() - start,
    codeContextVersion: pkg.version,
    agentVersion: opencodeVersion,
    notes: [
      'tokens from opencode step-finish events; reasoning tokens folded into output',
      `key ${providerMeta.keyEnv} exported to opencode as ${providerMeta.exportAs}`,
      `artefacts: ${artefactDir}`,
    ],
  });

  const runsDir = path.join(args.dataDir, 'runs');
  fs.mkdirSync(runsDir, { recursive: true });
  const runPath = path.join(runsDir, `${run.run_id}.json`);
  fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

  const allRuns = fs
    .readdirSync(runsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf-8')));
  const index = buildIndex(allRuns);
  const latest = pickLatest(allRuns);
  fs.writeFileSync(path.join(args.dataDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  fs.writeFileSync(path.join(args.dataDir, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);

  const h = run.headline;
  const row = (label: string, value: string): string =>
    `│ ${label.padEnd(22)} ${value.padStart(9)} │`;
  console.log('┌───────────────────────────────────┐');
  console.log(row('success vanilla', `${h.success_vanilla_pct} %`));
  console.log(row('success cc', `${h.success_cc_pct} %`));
  console.log(row('tokens saved', `${h.tokens_saved_pct} %`));
  console.log(row('tool calls saved', `${h.tool_calls_saved_pct} %`));
  console.log('└───────────────────────────────────┘');
  console.log(`run:    ${path.relative(process.cwd(), runPath)}`);
  console.log(
    `index:  ${path.relative(process.cwd(), path.join(args.dataDir, 'index.json'))} (${index.runs.length} run${index.runs.length === 1 ? '' : 's'})`,
  );
  console.log(
    `latest: ${path.relative(process.cwd(), path.join(args.dataDir, 'latest.json'))} (${run.run_id})`,
  );
  console.log('publish with: npm run bench:publish');
}

main().catch((e: Error) => fail(e.message));
