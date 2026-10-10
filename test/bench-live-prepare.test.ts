/**
 * Security-review unit tests — the ONE preparation path (prepare.mts).
 *
 * Security audit 2026-10-10, finding 2: the glm vanilla arm used to run
 * with NO opencode.json, i.e. an empty permission ruleset. prepare.mts is
 * now the only way a session workspace exists and the only place the
 * opencode child's env is built; run.mts has exactly one spawn site and it
 * consumes a PreparedArm. These tests enumerate EVERY arm (provider ×
 * vanilla/cc) and fail if any of them prepares without the sandbox config.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ARMS,
  prepareArmSession,
  type PreparedArm,
} from '../scripts/bench/live/prepare.mts';
import {
  SANDBOX_PERMISSIONS,
  DEEPSEEK_PROVIDER_CONFIG,
} from '../scripts/bench/live/opencode-config.mts';
import { PROVIDER_KEY_ENV_NAMES } from '../scripts/bench/live/sandbox.mts';
import type { LiveProvider } from '../scripts/bench/normalize-live.mts';

const PROVIDERS: LiveProvider[] = ['glm', 'deepseek'];

const KEY_BY_PROVIDER: Record<LiveProvider, { keyExportName: string; key: string }> = {
  glm: { keyExportName: 'ZHIPU_API_KEY', key: 'glm-key-value' },
  deepseek: { keyExportName: 'DEEPSEEK_API_KEY', key: 'dsk-key-value' },
};

let prepped: PreparedArm[] = [];
let tmpRoot = '';
let allowedRootsSnapshot: string | undefined;

afterEach(() => {
  for (const p of prepped.splice(0)) p.cleanup();
  if (tmpRoot) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    tmpRoot = '';
  }
  // restore the indexer sandbox roots the prepare() helper widened
  if (allowedRootsSnapshot === undefined) delete process.env.CODE_CONTEXT_ALLOWED_ROOTS;
  else process.env.CODE_CONTEXT_ALLOWED_ROOTS = allowedRootsSnapshot;
});

const prepare = (provider: LiveProvider, arm: (typeof ARMS)[number]): PreparedArm => {
  if (!tmpRoot) {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-prepare-'));
    // run.mts widens the indexer sandbox to the temp dir before preparing;
    // do the same here (buildIndexDb runs in-process).
    allowedRootsSnapshot = process.env.CODE_CONTEXT_ALLOWED_ROOTS;
    process.env.CODE_CONTEXT_ALLOWED_ROOTS = [
      tmpRoot,
      ...(process.env.CODE_CONTEXT_ALLOWED_ROOTS?.split(',') ?? []),
    ].join(',');
  }
  const p = prepareArmSession({
    provider,
    arm,
    distServer: path.join(tmpRoot, 'dist-server.js'),
    ...KEY_BY_PROVIDER[provider],
    allowedRoots: tmpRoot,
    tmpdir: tmpRoot,
  });
  prepped.push(p);
  return p;
};

describe('prepareArmSession — every arm carries the sandbox config', () => {
  it('writes <ws>/opencode.json with SANDBOX_PERMISSIONS for EVERY provider × arm', () => {
    for (const provider of PROVIDERS) {
      for (const arm of ARMS) {
        const p = prepare(provider, arm);
        expect(p.configPath, `${provider}/${arm} config path`).toBe(
          path.join(p.ws, 'opencode.json'),
        );
        const written = JSON.parse(fs.readFileSync(p.configPath, 'utf-8')) as Record<
          string,
          unknown
        >;
        expect(written.permission, `${provider}/${arm} permission block`).toEqual(
          SANDBOX_PERMISSIONS,
        );
        expect((written.permission as Record<string, unknown>).bash).toBe('deny');
      }
    }
  });

  it('the workspace is a fresh copy of the fixture (the agent’s whole world)', () => {
    const p = prepare('glm', 'vanilla');
    expect(fs.existsSync(path.join(p.ws, 'src', 'utils', 'helpers.ts'))).toBe(true);
    expect(fs.existsSync(path.join(p.ws, 'package.json'))).toBe(true);
  });

  it('cc arm: builds context.db and registers ONLY code-context as MCP', () => {
    const p = prepare('glm', 'cc');
    expect(p.indexInfo).toBeTruthy();
    expect(fs.statSync(path.join(p.ws, 'context.db')).size).toBeGreaterThan(0);
    const written = JSON.parse(fs.readFileSync(p.configPath, 'utf-8')) as Record<
      string,
      unknown
    >;
    const mcp = written.mcp as Record<string, { type: string; command: string[] }>;
    expect(Object.keys(mcp)).toEqual(['code-context']);
    expect(mcp['code-context'].command).toEqual([
      process.execPath,
      path.join(tmpRoot, 'dist-server.js'),
      path.join(p.ws, 'context.db'),
    ]);
  });

  it('vanilla arm: no MCP, no provider block — but still the permission block', () => {
    for (const provider of PROVIDERS) {
      const p = prepare(provider, 'vanilla');
      expect(p.indexInfo).toBeUndefined();
      const written = JSON.parse(fs.readFileSync(p.configPath, 'utf-8')) as Record<
        string,
        unknown
      >;
      expect(written.mcp).toBeUndefined();
      if (provider === 'glm') expect(written.provider).toBeUndefined();
    }
  });

  it('deepseek arms pin the provider block; glm arms do not', () => {
    for (const arm of ARMS) {
      const dsk = prepare('deepseek', arm);
      const dskWritten = JSON.parse(fs.readFileSync(dsk.configPath, 'utf-8')) as Record<
        string,
        unknown
      >;
      expect(dskWritten.provider, `deepseek/${arm}`).toEqual({
        deepseek: DEEPSEEK_PROVIDER_CONFIG,
      });

      const glm = prepare('glm', arm);
      const glmWritten = JSON.parse(fs.readFileSync(glm.configPath, 'utf-8')) as Record<
        string,
        unknown
      >;
      expect(glmWritten.provider, `glm/${arm}`).toBeUndefined();
    }
  });

  it('builds the minimal agent env: isolated HOME with a .profile marker, one key only', () => {
    process.env.GITHUB_TOKEN = 'ghp_dummy';
    const p = prepare('deepseek', 'cc');
    expect(p.fakeHome).not.toBe(os.homedir());
    expect(fs.readFileSync(path.join(p.fakeHome, '.profile'), 'utf-8')).toContain('bench');
    expect(p.env.HOME).toBe(p.fakeHome);
    expect(p.env.DEEPSEEK_API_KEY).toBe('dsk-key-value');
    expect(p.env.GITHUB_TOKEN).toBeUndefined();
    for (const name of PROVIDER_KEY_ENV_NAMES) {
      if (name === 'DEEPSEEK_API_KEY') continue;
      expect(p.env[name], `${name} must not leak`).toBeUndefined();
    }
    delete process.env.GITHUB_TOKEN;
  });

  it('cleanup removes the workspace and the fake HOME', () => {
    const p = prepare('glm', 'vanilla');
    const ws = p.ws;
    const home = p.fakeHome;
    expect(fs.existsSync(ws)).toBe(true);
    p.cleanup();
    prepped = prepped.filter((x) => x !== p);
    expect(fs.existsSync(ws)).toBe(false);
    expect(fs.existsSync(home)).toBe(false);
  });
});
