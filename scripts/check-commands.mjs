#!/usr/bin/env node
// Validate .claude/commands/*.md structure (ticket #241, adopts Sprint 5 try_next).
//
// Checks:
//   - every command file: <= 400 lines (regression ceiling)
//   - kickoff.md: >= 9 "## Phase " lines, "## Rules" section with >= 10 numbered
//     rules, Step 0 contract strings (load_phase_context, get_resume_state),
//     v1.4 contract strings (AskUserQuestion, format: "card"), and zero
//     box-drawing characters (only ┌ ┐ └ ┘ │ are flagged — a bare ─ is allowed
//     inside yaml/diff examples)
//   - retro.md: load_phase_context, add_retro_finding, triage_retro_finding or
//     "lifecycle", and a "## Rules" section
//
// Usage: node scripts/check-commands.mjs [commandsDir]   (default: .claude/commands)
// Exit 0 with a per-file OK summary; exit 1 listing each violation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_DIR = path.join(REPO_ROOT, '.claude', 'commands');

const MAX_LINES = 400;
const BOX_CHARS = /[┌┐└┘│]/;

/** Split into lines; line number = index + 1 (matches editors and wc -l). */
function splitLines(content) {
  return content.split(/\r?\n/);
}

/** Count lines the way `wc -l` does: a trailing newline is not an extra line. */
function countLines(lines) {
  return lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

/**
 * Find the "## Rules" section. Returns null if missing, otherwise
 * { headingLine, numberedCount } where numberedCount is the number of
 * numbered list items (lines starting with "<digits>.") before the next
 * "## " heading or EOF.
 */
function findRulesSection(lines) {
  const headingIdx = lines.findIndex((l) => /^## Rules\b/.test(l));
  if (headingIdx === -1) return null;
  let numberedCount = 0;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    if (/^\d+\./.test(lines[i])) numberedCount++;
  }
  return { headingLine: headingIdx + 1, numberedCount };
}

function checkRequiredStrings(file, content, required, violations) {
  for (const [needle, label] of required) {
    if (!content.includes(needle)) {
      violations.push({ file, rule: `missing required string "${needle}" (${label})` });
    }
  }
}

function checkKickoff(file, content, lines, violations) {
  const phaseCount = lines.filter((l) => /^## Phase /.test(l)).length;
  if (phaseCount < 9) {
    violations.push({
      file,
      rule: `expected >= 9 "## Phase " lines, found ${phaseCount}`,
    });
  }

  const rules = findRulesSection(lines);
  if (!rules) {
    violations.push({ file, rule: 'missing "## Rules" section' });
  } else if (rules.numberedCount < 10) {
    violations.push({
      file,
      rule: `"## Rules" section has ${rules.numberedCount} numbered rules, expected >= 10`,
      line: rules.headingLine,
    });
  }

  checkRequiredStrings(
    file,
    content,
    [
      ['load_phase_context', 'Step 0 contract'],
      ['get_resume_state', 'Step 0 contract'],
      ['AskUserQuestion', 'v1.4 contract'],
      ['format: "card"', 'v1.4 contract'],
    ],
    violations,
  );

  lines.forEach((l, i) => {
    if (BOX_CHARS.test(l)) {
      violations.push({
        file,
        rule: `box-drawing character (one of ┌ ┐ └ ┘ │) — cards must be diff-fenced, not redrawn`,
        line: i + 1,
      });
    }
  });
}

function checkRetro(file, content, lines, violations) {
  checkRequiredStrings(
    file,
    content,
    [
      ['load_phase_context', 'phase context contract'],
      ['add_retro_finding', 'retro tool contract'],
    ],
    violations,
  );
  if (!content.includes('triage_retro_finding') && !content.includes('lifecycle')) {
    violations.push({
      file,
      rule: 'missing "triage_retro_finding" or "lifecycle" (finding lifecycle contract)',
    });
  }
  if (!findRulesSection(lines)) {
    violations.push({ file, rule: 'missing "## Rules" section' });
  }
}

function main() {
  const dirArg = process.argv[2];
  const commandsDir = dirArg ? path.resolve(dirArg) : DEFAULT_DIR;

  if (!fs.existsSync(commandsDir) || !fs.statSync(commandsDir).isDirectory()) {
    console.error(`check-commands: directory not found: ${commandsDir}`);
    process.exit(1);
  }

  const mdFiles = fs
    .readdirSync(commandsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const violations = [];

  for (const required of ['kickoff.md', 'retro.md']) {
    if (!mdFiles.includes(required)) {
      violations.push({ file: required, rule: 'required command file is missing' });
    }
  }

  for (const file of mdFiles) {
    const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
    const lines = splitLines(content);
    const lineCount = countLines(lines);

    if (lineCount > MAX_LINES) {
      violations.push({
        file,
        rule: `${lineCount} lines exceeds the ${MAX_LINES}-line ceiling`,
      });
    }

    if (file === 'kickoff.md') checkKickoff(file, content, lines, violations);
    if (file === 'retro.md') checkRetro(file, content, lines, violations);

    const fileViolations = violations.filter((v) => v.file === file);
    if (fileViolations.length === 0) {
      console.log(`OK   ${file} (${lineCount} lines)`);
    } else {
      console.log(
        `FAIL ${file} (${fileViolations.length} violation${fileViolations.length === 1 ? '' : 's'})`,
      );
    }
  }

  if (violations.length > 0) {
    console.error(`\ncheck-commands: ${violations.length} violation(s) in ${commandsDir}:`);
    for (const v of violations) {
      const loc = v.line !== undefined ? `:${v.line}` : '';
      console.error(`  - ${v.file}${loc} — ${v.rule}`);
    }
    process.exit(1);
  }

  console.log(`\ncheck-commands: all ${mdFiles.length} command files passed.`);
}

main();
