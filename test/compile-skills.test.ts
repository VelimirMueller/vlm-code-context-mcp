import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileSkills, renderModule } from "../scripts/compile-skills.mjs";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "compile-skills-"));
  fs.mkdirSync(path.join(tmp, "set-up-auth"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "set-up-auth", "SKILL.md"),
    "---\nname: set-up-auth\ndescription: Use when adding authentication.\n---\nBody.",
  );
  fs.writeFileSync(path.join(tmp, "set-up-auth", "auth-patterns.md"), "patterns body");
  fs.mkdirSync(path.join(tmp, "_shared"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "_shared", "react.md"), "shared conventions");
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("compileSkills", () => {
  it("emits one fe:<slug> row per SKILL.md with owner_role fe-engineer", () => {
    const rows = compileSkills(tmp);
    const auth = rows.find((r) => r.name === "fe:set-up-auth");
    expect(auth).toBeDefined();
    expect(auth!.owner_role).toBe("fe-engineer");
    expect(auth!.content).toContain("description: Use when adding authentication.");
  });

  it("emits shared files as fe:_shared/<relpath>", () => {
    const rows = compileSkills(tmp);
    expect(rows.find((r) => r.name === "fe:_shared/react.md")).toBeDefined();
  });

  it("emits per-skill companion docs as fe:<skill>/<file>", () => {
    const rows = compileSkills(tmp);
    expect(rows.find((r) => r.name === "fe:set-up-auth/auth-patterns.md")).toBeDefined();
    // SKILL.md still collapses to the bare skill name (not fe:set-up-auth/SKILL.md)
    expect(rows.find((r) => r.name === "fe:set-up-auth")).toBeDefined();
    expect(rows.find((r) => r.name === "fe:set-up-auth/SKILL.md")).toBeUndefined();
  });

  it("returns [] for a missing srcDir", () => expect(compileSkills(path.join(tmp, "nope"))).toEqual([]));

  it("renderModule produces a valid TS export", () => {
    const mod = renderModule(compileSkills(tmp));
    expect(mod).toContain("export const FRONTEND_SKILL_DEFAULTS");
    expect(mod).toContain('"fe:set-up-auth"');
  });
});
