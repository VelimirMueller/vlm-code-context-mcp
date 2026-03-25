import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { z } from "zod";
import path from "path";
import { initSchema } from "./schema.js";
import { indexDirectory } from "./indexer.js";
// ─── Config ───────────────────────────────────────────────────────────────────
const DB_PATH = process.argv[2] ?? "./context.db";
const db = new Database(path.resolve(DB_PATH));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
initSchema(db);
const server = new McpServer({ name: "code-context", version: "1.0.0" });
// ─── Tool: index_directory ───────────────────────────────────────────────────
server.tool("index_directory", "Scan a directory, parse all files, extract metadata/exports and build a dependency graph", { path: z.string().describe("Absolute path to the directory to index") }, async ({ path: dirPath }) => {
    try {
        const stats = indexDirectory(db, dirPath);
        return {
            content: [{
                    type: "text",
                    text: `Indexed ${stats.files} files, ${stats.exports} exports, ${stats.deps} dependencies`,
                }],
        };
    }
    catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
});
// ─── Tool: find_symbol ───────────────────────────────────────────────────────
server.tool("find_symbol", "Find which file(s) export a given function, component, type, or constant", { name: z.string().describe("Symbol name to search for (supports % wildcards)") }, async ({ name }) => {
    const rows = db.prepare(`
      SELECT e.name, e.kind, f.path, f.summary
      FROM exports e JOIN files f ON e.file_id = f.id
      WHERE e.name LIKE ?
      ORDER BY e.name
    `).all(name);
    if (rows.length === 0) {
        return { content: [{ type: "text", text: `No exports matching "${name}" found.` }] };
    }
    const text = rows.map(r => `${r.name} (${r.kind}) — ${r.path}\n  ${r.summary}`).join("\n\n");
    return { content: [{ type: "text", text }] };
});
// ─── Tool: get_file_context ──────────────────────────────────────────────────
server.tool("get_file_context", "Get a file's summary, its exports, what it imports (dependencies), and what imports it (dependents)", { path: z.string().describe("Absolute file path") }, async ({ path: filePath }) => {
    const file = db.prepare(`SELECT * FROM files WHERE path = ?`)
        .get(filePath);
    if (!file) {
        return { content: [{ type: "text", text: `File "${filePath}" not in index. Run index_directory first.` }] };
    }
    const exports = db.prepare(`SELECT name, kind FROM exports WHERE file_id = ?`)
        .all(file.id);
    const deps = db.prepare(`
      SELECT f.path, f.summary, d.symbols
      FROM dependencies d JOIN files f ON d.target_id = f.id
      WHERE d.source_id = ?
    `).all(file.id);
    const dependents = db.prepare(`
      SELECT f.path, f.summary, d.symbols
      FROM dependencies d JOIN files f ON d.source_id = f.id
      WHERE d.target_id = ?
    `).all(file.id);
    function formatSize(bytes) {
        if (bytes < 1024)
            return bytes + " B";
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }
    const sections = [
        `# ${file.path}`,
        `Language: ${file.language} | Extension: ${file.extension} | Size: ${formatSize(file.size_bytes)} | Lines: ${file.line_count}`,
        `Created: ${file.created_at} | Modified: ${file.modified_at} | Indexed: ${file.indexed_at}`,
        `Summary: ${file.summary}`,
        "",
        `## Exports (${exports.length})`,
        ...exports.map(e => `  - ${e.name} (${e.kind})`),
        "",
        file.external_imports ? `## External packages\n  ${file.external_imports}` : "",
        "",
        `## Imports from (${deps.length})`,
        ...deps.map(d => `  - ${d.path} [${d.symbols}]\n    ${d.summary}`),
        "",
        `## Imported by (${dependents.length})`,
        ...dependents.map(d => `  - ${d.path} [${d.symbols}]\n    ${d.summary}`),
    ];
    return { content: [{ type: "text", text: sections.join("\n") }] };
});
// ─── Tool: search_files ──────────────────────────────────────────────────────
server.tool("search_files", "Search indexed files by path or summary (supports % wildcards)", { query: z.string().describe("Search term (matched against path and summary, use % for wildcards)") }, async ({ query }) => {
    const pattern = query.includes("%") ? query : `%${query}%`;
    const rows = db.prepare(`
      SELECT path, language, extension, size_bytes, line_count, summary, created_at, modified_at,
        (SELECT COUNT(*) FROM exports WHERE file_id = files.id) as export_count,
        (SELECT COUNT(*) FROM dependencies WHERE source_id = files.id) as dep_count
      FROM files
      WHERE path LIKE ? OR summary LIKE ?
      ORDER BY path
      LIMIT 25
    `).all(pattern, pattern);
    if (rows.length === 0) {
        return { content: [{ type: "text", text: `No files matching "${query}".` }] };
    }
    const text = rows.map(r => `${r.path} (${r.language}, ${r.line_count} lines, ${r.export_count} exports, ${r.dep_count} deps)\n  Modified: ${r.modified_at} | ${r.summary}`).join("\n\n");
    return { content: [{ type: "text", text }] };
});
// ─── Tool: query (escape hatch) ──────────────────────────────────────────────
server.tool("query", "Run a read-only SELECT query against the context database", { sql: z.string().describe("A SELECT SQL statement") }, async ({ sql }) => {
    if (!sql.trim().toLowerCase().startsWith("select")) {
        return { content: [{ type: "text", text: "Only SELECT statements allowed. Use execute() for writes." }], isError: true };
    }
    try {
        const rows = db.prepare(sql).all();
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: "text", text: `SQL Error: ${err.message}` }], isError: true };
    }
});
// ─── Tool: execute (escape hatch) ────────────────────────────────────────────
server.tool("execute", "Run an INSERT, UPDATE, or DELETE against the context database", {
    sql: z.string().describe("A write SQL statement"),
    params: z.array(z.any()).optional().describe("Optional positional parameters"),
}, async ({ sql, params = [] }) => {
    if (sql.trim().toLowerCase().startsWith("select")) {
        return { content: [{ type: "text", text: "Use query() for SELECT." }], isError: true };
    }
    try {
        const result = db.prepare(sql).run(...params);
        return {
            content: [{ type: "text", text: `Rows affected: ${result.changes}, last id: ${result.lastInsertRowid}` }],
        };
    }
    catch (err) {
        return { content: [{ type: "text", text: `SQL Error: ${err.message}` }], isError: true };
    }
});
// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`code-context MCP server running — db: ${DB_PATH}`);
