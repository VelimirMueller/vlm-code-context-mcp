#!/usr/bin/env node
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import chokidar from "chokidar";
import { indexDirectory } from "../server/indexer.js";
import { initSchema } from "../server/schema.js";
import { initScrumSchema, runMigrations } from "../scrum/schema.js";
import { importScrumData } from "../scrum/import.js";
import { seedDefaults } from "../scrum/defaults.js";
import { isLinearConfigured, getLinearUser, getLinearIssues, getLinearCycles, getLinearProjects, getLinearSyncStatus, syncLinearData, initLinearSchema, syncLinearNormalized, getLinearIssuesNormalized, getLinearStatesNormalized, moveLinearIssue, getLinearNormalizedSyncStatus, fetchAndSyncLinear } from "./linear.js";
import { ensureGithubTables, syncGithubData, getGithubRepos, getGithubIssues, getGithubPRs, getGithubCommits, getGithubSyncStatus, isGithubConfigured, loadGithubConfig, fetchAndSyncGithub, startGithubAutoSync } from "./github.js";

// ─── Input validation helpers ─────────────────────────────────────────────
function validateEnum(value: string, allowed: string[], name: string) {
  if (!allowed.includes(value)) throw Object.assign(new Error(`Invalid ${name}: ${value}. Allowed: ${allowed.join(', ')}`), { status: 400 });
}
function validateColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw Object.assign(new Error('Invalid hex color'), { status: 400 });
}
function validateSprintTransition(current: string, next: string) {
  const allowed: Record<string, string[]> = { preparation: ['kickoff'], kickoff: ['planning'], planning: ['implementation'], implementation: ['qa'], qa: ['refactoring', 'implementation'], refactoring: ['retro'], retro: ['review'], review: ['closed'], closed: ['rest'], rest: ['preparation'] };
  if (!allowed[current]?.includes(next)) throw Object.assign(new Error(`Cannot transition ${current} → ${next}`), { status: 400 });
}

// Read version from package.json
const PKG_VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')).version; } catch { return '2.0.0'; } })();
const TOOL_COUNT = 48; // TODO: count from MCP registry at startup

const DB_PATH = process.argv[2] ?? "./context.db";
const PORT = Number(process.argv[3] ?? 3333);
const WATCH_DIR = process.argv[4] ?? null;

const dbPath = path.resolve(DB_PATH);
const db = new Database(dbPath, { readonly: true });
db.pragma("journal_mode = WAL");

// Writable connection for the watcher to re-index and log changes
const writeDb = new Database(dbPath);
writeDb.pragma("journal_mode = WAL");
writeDb.pragma("foreign_keys = ON");

// Ensure schemas exist
initSchema(writeDb);
initScrumSchema(writeDb);
runMigrations(writeDb);
initLinearSchema(writeDb);
ensureGithubTables(writeDb);

// Soft-delete migration: add deleted_at columns if missing
for (const table of ['milestones', 'sprints', 'epics', 'tickets'] as const) {
  const cols = writeDb.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'deleted_at')) {
    writeDb.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT DEFAULT NULL`);
  }
}

// M13-038: add review_status column to tickets if missing
{
  const ticketCols = writeDb.pragma("table_info(tickets)") as Array<{ name: string }>;
  if (!ticketCols.some((c) => c.name === 'review_status')) {
    writeDb.exec("ALTER TABLE tickets ADD COLUMN review_status TEXT DEFAULT NULL CHECK(review_status IS NULL OR review_status IN ('pending','approved','rejected'))");
  }
}

// Seed factory defaults into empty tables (never overwrites existing data)
const seeded = seedDefaults(writeDb);
if (seeded.agents + seeded.skills > 0) {
  console.log(`[seed] Seeded ${seeded.agents} agents, ${seeded.skills} skills from factory defaults`);
}
// Legacy import for sprint history from .claude/ (read-only archive)
const claudeDir = path.resolve(path.dirname(dbPath), ".claude");
const scrumImport = importScrumData(writeDb, claudeDir);
if (scrumImport.sprints > 0) {
  console.log(`[scrum] Imported ${scrumImport.sprints} sprints, ${scrumImport.tickets} tickets from .claude/ archive`);
}

// Rebuild marketing stats on startup so cached values are fresh
try { rebuildMarketingStats(); } catch {}

// SSE clients
const sseClients = new Set<http.ServerResponse>();

function notifyClients(event?: { type: string; entityType?: string; entityId?: number | string; change?: any }) {
  const payload = event
    ? JSON.stringify({ ...event, timestamp: new Date().toISOString() })
    : JSON.stringify({ type: 'updated', timestamp: new Date().toISOString() });
  for (const res of sseClients) {
    res.write(`data: ${payload}\n\n`);
  }
}

// Watch for external DB changes (e.g. MCP tool writes)
// SQLite WAL mode writes to .db-wal — watch it for external mutations
let dbWalDebounce: ReturnType<typeof setTimeout> | null = null;
const walPath = dbPath + "-wal";
try {
  const fs = require("fs");
  let lastWalSize = 0;
  try { lastWalSize = fs.statSync(walPath)?.size || 0; } catch {}
  fs.watchFile(walPath, { interval: 200 }, (curr: any) => {
    if (curr.size !== lastWalSize) {
      lastWalSize = curr.size;
      if (dbWalDebounce) clearTimeout(dbWalDebounce);
      dbWalDebounce = setTimeout(() => notifyClients(), 100);
    }
  });
} catch {
  // WAL watch not available — SSE still works for dashboard-internal changes
}

// ─── File watcher ───────────────────────────────────────────────────────────
function startWatcher(dir: string) {
  const resolved = path.resolve(dir);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidar.watch(resolved, {
    ignored: [
      /node_modules/, /\.git/, /dist\//, /\.next/, /build\//,
      /coverage/, /\.turbo/, /\.cache/, /\.db/, /\.db-shm/, /\.db-wal/,
    ],
    ignoreInitial: true,
    persistent: true,
  });

  function scheduleReindex() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const stats = indexDirectory(writeDb, resolved);
        console.log(`[watch] Re-indexed: ${stats.files} files, ${stats.exports} exports, ${stats.deps} deps`);
        notifyClients();
      } catch (err: any) {
        console.error(`[watch] Re-index error: ${err.message}`);
      }
    }, 500);
  }

  watcher.on("add", scheduleReindex);
  watcher.on("change", scheduleReindex);
  watcher.on("unlink", scheduleReindex);
  console.log(`[watch] Watching ${resolved} for changes`);
}

// ─── API ─────────────────────────────────────────────────────────────────────
function apiFiles() {
  return db.prepare(`
    SELECT f.id, f.path, f.language, f.extension, f.size_bytes, f.line_count,
      f.summary, f.external_imports, f.created_at, f.modified_at, f.indexed_at,
      (SELECT COUNT(*) FROM exports WHERE file_id = f.id) as export_count,
      (SELECT COUNT(*) FROM dependencies WHERE source_id = f.id) as imports_count,
      (SELECT COUNT(*) FROM dependencies WHERE target_id = f.id) as imported_by_count
    FROM files f ORDER BY f.path
  `).all();
}

function apiFileContext(id: number) {
  const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as any;
  if (!file) return null;
  const exports = db.prepare(`SELECT name, kind, description FROM exports WHERE file_id = ?`).all(id);
  const imports = db.prepare(`
    SELECT f.id, f.path, f.summary, d.symbols
    FROM dependencies d JOIN files f ON d.target_id = f.id WHERE d.source_id = ?
  `).all(id);
  const importedBy = db.prepare(`
    SELECT f.id, f.path, f.summary, d.symbols
    FROM dependencies d JOIN files f ON d.source_id = f.id WHERE d.target_id = ?
  `).all(id);
  return { ...file, exports, imports, importedBy };
}

function apiGraph() {
  const files = db.prepare(`SELECT id, path FROM files`).all() as any[];
  const deps = db.prepare(`SELECT source_id, target_id, symbols FROM dependencies`).all() as any[];
  return {
    nodes: files.map(f => ({ id: f.id, label: f.path.split("/").slice(-2).join("/") })),
    edges: deps.map(d => ({ source: d.source_id, target: d.target_id, symbols: d.symbols })),
  };
}

function apiStats() {
  const files = (db.prepare(`SELECT COUNT(*) as c FROM files`).get() as any).c;
  const exports = (db.prepare(`SELECT COUNT(*) as c FROM exports`).get() as any).c;
  const deps = (db.prepare(`SELECT COUNT(*) as c FROM dependencies`).get() as any).c;
  const totalLines = (db.prepare(`SELECT COALESCE(SUM(line_count),0) as c FROM files`).get() as any).c;
  const totalSize = (db.prepare(`SELECT COALESCE(SUM(size_bytes),0) as c FROM files`).get() as any).c;
  const languages = db.prepare(`SELECT language, COUNT(*) as c FROM files GROUP BY language ORDER BY c DESC`).all();
  const extensions = db.prepare(`SELECT extension, COUNT(*) as c FROM files GROUP BY extension ORDER BY c DESC LIMIT 15`).all();
  return { files, exports, deps, totalLines, totalSize, languages, extensions };
}

function apiDirectories() {
  return db.prepare(`SELECT * FROM directories ORDER BY path`).all();
}

function apiChanges(limit: number) {
  return db.prepare(`
    SELECT id, file_path, event, timestamp,
      old_summary, new_summary,
      old_line_count, new_line_count,
      old_size_bytes, new_size_bytes,
      old_exports, new_exports
    FROM changes ORDER BY timestamp DESC, id DESC LIMIT ?
  `).all(limit);
}

function apiFileChanges(id: number, limit: number) {
  const file = db.prepare(`SELECT path FROM files WHERE id = ?`).get(id) as { path: string } | undefined;
  if (!file) return null;
  return db.prepare(`
    SELECT id, file_path, event, timestamp,
      old_summary, new_summary,
      old_line_count, new_line_count,
      old_size_bytes, new_size_bytes,
      old_exports, new_exports,
      diff_text, reason
    FROM changes WHERE file_path = ? ORDER BY timestamp DESC, id DESC LIMIT ?
  `).all(file.path, limit);
}

// ─── Skills & Agents API ────────────────────────────────────────────────────
function apiSkills() {
  try { return writeDb.prepare(`SELECT name, content, owner_role, updated_at FROM skills ORDER BY name`).all(); }
  catch { return []; }
}

function apiSkill(name: string) {
  try { return writeDb.prepare(`SELECT * FROM skills WHERE name = ?`).get(name); }
  catch { return null; }
}

// ─── Sprint Process Config API ──────────────────────────────────────────────
interface SprintPhase {
  name: string;
  criteria: string[];
  actions: string[];
  duration: string;
}

const DEFAULT_SPRINT_PHASES: SprintPhase[] = [
  { name: "Planning", criteria: ["Sprint goal defined", "Tickets assigned"], actions: ["Commit velocity"], duration: "1 day" },
  { name: "Implementation", criteria: ["Sprint active"], actions: ["Start tickets"], duration: "3 days" },
  { name: "QA", criteria: ["All tickets in review"], actions: ["Run test suite", "Security review"], duration: "0.5 day" },
  { name: "Retro", criteria: ["QA passed"], actions: ["Collect findings", "Archive sprint"], duration: "0.5 day" },
];

function parseSprintPhasesMarkdown(md: string): SprintPhase[] {
  const phases: SprintPhase[] = [];
  const sections = md.split(/^## /m).filter(Boolean);
  for (const section of sections) {
    const lines = section.trim().split("\n");
    const name = lines[0]?.trim() ?? "";
    if (!name) continue;
    let criteria: string[] = [];
    let actions: string[] = [];
    let duration = "";
    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      const criteriaMatch = trimmed.match(/^\*\*Entry Criteria:\*\*\s*(.+)/);
      if (criteriaMatch) {
        criteria = criteriaMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
        continue;
      }
      const actionsMatch = trimmed.match(/^\*\*Auto Actions:\*\*\s*(.+)/);
      if (actionsMatch) {
        actions = actionsMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
        continue;
      }
      const durationMatch = trimmed.match(/^\*\*Duration:\*\*\s*(.+)/);
      if (durationMatch) {
        duration = durationMatch[1].trim();
        continue;
      }
    }
    phases.push({ name, criteria, actions, duration });
  }
  return phases;
}

function serializeSprintPhasesToMarkdown(phases: SprintPhase[]): string {
  return phases.map((p) =>
    `## ${p.name}\n**Entry Criteria:** ${p.criteria.join(", ")}\n**Auto Actions:** ${p.actions.join(", ")}\n**Duration:** ${p.duration}`
  ).join("\n\n");
}

function apiGetSprintProcess(): { phases: any[] } {
  try {
    const jsonRow = writeDb.prepare(`SELECT content FROM skills WHERE name = 'SPRINT_PROCESS_JSON'`).get() as { content: string } | undefined;
    if (jsonRow?.content) {
      const parsed = JSON.parse(jsonRow.content);
      if (parsed.phases?.length > 0) return parsed;
    }
    const row = writeDb.prepare(`SELECT content FROM skills WHERE name = 'SPRINT_PHASES'`).get() as { content: string } | undefined;
    if (row?.content) {
      const phases = parseSprintPhasesMarkdown(row.content);
      if (phases.length > 0) return { phases };
    }
  } catch {}
  return { phases: DEFAULT_SPRINT_PHASES };
}

function apiPutSprintProcess(body: { phases: SprintPhase[] }): { ok: boolean } {
  if (!body.phases || !Array.isArray(body.phases) || body.phases.length === 0) {
    throw Object.assign(new Error("phases array is required"), { status: 400 });
  }
  for (const p of body.phases) {
    if (!p.name || typeof p.name !== "string") throw Object.assign(new Error("Each phase requires a name"), { status: 400 });
    if (!Array.isArray(p.criteria)) throw Object.assign(new Error("criteria must be an array"), { status: 400 });
    if (!Array.isArray(p.actions)) throw Object.assign(new Error("actions must be an array"), { status: 400 });
  }
  const md = serializeSprintPhasesToMarkdown(body.phases);
  writeDb.prepare(
    `INSERT INTO skills (name, content, owner_role) VALUES ('SPRINT_PHASES', ?, 'scrum-master') ON CONFLICT(name) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`
  ).run(md);
  return { ok: true };
}

function apiAgentsHealth() {
  try {
    const agents = writeDb.prepare(`
      SELECT a.role, a.name, a.description, a.model,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'DONE' AND deleted_at IS NULL) as done_tickets,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status IN ('TODO','IN_PROGRESS') AND deleted_at IS NULL) as active_tickets,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'BLOCKED' AND deleted_at IS NULL) as blocked_tickets,
        (SELECT COALESCE(SUM(story_points),0) FROM tickets WHERE assigned_to = a.role AND status IN ('TODO','IN_PROGRESS') AND deleted_at IS NULL) as active_points
      FROM agents a ORDER BY a.role
    `).all() as any[];
    // Compute mood: 0-100 scale from tickets + retro sentiment
    return agents.map((a: any) => {
      let mood = 50;
      if (a.done_tickets > 0) mood += Math.min(a.done_tickets * 5, 30);
      if (a.blocked_tickets > 0) mood -= a.blocked_tickets * 20;
      if (a.active_points > 8) mood -= (a.active_points - 8) * 5;
      if (a.done_tickets === 0 && a.active_tickets === 0) mood -= 15;
      // Factor in retro sentiment — recent sprints weighted higher
      try {
        const retroPositive = (writeDb.prepare(`SELECT COUNT(*) as c FROM retro_findings WHERE role = ? AND category = 'went_well'`).get(a.role) as any)?.c || 0;
        const retroNegative = (writeDb.prepare(`SELECT COUNT(*) as c FROM retro_findings WHERE role = ? AND category = 'went_wrong'`).get(a.role) as any)?.c || 0;
        mood += Math.min(retroPositive * 2, 10); // positive retros boost mood
        mood -= Math.min(retroNegative * 3, 15); // negative retros decrease mood more
      } catch {}
      mood = Math.max(0, Math.min(100, mood));
      const emoji = mood >= 80 ? '😊' : mood >= 60 ? '🙂' : mood >= 40 ? '😐' : mood >= 20 ? '😟' : '😫';
      const mood_label = mood >= 80 ? 'thriving' : mood >= 60 ? 'good' : mood >= 40 ? 'neutral' : mood >= 20 ? 'stressed' : 'burnout';
      return { ...a, mood, mood_emoji: emoji, mood_label };
    });
  } catch { return []; }
}

// ─── Scrum API (uses writeDb since it owns the scrum schema + data) ─────────
function apiSprints() {
  try {
    return writeDb.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND deleted_at IS NULL) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE' AND deleted_at IS NULL) as done_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND qa_verified = 1 AND deleted_at IS NULL) as qa_count,
        (SELECT COUNT(*) FROM retro_findings WHERE sprint_id = s.id) as retro_count,
        (SELECT COUNT(*) FROM blockers WHERE sprint_id = s.id AND status = 'open') as open_blockers
      FROM sprints s WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC
    `).all();
  } catch { return []; }
}

function apiSprintDetail(id: number) {
  try {
    const sprint = writeDb.prepare(`SELECT * FROM sprints WHERE id = ? AND deleted_at IS NULL`).get(id);
    if (!sprint) return null;
    return sprint;
  } catch { return null; }
}

function apiBurndown(sprintId: number) {
  try {
    const sprint = writeDb.prepare(`SELECT name, velocity_committed, start_date, end_date FROM sprints WHERE id = ? AND deleted_at IS NULL`).get(sprintId) as any;
    if (!sprint) return null;
    const metrics = writeDb.prepare(`SELECT date, remaining_points, completed_points, added_points, removed_points FROM sprint_metrics WHERE sprint_id = ? ORDER BY date`).all(sprintId) as any[];
    // Also compute live snapshot from current tickets if no metrics recorded yet
    const tickets = writeDb.prepare(`SELECT status, story_points FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL`).all(sprintId) as any[];
    const totalPts = tickets.reduce((s: number, t: any) => s + (t.story_points || 0), 0);
    const donePts = tickets.filter((t: any) => t.status === 'DONE').reduce((s: number, t: any) => s + (t.story_points || 0), 0);
    return {
      sprint_name: sprint.name,
      committed: sprint.velocity_committed || totalPts,
      start_date: sprint.start_date,
      end_date: sprint.end_date,
      current: { remaining: totalPts - donePts, completed: donePts, total: totalPts },
      metrics,
    };
  } catch { return { metrics: [] }; }
}

function apiSprintTickets(sprintId: number) {
  try {
    return writeDb.prepare(`
      SELECT t.id, t.ticket_ref, t.title, t.description, t.priority, t.status, t.assigned_to,
        t.story_points, t.milestone, t.milestone_id, t.epic_id, t.qa_verified, t.verified_by, t.acceptance_criteria, t.notes, t.review_status,
        m.name as milestone_name,
        e.name as epic_name
      FROM tickets t
      LEFT JOIN milestones m ON t.milestone_id = m.id
      LEFT JOIN epics e ON t.epic_id = e.id
      WHERE t.sprint_id = ? AND t.deleted_at IS NULL ORDER BY t.priority, t.status
    `).all(sprintId);
  } catch { return []; }
}

function apiSprintRetro(sprintId: number) {
  try {
    return writeDb.prepare(`
      SELECT id, role, category, finding, action_owner, action_applied
      FROM retro_findings WHERE sprint_id = ? ORDER BY category
    `).all(sprintId);
  } catch { return []; }
}

function apiSprintBlockers(sprintId: number) {
  try {
    return writeDb.prepare(`
      SELECT b.id, b.sprint_id, b.ticket_id, b.description, b.reported_by,
        b.escalated_to, b.status, b.resolved_at, b.created_at,
        t.title as ticket_title
      FROM blockers b
      LEFT JOIN tickets t ON b.ticket_id = t.id
      WHERE b.sprint_id = ? ORDER BY b.status DESC, b.created_at DESC
    `).all(sprintId);
  } catch { return []; }
}

function apiSprintBugs(sprintId: number) {
  try {
    return writeDb.prepare(`
      SELECT bg.id, bg.sprint_id, bg.ticket_id, bg.severity, bg.description,
        bg.steps_to_reproduce, bg.expected, bg.actual, bg.status, bg.created_at,
        t.title as ticket_title
      FROM bugs bg
      LEFT JOIN tickets t ON bg.ticket_id = t.id
      WHERE bg.sprint_id = ? ORDER BY
        CASE bg.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
        bg.status DESC, bg.created_at DESC
    `).all(sprintId);
  } catch { return []; }
}

function apiAllRetroFindings() {
  try {
    return writeDb.prepare(`
      SELECT rf.id, rf.role, rf.category, rf.finding, rf.action_owner, rf.action_applied,
        rf.sprint_id, s.name as sprint_name
      FROM retro_findings rf
      JOIN sprints s ON rf.sprint_id = s.id AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC, rf.category
    `).all();
  } catch { return []; }
}

function apiDiscoveries(sprintId?: number, status?: string, category?: string, excludeStatus?: string) {
  try {
    let sql = `SELECT d.*, s.name as sprint_name, t.title as ticket_title, t.status as ticket_status
      FROM discoveries d
      JOIN sprints s ON d.discovery_sprint_id = s.id
      LEFT JOIN tickets t ON d.implementation_ticket_id = t.id
      WHERE 1=1`;
    const params: any[] = [];
    if (sprintId) { sql += " AND d.discovery_sprint_id = ?"; params.push(sprintId); }
    if (status) { sql += " AND d.status = ?"; params.push(status); }
    if (excludeStatus) { sql += " AND d.status != ?"; params.push(excludeStatus); }
    if (category) { sql += " AND d.category = ?"; params.push(category); }
    sql += " ORDER BY s.created_at DESC, d.priority, d.created_at";
    return writeDb.prepare(sql).all(...params);
  } catch { return []; }
}

function apiDiscoveryCoverage(sprintId?: number) {
  try {
    let sql = `SELECT status, COUNT(*) as count FROM discoveries WHERE 1=1`;
    const params: any[] = [];
    if (sprintId) { sql += " AND discovery_sprint_id = ?"; params.push(sprintId); }
    sql += " GROUP BY status";
    const rows = writeDb.prepare(sql).all(...params) as any[];
    const total = rows.reduce((sum: number, r: any) => sum + r.count, 0);
    const counts: Record<string, number> = { discovered: 0, planned: 0, implemented: 0, dropped: 0 };
    rows.forEach((r: any) => { counts[r.status] = r.count; });
    return { total, ...counts };
  } catch { return { total: 0, discovered: 0, planned: 0, implemented: 0, dropped: 0 }; }
}

function apiDiscoverySprintList() {
  try {
    return writeDb.prepare(`
      SELECT DISTINCT s.id, s.name FROM sprints s
      JOIN discoveries d ON d.discovery_sprint_id = s.id
      ORDER BY s.created_at DESC
    `).all();
  } catch { return []; }
}

function apiSprintsGroupedByMilestone() {
  try {
    const milestones = writeDb.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND deleted_at IS NULL) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND status = 'DONE' AND deleted_at IS NULL) as done_count
      FROM milestones m WHERE m.deleted_at IS NULL
      ORDER BY CASE m.status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END, m.created_at DESC
    `).all() as any[];

    const sprintQuery = writeDb.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND deleted_at IS NULL) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE' AND deleted_at IS NULL) as done_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND qa_verified = 1 AND deleted_at IS NULL) as qa_count,
        (SELECT COUNT(*) FROM retro_findings WHERE sprint_id = s.id) as retro_count,
        (SELECT COUNT(*) FROM blockers WHERE sprint_id = s.id AND status = 'open') as open_blockers
      FROM sprints s
      WHERE s.milestone_id = ? AND s.deleted_at IS NULL
      ORDER BY CASE s.status WHEN 'implementation' THEN 0 WHEN 'planning' THEN 1 WHEN 'qa' THEN 2 WHEN 'retro' THEN 3 ELSE 4 END, s.created_at DESC
    `);

    const unassignedQuery = writeDb.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND deleted_at IS NULL) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE' AND deleted_at IS NULL) as done_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND qa_verified = 1 AND deleted_at IS NULL) as qa_count,
        (SELECT COUNT(*) FROM retro_findings WHERE sprint_id = s.id) as retro_count,
        (SELECT COUNT(*) FROM blockers WHERE sprint_id = s.id AND status = 'open') as open_blockers
      FROM sprints s
      WHERE s.milestone_id IS NULL AND s.deleted_at IS NULL
      ORDER BY CASE s.status WHEN 'implementation' THEN 0 WHEN 'planning' THEN 1 WHEN 'qa' THEN 2 WHEN 'retro' THEN 3 ELSE 4 END, s.created_at DESC
    `);

    const groups = milestones.map((m: any) => ({
      milestone: m,
      sprints: sprintQuery.all(m.id),
    }));

    const unassigned = unassignedQuery.all();
    if (unassigned.length > 0) {
      groups.push({ milestone: null, sprints: unassigned });
    }

    return groups;
  } catch { return []; }
}

// ─── Milestones, Vision, Backlog, Sprint Planning API ────────────────────────
function apiMilestones() {
  try {
    const milestones = writeDb.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND deleted_at IS NULL) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND status = 'DONE' AND deleted_at IS NULL) as done_count
      FROM milestones m WHERE m.deleted_at IS NULL ORDER BY m.id ASC
    `).all() as any[];

    const sprintQuery = writeDb.prepare(`
      SELECT DISTINCT s.id, s.name, s.status, s.velocity_committed, s.velocity_completed,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE') as done_count
      FROM sprints s INNER JOIN tickets t ON t.sprint_id = s.id AND t.milestone_id = ?
      ORDER BY s.created_at ASC
    `);

    return milestones.map((m: any) => ({
      ...m,
      sprints: sprintQuery.all(m.id),
    }));
  } catch { return []; }
}

function apiCreateMilestone(body: any) {
  const { name, description, target_date, status } = body;
  if (!name) throw new Error("name is required");
  if (status) validateEnum(status, ['planned', 'active', 'completed'], 'milestone status');
  const result = writeDb.prepare(`INSERT INTO milestones (name, description, target_date, status) VALUES (?, ?, ?, ?)`).run(name, description || null, target_date || null, status || "planned");
  return { id: result.lastInsertRowid, name };
}

function apiMilestoneUpdate(id: number, body: any) {
  const sets: string[] = []; const vals: any[] = [];
  if (body.status) { validateEnum(body.status, ['planned', 'active', 'completed'], 'milestone status'); sets.push("status=?"); vals.push(body.status); }
  if (body.description) { sets.push("description=?"); vals.push(body.description); }
  if (body.progress !== undefined) { sets.push("progress=?"); vals.push(body.progress); }
  if (body.target_date) { sets.push("target_date=?"); vals.push(body.target_date); }
  if (sets.length === 0) throw new Error("nothing to update");
  sets.push("updated_at=datetime('now')");
  vals.push(id);
  writeDb.prepare(`UPDATE milestones SET ${sets.join(",")} WHERE id=?`).run(...vals);
  return { id, updated: true };
}

function apiVisionUpdate(body: any) {
  const { content } = body;
  if (!content) throw new Error("content is required");
  writeDb.prepare(`INSERT INTO skills (name, content, owner_role) VALUES ('PRODUCT_VISION', ?, 'product-owner') ON CONFLICT(name) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`).run(content);
  return { updated: true };
}

function apiBacklog() {
  try {
    return writeDb.prepare(`
      SELECT t.id, t.ticket_ref, t.title, t.priority, t.status, t.story_points, t.assigned_to, t.milestone, t.milestone_id,
        m.name as milestone_name
      FROM tickets t
      LEFT JOIN milestones m ON t.milestone_id = m.id
      WHERE t.deleted_at IS NULL
        AND (t.sprint_id IS NULL
          OR (t.status IN ('TODO','NOT_DONE') AND t.sprint_id IN (SELECT id FROM sprints WHERE status IN ('closed','rest'))))
      ORDER BY t.priority, t.created_at
    `).all();
  } catch { return []; }
}

function apiEpics(milestoneId?: number) {
  try {
    let sql = `SELECT e.*,
      (SELECT COUNT(*) FROM tickets WHERE epic_id = e.id AND deleted_at IS NULL) as ticket_count,
      (SELECT COUNT(*) FROM tickets WHERE epic_id = e.id AND status = 'DONE' AND deleted_at IS NULL) as done_count
    FROM epics e WHERE e.deleted_at IS NULL`;
    if (milestoneId) {
      sql += ` AND e.milestone_id = ?`;
      return writeDb.prepare(sql + ' ORDER BY e.priority, e.name').all(milestoneId);
    }
    return writeDb.prepare(sql + ' ORDER BY e.priority, e.name').all();
  } catch { return []; }
}

function apiPlanSprint(body: any) {
  const name = body.name;
  const goal = body.goal;
  const ticketIds = body.ticketIds ?? body.ticket_ids;
  const velocity = body.targetVelocity ?? body.velocity_committed ?? 0;
  const startDate = body.startDate ?? body.start_date ?? null;
  const endDate = body.endDate ?? body.end_date ?? null;
  if (!name) throw new Error("name is required");
  if (!ticketIds || !Array.isArray(ticketIds)) throw new Error("ticket_ids array is required");
  const result = writeDb.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed, start_date, end_date) VALUES (?, ?, 'planning', ?, ?, ?)`).run(name, goal || null, velocity, startDate, endDate);
  const sprintId = result.lastInsertRowid;
  const updateStmt = writeDb.prepare(`UPDATE tickets SET sprint_id=?, updated_at=datetime('now') WHERE id=?`);
  for (const tid of ticketIds) {
    updateStmt.run(sprintId, tid);
  }
  return { id: sprintId, name, tickets_assigned: ticketIds.length };
}

// ─── Sprint Update API ──────────────────────────────────────────────────────
const SPRINT_PHASE_ORDER = ['preparation', 'kickoff', 'planning', 'implementation', 'qa', 'refactoring', 'retro', 'review', 'closed', 'rest'] as const;
const SPRINT_TRANSITIONS: Record<string, string> = {
  preparation: 'kickoff',
  kickoff: 'planning',
  planning: 'implementation',
  implementation: 'qa',
  qa: 'refactoring',
  refactoring: 'retro',
  retro: 'review',
  review: 'closed',
  closed: 'rest',
};

function verifyPhaseGate(sprintId: number, targetPhase: string): { canTransition: boolean; blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const sprint = writeDb.prepare("SELECT * FROM sprints WHERE id = ? AND deleted_at IS NULL").get(sprintId) as any;
  if (!sprint) return { canTransition: false, blockers: ['Sprint not found'], warnings: [] };

  if (targetPhase === 'implementation') {
    // Check: sprint has tickets assigned
    const ticketCount = (writeDb.prepare("SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL").get(sprintId) as any).c;
    if (ticketCount === 0) blockers.push('No tickets assigned to this sprint');
    // Check: velocity committed
    if (!sprint.velocity_committed) warnings.push('No velocity committed');
  }

  if (targetPhase === 'qa') {
    // Check: ALL tickets must be DONE
    const undone = (writeDb.prepare("SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND status != 'DONE' AND deleted_at IS NULL").get(sprintId) as any).c;
    if (undone > 0) blockers.push(`${undone} tickets not DONE`);
    // Check: no open blockers
    const openBlockers = (writeDb.prepare("SELECT COUNT(*) as c FROM blockers WHERE sprint_id = ? AND status = 'open'").get(sprintId) as any).c;
    if (openBlockers > 0) blockers.push(`${openBlockers} open blockers`);
  }

  if (targetPhase === 'retro') {
    // Check: all tickets qa_verified
    const unverified = (writeDb.prepare("SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND qa_verified = 0 AND status = 'DONE' AND deleted_at IS NULL").get(sprintId) as any).c;
    if (unverified > 0) warnings.push(`${unverified} tickets not QA verified`);
  }

  if (targetPhase === 'review') {
    // Check: retro findings exist
    const retroCount = (writeDb.prepare("SELECT COUNT(*) as c FROM retro_findings WHERE sprint_id = ?").get(sprintId) as any).c;
    if (retroCount === 0) blockers.push('No retro findings recorded — cannot proceed to review');
  }

  if (targetPhase === 'closed') {
    // Check: retro findings exist
    const retroCount = (writeDb.prepare("SELECT COUNT(*) as c FROM retro_findings WHERE sprint_id = ?").get(sprintId) as any).c;
    if (retroCount === 0) warnings.push('No retro findings recorded');
    // Check: velocity completed is set
    if (!sprint.velocity_completed) warnings.push('Velocity completed not set');
  }

  if (targetPhase === 'rest') {
    // No blockers for rest — just a team recovery phase
  }

  return { canTransition: blockers.length === 0, blockers, warnings };
}

function apiSprintUpdate(id: number, body: any) {
  // Read current sprint state before updating
  const current = writeDb.prepare(`SELECT * FROM sprints WHERE id = ?`).get(id) as any;
  if (!current) throw new Error("sprint not found");

  const sets: string[] = []; const vals: any[] = [];

  // Phase gate verification before transition
  if (body.status && body.status !== current.status) {
    const gate = verifyPhaseGate(id, body.status);
    if (!gate.canTransition) {
      throw Object.assign(new Error('Phase gate blocked'), { status: 409, gate });
    }
    // Store warnings for response
    if (gate.warnings.length > 0) {
      (body as any)._gate_warnings = gate.warnings;
    }
  }

  // Phase transition validation when status is changing
  if (body.status && body.status !== current.status) {
    const newStatus = body.status;
    const currentStatus = current.status;

    // Validate transition order: planning -> implementation -> qa -> retro -> closed
    validateEnum(newStatus, [...SPRINT_PHASE_ORDER], 'sprint status');
    validateEnum(currentStatus, [...SPRINT_PHASE_ORDER], 'sprint status');
    validateSprintTransition(currentStatus, newStatus);

    // When transitioning to 'qa': check all tickets are DONE
    if (newStatus === 'qa') {
      const undone = (writeDb.prepare(
        `SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND status != 'DONE' AND deleted_at IS NULL`
      ).get(id) as any).c;
      if (undone > 0) {
        throw new Error(`Cannot transition to qa: ${undone} ticket(s) are not DONE`);
      }

      // M13-038: Review sign-off warning for senior role tickets
      const unapproved = writeDb.prepare(
        `SELECT ticket_ref, title, assigned_to, review_status FROM tickets
         WHERE sprint_id = ? AND deleted_at IS NULL
           AND status = 'DONE'
           AND assigned_to IN ('architect','lead-developer','scrum-master')
           AND (review_status IS NULL OR review_status != 'approved')`
      ).all(id) as any[];
      if (unapproved.length > 0) {
        // Non-blocking warning — attach to response
        (body as any)._review_warnings = unapproved.map((t: any) =>
          `${t.ticket_ref} (${t.assigned_to}): review_status=${t.review_status ?? 'none'}`
        );
      }
    }

    // When transitioning to 'retro': auto-generate retro analysis
    if (newStatus === 'retro') {
      const totalTickets = (writeDb.prepare(
        `SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ?`
      ).get(id) as any).c;
      const doneTickets = (writeDb.prepare(
        `SELECT COUNT(*) as c FROM tickets WHERE sprint_id = ? AND status = 'DONE'`
      ).get(id) as any).c;
      const totalPoints = (writeDb.prepare(
        `SELECT COALESCE(SUM(story_points), 0) as c FROM tickets WHERE sprint_id = ?`
      ).get(id) as any).c;
      const donePoints = (writeDb.prepare(
        `SELECT COALESCE(SUM(story_points), 0) as c FROM tickets WHERE sprint_id = ? AND status = 'DONE'`
      ).get(id) as any).c;
      const committed = current.velocity_committed ?? 0;
      const completionRate = totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0;
      const velocityDelta = donePoints - committed;
      const velocityDeltaStr = velocityDelta >= 0 ? `+${velocityDelta}` : `${velocityDelta}`;

      // Blocker count for this sprint
      const blockerCount = (writeDb.prepare(
        `SELECT COUNT(*) as c FROM blockers WHERE sprint_id = ?`
      ).get(id) as any)?.c || 0;

      // Average velocity across all sprints for comparison
      const avgVelRow = writeDb.prepare(
        `SELECT AVG(velocity_completed) as avg_vel FROM sprints WHERE status IN ('closed','rest') AND velocity_completed IS NOT NULL`
      ).get() as any;
      const avgVelocity = avgVelRow?.avg_vel ? Math.round(avgVelRow.avg_vel * 10) / 10 : 0;
      const vsAvgDelta = donePoints - avgVelocity;
      const vsAvgStr = vsAvgDelta >= 0 ? `+${Math.round(vsAvgDelta * 10) / 10}` : `${Math.round(vsAvgDelta * 10) / 10}`;

      const analysis = `Auto-analysis: ${doneTickets}/${totalTickets} tickets done (${completionRate}% completion rate). ` +
        `Velocity: ${donePoints}pt completed of ${committed}pt committed (${velocityDeltaStr}pt delta). ` +
        `Blockers: ${blockerCount} total. ` +
        `vs. average velocity ${avgVelocity}pt across all sprints (${vsAvgStr}pt).`;

      writeDb.prepare(
        `INSERT INTO retro_findings (sprint_id, role, category, finding) VALUES (?, 'auto_analysis', 'auto_analysis', ?)`
      ).run(id, analysis);

      // Auto-set velocity_completed
      sets.push("velocity_completed=?"); vals.push(donePoints);
    }

    sets.push("status=?"); vals.push(newStatus);
  } else if (body.status) {
    // Status provided but same as current — no-op for status
  }

  if (body.goal !== undefined) { sets.push("goal=?"); vals.push(body.goal); }
  if (body.velocity_committed !== undefined) { sets.push("velocity_committed=?"); vals.push(body.velocity_committed); }
  if (body.velocity_completed !== undefined) { sets.push("velocity_completed=?"); vals.push(body.velocity_completed); }
  if (sets.length === 0) throw new Error("nothing to update");
  sets.push("updated_at=datetime('now')");
  vals.push(id);
  writeDb.prepare(`UPDATE sprints SET ${sets.join(",")} WHERE id=?`).run(...vals);

  // Auto-rebuild marketing stats when a sprint is closed
  if (body.status === 'closed') {
    rebuildMarketingStats();
  }

  const result: any = { id, updated: true };
  if (body._review_warnings) {
    result.review_warnings = body._review_warnings;
  }
  return result;
}

// ─── Ticket CRUD API ────────────────────────────────────────────────────────
function apiCreateTicket(body: any) {
  const { title, description, priority, sprint_id, epic_id, milestone_id, assigned_to, story_points } = body;
  if (!title) throw new Error("title is required");
  if (priority) validateEnum(priority, ['P0', 'P1', 'P2', 'P3'], 'priority');

  // Generate ticket_ref: T-<next_id>
  const maxRef = writeDb.prepare(`SELECT MAX(id) as m FROM tickets WHERE deleted_at IS NULL`).get() as any;
  const nextNum = (maxRef?.m ?? 0) + 1;
  const ticket_ref = `T-${nextNum}`;

  // Resolve milestone name if milestone_id provided
  let milestone: string | null = null;
  if (milestone_id) {
    const ms = writeDb.prepare(`SELECT name FROM milestones WHERE id = ?`).get(milestone_id) as any;
    if (ms) milestone = ms.name;
  }

  const result = writeDb.prepare(`
    INSERT INTO tickets (ticket_ref, title, description, priority, sprint_id, epic_id, milestone_id, milestone, assigned_to, story_points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ticket_ref,
    title,
    description || null,
    priority ?? 0,
    sprint_id || null,
    epic_id || null,
    milestone_id || null,
    milestone,
    assigned_to || null,
    story_points ?? 0
  );

  return { id: result.lastInsertRowid, ticket_ref, title };
}

function apiUpdateTicket(id: number, body: any) {
  const existing = writeDb.prepare(`SELECT * FROM tickets WHERE id = ?`).get(id) as any;
  if (!existing) throw new Error("ticket not found");

  const sets: string[] = []; const vals: any[] = [];
  if (body.title !== undefined) { sets.push("title=?"); vals.push(body.title); }
  if (body.description !== undefined) { sets.push("description=?"); vals.push(body.description); }
  if (body.priority !== undefined) { validateEnum(body.priority, ['P0', 'P1', 'P2', 'P3'], 'priority'); sets.push("priority=?"); vals.push(body.priority); }
  if (body.status !== undefined) { validateEnum(body.status, ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'PARTIAL', 'NOT_DONE'], 'ticket status'); sets.push("status=?"); vals.push(body.status); }
  if (body.assigned_to !== undefined) { sets.push("assigned_to=?"); vals.push(body.assigned_to); }
  if (body.story_points !== undefined) { sets.push("story_points=?"); vals.push(body.story_points); }
  if (body.qa_verified !== undefined) { sets.push("qa_verified=?"); vals.push(body.qa_verified ? 1 : 0); }
  if (body.review_status !== undefined) {
    if (body.review_status !== null) validateEnum(body.review_status, ['pending', 'approved', 'rejected'], 'review_status');
    sets.push("review_status=?"); vals.push(body.review_status);
  }
  if (body.epic_id !== undefined) { sets.push("epic_id=?"); vals.push(body.epic_id); }
  if (body.milestone_id !== undefined) {
    sets.push("milestone_id=?"); vals.push(body.milestone_id);
    // Also update milestone name
    if (body.milestone_id) {
      const ms = writeDb.prepare(`SELECT name FROM milestones WHERE id = ?`).get(body.milestone_id) as any;
      sets.push("milestone=?"); vals.push(ms?.name || null);
    } else {
      sets.push("milestone=?"); vals.push(null);
    }
  }
  if (sets.length === 0) throw new Error("nothing to update");
  sets.push("updated_at=datetime('now')");
  vals.push(id);
  writeDb.prepare(`UPDATE tickets SET ${sets.join(",")} WHERE id=?`).run(...vals);

  // Auto-promote linked discoveries when ticket moves to DONE
  if (body.status === 'DONE') {
    try {
      writeDb.prepare(`
        UPDATE discoveries SET status = 'implemented', updated_at = datetime('now')
        WHERE status = 'planned' AND implementation_ticket_id = ?
      `).run(id);
    } catch {}
  }

  return { id, updated: true };
}

function rebuildMarketingStats() {
  try {
    const closedSprints = (writeDb.prepare("SELECT COUNT(*) as c FROM sprints WHERE status IN ('closed','rest') AND deleted_at IS NULL").get() as any).c;
    const doneTickets = (writeDb.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = 'DONE' AND deleted_at IS NULL").get() as any).c;
    const totalVelocity = (writeDb.prepare("SELECT COALESCE(SUM(velocity_completed), 0) as c FROM sprints WHERE status IN ('closed','rest') AND deleted_at IS NULL").get() as any).c;
    const agentCount = (writeDb.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c;
    const milestoneCount = (writeDb.prepare("SELECT COUNT(*) as c FROM milestones").get() as any).c;
    const toolCount = TOOL_COUNT;

    // Enhanced stats: velocity trend for last 10 closed sprints
    const velocityTrendRows = writeDb.prepare(
      `SELECT name, velocity_completed FROM sprints WHERE status IN ('closed','rest') ORDER BY created_at DESC LIMIT 10`
    ).all() as any[];
    const velocity_trend = velocityTrendRows.reverse().map((r: any) => ({
      sprint_name: r.name,
      velocity: r.velocity_completed ?? 0,
    }));

    // Enhanced stats: avg completion rate across closed sprints
    const completionRows = writeDb.prepare(`
      SELECT s.id,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE') as done_c,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id) as total_c
      FROM sprints s WHERE s.status IN ('closed','rest')
    `).all() as any[];
    const completionRates = completionRows
      .filter((r: any) => r.total_c > 0)
      .map((r: any) => (r.done_c / r.total_c) * 100);
    const avg_completion_rate = completionRates.length > 0
      ? Math.round(completionRates.reduce((a: number, b: number) => a + b, 0) / completionRates.length * 10) / 10
      : 0;

    // Enhanced stats: peak and average velocity
    const velocityRows = writeDb.prepare(
      `SELECT velocity_completed FROM sprints WHERE status IN ('closed','rest') AND velocity_completed IS NOT NULL`
    ).all() as any[];
    const velocities = velocityRows.map((r: any) => r.velocity_completed ?? 0);
    const peak_velocity = velocities.length > 0 ? Math.max(...velocities) : 0;
    const avg_velocity = velocities.length > 0
      ? Math.round(velocities.reduce((a: number, b: number) => a + b, 0) / velocities.length * 10) / 10
      : 0;

    const stats = JSON.stringify({
      closed_sprints: closedSprints,
      done_tickets: doneTickets,
      total_velocity: totalVelocity,
      agent_count: agentCount,
      milestone_count: milestoneCount,
      tool_count: toolCount,
      velocity_trend,
      avg_completion_rate,
      peak_velocity,
      avg_velocity,
      version: PKG_VERSION,
      updated_at: new Date().toISOString(),
    });

    writeDb.prepare(
      `INSERT INTO skills (name, content, owner_role) VALUES ('MARKETING_STATS', ?, 'scrum-master')
       ON CONFLICT(name) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`
    ).run(stats);

    console.log(`[marketing] Rebuilt marketing stats: ${closedSprints} sprints, ${doneTickets} tickets, ${totalVelocity}pt`);
  } catch (err: any) {
    console.error(`[marketing] Failed to rebuild stats: ${err.message}`);
  }
}

// ─── Dump / Restore / Project Status API ────────────────────────────────────
function apiDump() {
  const allTables = [
    "agents", "sprints", "tickets", "subtasks", "retro_findings",
    "blockers", "bugs", "skills", "processes", "milestones", "epics",
    "files", "exports", "dependencies", "directories", "changes"
  ];
  const dump: Record<string, any[]> = {};
  for (const table of allTables) {
    try { dump[table] = writeDb.prepare(`SELECT * FROM ${table}`).all(); } catch {}
  }
  return { version: PKG_VERSION, exported_at: new Date().toISOString(), tables: dump };
}

async function apiRestore(body: any) {
  if (!body.version || !body.tables) return { error: "Invalid dump format" };

  const order = [
    "milestones", "epics", "agents", "skills", "processes",
    "sprints", "tickets", "subtasks",
    "retro_findings", "blockers", "bugs",
    "files", "exports", "dependencies", "directories", "changes"
  ];

  const results: Record<string, number> = {};
  const transaction = writeDb.transaction(() => {
    for (const table of order) {
      const rows = body.tables[table];
      if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
      const cols = Object.keys(rows[0]);
      const stmt = writeDb.prepare(
        `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`
      );
      let count = 0;
      for (const row of rows) { stmt.run(...cols.map((c: string) => row[c] ?? null)); count++; }
      results[table] = count;
    }
  });
  transaction();

  return { ok: true, restored: results };
}

function apiProjectStatus() {
  const fileCount = (writeDb.prepare("SELECT COUNT(*) as c FROM files").get() as any).c;
  const agentCount = (writeDb.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c;
  const sprintCount = (writeDb.prepare("SELECT COUNT(*) as c FROM sprints").get() as any).c;
  const ticketCount = (writeDb.prepare("SELECT COUNT(*) as c FROM tickets").get() as any).c;
  const skillCount = (writeDb.prepare("SELECT COUNT(*) as c FROM skills").get() as any).c;
  const milestoneCount = (writeDb.prepare("SELECT COUNT(*) as c FROM milestones").get() as any).c;

  // Read cached marketing stats for tool count + version
  let toolCount = TOOL_COUNT;
  let version = PKG_VERSION;
  try {
    const mktg = writeDb.prepare("SELECT content FROM skills WHERE name = 'MARKETING_STATS'").get() as any;
    if (mktg?.content) {
      const parsed = JSON.parse(mktg.content);
      if (parsed.tool_count) toolCount = parsed.tool_count;
      if (parsed.version) version = parsed.version;
    }
  } catch {}

  return {
    initialized: fileCount > 0,
    files: fileCount,
    agents: agentCount,
    sprints: sprintCount,
    tickets: ticketCount,
    skills: skillCount,
    milestones: milestoneCount,
    toolCount,
    version,
  };
}

// ─── Linear Proxy API ──────────────────────────────────────────────────────
function apiLinearIssues(project?: string | null, state?: string | null) {
  const issues = getLinearIssuesNormalized(writeDb, project, state);
  const columns = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'];
  const syncStatus = getLinearNormalizedSyncStatus(writeDb);
  return { issues, columns, cachedAt: syncStatus.syncedAt, canSync: true };
}

function apiLinearStates() {
  const states = getLinearStatesNormalized(writeDb);
  const columns = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'];
  return { states, availableColumns: columns };
}

function apiLinearMoveIssue(issueId: string, kanbanColumn: string) {
  if (!issueId || issueId.length > 100 || typeof kanbanColumn !== 'string') throw Object.assign(new Error('Invalid parameters'), { status: 400 });
  const result = moveLinearIssue(writeDb, issueId, kanbanColumn);
  // Log to event_log for Claude reactivity
  try {
    writeDb.prepare(`INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES ('ticket', 0, 'status_changed', 'linear_status', ?, ?, 'dashboard-ui')`).run(result.previousState, result.newState);
  } catch {}
  return result;
}

function apiLinearSyncStatus() {
  return getLinearNormalizedSyncStatus(writeDb);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

// ─── Server ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // SSE endpoint for live updates
  if (url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    res.write(`data: connected\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    try {
      let data: any;
      if (url.pathname === "/api/files") data = apiFiles();
      else if (url.pathname === "/api/directories") data = apiDirectories();
      else if (url.pathname === "/api/stats") data = apiStats();
      else if (url.pathname === "/api/graph") data = apiGraph();
      else if (url.pathname === "/api/changes") data = apiChanges(Number(url.searchParams.get("limit") ?? 100));
      else if (url.pathname === "/api/skills") data = apiSkills();
      else if (url.pathname.startsWith("/api/skill/")) {
        const skillName = decodeURIComponent(url.pathname.slice("/api/skill/".length));
        data = apiSkill(skillName);
        if (!data) { res.writeHead(404); res.end('{"error":"skill not found"}'); return; }
      }
      else if (url.pathname === "/api/agents" && req.method === "POST") {
        const body = await readBody(req);
        if (!body.role || !body.name) { res.writeHead(400); res.end('{"error":"role and name are required"}'); return; }
        if (body.model) validateEnum(body.model, ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'], 'model');
        const existing = writeDb.prepare("SELECT role FROM agents WHERE role = ?").get(body.role);
        if (existing) { res.writeHead(409); res.end('{"error":"agent with this role already exists"}'); return; }
        writeDb.prepare("INSERT INTO agents (role, name, description, model) VALUES (?, ?, ?, ?)").run(
          body.role, body.name, body.description || null, body.model || 'claude-sonnet-4-6'
        );
        data = { role: body.role, name: body.name, description: body.description || null, model: body.model || 'claude-sonnet-4-6' };
        notifyClients();
      }
      else if (url.pathname.match(/^\/api\/agent\/[^/]+$/) && req.method === "PUT") {
        const role = decodeURIComponent(url.pathname.split("/").slice(3).join("/"));
        const body = await readBody(req);
        if (body.model) validateEnum(body.model, ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'], 'model');
        const existing = writeDb.prepare("SELECT role FROM agents WHERE role = ?").get(role);
        if (!existing) { res.writeHead(404); res.end('{"error":"agent not found"}'); return; }
        const sets: string[] = []; const vals: any[] = [];
        if (body.name !== undefined) { sets.push("name=?"); vals.push(body.name); }
        if (body.description !== undefined) { sets.push("description=?"); vals.push(body.description); }
        if (body.model !== undefined) { sets.push("model=?"); vals.push(body.model); }
        if (sets.length === 0) { res.writeHead(400); res.end('{"error":"nothing to update"}'); return; }
        sets.push("updated_at=datetime('now')");
        vals.push(role);
        writeDb.prepare(`UPDATE agents SET ${sets.join(",")} WHERE role=?`).run(...vals);
        const updated = writeDb.prepare("SELECT role, name, description, model FROM agents WHERE role = ?").get(role);
        data = updated;
        notifyClients();
      }
      else if (url.pathname.match(/^\/api\/agent\/[^/]+$/) && req.method === "DELETE") {
        const role = decodeURIComponent(url.pathname.split("/").slice(3).join("/"));
        const existing = writeDb.prepare("SELECT role FROM agents WHERE role = ?").get(role);
        if (!existing) { res.writeHead(404); res.end('{"error":"agent not found"}'); return; }
        writeDb.prepare("DELETE FROM agents WHERE role = ?").run(role);
        data = { ok: true };
        notifyClients();
      }
      else if (url.pathname === "/api/agents") data = apiAgentsHealth();
      else if (url.pathname === "/api/milestones" && req.method === "POST") {
        const body = await readBody(req);
        data = apiCreateMilestone(body);
        notifyClients();
      }
      else if (url.pathname === "/api/milestones") data = apiMilestones();
      else if (url.pathname.match(/^\/api\/milestone\/\d+$/) && req.method === "PUT") {
        const mid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        data = apiMilestoneUpdate(mid, body);
        notifyClients();
      }
      else if (url.pathname === "/api/vision" && req.method === "PUT") {
        const body = await readBody(req);
        data = apiVisionUpdate(body);
        notifyClients();
      }
      else if (url.pathname === "/api/activity") {
        try {
          data = writeDb.prepare(`SELECT * FROM event_log ORDER BY created_at DESC LIMIT 50`).all();
        } catch { data = []; }
      }
      else if (url.pathname === "/api/backlog") data = apiBacklog();
      else if (url.pathname === "/api/sprints/plan" && req.method === "POST") {
        const body = await readBody(req);
        data = apiPlanSprint(body);
        notifyClients();
      }
      else if (url.pathname === "/api/retro/all") data = apiAllRetroFindings();
      else if (url.pathname === "/api/discoveries/coverage") {
        const sid = url.searchParams.get("sprint_id");
        data = apiDiscoveryCoverage(sid ? Number(sid) : undefined);
      }
      else if (url.pathname === "/api/discoveries/sprints") data = apiDiscoverySprintList();
      else if (url.pathname === "/api/discoveries") {
        const sid = url.searchParams.get("sprint_id");
        const st = url.searchParams.get("status");
        const cat = url.searchParams.get("category");
        const excl = url.searchParams.get("exclude_status");
        data = apiDiscoveries(sid ? Number(sid) : undefined, st || undefined, cat || undefined, excl || undefined);
      }
      else if (url.pathname.match(/^\/api\/discovery\/\d+\/link$/) && req.method === "POST") {
        const did = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        const discovery = writeDb.prepare("SELECT * FROM discoveries WHERE id = ?").get(did) as any;
        if (!discovery) { res.writeHead(404); res.end('{"error":"discovery not found"}'); return; }
        const ticket = writeDb.prepare("SELECT id, title, status FROM tickets WHERE id = ?").get(body.ticket_id) as any;
        if (!ticket) { res.writeHead(404); res.end('{"error":"ticket not found"}'); return; }
        const newStatus = ticket.status === "DONE" ? "implemented" : "planned";
        writeDb.prepare("UPDATE discoveries SET implementation_ticket_id = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(body.ticket_id, newStatus, did);
        data = { ...discovery, implementation_ticket_id: body.ticket_id, status: newStatus, ticket_title: ticket.title };
        notifyClients();
      }
      else if (url.pathname.match(/^\/api\/discovery\/\d+$/) && req.method === "PATCH") {
        const did = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        const existing = writeDb.prepare("SELECT * FROM discoveries WHERE id = ?").get(did) as any;
        if (!existing) { res.writeHead(404); res.end('{"error":"discovery not found"}'); return; }
        const sets: string[] = [];
        const vals: any[] = [];
        if (body.status) { sets.push("status = ?"); vals.push(body.status); }
        if (body.priority) { sets.push("priority = ?"); vals.push(body.priority); }
        if (body.drop_reason) { sets.push("drop_reason = ?"); vals.push(body.drop_reason); }
        sets.push("updated_at = datetime('now')");
        vals.push(did);
        writeDb.prepare(`UPDATE discoveries SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
        data = writeDb.prepare("SELECT * FROM discoveries WHERE id = ?").get(did);
        notifyClients();
      }
      else if (url.pathname === "/api/sprints/grouped") data = apiSprintsGroupedByMilestone();
      else if (url.pathname === "/api/sprints") data = apiSprints();
      else if (url.pathname.match(/^\/api\/sprint\/\d+\/stuck$/) && req.method === "POST") {
        const sid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        const sprint = writeDb.prepare(`SELECT name, status FROM sprints WHERE id = ? AND deleted_at IS NULL`).get(sid) as any;
        if (!sprint) { res.writeHead(404); res.end('{"error":"sprint not found"}'); return; }
        // Create a blocker entry so Claude/MCP can pick it up
        writeDb.prepare(`INSERT INTO blockers (sprint_id, description, reported_by, status) VALUES (?, ?, ?, 'open')`).run(
          sid,
          `Sprint stuck in ${body.phase || sprint.status} phase for 10+ minutes. Requires intervention.`,
          'dashboard-ui'
        );
        notifyClients();
        data = { ok: true, message: `Blocker created: sprint ${sprint.name} stuck in ${sprint.status}` };
      }
      else if (url.pathname.match(/^\/api\/sprint\/\d+\/burndown$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiBurndown(sid);
      } else if (url.pathname.match(/^\/api\/sprint\/\d+\/blockers$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiSprintBlockers(sid);
      } else if (url.pathname.match(/^\/api\/sprint\/\d+\/bugs$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiSprintBugs(sid);
      } else if (url.pathname.match(/^\/api\/sprint\/\d+\/tickets$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiSprintTickets(sid);
      } else if (url.pathname.match(/^\/api\/sprint\/\d+\/retro$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiSprintRetro(sid);
      } else if (url.pathname.match(/^\/api\/sprint\/\d+$/) && req.method === "PUT") {
        const sid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        data = apiSprintUpdate(sid, body);
        notifyClients();
      } else if (url.pathname.match(/^\/api\/sprint\/\d+$/) && req.method === "DELETE") {
        const sid = Number(url.pathname.split("/")[3]);
        const existing = writeDb.prepare("SELECT id FROM sprints WHERE id = ? AND deleted_at IS NULL").get(sid);
        if (!existing) { res.writeHead(404); res.end('{"error":"sprint not found"}'); return; }
        writeDb.prepare("UPDATE tickets SET deleted_at = datetime('now') WHERE sprint_id = ?").run(sid);
        writeDb.prepare("UPDATE sprints SET deleted_at = datetime('now') WHERE id = ?").run(sid);
        data = { ok: true };
        notifyClients();
      } else if (url.pathname.match(/^\/api\/sprint\/\d+$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiSprintDetail(sid);
        if (!data) { res.writeHead(404); res.end('{"error":"sprint not found"}'); return; }
      }
      else if (url.pathname.match(/^\/api\/ticket\/\d+\/milestone$/) && req.method === "PATCH") {
        const tid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        const milestoneId = body.milestone_id;
        if (milestoneId === null || milestoneId === undefined) {
          writeDb.prepare("UPDATE tickets SET milestone = NULL, milestone_id = NULL WHERE id = ?").run(tid);
        } else {
          const milestone = writeDb.prepare("SELECT name FROM milestones WHERE id = ?").get(milestoneId) as any;
          if (!milestone) { res.writeHead(404); res.end('{"error":"milestone not found"}'); return; }
          writeDb.prepare("UPDATE tickets SET milestone = ?, milestone_id = ? WHERE id = ?").run(milestone.name, milestoneId, tid);
        }
        data = { ok: true };
        notifyClients();
      }
      else if (url.pathname === "/api/epics" && req.method === "POST") {
        const body = await readBody(req);
        if (!body.name) { res.writeHead(400); res.end('{"error":"name is required"}'); return; }
        if (body.status) validateEnum(body.status, ['planned', 'active', 'completed'], 'epic status');
        if (body.color) validateColor(body.color);
        const result = writeDb.prepare(`INSERT INTO epics (name, description, milestone_id, priority, status) VALUES (?, ?, ?, ?, ?)`).run(
          body.name, body.description || null, body.milestone_id || null, body.priority ?? 0, body.status || 'planned'
        );
        data = { id: result.lastInsertRowid, name: body.name };
        notifyClients();
      }
      else if (url.pathname === "/api/epics") {
        const mid = url.searchParams.get("milestone_id");
        data = apiEpics(mid ? Number(mid) : undefined);
      }
      else if (url.pathname.match(/^\/api\/epic\/\d+$/) && req.method === "PUT") {
        const eid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        if (body.status) validateEnum(body.status, ['planned', 'active', 'completed'], 'epic status');
        if (body.color) validateColor(body.color);
        const sets: string[] = []; const vals: any[] = [];
        if (body.name) { sets.push("name=?"); vals.push(body.name); }
        if (body.description !== undefined) { sets.push("description=?"); vals.push(body.description); }
        if (body.milestone_id !== undefined) { sets.push("milestone_id=?"); vals.push(body.milestone_id); }
        if (body.priority) { sets.push("priority=?"); vals.push(body.priority); }
        if (body.status) { sets.push("status=?"); vals.push(body.status); }
        if (sets.length === 0) { res.writeHead(400); res.end('{"error":"nothing to update"}'); return; }
        sets.push("updated_at=datetime('now')");
        vals.push(eid);
        writeDb.prepare(`UPDATE epics SET ${sets.join(",")} WHERE id=?`).run(...vals);
        data = { id: eid, updated: true };
        notifyClients();
      }
      else if (url.pathname.match(/^\/api\/sprint\/\d+\/milestone$/) && req.method === "PATCH") {
        const sid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        writeDb.prepare("UPDATE sprints SET milestone_id=?, updated_at=datetime('now') WHERE id=?").run(body.milestone_id ?? null, sid);
        data = { ok: true };
        notifyClients();
      }
      else if (url.pathname.match(/^\/api\/ticket\/\d+\/epic$/) && req.method === "PATCH") {
        const tid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        writeDb.prepare("UPDATE tickets SET epic_id=?, updated_at=datetime('now') WHERE id=?").run(body.epic_id ?? null, tid);
        data = { ok: true };
        notifyClients();
      }
      // ── Ticket CRUD endpoints ──────────────────────────────────────────
      else if (url.pathname === "/api/tickets" && req.method === "POST") {
        const body = await readBody(req);
        data = apiCreateTicket(body);
        notifyClients();
      }
      else if (url.pathname.match(/^\/api\/ticket\/\d+$/) && req.method === "PUT") {
        const tid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        data = apiUpdateTicket(tid, body);
        notifyClients();
      }
      // ── DELETE endpoints ─────────────────────────────────────────────
      else if (url.pathname.match(/^\/api\/milestone\/\d+$/) && req.method === "DELETE") {
        const mid = Number(url.pathname.split("/")[3]);
        const existing = writeDb.prepare("SELECT id FROM milestones WHERE id = ? AND deleted_at IS NULL").get(mid);
        if (!existing) { res.writeHead(404); res.end('{"error":"milestone not found"}'); return; }
        writeDb.prepare("UPDATE milestones SET deleted_at = datetime('now') WHERE id = ?").run(mid);
        data = { ok: true };
        notifyClients();
      }
      else if (url.pathname.match(/^\/api\/epic\/\d+$/) && req.method === "DELETE") {
        const eid = Number(url.pathname.split("/")[3]);
        const existing = writeDb.prepare("SELECT id FROM epics WHERE id = ? AND deleted_at IS NULL").get(eid);
        if (!existing) { res.writeHead(404); res.end('{"error":"epic not found"}'); return; }
        writeDb.prepare("UPDATE epics SET deleted_at = datetime('now') WHERE id = ?").run(eid);
        data = { ok: true };
        notifyClients();
      }
      else if (url.pathname === "/api/trash") {
        const milestones = writeDb.prepare("SELECT * FROM milestones WHERE deleted_at IS NOT NULL").all();
        const sprints = writeDb.prepare("SELECT * FROM sprints WHERE deleted_at IS NOT NULL").all();
        const epics = writeDb.prepare("SELECT * FROM epics WHERE deleted_at IS NOT NULL").all();
        const tickets = writeDb.prepare("SELECT * FROM tickets WHERE deleted_at IS NOT NULL").all();
        data = { milestones, sprints, epics, tickets };
      }
      else if (url.pathname === "/api/dump") data = apiDump();
      else if (url.pathname === "/api/restore" && req.method === "POST") {
        const body = await readBody(req);
        data = await apiRestore(body);
        notifyClients();
      }
      else if (url.pathname === "/api/project/status") data = apiProjectStatus();
      else if (url.pathname.match(/^\/api\/file\/\d+\/changes$/)) {
        const id = Number(url.pathname.split("/")[3]);
        data = apiFileChanges(id, Number(url.searchParams.get("limit") ?? 50));
        if (!data) { res.writeHead(404); res.end('{"error":"not found"}'); return; }
      } else if (url.pathname.startsWith("/api/file/")) {
        const id = Number(url.pathname.split("/")[3]);
        data = apiFileContext(id);
        if (!data) { res.writeHead(404); res.end('{"error":"not found"}'); return; }
      }
      // ── Linear / Me tab endpoints ──────────────────────────────────────
      else if (url.pathname === "/api/me/configured") {
        const syncStatus = getLinearSyncStatus(writeDb);
        data = { configured: isLinearConfigured(), ...syncStatus };
      } else if (url.pathname === "/api/me/user") {
        data = getLinearUser(writeDb);
      } else if (url.pathname === "/api/me/issues") {
        data = getLinearIssues(writeDb);
      } else if (url.pathname === "/api/me/cycles") {
        data = getLinearCycles(writeDb);
      } else if (url.pathname === "/api/me/projects") {
        data = getLinearProjects(writeDb);
      } else if (url.pathname === "/api/me/sync" && req.method === "POST") {
        // Only accept sync from localhost
        const remoteAddr = req.socket.remoteAddress ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal) { res.writeHead(403); res.end('{"error":"sync only allowed from localhost"}'); return; }
        const body = await readBody(req);
        data = syncLinearData(writeDb, body);
        // Also populate normalized tables
        try { syncLinearNormalized(writeDb, body); } catch {}
        notifyClients();
      }
      // ── Linear Proxy API (normalized) ─────────────────────────────────
      else if (url.pathname === "/api/linear/issues") {
        const project = url.searchParams.get("project");
        const state = url.searchParams.get("state");
        data = apiLinearIssues(project, state);
      }
      else if (url.pathname === "/api/linear/states") {
        data = apiLinearStates();
      }
      else if (url.pathname.match(/^\/api\/linear\/issue\/[^/]+\/status$/) && req.method === "PATCH") {
        const issueId = url.pathname.split("/")[4];
        const remoteAddr = req.socket.remoteAddress ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal) { res.writeHead(403); res.end('{"error":"write only from localhost"}'); return; }
        const body = await readBody(req);
        data = apiLinearMoveIssue(issueId, body.kanbanColumn);
        notifyClients();
      }
      else if (url.pathname === "/api/linear/sync" && req.method === "POST") {
        const remoteAddr = req.socket.remoteAddress ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal) { res.writeHead(403); res.end('{"error":"sync only from localhost"}'); return; }
        const body = await readBody(req);
        try { syncLinearNormalized(writeDb, body); } catch {}
        data = syncLinearData(writeDb, body);
        notifyClients();
      }
      else if (url.pathname === "/api/linear/sync/status") {
        data = apiLinearSyncStatus();
      }
      else if (url.pathname === "/api/linear/sync/trigger" && req.method === "POST") {
        const remoteAddr = req.socket.remoteAddress ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal) { res.writeHead(403); res.end('{"error":"trigger only from localhost"}'); return; }
        const result = await fetchAndSyncLinear(writeDb);
        if (result.ok) notifyClients();
        data = result;
      }
      // ── GitHub API ────────────────────────────────────────────────────
      else if (url.pathname === "/api/github/configured") {
        data = { configured: isGithubConfigured(), ...getGithubSyncStatus(writeDb) };
      }
      else if (url.pathname === "/api/github/repos") {
        data = getGithubRepos(writeDb);
      }
      else if (url.pathname === "/api/github/issues") {
        const repoId = url.searchParams.get("repo_id");
        data = getGithubIssues(writeDb, repoId ? Number(repoId) : undefined);
      }
      else if (url.pathname === "/api/github/prs") {
        const repoId = url.searchParams.get("repo_id");
        data = getGithubPRs(writeDb, repoId ? Number(repoId) : undefined);
      }
      else if (url.pathname === "/api/github/commits") {
        const repoId = url.searchParams.get("repo_id");
        data = getGithubCommits(writeDb, repoId ? Number(repoId) : undefined);
      }
      else if (url.pathname === "/api/github/sync/status") {
        data = getGithubSyncStatus(writeDb);
      }
      else if (url.pathname === "/api/github/sync" && req.method === "POST") {
        const remoteAddr = req.socket.remoteAddress ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal) { res.writeHead(403); res.end('{"error":"sync only allowed from localhost"}'); return; }
        const body = await readBody(req);
        data = syncGithubData(writeDb, body);
        notifyClients();
      }
      else if (url.pathname === "/api/github/sync/trigger" && req.method === "POST") {
        const remoteAddr = req.socket.remoteAddress ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal) { res.writeHead(403); res.end('{"error":"trigger only from localhost"}'); return; }
        const config = loadGithubConfig(dbPath);
        if (!config) { res.writeHead(400); res.end('{"error":"No .github.local.json config found"}'); return; }
        const result = await fetchAndSyncGithub(writeDb, config.owner, config.repo, config.token);
        if (result.ok) notifyClients();
        data = result;
      }
      else if (url.pathname === "/api/github/config") {
        const config = loadGithubConfig(dbPath);
        data = { configured: isGithubConfigured(), config: config ? { owner: config.owner, repo: config.repo, autoSync: config.autoSync, syncIntervalMinutes: config.syncIntervalMinutes } : null };
      }
      // ── Bridge API (pending_actions) ──────────────────────────────────
      else if (url.pathname === "/api/bridge/actions" && req.method === "GET") {
        const status = url.searchParams.get("status") ?? "pending";
        data = writeDb.prepare(
          "SELECT * FROM pending_actions WHERE status = ? ORDER BY created_at DESC LIMIT 50"
        ).all(status);
      }
      else if (url.pathname === "/api/bridge/actions" && req.method === "POST") {
        const remoteAddr = req.socket.remoteAddress ?? "";
        const isLocal = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";
        if (!isLocal) { res.writeHead(403); res.end('{"error":"bridge actions only from localhost"}'); return; }
        const body = await readBody(req);
        if (!body.action) { res.writeHead(400); res.end('{"error":"action is required"}'); return; }
        const ALLOWED_ACTIONS = ['advance_sprint', 'assign_ticket', 'update_ticket', 'create_ticket', 'run_retro', 'plan_sprint', 'sync_github', 'sync_linear', 'custom'];
        if (!ALLOWED_ACTIONS.includes(body.action)) { res.writeHead(400); res.end(`{"error":"unknown action. Allowed: ${ALLOWED_ACTIONS.join(', ')}"}`); return; }
        const stmt = writeDb.prepare(
          `INSERT INTO pending_actions (action, entity_type, entity_id, payload, source)
           VALUES (?, ?, ?, ?, ?)`
        );
        const result = stmt.run(
          body.action,
          body.entity_type ?? null,
          body.entity_id ?? null,
          body.payload ? JSON.stringify(body.payload) : null,
          body.source ?? "dashboard"
        );
        data = { ok: true, id: result.lastInsertRowid };
        notifyClients({ type: "bridge_action", entityType: "pending_action", entityId: Number(result.lastInsertRowid), change: { action: body.action } });
      }
      else if (url.pathname === "/api/bridge/status") {
        const pending = (writeDb.prepare("SELECT COUNT(*) as c FROM pending_actions WHERE status = 'pending'").get() as any).c;
        const claimed = (writeDb.prepare("SELECT COUNT(*) as c FROM pending_actions WHERE status = 'claimed'").get() as any).c;
        const completed = (writeDb.prepare("SELECT COUNT(*) as c FROM pending_actions WHERE status = 'completed'").get() as any).c;
        const failed = (writeDb.prepare("SELECT COUNT(*) as c FROM pending_actions WHERE status = 'failed'").get() as any).c;
        data = { pending, claimed, completed, failed };
      }
      else if (url.pathname === "/api/sprint-process/markdown") {
        // Auto-generate sprint process as markdown from DB config
        const processRow = writeDb.prepare("SELECT content FROM skills WHERE name = 'SPRINT_PROCESS_JSON'").get() as any;
        if (processRow?.content) {
          try {
            const config = JSON.parse(processRow.content);
            const lines = ["# Sprint Process (Auto-Generated from DB)\n"];
            for (const phase of config.phases || []) {
              lines.push(`## ${phase.name} (${phase.duration || "TBD"})`);
              if (phase.ceremonies?.length) lines.push(`**Ceremonies:** ${phase.ceremonies.join(", ")}`);
              if (phase.criteria?.length) { lines.push("**Gate Criteria:**"); phase.criteria.forEach((c: string) => lines.push(`- ${c}`)); }
              lines.push("");
            }
            data = { markdown: lines.join("\n") };
          } catch { data = { markdown: "Error parsing sprint process config" }; }
        } else { data = { markdown: "No sprint process config found. Use reset_sprint_process MCP tool." }; }
      }
      else if (url.pathname.match(/^\/api\/sprint\/\d+\/gates$/)) {
        // Gate status for a sprint — used by dashboard UI
        const sid = Number(url.pathname.split("/")[3]);
        const sprint = writeDb.prepare("SELECT * FROM sprints WHERE id = ? AND deleted_at IS NULL").get(sid) as any;
        if (!sprint) { res.writeHead(404); res.end('{"error":"sprint not found"}'); return; }
        const tickets = writeDb.prepare("SELECT * FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL").all(sid) as any[];
        const retroCount = (writeDb.prepare("SELECT COUNT(*) as c FROM retro_findings WHERE sprint_id = ?").get(sid) as any).c;

        const TRANSITIONS: Record<string, string> = { preparation: "kickoff", kickoff: "planning", planning: "implementation", implementation: "qa", qa: "retro", refactoring: "retro", retro: "review", review: "closed", closed: "rest" };
        const nextPhase = TRANSITIONS[sprint.status] || null;
        const gates: { gate: string; passed: boolean; detail: string }[] = [];

        if (nextPhase === "implementation") {
          gates.push({ gate: "tickets_assigned", passed: tickets.length > 0, detail: `${tickets.length} tickets` });
        }
        if (nextPhase === "qa" || sprint.status === "implementation") {
          const undone = tickets.filter((t: any) => !["DONE", "BLOCKED", "NOT_DONE"].includes(t.status));
          gates.push({ gate: "all_tickets_done", passed: undone.length === 0, detail: `${undone.length} undone` });
        }
        if (nextPhase === "closed" || sprint.status === "review") {
          const noQA = tickets.filter((t: any) => t.status === "DONE" && !t.qa_verified);
          gates.push({ gate: "qa_verified", passed: noQA.length === 0, detail: `${noQA.length} unverified` });
          gates.push({ gate: "velocity_set", passed: !!sprint.velocity_completed, detail: sprint.velocity_completed ? `${sprint.velocity_completed}pt` : "not set" });
        }
        if (nextPhase === "rest" || sprint.status === "closed") {
          gates.push({ gate: "retro_findings", passed: retroCount > 0, detail: `${retroCount} findings` });
        }

        data = { sprint_id: sid, phase: sprint.status, next_phase: nextPhase, gates, all_passed: gates.every(g => g.passed) };
      }
      else if (url.pathname === "/api/sprint-process" && req.method === "GET") {
        data = apiGetSprintProcess();
      } else if (url.pathname === "/api/sprint-process" && req.method === "PUT") {
        const body = await readBody(req);
        data = apiPutSprintProcess(body);
      } else if (url.pathname.match(/^\/api\/sprint\/\d+\/gate\/[a-z]+$/) && req.method === "GET") {
        const parts = url.pathname.split("/");
        const sid = Number(parts[3]);
        const phase = parts[5];
        data = verifyPhaseGate(sid, phase);
      } else { res.writeHead(404); res.end('{"error":"unknown endpoint"}'); return; }
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (e: any) {
      const payload: any = { error: e.message };
      if (e.gate) payload.gate = e.gate;
      res.writeHead(e.status ?? 500);
      res.end(JSON.stringify(payload));
    }
    return;
  }

  // Serve static assets from Vite build output
  const distDir = path.join(__dirname, "../../dist/dashboard");
  if (url.pathname.startsWith("/assets/")) {
    const filePath = path.join(distDir, url.pathname);
    const safePath = path.resolve(filePath);
    if (!safePath.startsWith(path.resolve(distDir))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      const data = fs.readFileSync(safePath);
      const ext = path.extname(safePath);
      const mimeTypes: Record<string, string> = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".json": "application/json",
      };
      res.setHeader("Content-Type", mimeTypes[ext] ?? "application/octet-stream");
      res.writeHead(200);
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  // SPA fallback: serve index.html for all non-API routes
  try {
    const indexHtml = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200);
    res.end(indexHtml);
  } catch {
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200);
    res.end(HTML);
  }
});

server.listen(PORT, () => {
  console.log(`VLM Code Context | AI Virtual IT Department — http://localhost:${PORT}`);

  // Auto-detect watch directory from indexed files, or use CLI arg
  const watchDir = WATCH_DIR ?? (() => {
    const row = db.prepare(`SELECT path FROM files ORDER BY path LIMIT 1`).get() as { path: string } | undefined;
    if (!row) return null;
    // Walk up to find the common root (shortest path prefix of all indexed files)
    const allPaths = db.prepare(`SELECT path FROM files`).all() as { path: string }[];
    if (allPaths.length === 0) return null;
    let common = path.dirname(allPaths[0].path);
    for (const p of allPaths) {
      while (!p.path.startsWith(common + "/") && common !== "/") {
        common = path.dirname(common);
      }
    }
    return common;
  })();

  if (watchDir) {
    startWatcher(watchDir);
  } else {
    console.log("[watch] No indexed files found. Pass a directory as 4th arg or index files first.");
  }

  // Start GitHub auto-sync if .github.local.json exists
  startGithubAutoSync(writeDb, dbPath, () => notifyClients());
});

// ─── HTML ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf-8");

const _UNUSED = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VLM Code Context | AI Virtual IT Department</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0b; --surface: #141416; --surface2: #1c1c20;
    --border: #2a2a2e; --text: #e4e4e7; --text2: #a1a1aa;
    --accent: #3b82f6; --accent2: #60a5fa; --green: #22c55e;
    --orange: #f59e0b; --pink: #ec4899; --purple: #a855f7;
    --radius: 8px; --font: 'Inter', -apple-system, system-ui, sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', monospace;
  }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.5; }
  a { color: var(--accent2); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .shell { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr; gap: 16px; padding: 24px; height: 100vh; }
  .header { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; }
  .header h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .stats { display: flex; gap: 12px; margin-left: auto; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 14px; }
  .stat .n { font-size: 20px; font-weight: 700; color: var(--accent2); font-family: var(--mono); }
  .stat .l { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; }

  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  .panel-head { padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 13px; color: var(--text2); display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .panel-body { overflow-y: auto; padding: 8px; flex: 1; min-height: 0; }

  .search { width: 280px; padding: 7px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-size: 13px; outline: none; }
  .search:focus { border-color: var(--accent); }

  .file-item { padding: 10px 12px; border-radius: 6px; cursor: pointer; transition: background .15s; border: 1px solid transparent; }
  .file-item:hover { background: var(--surface2); }
  .file-item.active { background: rgba(59,130,246,.15); border-color: var(--accent); }
  .file-path { font-family: var(--mono); font-size: 12px; color: var(--accent2); }
  .file-meta { font-size: 11px; color: var(--text2); margin-top: 2px; }
  .file-summary { font-size: 12px; color: var(--text2); margin-top: 4px; }

  .detail-title { font-family: var(--mono); font-size: 13px; color: var(--accent2); word-break: break-all; }
  .detail-section { margin: 12px 8px; }
  .detail-section h3 { font-size: 12px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-family: var(--mono); margin: 2px; }
  .badge-fn { background: rgba(59,130,246,.15); color: var(--accent2); }
  .badge-type { background: rgba(168,85,247,.15); color: var(--purple); }
  .badge-const { background: rgba(34,197,94,.15); color: var(--green); }
  .badge-class { background: rgba(245,158,11,.15); color: var(--orange); }
  .badge-interface { background: rgba(236,72,153,.15); color: var(--pink); }
  .badge-pkg { background: var(--surface2); color: var(--text2); }
  .dep-item { padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  .dep-item:hover { background: var(--surface2); }
  .dep-path { font-family: var(--mono); font-size: 11px; color: var(--accent2); }
  .dep-symbols { font-size: 11px; color: var(--text2); }
  .dep-summary { font-size: 11px; color: var(--text2); opacity: .7; }
  .empty { padding: 32px; text-align: center; color: var(--text2); font-size: 13px; }

  canvas { width: 100%; height: 100%; display: block; }

  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .tab { padding: 8px 16px; font-size: 12px; color: var(--text2); cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent2); border-bottom-color: var(--accent); }
  .tab-content { display: none; flex: 1; min-height: 0; overflow-y: auto; }
  .tab-content.active { display: block; }

  .change-item { padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 6px; }
  .change-item:hover { background: var(--surface2); }
  .change-header { display: flex; align-items: center; gap: 8px; }
  .change-event { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; }
  .change-event.add { background: rgba(34,197,94,.15); color: var(--green); }
  .change-event.change { background: rgba(59,130,246,.15); color: var(--accent2); }
  .change-event.delete { background: rgba(239,68,68,.15); color: #ef4444; }
  .change-path { font-family: var(--mono); font-size: 11px; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .change-time { font-size: 10px; color: var(--text2); font-family: var(--mono); white-space: nowrap; }
  .change-diff { font-size: 11px; color: var(--text2); margin-top: 4px; }
  .change-diff .old { color: #ef4444; }
  .change-diff .new { color: var(--green); }
  .diff-block { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 8px; margin-top: 6px; font-family: var(--mono); font-size: 11px; line-height: 1.6; overflow-x: auto; white-space: pre; max-height: 300px; overflow-y: auto; }
  .diff-block .dl { color: #ef4444; }
  .diff-block .al { color: var(--green); }
  .diff-block .ctx { color: var(--text2); }
  .diff-block .sep { color: var(--text2); opacity: .4; }
  .diff-toggle { font-size: 11px; color: var(--accent2); cursor: pointer; margin-top: 4px; }
  .diff-toggle:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="shell">
  <div class="header">
    <h1>VLM Code Context</h1>
    <input class="search" id="search" placeholder="Search files..." autocomplete="off">
    <div class="stats" id="stats"></div>
  </div>

  <div class="panel">
    <div class="panel-head">Files</div>
    <div class="panel-body" id="file-list"></div>
  </div>

  <div class="panel" style="display:flex;flex-direction:column;">
    <div class="tabs">
      <div class="tab active" data-tab="detail">Detail</div>
      <div class="tab" data-tab="changes">Changes</div>
      <div class="tab" data-tab="graph">Graph</div>
    </div>
    <div class="tab-content active" id="tab-detail" style="flex:1;overflow-y:auto;">
      <div class="empty" id="detail-empty">Select a file to view context</div>
      <div id="detail" style="display:none;"></div>
    </div>
    <div class="tab-content" id="tab-changes" style="flex:1;overflow-y:auto;padding:8px;">
      <div class="empty" id="changes-empty">No changes recorded yet</div>
      <div id="changes-list"></div>
    </div>
    <div class="tab-content" id="tab-graph" style="flex:1;position:relative;">
      <canvas id="graph"></canvas>
    </div>
  </div>
</div>

<script>
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
let allFiles = [];
let graphData = null;

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function init() {
  const [files, stats, graph] = await Promise.all([
    fetch('/api/files').then(r => r.json()),
    fetch('/api/stats').then(r => r.json()),
    fetch('/api/graph').then(r => r.json()),
  ]);
  allFiles = files;
  graphData = graph;
  renderStats(stats);
  renderFiles(files);
  renderGraph();
}

function renderStats(s) {
  const el = $('#stats');
  el.textContent = '';
  function fmtSize(b) { if (b<1024) return b+'B'; if (b<1048576) return (b/1024).toFixed(1)+'KB'; return (b/1048576).toFixed(1)+'MB'; }
  [{n: s.files, l: 'Files'}, {n: s.exports, l: 'Exports'}, {n: s.deps, l: 'Deps'}, {n: s.totalLines.toLocaleString(), l: 'Lines'}, {n: fmtSize(s.totalSize), l: 'Size'}].forEach(item => {
    const div = document.createElement('div'); div.className = 'stat';
    const nEl = document.createElement('div'); nEl.className = 'n'; nEl.textContent = item.n;
    const lEl = document.createElement('div'); lEl.className = 'l'; lEl.textContent = item.l;
    div.appendChild(nEl); div.appendChild(lEl);
    el.appendChild(div);
  });
}

function renderFiles(files) {
  const el = $('#file-list');
  el.textContent = '';
  if (!files.length) {
    const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'No files indexed';
    el.appendChild(empty); return;
  }
  files.forEach(f => {
    const short = f.path.split('/').slice(-3).join('/');
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.id = f.id;

    function fmtSize(b) { if (b<1024) return b+'B'; if (b<1048576) return (b/1024).toFixed(1)+'KB'; return (b/1048576).toFixed(1)+'MB'; }
    const pathEl = document.createElement('div'); pathEl.className = 'file-path'; pathEl.textContent = short;
    const metaEl = document.createElement('div'); metaEl.className = 'file-meta';
    metaEl.textContent = f.language + ' · ' + f.line_count + ' lines · ' + fmtSize(f.size_bytes) + ' · ' + f.export_count + ' exports · ' + f.imports_count + ' imports · ' + f.imported_by_count + ' dependents';
    const timeEl = document.createElement('div'); timeEl.className = 'file-meta';
    timeEl.textContent = 'Modified: ' + (f.modified_at || '—') + ' · Created: ' + (f.created_at || '—');
    const sumEl = document.createElement('div'); sumEl.className = 'file-summary'; sumEl.textContent = f.summary || '';

    item.appendChild(pathEl); item.appendChild(metaEl); item.appendChild(timeEl); item.appendChild(sumEl);
    item.addEventListener('click', () => selectFile(f.id));
    el.appendChild(item);
  });
}

let selectedFileId = null;

async function selectFile(id) {
  selectedFileId = id;
  $$('.file-item').forEach(el => el.classList.toggle('active', Number(el.dataset.id) === id));
  const data = await fetch('/api/file/' + id).then(r => r.json());
  renderDetail(data);
  loadFileChanges(id);
}

function badgeClass(kind) {
  const map = { 'function': 'badge-fn', 'type': 'badge-type', 'enum': 'badge-type', 'const': 'badge-const', 'class': 'badge-class', 'interface': 'badge-interface' };
  return map[kind] || 'badge-pkg';
}

function createBadge(text, kind) {
  const span = document.createElement('span');
  span.className = 'badge ' + badgeClass(kind);
  span.textContent = text + ' ' + kind;
  return span;
}

function createDepItem(d) {
  const short = d.path.split('/').slice(-3).join('/');
  const item = document.createElement('div');
  item.className = 'dep-item';
  item.dataset.id = d.id;
  const pathEl = document.createElement('div'); pathEl.className = 'dep-path'; pathEl.textContent = short;
  const symEl = document.createElement('div'); symEl.className = 'dep-symbols'; symEl.textContent = d.symbols || '*';
  const sumEl = document.createElement('div'); sumEl.className = 'dep-summary'; sumEl.textContent = d.summary || '';
  item.appendChild(pathEl); item.appendChild(symEl); item.appendChild(sumEl);
  item.addEventListener('click', () => selectFile(d.id));
  return item;
}

function renderDetail(d) {
  $('#detail-empty').style.display = 'none';
  const el = $('#detail');
  el.style.display = 'block';
  el.textContent = '';

  function fmtSize(b) { if (b<1024) return b+' B'; if (b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }

  // Title + metadata
  const titleSection = document.createElement('div'); titleSection.className = 'detail-section';
  const title = document.createElement('div'); title.className = 'detail-title'; title.textContent = d.path;
  const meta1 = document.createElement('div'); meta1.style.cssText = 'font-size:12px;color:var(--text2);margin-top:4px;font-family:var(--mono);';
  meta1.textContent = d.language + ' · ' + d.extension + ' · ' + (d.line_count || 0) + ' lines · ' + fmtSize(d.size_bytes || 0);
  const meta2 = document.createElement('div'); meta2.style.cssText = 'font-size:11px;color:var(--text2);margin-top:2px;';
  meta2.textContent = 'Created: ' + (d.created_at || '—') + ' · Modified: ' + (d.modified_at || '—') + ' · Indexed: ' + (d.indexed_at || '—');
  const summary = document.createElement('div'); summary.style.cssText = 'font-size:12px;color:var(--text2);margin-top:6px;';
  summary.textContent = d.summary || '';
  titleSection.appendChild(title); titleSection.appendChild(meta1); titleSection.appendChild(meta2); titleSection.appendChild(summary);
  el.appendChild(titleSection);

  // Exports
  const expSection = document.createElement('div'); expSection.className = 'detail-section';
  const expH = document.createElement('h3'); expH.textContent = 'Exports (' + d.exports.length + ')';
  expSection.appendChild(expH);
  if (d.exports.length) { d.exports.forEach(e => expSection.appendChild(createBadge(e.name, e.kind))); }
  else { const none = document.createElement('span'); none.style.cssText = 'color:var(--text2);font-size:12px;'; none.textContent = 'No exports'; expSection.appendChild(none); }
  el.appendChild(expSection);

  // External packages
  const pkgSection = document.createElement('div'); pkgSection.className = 'detail-section';
  const pkgH = document.createElement('h3'); pkgH.textContent = 'External Packages';
  pkgSection.appendChild(pkgH);
  if (d.external_imports) {
    d.external_imports.split(', ').forEach(p => {
      const span = document.createElement('span'); span.className = 'badge badge-pkg'; span.textContent = p;
      pkgSection.appendChild(span);
    });
  } else { const none = document.createElement('span'); none.style.cssText = 'color:var(--text2);font-size:12px;'; none.textContent = 'None'; pkgSection.appendChild(none); }
  el.appendChild(pkgSection);

  // Imports from
  const impSection = document.createElement('div'); impSection.className = 'detail-section';
  const impH = document.createElement('h3'); impH.textContent = 'Imports From (' + d.imports.length + ')';
  impSection.appendChild(impH);
  if (d.imports.length) { d.imports.forEach(i => impSection.appendChild(createDepItem(i))); }
  else { const none = document.createElement('span'); none.style.cssText = 'color:var(--text2);font-size:12px;'; none.textContent = 'No internal imports'; impSection.appendChild(none); }
  el.appendChild(impSection);

  // Imported by
  const bySection = document.createElement('div'); bySection.className = 'detail-section';
  const byH = document.createElement('h3'); byH.textContent = 'Imported By (' + d.importedBy.length + ')';
  bySection.appendChild(byH);
  if (d.importedBy.length) { d.importedBy.forEach(i => bySection.appendChild(createDepItem(i))); }
  else { const none = document.createElement('span'); none.style.cssText = 'color:var(--text2);font-size:12px;'; none.textContent = 'Not imported by any indexed file'; bySection.appendChild(none); }
  el.appendChild(bySection);
}

// Search
$('#search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderFiles(allFiles.filter(f => f.path.toLowerCase().includes(q) || (f.summary || '').toLowerCase().includes(q)));
});

// Tabs
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $('#tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'graph') renderGraph();
    if (tab.dataset.tab === 'changes') loadFileChanges(selectedFileId);
  });
});

// Graph
function renderGraph() {
  if (!graphData || !graphData.nodes.length) return;
  const canvas = $('#graph');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const W = rect.width, H = rect.height;

  const nodes = graphData.nodes.map(n => ({
    ...n, x: W/2 + (Math.random()-.5)*W*.6, y: H/2 + (Math.random()-.5)*H*.6, vx: 0, vy: 0,
  }));
  const idMap = {};
  nodes.forEach(n => idMap[n.id] = n);
  const edges = graphData.edges.filter(e => idMap[e.source] && idMap[e.target]);

  for (let iter = 0; iter < 200; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
        let d = Math.sqrt(dx*dx + dy*dy) || 1;
        let f = 8000 / (d * d);
        nodes[i].vx -= dx/d*f; nodes[i].vy -= dy/d*f;
        nodes[j].vx += dx/d*f; nodes[j].vy += dy/d*f;
      }
    }
    for (const e of edges) {
      const s = idMap[e.source], t = idMap[e.target];
      let dx = t.x-s.x, dy = t.y-s.y, d = Math.sqrt(dx*dx+dy*dy)||1;
      let f = (d-120)*0.05;
      s.vx += dx/d*f; s.vy += dy/d*f;
      t.vx -= dx/d*f; t.vy -= dy/d*f;
    }
    for (const n of nodes) {
      n.vx += (W/2-n.x)*0.01; n.vy += (H/2-n.y)*0.01;
      n.x += n.vx*0.3; n.y += n.vy*0.3;
      n.vx *= 0.6; n.vy *= 0.6;
      n.x = Math.max(60, Math.min(W-60, n.x));
      n.y = Math.max(30, Math.min(H-30, n.y));
    }
  }

  ctx.clearRect(0, 0, W, H);
  for (const e of edges) {
    const s = idMap[e.source], t = idMap[e.target];
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = 'rgba(59,130,246,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    const angle = Math.atan2(t.y-s.y, t.x-s.x);
    const mx = (s.x+t.x)/2, my = (s.y+t.y)/2;
    ctx.beginPath();
    ctx.moveTo(mx+6*Math.cos(angle), my+6*Math.sin(angle));
    ctx.lineTo(mx-6*Math.cos(angle-0.5), my-6*Math.sin(angle-0.5));
    ctx.lineTo(mx-6*Math.cos(angle+0.5), my-6*Math.sin(angle+0.5));
    ctx.fillStyle = 'rgba(59,130,246,.5)'; ctx.fill();
  }
  for (const n of nodes) {
    ctx.beginPath(); ctx.arc(n.x, n.y, 6, 0, Math.PI*2);
    ctx.fillStyle = '#3b82f6'; ctx.fill();
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#a1a1aa'; ctx.textAlign = 'center';
    ctx.fillText(n.label, n.x, n.y+20);
  }
}

window.addEventListener('resize', renderGraph);

// Helper for safe DOM span creation
function span(cls, text) { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; }

async function loadFileChanges(id) {
  const el = $('#changes-list');
  const empty = $('#changes-empty');
  el.textContent = '';

  if (!id) { empty.textContent = 'Select a file to view its changes'; empty.style.display = 'block'; return; }

  const changes = await fetch('/api/file/' + id + '/changes?limit=50').then(r => r.json());
  if (!changes.length) { empty.textContent = 'No changes recorded for this file'; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  function fmtSize(b) { if (b == null) return '?'; if (b<1024) return b+'B'; if (b<1048576) return (b/1024).toFixed(1)+'KB'; return (b/1048576).toFixed(1)+'MB'; }

  changes.forEach(c => {
    const item = document.createElement('div'); item.className = 'change-item';

    const header = document.createElement('div'); header.className = 'change-header';
    const badge = document.createElement('span'); badge.className = 'change-event ' + c.event; badge.textContent = c.event;
    const ts = document.createElement('span'); ts.className = 'change-time'; ts.textContent = c.timestamp;
    header.appendChild(badge); header.appendChild(ts);
    item.appendChild(header);

    if (c.event === 'change') {
      const diff = document.createElement('div'); diff.className = 'change-diff';
      if (c.old_line_count !== c.new_line_count) {
        diff.append('Lines: ', span('old', c.old_line_count), ' \u2192 ', span('new', c.new_line_count), '  ');
      }
      if (c.old_size_bytes !== c.new_size_bytes) {
        diff.append('Size: ', span('old', fmtSize(c.old_size_bytes)), ' \u2192 ', span('new', fmtSize(c.new_size_bytes)), '  ');
      }
      if (c.old_summary !== c.new_summary) diff.append('Summary changed  ');
      if (c.old_exports !== c.new_exports) diff.append('Exports changed');
      if (diff.childNodes.length) item.appendChild(diff);

      if (c.diff_text) {
        const toggle = document.createElement('div'); toggle.className = 'diff-toggle'; toggle.textContent = 'Show diff';
        const block = document.createElement('div'); block.className = 'diff-block'; block.style.display = 'none';
        c.diff_text.split('\\n').forEach(line => {
          const el = document.createElement('div');
          if (line.startsWith('+ ')) { el.className = 'al'; }
          else if (line.startsWith('- ')) { el.className = 'dl'; }
          else if (line === '---') { el.className = 'sep'; }
          else { el.className = 'ctx'; }
          el.textContent = line;
          block.appendChild(el);
        });
        toggle.addEventListener('click', () => {
          const visible = block.style.display !== 'none';
          block.style.display = visible ? 'none' : 'block';
          toggle.textContent = visible ? 'Show diff' : 'Hide diff';
        });
        item.appendChild(toggle);
        item.appendChild(block);
      }
    } else if (c.event === 'add') {
      const diff = document.createElement('div'); diff.className = 'change-diff';
      diff.appendChild(span('new', (c.new_line_count || 0) + ' lines \u00B7 ' + fmtSize(c.new_size_bytes)));
      item.appendChild(diff);
    } else if (c.event === 'delete') {
      const diff = document.createElement('div'); diff.className = 'change-diff';
      diff.appendChild(span('old', 'removed \u00B7 was ' + (c.old_line_count || 0) + ' lines'));
      item.appendChild(diff);
    }

    el.appendChild(item);
  });
}

init();
loadFileChanges(null);

// Live reload via SSE
const es = new EventSource('/api/events');
es.onmessage = (e) => {
  if (e.data === 'updated') {
    const activeId = document.querySelector('.file-item.active')?.dataset?.id;
    init().then(() => { if (activeId) selectFile(Number(activeId)); else loadFileChanges(null); });
  }
};
</script>
</body>
</html>`;
