# Sprint 11: MCP Project Bootstrap & DB Dump — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **MCP Integration:** All ticket status updates must go through MCP tools. Before starting a task: update_ticket status=IN_PROGRESS. After completing: update_ticket status=DONE, qa_verified=true. Sprint ID: 179.

**Goal:** Enable Claude to fully set up a project via MCP after npm install. Add database dump/restore so progress persists across sessions and reinstalls.

**Architecture:** New MCP tools for project setup and DB persistence. CLI setup command. Dashboard UI for dump/restore. The setup flow: npm install → code-context-mcp setup → MCP tools available → Claude can index, create sprints, manage team.

**Tech Stack:** TypeScript, better-sqlite3, Zod, MCP SDK, Node.js CLI

---

## Table of Contents

| Task | Ticket | Title | Points | Assignee |
|------|--------|-------|--------|----------|
| 1 | T-066 | MCP Project Setup Tool | 5 | Backend Developer |
| 2 | T-067 | Database Dump/Restore Tools | 5 | Backend Developer |
| 3 | T-068 | Onboarding Wizard MCP Flow | 3 | Backend Developer |
| 4 | T-069 | Dashboard API for Dump/Restore | 3 | Frontend Developer + Backend Developer |
| 5 | T-070 | npm postinstall + CLI Setup Command | 3 | Architect |

**Total: 19 story points**

---

## Task 1: T-066 — MCP Project Setup Tool (5pt)

**Assignee:** Backend Developer
**Files to create/modify:**
- `src/bootstrap/setup-tools.ts` (NEW) — setup_project and get_project_status tool implementations
- `src/server/index.ts` — register bootstrap tools
- `src/bootstrap/index.ts` (NEW) — barrel export

### Implementation Steps

- [ ] **1.1 Create `src/bootstrap/setup-tools.ts`**

  This file exports a `registerBootstrapTools(server, db)` function following the exact pattern in `src/scrum/tools.ts`.

  ```typescript
  import type Database from "better-sqlite3";
  import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";
  import fs from "fs";
  import path from "path";

  export function registerBootstrapTools(server: McpServer, db: Database.Database): void {

    server.tool(
      "setup_project",
      "Initialize a project for code-context: creates .code-context/ dir, SQLite database with full schema, indexes codebase, imports agents and sprint templates",
      {
        project_path: z.string().describe("Absolute path to the project root directory"),
        project_name: z.string().optional().describe("Human-readable project name (defaults to directory name)"),
      },
      async ({ project_path, project_name }) => {
        try {
          const resolvedPath = path.resolve(project_path);
          const name = project_name || path.basename(resolvedPath);

          // 1. Create .code-context/ directory
          const contextDir = path.join(resolvedPath, ".code-context");
          if (!fs.existsSync(contextDir)) {
            fs.mkdirSync(contextDir, { recursive: true });
          }

          // 2. Initialize SQLite database with full schema
          const dbPath = path.join(contextDir, "context.db");
          const Database = (await import("better-sqlite3")).default;
          const projectDb = new Database(dbPath);
          projectDb.pragma("journal_mode = WAL");
          projectDb.pragma("foreign_keys = ON");

          const { initSchema } = await import("../server/schema.js");
          const { initScrumSchema } = await import("../scrum/schema.js");
          initSchema(projectDb);
          initScrumSchema(projectDb);

          // 3. Run initial codebase indexing
          const { indexDirectory } = await import("../server/indexer.js");
          const stats = indexDirectory(projectDb, resolvedPath);

          // 4. Import agents from .claude/agents/ if they exist
          let agentCount = 0;
          let sprintCount = 0;
          let skillCount = 0;
          const claudeDir = path.join(resolvedPath, ".claude");
          if (fs.existsSync(claudeDir)) {
            const { importScrumData } = await import("../scrum/import.js");
            const importResult = importScrumData(projectDb, claudeDir);
            agentCount = importResult.agents;
            sprintCount = importResult.sprints;
            skillCount = importResult.skills;
          }

          projectDb.close();

          const summary = [
            `# Project Setup Complete: ${name}`,
            ``,
            `- Database: ${dbPath}`,
            `- Files indexed: ${stats.files}`,
            `- Exports found: ${stats.exports}`,
            `- Dependencies mapped: ${stats.deps}`,
            `- Agents loaded: ${agentCount}`,
            `- Sprints imported: ${sprintCount}`,
            `- Skills imported: ${skillCount}`,
          ].join("\n");

          return { content: [{ type: "text" as const, text: summary }] };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Setup error: ${err.message}` }], isError: true };
        }
      }
    );

    server.tool(
      "get_project_status",
      "Check whether the project is initialized and return summary stats: file count, sprint count, agent count, database path and size",
      {},
      async () => {
        try {
          const fileCount = (db.prepare(`SELECT COUNT(*) as c FROM files`).get() as any).c;
          const sprintCount = (db.prepare(`SELECT COUNT(*) as c FROM sprints`).get() as any).c;
          const agentCount = (db.prepare(`SELECT COUNT(*) as c FROM agents`).get() as any).c;
          const exportCount = (db.prepare(`SELECT COUNT(*) as c FROM exports`).get() as any).c;
          const ticketCount = (db.prepare(`SELECT COUNT(*) as c FROM tickets`).get() as any).c;

          // Get DB file path and size
          const dbPathRow = db.prepare(`PRAGMA database_list`).get() as any;
          const dbFilePath = dbPathRow?.file || "unknown";
          let dbSizeBytes = 0;
          try {
            const stat = fs.statSync(dbFilePath);
            dbSizeBytes = stat.size;
          } catch {}

          // Get last indexed timestamp
          const lastIndexed = (db.prepare(`SELECT MAX(indexed_at) as ts FROM files`).get() as any)?.ts || null;

          const status = {
            is_initialized: fileCount > 0,
            file_count: fileCount,
            export_count: exportCount,
            sprint_count: sprintCount,
            agent_count: agentCount,
            ticket_count: ticketCount,
            db_path: dbFilePath,
            db_size_bytes: dbSizeBytes,
            last_indexed: lastIndexed,
          };

          const text = [
            `# Project Status`,
            ``,
            `Initialized: ${status.is_initialized ? "Yes" : "No"}`,
            `Database: ${status.db_path} (${(status.db_size_bytes / 1024).toFixed(1)} KB)`,
            `Files indexed: ${status.file_count}`,
            `Exports: ${status.export_count}`,
            `Sprints: ${status.sprint_count}`,
            `Agents: ${status.agent_count}`,
            `Tickets: ${status.ticket_count}`,
            `Last indexed: ${status.last_indexed || "never"}`,
          ].join("\n");

          return { content: [{ type: "text" as const, text }] };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Status error: ${err.message}` }], isError: true };
        }
      }
    );
  }
  ```

- [ ] **1.2 Create `src/bootstrap/index.ts` barrel export**

  ```typescript
  export { registerBootstrapTools } from "./setup-tools.js";
  ```

- [ ] **1.3 Register bootstrap tools in `src/server/index.ts`**

  Add after line 9 (existing imports):
  ```typescript
  import { registerBootstrapTools } from "../bootstrap/setup-tools.js";
  ```

  Add after line 369 (`registerScrumTools(server, db);`):
  ```typescript
  registerBootstrapTools(server, db);
  ```

- [ ] **1.4 Write tests in `tests/bootstrap-setup.test.ts`**

  Test cases:
  - `setup_project` creates `.code-context/` dir and `context.db` in a temp directory
  - `setup_project` initializes all schema tables (files, exports, dependencies, directories, changes, agents, sprints, tickets, subtasks, retro_findings, blockers, bugs, skills, processes, milestones)
  - `setup_project` indexes TS/JS files from the temp directory
  - `setup_project` imports agents when `.claude/agents/` exists
  - `setup_project` returns correct summary counts
  - `get_project_status` returns correct is_initialized, file_count, db_size_bytes
  - `get_project_status` returns last_indexed timestamp

  ```bash
  npx vitest run tests/bootstrap-setup.test.ts
  ```

- [ ] **1.5 Verify build compiles**

  ```bash
  npm run build
  ```

**Commit message:** `feat(bootstrap): add setup_project and get_project_status MCP tools (T-066)`

---

## Task 2: T-067 — Database Dump/Restore Tools (5pt)

**Assignee:** Backend Developer
**Files to create/modify:**
- `src/bootstrap/dump-tools.ts` (NEW) — dump_database, restore_database, export_to_file, import_from_file
- `src/bootstrap/index.ts` — add export
- `src/server/index.ts` — register dump tools

### Implementation Steps

- [ ] **2.1 Create `src/bootstrap/dump-tools.ts`**

  Exports `registerDumpTools(server, db)` following the existing tool pattern.

  **CRITICAL: Foreign key ordering for restore.** Tables must be inserted in this order to satisfy foreign key constraints:
  1. `milestones` (no FK dependencies)
  2. `agents` (no FK dependencies)
  3. `skills` (no FK dependencies)
  4. `processes` (no FK dependencies)
  5. `files` (no FK dependencies)
  6. `directories` (no FK dependencies)
  7. `sprints` (no FK dependencies)
  8. `exports` (depends on files)
  9. `dependencies` (depends on files)
  10. `changes` (no FK but logically depends on files)
  11. `tickets` (depends on sprints, milestones)
  12. `subtasks` (depends on tickets)
  13. `retro_findings` (depends on sprints)
  14. `blockers` (depends on sprints, tickets)
  15. `bugs` (depends on sprints, tickets)

  ```typescript
  import type Database from "better-sqlite3";
  import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";
  import fs from "fs";

  const DUMP_VERSION = "2.0.0";

  // Order matters: tables with no FK deps first, then dependents
  const TABLE_ORDER = [
    "milestones", "agents", "skills", "processes",
    "files", "directories", "sprints",
    "exports", "dependencies", "changes",
    "tickets",
    "subtasks", "retro_findings", "blockers", "bugs",
  ];

  function dumpAllTables(db: Database.Database, tableFilter?: string[]): Record<string, any[]> {
    const tables: Record<string, any[]> = {};
    const targetTables = tableFilter && tableFilter.length > 0
      ? TABLE_ORDER.filter(t => tableFilter.includes(t))
      : TABLE_ORDER;

    for (const table of targetTables) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        tables[table] = rows;
      } catch {
        // Table may not exist, skip
        tables[table] = [];
      }
    }
    return tables;
  }

  function restoreFromDump(
    db: Database.Database,
    dump: { version: string; tables: Record<string, any[]> }
  ): { tables_restored: string[]; rows_per_table: Record<string, number>; errors: string[] } {
    const results = {
      tables_restored: [] as string[],
      rows_per_table: {} as Record<string, number>,
      errors: [] as string[],
    };

    // Validate version
    if (!dump.version || !dump.version.startsWith("2.")) {
      results.errors.push(`Incompatible dump version: ${dump.version}. Expected 2.x.x`);
      return results;
    }

    const restore = db.transaction(() => {
      // Temporarily disable FK checks for clean restore
      db.pragma("foreign_keys = OFF");

      for (const table of TABLE_ORDER) {
        const rows = dump.tables[table];
        if (!rows || rows.length === 0) continue;

        try {
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => "?").join(", ");
          const stmt = db.prepare(
            `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
          );

          let count = 0;
          for (const row of rows) {
            stmt.run(...columns.map(c => row[c] ?? null));
            count++;
          }
          results.tables_restored.push(table);
          results.rows_per_table[table] = count;
        } catch (err: any) {
          results.errors.push(`${table}: ${err.message}`);
        }
      }

      db.pragma("foreign_keys = ON");
    });

    restore();
    return results;
  }

  export function registerDumpTools(server: McpServer, db: Database.Database): void {

    server.tool(
      "dump_database",
      "Export the entire SQLite database to JSON format. Returns versioned JSON with all table data for backup or transfer.",
      {
        tables: z.array(z.string()).optional().describe("Optional: specific table names to export. Omit for all tables."),
      },
      async ({ tables: tableFilter }) => {
        try {
          const tables = dumpAllTables(db, tableFilter);
          const dump = {
            version: DUMP_VERSION,
            exported_at: new Date().toISOString(),
            tables,
          };
          const json = JSON.stringify(dump, null, 2);
          const tableCount = Object.keys(tables).length;
          const rowCount = Object.values(tables).reduce((s, rows) => s + rows.length, 0);

          return {
            content: [
              { type: "text" as const, text: `Exported ${tableCount} tables, ${rowCount} total rows.\n\n${json}` },
            ],
          };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Dump error: ${err.message}` }], isError: true };
        }
      }
    );

    server.tool(
      "restore_database",
      "Import a JSON dump back into the database. Uses INSERT OR REPLACE for idempotent restore. Wraps in a transaction.",
      {
        dump_json: z.string().describe("The full JSON string from dump_database output"),
      },
      async ({ dump_json }) => {
        try {
          const dump = JSON.parse(dump_json);
          if (!dump.version || !dump.tables) {
            return { content: [{ type: "text" as const, text: "Invalid dump format: missing version or tables." }], isError: true };
          }
          const results = restoreFromDump(db, dump);
          const summary = [
            `# Restore Complete`,
            ``,
            `Tables restored: ${results.tables_restored.join(", ")}`,
            ...results.tables_restored.map(t => `  ${t}: ${results.rows_per_table[t]} rows`),
            results.errors.length > 0 ? `\nErrors:\n${results.errors.map(e => `  - ${e}`).join("\n")}` : "",
          ].join("\n");

          return { content: [{ type: "text" as const, text: summary }] };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Restore error: ${err.message}` }], isError: true };
        }
      }
    );

    server.tool(
      "export_to_file",
      "Dump the database and write it to a JSON file on disk",
      {
        output_path: z.string().optional().describe("File path to write (default: ./code-context-dump.json)"),
      },
      async ({ output_path }) => {
        try {
          const filePath = output_path || "./code-context-dump.json";
          const resolvedPath = require("path").resolve(filePath);
          const tables = dumpAllTables(db);
          const dump = {
            version: DUMP_VERSION,
            exported_at: new Date().toISOString(),
            tables,
          };
          const json = JSON.stringify(dump, null, 2);
          fs.writeFileSync(resolvedPath, json, "utf-8");

          const stat = fs.statSync(resolvedPath);
          const rowCount = Object.values(tables).reduce((s, rows) => s + rows.length, 0);

          return {
            content: [{
              type: "text" as const,
              text: `Database exported to ${resolvedPath}\nFile size: ${(stat.size / 1024).toFixed(1)} KB\nTotal rows: ${rowCount}`,
            }],
          };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Export error: ${err.message}` }], isError: true };
        }
      }
    );

    server.tool(
      "import_from_file",
      "Read a JSON dump file from disk and restore it into the database",
      {
        input_path: z.string().describe("Path to the JSON dump file"),
      },
      async ({ input_path }) => {
        try {
          const resolvedPath = require("path").resolve(input_path);
          if (!fs.existsSync(resolvedPath)) {
            return { content: [{ type: "text" as const, text: `File not found: ${resolvedPath}` }], isError: true };
          }
          const json = fs.readFileSync(resolvedPath, "utf-8");
          const dump = JSON.parse(json);
          if (!dump.version || !dump.tables) {
            return { content: [{ type: "text" as const, text: "Invalid dump format: missing version or tables." }], isError: true };
          }
          const results = restoreFromDump(db, dump);
          const summary = [
            `# Restore from ${resolvedPath}`,
            ``,
            `Dump version: ${dump.version}`,
            `Exported at: ${dump.exported_at}`,
            `Tables restored: ${results.tables_restored.length}`,
            ...results.tables_restored.map(t => `  ${t}: ${results.rows_per_table[t]} rows`),
            results.errors.length > 0 ? `\nErrors:\n${results.errors.map(e => `  - ${e}`).join("\n")}` : "",
          ].join("\n");

          return { content: [{ type: "text" as const, text: summary }] };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Import error: ${err.message}` }], isError: true };
        }
      }
    );
  }
  ```

- [ ] **2.2 Update `src/bootstrap/index.ts`**

  ```typescript
  export { registerBootstrapTools } from "./setup-tools.js";
  export { registerDumpTools } from "./dump-tools.js";
  ```

- [ ] **2.3 Register dump tools in `src/server/index.ts`**

  Add import:
  ```typescript
  import { registerDumpTools } from "../bootstrap/dump-tools.js";
  ```

  Add after bootstrap tools registration:
  ```typescript
  registerDumpTools(server, db);
  ```

- [ ] **2.4 Write tests in `tests/dump-restore.test.ts`**

  Test cases:
  - `dump_database` returns JSON with version field "2.0.0" and exported_at ISO string
  - `dump_database` includes all 15 tables when called without filter
  - `dump_database` with `tables: ["agents", "sprints"]` returns only those 2 tables
  - `restore_database` with valid dump inserts rows correctly
  - `restore_database` is idempotent (running twice produces same result)
  - `restore_database` rejects incompatible version (e.g., "1.0.0")
  - `restore_database` handles foreign key ordering (tickets after sprints)
  - `export_to_file` creates a valid JSON file on disk
  - `import_from_file` reads file and restores correctly
  - `import_from_file` returns error for missing file
  - Round-trip test: dump -> restore to new DB -> dump again -> compare

  ```bash
  npx vitest run tests/dump-restore.test.ts
  ```

- [ ] **2.5 Verify build compiles**

  ```bash
  npm run build
  ```

**Commit message:** `feat(bootstrap): add dump_database, restore_database, export_to_file, import_from_file MCP tools (T-067)`

---

## Task 3: T-068 — Onboarding Wizard MCP Flow (3pt)

**Assignee:** Backend Developer
**Files to create/modify:**
- `src/bootstrap/onboarding-tools.ts` (NEW) — get_onboarding_status and run_onboarding
- `src/bootstrap/index.ts` — add export
- `src/server/index.ts` — register onboarding tools

### Implementation Steps

- [ ] **3.1 Create `src/bootstrap/onboarding-tools.ts`**

  ```typescript
  import type Database from "better-sqlite3";
  import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { z } from "zod";
  import fs from "fs";
  import path from "path";

  interface ChecklistItem {
    key: string;
    status: "done" | "missing";
    description: string;
    fix_command: string;
  }

  export function registerOnboardingTools(server: McpServer, db: Database.Database): void {

    server.tool(
      "get_onboarding_status",
      "Returns a checklist of what is configured vs missing in the project setup: database, files, agents, sprints, processes, vision, milestones",
      {},
      async () => {
        try {
          const checklist: ChecklistItem[] = [];

          // 1. database_initialized — check if files table has any rows
          const fileCount = (db.prepare(`SELECT COUNT(*) as c FROM files`).get() as any).c;
          checklist.push({
            key: "database_initialized",
            status: fileCount > 0 ? "done" : "missing",
            description: fileCount > 0 ? `Database has ${fileCount} indexed files` : "Database is empty — no files indexed",
            fix_command: "setup_project",
          });

          // 2. files_indexed
          checklist.push({
            key: "files_indexed",
            status: fileCount > 0 ? "done" : "missing",
            description: fileCount > 0 ? `${fileCount} files in index` : "No files indexed yet",
            fix_command: "index_directory",
          });

          // 3. agents_configured
          const agentCount = (db.prepare(`SELECT COUNT(*) as c FROM agents`).get() as any).c;
          checklist.push({
            key: "agents_configured",
            status: agentCount > 0 ? "done" : "missing",
            description: agentCount > 0 ? `${agentCount} agents configured` : "No agents loaded",
            fix_command: "sync_scrum_data",
          });

          // 4. sprints_exist
          const sprintCount = (db.prepare(`SELECT COUNT(*) as c FROM sprints`).get() as any).c;
          checklist.push({
            key: "sprints_exist",
            status: sprintCount > 0 ? "done" : "missing",
            description: sprintCount > 0 ? `${sprintCount} sprints exist` : "No sprints created",
            fix_command: "create_sprint",
          });

          // 5. sprint_process_exists — check skills or processes table for SPRINT_PROCESS
          const processExists = db.prepare(
            `SELECT COUNT(*) as c FROM processes WHERE name = 'SPRINT_PROCESS'`
          ).get() as any;
          const skillProcessExists = db.prepare(
            `SELECT COUNT(*) as c FROM skills WHERE name = 'SPRINT_PROCESS'`
          ).get() as any;
          const hasProcess = (processExists?.c || 0) > 0 || (skillProcessExists?.c || 0) > 0;
          checklist.push({
            key: "sprint_process_exists",
            status: hasProcess ? "done" : "missing",
            description: hasProcess ? "Sprint process is defined" : "No SPRINT_PROCESS found",
            fix_command: "sync_scrum_data",
          });

          // 6. product_vision_exists
          const visionExists = db.prepare(
            `SELECT COUNT(*) as c FROM skills WHERE name = 'PRODUCT_VISION'`
          ).get() as any;
          checklist.push({
            key: "product_vision_exists",
            status: (visionExists?.c || 0) > 0 ? "done" : "missing",
            description: (visionExists?.c || 0) > 0 ? "Product vision is defined" : "No PRODUCT_VISION skill found",
            fix_command: "update_vision",
          });

          // 7. milestones_exist
          const milestoneCount = (db.prepare(`SELECT COUNT(*) as c FROM milestones`).get() as any).c;
          checklist.push({
            key: "milestones_exist",
            status: milestoneCount > 0 ? "done" : "missing",
            description: milestoneCount > 0 ? `${milestoneCount} milestones defined` : "No milestones created",
            fix_command: "create_milestone",
          });

          const doneCount = checklist.filter(c => c.status === "done").length;
          const lines = [
            `# Onboarding Status: ${doneCount}/${checklist.length} complete`,
            ``,
            ...checklist.map(c => {
              const icon = c.status === "done" ? "[x]" : "[ ]";
              const fix = c.status === "missing" ? ` → fix: \`${c.fix_command}\`` : "";
              return `- ${icon} **${c.key}**: ${c.description}${fix}`;
            }),
          ];

          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Onboarding status error: ${err.message}` }], isError: true };
        }
      }
    );

    server.tool(
      "run_onboarding",
      "Run the full project onboarding sequence: initialize DB if needed, import agents, ensure sprint process exists. Returns summary of steps completed.",
      {
        project_path: z.string().optional().describe("Project root path (defaults to DB directory's parent)"),
      },
      async ({ project_path }) => {
        try {
          const steps: string[] = [];
          const errors: string[] = [];

          // Determine project path from DB pragma
          let resolvedPath = project_path;
          if (!resolvedPath) {
            const dbPathRow = db.prepare(`PRAGMA database_list`).get() as any;
            resolvedPath = dbPathRow?.file ? path.dirname(path.dirname(dbPathRow.file)) : process.cwd();
          }
          resolvedPath = path.resolve(resolvedPath);

          // Step 1: Check if files are indexed
          const fileCount = (db.prepare(`SELECT COUNT(*) as c FROM files`).get() as any).c;
          if (fileCount === 0) {
            try {
              const { indexDirectory } = await import("../server/indexer.js");
              const stats = indexDirectory(db, resolvedPath);
              steps.push(`Indexed ${stats.files} files, ${stats.exports} exports, ${stats.deps} dependencies`);
            } catch (err: any) {
              errors.push(`Indexing failed: ${err.message}`);
            }
          } else {
            steps.push(`Skipped indexing: ${fileCount} files already indexed`);
          }

          // Step 2: Check if agents are loaded
          const agentCount = (db.prepare(`SELECT COUNT(*) as c FROM agents`).get() as any).c;
          if (agentCount === 0) {
            const claudeDir = path.join(resolvedPath, ".claude");
            if (fs.existsSync(claudeDir)) {
              try {
                const { importScrumData } = await import("../scrum/import.js");
                const result = importScrumData(db, claudeDir);
                steps.push(`Imported ${result.agents} agents, ${result.sprints} sprints, ${result.skills} skills`);
              } catch (err: any) {
                errors.push(`Agent import failed: ${err.message}`);
              }
            } else {
              steps.push("Skipped agent import: .claude/ directory not found");
            }
          } else {
            steps.push(`Skipped agent import: ${agentCount} agents already loaded`);
          }

          // Step 3: Check sprint process
          const processExists = (db.prepare(
            `SELECT COUNT(*) as c FROM processes WHERE name = 'SPRINT_PROCESS'`
          ).get() as any)?.c || 0;
          if (processExists === 0) {
            try {
              db.prepare(
                `INSERT OR IGNORE INTO processes (name, content, version) VALUES (?, ?, 1)`
              ).run("SPRINT_PROCESS", "Default sprint process. Customize via update or sync_scrum_data.");
              steps.push("Created default SPRINT_PROCESS entry");
            } catch (err: any) {
              errors.push(`Process creation failed: ${err.message}`);
            }
          } else {
            steps.push("Skipped process creation: SPRINT_PROCESS already exists");
          }

          const summary = [
            `# Onboarding Complete`,
            ``,
            `## Steps Completed (${steps.length})`,
            ...steps.map(s => `- ${s}`),
            errors.length > 0 ? `\n## Errors (${errors.length})\n${errors.map(e => `- ${e}`).join("\n")}` : "",
          ].join("\n");

          return { content: [{ type: "text" as const, text: summary }] };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Onboarding error: ${err.message}` }], isError: true };
        }
      }
    );
  }
  ```

- [ ] **3.2 Update `src/bootstrap/index.ts`**

  ```typescript
  export { registerBootstrapTools } from "./setup-tools.js";
  export { registerDumpTools } from "./dump-tools.js";
  export { registerOnboardingTools } from "./onboarding-tools.js";
  ```

- [ ] **3.3 Register onboarding tools in `src/server/index.ts`**

  Add import:
  ```typescript
  import { registerOnboardingTools } from "../bootstrap/onboarding-tools.js";
  ```

  Add after dump tools registration:
  ```typescript
  registerOnboardingTools(server, db);
  ```

- [ ] **3.4 Write tests in `tests/onboarding.test.ts`**

  Test cases:
  - `get_onboarding_status` returns 7 checklist items
  - Empty DB returns all items as "missing"
  - After setup, relevant items show as "done"
  - Each missing item includes a valid fix_command string
  - `run_onboarding` on empty DB runs indexing and agent import
  - `run_onboarding` on already-setup DB skips all steps
  - `run_onboarding` creates default SPRINT_PROCESS if missing

  ```bash
  npx vitest run tests/onboarding.test.ts
  ```

- [ ] **3.5 Verify build compiles**

  ```bash
  npm run build
  ```

**Commit message:** `feat(bootstrap): add get_onboarding_status and run_onboarding MCP tools (T-068)`

---

## Task 4: T-069 — Dashboard API for Dump/Restore (3pt)

**Assignee:** Frontend Developer + Backend Developer
**Files to modify:**
- `src/dashboard/dashboard.ts` — add 3 new API endpoints

### Implementation Steps

- [ ] **4.1 Add dump/restore helper functions to `src/dashboard/dashboard.ts`**

  Add after the existing `apiPlanSprint` function (around line 301), before the `readBody` function:

  ```typescript
  // ─── Dump/Restore API ──────────────────────────────────────────────────────
  const DUMP_VERSION = "2.0.0";
  const DUMP_TABLE_ORDER = [
    "milestones", "agents", "skills", "processes",
    "files", "directories", "sprints",
    "exports", "dependencies", "changes",
    "tickets",
    "subtasks", "retro_findings", "blockers", "bugs",
  ];

  function apiDump() {
    const tables: Record<string, any[]> = {};
    for (const table of DUMP_TABLE_ORDER) {
      try {
        tables[table] = writeDb.prepare(`SELECT * FROM ${table}`).all();
      } catch {
        tables[table] = [];
      }
    }
    return {
      version: DUMP_VERSION,
      exported_at: new Date().toISOString(),
      tables,
    };
  }

  function apiRestore(dump: { version: string; tables: Record<string, any[]> }) {
    if (!dump.version || !dump.version.startsWith("2.")) {
      throw new Error(`Incompatible dump version: ${dump.version}. Expected 2.x.x`);
    }
    const results: { tables_restored: string[]; rows_per_table: Record<string, number>; errors: string[] } = {
      tables_restored: [],
      rows_per_table: {},
      errors: [],
    };

    const restore = writeDb.transaction(() => {
      writeDb.pragma("foreign_keys = OFF");
      for (const table of DUMP_TABLE_ORDER) {
        const rows = dump.tables[table];
        if (!rows || rows.length === 0) continue;
        try {
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => "?").join(", ");
          const stmt = writeDb.prepare(
            `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
          );
          let count = 0;
          for (const row of rows) {
            stmt.run(...columns.map(c => row[c] ?? null));
            count++;
          }
          results.tables_restored.push(table);
          results.rows_per_table[table] = count;
        } catch (err: any) {
          results.errors.push(`${table}: ${err.message}`);
        }
      }
      writeDb.pragma("foreign_keys = ON");
    });
    restore();
    return results;
  }

  function apiProjectStatus() {
    try {
      const fileCount = (writeDb.prepare(`SELECT COUNT(*) as c FROM files`).get() as any).c;
      const agentCount = (writeDb.prepare(`SELECT COUNT(*) as c FROM agents`).get() as any).c;
      const sprintCount = (writeDb.prepare(`SELECT COUNT(*) as c FROM sprints`).get() as any).c;
      const ticketCount = (writeDb.prepare(`SELECT COUNT(*) as c FROM tickets`).get() as any).c;
      const milestoneCount = (writeDb.prepare(`SELECT COUNT(*) as c FROM milestones`).get() as any).c;
      const lastIndexed = (writeDb.prepare(`SELECT MAX(indexed_at) as ts FROM files`).get() as any)?.ts || null;
      const visionExists = ((writeDb.prepare(`SELECT COUNT(*) as c FROM skills WHERE name = 'PRODUCT_VISION'`).get() as any)?.c || 0) > 0;

      let dbSizeBytes = 0;
      try { dbSizeBytes = fs.statSync(dbPath).size; } catch {}

      return {
        is_initialized: fileCount > 0,
        file_count: fileCount,
        agent_count: agentCount,
        sprint_count: sprintCount,
        ticket_count: ticketCount,
        milestone_count: milestoneCount,
        has_vision: visionExists,
        db_size_bytes: dbSizeBytes,
        last_indexed: lastIndexed,
      };
    } catch { return { is_initialized: false, error: "Failed to query project status" }; }
  }
  ```

- [ ] **4.2 Add route handlers in the HTTP server switch block**

  Add these routes inside the `if (url.pathname.startsWith("/api/"))` block in the server handler, before the final `else` 404 case:

  ```typescript
  else if (url.pathname === "/api/dump" && req.method === "GET") {
    data = apiDump();
  }
  else if (url.pathname === "/api/restore" && req.method === "POST") {
    const body = await readBody(req);
    data = apiRestore(body);
  }
  else if (url.pathname === "/api/project/status") {
    data = apiProjectStatus();
  }
  ```

- [ ] **4.3 Write tests in `tests/dashboard-api.test.ts`**

  Test cases (using HTTP requests to the dashboard server):
  - `GET /api/dump` returns JSON with version "2.0.0" and tables object
  - `GET /api/dump` includes all 15 tables
  - `POST /api/restore` with valid dump returns tables_restored array
  - `POST /api/restore` with invalid version returns error
  - `GET /api/project/status` returns is_initialized, file_count, agent_count fields
  - Round-trip: dump -> restore -> dump matches

  ```bash
  npx vitest run tests/dashboard-api.test.ts
  ```

- [ ] **4.4 Note: React UI deferred**

  The React dashboard UI (Settings panel with Export/Import buttons) is deferred to a later sprint if React migration from Sprint 9 is not yet complete. The API endpoints are the deliverable for this task.

- [ ] **4.5 Verify build compiles**

  ```bash
  npm run build
  ```

**Commit message:** `feat(dashboard): add /api/dump, /api/restore, /api/project/status endpoints (T-069)`

---

## Task 5: T-070 — npm postinstall + CLI Setup Command (3pt)

**Assignee:** Architect
**Files to modify:**
- `src/server/setup.ts` — extend with --path, --name, --force flags and scrum schema init
- `package.json` — update bin and scripts

### Implementation Steps

- [ ] **5.1 Rewrite `src/server/setup.ts` with CLI arg parsing**

  The existing `src/server/setup.ts` already handles basic setup. Extend it with proper CLI flags and scrum schema initialization.

  ```typescript
  #!/usr/bin/env node
  import fs from "fs";
  import path from "path";
  import { fileURLToPath } from "url";
  import Database from "better-sqlite3";
  import { initSchema } from "./schema.js";
  import { indexDirectory } from "./indexer.js";
  import { initScrumSchema } from "../scrum/schema.js";
  import { importScrumData } from "../scrum/import.js";

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const SERVER_DIR = path.resolve(__dirname);

  // ─── CLI argument parsing ──────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  let positionalPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--path" && args[i + 1]) { flags.path = args[++i]; }
    else if (args[i] === "--name" && args[i + 1]) { flags.name = args[++i]; }
    else if (args[i] === "--force") { flags.force = true; }
    else if (args[i] === "--help" || args[i] === "-h") { flags.help = true; }
    else if (!args[i].startsWith("-")) { positionalPath = args[i]; }
  }

  if (flags.help) {
    console.log(`
  Usage: code-context-mcp setup [path] [options]

  Options:
    --path <dir>   Target project directory (default: current directory)
    --name <name>  Project name (default: directory name)
    --force        Overwrite existing database
    -h, --help     Show this help

  Examples:
    code-context-mcp setup
    code-context-mcp setup ./my-project --name "My Project"
    npx vlm-code-context-mcp setup --force
  `);
    process.exit(0);
  }

  const TARGET_DIR = path.resolve((flags.path as string) || positionalPath || process.cwd());
  const PROJECT_NAME = (flags.name as string) || path.basename(TARGET_DIR);
  const DB_PATH = path.resolve(TARGET_DIR, "context.db");
  const SERVER_ENTRY = path.resolve(SERVER_DIR, "index.js");

  console.log(`=== Code Context MCP — Setup: ${PROJECT_NAME} ===\n`);
  console.log(`  Target directory : ${TARGET_DIR}`);
  console.log(`  Database         : ${DB_PATH}`);
  console.log(`  MCP server       : ${SERVER_ENTRY}\n`);

  // Check for existing DB
  if (fs.existsSync(DB_PATH) && !flags.force) {
    console.log(`  Database already exists. Use --force to overwrite.\n`);
    console.log(`  Current DB will be used. To re-index, run: code-context-mcp setup --force\n`);
  }

  if (fs.existsSync(DB_PATH) && flags.force) {
    fs.unlinkSync(DB_PATH);
    // Also remove WAL/SHM files if they exist
    try { fs.unlinkSync(DB_PATH + "-wal"); } catch {}
    try { fs.unlinkSync(DB_PATH + "-shm"); } catch {}
    console.log("  Removed existing database.\n");
  }

  // 1. Initialize database with BOTH schemas
  console.log("[1/4] Initializing database...");
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  initScrumSchema(db);
  console.log("  Database ready (code-context + scrum schemas).\n");

  // 2. Index the target directory
  console.log("[2/4] Indexing target directory...");
  const stats = indexDirectory(db, TARGET_DIR);
  console.log(`  Indexed ${stats.files} files, ${stats.exports} exports, ${stats.deps} dependencies.\n`);

  // 3. Import scrum data from .claude/ if present
  console.log("[3/4] Importing scrum data...");
  const claudeDir = path.resolve(TARGET_DIR, ".claude");
  if (fs.existsSync(claudeDir)) {
    const scrumImport = importScrumData(db, claudeDir);
    console.log(`  Imported ${scrumImport.agents} agents, ${scrumImport.sprints} sprints, ${scrumImport.tickets} tickets, ${scrumImport.skills} skills.\n`);
  } else {
    console.log("  No .claude/ directory found, skipping scrum import.\n");
  }

  db.close();

  // 4. Write .mcp.json for Claude Code
  console.log("[4/4] Configuring MCP client...");
  const mcpConfigPath = path.resolve(TARGET_DIR, ".mcp.json");
  const relServer = "./" + path.relative(TARGET_DIR, SERVER_ENTRY).split(path.sep).join("/");
  const serverEntry = {
    command: "node",
    args: [relServer, "./context.db"],
  };

  let mcpConfig: Record<string, any> = { mcpServers: {} };
  if (fs.existsSync(mcpConfigPath)) {
    try {
      mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
    } catch {
      // Overwrite if corrupted
    }
  }
  mcpConfig.mcpServers["code-context"] = serverEntry;
  fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + "\n");
  console.log(`  Wrote ${mcpConfigPath}\n`);

  console.log("=== Setup complete! ===\n");
  console.log("Quick start:");
  console.log(`  code-context-dashboard ${DB_PATH}     — Dashboard at http://localhost:3333`);
  console.log(`  code-context-dashboard ${DB_PATH} 3333 .  — With file watcher\n`);
  console.log("MCP tools now available:");
  console.log("  setup_project / get_project_status  — Project bootstrap");
  console.log("  dump_database / restore_database     — DB persistence");
  console.log("  export_to_file / import_from_file    — File-based backup");
  console.log("  get_onboarding_status / run_onboarding — Setup wizard");
  console.log("  index_directory / find_symbol         — Code context");
  console.log("  create_sprint / create_ticket         — Scrum management");
  console.log("");
  ```

- [ ] **5.2 Update `package.json` bin and scripts**

  The `bin` field already has `"code-context-mcp": "dist/server/setup.js"`. Verify it works as:
  - `code-context-mcp setup` (global install)
  - `npx vlm-code-context-mcp setup` (npx)

  The `scripts` section already has `"setup": "node dist/server/setup.js"`. No changes needed unless adding a `"postinstall"` hook. **Do NOT add postinstall** — it runs on every `npm install` which is disruptive. The setup should be explicit.

  Verify existing entries are correct:
  ```json
  {
    "bin": {
      "code-context-mcp": "dist/server/setup.js",
      "code-context-dashboard": "dist/dashboard/dashboard.js"
    },
    "scripts": {
      "setup": "node dist/server/setup.js"
    }
  }
  ```

- [ ] **5.3 Ensure shebang line is present in `src/server/setup.ts`**

  The file already starts with `#!/usr/bin/env node` — verify this is preserved after the rewrite.

- [ ] **5.4 Write tests in `tests/cli-setup.test.ts`**

  Test cases:
  - Running setup on a temp directory creates `context.db`
  - `context.db` has both code-context and scrum schema tables
  - `--force` flag deletes and recreates the database
  - `--name` flag is accepted (no crash)
  - `--help` flag prints usage and exits 0
  - `.mcp.json` is created with code-context server entry
  - Setup indexes `.ts` and `.js` files in the temp directory
  - Running setup twice without `--force` does not error

  ```bash
  npx vitest run tests/cli-setup.test.ts
  ```

- [ ] **5.5 Verify end-to-end flow**

  ```bash
  npm run build
  # Test global-style invocation
  node dist/server/setup.js /tmp/test-project --name "Test"
  # Verify DB exists
  ls -la /tmp/test-project/context.db
  ls -la /tmp/test-project/.mcp.json
  # Cleanup
  rm -rf /tmp/test-project
  ```

- [ ] **5.6 Verify build compiles**

  ```bash
  npm run build
  ```

**Commit message:** `feat(cli): enhance setup.ts with --path, --name, --force flags and scrum schema init (T-070)`

---

## Integration Verification

After all 5 tasks are complete, run the full verification:

- [ ] **Full build**
  ```bash
  npm run build
  ```

- [ ] **Full test suite**
  ```bash
  npm test
  ```

- [ ] **End-to-end smoke test**
  ```bash
  # 1. Setup a fresh project
  node dist/server/setup.js /tmp/e2e-test --name "E2E Test"

  # 2. Start dashboard and verify API
  node dist/dashboard/dashboard.js /tmp/e2e-test/context.db 3334 &
  DASH_PID=$!
  sleep 1
  curl -s http://localhost:3334/api/project/status | head -c 200
  curl -s http://localhost:3334/api/dump | head -c 200

  # 3. Cleanup
  kill $DASH_PID
  rm -rf /tmp/e2e-test
  ```

- [ ] **Verify all new MCP tools appear in server** — Start the MCP server and confirm these tools are registered:
  - `setup_project`
  - `get_project_status`
  - `dump_database`
  - `restore_database`
  - `export_to_file`
  - `import_from_file`
  - `get_onboarding_status`
  - `run_onboarding`

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/bootstrap/setup-tools.ts` | setup_project and get_project_status MCP tools |
| `src/bootstrap/dump-tools.ts` | dump_database, restore_database, export_to_file, import_from_file MCP tools |
| `src/bootstrap/onboarding-tools.ts` | get_onboarding_status and run_onboarding MCP tools |
| `src/bootstrap/index.ts` | Barrel export for all bootstrap tools |
| `tests/bootstrap-setup.test.ts` | Tests for setup tools |
| `tests/dump-restore.test.ts` | Tests for dump/restore tools |
| `tests/onboarding.test.ts` | Tests for onboarding tools |
| `tests/dashboard-api.test.ts` | Tests for dashboard dump/restore API |
| `tests/cli-setup.test.ts` | Tests for CLI setup command |

## Modified Files

| File | Changes |
|------|---------|
| `src/server/index.ts` | Import and register bootstrap, dump, and onboarding tools |
| `src/server/setup.ts` | Extended with --path, --name, --force flags; scrum schema init |
| `src/dashboard/dashboard.ts` | Added /api/dump, /api/restore, /api/project/status endpoints |
