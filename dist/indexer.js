import fs from "fs";
import path from "path";
// ─── Config ──────────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set([
    "node_modules", ".git", "dist", ".next", "build", "coverage", ".turbo",
    ".cache", ".output", ".nuxt", ".svelte-kit", "__pycache__", ".venv", "venv",
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
const LANG_MAP = {
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
function parseImports(content) {
    const results = [];
    const importRe = /import\s+(?:(?:\{([^}]*)\}|(\w+)|\*\s+as\s+(\w+))\s+from\s+)?['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRe.exec(content)) !== null) {
        const named = m[1]?.split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean) ?? [];
        const defaultImport = m[2] ? [m[2]] : [];
        const namespace = m[3] ? [`* as ${m[3]}`] : [];
        const source = m[4];
        results.push({ symbols: [...named, ...defaultImport, ...namespace], source });
    }
    return results;
}
function parseExports(content) {
    const results = [];
    const defaultRe = /export\s+default\s+(function|class)\s+(\w+)/g;
    let m;
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
            if (parts[0])
                results.push({ name: parts[0], kind: "re-export" });
        });
    }
    return results;
}
// ─── Summary extraction ──────────────────────────────────────────────────────
function extractSummary(content, filePath, ext) {
    // JSON files: extract top-level "name" and "description"
    if (ext === ".json" || ext === ".jsonc") {
        try {
            const parsed = JSON.parse(content);
            const parts = [parsed.name, parsed.description].filter(Boolean);
            if (parts.length)
                return parts.join(" — ");
        }
        catch { }
        return path.basename(filePath);
    }
    // Markdown: first heading or first line
    if (ext === ".md" || ext === ".mdx") {
        const headingMatch = /^#\s+(.+)/m.exec(content);
        if (headingMatch)
            return headingMatch[1].trim();
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
        if (lines.length > 0)
            return lines.slice(0, 3).join(" ");
    }
    // Try # comment blocks (Python, Ruby, Shell, YAML)
    if ([".py", ".rb", ".sh", ".bash", ".zsh", ".fish", ".yaml", ".yml"].includes(ext)) {
        const lines = content.split("\n");
        const commentLines = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") && !trimmed.startsWith("#!")) {
                commentLines.push(trimmed.replace(/^#\s?/, ""));
            }
            else if (trimmed === "")
                continue;
            else
                break;
        }
        if (commentLines.length > 0)
            return commentLines.slice(0, 3).join(" ");
    }
    // Try // comment blocks (JS/TS, Go, Rust, C, etc.)
    const lines = content.split("\n");
    const commentLines = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//")) {
            commentLines.push(trimmed.replace(/^\/\/\s?/, ""));
        }
        else if (trimmed === "")
            continue;
        else
            break;
    }
    if (commentLines.length > 0)
        return commentLines.slice(0, 3).join(" ");
    // JS/TS: fall back to exports list
    if (PARSEABLE_EXTENSIONS.has(ext)) {
        const exports = parseExports(content);
        if (exports.length > 0)
            return `Exports: ${exports.map(e => e.name).join(", ")}`;
    }
    return path.basename(filePath);
}
// ─── Resolve import path to a real file ──────────────────────────────────────
function resolveImportPath(importSource, fromFile, rootDir) {
    if (!importSource.startsWith(".") && !importSource.startsWith("/"))
        return null;
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
        if (fs.existsSync(c) && fs.statSync(c).isFile())
            return c;
    }
    return null;
}
// ─── Extract external package names ──────────────────────────────────────────
function extractExternalImports(imports) {
    const packages = new Set();
    for (const imp of imports) {
        if (imp.source.startsWith(".") || imp.source.startsWith("/"))
            continue;
        const parts = imp.source.split("/");
        const name = imp.source.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
        packages.add(name);
    }
    return Array.from(packages).sort();
}
// ─── File metadata ───────────────────────────────────────────────────────────
function toISOLocal(date) {
    return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}
function getFileMeta(filePath) {
    const stat = fs.statSync(filePath);
    return {
        sizeBytes: stat.size,
        createdAt: toISOLocal(stat.birthtime),
        modifiedAt: toISOLocal(stat.mtime),
    };
}
function countLines(content) {
    if (!content)
        return 0;
    return content.split("\n").length;
}
// ─── Walk directory ──────────────────────────────────────────────────────────
function walkDir(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name))
            continue;
        if (entry.name.startsWith(".") && entry.name !== ".env")
            continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(full));
        }
        else {
            const ext = path.extname(entry.name).toLowerCase();
            if (BINARY_EXTENSIONS.has(ext))
                continue;
            if (SKIP_FILES.has(entry.name))
                continue;
            results.push(full);
        }
    }
    return results;
}
// ─── Main indexer ────────────────────────────────────────────────────────────
export function indexDirectory(db, dirPath) {
    const rootDir = path.resolve(dirPath);
    if (!fs.existsSync(rootDir))
        throw new Error(`Directory not found: ${rootDir}`);
    const filePaths = walkDir(rootDir);
    const upsertFile = db.prepare(`
    INSERT INTO files (path, language, extension, size_bytes, line_count, summary, external_imports, created_at, modified_at, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET
      language=excluded.language, extension=excluded.extension,
      size_bytes=excluded.size_bytes, line_count=excluded.line_count,
      summary=excluded.summary, external_imports=excluded.external_imports,
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
            try {
                content = fs.readFileSync(filePath, "utf-8");
            }
            catch {
                continue;
            }
            const lineCount = countLines(content);
            const summary = extractSummary(content, filePath, ext);
            let externals = null;
            if (PARSEABLE_EXTENSIONS.has(ext)) {
                const imports = parseImports(content);
                externals = extractExternalImports(imports).join(", ") || null;
            }
            upsertFile.run(filePath, lang, ext, meta.sizeBytes, lineCount, summary, externals, meta.createdAt, meta.modifiedAt);
            const row = getFileId.get(filePath);
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
            if (!PARSEABLE_EXTENSIONS.has(ext))
                continue;
            const content = fs.readFileSync(filePath, "utf-8");
            const sourceRow = getFileId.get(filePath);
            clearDeps.run(sourceRow.id);
            for (const imp of parseImports(content)) {
                const resolved = resolveImportPath(imp.source, filePath, rootDir);
                if (!resolved)
                    continue;
                const targetRow = getFileId.get(resolved);
                if (!targetRow)
                    continue;
                insertDep.run(sourceRow.id, targetRow.id, imp.symbols.join(", "));
                depCount++;
            }
        }
    });
    indexDeps();
    return { files: filePaths.length, exports: exportCount, deps: depCount };
}
