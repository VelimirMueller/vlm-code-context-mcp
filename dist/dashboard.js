import http from "http";
import path from "path";
import Database from "better-sqlite3";
const DB_PATH = process.argv[2] ?? "./context.db";
const PORT = Number(process.argv[3] ?? 3333);
const db = new Database(path.resolve(DB_PATH), { readonly: true });
db.pragma("journal_mode = WAL");
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
function apiFileContext(id) {
    const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id);
    if (!file)
        return null;
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
    const files = db.prepare(`SELECT id, path FROM files`).all();
    const deps = db.prepare(`SELECT source_id, target_id, symbols FROM dependencies`).all();
    return {
        nodes: files.map(f => ({ id: f.id, label: f.path.split("/").slice(-2).join("/") })),
        edges: deps.map(d => ({ source: d.source_id, target: d.target_id, symbols: d.symbols })),
    };
}
function apiStats() {
    const files = db.prepare(`SELECT COUNT(*) as c FROM files`).get().c;
    const exports = db.prepare(`SELECT COUNT(*) as c FROM exports`).get().c;
    const deps = db.prepare(`SELECT COUNT(*) as c FROM dependencies`).get().c;
    const totalLines = db.prepare(`SELECT COALESCE(SUM(line_count),0) as c FROM files`).get().c;
    const totalSize = db.prepare(`SELECT COALESCE(SUM(size_bytes),0) as c FROM files`).get().c;
    const languages = db.prepare(`SELECT language, COUNT(*) as c FROM files GROUP BY language ORDER BY c DESC`).all();
    const extensions = db.prepare(`SELECT extension, COUNT(*) as c FROM files GROUP BY extension ORDER BY c DESC LIMIT 15`).all();
    return { files, exports, deps, totalLines, totalSize, languages, extensions };
}
// ─── Server ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    if (url.pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
        try {
            let data;
            if (url.pathname === "/api/files")
                data = apiFiles();
            else if (url.pathname === "/api/stats")
                data = apiStats();
            else if (url.pathname === "/api/graph")
                data = apiGraph();
            else if (url.pathname.startsWith("/api/file/")) {
                const id = Number(url.pathname.split("/")[3]);
                data = apiFileContext(id);
                if (!data) {
                    res.writeHead(404);
                    res.end('{"error":"not found"}');
                    return;
                }
            }
            else {
                res.writeHead(404);
                res.end('{"error":"unknown endpoint"}');
                return;
            }
            res.writeHead(200);
            res.end(JSON.stringify(data));
        }
        catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200);
    res.end(HTML);
});
server.listen(PORT, () => {
    console.log(`Dashboard: http://localhost:${PORT}`);
});
// ─── HTML ────────────────────────────────────────────────────────────────────
const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Code Context Explorer</title>
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
</style>
</head>
<body>
<div class="shell">
  <div class="header">
    <h1>Code Context Explorer</h1>
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
      <div class="tab" data-tab="graph">Graph</div>
    </div>
    <div class="tab-content active" id="tab-detail" style="flex:1;overflow-y:auto;">
      <div class="empty" id="detail-empty">Select a file to view context</div>
      <div id="detail" style="display:none;"></div>
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

async function selectFile(id) {
  $$('.file-item').forEach(el => el.classList.toggle('active', Number(el.dataset.id) === id));
  const data = await fetch('/api/file/' + id).then(r => r.json());
  renderDetail(data);
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
init();
</script>
</body>
</html>`;
