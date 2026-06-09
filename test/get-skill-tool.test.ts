import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedDefaults } from "../src/scrum/defaults.js";
import { buildFrontendPlaybook, getSkillContent } from "../src/scrum/frontend-playbook.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
  seedDefaults(db);
});

/** Mirrors the load_phase_context implementation-phase guard. */
function playbookForSprintTickets(tickets: { assigned_to: string | null }[]): string | null {
  return tickets.some((t) => t.assigned_to === "fe-engineer") ? buildFrontendPlaybook(db) : null;
}

describe("frontend skill serving", () => {
  it("get_skill logic returns a seeded frontend skill body", () => {
    const body = getSkillContent(db, "fe:_house-style");
    expect(body).toContain("Frontend House Style");
  });

  it("playbook is injected only when a sprint has fe-engineer work", () => {
    expect(playbookForSprintTickets([{ assigned_to: "be-engineer" }])).toBeNull();
    expect(playbookForSprintTickets([{ assigned_to: "fe-engineer" }])).toContain("## Frontend Playbook");
  });
});
