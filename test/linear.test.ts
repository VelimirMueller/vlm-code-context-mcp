import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../src/server/schema.js";
import { initScrumSchema } from "../src/scrum/schema.js";
import {
  initLinearSchema,
  syncLinearData,
  getLinearUser,
  getLinearIssues,
  getLinearCycles,
  getLinearProjects,
  getLinearSyncStatus,
  type LinearSyncPayload,
} from "../src/dashboard/linear.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  initScrumSchema(db);
  initLinearSchema(db);
  return db;
}

const MOCK_USER = {
  id: "usr-001",
  name: "Test User",
  email: "test@example.com",
  avatarUrl: null,
};

const MOCK_ISSUES = [
  {
    id: "ISS-1",
    identifier: "ENG-100",
    title: "Fix login bug",
    description: "The login form crashes on submit",
    priority: 1,
    priorityLabel: "Urgent",
    status: "In Progress",
    statusColor: "#f59e0b",
    labels: ["bug", "auth"],
    projectName: "Backend",
    assigneeId: "usr-001",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-27T08:00:00Z",
    url: "https://linear.app/test/issue/ENG-100",
  },
  {
    id: "ISS-2",
    identifier: "ENG-101",
    title: "Add dark mode",
    description: null,
    priority: 3,
    priorityLabel: "Medium",
    status: "Todo",
    statusColor: "#6b7280",
    labels: ["feature"],
    projectName: null,
    assigneeId: "usr-001",
    createdAt: "2026-03-02T10:00:00Z",
    updatedAt: "2026-03-26T15:00:00Z",
    url: null,
  },
];

const MOCK_CYCLES = [
  {
    id: "cyc-001",
    name: "Sprint 35",
    startsAt: "2026-03-24T00:00:00Z",
    endsAt: "2026-03-30T23:59:59Z",
    completedIssueCount: 3,
    totalIssueCount: 8,
    status: "active",
  },
];

const MOCK_PROJECTS = [
  {
    id: "prj-001",
    name: "Backend",
    status: "In Progress",
    progress: 0.45,
    leadName: "Test User",
    targetDate: "2026-06-30",
  },
];

describe("Linear sync layer", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("should report not synced when no data exists", () => {
    const status = getLinearSyncStatus(db);
    expect(status.synced).toBe(false);
    expect(status.syncedAt).toBeNull();
  });

  it("should return empty data when not synced", () => {
    expect(getLinearUser(db)).toBeNull();
    expect(getLinearIssues(db)).toEqual([]);
    expect(getLinearCycles(db)).toEqual([]);
    expect(getLinearProjects(db)).toEqual([]);
  });

  it("should sync and retrieve user data", () => {
    const result = syncLinearData(db, { user: MOCK_USER });
    expect(result.ok).toBe(true);
    expect(result.synced).toContain("user");

    const user = getLinearUser(db);
    expect(user).not.toBeNull();
    expect(user!.name).toBe("Test User");
    expect(user!.email).toBe("test@example.com");
  });

  it("should sync and retrieve issues", () => {
    syncLinearData(db, { issues: MOCK_ISSUES });

    const issues = getLinearIssues(db);
    expect(issues).toHaveLength(2);
    expect(issues[0].identifier).toBe("ENG-100");
    expect(issues[0].title).toBe("Fix login bug");
    expect(issues[0].labels).toEqual(["bug", "auth"]);
    expect(issues[1].status).toBe("Todo");
  });

  it("should sync and retrieve cycles", () => {
    syncLinearData(db, { cycles: MOCK_CYCLES });

    const cycles = getLinearCycles(db);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].name).toBe("Sprint 35");
    expect(cycles[0].completedIssueCount).toBe(3);
  });

  it("should sync and retrieve projects", () => {
    syncLinearData(db, { projects: MOCK_PROJECTS });

    const projects = getLinearProjects(db);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Backend");
    expect(projects[0].progress).toBe(0.45);
  });

  it("should sync all data at once", () => {
    const payload: LinearSyncPayload = {
      user: MOCK_USER,
      issues: MOCK_ISSUES,
      cycles: MOCK_CYCLES,
      projects: MOCK_PROJECTS,
    };
    const result = syncLinearData(db, payload);
    expect(result.ok).toBe(true);
    expect(result.synced).toEqual(["user", "issues", "cycles", "projects"]);

    const status = getLinearSyncStatus(db);
    expect(status.synced).toBe(true);
    expect(status.syncedAt).toBeTruthy();
  });

  it("should overwrite data on re-sync", () => {
    syncLinearData(db, { issues: MOCK_ISSUES });
    expect(getLinearIssues(db)).toHaveLength(2);

    const updatedIssues = [MOCK_ISSUES[0]];
    syncLinearData(db, { issues: updatedIssues });
    expect(getLinearIssues(db)).toHaveLength(1);
  });

  it("should sanitize XSS in issue titles", () => {
    const xssIssues = [{
      ...MOCK_ISSUES[0],
      title: '<script>alert("xss")</script>Fix bug',
      description: '<img onerror="hack()" src=x>',
    }];
    syncLinearData(db, { issues: xssIssues });

    const issues = getLinearIssues(db);
    expect(issues[0].title).not.toContain("<script>");
    expect(issues[0].title).toContain("&lt;script&gt;");
    expect(issues[0].description).not.toContain("<img");
  });

  it("should sanitize XSS in user names", () => {
    const xssUser = { ...MOCK_USER, name: '<b>bold</b>' };
    syncLinearData(db, { user: xssUser });

    const user = getLinearUser(db);
    expect(user!.name).toBe("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("should truncate long strings", () => {
    const longTitle = "A".repeat(500);
    const longIssues = [{ ...MOCK_ISSUES[0], title: longTitle }];
    syncLinearData(db, { issues: longIssues });

    const issues = getLinearIssues(db);
    expect(issues[0].title.length).toBeLessThanOrEqual(300);
  });

  it("should handle partial sync (only user)", () => {
    const result = syncLinearData(db, { user: MOCK_USER });
    expect(result.synced).toEqual(["user"]);
    expect(getLinearIssues(db)).toEqual([]);
  });

  it("should handle empty payload gracefully", () => {
    const result = syncLinearData(db, {});
    expect(result.ok).toBe(true);
    expect(result.synced).toEqual([]);
  });
});
