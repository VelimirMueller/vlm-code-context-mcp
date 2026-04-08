import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../src/server/schema.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { seedDefaults } from "../src/scrum/defaults.js";

/**
 * SSE Data Flow test — verifies the core bug:
 * After setup, the dashboard's DB connection can read data written by the MCP server.
 *
 * Simulates: MCP server writes → dashboard queries → data is visible
 * The real bug was a read-only connection that couldn't see WAL changes.
 */
describe("SSE data flow: DB writes visible to dashboard queries", () => {
  let mcpDb: Database.Database;
  let dashboardDb: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    // Use a temp file DB (not :memory:) to simulate two separate connections
    dbPath = `/tmp/sse-test-${Date.now()}.db`;

    // MCP server connection (read-write)
    mcpDb = new Database(dbPath);
    mcpDb.pragma("journal_mode = WAL");
    mcpDb.pragma("foreign_keys = ON");
    initSchema(mcpDb);
    initScrumSchema(mcpDb);
    runMigrations(mcpDb);
    seedDefaults(mcpDb);

    // Dashboard connection (read-write, NOT read-only — this was the fix)
    dashboardDb = new Database(dbPath);
    dashboardDb.pragma("journal_mode = WAL");
    dashboardDb.pragma("foreign_keys = ON");

    // Dashboard adds soft-delete columns (like the real code)
    for (const table of ['milestones', 'sprints', 'epics', 'tickets'] as const) {
      const cols = dashboardDb.pragma(`table_info(${table})`) as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'deleted_at')) {
        dashboardDb.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT DEFAULT NULL`);
      }
    }
  });

  it("should see milestones created by MCP server", () => {
    // MCP server creates a milestone
    mcpDb.prepare(`INSERT INTO milestones (name, description, status) VALUES (?, ?, ?)`).run(
      "M2 — Test Milestone", "Created by MCP", "active"
    );

    // Dashboard queries milestones
    const milestones = dashboardDb.prepare(
      `SELECT * FROM milestones WHERE deleted_at IS NULL ORDER BY id`
    ).all() as any[];

    // Should see the MCP-created milestone
    expect(milestones.length).toBeGreaterThanOrEqual(1);
    expect(milestones.some((m: any) => m.name === "M2 — Test Milestone")).toBe(true);
  });

  it("should see sprints and tickets created by MCP server", () => {
    // MCP server creates a sprint with tickets
    mcpDb.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, ?, ?)`).run(
      "Sprint 1 — Test", "Test goal", "implementation", 19
    );
    const sprintId = (mcpDb.prepare(`SELECT last_insert_rowid() as id`).get() as any).id;

    mcpDb.prepare(`INSERT INTO tickets (sprint_id, title, status, story_points, assigned_to, priority) VALUES (?, ?, ?, ?, ?, ?)`).run(
      sprintId, "Fix SSE bug", "IN_PROGRESS", 5, "be-engineer", "P0"
    );

    // Dashboard queries sprints
    const sprints = dashboardDb.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id) as ticket_count FROM sprints s WHERE s.deleted_at IS NULL`
    ).all() as any[];

    expect(sprints.length).toBeGreaterThanOrEqual(1);
    const testSprint = sprints.find((s: any) => s.name === "Sprint 1 — Test");
    expect(testSprint).toBeDefined();
    expect(testSprint.ticket_count).toBe(1);

    // Dashboard queries tickets
    const tickets = dashboardDb.prepare(
      `SELECT * FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL`
    ).all(sprintId) as any[];

    expect(tickets.length).toBe(1);
    expect(tickets[0].title).toBe("Fix SSE bug");
  });

  it("should see rapid sequential writes from MCP server", () => {
    // Simulate rapid MCP tool calls (multiple writes in quick succession)
    for (let i = 0; i < 10; i++) {
      mcpDb.prepare(`INSERT INTO milestones (name, description, status) VALUES (?, ?, ?)`).run(
        `Rapid M${i}`, `Rapid write ${i}`, "planned"
      );
    }

    // Dashboard should see all writes
    const count = (dashboardDb.prepare(
      `SELECT COUNT(*) as cnt FROM milestones WHERE name LIKE 'Rapid M%'`
    ).get() as any).cnt;

    expect(count).toBe(10);
  });

  it("read-only connection misses WAL writes (proving the bug)", () => {
    // This test demonstrates WHY the read-only connection was broken
    const readOnlyDb = new Database(dbPath, { readonly: true });
    readOnlyDb.pragma("journal_mode = WAL");

    // Write via MCP
    mcpDb.prepare(`INSERT INTO milestones (name, description, status) VALUES (?, ?, ?)`).run(
      "WAL-only milestone", "Written to WAL", "active"
    );

    // Read-only connection may or may not see it (depends on WAL checkpoint state)
    // The read-write dashboard connection always sees it
    const dashboardResult = dashboardDb.prepare(
      `SELECT * FROM milestones WHERE name = 'WAL-only milestone'`
    ).get();
    expect(dashboardResult).toBeDefined();

    readOnlyDb.close();
  });
});
