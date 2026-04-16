#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { initSchema } from "./schema.js";
import { indexDirectory } from "./indexer.js";
import { initScrumSchema, runMigrations } from "../scrum/schema.js";
import { seedDefaults } from "../scrum/defaults.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname);

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
code-context-mcp — Pre-index your codebase for AI agents

Usage:
  code-context-mcp [path]              Index a directory (default: current dir)
  code-context-mcp setup [path]        Full setup: index + scrum + .mcp.json
  code-context-mcp --help              Show this help

Options:
  --force                              Re-initialize even if context.db exists
  --name <name>                        Project name (default: directory name)
  --defaults                           Skip prompts, auto-create vision & milestone

Examples:
  code-context-mcp .                   Index current directory
  code-context-mcp setup ~/my-project  Full setup for a project
  code-context-mcp --force .           Re-index from scratch

After setup:
  code-context-dashboard               Open dashboard (default port: ${process.env.DASHBOARD_PORT || "3333"})

MCP Tools (93 total):
  10 code-context tools (index, search, file context, symbols, changes)
  71 scrum tools (sprints, tickets, retros, milestones, agents, bridge, dump/restore)
`);
  process.exit(0);
}

const FORCE = args.includes("--force");
const USE_DEFAULTS = args.includes("--defaults");

const nameIdx = args.indexOf("--name");
const nonFlagArgs = args.filter(a => !a.startsWith("--") && !a.startsWith("-"));
const isSetupCommand = nonFlagArgs[0] === "setup";
const targetPath = isSetupCommand ? (nonFlagArgs[1] || ".") : (nonFlagArgs[0] || ".");
const TARGET_DIR = path.resolve(targetPath);
const PROJECT_NAME = nameIdx >= 0 && args[nameIdx + 1] ? args[nameIdx + 1] : path.basename(TARGET_DIR);

const DB_PATH = path.resolve(TARGET_DIR, "context.db");
const SERVER_ENTRY = path.resolve(SERVER_DIR, "index.js");

console.log(`=== Code Context MCP — Setup (${PROJECT_NAME}) ===\n`);
console.log(`  Target directory : ${TARGET_DIR}`);
console.log(`  Database         : ${DB_PATH}`);
console.log(`  MCP server       : ${SERVER_ENTRY}\n`);

// 1. Initialize database (code-context + scrum schemas)
console.log("[1/4] Initializing database...");

if (FORCE && fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log("  Removed existing database (--force).\n");
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
initSchema(db);
initScrumSchema(db);
runMigrations(db);
console.log("  Code-context schema ready.");
console.log("  Scrum schema ready.\n");

// 2. Index the target directory
console.log("[2/4] Indexing target directory...");
const stats = indexDirectory(db, TARGET_DIR);
console.log(`  Indexed ${stats.files} files, ${stats.exports} exports, ${stats.deps} dependencies.\n`);

// 3. Seed factory defaults into database
console.log("[3/4] Seeding factory defaults...");
const seeded = seedDefaults(db);
if (seeded.agents + seeded.skills > 0) {
  console.log(`  Seeded ${seeded.agents} agents, ${seeded.skills} skills`);
} else {
  console.log("  Defaults already present, skipping.");
}
console.log("");

// ─── First-startup wizard: auto-create PRODUCT_VISION and first milestone ────
{
  const visionRow = db.prepare(`SELECT id FROM skills WHERE name = 'PRODUCT_VISION'`).get() as { id: number } | undefined;
  if (!visionRow) {
    const defaultVision = [
      `# Product Vision — ${PROJECT_NAME}`,
      "",
      "## Mission",
      `Build and ship ${PROJECT_NAME} as a high-quality, well-documented project.`,
      "",
      "## Target Users",
      "Developers and teams who need a structured, AI-assisted development workflow.",
      "",
      "## Success Metrics",
      "- All milestones completed on schedule",
      "- Test coverage above 80%",
      "- Comprehensive documentation",
      "",
      "> Update this vision at any time with the `update_vision` MCP tool or via the dashboard.",
    ].join("\n");

    db.prepare(`INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?)`)
      .run("PRODUCT_VISION", defaultVision, "product-owner");
    console.log("  Created default PRODUCT_VISION skill (update via MCP tools or dashboard).");
  } else {
    console.log("  PRODUCT_VISION skill already exists, skipping.");
  }

  // Milestones are created via /kickoff or MCP tools — not auto-seeded during setup.

  if (!USE_DEFAULTS) {
    console.log("\n  Tip: Run with --defaults to suppress this output on re-runs.");
  }
  console.log("");
}

db.close();

// 4. Configure MCP client (.mcp.json)
console.log("[4/4] Configuring MCP client...");
const mcpConfigPath = path.resolve(TARGET_DIR, ".mcp.json");
const relServer = "./" + path.relative(TARGET_DIR, SERVER_ENTRY).split(path.sep).join("/");
const serverEntry = {
  command: "node",
  args: [relServer, DB_PATH],
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

// 5. Configure bridge hook (.claude/settings.json)
console.log("[5/5] Configuring bridge hook...");
const hookScript = "./" + path.relative(TARGET_DIR, path.resolve(__dirname, "../bridge/hook.js")).split(path.sep).join("/");
const claudeSettingsDir = path.resolve(TARGET_DIR, ".claude");
const claudeSettingsPath = path.join(claudeSettingsDir, "settings.json");
if (!fs.existsSync(claudeSettingsDir)) fs.mkdirSync(claudeSettingsDir, { recursive: true });

let claudeSettings: Record<string, any> = {};
if (fs.existsSync(claudeSettingsPath)) {
  try { claudeSettings = JSON.parse(fs.readFileSync(claudeSettingsPath, "utf-8")); } catch {}
}
if (!claudeSettings.hooks) claudeSettings.hooks = {};
if (!claudeSettings.hooks.PreToolUse) claudeSettings.hooks.PreToolUse = [];

// Always write the correct bridge hook (repairs broken configs from older versions)
const bridgeHookCmd = `node ${hookScript}`;
// Remove any existing bridge hook entries (including old flat-format ones)
claudeSettings.hooks.PreToolUse = claudeSettings.hooks.PreToolUse.filter(
  (entry: any) => {
    // Remove old flat-format entries: { type: "command", command: "...bridge/hook..." }
    if (entry.type === "command" && entry.command?.includes("bridge/hook")) return false;
    // Remove existing matcher-group entries containing bridge hook
    if (Array.isArray(entry.hooks) && entry.hooks.some(
      (h: any) => h.command?.includes("bridge/hook")
    )) return false;
    return true;
  }
);
claudeSettings.hooks.PreToolUse.push({
  matcher: "",
  hooks: [{ type: "command", command: bridgeHookCmd }],
});
fs.writeFileSync(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2) + "\n");
console.log(`  Bridge hook configured in ${claudeSettingsPath}`);
console.log("");

// 6. Copy .claude/commands into target project
console.log("[6/6] Installing Claude commands...");
const pkgCommandsDir = path.resolve(__dirname, "../../.claude/commands");
const targetCommandsDir = path.resolve(TARGET_DIR, ".claude/commands");
if (fs.existsSync(pkgCommandsDir)) {
  if (!fs.existsSync(targetCommandsDir)) fs.mkdirSync(targetCommandsDir, { recursive: true });
  const commandFiles = fs.readdirSync(pkgCommandsDir).filter(f => f.endsWith(".md"));
  for (const file of commandFiles) {
    const dest = path.join(targetCommandsDir, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(pkgCommandsDir, file), dest);
      console.log(`  Copied ${file}`);
    } else {
      console.log(`  Skipped ${file} (already exists)`);
    }
  }
  console.log(`  Commands installed to ${targetCommandsDir}`);
} else {
  console.log("  No commands directory found in package, skipping.");
}
console.log("");

console.log(`=== Setup complete! (${PROJECT_NAME}) ===\n`);
const dashPort = process.env.DASHBOARD_PORT || "3333";
console.log("Dashboard:");
console.log(`  npx code-context-dashboard ${DB_PATH}  — Open at http://localhost:${dashPort}`);
console.log(`  npx code-context-dashboard ${DB_PATH} ${dashPort} .  — With file watcher`);
console.log("");
console.log("Restart your AI client to load the MCP tools (93 total).");
console.log("All data lives in context.db — no .claude/ files needed.");
console.log("");
