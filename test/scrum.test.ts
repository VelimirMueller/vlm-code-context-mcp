import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema } from "../src/scrum/schema.js";
import Database from "better-sqlite3";

describe("Scrum Schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
  });

  it("creates all 9 scrum tables", () => {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain("agents");
    expect(tableNames).toContain("sprints");
    expect(tableNames).toContain("tickets");
    expect(tableNames).toContain("subtasks");
    expect(tableNames).toContain("retro_findings");
    expect(tableNames).toContain("blockers");
    expect(tableNames).toContain("bugs");
    expect(tableNames).toContain("skills");
    expect(tableNames).toContain("processes");
  });

  it("inserts and queries agents", () => {
    db.prepare(`INSERT INTO agents (role, name, description, model) VALUES (?, ?, ?, ?)`).run("backend-dev", "Backend Developer", "Handles APIs", "claude-sonnet-4-5");
    const agent = db.prepare(`SELECT * FROM agents WHERE role = ?`).get("backend-dev") as any;
    expect(agent.name).toBe("Backend Developer");
    expect(agent.model).toBe("claude-sonnet-4-5");
  });

  it("inserts sprint with tickets and cascades delete", () => {
    db.prepare(`INSERT INTO sprints (name, goal, status) VALUES (?, ?, ?)`).run("sprint-1", "Test goal", "active");
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("sprint-1") as { id: number };

    db.prepare(`INSERT INTO tickets (sprint_id, title, priority, status, story_points) VALUES (?, ?, ?, ?, ?)`).run(sprint.id, "Test ticket", "P0", "TODO", 3);
    db.prepare(`INSERT INTO tickets (sprint_id, title, priority, status, story_points) VALUES (?, ?, ?, ?, ?)`).run(sprint.id, "Another ticket", "P1", "DONE", 5);

    const tickets = db.prepare(`SELECT * FROM tickets WHERE sprint_id = ?`).all(sprint.id);
    expect(tickets).toHaveLength(2);

    // Delete sprint should cascade to tickets
    db.prepare(`DELETE FROM sprints WHERE id = ?`).run(sprint.id);
    const remaining = db.prepare(`SELECT * FROM tickets WHERE sprint_id = ?`).all(sprint.id);
    expect(remaining).toHaveLength(0);
  });

  it("inserts retro findings linked to sprint", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("sprint-2", "closed");
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("sprint-2") as { id: number };

    db.prepare(`INSERT INTO retro_findings (sprint_id, role, category, finding, action_owner) VALUES (?, ?, ?, ?, ?)`).run(sprint.id, "backend-dev", "went_well", "Test infra was solid", null);
    db.prepare(`INSERT INTO retro_findings (sprint_id, role, category, finding, action_owner, action_applied) VALUES (?, ?, ?, ?, ?, ?)`).run(sprint.id, "manager", "try_next", "Cap at 8pts/dev", "manager", 1);

    const findings = db.prepare(`SELECT * FROM retro_findings WHERE sprint_id = ?`).all(sprint.id) as any[];
    expect(findings).toHaveLength(2);
    expect(findings.find((f: any) => f.category === "try_next").action_applied).toBe(1);
  });

  it("enforces status check constraints on tickets", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("sprint-3", "active");
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("sprint-3") as { id: number };

    // Valid status should work
    expect(() => {
      db.prepare(`INSERT INTO tickets (sprint_id, title, status) VALUES (?, ?, ?)`).run(sprint.id, "Valid", "DONE");
    }).not.toThrow();

    // Invalid status should fail
    expect(() => {
      db.prepare(`INSERT INTO tickets (sprint_id, title, status) VALUES (?, ?, ?)`).run(sprint.id, "Invalid", "INVALID_STATUS");
    }).toThrow();
  });

  it("enforces priority check constraints", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("sprint-4", "active");
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("sprint-4") as { id: number };

    expect(() => {
      db.prepare(`INSERT INTO tickets (sprint_id, title, priority) VALUES (?, ?, ?)`).run(sprint.id, "Valid P0", "P0");
    }).not.toThrow();

    expect(() => {
      db.prepare(`INSERT INTO tickets (sprint_id, title, priority) VALUES (?, ?, ?)`).run(sprint.id, "Invalid", "P99");
    }).toThrow();
  });

  it("stores and retrieves skills", () => {
    db.prepare(`INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?)`).run("SPRINT_PROCESS", "5-day cycle...", "scrum-master");
    const skill = db.prepare(`SELECT * FROM skills WHERE name = ?`).get("SPRINT_PROCESS") as any;
    expect(skill.content).toBe("5-day cycle...");
    expect(skill.owner_role).toBe("scrum-master");
  });

  it("links bugs to sprints and optionally to tickets", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("sprint-5", "review");
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("sprint-5") as { id: number };

    db.prepare(`INSERT INTO bugs (sprint_id, severity, description) VALUES (?, ?, ?)`).run(sprint.id, "MEDIUM", "Parser misses async exports");
    const bugs = db.prepare(`SELECT * FROM bugs WHERE sprint_id = ?`).all(sprint.id);
    expect(bugs).toHaveLength(1);
  });
});
