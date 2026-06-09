import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { copyDirNonDestructive } from "../src/server/skills-install.js";

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

describe("copyDirNonDestructive", () => {
  afterEach(() => {
    while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true });
  });

  it("copies a nested tree and returns the file count", () => {
    const src = temp("skills-src-");
    const dest = temp("skills-dest-");
    write(src, "frontend/set-up-routing/SKILL.md", "# routing");
    write(src, "frontend/_shared/conventions.md", "# conv");

    const count = copyDirNonDestructive(src, dest);

    expect(count).toBe(2);
    expect(fs.readFileSync(path.join(dest, "frontend/set-up-routing/SKILL.md"), "utf-8")).toBe("# routing");
    expect(fs.existsSync(path.join(dest, "frontend/_shared/conventions.md"))).toBe(true);
  });

  it("does not overwrite existing destination files", () => {
    const src = temp("skills-src-");
    const dest = temp("skills-dest-");
    write(src, "frontend/a/SKILL.md", "NEW");
    write(dest, "frontend/a/SKILL.md", "USER EDIT");

    const count = copyDirNonDestructive(src, dest);

    expect(count).toBe(0);
    expect(fs.readFileSync(path.join(dest, "frontend/a/SKILL.md"), "utf-8")).toBe("USER EDIT");
  });

  it("skips excluded basenames at any depth", () => {
    const src = temp("skills-src-");
    const dest = temp("skills-dest-");
    write(src, ".source.json", "{}");
    write(src, "frontend/a/SKILL.md", "# a");

    const count = copyDirNonDestructive(src, dest, { exclude: [".source.json"] });

    expect(count).toBe(1);
    expect(fs.existsSync(path.join(dest, ".source.json"))).toBe(false);
    expect(fs.existsSync(path.join(dest, "frontend/a/SKILL.md"))).toBe(true);
  });
});
