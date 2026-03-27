#!/usr/bin/env node
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import chokidar from "chokidar";
import { indexDirectory } from "../server/indexer.js";
import { initSchema } from "../server/schema.js";
import { initScrumSchema } from "../scrum/schema.js";
import { importScrumData } from "../scrum/import.js";

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

// Import scrum data from .claude/
const claudeDir = path.resolve(path.dirname(dbPath), ".claude");
const scrumImport = importScrumData(writeDb, claudeDir);
if (scrumImport.agents + scrumImport.sprints > 0) {
  console.log(`[scrum] Imported ${scrumImport.agents} agents, ${scrumImport.sprints} sprints, ${scrumImport.tickets} tickets, ${scrumImport.skills} skills`);
}

// SSE clients
const sseClients = new Set<http.ServerResponse>();

function notifyClients() {
  for (const res of sseClients) {
    res.write(`data: updated\n\n`);
  }
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

function apiAgentsHealth() {
  try {
    const agents = writeDb.prepare(`
      SELECT a.role, a.name, a.description, a.model,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'DONE') as done_tickets,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status IN ('TODO','IN_PROGRESS')) as active_tickets,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'BLOCKED') as blocked_tickets,
        (SELECT COALESCE(SUM(story_points),0) FROM tickets WHERE assigned_to = a.role AND status IN ('TODO','IN_PROGRESS')) as active_points
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
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'DONE') as done_count,
        (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND qa_verified = 1) as qa_count,
        (SELECT COUNT(*) FROM retro_findings WHERE sprint_id = s.id) as retro_count,
        (SELECT COUNT(*) FROM blockers WHERE sprint_id = s.id AND status = 'open') as open_blockers
      FROM sprints s ORDER BY s.created_at DESC
    `).all();
  } catch { return []; }
}

function apiSprintDetail(id: number) {
  try {
    const sprint = writeDb.prepare(`SELECT * FROM sprints WHERE id = ?`).get(id);
    if (!sprint) return null;
    return sprint;
  } catch { return null; }
}

function apiSprintTickets(sprintId: number) {
  try {
    return writeDb.prepare(`
      SELECT id, ticket_ref, title, description, priority, status, assigned_to,
        story_points, milestone, qa_verified, verified_by, acceptance_criteria, notes
      FROM tickets WHERE sprint_id = ? ORDER BY priority, status
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

// ─── Milestones, Vision, Backlog, Sprint Planning API ────────────────────────
function apiMilestones() {
  try {
    return writeDb.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND status = 'DONE') as done_count
      FROM milestones m ORDER BY m.created_at DESC
    `).all();
  } catch { return []; }
}

function apiCreateMilestone(body: any) {
  const { name, description, target_date, status } = body;
  if (!name) throw new Error("name is required");
  const result = writeDb.prepare(`INSERT INTO milestones (name, description, target_date, status) VALUES (?, ?, ?, ?)`).run(name, description || null, target_date || null, status || "planned");
  return { id: result.lastInsertRowid, name };
}

function apiMilestoneUpdate(id: number, body: any) {
  const sets: string[] = []; const vals: any[] = [];
  if (body.status) { sets.push("status=?"); vals.push(body.status); }
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
      SELECT t.id, t.ticket_ref, t.title, t.priority, t.status, t.story_points, t.assigned_to, t.milestone, t.milestone_id
      FROM tickets t
      WHERE t.sprint_id IS NULL
        OR (t.status IN ('TODO','NOT_DONE') AND t.sprint_id IN (SELECT id FROM sprints WHERE status = 'closed'))
      ORDER BY t.priority, t.created_at
    `).all();
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

// ─── Dump / Restore / Project Status API ────────────────────────────────────
function apiDump() {
  const allTables = [
    "agents", "sprints", "tickets", "subtasks", "retro_findings",
    "blockers", "bugs", "skills", "processes", "milestones",
    "files", "exports", "dependencies", "directories", "changes"
  ];
  const dump: Record<string, any[]> = {};
  for (const table of allTables) {
    try { dump[table] = writeDb.prepare(`SELECT * FROM ${table}`).all(); } catch {}
  }
  return { version: "2.0.0", exported_at: new Date().toISOString(), tables: dump };
}

async function apiRestore(body: any) {
  if (!body.version || !body.tables) return { error: "Invalid dump format" };

  const order = [
    "milestones", "agents", "skills", "processes",
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

  return {
    initialized: fileCount > 0,
    files: fileCount,
    agents: agentCount,
    sprints: sprintCount,
    tickets: ticketCount,
    skills: skillCount,
    milestones: milestoneCount,
  };
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
      else if (url.pathname === "/api/agents") data = apiAgentsHealth();
      else if (url.pathname === "/api/milestones" && req.method === "POST") {
        const body = await readBody(req);
        data = apiCreateMilestone(body);
      }
      else if (url.pathname === "/api/milestones") data = apiMilestones();
      else if (url.pathname.match(/^\/api\/milestone\/\d+$/) && req.method === "PUT") {
        const mid = Number(url.pathname.split("/")[3]);
        const body = await readBody(req);
        data = apiMilestoneUpdate(mid, body);
      }
      else if (url.pathname === "/api/vision" && req.method === "PUT") {
        const body = await readBody(req);
        data = apiVisionUpdate(body);
      }
      else if (url.pathname === "/api/backlog") data = apiBacklog();
      else if (url.pathname === "/api/sprints/plan" && req.method === "POST") {
        const body = await readBody(req);
        data = apiPlanSprint(body);
      }
      else if (url.pathname === "/api/sprints") data = apiSprints();
      else if (url.pathname.match(/^\/api\/sprint\/\d+\/tickets$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiSprintTickets(sid);
      } else if (url.pathname.match(/^\/api\/sprint\/\d+\/retro$/)) {
        const sid = Number(url.pathname.split("/")[3]);
        data = apiSprintRetro(sid);
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
          writeDb.prepare("UPDATE tickets SET milestone = NULL WHERE id = ?").run(tid);
        } else {
          const milestone = writeDb.prepare("SELECT name FROM milestones WHERE id = ?").get(milestoneId) as any;
          if (!milestone) { res.writeHead(404); res.end('{"error":"milestone not found"}'); return; }
          writeDb.prepare("UPDATE tickets SET milestone = ? WHERE id = ?").run(milestone.name, tid);
        }
        data = { ok: true };
      }
      else if (url.pathname === "/api/dump") data = apiDump();
      else if (url.pathname === "/api/restore" && req.method === "POST") {
        const body = await readBody(req);
        data = await apiRestore(body);
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
      } else { res.writeHead(404); res.end('{"error":"unknown endpoint"}'); return; }
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (e: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
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
