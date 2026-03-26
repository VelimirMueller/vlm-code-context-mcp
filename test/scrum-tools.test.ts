import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema } from "../src/scrum/schema.js";
import Database from "better-sqlite3";

describe("Scrum Tool Integration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);

    // Seed test data
    db.prepare(`INSERT INTO agents (role, name, description, model) VALUES (?, ?, ?, ?)`).run("backend-dev", "Backend Developer", "Handles APIs", "claude-sonnet-4-5");
    db.prepare(`INSERT INTO agents (role, name, description, model) VALUES (?, ?, ?, ?)`).run("frontend-dev", "Frontend Developer", "Handles UI", "claude-sonnet-4-5");

    db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed, velocity_completed) VALUES (?, ?, ?, ?, ?)`).run("sprint-test-1", "Test goal", "closed", 20, 15);
    const sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("sprint-test-1") as any).id;

    db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, assigned_to, story_points, qa_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(sprintId, "T-100", "Test ticket A", "P0", "DONE", "backend-dev", 5, 1);
    db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, assigned_to, story_points, qa_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(sprintId, "T-101", "Test ticket B", "P1", "TODO", "frontend-dev", 3, 0);

    db.prepare(`INSERT INTO retro_findings (sprint_id, role, category, finding) VALUES (?, ?, ?, ?)`).run(sprintId, "backend-dev", "went_well", "Tests caught real bugs");
    db.prepare(`INSERT INTO retro_findings (sprint_id, role, category, finding) VALUES (?, ?, ?, ?)`).run(sprintId, "team", "try_next", "Cap at 8pts per dev");

    db.prepare(`INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?)`).run("MILESTONES", "# Milestones\n\n## M1: Foundation\nGoal: Make it solid.", "po");
  });

  it("lists agents", () => {
    const agents = db.prepare(`SELECT role, name, description FROM agents ORDER BY role`).all() as any[];
    expect(agents).toHaveLength(2);
    expect(agents[0].role).toBe("backend-dev");
    expect(agents[1].role).toBe("frontend-dev");
  });

  it("lists sprints with ticket counts", () => {
    const sprints = db.prepare(`
      SELECT s.*, COUNT(t.id) as ticket_count, SUM(CASE WHEN t.status='DONE' THEN 1 ELSE 0 END) as done_count
      FROM sprints s LEFT JOIN tickets t ON t.sprint_id = s.id GROUP BY s.id
    `).all() as any[];
    expect(sprints).toHaveLength(1);
    expect(sprints[0].ticket_count).toBe(2);
    expect(sprints[0].done_count).toBe(1);
    expect(sprints[0].velocity_committed).toBe(20);
  });

  it("gets sprint with full details", () => {
    const sprint = db.prepare(`SELECT * FROM sprints WHERE name = ?`).get("sprint-test-1") as any;
    expect(sprint).toBeDefined();
    const tickets = db.prepare(`SELECT * FROM tickets WHERE sprint_id = ?`).all(sprint.id);
    expect(tickets).toHaveLength(2);
    const retro = db.prepare(`SELECT * FROM retro_findings WHERE sprint_id = ?`).all(sprint.id);
    expect(retro).toHaveLength(2);
  });

  it("creates and retrieves ticket roundtrip", () => {
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("sprint-test-1") as any;
    db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, priority, status, story_points) VALUES (?, ?, ?, ?, ?, ?)`).run(sprint.id, "T-102", "New ticket", "P2", "TODO", 3);

    const ticket = db.prepare(`SELECT * FROM tickets WHERE ticket_ref = ?`).get("T-102") as any;
    expect(ticket).toBeDefined();
    expect(ticket.title).toBe("New ticket");
    expect(ticket.priority).toBe("P2");
    expect(ticket.story_points).toBe(3);
  });

  it("searches tickets by title", () => {
    const results = db.prepare(`SELECT * FROM tickets WHERE title LIKE ?`).all("%Test ticket%") as any[];
    expect(results).toHaveLength(2);
  });

  it("searches tickets by partial match", () => {
    const results = db.prepare(`SELECT * FROM tickets WHERE title LIKE ?`).all("%ticket A%") as any[];
    expect(results).toHaveLength(1);
    expect(results[0].ticket_ref).toBe("T-100");
  });

  it("retrieves skills content", () => {
    const skill = db.prepare(`SELECT * FROM skills WHERE name = ?`).get("MILESTONES") as any;
    expect(skill).toBeDefined();
    expect(skill.content).toContain("# Milestones");
    expect(skill.content).toContain("Foundation");
  });

  it("computes agent health from ticket assignments", () => {
    const agents = db.prepare(`
      SELECT a.role,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'DONE') as done_tickets,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status IN ('TODO','IN_PROGRESS')) as active_tickets,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'BLOCKED') as blocked_tickets
      FROM agents a ORDER BY a.role
    `).all() as any[];
    expect(agents).toHaveLength(2);
    const backend = agents.find((a: any) => a.role === "backend-dev");
    expect(backend.done_tickets).toBe(1);
    expect(backend.active_tickets).toBe(0);
    const frontend = agents.find((a: any) => a.role === "frontend-dev");
    expect(frontend.done_tickets).toBe(0);
    expect(frontend.active_tickets).toBe(1); // T-101 is TODO
  });
});

describe("Error Handling", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
  });

  it("rejects invalid ticket status", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("test-sprint", "active");
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("test-sprint") as any;
    expect(() => {
      db.prepare(`INSERT INTO tickets (sprint_id, title, status) VALUES (?, ?, ?)`).run(sprint.id, "Bad", "INVALID");
    }).toThrow();
  });

  it("rejects invalid priority", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("test-sprint", "active");
    const sprint = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("test-sprint") as any;
    expect(() => {
      db.prepare(`INSERT INTO tickets (sprint_id, title, priority) VALUES (?, ?, ?)`).run(sprint.id, "Bad", "P99");
    }).toThrow();
  });

  it("rejects invalid sprint status", () => {
    expect(() => {
      db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("bad", "INVALID");
    }).toThrow();
  });

  it("cascades sprint delete to tickets", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("del-sprint", "active");
    const s = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("del-sprint") as any;
    db.prepare(`INSERT INTO tickets (sprint_id, title) VALUES (?, ?)`).run(s.id, "Will be deleted");
    db.prepare(`DELETE FROM sprints WHERE id = ?`).run(s.id);
    const remaining = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ?`).get(s.id) as any;
    expect(remaining.c).toBe(0);
  });

  it("handles empty database queries gracefully", () => {
    const agents = db.prepare(`SELECT * FROM agents`).all();
    expect(agents).toHaveLength(0);
    const sprints = db.prepare(`SELECT * FROM sprints`).all();
    expect(sprints).toHaveLength(0);
    const tickets = db.prepare(`SELECT * FROM tickets WHERE title LIKE ?`).all("%search%");
    expect(tickets).toHaveLength(0);
  });

  it("rejects invalid bug severity", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("bug-sprint", "active");
    const s = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("bug-sprint") as any;
    expect(() => {
      db.prepare(`INSERT INTO bugs (sprint_id, severity, description) VALUES (?, ?, ?)`).run(s.id, "INVALID", "test");
    }).toThrow();
  });
});

describe("dump/restore tools", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
  });

  it("should dump and restore a sprint roundtrip", () => {
    // Create test data
    db.prepare("INSERT INTO sprints (name, status) VALUES (?, ?)").run("test-sprint", "active");
    db.prepare("INSERT INTO agents (role, name) VALUES (?, ?)").run("qa", "QA Agent");

    // Dump
    const allTables = ["agents", "sprints", "tickets"];
    const dump: Record<string, any[]> = {};
    for (const t of allTables) {
      try { dump[t] = db.prepare(`SELECT * FROM ${t}`).all(); } catch {}
    }

    // Verify dump has data
    expect(dump["sprints"]).toHaveLength(1);
    expect(dump["agents"]).toHaveLength(1);

    // Clear and restore
    db.prepare("DELETE FROM sprints").run();
    db.prepare("DELETE FROM agents").run();
    expect((db.prepare("SELECT COUNT(*) as c FROM sprints").get() as any).c).toBe(0);

    // Restore
    for (const table of ["agents", "sprints"]) {
      const rows = dump[table];
      if (!rows || rows.length === 0) continue;
      const cols = Object.keys(rows[0]);
      const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
      for (const row of rows) { stmt.run(...cols.map((c: string) => (row as any)[c] ?? null)); }
    }

    expect((db.prepare("SELECT COUNT(*) as c FROM sprints").get() as any).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c).toBe(1);
  });

  it("should restore with transaction rollback on error", () => {
    // Verify transaction safety: inserting into a non-existent table within a transaction
    db.prepare("INSERT INTO agents (role, name) VALUES (?, ?)").run("dev", "Developer");
    const before = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c;
    expect(before).toBe(1);

    // Attempt a bad restore — the agent data should remain untouched
    try {
      const transaction = db.transaction(() => {
        db.prepare("DELETE FROM agents").run();
        // This will throw because 'nonexistent_table' doesn't exist
        db.prepare("SELECT * FROM nonexistent_table").all();
      });
      transaction();
    } catch {
      // Expected
    }

    const after = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c;
    expect(after).toBe(1); // Transaction rolled back
  });
});

describe("milestone tools", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
  });

  it("creates a milestone and verifies it", () => {
    db.prepare(`INSERT INTO milestones (name, description, target_date, status) VALUES (?, ?, ?, ?)`).run("M1: Foundation", "Core infrastructure", "2026-04-15", "planned");
    const milestone = db.prepare(`SELECT * FROM milestones WHERE name = ?`).get("M1: Foundation") as any;
    expect(milestone).toBeDefined();
    expect(milestone.description).toBe("Core infrastructure");
    expect(milestone.status).toBe("planned");
    expect(milestone.progress).toBe(0);
    expect(milestone.target_date).toBe("2026-04-15");
  });

  it("updates milestone status and progress", () => {
    db.prepare(`INSERT INTO milestones (name, status) VALUES (?, ?)`).run("M2: Launch", "planned");
    const m = db.prepare(`SELECT id FROM milestones WHERE name = ?`).get("M2: Launch") as any;
    db.prepare(`UPDATE milestones SET status=?, progress=?, updated_at=datetime('now') WHERE id=?`).run("active", 50, m.id);
    const updated = db.prepare(`SELECT * FROM milestones WHERE id = ?`).get(m.id) as any;
    expect(updated.status).toBe("active");
    expect(updated.progress).toBe(50);
  });

  it("links a ticket to a milestone", () => {
    db.prepare(`INSERT INTO milestones (name) VALUES (?)`).run("M3: Polish");
    const m = db.prepare(`SELECT id FROM milestones WHERE name = ?`).get("M3: Polish") as any;
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("link-sprint", "active");
    const s = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("link-sprint") as any;
    db.prepare(`INSERT INTO tickets (sprint_id, title) VALUES (?, ?)`).run(s.id, "Linked ticket");
    const t = db.prepare(`SELECT id FROM tickets WHERE title = ?`).get("Linked ticket") as any;
    db.prepare(`UPDATE tickets SET milestone_id=? WHERE id=?`).run(m.id, t.id);
    const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(t.id) as any;
    expect(ticket.milestone_id).toBe(m.id);
  });

  it("gets backlog tickets query", () => {
    // Create a closed sprint with a TODO ticket (should be in backlog)
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("closed-sprint", "closed");
    const cs = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("closed-sprint") as any;
    db.prepare(`INSERT INTO tickets (sprint_id, title, status) VALUES (?, ?, ?)`).run(cs.id, "Carried over", "TODO");

    // Create a ticket with no sprint (should be in backlog)
    db.prepare(`INSERT INTO tickets (title, status) VALUES (?, ?)`).run("Unassigned", "TODO");

    // Create an active sprint with a TODO ticket (should NOT be in backlog)
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("active-sprint", "active");
    const as2 = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("active-sprint") as any;
    db.prepare(`INSERT INTO tickets (sprint_id, title, status) VALUES (?, ?, ?)`).run(as2.id, "Active work", "TODO");

    const backlog = db.prepare(`
      SELECT t.id, t.title, t.status
      FROM tickets t
      WHERE t.sprint_id IS NULL
        OR (t.status IN ('TODO','NOT_DONE') AND t.sprint_id IN (SELECT id FROM sprints WHERE status = 'closed'))
      ORDER BY t.priority, t.created_at
    `).all() as any[];

    expect(backlog).toHaveLength(2);
    const titles = backlog.map((t: any) => t.title);
    expect(titles).toContain("Carried over");
    expect(titles).toContain("Unassigned");
    expect(titles).not.toContain("Active work");
  });
});
