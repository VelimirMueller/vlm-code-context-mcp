import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { copyDirNonDestructive } from "../src/server/skills-install.js";

// The real vendored snapshot that ships in the npm package.
// These tests verify what a user GETS after `npm install` + `code-context-mcp setup`.
const SKILLS_DIR = path.resolve(__dirname, "../vendor/skills");

/** Paths (relative to root) of every file named `name` anywhere under dir. */
function collect(root: string, dir: string, name: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collect(root, full, name));
    else if (e.name === name) out.push(path.relative(root, full));
  }
  return out;
}

function domainDirs(): string[] {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

describe("user-perspective skills install (what an npm/download user gets)", () => {
  const temps: string[] = [];
  function temp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    temps.push(d);
    return d;
  }
  afterEach(() => {
    while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true });
  });

  it("ships a valid vendored snapshot (manifest count == actual SKILL.md count)", () => {
    expect(fs.existsSync(SKILLS_DIR)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, ".source.json"), "utf-8"));
    const actual = collect(SKILLS_DIR, SKILLS_DIR, "SKILL.md").length;
    expect(actual).toBeGreaterThan(0);
    expect(manifest.skillCount).toBe(actual);
  });

  it("installs flat into .claude/skills/<skill>/SKILL.md (the layout Claude Code discovers)", () => {
    const project = temp("proj-");
    const skillsDest = path.join(project, ".claude/skills");

    // Exactly the call setup.ts makes.
    const copied = copyDirNonDestructive(SKILLS_DIR, skillsDest, {
      exclude: [".source.json"],
      flattenTopLevel: domainDirs(),
    });

    expect(copied).toBeGreaterThan(0);

    const installed = collect(skillsDest, skillsDest, "SKILL.md");
    // No skills lost in translation.
    expect(installed.length).toBe(collect(SKILLS_DIR, SKILLS_DIR, "SKILL.md").length);
    // Every SKILL.md sits exactly one level deep: <skill>/SKILL.md (discoverable).
    for (const rel of installed) {
      expect(rel.split(path.sep).length).toBe(2);
    }
    // _shared lifted to a sibling so the skills' '../_shared/' references still resolve.
    expect(fs.existsSync(path.join(skillsDest, "_shared"))).toBe(true);
    // The domain wrapper must not survive (it would hide the skills from discovery).
    expect(fs.existsSync(path.join(skillsDest, "frontend"))).toBe(false);
    // The provenance manifest is internal — it must NOT ship into the user's project.
    expect(fs.existsSync(path.join(skillsDest, ".source.json"))).toBe(false);
    // A known skill landed at the discoverable path.
    expect(fs.existsSync(path.join(skillsDest, "set-up-routing/SKILL.md"))).toBe(true);
  });

  it("is non-destructive and idempotent on re-install", () => {
    const project = temp("proj-");
    const skillsDest = path.join(project, ".claude/skills");
    const opts = { exclude: [".source.json"], flattenTopLevel: domainDirs() };

    const first = copyDirNonDestructive(SKILLS_DIR, skillsDest, opts);
    const second = copyDirNonDestructive(SKILLS_DIR, skillsDest, opts);

    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0); // re-running setup overwrites nothing
  });
});
