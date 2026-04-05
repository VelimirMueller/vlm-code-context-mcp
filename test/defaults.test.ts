import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import {
  AGENT_DEFAULTS,
  SKILL_DEFAULTS,
  seedDefaults,
  resetAgents,
  resetSkills,
  resetSprintProcess,
} from "../src/scrum/defaults.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
});

describe("seedDefaults", () => {
  it("populates empty agents table with all defaults", () => {
    const result = seedDefaults(db);
    expect(result.agents).toBe(AGENT_DEFAULTS.length);
    const rows = db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number };
    expect(rows.c).toBe(AGENT_DEFAULTS.length);
  });

  it("populates empty skills table with defaults", () => {
    const result = seedDefaults(db);
    expect(result.skills).toBe(SKILL_DEFAULTS.length);
  });

  it("does NOT overwrite agents if table already has data", () => {
    db.prepare("INSERT INTO agents (role, name) VALUES (?, ?)").run("custom-agent", "Custom");
    const result = seedDefaults(db);
    expect(result.agents).toBe(0);
    const rows = db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number };
    expect(rows.c).toBe(1); // only the custom one
  });

  it("does NOT overwrite skills if table already has data", () => {
    db.prepare("INSERT INTO skills (name, content) VALUES (?, ?)").run("MY_SKILL", "content");
    const result = seedDefaults(db);
    expect(result.skills).toBe(0);
    const rows = db.prepare("SELECT COUNT(*) as c FROM skills").get() as { c: number };
    expect(rows.c).toBe(1);
  });

  it("is idempotent — second call seeds nothing", () => {
    seedDefaults(db);
    const result = seedDefaults(db);
    expect(result.agents).toBe(0);
    expect(result.skills).toBe(0);
  });

  it("seeds all agent fields correctly", () => {
    seedDefaults(db);
    const dev = db.prepare("SELECT * FROM agents WHERE role = 'developer'").get() as any;
    expect(dev).toBeDefined();
    expect(dev.name).toBe("Developer");
    expect(dev.model).toBe("claude-sonnet-4-6");
    expect(dev.description).toContain("Implements");
  });
});

describe("resetAgents", () => {
  it("truncates and re-seeds agents", () => {
    // Add custom agents
    db.prepare("INSERT INTO agents (role, name) VALUES (?, ?)").run("custom-1", "Custom 1");
    db.prepare("INSERT INTO agents (role, name) VALUES (?, ?)").run("custom-2", "Custom 2");
    expect((db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number }).c).toBe(2);

    const count = resetAgents(db);
    expect(count).toBe(AGENT_DEFAULTS.length);
    expect((db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number }).c).toBe(AGENT_DEFAULTS.length);

    // Custom agents gone
    const custom = db.prepare("SELECT * FROM agents WHERE role = 'custom-1'").get();
    expect(custom).toBeUndefined();

    // Factory agents present
    const dev = db.prepare("SELECT * FROM agents WHERE role = 'developer'").get();
    expect(dev).toBeDefined();
  });
});

describe("resetSkills", () => {
  it("truncates and re-seeds skills", () => {
    db.prepare("INSERT INTO skills (name, content) VALUES (?, ?)").run("OLD_SKILL", "old");
    const count = resetSkills(db);
    expect(count).toBe(SKILL_DEFAULTS.length);

    const old = db.prepare("SELECT * FROM skills WHERE name = 'OLD_SKILL'").get();
    expect(old).toBeUndefined();
  });
});

describe("resetSprintProcess", () => {
  it("resets process config skills", () => {
    db.prepare("INSERT INTO skills (name, content) VALUES (?, ?)").run("SPRINT_PROCESS_JSON", "broken");
    resetSprintProcess(db);
    const row = db.prepare("SELECT content FROM skills WHERE name = 'SPRINT_PROCESS_JSON'").get() as { content: string };
    expect(row).toBeDefined();
    expect(row.content).toContain("Implementation");
    expect(row.content).not.toBe("broken");
  });
});

describe("AGENT_DEFAULTS integrity", () => {
  it("has 4 agents", () => {
    expect(AGENT_DEFAULTS.length).toBe(4);
  });

  it("all agents have required fields", () => {
    for (const a of AGENT_DEFAULTS) {
      expect(a.role).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.model).toBeTruthy();
    }
  });

  it("has the 4 core roles", () => {
    const roles = AGENT_DEFAULTS.map(a => a.role).sort();
    expect(roles).toEqual(["developer", "devops", "product-owner", "qa"]);
  });

  it("no duplicate roles", () => {
    const roles = AGENT_DEFAULTS.map(a => a.role);
    expect(new Set(roles).size).toBe(roles.length);
  });
});

describe("DB restart preserves data", () => {
  it("existing agents survive seedDefaults on fresh connection", () => {
    // Simulate: first startup seeds, second startup should not overwrite
    seedDefaults(db);
    // Modify an agent
    db.prepare("UPDATE agents SET model = 'custom-model' WHERE role = 'qa'").run();

    // Simulate restart — call seedDefaults again
    seedDefaults(db);

    const qa = db.prepare("SELECT model FROM agents WHERE role = 'qa'").get() as { model: string };
    expect(qa.model).toBe("custom-model"); // NOT overwritten
  });
});
