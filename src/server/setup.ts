#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { initSchema } from "./schema.js";
import { indexDirectory } from "./indexer.js";
import { initScrumSchema, runMigrations } from "../scrum/schema.js";
import { importScrumData } from "../scrum/import.js";
import { seedDefaults } from "../scrum/defaults.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname);

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
code-context-mcp — Pre-index your codebase for AI agents

Usage:
  code-context-mcp [path]              Index a directory (default: current dir)
  code-context-mcp setup [path]        Full setup: index + scrum + agents + .mcp.json
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
  code-context-dashboard               Open dashboard at http://localhost:3333

MCP Tools (44 total):
  10 code-context tools (index, search, file context, symbols, changes)
  34 scrum tools (sprints, tickets, retros, milestones, agents, dump/restore, Linear sync)
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

// 3. Set up .claude/ directory (agents, scrum, skills)
console.log("[3/4] Setting up .claude/ directory...");
const claudeDir = path.resolve(TARGET_DIR, ".claude");

const dirs = [
  "agents", "scrum/default", "skills", "instructions"
];
for (const d of dirs) {
  const dirPath = path.join(claudeDir, d);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  Created ${d}/`);
  }
}

// Copy default agent templates if none exist
const agentsDir = path.join(claudeDir, "agents");
const existingAgents = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
if (existingAgents.length === 0) {
  const templatesDir = path.resolve(__dirname, "../../templates/agents");
  if (fs.existsSync(templatesDir)) {
    const templates = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
    for (const t of templates) {
      fs.copyFileSync(path.join(templatesDir, t), path.join(agentsDir, t));
    }
    console.log(`  Copied ${templates.length} agent templates`);
  }
}

// Copy default skill templates if none exist
const skillsDir = path.join(claudeDir, "skills");
const existingSkills = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
if (existingSkills.length === 0) {
  const templatesDir = path.resolve(__dirname, "../../templates/skills");
  if (fs.existsSync(templatesDir)) {
    const templates = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
    for (const t of templates) {
      fs.copyFileSync(path.join(templatesDir, t), path.join(skillsDir, t));
    }
    console.log(`  Copied ${templates.length} skill templates`);
  }
}

// Copy default scrum templates if none exist
const scrumDefaultDir = path.join(claudeDir, "scrum/default");
const existingScrumDefaults = fs.readdirSync(scrumDefaultDir).filter(f => f.endsWith('.md'));
if (existingScrumDefaults.length === 0) {
  const templatesDir = path.resolve(__dirname, "../../templates/scrum-default");
  if (fs.existsSync(templatesDir)) {
    const templates = fs.readdirSync(templatesDir).filter(f => f.endsWith('.md'));
    for (const t of templates) {
      fs.copyFileSync(path.join(templatesDir, t), path.join(scrumDefaultDir, t));
    }
    console.log(`  Copied ${templates.length} scrum default templates`);
  }
}

// Seed factory defaults into empty tables
const seeded = seedDefaults(db);
if (seeded.agents + seeded.skills > 0) {
  console.log(`  Seeded ${seeded.agents} agents, ${seeded.skills} skills from factory defaults`);
}
// Legacy import for sprint history
const scrumImport = importScrumData(db, claudeDir);
console.log(`  Imported ${scrumImport.sprints} sprints, ${scrumImport.tickets} tickets from .claude/ archive\n`);

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

  const milestoneCount = (db.prepare(`SELECT COUNT(*) as cnt FROM milestones`).get() as { cnt: number }).cnt;
  if (milestoneCount === 0) {
    db.prepare(
      `INSERT INTO milestones (name, description, status) VALUES (?, ?, ?)`
    ).run(
      "M1 — Getting Started",
      "Initial project setup: indexing, schema, first sprint, and onboarding.",
      "active"
    );
    console.log("  Created first milestone: M1 — Getting Started (status: active).");
  } else {
    console.log(`  ${milestoneCount} milestone(s) already exist, skipping.`);
  }

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

// Add bridge hook if not already present
const bridgeHookCmd = `node ${hookScript}`;
const hasBridgeHook = claudeSettings.hooks.PreToolUse.some(
  (h: any) => h.type === "command" && h.command?.includes("bridge/hook")
);
if (!hasBridgeHook) {
  claudeSettings.hooks.PreToolUse.push({ type: "command", command: bridgeHookCmd });
  fs.writeFileSync(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2) + "\n");
  console.log(`  Bridge hook added to ${claudeSettingsPath}`);
} else {
  console.log(`  Bridge hook already configured`);
}
console.log("");

console.log(`=== Setup complete! (${PROJECT_NAME}) ===\n`);
console.log("Dashboard:");
console.log(`  npx code-context-dashboard ./context.db  — Open at http://localhost:3333`);
console.log(`  npx code-context-dashboard ./context.db 3333 .  — With file watcher`);
console.log("");
console.log("Restart your AI client to load the MCP tools (44 total):");
console.log("");
console.log("  Code Context Tools:");
console.log("  index_directory        — Re-index a directory");
console.log("  find_symbol            — Search exports by name");
console.log("  get_file_context       — Full file context (exports, imports, dependents)");
console.log("  set_description        — Set a file description");
console.log("  set_directory_description — Set a directory description");
console.log("  set_change_reason      — Annotate a change with a reason");
console.log("  get_changes            — View recent file changes");
console.log("  search_files           — Search files by path or summary");
console.log("  query / execute        — Raw SQL access");
console.log("");
console.log("  Scrum Tools:");
console.log("  list_agents / get_agent       — Agent team management");
console.log("  list_sprints / get_sprint     — Sprint tracking");
console.log("  create_sprint / update_sprint — Sprint lifecycle");
console.log("  list_tickets / get_ticket     — Ticket management");
console.log("  create_ticket / update_ticket — Ticket CRUD");
console.log("  search_scrum                  — Search across scrum data");
console.log("  add_retro_finding             — Retrospective findings");
console.log("  create_blocker / resolve_blocker — Blocker management");
console.log("  log_bug                       — Bug tracking");
console.log("  sync_scrum_data               — Re-import from .claude/");
console.log("  export_sprint_report          — Generate sprint reports");
console.log("  get_sprint_instructions       — Sprint process guide");
console.log("  create_milestone / update_milestone — Milestone management");
console.log("  link_ticket_to_milestone      — Link tickets to milestones");
console.log("  update_vision                 — Update product vision");
console.log("  get_backlog / plan_sprint     — Backlog & planning");
console.log("  get_project_status            — Project health check");
console.log("  sync_linear_data              — Sync Linear workspace to dashboard");
console.log("");
