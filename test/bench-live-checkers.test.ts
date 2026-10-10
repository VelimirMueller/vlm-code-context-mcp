/**
 * Task 6 unit tests — live-bench task set + deterministic checkers.
 *
 * Everything runs against temp copies of test/fixtures/sample-project; no
 * model, no opencode, no network. The L3 checker spawns the repo's vitest
 * inside the temp workspace (local process, still no network).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVE_TASKS, tasksByIds } from '../scripts/bench/live/tasks.mts';
import { runChecker, normaliseAnswer } from '../scripts/bench/live/checkers.mts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'sample-project');

const L1 = LIVE_TASKS.find((t) => t.id === 'L1')!;
const L2 = LIVE_TASKS.find((t) => t.id === 'L2')!;
const L3 = LIVE_TASKS.find((t) => t.id === 'L3')!;

let tmpRoot = '';

function freshWorkspace(): string {
  const ws = fs.mkdtempSync(path.join(tmpRoot, 'ws-'));
  fs.cpSync(FIXTURE, ws, { recursive: true });
  return ws;
}

/** Apply the L2 solution: slugify in helpers.ts + barrel re-export. */
function addSlugify(ws: string): void {
  const helpers = path.join(ws, 'src/utils/helpers.ts');
  fs.writeFileSync(
    helpers,
    `${fs.readFileSync(helpers, 'utf-8').trimEnd()}\n\n/**\n * Turn text into a lowercase dash-separated slug.\n */\nexport function slugify(text: string): string {\n  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");\n}\n`,
  );
  const barrel = path.join(ws, 'src/utils/index.ts');
  fs.writeFileSync(
    barrel,
    fs
      .readFileSync(barrel, 'utf-8')
      .replace(
        'export { formatDate, capitalize, clamp, generateId, DEFAULT_PAGE_SIZE } from "./helpers.js";',
        'export { formatDate, capitalize, clamp, generateId, slugify, DEFAULT_PAGE_SIZE } from "./helpers.js";',
      ),
  );
}

/** Apply the L3 solution: parseDuration in helpers.ts + barrel re-export. */
function addParseDuration(ws: string): void {
  const helpers = path.join(ws, 'src/utils/helpers.ts');
  fs.writeFileSync(
    helpers,
    `${fs.readFileSync(helpers, 'utf-8').trimEnd()}\n\n/**\n * Parse a duration string like "1h 30m" into milliseconds, or null.\n */\nexport function parseDuration(str: string): number | null {\n  const units: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };\n  let total = 0;\n  let matched = false;\n  for (const m of str.toLowerCase().matchAll(/(\\d+)\\s*(d|h|m|s)/g)) {\n    total += Number(m[1]) * units[m[2]];\n    matched = true;\n  }\n  return matched ? total : null;\n}\n`,
  );
  const barrel = path.join(ws, 'src/utils/index.ts');
  fs.writeFileSync(
    barrel,
    fs
      .readFileSync(barrel, 'utf-8')
      .replace(
        'export { formatDate, capitalize, clamp, generateId, DEFAULT_PAGE_SIZE } from "./helpers.js";',
        'export { formatDate, capitalize, clamp, generateId, parseDuration, DEFAULT_PAGE_SIZE } from "./helpers.js";',
      ),
  );
}

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-live-checkers-'));
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task set', () => {
  it('defines L1–L3 with prompts and checkers', () => {
    expect(LIVE_TASKS.map((t) => t.id)).toEqual(['L1', 'L2', 'L3']);
    for (const t of LIVE_TASKS) {
      expect(t.prompt.length).toBeGreaterThan(20);
      expect(t.checker.type).toMatch(/^(answer|symbol|tests)$/);
    }
  });

  it('tasksByIds resolves and rejects ids', () => {
    expect(tasksByIds(['L1', 'L3']).map((t) => t.id)).toEqual(['L1', 'L3']);
    expect(() => tasksByIds(['L9'])).toThrow(/unknown task id/);
  });
});

describe('L1 answer checker', () => {
  it('passes on the pristine fixture with the right answer', async () => {
    const ws = freshWorkspace();
    const res = await runChecker(
      L1,
      ws,
      '`formatDate` is exported by `src/utils/helpers.ts` (and re-exported through the\n`src/utils/index.ts` barrel). It has NO imports — it is self-contained and\ndepends only on the built-in JavaScript Date API.',
    );
    expect(res.pass).toBe(true);
  });

  it('fails with a wrong file', async () => {
    const ws = freshWorkspace();
    const res = await runChecker(
      L1,
      ws,
      'formatDate lives in src/services/api.ts and depends on types.ts.',
    );
    expect(res.pass).toBe(false);
    expect(res.detail).toMatch(/missing/);
  });

  it('fails when only the barrel is named', async () => {
    const ws = freshWorkspace();
    const res = await runChecker(
      L1,
      ws,
      'src/utils/index.ts exports formatDate; it depends on nothing.',
    );
    expect(res.pass).toBe(false);
  });

  it('fails on an empty answer', async () => {
    const res = await runChecker(L1, freshWorkspace(), '   ');
    expect(res.pass).toBe(false);
    expect(res.detail).toMatch(/empty/);
  });

  it('normalises case, backticks, backslashes and whitespace', () => {
    expect(normaliseAnswer('  `SRC\\Utils\\HELPERS.TS`  ')).toBe('src/utils/helpers.ts');
  });
});

describe('L2 symbol checker', () => {
  it('fails on the pristine workspace', async () => {
    const res = await runChecker(L2, freshWorkspace(), '');
    expect(res.pass).toBe(false);
    expect(res.detail).toMatch(/no workspace file exports slugify/);
  });

  it('passes on the modified workspace', async () => {
    const ws = freshWorkspace();
    addSlugify(ws);
    const res = await runChecker(L2, ws, 'added slugify to helpers.ts');
    expect(res.pass).toBe(true);
    expect(res.detail).toContain('src/utils/index.ts');
  });

  it('fails when the symbol exists but the barrel does not re-export it', async () => {
    const ws = freshWorkspace();
    const helpers = path.join(ws, 'src/utils/helpers.ts');
    fs.writeFileSync(
      helpers,
      `${fs.readFileSync(helpers, 'utf-8').trimEnd()}\n\nexport function slugify(text: string): string {\n  return text.toLowerCase();\n}\n`,
    );
    const res = await runChecker(L2, ws, '');
    expect(res.pass).toBe(false);
    expect(res.detail).toMatch(/does not re-export/);
  });
});

describe('L3 tests checker', () => {
  it('fails on the pristine workspace', async () => {
    const res = await runChecker(L3, freshWorkspace(), '');
    expect(res.pass).toBe(false);
    expect(res.detail).toMatch(/hidden check failed/);
  }, 180_000);

  it('passes on the modified workspace', async () => {
    const ws = freshWorkspace();
    addParseDuration(ws);
    const res = await runChecker(L3, ws, 'added parseDuration');
    expect(res.pass).toBe(true);
    expect(res.detail).toMatch(/hidden check passed/);
  }, 180_000);
});
