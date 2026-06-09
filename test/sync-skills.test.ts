import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { copyTree, countSkillFiles, writeSourceManifest } from "../scripts/sync-skills.mjs";

const temps: string[] = [];
function temp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.push(d);
  return d;
}
function write(dir: string, rel: string, content: string): void {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

describe("sync-skills helpers", () => {
  afterEach(() => {
    while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true });
  });

  it("copyTree copies a nested tree", () => {
    const src = temp("up-");
    const dest = temp("dn-");
    write(src, "frontend/set-up-auth/SKILL.md", "# auth");
    write(src, "frontend/_shared/glossary.md", "# gloss");

    copyTree(src, path.join(dest, "skills"));

    expect(fs.existsSync(path.join(dest, "skills/frontend/set-up-auth/SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(dest, "skills/frontend/_shared/glossary.md"))).toBe(true);
  });

  it("countSkillFiles counts SKILL.md recursively", () => {
    const src = temp("up-");
    write(src, "frontend/a/SKILL.md", "# a");
    write(src, "frontend/b/SKILL.md", "# b");
    write(src, "frontend/_shared/conventions.md", "# c");

    expect(countSkillFiles(src)).toBe(2);
  });

  it("writeSourceManifest writes a complete manifest with trailing newline", () => {
    const dir = temp("vendor-");
    const manifest = writeSourceManifest(dir, {
      source: "https://example.com/repo",
      ref: "main",
      commit: "abc1234",
      syncedAt: "2026-06-09T06:00:00Z",
      skillCount: 2,
    });

    expect(manifest.skillCount).toBe(2);
    const raw = fs.readFileSync(path.join(dir, ".source.json"), "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({
      source: "https://example.com/repo",
      ref: "main",
      commit: "abc1234",
      syncedAt: "2026-06-09T06:00:00Z",
      skillCount: 2,
    });
  });
});
