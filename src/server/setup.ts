#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { initSchema } from "./schema.js";
import { indexDirectory } from "./indexer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname);

const TARGET_DIR = path.resolve(process.argv[2] ?? process.cwd());
const DB_PATH = path.resolve(TARGET_DIR, "context.db");
const SERVER_ENTRY = path.resolve(SERVER_DIR, "index.js");

console.log("=== Code Context MCP — Setup ===\n");
console.log(`  Target directory : ${TARGET_DIR}`);
console.log(`  Database         : ${DB_PATH}`);
console.log(`  MCP server       : ${SERVER_ENTRY}\n`);

// 1. Initialize database
console.log("[1/3] Initializing database...");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
initSchema(db);
console.log("  Database ready.\n");

// 2. Index the target directory
console.log("[2/3] Indexing target directory...");
const stats = indexDirectory(db, TARGET_DIR);
console.log(`  Indexed ${stats.files} files, ${stats.exports} exports, ${stats.deps} dependencies.\n`);
db.close();

// 3. Write .mcp.json for Claude Code
console.log("[3/3] Configuring MCP client...");
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
console.log("Dashboard:");
console.log(`  npx code-context-dashboard ./context.db  — Open at http://localhost:3333`);
console.log(`  npx code-context-dashboard ./context.db 3333 .  — With file watcher`);
console.log("");
console.log("Restart your AI client to load the MCP tools:");
console.log("  index_directory        — Re-index a directory");
console.log("  find_symbol            — Search exports by name");
console.log("  get_file_context       — Full file context (exports, imports, dependents)");
console.log("  set_description        — Set a file description");
console.log("  set_directory_description — Set a directory description");
console.log("  set_change_reason      — Annotate a change with a reason");
console.log("  get_changes            — View recent file changes");
console.log("  search_files           — Search files by path or summary");
console.log("  query / execute        — Raw SQL access");
