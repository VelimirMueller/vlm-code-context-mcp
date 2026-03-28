import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import {
  initLinearSchema,
  syncLinearData,
  syncLinearNormalized,
  getLinearIssuesNormalized,
  getLinearStatesNormalized,
  moveLinearIssue,
  getLinearNormalizedSyncStatus,
  getLinearUser,
  getLinearIssues,
  getLinearSyncStatus,
} from "../src/dashboard/linear.js";
import Database from "better-sqlite3";

describe("Linear Proxy", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    initLinearSchema(db);
  });

  // ─── Legacy cache (v1) ─────────────────────────────────────────────────

  describe("syncLinearData (v1 cache)", () => {
    it("syncs user and issues to linear_cache", () => {
      const result = syncLinearData(db, {
        user: { id: "u1", name: "Alice", email: "alice@test.com", avatarUrl: null },
        issues: [
          { id: "i1", identifier: "ENG-1", title: "Fix bug", description: null, priority: 1, priorityLabel: "Urgent", status: "In Progress", statusColor: "#f00", labels: ["bug"], projectName: "Core", assigneeId: "u1", createdAt: "2026-01-01", updatedAt: "2026-01-02", url: null },
        ],
      });
      expect(result.ok).toBe(true);
      expect(result.synced).toContain("user");
      expect(result.synced).toContain("issues");

      const user = getLinearUser(db);
      expect(user?.name).toBe("Alice");

      const issues = getLinearIssues(db);
      expect(issues).toHaveLength(1);
      expect(issues[0].identifier).toBe("ENG-1");
    });

    it("reports sync status", () => {
      expect(getLinearSyncStatus(db).synced).toBe(false);
      syncLinearData(db, { issues: [{ id: "i1", identifier: "X-1", title: "T", description: null, priority: 1, priorityLabel: "U", status: "S", statusColor: "#000", labels: [], projectName: null, assigneeId: "u1", createdAt: "", updatedAt: "", url: null }] });
      expect(getLinearSyncStatus(db).synced).toBe(true);
    });

    it("sanitizes HTML in issue titles", () => {
      syncLinearData(db, {
        issues: [{ id: "i1", identifier: "X-1", title: "<script>alert(1)</script>", description: null, priority: 1, priorityLabel: "U", status: "S", statusColor: "#000", labels: [], projectName: null, assigneeId: "u1", createdAt: "", updatedAt: "", url: null }],
      });
      const issues = getLinearIssues(db);
      expect(issues[0].title).not.toContain("<script>");
      expect(issues[0].title).toContain("&lt;script&gt;");
    });
  });

  // ─── Normalized tables (v2) ────────────────────────────────────────────

  describe("syncLinearNormalized", () => {
    it("creates states from issue status fields", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "ENG-1", title: "Task A", status: "In Progress", statusColor: "#3b82f6", priority: 2, priorityLabel: "Medium", assigneeId: "u1", assigneeName: "Alice", projectName: "Core", labels: ["feat"], createdAt: "2026-01-01", updatedAt: "2026-01-02" },
          { id: "i2", identifier: "ENG-2", title: "Task B", status: "Done", statusColor: "#10b981", priority: 3, priorityLabel: "Low", assigneeId: "u2", assigneeName: "Bob", projectName: "Core", labels: [], createdAt: "2026-01-01", updatedAt: "2026-01-03" },
        ],
      });

      const states = getLinearStatesNormalized(db);
      expect(states.length).toBeGreaterThanOrEqual(2);
      const stateNames = states.map((s: any) => s.name);
      expect(stateNames).toContain("In Progress");
      expect(stateNames).toContain("Done");
    });

    it("upserts issues with normalized columns", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "ENG-1", title: "Build API", status: "Todo", statusColor: "#6b7280", priority: 1, priorityLabel: "Urgent", assigneeId: "u1", assigneeName: "Alice", projectName: "Backend", labels: ["api", "p0"], createdAt: "2026-01-01", updatedAt: "2026-01-02" },
        ],
      });

      const issues = getLinearIssuesNormalized(db);
      expect(issues).toHaveLength(1);
      expect(issues[0].identifier).toBe("ENG-1");
      expect(issues[0].title).toBe("Build API");
      expect(issues[0].assignee_name).toBe("Alice");
      expect(issues[0].project_name).toBe("Backend");
      expect(issues[0].labels).toEqual(["api", "p0"]);
      expect(issues[0].kanbanColumn).toBeDefined();
    });

    it("handles re-sync (upsert) without duplicates", () => {
      const payload = {
        issues: [{ id: "i1", identifier: "ENG-1", title: "V1", status: "Todo", statusColor: "#ccc", priority: 2, priorityLabel: "Med", assigneeId: "u1", assigneeName: "A", projectName: null, labels: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
      };
      syncLinearNormalized(db, payload);
      payload.issues[0].title = "V2";
      syncLinearNormalized(db, payload);

      const issues = getLinearIssuesNormalized(db);
      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe("V2");
    });
  });

  // ─── Query with filters ────────────────────────────────────────────────

  describe("getLinearIssuesNormalized filters", () => {
    beforeEach(() => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "ENG-1", title: "FE task", status: "In Progress", statusColor: "#3b82f6", priority: 1, priorityLabel: "Urgent", assigneeId: "u1", assigneeName: "Alice", projectName: "Frontend", labels: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
          { id: "i2", identifier: "ENG-2", title: "BE task", status: "Todo", statusColor: "#6b7280", priority: 2, priorityLabel: "Med", assigneeId: "u2", assigneeName: "Bob", projectName: "Backend", labels: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
          { id: "i3", identifier: "ENG-3", title: "Done task", status: "Done", statusColor: "#10b981", priority: 3, priorityLabel: "Low", assigneeId: "u1", assigneeName: "Alice", projectName: "Frontend", labels: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        ],
      });
    });

    it("filters by project", () => {
      const fe = getLinearIssuesNormalized(db, "Frontend");
      expect(fe).toHaveLength(2);
      expect(fe.every((i: any) => i.project_name === "Frontend")).toBe(true);
    });

    it("filters by kanban state", () => {
      const inProgress = getLinearIssuesNormalized(db, null, "IN_PROGRESS");
      expect(inProgress.length).toBeGreaterThanOrEqual(1);
      expect(inProgress.every((i: any) => i.kanbanColumn === "IN_PROGRESS")).toBe(true);
    });

    it("returns all issues without filters", () => {
      const all = getLinearIssuesNormalized(db);
      expect(all).toHaveLength(3);
    });
  });

  // ─── Kanban move ───────────────────────────────────────────────────────

  describe("moveLinearIssue", () => {
    beforeEach(() => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "ENG-1", title: "Movable", status: "Todo", statusColor: "#ccc", priority: 2, priorityLabel: "Med", assigneeId: "u1", assigneeName: "Alice", projectName: "Core", labels: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" },
        ],
      });
    });

    it("moves issue to IN_PROGRESS", () => {
      const result = moveLinearIssue(db, "i1", "IN_PROGRESS");
      expect(result.ok).toBe(true);
      expect(result.newState).toBeTruthy();

      const issues = getLinearIssuesNormalized(db);
      expect(issues[0].kanbanColumn).toBe("IN_PROGRESS");
    });

    it("moves issue to DONE", () => {
      const result = moveLinearIssue(db, "i1", "DONE");
      expect(result.ok).toBe(true);

      const issues = getLinearIssuesNormalized(db);
      expect(issues[0].kanbanColumn).toBe("DONE");
    });

    it("throws on invalid column", () => {
      expect(() => moveLinearIssue(db, "i1", "INVALID" as any)).toThrow("Invalid kanban column");
    });

    it("throws on missing issue", () => {
      expect(() => moveLinearIssue(db, "nonexistent", "DONE")).toThrow("Issue not found");
    });

    it("tracks previous and new state", () => {
      const r1 = moveLinearIssue(db, "i1", "IN_PROGRESS");
      expect(r1.previousState).toBeTruthy();
      const r2 = moveLinearIssue(db, "i1", "DONE");
      expect(r2.previousState).toBeTruthy();
      expect(r2.newState).toBeTruthy();
    });
  });

  // ─── Sync status ───────────────────────────────────────────────────────

  describe("getLinearNormalizedSyncStatus", () => {
    it("reports not synced when empty", () => {
      const status = getLinearNormalizedSyncStatus(db);
      expect(status.synced).toBe(false);
      expect(status.issueCount).toBe(0);
    });

    it("reports synced after data import", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "X-1", title: "T", status: "Todo", statusColor: "#ccc", priority: 2, priorityLabel: "M", assigneeId: "u1", assigneeName: "A", projectName: null, labels: [], createdAt: "", updatedAt: "" },
        ],
      });
      const status = getLinearNormalizedSyncStatus(db);
      expect(status.synced).toBe(true);
      expect(status.issueCount).toBe(1);
      expect(status.stateCount).toBeGreaterThanOrEqual(1);
      expect(status.syncedAt).toBeTruthy();
    });
  });

  // ─── Security: sanitization ────────────────────────────────────────────

  describe("sanitization", () => {
    it("sanitizes HTML in normalized issue titles", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "X-1", title: '<img onerror="alert(1)">', status: "Todo", statusColor: "#ccc", priority: 2, priorityLabel: "M", assigneeId: "u1", assigneeName: "A", projectName: null, labels: [], createdAt: "", updatedAt: "" },
        ],
      });
      const issues = getLinearIssuesNormalized(db);
      expect(issues[0].title).not.toContain("<img");
    });
  });

  // ─── Edge cases (S62-014) ──────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles issue with no assignee", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "X-1", title: "Unassigned", status: "Todo", statusColor: "#ccc", priority: 4, priorityLabel: "Low", assigneeId: null, assigneeName: null, projectName: null, labels: [], createdAt: "", updatedAt: "" },
        ],
      });
      const issues = getLinearIssuesNormalized(db);
      expect(issues).toHaveLength(1);
      expect(issues[0].assignee_name).toBeNull();
      expect(issues[0].assignee_id).toBeNull();
    });

    it("handles issue with no project", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "X-1", title: "No project", status: "In Progress", statusColor: "#3b82f6", priority: 2, priorityLabel: "Med", assigneeId: "u1", assigneeName: "Alice", projectName: null, labels: [], createdAt: "", updatedAt: "" },
        ],
      });
      const issues = getLinearIssuesNormalized(db);
      expect(issues[0].project_name).toBeNull();
      // Project filter should not include null
      const byProject = getLinearIssuesNormalized(db, "Nonexistent");
      expect(byProject).toHaveLength(0);
    });

    it("handles issue with empty labels", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "X-1", title: "No labels", status: "Todo", statusColor: "#ccc", priority: 3, priorityLabel: "Med", assigneeId: "u1", assigneeName: "A", projectName: "P", labels: [], createdAt: "", updatedAt: "" },
        ],
      });
      const issues = getLinearIssuesNormalized(db);
      expect(issues[0].labels).toEqual([]);
    });

    it("handles issue with undefined/null labels field", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "X-1", title: "Null labels", status: "Todo", statusColor: "#ccc", priority: 3, priorityLabel: "Med", assigneeId: "u1", assigneeName: "A", projectName: "P", labels: undefined as any, createdAt: "", updatedAt: "" },
        ],
      });
      const issues = getLinearIssuesNormalized(db);
      expect(Array.isArray(issues[0].labels)).toBe(true);
    });

    it("handles empty sync payload", () => {
      syncLinearNormalized(db, {});
      const issues = getLinearIssuesNormalized(db);
      expect(issues).toHaveLength(0);
    });

    it("handles sync with empty issues array", () => {
      syncLinearNormalized(db, { issues: [] });
      const issues = getLinearIssuesNormalized(db);
      expect(issues).toHaveLength(0);
    });

    it("handles issue with missing status (defaults to Todo)", () => {
      syncLinearNormalized(db, {
        issues: [
          { id: "i1", identifier: "X-1", title: "No status", status: undefined as any, statusColor: "#ccc", priority: 3, priorityLabel: "Med", assigneeId: "u1", assigneeName: "A", projectName: null, labels: [], createdAt: "", updatedAt: "" },
        ],
      });
      const issues = getLinearIssuesNormalized(db);
      expect(issues).toHaveLength(1);
      expect(issues[0].kanbanColumn).toBe("TODO");
    });
  });
});
