/**
 * Sprint Lifecycle Integration Test
 *
 * Exercises the complete sprint lifecycle through all phases:
 *   planning → implementation → qa → retro → review → closed → rest
 *
 * Also validates gate failures at key transitions.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";

let db: Database.Database;

// ── Use the real checkSprintGates from tools.ts (now exported) ──────────────
import { checkSprintGates } from "../src/scrum/tools.js";

// ── Legacy phase mapping ──────────────────────────────────────────────────────
const LEGACY_PHASE_MAP: Record<string, string> = {
  preparation: "planning",
  kickoff: "planning",
  qa: "implementation",
  refactoring: "implementation",
  retro: "done",
  review: "done",
  closed: "done",
};

// ── Transition map (simplified 4-phase) ──────────────────────────────────────
const TRANSITIONS: Record<string, string> = {
  planning: "implementation",
  implementation: "done",
  done: "rest",
  rest: "planning",
};

/** Advance a sprint: check gates (advisory), update status. Returns warnings. */
function advanceSprint(sprintId: number, velocityCompleted?: number): string[] {
  const sprint = db.prepare("SELECT * FROM sprints WHERE id = ?").get(sprintId) as any;
  const effectivePhase = LEGACY_PHASE_MAP[sprint.status] || sprint.status;
  const nextPhase = TRANSITIONS[effectivePhase];
  if (!nextPhase) throw new Error(`No transition from ${sprint.status}`);

  const gates = checkSprintGates(db, sprint, nextPhase);
  // Gates are advisory — always proceed

  // Auto-calculate velocity_completed for done transition
  if ((nextPhase === "done" || nextPhase === "closed") && !velocityCompleted && !sprint.velocity_completed) {
    const tickets = db.prepare("SELECT * FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL").all(sprintId) as any[];
    velocityCompleted = tickets.filter((t: any) => t.status === "DONE").reduce((s: number, t: any) => s + (t.story_points || 0), 0);
  }

  const sets = ["status=?", "updated_at=datetime('now')"];
  const vals: any[] = [nextPhase];
  if (velocityCompleted !== undefined) {
    sets.push("velocity_completed=?");
    vals.push(velocityCompleted);
  }
  vals.push(sprintId);
  db.prepare(`UPDATE sprints SET ${sets.join(",")} WHERE id=?`).run(...vals);

  return gates.warnings;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function createSprint(name: string, status: string, velocityCommitted?: number): number {
  const result = db.prepare(
    "INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, ?, ?)"
  ).run(name, "Integration test goal", status, velocityCommitted ?? null);
  return Number(result.lastInsertRowid);
}

function createTicket(sprintId: number, ref: string, title: string, assignedTo: string, points: number): number {
  const result = db.prepare(
    "INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, assigned_to, story_points) VALUES (?, ?, ?, 'P1', 'TODO', ?, ?)"
  ).run(sprintId, ref, title, assignedTo, points);
  return Number(result.lastInsertRowid);
}

function updateTicketStatus(ticketId: number, status: string) {
  db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run(status, ticketId);
}

function setQaVerified(ticketId: number) {
  db.prepare("UPDATE tickets SET qa_verified = 1 WHERE id = ?").run(ticketId);
}

function getSprintStatus(sprintId: number): string {
  return (db.prepare("SELECT status FROM sprints WHERE id = ?").get(sprintId) as any).status;
}

// ── Test Suite ───────────────────────────────────────────────────────────────

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
  runMigrations(db);
  // event_log table used by advance_sprint (normally created by dashboard.ts)
  db.exec(`CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT, entity_id INTEGER, action TEXT,
    field_name TEXT, old_value TEXT, new_value TEXT,
    actor TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);
});

describe("Sprint Lifecycle — full happy path (simplified 4-phase)", () => {
  it("advances through all phases: planning -> implementation -> done -> rest", () => {
    // 1. Create sprint in planning phase
    const sprintId = createSprint("Lifecycle Sprint", "planning", 10);

    // 2. Create 2 tickets with assignments and story points
    const t1 = createTicket(sprintId, "T-LC-01", "Build API endpoint", "backend-dev", 5);
    const t2 = createTicket(sprintId, "T-LC-02", "Build UI component", "frontend-dev", 5);

    // 3. Advance: planning -> implementation (should pass with no warnings)
    let warnings = advanceSprint(sprintId);
    expect(warnings).toEqual([]);
    expect(getSprintStatus(sprintId)).toBe("implementation");

    // 4. Update both tickets to DONE
    updateTicketStatus(t1, "DONE");
    updateTicketStatus(t2, "DONE");

    // 5. Advance: implementation -> done (should pass -- all tickets DONE)
    warnings = advanceSprint(sprintId);
    expect(warnings).toEqual([]);
    expect(getSprintStatus(sprintId)).toBe("done");

    // Verify velocity_completed was auto-calculated
    const sprint = db.prepare("SELECT velocity_completed FROM sprints WHERE id = ?").get(sprintId) as any;
    expect(sprint.velocity_completed).toBe(10); // 5 + 5

    // 6. Advance: done -> rest (advisory warning about no retro findings)
    warnings = advanceSprint(sprintId);
    expect(warnings.some(w => w.includes("retro"))).toBe(true);
    expect(getSprintStatus(sprintId)).toBe("rest");
  });
});

describe("Sprint Lifecycle — advisory gate warnings", () => {
  it("warns planning -> implementation with no tickets but still advances", () => {
    const sprintId = createSprint("Empty Sprint", "planning", 10);

    const warnings = advanceSprint(sprintId);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(g => g.includes("No tickets assigned"))).toBe(true);
    // Sprint SHOULD have advanced (gates are advisory)
    expect(getSprintStatus(sprintId)).toBe("implementation");
  });

  it("warns planning -> implementation without velocity_committed", () => {
    const sprintId = createSprint("No Velocity Sprint", "planning");
    createTicket(sprintId, "T-NV-01", "Some work", "backend-dev", 3);

    const warnings = advanceSprint(sprintId);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(g => g.includes("velocity_committed not set"))).toBe(true);
    // Still advances
    expect(getSprintStatus(sprintId)).toBe("implementation");
  });

  it("warns planning -> implementation with unassigned tickets", () => {
    const sprintId = createSprint("Unassigned Sprint", "planning", 10);
    db.prepare(
      "INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points) VALUES (?, ?, ?, 'P1', 'TODO', ?)"
    ).run(sprintId, "T-UA-01", "Unassigned work", 3);

    const warnings = advanceSprint(sprintId);
    expect(warnings.some(g => g.includes("unassigned"))).toBe(true);
    // Still advances
    expect(getSprintStatus(sprintId)).toBe("implementation");
  });

  it("warns implementation -> done with IN_PROGRESS tickets", () => {
    const sprintId = createSprint("WIP Sprint", "implementation", 10);
    const t1 = createTicket(sprintId, "T-WIP-01", "In progress work", "backend-dev", 5);
    updateTicketStatus(t1, "IN_PROGRESS");

    const warnings = advanceSprint(sprintId);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(g => g.includes("still in progress"))).toBe(true);
    // Still advances (advisory)
    expect(getSprintStatus(sprintId)).toBe("done");
  });

  it("warns done -> rest without retro findings", () => {
    const sprintId = createSprint("No Retro Sprint", "done", 10);

    const warnings = advanceSprint(sprintId);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(g => g.includes("retro"))).toBe(true);
    // Still advances (advisory)
    expect(getSprintStatus(sprintId)).toBe("rest");
  });

  it("handles legacy qa phase by mapping to implementation -> done", () => {
    const sprintId = createSprint("Legacy QA Sprint", "qa", 10);
    const t1 = createTicket(sprintId, "T-QB-01", "Still coding", "backend-dev", 5);
    updateTicketStatus(t1, "IN_PROGRESS");

    // qa maps to implementation, so next phase is done
    const warnings = advanceSprint(sprintId);
    expect(getSprintStatus(sprintId)).toBe("done");
  });
});
