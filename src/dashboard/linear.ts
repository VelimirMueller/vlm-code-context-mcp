/**
 * Linear integration layer.
 *
 * The dashboard cannot call Linear MCP tools directly (OAuth tokens are
 * managed by the Claude session).  Instead, data is pushed into SQLite
 * via POST /api/me/sync (called from Claude or a hook) and read back
 * by the frontend through GET /api/me/* endpoints.
 *
 * If no synced data exists yet, the Me tab shows a "sync required" prompt.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type Database from "better-sqlite3";

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

export interface LinearSyncPayload {
  user?: LinearUser;
  issues?: LinearIssue[];
  cycles?: LinearCycle[];
  projects?: LinearProject[];
}

// ─── Configuration detection ────────────────────────────────────────────────

function findProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, ".mcp.json"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, "../..");
}

const PROJECT_ROOT = findProjectRoot();

export function isLinearConfigured(): boolean {
  try {
    const mcpPath = path.join(PROJECT_ROOT, ".mcp.json");
    const raw = fs.readFileSync(mcpPath, "utf-8");
    const mcp = JSON.parse(raw);
    return !!(mcp?.mcpServers?.linear || mcp?.mcpServers?.["linear-mcp"]);
  } catch {
    return false;
  }
}

// ─── SQLite cache ───────────────────────────────────────────────────────────

export function initLinearSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS linear_cache (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function syncLinearData(db: Database.Database, payload: LinearSyncPayload): { ok: boolean; synced: string[] } {
  const synced: string[] = [];
  const upsert = db.prepare(`INSERT INTO linear_cache (key, value, synced_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, synced_at=datetime('now')`);

  const tx = db.transaction(() => {
    if (payload.user) {
      upsert.run("user", JSON.stringify(payload.user));
      synced.push("user");
    }
    if (payload.issues) {
      upsert.run("issues", JSON.stringify(payload.issues));
      synced.push("issues");
    }
    if (payload.cycles) {
      upsert.run("cycles", JSON.stringify(payload.cycles));
      synced.push("cycles");
    }
    if (payload.projects) {
      upsert.run("projects", JSON.stringify(payload.projects));
      synced.push("projects");
    }
  });
  tx();
  return { ok: true, synced };
}

function getCache(db: Database.Database, key: string): any | null {
  const row = db.prepare("SELECT value FROM linear_cache WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

export function getLinearUser(db: Database.Database): LinearUser | null {
  return getCache(db, "user");
}

export function getLinearIssues(db: Database.Database): LinearIssue[] {
  return getCache(db, "issues") ?? [];
}

export function getLinearCycles(db: Database.Database): LinearCycle[] {
  return getCache(db, "cycles") ?? [];
}

export function getLinearProjects(db: Database.Database): LinearProject[] {
  return getCache(db, "projects") ?? [];
}

export function getLinearSyncStatus(db: Database.Database): { synced: boolean; syncedAt: string | null } {
  const row = db.prepare("SELECT synced_at FROM linear_cache WHERE key = 'issues' LIMIT 1").get() as { synced_at: string } | undefined;
  return { synced: !!row, syncedAt: row?.synced_at ?? null };
}
