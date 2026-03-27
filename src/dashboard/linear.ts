/**
 * Linear MCP integration layer.
 *
 * Checks whether a "linear" MCP server is configured in `.mcp.json` at the
 * project root.  When the server is not configured every function returns a
 * graceful "not-configured" response.  When configured the module currently
 * returns mock data that matches the expected Linear shapes – the mock will be
 * replaced with real MCP tool calls once the Linear MCP server is guaranteed
 * to be running.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  priorityLabel: string;
  status: string;
  statusColor: string;
  labels: string[];
  projectName: string | null;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinearCycle {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  completedIssueCount: number;
  totalIssueCount: number;
  status: string;
}

export interface LinearProject {
  id: string;
  name: string;
  status: string;
  progress: number;
  leadName: string | null;
  targetDate: string | null;
}

// ─── Configuration detection ────────────────────────────────────────────────

function findProjectRoot(): string {
  // Walk up from the compiled output to the repo root.  The compiled JS lives
  // under dist/dashboard/ so the repo root is two directories up from __dirname
  // at runtime.  We also support the source-tree layout (src/dashboard/).
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, ".mcp.json"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, "../..");
}

const PROJECT_ROOT = findProjectRoot();

export async function isLinearConfigured(): Promise<boolean> {
  try {
    const mcpPath = path.join(PROJECT_ROOT, ".mcp.json");
    const raw = fs.readFileSync(mcpPath, "utf-8");
    const mcp = JSON.parse(raw);
    return !!(mcp?.mcpServers?.linear || mcp?.mcpServers?.["linear-mcp"]);
  } catch {
    return false;
  }
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK_USER: LinearUser = {
  id: "usr_mock_001",
  name: "Mock User",
  email: "mock@example.com",
  avatarUrl: null,
};

const MOCK_ISSUES: LinearIssue[] = [
  {
    id: "iss_mock_001",
    identifier: "VLM-100",
    title: "Implement Linear integration layer",
    description: "Create backend module for Linear MCP integration",
    priority: 1,
    priorityLabel: "Urgent",
    status: "In Progress",
    statusColor: "#f59e0b",
    labels: ["feature", "integration"],
    projectName: "MCP Server",
    assigneeId: "usr_mock_001",
    createdAt: "2026-03-25T10:00:00Z",
    updatedAt: "2026-03-27T08:30:00Z",
  },
  {
    id: "iss_mock_002",
    identifier: "VLM-101",
    title: "Add Me tab dashboard UI",
    description: "Build the Me tab frontend components",
    priority: 2,
    priorityLabel: "High",
    status: "Todo",
    statusColor: "#6b7280",
    labels: ["feature", "ui"],
    projectName: "MCP Server",
    assigneeId: "usr_mock_001",
    createdAt: "2026-03-25T11:00:00Z",
    updatedAt: "2026-03-26T15:00:00Z",
  },
];

const MOCK_CYCLES: LinearCycle[] = [
  {
    id: "cyc_mock_001",
    name: "Sprint 34",
    startsAt: "2026-03-23T00:00:00Z",
    endsAt: "2026-03-29T23:59:59Z",
    completedIssueCount: 5,
    totalIssueCount: 12,
    status: "active",
  },
];

const MOCK_PROJECTS: LinearProject[] = [
  {
    id: "prj_mock_001",
    name: "MCP Server",
    status: "started",
    progress: 0.65,
    leadName: "Mock User",
    targetDate: "2026-06-30",
  },
];

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getLinearUser(): Promise<LinearUser | null> {
  if (!(await isLinearConfigured())) return null;
  // TODO: replace with real MCP tool call to linear.get_user
  return MOCK_USER;
}

export async function getLinearIssues(): Promise<LinearIssue[]> {
  if (!(await isLinearConfigured())) return [];
  // TODO: replace with real MCP tool call to linear.list_issues
  return MOCK_ISSUES;
}

export async function getLinearCycles(): Promise<LinearCycle[]> {
  if (!(await isLinearConfigured())) return [];
  // TODO: replace with real MCP tool call to linear.list_cycles
  return MOCK_CYCLES;
}

export async function getLinearProjects(): Promise<LinearProject[]> {
  if (!(await isLinearConfigured())) return [];
  // TODO: replace with real MCP tool call to linear.list_projects
  return MOCK_PROJECTS;
}
