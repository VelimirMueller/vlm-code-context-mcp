import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// ─── .gitignore support ─────────────────────────────────────────────────────
interface GitignorePattern {
  pattern: string;
  negated: boolean;
  dirOnly: boolean;
}

function loadGitignore(rootDir: string): GitignorePattern[] {
  const gitignorePath = path.join(rootDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return [];
  const content = fs.readFileSync(gitignorePath, "utf-8");
  const patterns: GitignorePattern[] = [];
  for (const raw of content.split("\n")) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const negated = line.startsWith("!");
    if (negated) line = line.slice(1);
    const dirOnly = line.endsWith("/");
    if (dirOnly) line = line.slice(0, -1);
    patterns.push({ pattern: line, negated, dirOnly });
  }
  return patterns;
}

function matchesGitignore(relativePath: string, isDirectory: boolean, patterns: GitignorePattern[]): boolean {
  const name = path.basename(relativePath);
  let ignored = false;
  for (const p of patterns) {
    if (p.dirOnly && !isDirectory) continue;
    let matches = false;
    if (p.pattern.includes("/")) {
      // Path pattern: match against relative path
      matches = relativePath.startsWith(p.pattern) || relativePath === p.pattern;
    } else if (p.pattern.startsWith("*.")) {
      // Extension glob: match by suffix
      const ext = p.pattern.slice(1); // e.g. ".log"
      matches = name.endsWith(ext);
    } else if (p.pattern.startsWith("*")) {
      // Generic trailing wildcard
      const suffix = p.pattern.slice(1);
      matches = name.endsWith(suffix);
    } else {
      // Simple name match (directory or file)
      matches = name === p.pattern;
    }
    if (matches) ignored = !p.negated;
  }
  return ignored;
}

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
export interface ParsedExport {
  name: string;
  kind: string;
  description: string | null;
}

/** Extract the description from a JSDoc block that ends just before `pos` in `content`. */
export function extractJSDocBefore(content: string, pos: number): string | null {
  const before = content.slice(0, pos);
  const match = /\/\*\*\s*([\s\S]*?)\*\/\s*$/.exec(before);
  if (!match) return null;

  const desc = match[1]
    .split("\n")
    .map(line => line.replace(/^\s*\*\s?/, "").trim())
    .filter(line => line && !line.startsWith("@"))
    .join(" ")
    .trim();

  return desc || null;
}

const MUTABLE_KINDS = new Set(["let", "var"]);

function normalizeKind(kind: string): string {
  return MUTABLE_KINDS.has(kind) ? "const" : kind;
}

/** Collect all regex matches into an array via a mapper function. */
function matchAll(
  content: string,
  regex: RegExp,
  mapper: (match: RegExpExecArray) => ParsedExport[],
): ParsedExport[] {
  const results: ParsedExport[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    results.push(...mapper(m));
  }
  return results;
}

/** Parse `export { a, b }` braces into name pairs, resolving `as` aliases. */
function parseBraceList(raw: string, useAlias: boolean): string[] {
  return raw
    .split(",")
    .map(s => s.trim().split(/\s+as\s+/))
    .map(parts => useAlias && parts.length > 1 ? parts[1] : parts[0])
    .filter(Boolean);
}

function findDefaultExports(content: string): ParsedExport[] {
  return matchAll(content, /export\s+default\s+(function|class)\s+(\w+)/g, (m) => [
    { name: m[2], kind: m[1], description: extractJSDocBefore(content, m.index) },
  ]);
}

function findNamedExports(content: string): ParsedExport[] {
  return matchAll(
    content,
    /export\s+(?:async\s+)?(function|const|let|var|class|interface|type|enum)\s+(\w+)/g,
    (m) => [
      { name: m[2], kind: normalizeKind(m[1]), description: extractJSDocBefore(content, m.index) },
    ],
  );
}

function findLocalReExports(content: string): ParsedExport[] {
  return matchAll(content, /export\s+\{([^}]+)\}(?!\s*from)/g, (m) =>
    parseBraceList(m[1], false).map(name => ({ name, kind: "re-export", description: null })),
  );
}

function findModuleReExports(content: string): ParsedExport[] {
  return matchAll(content, /export\s+\{([^}]+)\}\s*from\s+['"][^'"]+['"]/g, (m) =>
    parseBraceList(m[1], true).map(name => ({ name, kind: "re-export", description: null })),
  );
}

export function parseExports(content: string): ParsedExport[] {
  return [
    ...findDefaultExports(content),
    ...findNamedExports(content),
    ...findLocalReExports(content),
    ...findModuleReExports(content),
  ];
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
function walkDir(dir: string, rootDir?: string, gitignorePatterns?: GitignorePattern[]): string[] {
  const root = rootDir ?? dir;
  const patterns = gitignorePatterns ?? loadGitignore(root);
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Always skip node_modules and .git regardless of .gitignore
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const full = path.join(dir, entry.name);
    const relativePath = path.relative(root, full);
    if (entry.isSymbolicLink()) continue; // skip symlinks to avoid loops
    if (entry.isDirectory()) {
      // Check .gitignore patterns for directories
      if (patterns.length > 0 && matchesGitignore(relativePath, true, patterns)) continue;
      try { results.push(...walkDir(full, root, patterns)); } catch { /* skip inaccessible dirs */ }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      // Check .gitignore patterns for files
      if (patterns.length > 0 && matchesGitignore(relativePath, false, patterns)) continue;
      // Skip files > 5MB
      try { if (fs.statSync(full).size > 5 * 1024 * 1024) { console.warn(`[indexer] Skipping large file: ${full}`); continue; } } catch { continue; }
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

// ─── Auto-generate file description ─────────────────────────────────────────
function generateFileDescription(filePath: string, lang: string, ext: string, lineCount: number, content: string, summary: string, externals: string | null): string | null {
  const name = path.basename(filePath);
  const exports = PARSEABLE_EXTENSIONS.has(ext) ? parseExports(content) : [];
  const imports = PARSEABLE_EXTENSIONS.has(ext) ? parseImports(content) : [];
  const localImports = imports.filter(i => i.source.startsWith("."));
  const externalPkgs = externals ? externals.split(", ") : [];

  const parts: string[] = [];

  // Identify file role from name patterns
  if (name === "index.ts" || name === "index.js") parts.push("Entry point");
  else if (name.includes("setup")) parts.push("Setup/bootstrap script");
  else if (name.includes("schema")) parts.push("Schema definitions");
  else if (name.includes("config")) parts.push("Configuration");
  else if (name.endsWith(".test.ts") || name.endsWith(".spec.ts") || name.endsWith(".test.js") || name.endsWith(".spec.js") || name.endsWith(".test.tsx") || name.endsWith(".spec.tsx")) parts.push("Test suite");
  else if (name.includes("middleware")) parts.push("Middleware");
  else if (/^use[A-Z]/.test(name.replace(/\.\w+$/, ""))) parts.push("React hook");
  else if (name.includes("hook")) parts.push("Hook");
  else if (name.includes("util")) parts.push("Utility functions");
  else if (name.includes("helper")) parts.push("Helper functions");
  else if (name.includes("constant")) parts.push("Constants");
  else if (name.includes("types") || name.endsWith(".d.ts")) parts.push("Type definitions");

  // What does it export?
  if (exports.length > 0) {
    const fns = exports.filter(e => e.kind === "function").map(e => e.name);
    const types = exports.filter(e => ["type", "interface", "enum"].includes(e.kind)).map(e => e.name);
    const classes = exports.filter(e => e.kind === "class").map(e => e.name);
    const consts = exports.filter(e => e.kind === "const").map(e => e.name);
    if (fns.length) parts.push(`exports ${fns.join(", ")}`);
    if (classes.length) parts.push(`defines ${classes.join(", ")}`);
    if (types.length) parts.push(`types: ${types.join(", ")}`);
    if (consts.length > 0 && consts.length <= 3) parts.push(`constants: ${consts.join(", ")}`);
  }

  // What does it depend on?
  if (externalPkgs.length) {
    parts.push(`uses ${externalPkgs.join(", ")}`);
  }

  // Internal imports
  if (localImports.length) {
    const imported = localImports.map(i => {
      const base = path.basename(i.source).replace(/\.(m|c)?js$/, "");
      return i.symbols.length ? `${i.symbols.join(", ")} from ${base}` : base;
    });
    if (imported.length <= 3) parts.push(`imports ${imported.join("; ")}`);
  }

  // Size context
  if (lineCount > 500) parts.push(`${lineCount} lines`);

  // For non-code files, use summary if meaningful or fall back to extension-based heuristics
  if (!PARSEABLE_EXTENSIONS.has(ext)) {
    if (ext === ".md" || ext === ".mdx") {
      return summary !== name ? summary : "Markdown document";
    }
    if (ext === ".json") {
      return summary !== name ? summary : "Configuration file";
    }
    if (ext === ".css" || ext === ".scss" || ext === ".sass" || ext === ".less") {
      if (parts.length === 0) parts.push("Stylesheet");
    }
    if (ext === ".html" || ext === ".htm") {
      if (parts.length === 0) parts.push("HTML document");
    }
    if (ext === ".yaml" || ext === ".yml" || ext === ".toml" || ext === ".ini" || ext === ".cfg") {
      if (parts.length === 0) parts.push("Configuration file");
    }
    if (ext === ".env") {
      if (parts.length === 0) parts.push("Environment variables");
    }
    if (ext === ".sql") {
      if (parts.length === 0) parts.push("SQL script");
    }
    if (ext === ".sh" || ext === ".bash" || ext === ".zsh") {
      if (parts.length === 0) parts.push("Shell script");
    }
    if (ext === ".graphql" || ext === ".gql") {
      if (parts.length === 0) parts.push("GraphQL schema/queries");
    }
    if (ext === ".prisma") {
      if (parts.length === 0) parts.push("Prisma schema");
    }
    if (ext === ".proto") {
      if (parts.length === 0) parts.push("Protocol Buffer definitions");
    }
    if (ext === ".dockerfile" || name === "Dockerfile" || name.startsWith("Dockerfile.")) {
      if (parts.length === 0) parts.push("Docker configuration");
    }
    return parts.length ? parts.join(". ") + "." : null;
  }

  // For parseable (JS/TS) files with no exports and no imports, use path-based heuristics
  if (parts.length === 0 && exports.length === 0 && imports.length === 0) {
    // Extension-based fallback for test files already handled above via name patterns
    // Use directory path for additional context
    const dirName = path.basename(path.dirname(filePath));
    const pathHints: Record<string, string> = {
      middleware: "Middleware module",
      hooks: "Hook module",
      utils: "Utility module",
      helpers: "Helper module",
      constants: "Constants module",
      types: "Type definitions module",
      components: "UI component",
      services: "Service module",
      models: "Data model",
      lib: "Library module",
      config: "Configuration module",
      scripts: "Script",
      api: "API handler",
      routes: "Route handler",
      pages: "Page component",
      layouts: "Layout component",
      store: "State store",
      stores: "State store",
    };
    const hint = pathHints[dirName.toLowerCase()];
    if (hint) parts.push(hint);
  }

  if (parts.length === 0) return null;
  // Capitalize first letter
  const desc = parts.join(". ");
  return desc.charAt(0).toUpperCase() + desc.slice(1) + ".";
}

// ─── Auto-generate directory description ────────────────────────────────────
function generateDirDescription(dirPath: string, stats: { files: number; size: number; lines: number; langs: Map<string, number> }, rootDir: string): string {
  const name = path.basename(dirPath);
  const topLangs = Array.from(stats.langs.entries()).sort((a, b) => b[1] - a[1]);
  const langStr = topLangs.slice(0, 2).map(([l]) => l).join(" and ");

  // Check what files are in this direct directory
  const dirFiles = fs.readdirSync(dirPath, { withFileTypes: true });
  const fileNames = dirFiles.filter(e => e.isFile()).map(e => e.name);
  const subDirs = dirFiles.filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name)).map(e => e.name);

  // Try to infer purpose from directory name
  const nameHints: Record<string, string> = {
    src: "Source code",
    lib: "Library modules",
    server: "Server-side logic",
    client: "Client-side code",
    dashboard: "Dashboard UI",
    api: "API endpoints",
    components: "UI components",
    utils: "Utility functions",
    helpers: "Helper functions",
    types: "Type definitions",
    models: "Data models",
    services: "Service layer",
    middleware: "Middleware",
    routes: "Route definitions",
    config: "Configuration",
    scripts: "Build/utility scripts",
    test: "Test suites",
    tests: "Test suites",
    __tests__: "Test suites",
    docs: "Documentation",
    guide: "Guides and tutorials",
    tools: "Tool documentation",
    database: "Database utilities",
    db: "Database layer",
    public: "Static assets",
    assets: "Assets and resources",
    styles: "Stylesheets",
  };

  const hint = nameHints[name.toLowerCase()];
  const parts: string[] = [];

  if (hint) parts.push(hint);

  if (langStr && !hint) parts.push(`${langStr} modules`);

  if (subDirs.length) {
    parts.push(`contains ${subDirs.join(", ")}`);
  }

  parts.push(`${stats.files} file${stats.files !== 1 ? "s" : ""}, ${stats.lines.toLocaleString()} lines`);

  return parts.join(". ") + ".";
}

// ─── Main indexer ────────────────────────────────────────────────────────────
export function indexDirectory(db: Database.Database, dirPath: string): { files: number; exports: number; deps: number } {
  const rootDir = path.resolve(dirPath);
  if (!fs.existsSync(rootDir)) throw new Error(`Directory not found: ${rootDir}`);
  const stat = fs.statSync(rootDir);
  if (!stat.isDirectory()) throw new Error(`Path is not a directory: ${rootDir}`);

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
  const insertExport = db.prepare(`INSERT INTO exports (file_id, name, kind, description) VALUES (?, ?, ?, ?)`);
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

      // Auto-generate description if none set manually
      const existing = db.prepare(`SELECT description FROM files WHERE id = ?`).get(row.id) as { description: string | null };
      if (!existing.description) {
        const autoDesc = generateFileDescription(filePath, lang, ext, lineCount, content, summary, externals);
        if (autoDesc) {
          db.prepare(`UPDATE files SET description = ? WHERE id = ?`).run(autoDesc, row.id);
        }
      }

      clearExports.run(row.id);

      if (PARSEABLE_EXTENSIONS.has(ext)) {
        for (const exp of parseExports(content)) {
          insertExport.run(row.id, exp.name, exp.kind, exp.description);
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

      // Auto-generate description if none set manually
      const existingDir = db.prepare(`SELECT description FROM directories WHERE path = ?`).get(dirPath) as { description: string | null } | undefined;
      if (!existingDir?.description) {
        const autoDesc = generateDirDescription(dirPath, stats, rootDir);
        db.prepare(`UPDATE directories SET description = ? WHERE path = ?`).run(autoDesc, dirPath);
      }
    }
  });
  indexDirs();

  // Phase 4: diff and log changes (after snapshot reads new content from DB)
  const after = snapshotFromDb(db);
  diffAndLogChanges(db, before, after);

  return { files: filePaths.length, exports: exportCount, deps: depCount };
}
