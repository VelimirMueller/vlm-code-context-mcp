/**
 * Security-review unit tests — the live bench sandbox.
 *
 * Three things must hold for the agent benchmark to be safe against untrusted
 * code execution and credential exposure:
 *   1. the generated per-workspace opencode.json carries the deny rules;
 *   2. the agent spawn env carries only the one provider key it needs and
 *      never GITHUB_TOKEN or the other provider's key;
 *   3. the checker (vitest over model-written code) spawn env is scrubbed.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  writeOpencodeConfig,
  SANDBOX_PERMISSIONS,
  DEEPSEEK_PROVIDER_CONFIG,
} from '../scripts/bench/live/opencode-config.mts';
import {
  agentSpawnEnv,
  checkerSpawnEnv,
  stripProviderKeys,
  PROVIDER_KEY_ENV_NAMES,
} from '../scripts/bench/live/sandbox.mts';

const ENV_KEYS = ['GITHUB_TOKEN', ...PROVIDER_KEY_ENV_NAMES] as const;

let tmpRoot = '';
const tmp = (): string => {
  if (!tmpRoot) tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-sandbox-'));
  return tmpRoot;
};

const setEnv = (): void => {
  process.env.GITHUB_TOKEN = 'ghp_dummy';
  process.env.ZAI_API_KEY = 'zai_dummy';
  process.env.ZHIPU_API_KEY = 'zhipu_dummy';
  process.env.DEEPSEEK_API_KEY = 'dsk_dummy';
};

// Snapshot the real environment so the stripProviderKeys test cannot destroy
// key values for test files that run after this one in the same process.
let envSnapshot: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const k of ENV_KEYS) envSnapshot[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (envSnapshot[k] === undefined) delete process.env[k];
    else process.env[k] = envSnapshot[k];
  }
  if (tmpRoot) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    tmpRoot = '';
  }
});

describe('sandbox permission config', () => {
  it('bash is the scalar "deny" — no command allowlist at all', () => {
    // Security audit 2026-10-10: external_directory is not applied to
    // grep/rg/head/tail/wc/ls/find/git, so ANY bash allowlist could read
    // /proc/self/environ or the real $HOME. The agent works through the
    // built-in file tools instead.
    expect(SANDBOX_PERMISSIONS.bash).toBe('deny');
    expect(SANDBOX_PERMISSIONS.webfetch).toBe('deny');
    expect(SANDBOX_PERMISSIONS.websearch).toBe('deny');
    expect(SANDBOX_PERMISSIONS.task).toBe('deny');
    expect(SANDBOX_PERMISSIONS.question).toBe('deny');
    expect(SANDBOX_PERMISSIONS.skill).toBe('deny');
    expect(SANDBOX_PERMISSIONS.lsp).toBe('deny');
  });

  it('the toolbox is the built-in file tools, confined by external_directory', () => {
    expect(SANDBOX_PERMISSIONS.read).toBe('allow');
    expect(SANDBOX_PERMISSIONS.grep).toBe('allow');
    expect(SANDBOX_PERMISSIONS.glob).toBe('allow');
    expect(SANDBOX_PERMISSIONS.list).toBe('allow');
    expect(SANDBOX_PERMISSIONS.write).toBeUndefined(); // unlisted = ask = auto-refused headlessly
    expect(SANDBOX_PERMISSIONS.external_directory).toEqual({ '*': 'deny' });
  });

  /**
   * Replicates opencode 1.18.30's permission evaluation (packages/opencode/
   * src/permission/index.ts evaluate + packages/core/src/util/wildcard.ts):
   * rules are checked with findLast in config key order — the LAST matching
   * rule wins — and patterns are full-string globs where `*` matches any
   * characters including `/`.
   */
  function opencodeWildcardMatch(input: string, pattern: string): boolean {
    const normalized = input.replaceAll('\\', '/');
    let escaped = pattern
      .replaceAll('\\', '/')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    if (escaped.endsWith(' .*')) escaped = escaped.slice(0, -3) + '( .*)?';
    return new RegExp(`^${escaped}$`, 's').test(normalized);
  }

  function evaluatePattern(rules: Record<string, string>, input: string): string {
    const rule = Object.entries(rules).findLast(([pattern]) =>
      opencodeWildcardMatch(input, pattern),
    );
    return rule ? rule[1] : 'ask';
  }

  it('edit allows workspace files but never the sandbox config itself', () => {
    const edit = SANDBOX_PERMISSIONS.edit as Record<string, string>;
    // workspace files stay editable (the tasks need it)
    for (const ok of [
      'src/utils/helpers.ts',
      'src/utils/index.ts',
      'README.md',
      '/abs/tmp/bench-ws-1/src/utils/helpers.ts',
    ]) {
      expect(evaluatePattern(edit, ok), `${ok} must be editable`).toBe('allow');
    }
    // the sandbox config must not be editable by the sandboxed agent —
    // otherwise it could rewrite its own permissions (self-escalation)
    for (const refused of [
      'opencode.json',
      './opencode.json',
      '/tmp/bench-ws-1/opencode.json',
      'nested/dir/opencode.json',
    ]) {
      expect(evaluatePattern(edit, refused), `${refused} must be denied`).toBe('deny');
    }
    // a similarly named file is NOT the config and stays editable
    expect(evaluatePattern(edit, 'sneaky-opencode.jsonx')).toBe('allow');
  });

  it('writeOpencodeConfig writes bash "deny" into opencode.json', () => {
    const ws = fs.mkdtempSync(path.join(tmp(), 'ws-'));
    const configPath = writeOpencodeConfig(ws, {
      includeDeepseekProvider: true,
      mcp: { command: [process.execPath, 'server.js', 'context.db'] },
    });
    expect(configPath).toBe(path.join(ws, 'opencode.json'));

    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const permission = written.permission as Record<string, unknown>;
    expect(permission.bash).toBe('deny'); // scalar — verified shape
    expect(permission.webfetch).toBe('deny');
    expect(permission.websearch).toBe('deny');
    const ext = permission.external_directory as Record<string, string>;
    expect(ext['*']).toBe('deny');
    const edit = permission.edit as Record<string, string>;
    expect(edit['*opencode.json']).toBe('deny');
  });

  it('writeOpencodeConfig still attaches the mcp and deepseek provider blocks', () => {
    const ws = fs.mkdtempSync(path.join(tmp(), 'ws-'));
    writeOpencodeConfig(ws, {
      includeDeepseekProvider: true,
      mcp: { command: [process.execPath, 'server.js', 'context.db'] },
    });
    const written = JSON.parse(
      fs.readFileSync(path.join(ws, 'opencode.json'), 'utf-8'),
    ) as Record<string, unknown>;
    expect(written.provider).toEqual({ deepseek: DEEPSEEK_PROVIDER_CONFIG });
    expect((written.mcp as Record<string, unknown>)['code-context']).toBeTruthy();
  });
});

describe('agent spawn env', () => {
  it('carries only the provider key it needs, never GITHUB_TOKEN or other keys', () => {
    setEnv();
    const env = agentSpawnEnv({
      fakeHome: '/tmp/fake-home',
      keyExportName: 'ZHIPU_API_KEY',
      key: 'glm-key-value',
      allowedRoots: '/tmp',
      pathValue: '/usr/bin',
    });
    expect(env.ZHIPU_API_KEY).toBe('glm-key-value');
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.ZAI_API_KEY).toBeUndefined();
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/tmp/fake-home');
    expect(env.TMPDIR).toBeTruthy();
    expect(env.CODE_CONTEXT_ALLOWED_ROOTS).toBe('/tmp');
  });

  it('deepseek arm never carries ZHIPU_API_KEY or ZAI_API_KEY', () => {
    setEnv();
    const env = agentSpawnEnv({
      fakeHome: '/tmp/fake-home',
      keyExportName: 'DEEPSEEK_API_KEY',
      key: 'dsk-key-value',
    });
    expect(env.DEEPSEEK_API_KEY).toBe('dsk-key-value');
    expect(env.ZHIPU_API_KEY).toBeUndefined();
    expect(env.ZAI_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });
});

describe('checker spawn env', () => {
  it('is scrubbed of every secret', () => {
    setEnv();
    const env = checkerSpawnEnv({ fakeHome: '/tmp/fake-home' });
    expect(env.CI).toBe('1');
    expect(env.NODE_ENV).toBe('test');
    expect(env.HOME).toBe('/tmp/fake-home');
    expect(env.PATH).toBeTruthy();
    expect(env.TMPDIR).toBeTruthy();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.ZAI_API_KEY).toBeUndefined();
    expect(env.ZHIPU_API_KEY).toBeUndefined();
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
  });
});

describe('stripProviderKeys', () => {
  it('removes every provider key name from the parent process.env', () => {
    setEnv();
    stripProviderKeys();
    for (const k of PROVIDER_KEY_ENV_NAMES) {
      expect(process.env[k], `${k} must be removed`).toBeUndefined();
    }
    expect(process.env.GITHUB_TOKEN).toBe('ghp_dummy'); // not a provider key
  });
});
