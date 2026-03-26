import type Database from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register read-only MCP tools for the Scrum system.
 */
export function registerScrumTools(server: McpServer, db: Database.Database): void {

  server.tool(
    "list_agents",
    "List all scrum team agents with their roles and capabilities",
    {},
    async () => {
      const agents = db.prepare(`SELECT role, name, description, model FROM agents ORDER BY role`).all() as any[];
      if (agents.length === 0) return { content: [{ type: "text" as const, text: "No agents found. Import from .claude/agents/ first." }] };
      const text = agents.map(a => `**${a.name}** (${a.role}) — ${a.description || "No description"}\nModel: ${a.model || "default"}`).join("\n\n");
      return { content: [{ type: "text" as const, text: `# Agents (${agents.length})\n\n${text}` }] };
    }
  );

  server.tool(
    "get_agent",
    "Get full details of a scrum agent by role",
    { role: z.string().describe("Agent role (e.g. 'backend-developer')") },
    async ({ role }) => {
      const agent = db.prepare(`SELECT * FROM agents WHERE role = ?`).get(role) as any;
      if (!agent) return { content: [{ type: "text" as const, text: `Agent "${role}" not found. Use list_agents to see available roles.` }] };
      const sections = [`# ${agent.name} (${agent.role})`, agent.description || "", `Model: ${agent.model || "default"}`, `Tools: ${agent.tools || "none"}`, "", "## System Prompt", agent.system_prompt || "(none)"];
      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    }
  );

  server.tool(
    "list_sprints",
    "List all sprints with status and ticket counts",
    { status: z.enum(["planning", "active", "review", "closed"]).optional().describe("Filter by status") },
    async ({ status }) => {
      let q = `SELECT s.*, COUNT(t.id) as ticket_count, SUM(CASE WHEN t.status='DONE' THEN 1 ELSE 0 END) as done_count FROM sprints s LEFT JOIN tickets t ON t.sprint_id=s.id`;
      const params: any[] = [];
      if (status) { q += " WHERE s.status=?"; params.push(status); }
      q += " GROUP BY s.id ORDER BY s.created_at DESC LIMIT 20";
      const sprints = db.prepare(q).all(...params) as any[];
      if (sprints.length === 0) return { content: [{ type: "text" as const, text: "No sprints found." }] };
      const text = sprints.map(s => `**${s.name}** [${s.status.toUpperCase()}]\nGoal: ${s.goal || "—"}\nTickets: ${s.done_count}/${s.ticket_count} done | Velocity: ${s.velocity_completed}/${s.velocity_committed}`).join("\n\n");
      return { content: [{ type: "text" as const, text: `# Sprints (${sprints.length})\n\n${text}` }] };
    }
  );

  server.tool(
    "get_sprint",
    "Get full sprint details with tickets, bugs, blockers, and retro findings",
    { sprint_id: z.number().describe("Sprint ID") },
    async ({ sprint_id }) => {
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id=?`).get(sprint_id) as any;
      if (!sprint) return { content: [{ type: "text" as const, text: `Sprint ${sprint_id} not found.` }] };
      const tickets = db.prepare(`SELECT id, ticket_ref, title, status, priority, assigned_to, story_points, qa_verified FROM tickets WHERE sprint_id=? ORDER BY priority`).all(sprint_id) as any[];
      const bugs = db.prepare(`SELECT id, severity, description, status FROM bugs WHERE sprint_id=?`).all(sprint_id) as any[];
      const blockers = db.prepare(`SELECT id, description, status FROM blockers WHERE sprint_id=?`).all(sprint_id) as any[];
      const findings = db.prepare(`SELECT category, role, finding, action_owner, action_applied FROM retro_findings WHERE sprint_id=?`).all(sprint_id) as any[];

      const sections = [`# ${sprint.name} [${sprint.status.toUpperCase()}]`, `Goal: ${sprint.goal || "—"}`, `Velocity: ${sprint.velocity_completed}/${sprint.velocity_committed}`, ""];
      sections.push(`## Tickets (${tickets.length})`);
      tickets.forEach(t => { const qa = t.qa_verified ? " ✓QA" : ""; sections.push(`- [${t.status}] ${t.priority} ${t.ticket_ref || "#"+t.id}: ${t.title} (${t.story_points || 0}sp) @${t.assigned_to || "?"}${qa}`); });
      if (bugs.length) { sections.push("", `## Bugs (${bugs.length})`); bugs.forEach(b => sections.push(`- [${b.status}] ${b.severity}: ${b.description}`)); }
      if (blockers.length) { sections.push("", `## Blockers (${blockers.length})`); blockers.forEach(b => sections.push(`- [${b.status}] ${b.description}`)); }
      if (findings.length) {
        sections.push("", `## Retro (${findings.length})`);
        ["went_well", "went_wrong", "try_next"].forEach(cat => {
          const items = findings.filter(f => f.category === cat);
          if (items.length) { sections.push(`### ${cat.replace("_", " ")}`); items.forEach(f => sections.push(`- ${f.finding} (${f.role || "team"})${f.action_applied ? " [APPLIED]" : ""}`)); }
        });
      }
      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    }
  );

  server.tool(
    "list_tickets",
    "List tickets with optional filters",
    {
      sprint_id: z.number().optional().describe("Filter by sprint"),
      status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED", "PARTIAL", "NOT_DONE"]).optional(),
      assigned_to: z.string().optional(),
    },
    async ({ sprint_id, status, assigned_to }) => {
      let q = `SELECT t.*, s.name as sprint_name FROM tickets t LEFT JOIN sprints s ON t.sprint_id=s.id WHERE 1=1`;
      const p: any[] = [];
      if (sprint_id !== undefined) { q += " AND t.sprint_id=?"; p.push(sprint_id); }
      if (status) { q += " AND t.status=?"; p.push(status); }
      if (assigned_to) { q += " AND t.assigned_to=?"; p.push(assigned_to); }
      q += " ORDER BY t.priority, t.status LIMIT 50";
      const tickets = db.prepare(q).all(...p) as any[];
      if (tickets.length === 0) return { content: [{ type: "text" as const, text: "No tickets found." }] };
      const text = tickets.map(t => `[${t.status}] ${t.priority} ${t.ticket_ref || "#"+t.id}: ${t.title} (${t.story_points || 0}sp) @${t.assigned_to || "?"} — ${t.sprint_name || "backlog"}`).join("\n");
      return { content: [{ type: "text" as const, text: `# Tickets (${tickets.length})\n\n${text}` }] };
    }
  );

  server.tool(
    "get_ticket",
    "Get full ticket details with subtasks and linked bugs",
    { ticket_id: z.number().describe("Ticket ID") },
    async ({ ticket_id }) => {
      const t = db.prepare(`SELECT t.*, s.name as sprint_name FROM tickets t LEFT JOIN sprints s ON t.sprint_id=s.id WHERE t.id=?`).get(ticket_id) as any;
      if (!t) return { content: [{ type: "text" as const, text: `Ticket #${ticket_id} not found.` }] };
      const subtasks = db.prepare(`SELECT * FROM subtasks WHERE ticket_id=?`).all(ticket_id) as any[];
      const bugs = db.prepare(`SELECT * FROM bugs WHERE ticket_id=?`).all(ticket_id) as any[];
      const sections = [`# ${t.ticket_ref || "#"+t.id}: ${t.title}`, `Status: ${t.status} | Priority: ${t.priority} | Points: ${t.story_points || 0}`, `Sprint: ${t.sprint_name || "backlog"} | Assigned: ${t.assigned_to || "—"} | QA: ${t.qa_verified ? "Yes" : "No"}`, ""];
      if (t.description) sections.push("## Description", t.description, "");
      if (t.acceptance_criteria) { sections.push("## Acceptance Criteria"); try { JSON.parse(t.acceptance_criteria).forEach((c: string) => sections.push(`- ${c}`)); } catch { sections.push(t.acceptance_criteria); } sections.push(""); }
      if (subtasks.length) { sections.push(`## Subtasks (${subtasks.length})`); subtasks.forEach(s => sections.push(`- [${s.status}] ${s.description} @${s.assigned_to || "?"}`)); sections.push(""); }
      if (bugs.length) { sections.push(`## Bugs (${bugs.length})`); bugs.forEach(b => sections.push(`- [${b.status}] ${b.severity}: ${b.description}`)); }
      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    }
  );

  server.tool(
    "list_retro_findings",
    "List retrospective findings with optional filters",
    { sprint_id: z.number().optional(), category: z.enum(["went_well", "went_wrong", "try_next"]).optional() },
    async ({ sprint_id, category }) => {
      let q = `SELECT rf.*, s.name as sprint_name FROM retro_findings rf JOIN sprints s ON rf.sprint_id=s.id WHERE 1=1`;
      const p: any[] = [];
      if (sprint_id !== undefined) { q += " AND rf.sprint_id=?"; p.push(sprint_id); }
      if (category) { q += " AND rf.category=?"; p.push(category); }
      q += " ORDER BY rf.sprint_id DESC, rf.category";
      const findings = db.prepare(q).all(...p) as any[];
      if (findings.length === 0) return { content: [{ type: "text" as const, text: "No retro findings found." }] };
      const text = findings.map(f => `[${f.category.replace("_", " ")}] ${f.finding} (${f.role || "team"}, Sprint: ${f.sprint_name})${f.action_applied ? " [APPLIED]" : ""}`).join("\n");
      return { content: [{ type: "text" as const, text: `# Retro Findings (${findings.length})\n\n${text}` }] };
    }
  );

  server.tool(
    "search_scrum",
    "Full-text search across tickets, retro findings, blockers, and bugs",
    { query: z.string().describe("Search term") },
    async ({ query }) => {
      const pattern = `%${query}%`;
      const results: string[] = [`# Search: "${query}"`, ""];
      const tickets = db.prepare(`SELECT id, ticket_ref, title, status, priority FROM tickets WHERE title LIKE ? OR description LIKE ? LIMIT 10`).all(pattern, pattern) as any[];
      if (tickets.length) { results.push(`## Tickets (${tickets.length})`); tickets.forEach(t => results.push(`- [${t.status}] ${t.priority} ${t.ticket_ref || "#"+t.id}: ${t.title}`)); results.push(""); }
      const findings = db.prepare(`SELECT finding, category, role FROM retro_findings WHERE finding LIKE ? LIMIT 10`).all(pattern) as any[];
      if (findings.length) { results.push(`## Retro (${findings.length})`); findings.forEach(f => results.push(`- [${f.category}] ${f.finding}`)); results.push(""); }
      const bugs = db.prepare(`SELECT id, severity, description, status FROM bugs WHERE description LIKE ? LIMIT 10`).all(pattern) as any[];
      if (bugs.length) { results.push(`## Bugs (${bugs.length})`); bugs.forEach(b => results.push(`- [${b.status}] ${b.severity}: ${b.description}`)); }
      if (tickets.length + findings.length + bugs.length === 0) return { content: [{ type: "text" as const, text: `No results for "${query}".` }] };
      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "create_sprint",
    "Create a new sprint",
    {
      name: z.string().describe("Sprint name (e.g. 'sprint-2026-04-07')"),
      goal: z.string().optional().describe("Sprint goal"),
      start_date: z.string().optional().describe("Start date (ISO 8601)"),
      end_date: z.string().optional().describe("End date (ISO 8601)"),
    },
    async ({ name, goal, start_date, end_date }) => {
      try {
        const result = db.prepare(`INSERT INTO sprints (name, goal, start_date, end_date, status) VALUES (?, ?, ?, ?, 'planning')`).run(name, goal || null, start_date || null, end_date || null);
        return { content: [{ type: "text" as const, text: `Sprint created: ${name} (id: ${result.lastInsertRowid})` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "update_sprint",
    "Update sprint status or details",
    {
      sprint_id: z.number().describe("Sprint ID"),
      status: z.enum(["planning", "active", "review", "closed"]).optional(),
      goal: z.string().optional(),
      velocity_committed: z.number().optional(),
      velocity_completed: z.number().optional(),
    },
    async ({ sprint_id, status, goal, velocity_committed, velocity_completed }) => {
      const sets: string[] = []; const vals: any[] = [];
      if (status) { sets.push("status=?"); vals.push(status); }
      if (goal) { sets.push("goal=?"); vals.push(goal); }
      if (velocity_committed !== undefined) { sets.push("velocity_committed=?"); vals.push(velocity_committed); }
      if (velocity_completed !== undefined) { sets.push("velocity_completed=?"); vals.push(velocity_completed); }
      if (sets.length === 0) return { content: [{ type: "text" as const, text: "Nothing to update." }] };
      sets.push("updated_at=datetime('now')");
      vals.push(sprint_id);
      db.prepare(`UPDATE sprints SET ${sets.join(",")} WHERE id=?`).run(...vals);
      return { content: [{ type: "text" as const, text: `Sprint ${sprint_id} updated.` }] };
    }
  );

  server.tool(
    "create_ticket",
    "Create a new ticket in a sprint",
    {
      sprint_id: z.number().describe("Sprint ID"),
      title: z.string().describe("Ticket title"),
      ticket_ref: z.string().optional().describe("Reference ID (e.g. T-021)"),
      description: z.string().optional(),
      priority: z.enum(["P0", "P1", "P2", "P3"]).optional().default("P2"),
      assigned_to: z.string().optional(),
      story_points: z.number().optional(),
      milestone: z.string().optional(),
    },
    async ({ sprint_id, title, ticket_ref, description, priority, assigned_to, story_points, milestone }) => {
      try {
        const result = db.prepare(`INSERT INTO tickets (sprint_id, ticket_ref, title, description, priority, assigned_to, story_points, milestone) VALUES (?,?,?,?,?,?,?,?)`).run(sprint_id, ticket_ref || null, title, description || null, priority, assigned_to || null, story_points || null, milestone || null);
        return { content: [{ type: "text" as const, text: `Ticket created: ${ticket_ref || '#'+result.lastInsertRowid} — ${title}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "update_ticket",
    "Update a ticket's status, assignment, or QA verification",
    {
      ticket_id: z.number().describe("Ticket ID"),
      status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED", "PARTIAL", "NOT_DONE"]).optional(),
      assigned_to: z.string().optional(),
      qa_verified: z.boolean().optional(),
      verified_by: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ ticket_id, status, assigned_to, qa_verified, verified_by, notes }) => {
      const sets: string[] = []; const vals: any[] = [];
      if (status) { sets.push("status=?"); vals.push(status); }
      if (assigned_to) { sets.push("assigned_to=?"); vals.push(assigned_to); }
      if (qa_verified !== undefined) { sets.push("qa_verified=?"); vals.push(qa_verified ? 1 : 0); }
      if (verified_by) { sets.push("verified_by=?"); vals.push(verified_by); }
      if (notes) { sets.push("notes=?"); vals.push(notes); }
      if (sets.length === 0) return { content: [{ type: "text" as const, text: "Nothing to update." }] };
      sets.push("updated_at=datetime('now')");
      vals.push(ticket_id);
      db.prepare(`UPDATE tickets SET ${sets.join(",")} WHERE id=?`).run(...vals);
      return { content: [{ type: "text" as const, text: `Ticket #${ticket_id} updated.` }] };
    }
  );

  server.tool(
    "add_retro_finding",
    "Add a retrospective finding to a sprint",
    {
      sprint_id: z.number().describe("Sprint ID"),
      category: z.enum(["went_well", "went_wrong", "try_next"]),
      finding: z.string().describe("The finding text"),
      role: z.string().optional().describe("Role that reported this"),
      action_owner: z.string().optional().describe("Who owns the action"),
    },
    async ({ sprint_id, category, finding, role, action_owner }) => {
      db.prepare(`INSERT INTO retro_findings (sprint_id, category, finding, role, action_owner) VALUES (?,?,?,?,?)`).run(sprint_id, category, finding, role || null, action_owner || null);
      return { content: [{ type: "text" as const, text: `Retro finding added: [${category}] ${finding}` }] };
    }
  );

  server.tool(
    "create_blocker",
    "Report a blocker on a sprint",
    {
      sprint_id: z.number().describe("Sprint ID"),
      description: z.string().describe("What is blocked and why"),
      ticket_id: z.number().optional().describe("Related ticket ID"),
      reported_by: z.string().optional(),
      escalated_to: z.string().optional(),
    },
    async ({ sprint_id, description, ticket_id, reported_by, escalated_to }) => {
      db.prepare(`INSERT INTO blockers (sprint_id, ticket_id, description, reported_by, escalated_to) VALUES (?,?,?,?,?)`).run(sprint_id, ticket_id || null, description, reported_by || null, escalated_to || null);
      return { content: [{ type: "text" as const, text: `Blocker reported: ${description}` }] };
    }
  );

  server.tool(
    "resolve_blocker",
    "Mark a blocker as resolved",
    { blocker_id: z.number().describe("Blocker ID") },
    async ({ blocker_id }) => {
      db.prepare(`UPDATE blockers SET status='resolved', resolved_at=datetime('now') WHERE id=?`).run(blocker_id);
      return { content: [{ type: "text" as const, text: `Blocker #${blocker_id} resolved.` }] };
    }
  );

  server.tool(
    "log_bug",
    "Log a bug against a sprint",
    {
      sprint_id: z.number().describe("Sprint ID"),
      severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
      description: z.string(),
      ticket_id: z.number().optional().describe("Related ticket ID"),
      steps_to_reproduce: z.string().optional(),
      expected: z.string().optional(),
      actual: z.string().optional(),
    },
    async ({ sprint_id, severity, description, ticket_id, steps_to_reproduce, expected, actual }) => {
      db.prepare(`INSERT INTO bugs (sprint_id, ticket_id, severity, description, steps_to_reproduce, expected, actual) VALUES (?,?,?,?,?,?,?)`).run(sprint_id, ticket_id || null, severity, description, steps_to_reproduce || null, expected || null, actual || null);
      return { content: [{ type: "text" as const, text: `Bug logged: [${severity}] ${description}` }] };
    }
  );

  server.tool(
    "sync_scrum_data",
    "Re-import scrum data from .claude/ directory into the database",
    { claude_dir: z.string().describe("Path to the .claude directory") },
    async ({ claude_dir }) => {
      try {
        const { importScrumData: doImport } = await import("./import.js");
        const result = doImport(db, claude_dir);
        return { content: [{ type: "text" as const, text: `Synced: ${result.agents} agents, ${result.sprints} sprints, ${result.tickets} tickets, ${result.skills} skills` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Sync error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "export_sprint_report",
    "Generate a complete markdown sprint report",
    { sprint_id: z.number().describe("Sprint ID") },
    async ({ sprint_id }) => {
      const sprint = db.prepare(`SELECT * FROM sprints WHERE id=?`).get(sprint_id) as any;
      if (!sprint) return { content: [{ type: "text" as const, text: `Sprint ${sprint_id} not found.` }] };
      const tickets = db.prepare(`SELECT * FROM tickets WHERE sprint_id=? ORDER BY priority, status`).all(sprint_id) as any[];
      const retro = db.prepare(`SELECT * FROM retro_findings WHERE sprint_id=? ORDER BY category`).all(sprint_id) as any[];
      const bugs = db.prepare(`SELECT * FROM bugs WHERE sprint_id=?`).all(sprint_id) as any[];
      const blockers = db.prepare(`SELECT * FROM blockers WHERE sprint_id=?`).all(sprint_id) as any[];

      const totalPts = tickets.reduce((s: number, t: any) => s + (t.story_points || 0), 0);
      const donePts = tickets.filter((t: any) => t.status === 'DONE').reduce((s: number, t: any) => s + (t.story_points || 0), 0);

      const lines = [
        `# Sprint Report: ${sprint.name}`,
        `**Status:** ${sprint.status} | **Goal:** ${sprint.goal || '—'}`,
        `**Velocity:** ${donePts}/${totalPts} points (${sprint.velocity_completed || 0}/${sprint.velocity_committed || 0} committed)`,
        '',
        `## Tickets (${tickets.length})`,
        '| Ref | Title | Priority | Status | Assignee | Points | QA |',
        '|-----|-------|----------|--------|----------|--------|----|',
        ...tickets.map((t: any) => `| ${t.ticket_ref || '#' + t.id} | ${t.title} | ${t.priority} | ${t.status} | ${t.assigned_to || '—'} | ${t.story_points || 0} | ${t.qa_verified ? 'Yes' : 'No'} |`),
        '',
      ];

      if (bugs.length) {
        lines.push(`## Bugs (${bugs.length})`);
        bugs.forEach((b: any) => lines.push(`- [${b.status}] ${b.severity}: ${b.description}`));
        lines.push('');
      }
      if (blockers.length) {
        lines.push(`## Blockers (${blockers.length})`);
        blockers.forEach((b: any) => lines.push(`- [${b.status}] ${b.description}`));
        lines.push('');
      }
      if (retro.length) {
        lines.push(`## Retrospective (${retro.length} findings)`);
        ['went_well', 'went_wrong', 'try_next'].forEach(cat => {
          const items = retro.filter((f: any) => f.category === cat);
          if (items.length) {
            lines.push(`### ${cat.replace('_', ' ')}`);
            items.forEach((f: any) => lines.push(`- ${f.finding} (${f.role || 'team'})`));
          }
        });
      }

      return { content: [{ type: "text" as const, text: lines.join('\n') }] };
    }
  );
}
