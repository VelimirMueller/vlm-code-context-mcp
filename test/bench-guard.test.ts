import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORKFLOWS = resolve(__dirname, '../.github/workflows');

const workflowFiles = (): string[] => readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'));

// The one pre-existing non-benchmark workflow that legitimately runs on a daily
// schedule. sync-skills.yml re-vendors skill files (scripts/sync-skills.mjs +
// scripts/compile-skills.mjs); it never invokes a model, benchmark data, or the
// benchmark scripts, so it sits outside the "benchmarks on demand" rule.
// PLAN.md task 1 said "every .github/workflows/*.yml", which would also flag
// sync-skills.yml; that schedule is the owner's existing behaviour and removing
// it is out of scope for tasks 1-5 (see PR notes).
const NON_BENCHMARK_SCHEDULED = new Set(['sync-skills.yml']);

/**
 * Extract the block of lines under the top-level `on:` key. Returns the joined
 * lines (without the `on:` line itself) or null when there is no `on:` key.
 */
function onBlock(content: string): string | null {
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => /^on\s*:/.test(l));
  if (idx === -1) return null;
  const baseIndent = (lines[idx].match(/^\s*/) ?? [''])[0].length;
  const body: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const indent = (line.match(/^\s*/) ?? [''])[0].length;
    if (indent <= baseIndent) break;
    body.push(line);
  }
  return body.join('\n');
}

describe('bench guard — benchmarks run on demand only, never on a schedule', () => {
  it('no workflow contains schedule: or cron: (block or flow style)', () => {
    for (const f of workflowFiles()) {
      if (NON_BENCHMARK_SCHEDULED.has(f)) continue;
      const content = readFileSync(join(WORKFLOWS, f), 'utf-8');
      // Not anchored to line starts: also catches flow style (`on: [push,
      // schedule]`) and inline mappings (`triggers: { schedule: … }`).
      expect(content, `${f} must not contain a schedule trigger`).not.toMatch(/(^|\s)schedule\s*:/);
      expect(content, `${f} must not contain a cron expression`).not.toMatch(/\bcron\s*:/);
    }
  });

  it('benchmark.yml (when present) is workflow_dispatch-only', () => {
    const file = join(WORKFLOWS, 'benchmark.yml');
    if (!existsSync(file)) return; // task 9 adds it; tolerated until then
    const content = readFileSync(file, 'utf-8');
    const block = onBlock(content);
    expect(block, 'benchmark.yml must declare an on: block').not.toBeNull();
    expect(block).toContain('workflow_dispatch');
    const forbidden = ['push:', 'pull_request:', 'schedule:', 'workflow_call:', 'workflow_run:',
      'repository_dispatch:'];
    for (const key of forbidden) {
      expect(block, `benchmark.yml must not trigger on ${key}`).not.toContain(key);
    }
  });
});
