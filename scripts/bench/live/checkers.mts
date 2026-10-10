/**
 * Deterministic checkers for the live bench task set (PLAN.md task 6).
 *
 * Checkers take `(workspaceDir, finalAnswer)` and return `{ pass, detail }` —
 * no model, no opencode, no network. Symbol detection reuses `parseExports`
 * from src/server/indexer.ts instead of reimplementing it. Hidden check
 * files are copied into the workspace only at check time, never before.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExports } from '../../../src/server/indexer.js';
import type { LiveTask } from './tasks.mts';

export interface CheckResult {
  pass: boolean;
  detail: string;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const CHECKS_DIR = path.join(scriptDir, 'checks');
const CHECK_TIMEOUT_MS = 120_000;

/** Lowercase, strip quotes/backticks, forward slashes, collapse whitespace. */
export function normaliseAnswer(answer: string): string {
  return answer.toLowerCase().replace(/[`"']/g, '').replace(/\\/g, '/').replace(/\s+/g, ' ').trim();
}

function checkAnswer(task: LiveTask, finalAnswer: string): CheckResult {
  const norm = normaliseAnswer(finalAnswer);
  if (!norm) return { pass: false, detail: 'empty final answer' };
  const missing: string[] = [];
  for (const source of (task.checker as { answerMustMatch: string[] }).answerMustMatch) {
    if (!new RegExp(source).test(norm)) missing.push(`/${source}/`);
  }
  return missing.length === 0
    ? { pass: true, detail: 'answer matches all patterns' }
    : { pass: false, detail: `answer missing: ${missing.join(' ')}` };
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full));
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function checkSymbol(task: LiveTask, workspaceDir: string): CheckResult {
  const { symbol, barrel } = task.checker as { symbol: string; barrel: string };
  const srcDir = path.join(workspaceDir, 'src');
  if (!fs.existsSync(srcDir)) return { pass: false, detail: 'no src/ directory in workspace' };

  const definers: string[] = [];
  for (const file of listTsFiles(srcDir)) {
    const exports = parseExports(fs.readFileSync(file, 'utf-8'));
    if (exports.some((e) => e.name === symbol)) {
      definers.push(path.relative(workspaceDir, file));
    }
  }
  if (definers.length === 0) {
    return { pass: false, detail: `no workspace file exports ${symbol}` };
  }

  const barrelPath = path.join(workspaceDir, barrel);
  if (!fs.existsSync(barrelPath)) {
    return {
      pass: false,
      detail: `barrel ${barrel} not found (defined in ${definers.join(', ')})`,
    };
  }
  const barrelExports = parseExports(fs.readFileSync(barrelPath, 'utf-8'));
  if (!barrelExports.some((e) => e.name === symbol)) {
    return {
      pass: false,
      detail: `${barrel} does not re-export ${symbol} (defined in ${definers.join(', ')})`,
    };
  }
  return {
    pass: true,
    detail: `${symbol} defined in ${definers.join(', ')} and re-exported from ${barrel}`,
  };
}

async function checkTests(task: LiveTask, workspaceDir: string): Promise<CheckResult> {
  const { checkFile } = task.checker as { checkFile: string };
  const source = path.join(CHECKS_DIR, checkFile);
  if (!fs.existsSync(source))
    return { pass: false, detail: `hidden check file missing: ${checkFile}` };

  const targetDir = path.join(workspaceDir, 'test');
  fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, checkFile);
  fs.copyFileSync(source, target);

  const vitestBin = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
  if (!fs.existsSync(vitestBin)) {
    return { pass: false, detail: 'vitest not installed in the repo (npm ci first)' };
  }

  const { code, tail } = await new Promise<{ code: number | null; tail: string }>((resolve) => {
    const child = execFile(
      process.execPath,
      [vitestBin, 'run', path.posix.join('test', checkFile)],
      {
        cwd: workspaceDir,
        timeout: CHECK_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        env: process.env,
      },
      (err, stdout) => {
        const out = String(stdout ?? '');
        resolve({
          code:
            err && typeof (err as { code?: number }).code === 'number'
              ? (err as { code: number }).code
              : err
                ? 1
                : 0,
          tail: out.slice(-600),
        });
      },
    );
    void child;
  });

  return code === 0
    ? { pass: true, detail: `hidden check passed (${checkFile})` }
    : {
        pass: false,
        detail: `hidden check failed (exit ${code}): …${tail.replace(/\s+/g, ' ').slice(-300)}`,
      };
}

export async function runChecker(
  task: LiveTask,
  workspaceDir: string,
  finalAnswer: string,
): Promise<CheckResult> {
  switch (task.checker.type) {
    case 'answer':
      return checkAnswer(task, finalAnswer);
    case 'symbol':
      return checkSymbol(task, workspaceDir);
    case 'tests':
      return checkTests(task, workspaceDir);
  }
}
