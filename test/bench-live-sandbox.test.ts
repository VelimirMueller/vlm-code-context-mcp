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
import { describe, it, expect, afterEach } from 'vitest';
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

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  if (tmpRoot) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    tmpRoot = '';
  }
});

describe('sandbox permission config', () => {
  it('SANDBOX_PERMISSIONS denies bash by default and webfetch/websearch', () => {
    const bash = SANDBOX_PERMISSIONS.bash as Record<string, string>;
    expect(bash['*']).toBe('deny');
    expect(SANDBOX_PERMISSIONS.webfetch).toBe('deny');
    expect(SANDBOX_PERMISSIONS.websearch).toBe('deny');
    expect(SANDBOX_PERMISSIONS.task).toBe('deny');
    expect(SANDBOX_PERMISSIONS.question).toBe('deny');
  });

  it('SANDBOX_PERMISSIONS allowlists the read/test commands the tasks need', () => {
    const bash = SANDBOX_PERMISSIONS.bash as Record<string, string>;
    for (const cmd of ['ls*', 'cat*', 'grep*', 'rg*', 'find*', 'npx vitest*', 'npm test*']) {
      expect(bash[cmd], `${cmd} must be allowed`).toBe('allow');
    }
  });

  it('writeOpencodeConfig writes the deny rules into opencode.json', () => {
    const ws = fs.mkdtempSync(path.join(tmp(), 'ws-'));
    const configPath = writeOpencodeConfig(ws, {
      includeDeepseekProvider: true,
      mcp: { command: [process.execPath, 'server.js', 'context.db'] },
    });
    expect(configPath).toBe(path.join(ws, 'opencode.json'));

    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const permission = written.permission as Record<string, unknown>;
    const bash = permission.bash as Record<string, string>;
    expect(bash['*']).toBe('deny');
    expect(bash['npx vitest*']).toBe('allow');
    expect(permission.webfetch).toBe('deny');
    expect(permission.websearch).toBe('deny');
    const ext = permission.external_directory as Record<string, string>;
    expect(ext['*']).toBe('deny');
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
