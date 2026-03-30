#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook — Bridge between dashboard and Claude.
 *
 * This hook fires before every tool call. It checks the pending_actions table
 * in context.db for actions queued by the dashboard, and injects them as
 * additionalContext so Claude picks them up naturally.
 *
 * Install in .claude/settings.json:
 * {
 *   "hooks": {
 *     "PreToolUse": [{ "type": "command", "command": "node dist/bridge/hook.js" }]
 *   }
 * }
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

interface PendingAction {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  payload: string | null;
  source: string;
  created_at: string;
}

// Find context.db — walk up from cwd looking for it
function findDb(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "context.db");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function main() {
  const dbPath = findDb();
  if (!dbPath) {
    // No DB found — nothing to inject, exit cleanly
    process.exit(0);
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: false });
    db.pragma("journal_mode = WAL");
  } catch {
    process.exit(0);
  }

  try {
    // Check for pending actions (max 5 at a time to keep context small)
    const pending = db.prepare(
      `SELECT id, action, entity_type, entity_id, payload, source, created_at
       FROM pending_actions
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 5`
    ).all() as PendingAction[];

    if (pending.length === 0) {
      db.close();
      process.exit(0);
    }

    // Expire old actions (>1 hour)
    db.prepare(
      `UPDATE pending_actions SET status = 'expired'
       WHERE status = 'pending' AND created_at < datetime('now', '-1 hour')`
    ).run();

    // Claim these actions
    const ids = pending.map((a) => a.id);
    db.prepare(
      `UPDATE pending_actions SET status = 'claimed', claimed_at = datetime('now')
       WHERE id IN (${ids.map(() => "?").join(",")})`
    ).run(...ids);

    // Build context string
    const lines = ["[DASHBOARD ACTION QUEUE] The dashboard has queued the following actions for you:"];
    for (const action of pending) {
      const parts = [`- Action: ${action.action}`];
      if (action.entity_type) parts.push(`  Entity: ${action.entity_type} #${action.entity_id}`);
      if (action.payload) {
        try {
          const p = JSON.parse(action.payload);
          parts.push(`  Details: ${JSON.stringify(p)}`);
        } catch {
          parts.push(`  Details: ${action.payload}`);
        }
      }
      parts.push(`  Source: ${action.source} at ${action.created_at}`);
      lines.push(parts.join("\n"));
    }
    lines.push("");
    lines.push("Execute these actions using the appropriate MCP tools, then mark them complete:");
    lines.push(`Use: execute({sql: "UPDATE pending_actions SET status='completed', completed_at=datetime('now') WHERE id IN (${ids.join(",")})"})`);

    db.close();

    // Output hook response with additionalContext
    const response = {
      hookSpecificOutput: {
        additionalContext: lines.join("\n"),
      },
    };
    process.stdout.write(JSON.stringify(response));
  } catch {
    try { db.close(); } catch {}
    process.exit(0);
  }
}

main();
