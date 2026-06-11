import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedDefaults, seedFrontendSkills, FE_PRIMER_NAME } from "../src/scrum/defaults.js";
import { FRONTEND_SKILL_DEFAULTS } from "../src/scrum/frontend-skill-defaults.generated.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
});

const feCount = () =>
  (db.prepare("SELECT COUNT(*) as c FROM skills WHERE name LIKE 'fe:%'").get() as { c: number }).c;

describe("seedFrontendSkills", () => {
  it("inserts the primer plus every compiled frontend skill", () => {
    const inserted = seedFrontendSkills(db);
    expect(inserted).toBe(FRONTEND_SKILL_DEFAULTS.length + 1); // +1 primer
    expect(feCount()).toBe(FRONTEND_SKILL_DEFAULTS.length + 1);
    const primer = db.prepare("SELECT content FROM skills WHERE name = ?").get(FE_PRIMER_NAME) as { content: string };
    expect(primer.content).toContain("Frontend House Style");
  });

  it("is idempotent — a second run inserts nothing", () => {
    seedFrontendSkills(db);
    expect(seedFrontendSkills(db)).toBe(0);
  });

  it("preserves user edits across re-seeds", () => {
    seedFrontendSkills(db);
    db.prepare("UPDATE skills SET content = 'MY EDIT' WHERE name = ?").run(FE_PRIMER_NAME);
    seedFrontendSkills(db);
    const row = db.prepare("SELECT content FROM skills WHERE name = ?").get(FE_PRIMER_NAME) as { content: string };
    expect(row.content).toBe("MY EDIT");
  });

  it("coexists with the 5 structural skills via seedDefaults", () => {
    seedDefaults(db);
    const structural = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name NOT LIKE 'fe:%' AND name NOT LIKE 'la:%' AND name NOT LIKE 'wf:%'").get() as { c: number };
    expect(structural.c).toBe(5);
    expect(feCount()).toBeGreaterThan(0);
  });
});
