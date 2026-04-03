import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createTestDb } from "./helpers/db.js";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import {
  initLinearSchema,
  fetchAndSyncLinear,
  loadLinearConfig,
  isLinearDirectSyncConfigured,
  getLinearIssues,
  getLinearUser,
  getLinearSyncStatus,
  getLinearIssuesNormalized,
  getLinearStatesNormalized,
} from "../src/dashboard/linear.js";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

describe("Linear Direct Sync", () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
    runMigrations(db);
    initLinearSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linear-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ─── Config loading ─────────────────────────────────────────────────

  describe("loadLinearConfig", () => {
    it("returns null when no config file exists", () => {
      const config = loadLinearConfig(path.join(tmpDir, "context.db"));
      expect(config).toBeNull();
    });

    it("loads config from .linear.local.json next to dbPath", () => {
      const configPath = path.join(tmpDir, ".linear.local.json");
      fs.writeFileSync(configPath, JSON.stringify({ apiKey: "lin_api_test123", autoSync: false }));
      const config = loadLinearConfig(path.join(tmpDir, "context.db"));
      expect(config).not.toBeNull();
      expect(config!.apiKey).toBe("lin_api_test123");
      expect(config!.autoSync).toBe(false);
    });

    it("ignores config with empty apiKey", () => {
      const configPath = path.join(tmpDir, ".linear.local.json");
      fs.writeFileSync(configPath, JSON.stringify({ apiKey: "" }));
      const config = loadLinearConfig(path.join(tmpDir, "context.db"));
      expect(config).toBeNull();
    });
  });

  describe("isLinearDirectSyncConfigured", () => {
    it("returns false when no config", () => {
      expect(isLinearDirectSyncConfigured(path.join(tmpDir, "context.db"))).toBe(false);
    });

    it("returns true when valid config exists", () => {
      fs.writeFileSync(path.join(tmpDir, ".linear.local.json"), JSON.stringify({ apiKey: "lin_api_test" }));
      expect(isLinearDirectSyncConfigured(path.join(tmpDir, "context.db"))).toBe(true);
    });
  });

  // ─── fetchAndSyncLinear ─────────────────────────────────────────────

  describe("fetchAndSyncLinear", () => {
    it("returns error when no API key available", async () => {
      const result = await fetchAndSyncLinear(db, path.join(tmpDir, "context.db"));
      expect(result.ok).toBe(false);
      expect(result.error).toContain("No Linear API key");
    });

    it("returns error on 401 unauthorized", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }));

      const result = await fetchAndSyncLinear(db, tmpDir, "lin_api_bad_key");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid Linear API key");
    });

    it("returns error on GraphQL errors", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: "Rate limit exceeded" }] }),
      }));

      const result = await fetchAndSyncLinear(db, tmpDir, "lin_api_test");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Failed to fetch Linear data");
    });

    it("syncs issues, projects, and user on success", async () => {
      const mockIssues = {
        data: {
          issues: {
            nodes: [
              {
                id: "issue-1", identifier: "ENG-42", title: "Fix sync button",
                description: "Make it work", priority: 1, priorityLabel: "Urgent",
                url: "https://linear.app/test/ENG-42",
                createdAt: "2026-04-01T00:00:00Z", updatedAt: "2026-04-02T00:00:00Z",
                state: { id: "state-1", name: "In Progress", type: "started", color: "#f59e0b", position: 1 },
                project: { name: "Dashboard" },
                assignee: { id: "user-1", name: "Velimir" },
                labels: { nodes: [{ id: "label-1", name: "bug", color: "#ef4444" }] },
                cycle: { name: "Sprint 73" },
              },
              {
                id: "issue-2", identifier: "ENG-43", title: "Add tests",
                description: null, priority: 2, priorityLabel: "High",
                url: null,
                createdAt: "2026-04-01T00:00:00Z", updatedAt: "2026-04-02T00:00:00Z",
                state: { id: "state-2", name: "Todo", type: "backlog", color: "#6b7280", position: 0 },
                project: null,
                assignee: null,
                labels: { nodes: [] },
                cycle: null,
              },
            ],
          },
        },
      };

      const mockProjects = {
        data: {
          projects: {
            nodes: [
              { id: "proj-1", name: "Dashboard", state: "started", progress: 0.6, lead: { name: "Velimir" }, targetDate: "2026-06-01" },
            ],
          },
        },
      };

      const mockViewer = {
        data: {
          viewer: { id: "user-1", name: "Velimir", email: "v@test.com", avatarUrl: null },
        },
      };

      let callCount = 0;
      vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => {
        callCount++;
        const data = callCount === 1 ? mockIssues : callCount === 2 ? mockProjects : mockViewer;
        return { ok: true, status: 200, json: async () => data };
      }));

      const result = await fetchAndSyncLinear(db, tmpDir, "lin_api_test_key");

      expect(result.ok).toBe(true);
      expect(result.counts).toEqual({ issues: 2, projects: 1 });

      // Verify legacy cache
      const issues = getLinearIssues(db);
      expect(issues).toHaveLength(2);
      expect(issues[0].identifier).toBe("ENG-42");
      expect(issues[0].status).toBe("In Progress");
      expect(issues[0].projectName).toBe("Dashboard");

      const user = getLinearUser(db);
      expect(user).not.toBeNull();
      expect(user!.name).toBe("Velimir");
      expect(user!.email).toBe("v@test.com");

      // Verify sync status
      const status = getLinearSyncStatus(db);
      expect(status.synced).toBe(true);
      expect(status.syncedAt).not.toBeNull();

      // Verify normalized tables
      const normalized = getLinearIssuesNormalized(db);
      expect(normalized.length).toBe(2);
      const inProgress = normalized.find((i: any) => i.identifier === "ENG-42");
      expect(inProgress).toBeDefined();
      expect(inProgress!.kanbanColumn).toBe("IN_PROGRESS");

      const todo = normalized.find((i: any) => i.identifier === "ENG-43");
      expect(todo).toBeDefined();
      expect(todo!.kanbanColumn).toBe("TODO");

      // Verify states
      const states = getLinearStatesNormalized(db);
      expect(states.length).toBeGreaterThanOrEqual(2);
    });

    it("handles network errors gracefully", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

      const result = await fetchAndSyncLinear(db, tmpDir, "lin_api_test");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Linear sync failed");
    });

    it("sends Authorization header with API key", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await fetchAndSyncLinear(db, tmpDir, "lin_api_secret_key");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.linear.app/graphql",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "lin_api_secret_key" }),
        }),
      );
    });

    it("reads API key from env var when no config key", async () => {
      process.env.LINEAR_API_KEY = "lin_api_from_env";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ data: { issues: { nodes: [] } } }),
      }));

      const result = await fetchAndSyncLinear(db, tmpDir);
      expect(result.ok).toBe(true);
      delete process.env.LINEAR_API_KEY;
    });
  });
});
