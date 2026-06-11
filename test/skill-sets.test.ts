import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema";
import { seedSkillSets } from "../src/scrum/defaults";
import {
  SKILL_SETS,
  SKILL_SETS_ENABLED_KEY,
  defaultEnablement,
  formatEnablement,
  getEnabledSkillSets,
  setEnabledSkillSets,
  skillSetForName,
  skillSetsConfigured,
} from "../src/scrum/skill-sets";
import {
  buildFrontendPlaybook,
  buildSkillSetIndex,
  buildWorkflowPlaybook,
} from "../src/scrum/frontend-playbook";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  initScrumSchema(db);
});

describe("enablement config", () => {
  it("missing row yields registry defaults: frontend-only (back-compat for existing DBs)", () => {
    const map = getEnabledSkillSets(db);
    expect(map).toEqual({ frontend: true, landing: false, workflow: false });
    expect(skillSetsConfigured(db)).toBe(false);
  });

  it("partial update persists and leaves omitted sets unchanged", () => {
    setEnabledSkillSets(db, { landing: true });
    const map = getEnabledSkillSets(db);
    expect(map).toEqual({ frontend: true, landing: true, workflow: false });
    expect(skillSetsConfigured(db)).toBe(true);

    setEnabledSkillSets(db, { workflow: true, frontend: false });
    expect(getEnabledSkillSets(db)).toEqual({ frontend: false, landing: true, workflow: true });
  });

  it("corrupt config row falls back to defaults", () => {
    db.prepare("INSERT INTO skills (name, content, owner_role) VALUES (?, ?, NULL)").run(
      SKILL_SETS_ENABLED_KEY,
      "{not json",
    );
    expect(getEnabledSkillSets(db)).toEqual(defaultEnablement());
  });

  it("formatEnablement marks unconfigured projects", () => {
    expect(formatEnablement(defaultEnablement(), false)).toContain("(defaults — not configured yet)");
    expect(formatEnablement(defaultEnablement(), true)).not.toContain("not configured");
  });
});

describe("skillSetForName", () => {
  it("resolves each registered prefix", () => {
    expect(skillSetForName("fe:set-up-auth")?.id).toBe("frontend");
    expect(skillSetForName("la:build-landing-page")?.id).toBe("landing");
    expect(skillSetForName("wf:write-pull-requests")?.id).toBe("workflow");
  });

  it("returns null for structural rows and unknown prefixes", () => {
    expect(skillSetForName("SPRINT_PROCESS_JSON")).toBeNull();
    expect(skillSetForName("xx:whatever")).toBeNull();
    expect(skillSetForName(":leading-colon")).toBeNull();
  });
});

describe("seedSkillSets", () => {
  it("seeds all three sets with their registry owner roles", () => {
    seedSkillSets(db);
    const la = db.prepare("SELECT owner_role FROM skills WHERE name = 'la:build-landing-page'").get() as any;
    expect(la?.owner_role).toBe("fe-engineer");
    const wf = db.prepare("SELECT owner_role FROM skills WHERE name = 'wf:write-pull-requests'").get() as any;
    expect(wf).toBeDefined();
    expect(wf.owner_role).toBeNull();
    const fe = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name LIKE 'fe:%'").get() as any;
    expect(fe.c).toBeGreaterThan(0);
  });

  it("is idempotent — second call inserts nothing", () => {
    seedSkillSets(db);
    expect(seedSkillSets(db)).toBe(0);
  });

  it("does not create the enablement row (content ≠ enabled)", () => {
    seedSkillSets(db);
    expect(skillSetsConfigured(db)).toBe(false);
  });
});

describe("buildSkillSetIndex", () => {
  it("lists top-level skills only — no companions, _shared, or primer", () => {
    seedSkillSets(db);
    const wfSet = SKILL_SETS.find((s) => s.id === "workflow")!;
    const index = buildSkillSetIndex(db, wfSet);
    expect(index.join("\n")).toContain("wf:write-pull-requests");
    expect(index.join("\n")).toContain("wf:write-commit-messages");
    expect(index.join("\n")).not.toContain("wf:_shared");
    expect(index.join("\n")).not.toContain("/"); // no companion paths
  });
});

describe("playbook composition", () => {
  beforeEach(() => seedSkillSets(db));

  it("frontend playbook excludes landing when landing is disabled", () => {
    const playbook = buildFrontendPlaybook(db);
    expect(playbook).toContain("Frontend Playbook");
    expect(playbook).toContain("fe:set-up-auth");
    expect(playbook).not.toContain("la:");
  });

  it("frontend playbook includes the landing index when enabled", () => {
    setEnabledSkillSets(db, { landing: true });
    const playbook = buildFrontendPlaybook(db);
    expect(playbook).toContain("Available landing-page skills");
    expect(playbook).toContain("la:build-landing-page");
  });

  it("frontend playbook is null when the frontend set is disabled", () => {
    setEnabledSkillSets(db, { frontend: false });
    expect(buildFrontendPlaybook(db)).toBeNull();
  });

  it("workflow playbook is null by default and renders when enabled", () => {
    expect(buildWorkflowPlaybook(db)).toBeNull();
    setEnabledSkillSets(db, { workflow: true });
    const wf = buildWorkflowPlaybook(db);
    expect(wf).toContain("Workflow Skills");
    expect(wf).toContain("wf:write-commit-messages");
  });
});
