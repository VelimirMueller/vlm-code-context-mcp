/**
 * Scrum Tools — Domain Module Registry
 *
 * This is the new entry point for registering all scrum tools.
 * Tools are being incrementally migrated from ../tools.ts into domain modules:
 *
 *   tools/analytics.ts    — burndown, velocity, sprint metrics, token usage
 *   tools/sprint.ts       — sprint lifecycle, playbook, instructions (planned)
 *   tools/ticket.ts       — ticket CRUD, dependencies (planned)
 *   tools/epic.ts         — epic CRUD, milestone linking (planned)
 *   tools/discovery.ts    — discovery CRUD, linking (planned)
 *   tools/bridge.ts       — dashboard bridge, wizard, step progress (planned)
 *
 * During migration, the legacy registerScrumTools() in ../tools.ts remains
 * the primary registrar. New domain modules are registered here and called
 * from the server setup.
 */
import type Database from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import domain modules as they're extracted
// import { registerAnalyticsTools } from "./analytics.js";

/**
 * Register all domain-split tools. Called alongside registerScrumTools()
 * during the migration period. Once migration is complete, this replaces
 * registerScrumTools() entirely.
 */
export function registerDomainTools(_server: McpServer, _db: Database.Database): void {
  // registerAnalyticsTools(server, db);
  // More domains added here as they're extracted
}
