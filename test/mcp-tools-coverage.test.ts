/**
 * MCP Tools Coverage Tests (Sprint 75 — T-3758)
 *
 * Tests critical tool handler logic by exercising the same DB operations
 * that create_ticket, update_ticket, create_discovery, update_discovery,
 * and advance_sprint perform internally. Also tests the exported
 * checkSprintGates function and dashboard API query patterns.
 */
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { checkSprintGates } from "../src/scrum/tools.js";

let db: Database.Database;

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
  runMigrations(db);
});

// ── Helpers ────────────────────────────────────────────────────────────────

function createSprint(name: string, status: string, opts?: { velocity_committed?: number; milestone_id?: number }): number {
  const result = db.prepare(
    "INSERT INTO sprints (name, goal, status, velocity_committed, milestone_id) VALUES (?, ?, ?, ?, ?)"
  ).run(name, "Test goal", status, opts?.velocity_committed ?? null, opts?.milestone_id ?? null);
  return Number(result.lastInsertRowid);
}

function createMilestone(name: string, status = "planned"): number {
  const result = db.prepare(
    "INSERT INTO milestones (name, description, status) VALUES (?, ?, ?)"
  ).run(name, `${name} description`, status);
  return Number(result.lastInsertRowid);
}

function createEpic(name: string, milestoneId?: number): number {
  const result = db.prepare(
    "INSERT INTO epics (name, description, milestone_id) VALUES (?, ?, ?)"
  ).run(name, `${name} description`, milestoneId ?? null);
  return Number(result.lastInsertRowid);
}

function createTicket(sprintId: number, ref: string, title: string, opts?: {
  assigned_to?: string; story_points?: number; milestone_id?: number; epic_id?: number;
  priority?: string; description?: string;
}): number {
  const result = db.prepare(
    `INSERT INTO tickets (sprint_id, ticket_ref, title, description, priority, assigned_to, story_points, milestone_id, epic_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sprintId, ref, title,
    opts?.description ?? null,
    opts?.priority ?? "P1",
    opts?.assigned_to ?? null,
    opts?.story_points ?? null,
    opts?.milestone_id ?? null,
    opts?.epic_id ?? null,
  );
  return Number(result.lastInsertRowid);
}

function createDiscovery(sprintId: number, finding: string, opts?: {
  category?: string; priority?: string; created_by?: string;
}): number {
  const cat = opts?.category ?? "general";
  const pri = opts?.priority ?? "P1";
  const result = db.prepare(
    "INSERT INTO discoveries (discovery_sprint_id, finding, category, status, priority, created_by) VALUES (?, ?, ?, 'discovered', ?, ?)"
  ).run(sprintId, finding, cat, pri, opts?.created_by ?? null);
  return Number(result.lastInsertRowid);
}

function getTicket(id: number) {
  return db.prepare("SELECT * FROM tickets WHERE id = ?").get(id) as any;
}

function getDiscovery(id: number) {
  return db.prepare("SELECT * FROM discoveries WHERE id = ?").get(id) as any;
}

function getSprint(id: number) {
  return db.prepare("SELECT * FROM sprints WHERE id = ?").get(id) as any;
}

// ═══════════════════════════════════════════════════════════════════════════
// Priority 1: MCP Tool Tests
// ═══════════════════════════════════════════════════════════════════════════

// ── create_ticket ──────────────────────────────────────────────────────────

describe("create_ticket logic", () => {
  it("creates a ticket with milestone_id", () => {
    const milestoneId = createMilestone("M1: Foundation");
    const sprintId = createSprint("sprint-1", "planning");
    const ticketId = createTicket(sprintId, "T-001", "Build auth", {
      assigned_to: "backend-dev",
      story_points: 5,
      milestone_id: milestoneId,
    });

    const ticket = getTicket(ticketId);
    expect(ticket).toBeDefined();
    expect(ticket.milestone_id).toBe(milestoneId);
    expect(ticket.title).toBe("Build auth");
    expect(ticket.story_points).toBe(5);
    expect(ticket.assigned_to).toBe("backend-dev");
  });

  it("creates a ticket with epic_id", () => {
    const milestoneId = createMilestone("M2: Polish");
    const epicId = createEpic("Dashboard Epic", milestoneId);
    const sprintId = createSprint("sprint-2", "planning");
    const ticketId = createTicket(sprintId, "T-002", "Dashboard widget", {
      epic_id: epicId,
      story_points: 3,
    });

    const ticket = getTicket(ticketId);
    expect(ticket.epic_id).toBe(epicId);
  });

  it("creates a ticket with both milestone_id and epic_id", () => {
    const milestoneId = createMilestone("M3: Launch");
    const epicId = createEpic("API Epic", milestoneId);
    const sprintId = createSprint("sprint-3", "planning");
    const ticketId = createTicket(sprintId, "T-003", "API endpoints", {
      milestone_id: milestoneId,
      epic_id: epicId,
      assigned_to: "backend-dev",
      story_points: 8,
      priority: "P0",
      description: "Implement REST endpoints",
    });

    const ticket = getTicket(ticketId);
    expect(ticket.milestone_id).toBe(milestoneId);
    expect(ticket.epic_id).toBe(epicId);
    expect(ticket.priority).toBe("P0");
    expect(ticket.description).toBe("Implement REST endpoints");
  });

  it("creates a ticket without optional fields", () => {
    const sprintId = createSprint("sprint-4", "planning");
    const ticketId = createTicket(sprintId, "T-004", "Simple task");

    const ticket = getTicket(ticketId);
    expect(ticket.milestone_id).toBeNull();
    expect(ticket.epic_id).toBeNull();
    expect(ticket.assigned_to).toBeNull();
    expect(ticket.story_points).toBeNull();
    expect(ticket.status).toBe("TODO");
    expect(ticket.qa_verified).toBe(0);
  });

  it("enforces unique ticket_ref within a sprint", () => {
    const sprintId = createSprint("sprint-5", "planning");
    createTicket(sprintId, "T-DUP", "First ticket");
    expect(() => {
      createTicket(sprintId, "T-DUP", "Duplicate ref");
    }).toThrow();
  });

  it("sets FK constraint on milestone_id — rejects invalid milestone", () => {
    const sprintId = createSprint("sprint-fk", "planning");
    expect(() => {
      createTicket(sprintId, "T-FK", "Bad milestone", { milestone_id: 99999 });
    }).toThrow();
  });
});

// ── update_ticket ──────────────────────────────────────────────────────────

describe("update_ticket logic", () => {
  it("updates ticket status from TODO to IN_PROGRESS", () => {
    const sprintId = createSprint("sprint-u1", "implementation", { velocity_committed: 10 });
    const ticketId = createTicket(sprintId, "T-U01", "Work item", { assigned_to: "dev", story_points: 3 });

    db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run("IN_PROGRESS", ticketId);
    expect(getTicket(ticketId).status).toBe("IN_PROGRESS");
  });

  it("updates ticket status to DONE", () => {
    const sprintId = createSprint("sprint-u2", "implementation", { velocity_committed: 10 });
    const ticketId = createTicket(sprintId, "T-U02", "Work item", { assigned_to: "dev", story_points: 5 });

    db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run("DONE", ticketId);
    expect(getTicket(ticketId).status).toBe("DONE");
  });

  it("sets qa_verified flag", () => {
    const sprintId = createSprint("sprint-u3", "qa", { velocity_committed: 10 });
    const ticketId = createTicket(sprintId, "T-U03", "Verify me", { assigned_to: "dev", story_points: 3 });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(ticketId);

    db.prepare("UPDATE tickets SET qa_verified = 1, verified_by = ? WHERE id = ?").run("qa-engineer", ticketId);
    const ticket = getTicket(ticketId);
    expect(ticket.qa_verified).toBe(1);
    expect(ticket.verified_by).toBe("qa-engineer");
  });

  it("updates milestone_id on an existing ticket", () => {
    const milestoneId = createMilestone("Update Milestone");
    const sprintId = createSprint("sprint-u4", "planning");
    const ticketId = createTicket(sprintId, "T-U04", "Needs milestone");

    db.prepare("UPDATE tickets SET milestone_id = ? WHERE id = ?").run(milestoneId, ticketId);
    expect(getTicket(ticketId).milestone_id).toBe(milestoneId);
  });

  it("updates epic_id on an existing ticket", () => {
    const epicId = createEpic("New Epic");
    const sprintId = createSprint("sprint-u5", "planning");
    const ticketId = createTicket(sprintId, "T-U05", "Needs epic");

    db.prepare("UPDATE tickets SET epic_id = ? WHERE id = ?").run(epicId, ticketId);
    expect(getTicket(ticketId).epic_id).toBe(epicId);
  });

  it("auto-promotes linked discovery when ticket moves to DONE", () => {
    const sprintId = createSprint("sprint-u6", "implementation", { velocity_committed: 10 });
    const ticketId = createTicket(sprintId, "T-U06", "Implement finding", { assigned_to: "dev", story_points: 3 });
    const discoveryId = createDiscovery(sprintId, "Important finding");

    // Link discovery to ticket and set it to planned
    db.prepare("UPDATE discoveries SET implementation_ticket_id = ?, status = 'planned' WHERE id = ?").run(ticketId, discoveryId);

    // Simulate the auto-promote logic from update_ticket handler
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(ticketId);
    db.prepare(`
      UPDATE discoveries SET status = 'implemented', updated_at = datetime('now')
      WHERE status = 'planned' AND implementation_ticket_id = ?
    `).run(ticketId);

    const discovery = getDiscovery(discoveryId);
    expect(discovery.status).toBe("implemented");
  });

  it("records event_log entries on status change", () => {
    const sprintId = createSprint("sprint-u7", "implementation", { velocity_committed: 10 });
    const ticketId = createTicket(sprintId, "T-U07", "Track events", { assigned_to: "dev", story_points: 2 });

    const oldStatus = "TODO";
    const newStatus = "IN_PROGRESS";
    db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run(newStatus, ticketId);
    db.prepare(
      "INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('ticket', ?, 'status_changed', 'status', ?, ?, 'mcp')"
    ).run(ticketId, oldStatus, newStatus);

    const events = db.prepare("SELECT * FROM event_log WHERE entity_type = 'ticket' AND entity_id = ?").all(ticketId) as any[];
    expect(events).toHaveLength(1);
    expect(events[0].old_value).toBe("TODO");
    expect(events[0].new_value).toBe("IN_PROGRESS");
  });
});

// ── create_discovery ───────────────────────────────────────────────────────

describe("create_discovery logic", () => {
  it("creates a discovery with default category and priority", () => {
    const sprintId = createSprint("disc-sprint-1", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "Found a performance bottleneck");

    const discovery = getDiscovery(discoveryId);
    expect(discovery).toBeDefined();
    expect(discovery.finding).toBe("Found a performance bottleneck");
    expect(discovery.category).toBe("general");
    expect(discovery.priority).toBe("P1");
    expect(discovery.status).toBe("discovered");
    expect(discovery.discovery_sprint_id).toBe(sprintId);
  });

  it("creates a discovery with specific category and priority", () => {
    const sprintId = createSprint("disc-sprint-2", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "API response time > 2s", {
      category: "performance",
      priority: "P0",
      created_by: "backend-dev",
    });

    const discovery = getDiscovery(discoveryId);
    expect(discovery.category).toBe("performance");
    expect(discovery.priority).toBe("P0");
    expect(discovery.created_by).toBe("backend-dev");
  });

  it("creates discoveries in all valid categories", () => {
    const sprintId = createSprint("disc-sprint-3", "implementation", { velocity_committed: 10 });
    const categories = ["architecture", "ux", "performance", "testing", "integration", "general"];

    for (const cat of categories) {
      const id = createDiscovery(sprintId, `Finding in ${cat}`, { category: cat });
      expect(getDiscovery(id).category).toBe(cat);
    }

    const allDiscoveries = db.prepare("SELECT * FROM discoveries WHERE discovery_sprint_id = ?").all(sprintId);
    expect(allDiscoveries).toHaveLength(6);
  });

  it("rejects invalid discovery category", () => {
    const sprintId = createSprint("disc-sprint-4", "implementation", { velocity_committed: 10 });
    expect(() => {
      db.prepare(
        "INSERT INTO discoveries (discovery_sprint_id, finding, category, status, priority) VALUES (?, ?, ?, 'discovered', 'P1')"
      ).run(sprintId, "Bad category", "invalid_category");
    }).toThrow();
  });

  it("logs event_log entry on creation", () => {
    const sprintId = createSprint("disc-sprint-5", "implementation", { velocity_committed: 10 });
    const result = db.prepare(
      "INSERT INTO discoveries (discovery_sprint_id, finding, category, status, priority, created_by) VALUES (?, ?, 'general', 'discovered', 'P1', ?)"
    ).run(sprintId, "Test finding", "qa-engineer");
    const discoveryId = Number(result.lastInsertRowid);

    db.prepare(
      "INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('discovery', ?, 'created', 'status', NULL, 'discovered', ?)"
    ).run(discoveryId, "qa-engineer");

    const events = db.prepare("SELECT * FROM event_log WHERE entity_type = 'discovery' AND entity_id = ?").all(discoveryId) as any[];
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("created");
    expect(events[0].new_value).toBe("discovered");
  });
});

// ── update_discovery ───────────────────────────────────────────────────────

describe("update_discovery logic", () => {
  it("updates discovery status from discovered to planned", () => {
    const sprintId = createSprint("upd-disc-1", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "Needs planning");

    db.prepare("UPDATE discoveries SET status = ?, updated_at = datetime('now') WHERE id = ?").run("planned", discoveryId);
    expect(getDiscovery(discoveryId).status).toBe("planned");
  });

  it("updates discovery priority", () => {
    const sprintId = createSprint("upd-disc-2", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "Reprioritize", { priority: "P2" });

    db.prepare("UPDATE discoveries SET priority = ?, updated_at = datetime('now') WHERE id = ?").run("P0", discoveryId);
    expect(getDiscovery(discoveryId).priority).toBe("P0");
  });

  it("sets drop_reason when dropping a discovery", () => {
    const sprintId = createSprint("upd-disc-3", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "Won't fix");

    db.prepare("UPDATE discoveries SET status = 'dropped', drop_reason = ?, updated_at = datetime('now') WHERE id = ?")
      .run("Out of scope for current milestone", discoveryId);

    const discovery = getDiscovery(discoveryId);
    expect(discovery.status).toBe("dropped");
    expect(discovery.drop_reason).toBe("Out of scope for current milestone");
  });

  it("logs event on status change", () => {
    const sprintId = createSprint("upd-disc-4", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "Status change");

    const oldStatus = "discovered";
    const newStatus = "planned";
    db.prepare("UPDATE discoveries SET status = ? WHERE id = ?").run(newStatus, discoveryId);
    db.prepare(
      "INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('discovery', ?, 'status_changed', 'status', ?, ?, 'mcp')"
    ).run(discoveryId, oldStatus, newStatus);

    const events = db.prepare("SELECT * FROM event_log WHERE entity_type = 'discovery' AND entity_id = ?").all(discoveryId) as any[];
    expect(events).toHaveLength(1);
    expect(events[0].old_value).toBe("discovered");
    expect(events[0].new_value).toBe("planned");
  });

  it("links discovery to ticket and auto-sets status to planned", () => {
    const sprintId = createSprint("upd-disc-5", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "Link me");
    const ticketId = createTicket(sprintId, "T-LINK", "Implementation ticket", { assigned_to: "dev", story_points: 3 });

    // Simulate link_discovery_to_ticket logic
    const ticket = db.prepare("SELECT id, title, status FROM tickets WHERE id = ?").get(ticketId) as any;
    const newStatus = ticket.status === "DONE" ? "implemented" : "planned";
    db.prepare("UPDATE discoveries SET implementation_ticket_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(ticketId, newStatus, discoveryId);

    const discovery = getDiscovery(discoveryId);
    expect(discovery.implementation_ticket_id).toBe(ticketId);
    expect(discovery.status).toBe("planned");
  });

  it("links discovery to DONE ticket and auto-sets status to implemented", () => {
    const sprintId = createSprint("upd-disc-6", "implementation", { velocity_committed: 10 });
    const discoveryId = createDiscovery(sprintId, "Already done");
    const ticketId = createTicket(sprintId, "T-DONE", "Done ticket", { assigned_to: "dev", story_points: 3 });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(ticketId);

    const ticket = db.prepare("SELECT id, title, status FROM tickets WHERE id = ?").get(ticketId) as any;
    const newStatus = ticket.status === "DONE" ? "implemented" : "planned";
    db.prepare("UPDATE discoveries SET implementation_ticket_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(ticketId, newStatus, discoveryId);

    expect(getDiscovery(discoveryId).status).toBe("implemented");
  });
});

// ── advance_sprint / checkSprintGates ──────────────────────────────────────

describe("advance_sprint — checkSprintGates", () => {
  it("passes implementation gate with fully assigned+estimated tickets and velocity", () => {
    const sprintId = createSprint("gate-1", "planning", { velocity_committed: 10 });
    createTicket(sprintId, "T-G01", "Task 1", { assigned_to: "dev", story_points: 5 });
    createTicket(sprintId, "T-G02", "Task 2", { assigned_to: "dev", story_points: 5 });

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "implementation");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings).toEqual([]);
  });

  it("warns implementation with no tickets", () => {
    const sprintId = createSprint("gate-2", "planning", { velocity_committed: 10 });
    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "implementation");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("No tickets assigned"))).toBe(true);
  });

  it("does NOT warn for unassigned tickets (assignment is optional)", () => {
    const sprintId = createSprint("gate-3", "planning", { velocity_committed: 10 });
    createTicket(sprintId, "T-G03", "Unassigned", { story_points: 3 });

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "implementation");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("unassigned"))).toBe(false);
  });

  it("warns implementation with missing story points", () => {
    const sprintId = createSprint("gate-4", "planning", { velocity_committed: 10 });
    createTicket(sprintId, "T-G04", "No points", { assigned_to: "dev" });

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "implementation");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("missing story points"))).toBe(true);
  });

  it("warns implementation without velocity_committed", () => {
    const sprintId = createSprint("gate-5", "planning");
    createTicket(sprintId, "T-G05", "Task", { assigned_to: "dev", story_points: 3 });

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "implementation");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("velocity_committed not set"))).toBe(true);
  });

  it("passes qa gate when all tickets are DONE/BLOCKED/NOT_DONE", () => {
    const sprintId = createSprint("gate-6", "implementation", { velocity_committed: 10 });
    const t1 = createTicket(sprintId, "T-G06", "Done", { assigned_to: "dev", story_points: 5 });
    const t2 = createTicket(sprintId, "T-G07", "Blocked", { assigned_to: "dev", story_points: 3 });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(t1);
    db.prepare("UPDATE tickets SET status = 'BLOCKED' WHERE id = ?").run(t2);

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "qa");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings).toEqual([]);
  });

  it("warns qa with IN_PROGRESS tickets", () => {
    const sprintId = createSprint("gate-7", "implementation", { velocity_committed: 10 });
    const t1 = createTicket(sprintId, "T-G08", "WIP", { assigned_to: "dev", story_points: 5 });
    db.prepare("UPDATE tickets SET status = 'IN_PROGRESS' WHERE id = ?").run(t1);

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "qa");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("still in progress"))).toBe(true);
  });

  it("warns qa with open blockers", () => {
    const sprintId = createSprint("gate-8", "implementation", { velocity_committed: 10 });
    const t1 = createTicket(sprintId, "T-G09", "Done task", { assigned_to: "dev", story_points: 5 });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(t1);
    db.prepare("INSERT INTO blockers (sprint_id, description, status) VALUES (?, ?, 'open')").run(sprintId, "Blocking issue");

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "qa");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("open blocker"))).toBe(true);
  });

  it("warns review/closed with unverified DONE tickets", () => {
    const sprintId = createSprint("gate-9", "review", { velocity_committed: 10 });
    const t1 = createTicket(sprintId, "T-G10", "Unverified", { assigned_to: "dev", story_points: 5 });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(t1);

    const sprint = getSprint(sprintId);
    const gatesReview = checkSprintGates(db, sprint, "review");
    expect(gatesReview.canProceed).toBe(true);
    expect(gatesReview.warnings.some(g => g.includes("QA verification"))).toBe(true);

    const gatesClosed = checkSprintGates(db, sprint, "closed");
    expect(gatesClosed.canProceed).toBe(true);
    expect(gatesClosed.warnings.some(g => g.includes("QA verification"))).toBe(true);
  });

  it("passes review gate with qa_verified tickets", () => {
    const sprintId = createSprint("gate-10", "review", { velocity_committed: 10 });
    const t1 = createTicket(sprintId, "T-G11", "Verified", { assigned_to: "dev", story_points: 5 });
    db.prepare("UPDATE tickets SET status = 'DONE', qa_verified = 1 WHERE id = ?").run(t1);

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "review");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings).toEqual([]);
  });

  it("warns retro with IN_PROGRESS tickets", () => {
    const sprintId = createSprint("gate-11", "qa", { velocity_committed: 10 });
    const t1 = createTicket(sprintId, "T-G12", "Still WIP", { assigned_to: "dev", story_points: 5 });
    db.prepare("UPDATE tickets SET status = 'IN_PROGRESS' WHERE id = ?").run(t1);

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "retro");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("IN_PROGRESS"))).toBe(true);
  });

  it("warns rest without retro findings", () => {
    const sprintId = createSprint("gate-12", "closed", { velocity_committed: 10 });

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "rest");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings.some(g => g.includes("retro"))).toBe(true);
  });

  it("passes rest gate with retro findings", () => {
    const sprintId = createSprint("gate-13", "closed", { velocity_committed: 10 });
    db.prepare("INSERT INTO retro_findings (sprint_id, category, finding, role) VALUES (?, 'went_well', 'Good sprint', 'team')")
      .run(sprintId);

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "rest");
    expect(gates.canProceed).toBe(true);
    expect(gates.warnings).toEqual([]);
  });

  it("excludes soft-deleted tickets from gate checks", () => {
    const sprintId = createSprint("gate-14", "planning", { velocity_committed: 10 });
    // Create an unassigned ticket but soft-delete it
    const t1 = createTicket(sprintId, "T-G14", "Deleted", { story_points: 3 });
    db.prepare("UPDATE tickets SET deleted_at = datetime('now') WHERE id = ?").run(t1);
    // Create a valid ticket
    createTicket(sprintId, "T-G15", "Valid", { assigned_to: "dev", story_points: 5 });

    const sprint = getSprint(sprintId);
    const gates = checkSprintGates(db, sprint, "implementation");
    expect(gates.canProceed).toBe(true);
    // Should not complain about unassigned — the unassigned one is deleted
    expect(gates.warnings.filter(g => g.includes("unassigned"))).toHaveLength(0);
  });
});

// ── advance_sprint — full transition ───────────────────────────────────────

describe("advance_sprint — phase transitions and discovery archival", () => {
  const LEGACY_PHASE_MAP: Record<string, string> = {
    preparation: "planning",
    kickoff: "planning",
    qa: "implementation",
    refactoring: "implementation",
    retro: "done",
    review: "done",
    closed: "done",
  };
  const TRANSITIONS: Record<string, string> = {
    planning: "implementation",
    implementation: "done",
    done: "rest",
    rest: "planning",
  };

  function advanceSprint(sprintId: number, velocityCompleted?: number): string[] {
    const sprint = getSprint(sprintId);
    const effectivePhase = LEGACY_PHASE_MAP[sprint.status] || sprint.status;
    const nextPhase = TRANSITIONS[effectivePhase];
    if (!nextPhase) throw new Error(`No transition from ${sprint.status}`);

    const gates = checkSprintGates(db, sprint, nextPhase);
    // Gates are advisory — always proceed

    const tickets = db.prepare("SELECT * FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL").all(sprintId) as any[];

    if ((nextPhase === "done" || nextPhase === "closed") && !velocityCompleted && !sprint.velocity_completed) {
      velocityCompleted = tickets.filter((t: any) => t.status === "DONE").reduce((s: number, t: any) => s + (t.story_points || 0), 0);
    }

    const sets = ["status=?", "updated_at=datetime('now')"];
    const vals: any[] = [nextPhase];
    if (velocityCompleted !== undefined) { sets.push("velocity_completed=?"); vals.push(velocityCompleted); }
    vals.push(sprintId);
    db.prepare(`UPDATE sprints SET ${sets.join(",")} WHERE id=?`).run(...vals);

    // Auto retro analysis when done
    if (nextPhase === "done" || nextPhase === "closed") {
      const totalTickets = tickets.length;
      const doneTickets = tickets.filter((t: any) => t.status === "DONE").length;
      const completionRate = totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0;
      const pts = velocityCompleted || sprint.velocity_completed || 0;
      const summary = `Auto-analysis: ${doneTickets}/${totalTickets} tickets done (${completionRate}% completion rate). Velocity: ${pts}pt completed of ${sprint.velocity_committed || 0}pt committed.`;
      db.prepare("INSERT INTO retro_findings (sprint_id, category, finding, role) VALUES (?, 'auto_analysis', ?, 'system')").run(sprintId, summary);
    }

    return gates.warnings;
  }

  it("advances through planning -> implementation -> done -> rest", () => {
    const sprintId = createSprint("trans-1", "planning", { velocity_committed: 10 });
    createTicket(sprintId, "T-T00", "Task", { assigned_to: "dev", story_points: 5 });

    advanceSprint(sprintId); // planning -> implementation
    expect(getSprint(sprintId).status).toBe("implementation");

    db.prepare("UPDATE tickets SET status = 'DONE' WHERE sprint_id = ?").run(sprintId);
    advanceSprint(sprintId); // implementation -> done
    expect(getSprint(sprintId).status).toBe("done");

    advanceSprint(sprintId); // done -> rest
    expect(getSprint(sprintId).status).toBe("rest");
  });

  it("generates auto retro analysis when reaching done", () => {
    const sprintId = createSprint("trans-2", "planning", { velocity_committed: 10 });
    const t1 = createTicket(sprintId, "T-T01", "Done task", { assigned_to: "dev", story_points: 5 });
    const t2 = createTicket(sprintId, "T-T02", "Also done", { assigned_to: "dev", story_points: 5 });

    advanceSprint(sprintId); // planning -> implementation
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id IN (?, ?)").run(t1, t2);
    advanceSprint(sprintId); // implementation -> done

    const retro = db.prepare("SELECT * FROM retro_findings WHERE sprint_id = ? AND category = 'auto_analysis'").get(sprintId) as any;
    expect(retro).toBeDefined();
    expect(retro.finding).toContain("2/2 tickets done");
    expect(retro.finding).toContain("100% completion rate");
    expect(retro.finding).toContain("10pt completed");
  });

  it("auto-calculates velocity_completed from DONE tickets", () => {
    const sprintId = createSprint("trans-3", "planning", { velocity_committed: 15 });
    const t1 = createTicket(sprintId, "T-T03", "5pts", { assigned_to: "dev", story_points: 5 });
    const t2 = createTicket(sprintId, "T-T04", "8pts", { assigned_to: "dev", story_points: 8 });
    const t3 = createTicket(sprintId, "T-T05", "Not done", { assigned_to: "dev", story_points: 2 });

    advanceSprint(sprintId); // -> implementation
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id IN (?, ?)").run(t1, t2);
    db.prepare("UPDATE tickets SET status = 'NOT_DONE' WHERE id = ?").run(t3);
    advanceSprint(sprintId); // -> done

    const sprint = getSprint(sprintId);
    expect(sprint.velocity_completed).toBe(13); // 5 + 8
    expect(sprint.status).toBe("done");
  });

  it("handles legacy refactoring phase via mapping to implementation -> done", () => {
    // Directly set to refactoring (legacy path — maps to implementation)
    const sprintId = createSprint("trans-4", "refactoring", { velocity_committed: 10 });

    advanceSprint(sprintId);
    expect(getSprint(sprintId).status).toBe("done");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Priority 2: Dashboard API Query Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Dashboard API — discovery queries", () => {
  it("returns discoveries with sprint_name and ticket_title", () => {
    const sprintId = createSprint("api-disc-1", "implementation", { velocity_committed: 10 });
    const ticketId = createTicket(sprintId, "T-API-D1", "Implementation", { assigned_to: "dev", story_points: 3 });
    const discoveryId = createDiscovery(sprintId, "API finding", { category: "architecture", priority: "P0" });
    db.prepare("UPDATE discoveries SET implementation_ticket_id = ?, status = 'planned' WHERE id = ?").run(ticketId, discoveryId);

    // Same query as apiDiscoveries()
    const rows = db.prepare(`
      SELECT d.*, s.name as sprint_name, t.title as ticket_title, t.status as ticket_status
      FROM discoveries d
      JOIN sprints s ON d.discovery_sprint_id = s.id
      LEFT JOIN tickets t ON d.implementation_ticket_id = t.id
      WHERE 1=1
      ORDER BY s.created_at DESC, d.priority, d.created_at
    `).all() as any[];

    expect(rows).toHaveLength(1);
    expect(rows[0].sprint_name).toBe("api-disc-1");
    expect(rows[0].ticket_title).toBe("Implementation");
    expect(rows[0].category).toBe("architecture");
    expect(rows[0].priority).toBe("P0");
    expect(rows[0].status).toBe("planned");
  });

  it("filters discoveries by status", () => {
    const sprintId = createSprint("api-disc-2", "implementation", { velocity_committed: 10 });
    createDiscovery(sprintId, "Discovered one");
    const d2 = createDiscovery(sprintId, "Planned one");
    db.prepare("UPDATE discoveries SET status = 'planned' WHERE id = ?").run(d2);

    const discovered = db.prepare(
      "SELECT * FROM discoveries WHERE discovery_sprint_id = ? AND status = ?",
    ).all(sprintId, "discovered") as any[];
    expect(discovered).toHaveLength(1);
    expect(discovered[0].finding).toBe("Discovered one");

    const planned = db.prepare(
      "SELECT * FROM discoveries WHERE discovery_sprint_id = ? AND status = ?",
    ).all(sprintId, "planned") as any[];
    expect(planned).toHaveLength(1);
    expect(planned[0].finding).toBe("Planned one");
  });

  it("filters discoveries with exclude_status", () => {
    const sprintId = createSprint("api-disc-3", "implementation", { velocity_committed: 10 });
    createDiscovery(sprintId, "Active");
    const d2 = createDiscovery(sprintId, "Implemented");
    db.prepare("UPDATE discoveries SET status = 'implemented' WHERE id = ?").run(d2);
    const d3 = createDiscovery(sprintId, "Dropped");
    db.prepare("UPDATE discoveries SET status = 'dropped' WHERE id = ?").run(d3);

    // Exclude implemented and dropped (same logic as dashboard)
    const excluded = ["implemented", "dropped"];
    const sql = `SELECT * FROM discoveries WHERE discovery_sprint_id = ? AND status NOT IN (${excluded.map(() => "?").join(",")})`;
    const rows = db.prepare(sql).all(sprintId, ...excluded) as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].finding).toBe("Active");
  });

  it("returns discovery coverage counts", () => {
    const sprintId = createSprint("api-disc-4", "implementation", { velocity_committed: 10 });
    createDiscovery(sprintId, "D1");
    createDiscovery(sprintId, "D2");
    const d3 = createDiscovery(sprintId, "D3");
    db.prepare("UPDATE discoveries SET status = 'planned' WHERE id = ?").run(d3);
    const d4 = createDiscovery(sprintId, "D4");
    db.prepare("UPDATE discoveries SET status = 'implemented' WHERE id = ?").run(d4);

    // Same query as apiDiscoveryCoverage()
    const rows = db.prepare(
      "SELECT status, COUNT(*) as count FROM discoveries WHERE discovery_sprint_id = ? GROUP BY status"
    ).all(sprintId) as any[];
    const counts: Record<string, number> = { discovered: 0, planned: 0, implemented: 0, dropped: 0 };
    rows.forEach((r: any) => { counts[r.status] = r.count; });
    const total = rows.reduce((sum: number, r: any) => sum + r.count, 0);

    expect(total).toBe(4);
    expect(counts.discovered).toBe(2);
    expect(counts.planned).toBe(1);
    expect(counts.implemented).toBe(1);
    expect(counts.dropped).toBe(0);
  });

  it("returns discovery sprint list", () => {
    const s1 = createSprint("api-disc-5a", "implementation", { velocity_committed: 10 });
    const s2 = createSprint("api-disc-5b", "closed", { velocity_committed: 5 });
    createDiscovery(s1, "Finding A");
    createDiscovery(s2, "Finding B");

    const sprintList = db.prepare(`
      SELECT DISTINCT s.id, s.name FROM sprints s
      JOIN discoveries d ON d.discovery_sprint_id = s.id
      ORDER BY s.created_at DESC
    `).all() as any[];

    expect(sprintList).toHaveLength(2);
    const names = sprintList.map((s: any) => s.name);
    expect(names).toContain("api-disc-5a");
    expect(names).toContain("api-disc-5b");
  });
});

describe("Dashboard API — ticket queries with milestone/epic data", () => {
  it("returns tickets with milestone and epic joins", () => {
    const milestoneId = createMilestone("M-API-1", "active");
    const epicId = createEpic("E-API-1", milestoneId);
    const sprintId = createSprint("api-ticket-1", "implementation", { velocity_committed: 10 });
    const ticketId = createTicket(sprintId, "T-API-1", "Full ticket", {
      assigned_to: "backend-dev",
      story_points: 5,
      milestone_id: milestoneId,
      epic_id: epicId,
    });

    // Query matching dashboard pattern
    const ticket = db.prepare(`
      SELECT t.*, m.name as milestone_name, m.status as milestone_status,
             e.name as epic_name, e.color as epic_color,
             s.name as sprint_name, s.status as sprint_status
      FROM tickets t
      LEFT JOIN milestones m ON t.milestone_id = m.id
      LEFT JOIN epics e ON t.epic_id = e.id
      LEFT JOIN sprints s ON t.sprint_id = s.id
      WHERE t.id = ?
    `).get(ticketId) as any;

    expect(ticket.milestone_name).toBe("M-API-1");
    expect(ticket.milestone_status).toBe("active");
    expect(ticket.epic_name).toBe("E-API-1");
    expect(ticket.epic_color).toBe("#3b82f6"); // default
    expect(ticket.sprint_name).toBe("api-ticket-1");
    expect(ticket.sprint_status).toBe("implementation");
  });

  it("returns null for tickets without milestone/epic", () => {
    const sprintId = createSprint("api-ticket-2", "planning");
    const ticketId = createTicket(sprintId, "T-API-2", "Plain ticket");

    const ticket = db.prepare(`
      SELECT t.*, m.name as milestone_name, e.name as epic_name
      FROM tickets t
      LEFT JOIN milestones m ON t.milestone_id = m.id
      LEFT JOIN epics e ON t.epic_id = e.id
      WHERE t.id = ?
    `).get(ticketId) as any;

    expect(ticket.milestone_name).toBeNull();
    expect(ticket.epic_name).toBeNull();
  });

  it("counts tickets per epic for roadmap view", () => {
    const milestoneId = createMilestone("M-Roadmap");
    const epicId = createEpic("E-Roadmap", milestoneId);
    const sprintId = createSprint("api-ticket-3", "implementation", { velocity_committed: 10 });
    createTicket(sprintId, "T-API-3A", "Task A", { epic_id: epicId, assigned_to: "dev", story_points: 3 });
    createTicket(sprintId, "T-API-3B", "Task B", { epic_id: epicId, assigned_to: "dev", story_points: 5 });
    const t3 = createTicket(sprintId, "T-API-3C", "Done task", { epic_id: epicId, assigned_to: "dev", story_points: 2 });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE id = ?").run(t3);

    // Same query pattern as list_epics
    const epic = db.prepare(`
      SELECT e.*, COUNT(t.id) as ticket_count,
        SUM(CASE WHEN t.status='DONE' THEN 1 ELSE 0 END) as done_count
      FROM epics e
      LEFT JOIN tickets t ON t.epic_id = e.id
      WHERE e.id = ?
      GROUP BY e.id
    `).get(epicId) as any;

    expect(epic.ticket_count).toBe(3);
    expect(epic.done_count).toBe(1);
  });

  it("groups sprints by milestone for roadmap view", () => {
    const m1 = createMilestone("M-Group-1", "active");
    const m2 = createMilestone("M-Group-2", "planned");
    createSprint("sprint-mg1", "implementation", { velocity_committed: 10, milestone_id: m1 });
    createSprint("sprint-mg2", "planning", { velocity_committed: 8, milestone_id: m1 });
    createSprint("sprint-mg3", "planning", { velocity_committed: 5, milestone_id: m2 });

    const milestones = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM sprints WHERE milestone_id = m.id) as sprint_count
      FROM milestones m WHERE m.deleted_at IS NULL
      ORDER BY m.created_at
    `).all() as any[];

    expect(milestones).toHaveLength(2);
    expect(milestones[0].name).toBe("M-Group-1");
    expect(milestones[0].sprint_count).toBe(2);
    expect(milestones[1].name).toBe("M-Group-2");
    expect(milestones[1].sprint_count).toBe(1);
  });
});

// ── get_sprint_summary query pattern ─────────────────────────────────────────

describe("get_sprint_summary query", () => {
  it("returns one-line summary per sprint with velocity and ticket progress", () => {
    const s1 = createSprint("Sprint 1", "rest", { velocity_committed: 20 });
    db.prepare("UPDATE sprints SET velocity_completed = 18 WHERE id = ?").run(s1);
    createTicket(s1, "T-1", "Task A", { story_points: 5 });
    createTicket(s1, "T-2", "Task B", { story_points: 3 });
    db.prepare("UPDATE tickets SET status = 'DONE' WHERE ticket_ref = 'T-1'").run();

    const s2 = createSprint("Sprint 2", "implementation", { velocity_committed: 15 });
    db.prepare("UPDATE sprints SET velocity_completed = 8 WHERE id = ?").run(s2);
    createTicket(s2, "T-3", "Task C", { story_points: 5 });

    const sprints = db.prepare(`
      SELECT s.name, s.status, s.velocity_committed, s.velocity_completed,
             COUNT(t.id) as tickets, SUM(CASE WHEN t.status='DONE' THEN 1 ELSE 0 END) as done
      FROM sprints s LEFT JOIN tickets t ON t.sprint_id = s.id
      GROUP BY s.id ORDER BY s.created_at DESC LIMIT 5
    `).all() as any[];

    expect(sprints).toHaveLength(2);
    // In-memory DB: both created at same instant, find by name
    const sumSprint2 = sprints.find((s: any) => s.name === "Sprint 2");
    const sumSprint1 = sprints.find((s: any) => s.name === "Sprint 1");
    expect(sumSprint2).toBeDefined();
    expect(sumSprint2.velocity_completed).toBe(8);
    expect(sumSprint2.tickets).toBe(1);
    expect(sumSprint2.done).toBe(0);
    expect(sumSprint1).toBeDefined();
    expect(sumSprint1.velocity_completed).toBe(18);
    expect(sumSprint1.tickets).toBe(2);
    expect(sumSprint1.done).toBe(1);
  });

  it("handles empty sprint table", () => {
    const sprints = db.prepare(`
      SELECT s.name, s.status, s.velocity_committed, s.velocity_completed,
             COUNT(t.id) as tickets, SUM(CASE WHEN t.status='DONE' THEN 1 ELSE 0 END) as done
      FROM sprints s LEFT JOIN tickets t ON t.sprint_id = s.id
      GROUP BY s.id ORDER BY s.created_at DESC LIMIT 5
    `).all() as any[];

    expect(sprints).toHaveLength(0);
  });
});
