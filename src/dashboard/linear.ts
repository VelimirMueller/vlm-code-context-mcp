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

function sanitize(str: string | null | undefined, maxLen = 500): string | null {
  if (str == null) return null;
  return str.replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return map[c] ?? c;
  }).slice(0, maxLen);
}

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
  url: string | null;
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

  // Sanitize string fields
  if (payload.issues) {
    payload.issues = payload.issues.map(i => ({
      ...i,
      title: sanitize(i.title, 300) ?? '',
      description: sanitize(i.description, 2000),
      identifier: sanitize(i.identifier, 50) ?? '',
      status: sanitize(i.status, 50) ?? '',
      priorityLabel: sanitize(i.priorityLabel, 50) ?? '',
      projectName: sanitize(i.projectName, 200),
      labels: i.labels.map(l => sanitize(l, 100) ?? '').filter(Boolean),
    }));
  }
  if (payload.user) {
    payload.user = {
      ...payload.user,
      name: sanitize(payload.user.name, 200) ?? '',
      email: sanitize(payload.user.email, 200) ?? '',
    };
  }
  if (payload.projects) {
    payload.projects = payload.projects.map(p => ({
      ...p,
      name: sanitize(p.name, 200) ?? '',
      status: sanitize(p.status, 50) ?? '',
      leadName: sanitize(p.leadName, 200),
    }));
  }

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

// ─── Normalized Linear Tables (v2) ────────────────────────────────────────

const KANBAN_STATE_MAP: Record<string, string> = {
  backlog: 'TODO',
  unstarted: 'TODO',
  started: 'IN_PROGRESS',
  completed: 'DONE',
  cancelled: 'NOT_DONE',
};

const KANBAN_TO_STATE_TYPE: Record<string, string> = {
  TODO: 'backlog',
  IN_PROGRESS: 'started',
  DONE: 'completed',
  NOT_DONE: 'cancelled',
};

export function syncLinearNormalized(db: Database.Database, payload: any): void {
  const upsertState = db.prepare(`INSERT INTO linear_states (id, name, type, color, position, synced_at) VALUES (?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, color=excluded.color, position=excluded.position, synced_at=datetime('now')`);
  const upsertIssue = db.prepare(`INSERT INTO linear_issues (id, identifier, title, description, state_id, priority, priority_label, assignee_id, assignee_name, project_name, cycle_name, labels, url, created_at, updated_at, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET identifier=excluded.identifier, title=excluded.title, description=excluded.description, state_id=excluded.state_id, priority=excluded.priority, priority_label=excluded.priority_label, assignee_id=excluded.assignee_id, assignee_name=excluded.assignee_name, project_name=excluded.project_name, cycle_name=excluded.cycle_name, labels=excluded.labels, url=excluded.url, updated_at=excluded.updated_at, synced_at=datetime('now')`);
  const upsertLabel = db.prepare(`INSERT INTO linear_labels (id, name, color, synced_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, synced_at=datetime('now')`);

  const tx = db.transaction(() => {
    // Sync issues — extract states from issue status fields
    if (payload.issues && Array.isArray(payload.issues)) {
      const statesSeen = new Map<string, { name: string; color: string }>();
      for (const issue of payload.issues) {
        // Create or infer state from issue status string
        const stateId = issue.statusId || `state-${(issue.status || 'Todo').toLowerCase().replace(/\s+/g, '-')}`;
        const stateName = issue.status || 'Todo';
        const stateColor = issue.statusColor || '#6b7280';
        if (!statesSeen.has(stateId)) {
          statesSeen.set(stateId, { name: stateName, color: stateColor });
          const stateType = stateName.toLowerCase().includes('progress') ? 'started'
            : stateName.toLowerCase().includes('review') ? 'started'
            : stateName.toLowerCase().includes('done') ? 'completed'
            : stateName.toLowerCase().includes('cancel') ? 'cancelled'
            : 'backlog';
          upsertState.run(stateId, sanitize(stateName, 100), stateType, stateColor, 0);
        }

        upsertIssue.run(
          issue.id,
          sanitize(issue.identifier, 50) || issue.id,
          sanitize(issue.title, 500) || 'Untitled',
          sanitize(issue.description, 2000),
          stateId,
          issue.priority ?? 4,
          sanitize(issue.priorityLabel, 50),
          issue.assigneeId || null,
          sanitize(issue.assigneeName, 100),
          sanitize(issue.projectName, 200),
          sanitize(issue.cycleName, 200),
          JSON.stringify(issue.labels || []),
          sanitize(issue.url, 500),
          issue.createdAt || null,
          issue.updatedAt || null,
        );
      }
    }
  });
  tx();
}

export function getLinearIssuesNormalized(db: Database.Database, project?: string | null, state?: string | null) {
  let sql = `SELECT i.*, s.name as state_name, s.type as state_type, s.color as state_color FROM linear_issues i LEFT JOIN linear_states s ON i.state_id = s.id WHERE 1=1`;
  const params: any[] = [];
  if (project) { sql += ` AND i.project_name = ?`; params.push(project); }
  if (state) { sql += ` AND s.type = ?`; params.push(KANBAN_TO_STATE_TYPE[state] || state); }
  sql += ` ORDER BY i.priority ASC, i.updated_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map((r) => ({
    ...r,
    labels: r.labels ? JSON.parse(r.labels) : [],
    kanbanColumn: KANBAN_STATE_MAP[r.state_type] || 'TODO',
  }));
}

export function getLinearStatesNormalized(db: Database.Database) {
  const rows = db.prepare(`SELECT * FROM linear_states ORDER BY position, name`).all() as any[];
  return rows.map((r) => ({
    ...r,
    kanbanColumn: KANBAN_STATE_MAP[r.type] || 'TODO',
  }));
}

export function moveLinearIssue(db: Database.Database, issueId: string, kanbanColumn: string): { ok: boolean; previousState: string; newState: string } {
  const validColumns = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'];
  if (!validColumns.includes(kanbanColumn)) throw Object.assign(new Error(`Invalid kanban column: ${kanbanColumn}`), { status: 400 });

  const issue = db.prepare(`SELECT i.*, s.name as state_name, s.type as state_type FROM linear_issues i LEFT JOIN linear_states s ON i.state_id = s.id WHERE i.id = ?`).get(issueId) as any;
  if (!issue) throw Object.assign(new Error('Issue not found'), { status: 404 });

  const targetType = KANBAN_TO_STATE_TYPE[kanbanColumn];
  const targetState = db.prepare(`SELECT id, name FROM linear_states WHERE type = ? LIMIT 1`).get(targetType) as any;

  if (!targetState) {
    // Create a default state for this type
    const defaultNames: Record<string, string> = { backlog: 'Todo', started: 'In Progress', completed: 'Done', cancelled: 'Cancelled' };
    const stateId = `state-${targetType}`;
    db.prepare(`INSERT OR IGNORE INTO linear_states (id, name, type, color, position) VALUES (?, ?, ?, ?, ?)`).run(stateId, defaultNames[targetType] || kanbanColumn, targetType, '#6b7280', 0);
    db.prepare(`UPDATE linear_issues SET state_id = ?, updated_at = datetime('now'), synced_at = datetime('now') WHERE id = ?`).run(stateId, issueId);
    return { ok: true, previousState: issue.state_name || 'Unknown', newState: defaultNames[targetType] || kanbanColumn };
  }

  db.prepare(`UPDATE linear_issues SET state_id = ?, updated_at = datetime('now'), synced_at = datetime('now') WHERE id = ?`).run(targetState.id, issueId);
  return { ok: true, previousState: issue.state_name || 'Unknown', newState: targetState.name };
}

export function getLinearNormalizedSyncStatus(db: Database.Database) {
  const issueCount = (db.prepare(`SELECT COUNT(*) as c FROM linear_issues`).get() as any).c;
  const stateCount = (db.prepare(`SELECT COUNT(*) as c FROM linear_states`).get() as any).c;
  const latestSync = db.prepare(`SELECT MAX(synced_at) as t FROM linear_issues`).get() as any;
  return {
    synced: issueCount > 0,
    issueCount,
    stateCount,
    syncedAt: latestSync?.t || null,
  };
}
