import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { z } from "zod";
import path from "path";
import { initSchema } from "./schema.js";
import { indexDirectory } from "./indexer.js";
import { initScrumSchema, runMigrations } from "../scrum/schema.js";
import { registerScrumTools } from "../scrum/tools.js";
import { seedDefaults } from "../scrum/defaults.js";

// ─── Config ───────────────────────────────────────────────────────────────────
const DB_PATH = process.argv[2] ?? "./context.db";
const db = new Database(path.resolve(DB_PATH));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

initSchema(db);
initScrumSchema(db);
runMigrations(db);

// Seed factory defaults into empty tables (never overwrites existing data)
const seeded = seedDefaults(db);
if (seeded.agents + seeded.skills > 0) {
  console.error(`[seed] Seeded ${seeded.agents} agents, ${seeded.skills} skills from factory defaults`);
}

const server = new McpServer({ name: "code-context", version: "1.0.0" });

// ─── Tool: index_directory ───────────────────────────────────────────────────
server.tool(
  "index_directory",
  "Scan a directory, parse all files, extract metadata/exports and build a dependency graph. Use freshness_check=true to skip re-indexing if the index is recent (<5 min), returning only a summary (~20 tokens).",
  {
    path: z.string().describe("Absolute path to the directory to index"),
    freshness_check: z.boolean().optional().describe("If true, skip re-indexing when fresh (<5 min). Returns summary only."),
  },
  async ({ path: dirPath, freshness_check }) => {
    try {
      const rootDir = path.resolve(dirPath);

      // Freshness check: skip full re-index if data is recent
      if (freshness_check) {
        const latest = db.prepare(`SELECT MAX(indexed_at) as last_indexed FROM files`).get() as { last_indexed: string | null };
        if (latest?.last_indexed) {
          const lastTime = new Date(latest.last_indexed + "Z").getTime();
          const ageMs = Date.now() - lastTime;
          const ageMin = Math.round(ageMs / 60000);
          if (ageMs < 5 * 60 * 1000) { // < 5 minutes
            const fileCount = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any).c;
            const exportCount = (db.prepare("SELECT COUNT(*) as c FROM exports").get() as any).c;
            const depCount = (db.prepare("SELECT COUNT(*) as c FROM dependencies").get() as any).c;
            return { content: [{ type: "text", text: `Index fresh (${ageMin}m ago): ${fileCount} files, ${exportCount} exports, ${depCount} deps. Skipped re-index.` }] };
          }
        }
      }

      const stats = indexDirectory(db, rootDir);

      // Build structured description output
      const sections: string[] = [];
      sections.push(`# Index Summary\nIndexed ${stats.files} files, ${stats.exports} exports, ${stats.deps} dependencies\n`);

      // Top-level directories with descriptions
      const topDirs = db.prepare(`
        SELECT path, name, description, file_count, total_lines, language_breakdown
        FROM directories WHERE parent_path = ? ORDER BY name
      `).all(rootDir) as { path: string; name: string; description: string | null; file_count: number; total_lines: number; language_breakdown: string | null }[];

      if (topDirs.length > 0) {
        sections.push("## Directories\n");
        for (const dir of topDirs) {
          const desc = dir.description ?? "";
          const langInfo = dir.language_breakdown ? `. ${dir.language_breakdown}` : "";
          sections.push(`### ${dir.name}/\n${desc}${dir.file_count ? ` ${dir.file_count} files, ${(dir.total_lines || 0).toLocaleString()} lines.` : ""}${langInfo}\n`);

          // Files in this directory (direct children only)
          const dirFiles = db.prepare(`
            SELECT path, summary, description, language, line_count
            FROM files WHERE path LIKE ? AND path NOT LIKE ?
            ORDER BY path
          `).all(dir.path + "/%", dir.path + "/%/%") as { path: string; summary: string; description: string | null; language: string; line_count: number }[];

          for (const f of dirFiles) {
            const fname = path.basename(f.path);
            const desc = f.description ?? f.summary ?? "";
            sections.push(`- **${fname}** — ${desc}`);
          }

          // Sub-directories (one level deeper)
          const subDirs = db.prepare(`
            SELECT path, name, description, file_count
            FROM directories WHERE parent_path = ? ORDER BY name
          `).all(dir.path) as { path: string; name: string; description: string | null; file_count: number }[];

          for (const sub of subDirs) {
            sections.push(`- **${sub.name}/** (${sub.file_count} files) — ${sub.description ?? ""}`);
          }
          sections.push("");
        }
      }

      // Root-level files (not inside any subdirectory)
      const rootFiles = db.prepare(`
        SELECT path, summary, description, language, line_count
        FROM files WHERE path LIKE ? AND path NOT LIKE ?
        ORDER BY path
      `).all(rootDir + "/%", rootDir + "/%/%") as { path: string; summary: string; description: string | null; language: string; line_count: number }[];

      if (rootFiles.length > 0) {
        sections.push("## Root Files\n");
        for (const f of rootFiles) {
          const fname = path.basename(f.path);
          const desc = f.description ?? f.summary ?? "No description";
          sections.push(`- **${fname}** — ${desc}`);
        }
        sections.push("");
      }

      return { content: [{ type: "text", text: sections.join("\n") }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Tool: find_symbol ───────────────────────────────────────────────────────
server.tool(
  "find_symbol",
  "Find which file(s) export a given function, component, type, or constant",
  { name: z.string().describe("Symbol name to search for (supports % wildcards)") },
  async ({ name }) => {
    const rows = db.prepare(`
      SELECT e.name, e.kind, f.path, f.summary
      FROM exports e JOIN files f ON e.file_id = f.id
      WHERE e.name LIKE ?
      ORDER BY e.name
    `).all(name) as { name: string; kind: string; path: string; summary: string }[];

    if (rows.length === 0) {
      return { content: [{ type: "text", text: `No exports matching "${name}" found.` }] };
    }

    const text = rows.map(r => `${r.name} (${r.kind}) — ${r.path}\n  ${r.summary}`).join("\n\n");
    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool: get_file_context ──────────────────────────────────────────────────
server.tool(
  "get_file_context",
  "Get a file's summary, its exports, what it imports (dependencies), and what imports it (dependents). Use include_changes=false to skip change history and save tokens.",
  {
    path: z.string().describe("Absolute file path"),
    include_changes: z.boolean().optional().describe("Include recent change history with diffs (default: false). Set to true when debugging or investigating changes."),
    change_limit: z.number().optional().describe("Max number of recent changes to include (default: 3)"),
  },
  async ({ path: filePath, include_changes, change_limit }) => {
    const file = db.prepare(`SELECT * FROM files WHERE path = ?`)
      .get(filePath) as any | undefined;

    if (!file) {
      return { content: [{ type: "text", text: `File "${filePath}" not in index. Run index_directory first.` }] };
    }

    const exports = db.prepare(`SELECT name, kind FROM exports WHERE file_id = ?`)
      .all(file.id) as { name: string; kind: string }[];

    const deps = db.prepare(`
      SELECT f.path, f.summary, d.symbols
      FROM dependencies d JOIN files f ON d.target_id = f.id
      WHERE d.source_id = ?
    `).all(file.id) as { path: string; summary: string; symbols: string }[];

    const dependents = db.prepare(`
      SELECT f.path, f.summary, d.symbols
      FROM dependencies d JOIN files f ON d.source_id = f.id
      WHERE d.target_id = ?
    `).all(file.id) as { path: string; summary: string; symbols: string }[];

    function formatSize(bytes: number): string {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    const sections = [
      `# ${file.path}`,
      `${file.language} | ${formatSize(file.size_bytes)} | ${file.line_count} lines | modified ${file.modified_at}`,
      file.summary,
      file.description && file.description !== file.summary ? file.description : "",
      exports.length > 0 ? `## Exports (${exports.length})\n${exports.map(e => `- ${e.name} (${e.kind})`).join("\n")}` : "",
      file.external_imports ? `## External packages\n${file.external_imports}` : "",
      deps.length > 0 ? `## Imports from (${deps.length})\n${deps.map(d => `- ${d.path} [${d.symbols}]`).join("\n")}` : "",
      dependents.length > 0 ? `## Imported by (${dependents.length})\n${dependents.map(d => `- ${d.path} [${d.symbols}]`).join("\n")}` : "",
    ];

    // Only include change history if explicitly requested (default: false to save tokens)
    const shouldIncludeChanges = include_changes === true;
    if (shouldIncludeChanges) {
      const maxChanges = change_limit ?? 3;
      const changes = db.prepare(`
        SELECT event, timestamp, old_summary, new_summary,
               old_line_count, new_line_count, old_size_bytes, new_size_bytes,
               old_exports, new_exports, diff_text, reason
        FROM changes WHERE file_path = ? ORDER BY timestamp DESC LIMIT ?
      `).all(filePath, maxChanges) as any[];

      sections.push("", `## Recent changes (${changes.length})`);
      for (const c of changes) {
        const parts = [`- **${c.event}** at ${c.timestamp}`];
        if (c.old_line_count != null && c.new_line_count != null) {
          const delta = c.new_line_count - c.old_line_count;
          parts.push(`  Lines: ${c.old_line_count} → ${c.new_line_count} (${delta >= 0 ? "+" : ""}${delta})`);
        }
        if (c.old_size_bytes != null && c.new_size_bytes != null) {
          const delta = c.new_size_bytes - c.old_size_bytes;
          parts.push(`  Size: ${c.old_size_bytes}B → ${c.new_size_bytes}B (${delta >= 0 ? "+" : ""}${delta})`);
        }
        if (c.new_summary && c.new_summary !== c.old_summary) {
          parts.push(`  Summary: ${c.new_summary}`);
        }
        if (c.old_exports !== c.new_exports && (c.old_exports || c.new_exports)) {
          parts.push(`  Exports: ${c.old_exports ?? "(none)"} → ${c.new_exports ?? "(none)"}`);
        }
        if (c.reason) {
          parts.push(`  Reason: ${c.reason}`);
        }
        if (c.diff_text) {
          parts.push(`  Diff:\n${c.diff_text.split("\n").map((l: string) => `    ${l}`).join("\n")}`);
        }
        sections.push(parts.join("\n"));
      }
    }

    return { content: [{ type: "text", text: sections.join("\n") }] };
  }
);

// ─── Tool: set_description ───────────────────────────────────────────────────
server.tool(
  "set_description",
  "Set a manual description for a file (persists across re-indexes)",
  {
    path: z.string().describe("Absolute file path"),
    description: z.string().describe("Description of what the file does"),
  },
  async ({ path: filePath, description }) => {
    const result = db.prepare(`UPDATE files SET description = ? WHERE path = ?`).run(description, filePath);
    if (result.changes === 0) {
      return { content: [{ type: "text", text: `File "${filePath}" not in index.` }], isError: true };
    }
    return { content: [{ type: "text", text: `Description set for ${filePath}` }] };
  }
);

// ─── Tool: set_directory_description ─────────────────────────────────────────
server.tool(
  "set_directory_description",
  "Set a manual description for a directory (persists across re-indexes)",
  {
    path: z.string().describe("Absolute directory path"),
    description: z.string().describe("Description of what the directory contains"),
  },
  async ({ path: dirPath, description }) => {
    const result = db.prepare(`UPDATE directories SET description = ? WHERE path = ?`).run(description, dirPath);
    if (result.changes === 0) {
      return { content: [{ type: "text", text: `Directory "${dirPath}" not in index.` }], isError: true };
    }
    return { content: [{ type: "text", text: `Description set for ${dirPath}` }] };
  }
);

// ─── Tool: set_change_reason ─────────────────────────────────────────────────
server.tool(
  "set_change_reason",
  "Set a reason/explanation for a recorded file change",
  {
    id: z.number().describe("Change ID"),
    reason: z.string().describe("Why this change was made"),
  },
  async ({ id, reason }) => {
    const result = db.prepare(`UPDATE changes SET reason = ? WHERE id = ?`).run(reason, id);
    if (result.changes === 0) {
      return { content: [{ type: "text", text: `Change ${id} not found.` }], isError: true };
    }
    return { content: [{ type: "text", text: `Reason set for change ${id}` }] };
  }
);

// ─── Tool: get_changes ───────────────────────────────────────────────────────
server.tool(
  "get_changes",
  "Get recent file changes grouped by file path, showing what changed (size, lines, exports, summary diffs)",
  {
    file_path: z.string().optional().describe("Filter to a specific file path (supports % wildcards)"),
    limit: z.number().optional().describe("Max changes to return (default 50)"),
  },
  async ({ file_path, limit }) => {
    const maxRows = limit ?? 50;
    let rows: any[];

    if (file_path) {
      const pattern = file_path.includes("%") ? file_path : `%${file_path}%`;
      rows = db.prepare(`
        SELECT file_path, event, timestamp,
               old_summary, new_summary,
               old_line_count, new_line_count,
               old_size_bytes, new_size_bytes,
               old_exports, new_exports, reason
        FROM changes
        WHERE file_path LIKE ?
        ORDER BY file_path, timestamp DESC
        LIMIT ?
      `).all(pattern, maxRows);
    } else {
      rows = db.prepare(`
        SELECT file_path, event, timestamp,
               old_summary, new_summary,
               old_line_count, new_line_count,
               old_size_bytes, new_size_bytes,
               old_exports, new_exports, reason
        FROM changes
        ORDER BY file_path, timestamp DESC
        LIMIT ?
      `).all(maxRows);
    }

    if (rows.length === 0) {
      return { content: [{ type: "text", text: "No changes recorded." }] };
    }

    // Group by file
    const grouped = new Map<string, any[]>();
    for (const row of rows) {
      const arr = grouped.get(row.file_path) ?? [];
      arr.push(row);
      grouped.set(row.file_path, arr);
    }

    const sections: string[] = [];
    for (const [filePath, changes] of grouped) {
      const lines = [`## ${filePath} (${changes.length} change${changes.length > 1 ? "s" : ""})`];
      for (const c of changes) {
        const parts = [`- **${c.event}** at ${c.timestamp}`];
        if (c.old_line_count != null && c.new_line_count != null) {
          const delta = c.new_line_count - c.old_line_count;
          parts.push(`  Lines: ${c.old_line_count} → ${c.new_line_count} (${delta >= 0 ? "+" : ""}${delta})`);
        }
        if (c.old_size_bytes != null && c.new_size_bytes != null) {
          const delta = c.new_size_bytes - c.old_size_bytes;
          parts.push(`  Size: ${c.old_size_bytes}B → ${c.new_size_bytes}B (${delta >= 0 ? "+" : ""}${delta})`);
        }
        if (c.new_summary && c.new_summary !== c.old_summary) {
          parts.push(`  Summary: ${c.new_summary}`);
        }
        if (c.old_exports !== c.new_exports && (c.old_exports || c.new_exports)) {
          parts.push(`  Exports: ${c.old_exports ?? "(none)"} → ${c.new_exports ?? "(none)"}`);
        }
        lines.push(parts.join("\n"));
      }
      sections.push(lines.join("\n"));
    }

    return { content: [{ type: "text", text: sections.join("\n\n") }] };
  }
);

// ─── Tool: search_files ──────────────────────────────────────────────────────
server.tool(
  "search_files",
  "Search indexed files by path or summary (supports % wildcards)",
  { query: z.string().describe("Search term (matched against path and summary, use % for wildcards)") },
  async ({ query }) => {
    const pattern = query.includes("%") ? query : `%${query}%`;
    const rows = db.prepare(`
      SELECT path, language, extension, size_bytes, line_count, summary, created_at, modified_at,
        (SELECT COUNT(*) FROM exports WHERE file_id = files.id) as export_count,
        (SELECT COUNT(*) FROM dependencies WHERE source_id = files.id) as dep_count
      FROM files
      WHERE path LIKE ? OR summary LIKE ?
      ORDER BY path
      LIMIT 25
    `).all(pattern, pattern) as any[];

    if (rows.length === 0) {
      return { content: [{ type: "text", text: `No files matching "${query}".` }] };
    }

    const text = rows.map(r =>
      `${r.path} (${r.language}, ${r.line_count} lines, ${r.export_count} exports, ${r.dep_count} deps)\n  Modified: ${r.modified_at} | ${r.summary}`
    ).join("\n\n");
    return { content: [{ type: "text", text }] };
  }
);

// ─── Tool: query (escape hatch) ──────────────────────────────────────────────
server.tool(
  "query",
  "Run a read-only SELECT query against the context database",
  { sql: z.string().describe("A SELECT SQL statement") },
  async ({ sql }) => {
    const trimmed = sql.trim().toLowerCase();
    if (!trimmed.startsWith("select")) {
      return { content: [{ type: "text", text: "Only SELECT statements allowed. Use execute() for writes." }], isError: true };
    }
    if (/\b(drop|alter|delete|insert|update|create)\b/i.test(sql)) {
      return { content: [{ type: "text", text: "Dangerous SQL detected in query. Only pure SELECT allowed." }], isError: true };
    }
    try {
      const rows = db.prepare(sql).all();
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `SQL Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Tool: execute (escape hatch) ────────────────────────────────────────────
server.tool(
  "execute",
  "Run an INSERT, UPDATE, or DELETE against the context database",
  {
    sql: z.string().describe("A write SQL statement (INSERT, UPDATE, DELETE only — no DROP or ALTER)"),
    params: z.array(z.any()).optional().describe("Optional positional parameters"),
  },
  async ({ sql, params = [] }) => {
    const trimmed = sql.trim().toLowerCase();
    if (trimmed.startsWith("select")) {
      return { content: [{ type: "text", text: "Use query() for SELECT." }], isError: true };
    }
    if (/\b(drop\s+table|alter\s+table|drop\s+index)\b/i.test(sql)) {
      return { content: [{ type: "text", text: "DROP TABLE, ALTER TABLE, and DROP INDEX are not allowed." }], isError: true };
    }
    try {
      const result = db.prepare(sql).run(...params);
      return {
        content: [{ type: "text", text: `Rows affected: ${result.changes}, last id: ${result.lastInsertRowid}` }],
      };
    } catch (err: any) {
      return { content: [{ type: "text", text: `SQL Error: ${err.message}` }], isError: true };
    }
  }
);

// ─── Health Check ───────────────────────────────────────────────────────────────
server.tool(
  "health",
  "Check server health and connectivity",
  {},
  async () => {
    const startTime = Date.now();
    let dbHealthy = false;
    let dbError: string | null = null;

    try {
      db.prepare("SELECT 1").get();
      dbHealthy = true;
    } catch (err: any) {
      dbError = err.message;
    }

    const fileCount = db.prepare("SELECT COUNT(*) as c FROM files").get() as { c: number };
    const sprintCount = db.prepare("SELECT COUNT(*) as c FROM sprints").get() as { c: number };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: dbHealthy ? "healthy" : "unhealthy",
          timestamp: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
          database: {
            connected: dbHealthy,
            error: dbError,
            files_indexed: fileCount?.c ?? 0,
            sprints: sprintCount?.c ?? 0,
          },
        }, null, 2),
      }],
      isError: !dbHealthy,
    };
  }
);

// ─── Scrum tools ─────────────────────────────────────────────────────────────
registerScrumTools(server, db);

// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`code-context MCP server running — db: ${DB_PATH}`);
