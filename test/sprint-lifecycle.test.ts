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

// ── Replicate checkSprintGates from tools.ts (not exported) ──────────────────
function checkSprintGates(db: Database.Database, sprint: any, nextPhase: string): string[] {
  const gates: string[] = [];
  const tickets = db.prepare("SELECT * FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL").all(sprint.id) as any[];

  if (nextPhase === "implementation") {
    if (tickets.length === 0) gates.push("No tickets assigned to this sprint. Use create_ticket to add tickets.");
    const unassigned = tickets.filter((t: any) => !t.assigned_to);
    if (unassigned.length > 0) gates.push(`${unassigned.length} ticket(s) unassigned: ${unassigned.map((t: any) => t.ticket_ref || `#${t.id}`).join(", ")}. Use update_ticket to assign them.`);
    const noPoints = tickets.filter((t: any) => t.story_points == null);
    if (noPoints.length > 0) gates.push(`${noPoints.length} ticket(s) missing story points: ${noPoints.map((t: any) => t.ticket_ref || `#${t.id}`).join(", ")}. Use update_ticket to estimate them.`);
    if (!sprint.velocity_committed || sprint.velocity_committed <= 0) gates.push("velocity_committed not set. Use update_sprint to set committed velocity.");
  }
  if (nextPhase === "qa") {
    const undone = tickets.filter((t: any) => !["DONE", "BLOCKED", "NOT_DONE"].includes(t.status));
    if (undone.length > 0) gates.push(`${undone.length} tickets still in progress: ${undone.map((t: any) => t.ticket_ref || `#${t.id}`).join(", ")}. Use update_ticket to mark them DONE/BLOCKED/NOT_DONE.`);
    const openBlockerCount = (db.prepare("SELECT COUNT(*) as c FROM blockers WHERE sprint_id = ? AND status = 'open'").get(sprint.id) as any).c;
    if (openBlockerCount > 0) gates.push(`${openBlockerCount} open blocker(s) — resolve before advancing to QA. Use resolve_blocker to close them.`);
  }
  if (nextPhase === "closed" || nextPhase === "review") {
    const doneNoQA = tickets.filter((t: any) => t.status === "DONE" && !t.qa_verified);
    if (doneNoQA.length > 0) {
      const ticketList = doneNoQA.map((t: any) => `${t.ticket_ref || "#" + t.id} ${t.title}`).join(", ");
      gates.push(`Tickets need QA verification: ${ticketList}. Use update_ticket to verify them (qa_verified=true).`);
    }
  }
  if (nextPhase === "retro") {
    const inProgress = tickets.filter((t: any) => t.status === "IN_PROGRESS");
    if (inProgress.length > 0) gates.push(`${inProgress.length} ticket(s) still IN_PROGRESS: ${inProgress.map((t: any) => t.ticket_ref || `#${t.id}`).join(", ")}. Complete or mark as NOT_DONE before retro.`);
  }
  if (nextPhase === "rest") {
    const retroCount = (db.prepare("SELECT COUNT(*) as c FROM retro_findings WHERE sprint_id = ?").get(sprint.id) as any).c;
    if (retroCount === 0) gates.push("No retro findings — use add_retro_finding before advancing to rest.");
  }

  return gates;
}

// ── Transition map (mirrors advance_sprint) ──────────────────────────────────
const TRANSITIONS: Record<string, string> = {
  preparation: "kickoff",
  kickoff: "planning",
  planning: "implementation",
  implementation: "qa",
  qa: "retro",
  refactoring: "retro",
  retro: "review",
  review: "closed",
  closed: "rest",
};

/** Advance a sprint: check gates, update status if passing. Returns gates array. */
function advanceSprint(sprintId: number, velocityCompleted?: number): string[] {
  const sprint = db.prepare("SELECT * FROM sprints WHERE id = ?").get(sprintId) as any;
  const nextPhase = TRANSITIONS[sprint.status];
  if (!nextPhase) throw new Error(`No transition from ${sprint.status}`);

  const gates = checkSprintGates(db, sprint, nextPhase);
  if (gates.length > 0) return gates;

  // Auto-calculate velocity_completed for closed transition
  if (nextPhase === "closed" && !velocityCompleted && !sprint.velocity_completed) {
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

  return [];
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

describe("Sprint Lifecycle — full happy path", () => {
  it("advances through all phases: planning -> implementation -> qa -> retro -> review -> closed -> rest", () => {
    // 1. Create sprint in planning phase
    const sprintId = createSprint("Lifecycle Sprint", "planning", 10);

    // 2. Create 2 tickets with assignments and story points
    const t1 = createTicket(sprintId, "T-LC-01", "Build API endpoint", "backend-dev", 5);
    const t2 = createTicket(sprintId, "T-LC-02", "Build UI component", "frontend-dev", 5);

    // 4. Advance: planning -> implementation (should pass)
    let gates = advanceSprint(sprintId);
    expect(gates).toEqual([]);
    expect(getSprintStatus(sprintId)).toBe("implementation");

    // 5. Update both tickets to DONE
    updateTicketStatus(t1, "DONE");
    updateTicketStatus(t2, "DONE");

    // 6. Advance: implementation -> qa (should pass -- all tickets DONE)
    gates = advanceSprint(sprintId);
    expect(gates).toEqual([]);
    expect(getSprintStatus(sprintId)).toBe("qa");

    // 7. Set qa_verified on both tickets
    setQaVerified(t1);
    setQaVerified(t2);

    // 8. Advance: qa -> retro (should pass -- no IN_PROGRESS tickets)
    gates = advanceSprint(sprintId);
    expect(gates).toEqual([]);
    expect(getSprintStatus(sprintId)).toBe("retro");

    // 9. Add a retro finding
    db.prepare(
      "INSERT INTO retro_findings (sprint_id, role, category, finding) VALUES (?, ?, ?, ?)"
    ).run(sprintId, "backend-dev", "went_well", "API endpoint delivered on time");

    // 10. Advance: retro -> review (should pass -- QA verified)
    gates = advanceSprint(sprintId);
    expect(gates).toEqual([]);
    expect(getSprintStatus(sprintId)).toBe("review");

    // 11. Advance: review -> closed (with auto-calculated velocity_completed)
    gates = advanceSprint(sprintId);
    expect(gates).toEqual([]);
    expect(getSprintStatus(sprintId)).toBe("closed");

    // Verify velocity_completed was auto-calculated
    const sprint = db.prepare("SELECT velocity_completed FROM sprints WHERE id = ?").get(sprintId) as any;
    expect(sprint.velocity_completed).toBe(10); // 5 + 5

    // 12. Advance: closed -> rest
    // The auto_analysis retro finding is NOT inserted here (that happens in the MCP tool layer),
    // but we already inserted a manual retro finding in step 9, so the gate passes.
    gates = advanceSprint(sprintId);
    expect(gates).toEqual([]);

    // 13. Verify final sprint status is 'rest'
    expect(getSprintStatus(sprintId)).toBe("rest");
  });
});

describe("Sprint Lifecycle — gate failures", () => {
  it("blocks planning -> implementation with no tickets", () => {
    const sprintId = createSprint("Empty Sprint", "planning", 10);

    const gates = advanceSprint(sprintId);
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.some(g => g.includes("No tickets assigned"))).toBe(true);
    // Sprint should NOT have advanced
    expect(getSprintStatus(sprintId)).toBe("planning");
  });

  it("blocks planning -> implementation without velocity_committed", () => {
    const sprintId = createSprint("No Velocity Sprint", "planning");
    createTicket(sprintId, "T-NV-01", "Some work", "backend-dev", 3);

    const gates = advanceSprint(sprintId);
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.some(g => g.includes("velocity_committed not set"))).toBe(true);
    expect(getSprintStatus(sprintId)).toBe("planning");
  });

  it("blocks planning -> implementation with unassigned tickets", () => {
    const sprintId = createSprint("Unassigned Sprint", "planning", 10);
    db.prepare(
      "INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points) VALUES (?, ?, ?, 'P1', 'TODO', ?)"
    ).run(sprintId, "T-UA-01", "Unassigned work", 3);

    const gates = advanceSprint(sprintId);
    expect(gates.some(g => g.includes("unassigned"))).toBe(true);
    expect(getSprintStatus(sprintId)).toBe("planning");
  });

  it("blocks implementation -> qa with IN_PROGRESS tickets", () => {
    const sprintId = createSprint("WIP Sprint", "implementation", 10);
    const t1 = createTicket(sprintId, "T-WIP-01", "In progress work", "backend-dev", 5);
    updateTicketStatus(t1, "IN_PROGRESS");

    const gates = advanceSprint(sprintId);
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.some(g => g.includes("still in progress"))).toBe(true);
    expect(getSprintStatus(sprintId)).toBe("implementation");
  });

  it("blocks qa -> retro with IN_PROGRESS tickets", () => {
    const sprintId = createSprint("QA Block Sprint", "qa", 10);
    const t1 = createTicket(sprintId, "T-QB-01", "Still coding", "backend-dev", 5);
    updateTicketStatus(t1, "IN_PROGRESS");

    const gates = advanceSprint(sprintId);
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.some(g => g.includes("IN_PROGRESS"))).toBe(true);
    expect(getSprintStatus(sprintId)).toBe("qa");
  });

  it("blocks review -> closed without QA verification", () => {
    const sprintId = createSprint("No QA Sprint", "review", 10);
    createTicket(sprintId, "T-NQ-01", "Unverified work", "backend-dev", 5);
    // Mark DONE but do NOT set qa_verified
    const tid = (db.prepare("SELECT id FROM tickets WHERE ticket_ref = 'T-NQ-01'").get() as any).id;
    updateTicketStatus(tid, "DONE");

    const gates = advanceSprint(sprintId);
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.some(g => g.includes("QA verification"))).toBe(true);
    expect(getSprintStatus(sprintId)).toBe("review");
  });

  it("blocks closed -> rest without retro findings", () => {
    const sprintId = createSprint("No Retro Sprint", "closed", 10);

    const gates = advanceSprint(sprintId);
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.some(g => g.includes("No retro findings"))).toBe(true);
    expect(getSprintStatus(sprintId)).toBe("closed");
  });
});
