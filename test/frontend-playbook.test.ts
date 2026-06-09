import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedFrontendSkills } from "../src/scrum/defaults.js";
import { getSkillContent, parseSkillSummary, buildFrontendPlaybook } from "../src/scrum/frontend-playbook.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  initScrumSchema(db);
  seedFrontendSkills(db);
});

describe("parseSkillSummary", () => {
  it("extracts the frontmatter description", () => {
    expect(parseSkillSummary("---\nname: x\ndescription: Hello there.\n---\nBody")).toBe("Hello there.");
  });
  it("returns empty string when no frontmatter", () => {
    expect(parseSkillSummary("no frontmatter")).toBe("");
  });
  it("strips surrounding quotes", () => {
    expect(parseSkillSummary("---\ndescription: \"Hello 'world'\"\n---")).toBe("Hello 'world'");
  });
  it("handles CRLF frontmatter", () => {
    expect(parseSkillSummary("---\r\nname: x\r\ndescription: Hi there.\r\n---\r\nbody")).toBe("Hi there.");
  });
  it("returns empty for a block-scalar description", () => {
    expect(parseSkillSummary("---\ndescription: |\n  multi\n  line\n---")).toBe("");
  });
});

describe("getSkillContent", () => {
  it("returns content for a real skill", () => {
    expect(getSkillContent(db, "fe:_house-style")).toContain("Frontend House Style");
  });
  it("returns content for a companion doc", () => {
    expect(getSkillContent(db, "fe:set-up-auth/auth-patterns.md")).toContain("Auth Patterns");
  });
  it("returns null for a missing skill", () => {
    expect(getSkillContent(db, "fe:does-not-exist")).toBeNull();
  });
});

describe("buildFrontendPlaybook", () => {
  it("includes the primer, the index, and the get_skill instruction", () => {
    const md = buildFrontendPlaybook(db)!;
    expect(md).toContain("## Frontend Playbook");
    expect(md).toContain("Frontend House Style");
    expect(md).toContain("get_skill({ name })");
    expect(md).toMatch(/- `fe:[a-z-]+`/); // at least one top-level skill
  });
  it("excludes the primer, _shared, and companion rows from the index list", () => {
    const md = buildFrontendPlaybook(db)!;
    expect(md).not.toMatch(/- `fe:_house-style`/);
    expect(md).not.toMatch(/- `fe:_shared\//);
    expect(md).not.toMatch(/- `fe:[a-z0-9-]+\/[^`]+`/); // no companion (slashed name) in the index
  });
  it("returns null when no frontend skills are present", () => {
    const empty = new Database(":memory:");
    initScrumSchema(empty);
    expect(buildFrontendPlaybook(empty)).toBeNull();
  });
});
