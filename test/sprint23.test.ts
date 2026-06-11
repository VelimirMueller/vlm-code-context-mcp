import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import {
  clusterRecurringIssues,
  getScopeDeltas,
  checkDistFreshness,
  registerScrumTools,
} from "../src/scrum/tools.js";
import Database from "better-sqlite3";

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

/** Captures tool handlers the way McpServer would — lets tests invoke tools end-to-end. */
class FakeServer {
  tools = new Map<string, Handler>();
  tool(name: string, _desc: string, _schema: unknown, handler: Handler): void {
    this.tools.set(name, handler);
  }
}

function setupDb(): Database.Database {
  const db = createTestDb();
  initScrumSchema(db);
  runMigrations(db);
  return db;
}

function setupHandlers(db: Database.Database): Map<string, Handler> {
  const server = new FakeServer();
  registerScrumTools(server as never, db);
  return server.tools;
}

const text = (res: { content: Array<{ text: string }> }): string => res.content.map((c) => c.text).join("\n");

describe("A4: clusterRecurringIssues", () => {
  it("never surfaces stopword-class tokens as issues", () => {
    const findings = [
      { finding: "Build failed because the time ran out because of sprint pressure", sprint_id: 1 },
      { finding: "Deploy failed because time pressure during the sprint", sprint_id: 2 },
    ];
    const clusters = clusterRecurringIssues(findings);
    const terms = clusters.map((c) => c.term);
    expect(terms.join(" ")).not.toMatch(/\bbecause\b/);
    expect(terms.join(" ")).not.toMatch(/\btime\b/);
    expect(terms.join(" ")).not.toMatch(/\bsprint\b/);
  });

  it("requires findings from at least 2 distinct sprints", () => {
    const findings = [
      { finding: "stale dist caused silent seeding failure", sprint_id: 1 },
      { finding: "stale dist again caused broken tooling", sprint_id: 1 }, // same sprint
    ];
    expect(clusterRecurringIssues(findings)).toHaveLength(0);
  });

  it("clusters the stale-dist class across sprints with example and sprint list", () => {
    const findings = [
      { finding: "Agent seeding had a silent bug — stale dist returned wrong counts", sprint_id: 1, sprint_name: "Sprint 1", role: "devops" },
      { finding: "stale dist made the new tools invisible until rebuild", sprint_id: 22, sprint_name: "Sprint 22", role: "qa" },
      { finding: "Unrelated finding about flaky network", sprint_id: 3, sprint_name: "Sprint 3" },
    ];
    const clusters = clusterRecurringIssues(findings);
    const staleCluster = clusters.find((c) => c.term.includes("stale"));
    expect(staleCluster).toBeDefined();
    expect(staleCluster!.findingCount).toBe(2);
    expect(staleCluster!.sprintCount).toBe(2);
    expect(staleCluster!.sprints).toEqual(["Sprint 1", "Sprint 22"]);
    expect(staleCluster!.example).toContain("Agent seeding");
    expect(staleCluster!.roles).toContain("devops");
  });

  it("suppresses unigrams shadowed by an equal-or-stronger bigram", () => {
    const findings = [
      { finding: "stale dist broke seeding", sprint_id: 1 },
      { finding: "stale dist broke routing", sprint_id: 2 },
    ];
    const clusters = clusterRecurringIssues(findings);
    const terms = clusters.map((c) => c.term);
    expect(terms).toContain("stale dist");
    expect(terms).not.toContain("stale");
    expect(terms).not.toContain("dist");
  });
});

describe("A3: getScopeDeltas", () => {
  let db: Database.Database;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    db.prepare(`INSERT INTO sprints (name, status, velocity_committed) VALUES ('S', 'implementation', 10)`).run();
    sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = 'S'`).get() as any).id;
    // implementation-start marker: one hour ago
    db.prepare(`INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor, created_at)
                VALUES ('sprint', ?, 'status_changed', 'status', 'planning', 'implementation', 'mcp', datetime('now', '-1 hour'))`).run(sprintId);
  });

  it("counts tickets created after implementation start as added scope", () => {
    db.prepare(`INSERT INTO tickets (sprint_id, title, story_points, created_at) VALUES (?, 'committed work', 5, datetime('now', '-2 hours'))`).run(sprintId);
    db.prepare(`INSERT INTO tickets (sprint_id, title, story_points, created_at) VALUES (?, 'scope creep', 3, datetime('now', '-5 minutes'))`).run(sprintId);

    const d = getScopeDeltas(db, sprintId);
    expect(d.addedTickets).toBe(1);
    expect(d.addedPoints).toBe(3);
  });

  it("counts tickets that left the sprint via the audit trail as removed", () => {
    db.prepare(`INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor)
                VALUES ('ticket', 999, 'updated', 'sprint_id', CAST(? AS TEXT), '7', 'dashboard')`).run(sprintId);
    expect(getScopeDeltas(db, sprintId).removedTickets).toBe(1);
  });

  it("returns zeros for unknown sprints", () => {
    expect(getScopeDeltas(db, 4242)).toEqual({ addedPoints: 0, addedTickets: 0, removedTickets: 0 });
  });
});

describe("A3: advance_sprint planning gate + commitment freeze (handler-level)", () => {
  let db: Database.Database;
  let handlers: Map<string, Handler>;
  let sprintId: number;

  beforeEach(() => {
    db = setupDb();
    handlers = setupHandlers(db);
    db.prepare(`INSERT INTO sprints (name, status) VALUES ('Gated', 'planning')`).run();
    sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = 'Gated'`).get() as any).id;
    db.prepare(`INSERT INTO tickets (sprint_id, title, story_points) VALUES (?, 'work', 8)`).run(sprintId);
  });

  it("blocks planning → implementation while untriaged try_next exist", async () => {
    db.prepare(`INSERT INTO retro_findings (sprint_id, category, finding) VALUES (?, 'try_next', 'untriaged thing')`).run(sprintId);
    const res = await handlers.get("advance_sprint")!({ sprint_id: sprintId });
    expect(text(res)).toContain("SPRINT ADVANCE BLOCKED");
    const sprint = db.prepare(`SELECT status FROM sprints WHERE id = ?`).get(sprintId) as any;
    expect(sprint.status).toBe("planning"); // unchanged
  });

  it("advances with acknowledge_open_items and freezes velocity_committed from ticket points", async () => {
    db.prepare(`INSERT INTO retro_findings (sprint_id, category, finding) VALUES (?, 'try_next', 'untriaged thing')`).run(sprintId);
    const res = await handlers.get("advance_sprint")!({ sprint_id: sprintId, acknowledge_open_items: true });
    expect(text(res)).toContain("advanced: planning → implementation");
    const sprint = db.prepare(`SELECT status, velocity_committed FROM sprints WHERE id = ?`).get(sprintId) as any;
    expect(sprint.status).toBe("implementation");
    expect(sprint.velocity_committed).toBe(8); // frozen at gate passage
  });

  it("mid-sprint ticket creation never touches the frozen commitment", async () => {
    await handlers.get("advance_sprint")!({ sprint_id: sprintId }); // no open items — advances + freezes at 8
    // Backdate committed scope + implementation start: datetime() is second-granular, so
    // a same-second sequence can't distinguish committed from added otherwise.
    db.prepare(`UPDATE tickets SET created_at = datetime('now', '-2 hours') WHERE sprint_id = ?`).run(sprintId);
    db.prepare(`UPDATE event_log SET created_at = datetime('now', '-1 hour') WHERE entity_type = 'sprint' AND entity_id = ? AND new_value = 'implementation'`).run(sprintId);
    // priority passed explicitly — FakeServer invokes raw handlers, bypassing zod defaults
    await handlers.get("create_ticket")!({ sprint_id: sprintId, title: "scope creep", story_points: 5, priority: "P2" });
    const sprint = db.prepare(`SELECT velocity_committed FROM sprints WHERE id = ?`).get(sprintId) as any;
    expect(sprint.velocity_committed).toBe(8);
    expect(getScopeDeltas(db, sprintId).addedPoints).toBe(5);
  });
});

describe("B1/C1: handler-level output contracts", () => {
  let db: Database.Database;
  let handlers: Map<string, Handler>;
  let sprintId: number;
  let ticketId: number;

  beforeEach(() => {
    db = setupDb();
    handlers = setupHandlers(db);
    db.prepare(`INSERT INTO sprints (name, status, velocity_committed) VALUES ('Cardful', 'implementation', 5)`).run();
    sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = 'Cardful'`).get() as any).id;
    db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, story_points, status) VALUES (?, 'T-1', 'the work', 5, 'IN_PROGRESS')`).run(sprintId);
    ticketId = (db.prepare(`SELECT id FROM tickets WHERE ticket_ref = 'T-1'`).get() as any).id;
  });

  it("update_ticket(format:card) returns a diff-fenced card plus compact state in one response", async () => {
    const res = await handlers.get("update_ticket")!({ ticket_id: ticketId, status: "DONE", qa_verified: true, format: "card" });
    const body = text(res);
    expect(body).toContain("```diff");
    expect(body).toContain("T-1");
    expect(body).toMatch(/sprint 5\/5pt/);
  });

  it("list_discoveries is compact by default and verbose on demand", async () => {
    db.prepare(`INSERT INTO discoveries (discovery_sprint_id, finding, priority, status, category, drop_reason)
                VALUES (?, 'a dropped one', 'P2', 'dropped', 'general', 'obsolete')`).run(sprintId);
    db.prepare(`INSERT INTO discoveries (discovery_sprint_id, finding, priority, status, category)
                VALUES (?, '${"x".repeat(200)}', 'P1', 'discovered', 'general')`).run(sprintId);

    const compact = text(await handlers.get("list_discoveries")!({}));
    expect(compact).not.toContain("a dropped one"); // open work only
    expect(compact).toContain("…"); // truncated finding
    expect(compact.length).toBeLessThan(300);

    const verbose = text(await handlers.get("list_discoveries")!({ verbose: true }));
    expect(verbose).toContain("a dropped one");
    expect(verbose).toContain("x".repeat(200));
  });

  it("get_burndown defaults to the last 5 snapshots", async () => {
    for (let i = 9; i >= 1; i--) {
      db.prepare(`INSERT INTO sprint_metrics (sprint_id, date, completed_points, remaining_points) VALUES (?, date('now', ?), ?, ?)`)
        .run(sprintId, `-${i} day`, 9 - i, i);
    }
    const compact = text(await handlers.get("get_burndown")!({ sprint_id: sprintId }));
    expect(compact).toContain("4 earlier snapshots hidden");
    const verbose = text(await handlers.get("get_burndown")!({ sprint_id: sprintId, verbose: true }));
    expect(verbose).not.toContain("hidden");
  });

  it("get_sprint_playbook drops the tutorial for experienced projects (>3 sprints)", async () => {
    const before = text(await handlers.get("get_sprint_playbook")!({ sprint_id: sprintId }));
    expect(before).toContain("What To Do Now"); // 1 sprint — tutorial stays
    for (let i = 0; i < 4; i++) db.prepare(`INSERT INTO sprints (name, status) VALUES ('Old ${i}', 'rest')`).run();
    const after = text(await handlers.get("get_sprint_playbook")!({ sprint_id: sprintId }));
    expect(after).not.toContain("What To Do Now");
    expect(after).toContain("Gate"); // gate info survives the diet (warning section or pass line)
  });
});

describe("S1: checkDistFreshness", () => {
  function makeTree(srcNewer: boolean): string {
    const root = mkdtempSync(join(tmpdir(), "fresh-"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "src", "a.ts"), "x");
    writeFileSync(join(root, "dist", "a.js"), "x");
    const old = new Date(Date.now() - 60_000);
    if (srcNewer) utimesSync(join(root, "dist", "a.js"), old, old);
    else utimesSync(join(root, "src", "a.ts"), old, old);
    return root;
  }

  it("warns when src is newer than dist", () => {
    expect(checkDistFreshness(makeTree(true))).toContain("STALE DIST");
  });

  it("stays silent when dist is fresh", () => {
    expect(checkDistFreshness(makeTree(false))).toBeNull();
  });

  it("stays silent without a dist dir (dev/packaged installs)", () => {
    const root = mkdtempSync(join(tmpdir(), "fresh-"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "a.ts"), "x");
    expect(checkDistFreshness(root)).toBeNull();
  });
});
