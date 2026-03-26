import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { initSchema } from "./schema.js";
import { indexDirectory } from "./indexer.js";
// ## works
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const TARGET_DIR = process.argv[2] ?? process.cwd();
const DB_NAME = "context.db";
const DB_PATH = path.resolve(ROOT, DB_NAME);

console.log("=== Code Context MCP — Setup ===\n");
console.log(`  MCP server root : ${ROOT}`);
console.log(`  Target directory : ${TARGET_DIR}`);
console.log(`  Database         : ${DB_PATH}\n`);

// 1. Initialize database
console.log("[1/3] Initializing database...");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
initSchema(db);
console.log("  Database ready.\n");

// 2. Index the target directory
console.log("[2/3] Indexing target directory...");
const stats = indexDirectory(db, path.resolve(TARGET_DIR));
console.log(`  Indexed ${stats.files} files, ${stats.exports} exports, ${stats.deps} dependencies.\n`);
db.close();

// 3. Write .mcp.json for Claude Code
console.log("[3/3] Configuring MCP client...");
const mcpConfigPath = path.resolve(TARGET_DIR, ".mcp.json");
const serverEntry = {
  command: "node",
  args: [path.resolve(ROOT, "dist/server/index.js"), DB_PATH],
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
console.log("Available commands:");
console.log(`  npm run dashboard              — Open the dashboard at http://localhost:3333`);
console.log(`  npm run dashboard -- . 3333 ${TARGET_DIR}  — Dashboard with file watcher`);
console.log("");
console.log("MCP tools available after restarting your AI client:");
console.log("  index_directory  — Re-index a directory");
console.log("  find_symbol      — Search exports by name");
console.log("  get_file_context — Get full file context (exports, imports, dependents)");
console.log("  search_files     — Search files by path or summary");
console.log("  query / execute  — Raw SQL access");
