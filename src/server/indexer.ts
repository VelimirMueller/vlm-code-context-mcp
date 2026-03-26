import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// ─── Config ──────────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", ".next", "build", "coverage", ".turbo",
  ".cache", ".output", ".nuxt", ".svelte-kit", "__pycache__", ".venv", "venv",
  ".vitepress", ".temp",
]);

const SKIP_FILES = new Set([".DS_Store", "Thumbs.db", ".gitkeep"]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".avif", ".bmp", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm",
  ".zip", ".tar", ".gz", ".br", ".zst",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".exe", ".dll", ".so", ".dylib", ".wasm",
  ".db", ".sqlite", ".db-shm", ".db-wal",
]);

const PARSEABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const LANG_MAP: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescriptreact",
  ".js": "javascript", ".jsx": "javascriptreact",
  ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python", ".pyw": "python",
  ".rb": "ruby", ".rs": "rust", ".go": "go",
  ".java": "java", ".kt": "kotlin", ".scala": "scala",
  ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp", ".cc": "cpp",
  ".cs": "csharp", ".fs": "fsharp",
  ".swift": "swift", ".m": "objc", ".mm": "objcpp",
  ".php": "php", ".lua": "lua", ".r": "r",
  ".dart": "dart", ".ex": "elixir", ".exs": "elixir",
  ".erl": "erlang", ".hs": "haskell", ".clj": "clojure",
  ".vue": "vue", ".svelte": "svelte", ".astro": "astro",
  ".html": "html", ".htm": "html",
  ".css": "css", ".scss": "scss", ".sass": "sass", ".less": "less",
  ".json": "json", ".jsonc": "json",
  ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
  ".xml": "xml", ".graphql": "graphql", ".gql": "graphql",
  ".sql": "sql", ".prisma": "prisma",
  ".md": "markdown", ".mdx": "mdx", ".txt": "text", ".rst": "rst",
  ".sh": "shell", ".bash": "shell", ".zsh": "shell", ".fish": "shell",
  ".ps1": "powershell", ".bat": "batch", ".cmd": "batch",
  ".dockerfile": "docker", ".proto": "protobuf",
  ".tf": "terraform", ".hcl": "hcl",
  ".env": "env", ".ini": "ini", ".cfg": "ini",
  ".lock": "lockfile",
};

// ─── Import parsing (JS/TS only) ────────────────────────────────────────────
interface ParsedImport {
  symbols: string[];
  source: string;
}

function parseImports(content: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const importRe = /import\s+(?:(?:\{([^}]*)\}|(\w+)|\*\s+as\s+(\w+))\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const named = m[1]?.split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean) ?? [];
    const defaultImport = m[2] ? [m[2]] : [];
    const namespace = m[3] ? [`* as ${m[3]}`] : [];
    const source = m[4];
    results.push({ symbols: [...named, ...defaultImport, ...namespace], source });
  }
  return results;
}

// ─── Export parsing (JS/TS only) ────────────────────────────────────────────
interface ParsedExport {
  name: string;
  kind: string;
}

function parseExports(content: string): ParsedExport[] {
  const results: ParsedExport[] = [];
  const defaultRe = /export\s+default\s+(function|class)\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = defaultRe.exec(content)) !== null) {
    results.push({ name: m[2], kind: m[1] === "function" ? "function" : "class" });
  }
  const namedRe = /export\s+(function|const|let|var|class|interface|type|enum)\s+(\w+)/g;
  while ((m = namedRe.exec(content)) !== null) {
    const kind = ["let", "var"].includes(m[1]) ? "const" : m[1];
    results.push({ name: m[2], kind });
  }
  const reExportRe = /export\s+\{([^}]+)\}(?!\s*from)/g;
  while ((m = reExportRe.exec(content)) !== null) {
    m[1].split(",").map(s => s.trim().split(/\s+as\s+/)).forEach(parts => {
      if (parts[0]) results.push({ name: parts[0], kind: "re-export" });
    });
  }
  return results;
}

// ─── Summary extraction ──────────────────────────────────────────────────────
function extractSummary(content: string, filePath: string, ext: string): string {
  // JSON files: extract top-level "name" and "description"
  if (ext === ".json" || ext === ".jsonc") {
    try {
      const parsed = JSON.parse(content);
      const parts = [parsed.name, parsed.description].filter(Boolean);
      if (parts.length) return parts.join(" — ");
    } catch {}
    return path.basename(filePath);
  }

  // Markdown: first heading or first line
  if (ext === ".md" || ext === ".mdx") {
    const headingMatch = /^#\s+(.+)/m.exec(content);
    if (headingMatch) return headingMatch[1].trim();
    const firstLine = content.split("\n").find(l => l.trim());
    return firstLine?.slice(0, 120) ?? path.basename(filePath);
  }

  // Config files: just use filename
  if ([".yaml", ".yml", ".toml", ".ini", ".cfg", ".env", ".lock"].includes(ext)) {
    return path.basename(filePath);
  }

  // JS/TS and other code: try JSDoc, comments, then exports
  const jsdocRe = /^\s*\/\*\*\s*([\s\S]*?)\*\//;
  const jm = jsdocRe.exec(content);
  if (jm) {
    const lines = jm[1].split("\n").map(l => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean);
    if (lines.length > 0) return lines.slice(0, 3).join(" ");
  }

  // Try # comment blocks (Python, Ruby, Shell, YAML)
  if ([".py", ".rb", ".sh", ".bash", ".zsh", ".fish", ".yaml", ".yml"].includes(ext)) {
    const lines = content.split("\n");
    const commentLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") && !trimmed.startsWith("#!")) {
        commentLines.push(trimmed.replace(/^#\s?/, ""));
      } else if (trimmed === "") continue;
      else break;
    }
    if (commentLines.length > 0) return commentLines.slice(0, 3).join(" ");
  }

  // Try // comment blocks (JS/TS, Go, Rust, C, etc.)
  const lines = content.split("\n");
  const commentLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) {
      commentLines.push(trimmed.replace(/^\/\/\s?/, ""));
    } else if (trimmed === "") continue;
    else break;
  }
  if (commentLines.length > 0) return commentLines.slice(0, 3).join(" ");

  // JS/TS: fall back to exports list
  if (PARSEABLE_EXTENSIONS.has(ext)) {
    const exports = parseExports(content);
    if (exports.length > 0) return `Exports: ${exports.map(e => e.name).join(", ")}`;
  }

  return path.basename(filePath);
}

// ─── Resolve import path to a real file ──────────────────────────────────────
function resolveImportPath(importSource: string, fromFile: string, rootDir: string): string | null {
  if (!importSource.startsWith(".") && !importSource.startsWith("/")) return null;

  const base = importSource.startsWith("/")
    ? path.resolve(rootDir, importSource.slice(1))
    : path.resolve(path.dirname(fromFile), importSource);

  const stripped = base.replace(/\.(m|c)?js$/, "");
  const tryExts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

  const candidates = [
    base,
    stripped,
    ...tryExts.map(ext => base + ext),
    ...tryExts.map(ext => stripped + ext),
    ...tryExts.map(ext => path.join(base, "index" + ext)),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

// ─── Extract external package names ──────────────────────────────────────────
function extractExternalImports(imports: ParsedImport[]): string[] {
  const packages = new Set<string>();
  for (const imp of imports) {
    if (imp.source.startsWith(".") || imp.source.startsWith("/")) continue;
    const parts = imp.source.split("/");
    const name = imp.source.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    packages.add(name);
  }
  return Array.from(packages).sort();
}

// ─── File metadata ───────────────────────────────────────────────────────────
function toISOLocal(date: Date): string {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

function getFileMeta(filePath: string) {
  const stat = fs.statSync(filePath);
  return {
    sizeBytes: stat.size,
    createdAt: toISOLocal(stat.birthtime),
    modifiedAt: toISOLocal(stat.mtime),
  };
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split("\n").length;
}

// ─── Walk directory ──────────────────────────────────────────────────────────
function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      results.push(full);
    }
  }
  return results;
}

// ─── Simple unified diff ────────────────────────────────────────────────────
function computeDiff(oldLines: string[], newLines: string[]): string {
  const hunks: string[] = [];
  const contextSize = 3;
  let i = 0, j = 0;

  // Find changed regions using LCS-like approach
  const changes: { type: "equal" | "delete" | "insert"; oldIdx: number; newIdx: number; line: string }[] = [];

  // Simple diff: walk both arrays, find matching lines
  const oldSet = new Map<string, number[]>();
  oldLines.forEach((line, idx) => {
    const arr = oldSet.get(line) ?? [];
    arr.push(idx);
    oldSet.set(line, arr);
  });

  // Myers-like simple diff via longest common subsequence
  const maxLen = oldLines.length + newLines.length;
  if (maxLen > 10000) return "(file too large for inline diff)";

  // Use a simple O(n*m) DP for small files, fall back to line-by-line for large
  if (oldLines.length * newLines.length > 500000) {
    // Fallback: show removed and added lines
    const removed = oldLines.filter(l => !newLines.includes(l));
    const added = newLines.filter(l => !oldLines.includes(l));
    const parts: string[] = [];
    removed.slice(0, 50).forEach(l => parts.push(`- ${l}`));
    added.slice(0, 50).forEach(l => parts.push(`+ ${l}`));
    if (removed.length > 50 || added.length > 50) parts.push(`... (truncated)`);
    return parts.join("\n");
  }

  // LCS table
  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let a = m - 1; a >= 0; a--) {
    for (let b = n - 1; b >= 0; b--) {
      if (oldLines[a] === newLines[b]) dp[a][b] = dp[a + 1][b + 1] + 1;
      else dp[a][b] = Math.max(dp[a + 1][b], dp[a][b + 1]);
    }
  }

  // Walk the LCS to produce diff lines
  const diffLines: { type: string; line: string; oldLn?: number; newLn?: number }[] = [];
  let a = 0, b = 0;
  while (a < m || b < n) {
    if (a < m && b < n && oldLines[a] === newLines[b]) {
      diffLines.push({ type: " ", line: oldLines[a], oldLn: a + 1, newLn: b + 1 });
      a++; b++;
    } else if (b < n && (a >= m || dp[a][b + 1] >= dp[a + 1][b])) {
      diffLines.push({ type: "+", line: newLines[b], newLn: b + 1 });
      b++;
    } else {
      diffLines.push({ type: "-", line: oldLines[a], oldLn: a + 1 });
      a++;
    }
  }

  // Format into hunks with context
  const output: string[] = [];
  let inHunk = false;
  for (let k = 0; k < diffLines.length; k++) {
    const dl = diffLines[k];
    if (dl.type !== " ") {
      // Show context before
      if (!inHunk) {
        const start = Math.max(0, k - contextSize);
        for (let c = start; c < k; c++) {
          output.push(`  ${diffLines[c].line}`);
        }
        inHunk = true;
      }
      output.push(`${dl.type} ${dl.line}`);
    } else if (inHunk) {
      // Show context after
      output.push(`  ${dl.line}`);
      // Check if next change is within context range
      let nextChange = -1;
      for (let c = k + 1; c < diffLines.length && c <= k + contextSize * 2; c++) {
        if (diffLines[c].type !== " ") { nextChange = c; break; }
      }
      if (nextChange === -1 || nextChange > k + contextSize * 2) {
        inHunk = false;
        if (k < diffLines.length - 1) output.push("---");
      }
    }
  }

  // Truncate very long diffs
  if (output.length > 100) {
    return output.slice(0, 100).join("\n") + "\n... (truncated, " + output.length + " total lines)";
  }
  return output.join("\n");
}

// ─── Snapshot helpers for change tracking ───────────────────────────────────
interface FileSnapshot {
  path: string;
  summary: string | null;
  line_count: number;
  size_bytes: number;
  exports: string;
  content: string;
}

function snapshotFromDb(db: Database.Database): Map<string, FileSnapshot> {
  const rows = db.prepare(`
    SELECT f.path, f.summary, f.line_count, f.size_bytes,
      COALESCE(f.content, '') as content,
      COALESCE(GROUP_CONCAT(e.name || ' ' || e.kind, ', '), '') as exports
    FROM files f LEFT JOIN exports e ON e.file_id = f.id
    GROUP BY f.id
  `).all() as FileSnapshot[];
  const map = new Map<string, FileSnapshot>();
  for (const r of rows) map.set(r.path, r);
  return map;
}

function diffAndLogChanges(db: Database.Database, before: Map<string, FileSnapshot>, after: Map<string, FileSnapshot>) {
  const insertChange = db.prepare(`
    INSERT INTO changes (file_path, event, old_summary, new_summary, old_line_count, new_line_count, old_size_bytes, new_size_bytes, old_exports, new_exports, diff_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [p, snap] of after) {
    if (!before.has(p)) {
      insertChange.run(p, "add", null, snap.summary, null, snap.line_count, null, snap.size_bytes, null, snap.exports, null);
    }
  }
  for (const [p, snap] of before) {
    if (!after.has(p)) {
      insertChange.run(p, "delete", snap.summary, null, snap.line_count, null, snap.size_bytes, null, snap.exports, null, null);
    }
  }
  for (const [p, newSnap] of after) {
    const old = before.get(p);
    if (!old) continue;
    if (old.summary !== newSnap.summary || old.line_count !== newSnap.line_count || old.size_bytes !== newSnap.size_bytes || old.exports !== newSnap.exports) {
      const diff = computeDiff(old.content.split("\n"), newSnap.content.split("\n"));
      insertChange.run(p, "change", old.summary, newSnap.summary, old.line_count, newSnap.line_count, old.size_bytes, newSnap.size_bytes, old.exports, newSnap.exports, diff);
    }
  }
}

// ─── Main indexer ────────────────────────────────────────────────────────────
export function indexDirectory(db: Database.Database, dirPath: string): { files: number; exports: number; deps: number } {
  const rootDir = path.resolve(dirPath);
  if (!fs.existsSync(rootDir)) throw new Error(`Directory not found: ${rootDir}`);

  // Snapshot before indexing (reads old content from DB)
  const before = snapshotFromDb(db);

  const filePaths = walkDir(rootDir);

  const upsertFile = db.prepare(`
    INSERT INTO files (path, language, extension, size_bytes, line_count, summary, external_imports, content, created_at, modified_at, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET
      language=excluded.language, extension=excluded.extension,
      size_bytes=excluded.size_bytes, line_count=excluded.line_count,
      summary=excluded.summary, external_imports=excluded.external_imports,
      content=excluded.content,
      created_at=excluded.created_at, modified_at=excluded.modified_at,
      indexed_at=excluded.indexed_at
  `);
  const getFileId = db.prepare(`SELECT id FROM files WHERE path = ?`);
  const clearExports = db.prepare(`DELETE FROM exports WHERE file_id = ?`);
  const clearDeps = db.prepare(`DELETE FROM dependencies WHERE source_id = ?`);
  const insertExport = db.prepare(`INSERT INTO exports (file_id, name, kind) VALUES (?, ?, ?)`);
  const insertDep = db.prepare(`INSERT OR IGNORE INTO dependencies (source_id, target_id, symbols) VALUES (?, ?, ?)`);

  let exportCount = 0;
  let depCount = 0;

  // Phase 1: index all files
  const indexAll = db.transaction(() => {
    for (const filePath of filePaths) {
      const ext = path.extname(filePath).toLowerCase();
      const lang = LANG_MAP[ext] ?? "unknown";
      const meta = getFileMeta(filePath);

      let content = "";
      try { content = fs.readFileSync(filePath, "utf-8"); } catch { continue; }

      const lineCount = countLines(content);
      const summary = extractSummary(content, filePath, ext);

      let externals: string | null = null;
      if (PARSEABLE_EXTENSIONS.has(ext)) {
        const imports = parseImports(content);
        externals = extractExternalImports(imports).join(", ") || null;
      }

      upsertFile.run(filePath, lang, ext, meta.sizeBytes, lineCount, summary, externals, content, meta.createdAt, meta.modifiedAt);
      const row = getFileId.get(filePath) as { id: number };
      clearExports.run(row.id);

      if (PARSEABLE_EXTENSIONS.has(ext)) {
        for (const exp of parseExports(content)) {
          insertExport.run(row.id, exp.name, exp.kind);
          exportCount++;
        }
      }
    }
  });
  indexAll();

  // Phase 2: resolve dependencies (JS/TS only)
  const indexDeps = db.transaction(() => {
    for (const filePath of filePaths) {
      const ext = path.extname(filePath).toLowerCase();
      if (!PARSEABLE_EXTENSIONS.has(ext)) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const sourceRow = getFileId.get(filePath) as { id: number };
      clearDeps.run(sourceRow.id);

      for (const imp of parseImports(content)) {
        const resolved = resolveImportPath(imp.source, filePath, rootDir);
        if (!resolved) continue;
        const targetRow = getFileId.get(resolved) as { id: number } | undefined;
        if (!targetRow) continue;
        insertDep.run(sourceRow.id, targetRow.id, imp.symbols.join(", "));
        depCount++;
      }
    }
  });
  indexDeps();

  // Phase 3: index directories
  const indexDirs = db.transaction(() => {
    const upsertDir = db.prepare(`
      INSERT INTO directories (path, name, parent_path, depth, file_count, total_size_bytes, total_lines, language_breakdown, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(path) DO UPDATE SET
        name=excluded.name, parent_path=excluded.parent_path, depth=excluded.depth,
        file_count=excluded.file_count, total_size_bytes=excluded.total_size_bytes,
        total_lines=excluded.total_lines, language_breakdown=excluded.language_breakdown,
        indexed_at=excluded.indexed_at
    `);

    // Collect all unique directories from file paths
    const dirMap = new Map<string, { files: number; size: number; lines: number; langs: Map<string, number> }>();
    for (const filePath of filePaths) {
      let dir = path.dirname(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const lang = LANG_MAP[ext] ?? "unknown";
      const stat = fs.statSync(filePath);
      const lineCount = countLines(fs.readFileSync(filePath, "utf-8"));

      // Walk up from the file's directory to the root, aggregating stats
      while (dir.length >= rootDir.length) {
        if (!dirMap.has(dir)) {
          dirMap.set(dir, { files: 0, size: 0, lines: 0, langs: new Map() });
        }
        const entry = dirMap.get(dir)!;
        entry.files++;
        entry.size += stat.size;
        entry.lines += lineCount;
        entry.langs.set(lang, (entry.langs.get(lang) ?? 0) + 1);

        if (dir === rootDir) break;
        dir = path.dirname(dir);
      }
    }

    for (const [dirPath, stats] of dirMap) {
      const name = path.basename(dirPath);
      const parentPath = dirPath === rootDir ? null : path.dirname(dirPath);
      const depth = dirPath === rootDir ? 0 : dirPath.slice(rootDir.length + 1).split(path.sep).length;
      const langBreakdown = JSON.stringify(
        Array.from(stats.langs.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([lang, count]) => ({ lang, count }))
      );
      upsertDir.run(dirPath, name, parentPath, depth, stats.files, stats.size, stats.lines, langBreakdown);
    }
  });
  indexDirs();

  // Phase 4: diff and log changes (after snapshot reads new content from DB)
  const after = snapshotFromDb(db);
  diffAndLogChanges(db, before, after);

  return { files: filePaths.length, exports: exportCount, deps: depCount };
}
