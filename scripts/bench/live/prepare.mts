/**
 * ONE preparation path for every live-bench arm (security audit 2026-10-10,
 * finding 2: the glm vanilla arm used to spawn with NO opencode.json, i.e.
 * an empty permission ruleset).
 *
 * `prepareArmSession` is the only way a session workspace comes into
 * existence, and it ALWAYS writes `<ws>/opencode.json` carrying
 * `SANDBOX_PERMISSIONS` before anything is spawned — for vanilla and cc,
 * for glm and deepseek. It also owns the isolated fake HOME (with a real
 * `.profile` marker file, so probe reads hit `external_directory` deny
 * instead of a mere ENOENT) and the minimal agent env (sandbox.mts).
 *
 * run.mts has exactly ONE spawn site for `opencode` and it consumes a
 * `PreparedArm` — there is no code path that spawns an agent without going
 * through this module (guarded by test/bench-live-prepare.test.ts and the
 * source guards in test/bench-guard.test.ts).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { initSchema } from '../../../src/server/schema.js';
import { indexDirectory } from '../../../src/server/indexer.js';
import type { LiveProvider } from '../normalize-live.mts';
import { writeOpencodeConfig, type WriteOpencodeConfigOpts } from './opencode-config.mts';
import { agentSpawnEnv } from './sandbox.mts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'sample-project');

/** Every bench arm — run.mts iterates this; tests enumerate it exhaustively. */
export const ARMS = ['vanilla', 'cc'] as const;
export type Arm = (typeof ARMS)[number];

export interface PrepareArmOpts {
  provider: LiveProvider;
  arm: Arm;
  /** Repo dist server (cc arm MCP command); existence is checked by run.mts. */
  distServer: string;
  /** Name the opencode child reads the provider key under. */
  keyExportName: string;
  /** Provider key value — never logged, goes straight into the child env. */
  key: string;
  /** CODE_CONTEXT_ALLOWED_ROOTS for the child; omit to skip the variable. */
  allowedRoots?: string;
  /** Parent dir for the temp workspace/HOME (tests); defaults to os.tmpdir(). */
  tmpdir?: string;
}

export interface IndexInfo {
  indexMs: number;
  dbBytes: number;
}

export interface PreparedArm {
  /** Fresh temp copy of the fixture — the agent's whole world. */
  ws: string;
  /** Always `<ws>/opencode.json`, ALWAYS written before spawn. */
  configPath: string;
  /** Present for the cc arm only (index timing stats). */
  indexInfo?: IndexInfo;
  /** Isolated HOME for the opencode child (contains only the .profile marker). */
  fakeHome: string;
  /** Minimal agent spawn env (sandbox.mts agentSpawnEnv). */
  env: NodeJS.ProcessEnv;
  /** Remove the workspace and the fake HOME. */
  cleanup(): void;
}

function buildIndexDb(ws: string): IndexInfo {
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

/**
 * Prepare ONE arm session: fresh workspace, index db (cc only), the sandbox
 * opencode.json (ALWAYS), and the minimal agent env. The single function
 * every arm — provider × vanilla/cc — goes through before spawning.
 */
export function prepareArmSession(opts: PrepareArmOpts): PreparedArm {
  const tmpdir = opts.tmpdir ?? os.tmpdir();

  const ws = fs.mkdtempSync(path.join(tmpdir, 'bench-ws-'));
  fs.cpSync(FIXTURE, ws, { recursive: true });

  const configOpts: WriteOpencodeConfigOpts = {};
  let indexInfo: IndexInfo | undefined;
  if (opts.arm === 'cc') {
    indexInfo = buildIndexDb(ws);
    configOpts.mcp = { command: [process.execPath, opts.distServer, path.join(ws, 'context.db')] };
  }
  if (opts.provider === 'deepseek') {
    configOpts.includeDeepseekProvider = true; // model resolution only
  }
  // The sandbox contract: EVERY arm carries SANDBOX_PERMISSIONS. Even with
  // no mcp and no provider block, the config is still written.
  const configPath = writeOpencodeConfig(ws, configOpts);

  const fakeHome = fs.mkdtempSync(path.join(tmpdir, 'bench-home-'));
  // A real file outside the workspace: probe reads of `$HOME/…` must be
  // refused by external_directory, not pass because the path is missing.
  fs.writeFileSync(path.join(fakeHome, '.profile'), '# bench sandbox home\n');

  const env = agentSpawnEnv({
    fakeHome,
    keyExportName: opts.keyExportName,
    key: opts.key,
    ...(opts.allowedRoots ? { allowedRoots: opts.allowedRoots } : {}),
  });

  return {
    ws,
    configPath,
    indexInfo,
    fakeHome,
    env,
    cleanup: () => {
      fs.rmSync(ws, { recursive: true, force: true });
      fs.rmSync(fakeHome, { recursive: true, force: true });
    },
  };
}
