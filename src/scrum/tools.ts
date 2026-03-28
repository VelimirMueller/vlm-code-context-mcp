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
    { status: z.enum(["preparation", "kickoff", "planning", "implementation", "qa", "refactoring", "retro", "review", "closed", "rest"]).optional().describe("Filter by status") },
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
      milestone_id: z.number().optional().describe("Milestone ID to associate with"),
    },
    async ({ name, goal, start_date, end_date, milestone_id }) => {
      try {
        const result = db.prepare(`INSERT INTO sprints (name, goal, start_date, end_date, milestone_id, status) VALUES (?, ?, ?, ?, ?, 'planning')`).run(name, goal || null, start_date || null, end_date || null, milestone_id || null);
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
      status: z.enum(["preparation", "kickoff", "planning", "implementation", "qa", "refactoring", "retro", "review", "closed", "rest"]).optional(),
      goal: z.string().optional(),
      velocity_committed: z.number().optional(),
      velocity_completed: z.number().optional(),
      milestone_id: z.number().optional().describe("Milestone ID to associate with"),
    },
    async ({ sprint_id, status, goal, velocity_committed, velocity_completed, milestone_id }) => {
      const sets: string[] = []; const vals: any[] = [];
      if (status) { sets.push("status=?"); vals.push(status); }
      if (goal) { sets.push("goal=?"); vals.push(goal); }
      if (milestone_id !== undefined) { sets.push("milestone_id=?"); vals.push(milestone_id); }
      if (velocity_committed !== undefined) { sets.push("velocity_committed=?"); vals.push(velocity_committed); }
      if (velocity_completed !== undefined) { sets.push("velocity_completed=?"); vals.push(velocity_completed); }
      if (sets.length === 0) return { content: [{ type: "text" as const, text: "Nothing to update." }] };
      sets.push("updated_at=datetime('now')");
      vals.push(sprint_id);
      db.prepare(`UPDATE sprints SET ${sets.join(",")} WHERE id=?`).run(...vals);

      // M12-015: Auto-generate retro analysis when sprint is closed
      let retroNote = "";
      if (status === "closed") {
        try {
          const sprint = db.prepare(`SELECT * FROM sprints WHERE id=?`).get(sprint_id) as any;
          const tickets = db.prepare(`SELECT id, status, story_points FROM tickets WHERE sprint_id=?`).all(sprint_id) as any[];
          const totalTickets = tickets.length;
          const doneTickets = tickets.filter((t: any) => t.status === "DONE").length;
          const completionRate = totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : 0;
          const committedPts = sprint.velocity_committed || 0;
          const completedPts = sprint.velocity_completed || tickets.filter((t: any) => t.status === "DONE").reduce((s: number, t: any) => s + (t.story_points || 0), 0);
          const velocityDelta = completedPts - committedPts;
          const blockerCount = (db.prepare(`SELECT COUNT(*) as c FROM blockers WHERE sprint_id=?`).get(sprint_id) as any).c;

          // Velocity trend from last 5 closed sprints
          const recentSprints = db.prepare(`SELECT name, velocity_committed, velocity_completed FROM sprints WHERE status='closed' AND id != ? ORDER BY id DESC LIMIT 5`).all(sprint_id) as any[];
          const trendText = recentSprints.length > 0
            ? recentSprints.map((s: any) => `${s.name}: ${s.velocity_completed}/${s.velocity_committed}`).join(", ")
            : "No prior sprints";

          const summary = [
            `Auto-analysis for ${sprint.name}:`,
            `Velocity: ${completedPts}/${committedPts} (delta: ${velocityDelta >= 0 ? "+" : ""}${velocityDelta})`,
            `Ticket completion: ${doneTickets}/${totalTickets} (${completionRate}%)`,
            `Blockers: ${blockerCount}`,
            `Trend (last 5): ${trendText}`,
          ].join(" | ");

          db.prepare(`INSERT INTO retro_findings (sprint_id, category, finding, role) VALUES (?, 'auto_analysis', ?, 'system')`).run(sprint_id, summary);
          retroNote = "\nAuto retro analysis generated.";
        } catch {
          // Non-fatal — don't block the update
        }
      }

      return { content: [{ type: "text" as const, text: `Sprint ${sprint_id} updated.${retroNote}` }] };
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MILESTONE & BACKLOG OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "create_milestone",
    "Create a new milestone for the product roadmap",
    {
      name: z.string().describe("Milestone name (must be unique)"),
      description: z.string().optional().describe("Milestone description"),
      target_date: z.string().optional().describe("Target date (ISO 8601)"),
      status: z.enum(["planned", "active", "completed"]).optional().default("planned"),
    },
    async ({ name, description, target_date, status }) => {
      try {
        const result = db.prepare(`INSERT INTO milestones (name, description, target_date, status) VALUES (?, ?, ?, ?)`).run(name, description || null, target_date || null, status);
        return { content: [{ type: "text" as const, text: `Milestone created: ${name} (id: ${result.lastInsertRowid})` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "update_milestone",
    "Update a milestone's status, progress, or details",
    {
      milestone_id: z.number().describe("Milestone ID"),
      status: z.enum(["planned", "active", "completed"]).optional(),
      description: z.string().optional(),
      progress: z.number().min(0).max(100).optional().describe("Progress percentage 0-100"),
      target_date: z.string().optional(),
    },
    async ({ milestone_id, status, description, progress, target_date }) => {
      const sets: string[] = []; const vals: any[] = [];
      if (status) { sets.push("status=?"); vals.push(status); }
      if (description) { sets.push("description=?"); vals.push(description); }
      if (progress !== undefined) { sets.push("progress=?"); vals.push(progress); }
      if (target_date) { sets.push("target_date=?"); vals.push(target_date); }
      if (sets.length === 0) return { content: [{ type: "text" as const, text: "Nothing to update." }] };
      sets.push("updated_at=datetime('now')");
      vals.push(milestone_id);
      db.prepare(`UPDATE milestones SET ${sets.join(",")} WHERE id=?`).run(...vals);
      return { content: [{ type: "text" as const, text: `Milestone ${milestone_id} updated.` }] };
    }
  );

  server.tool(
    "link_ticket_to_milestone",
    "Link a ticket to a milestone by setting its milestone_id",
    {
      ticket_id: z.number().describe("Ticket ID"),
      milestone_id: z.number().describe("Milestone ID"),
    },
    async ({ ticket_id, milestone_id }) => {
      try {
        const milestone = db.prepare(`SELECT id, name FROM milestones WHERE id=?`).get(milestone_id) as any;
        if (!milestone) return { content: [{ type: "text" as const, text: `Milestone ${milestone_id} not found.` }], isError: true };
        db.prepare(`UPDATE tickets SET milestone_id=?, milestone=?, updated_at=datetime('now') WHERE id=?`).run(milestone_id, milestone.name, ticket_id);
        return { content: [{ type: "text" as const, text: `Ticket #${ticket_id} linked to milestone "${milestone.name}" (id: ${milestone_id}).` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "update_vision",
    "Create or update the PRODUCT_VISION skill content",
    {
      content: z.string().describe("Product vision content (markdown)"),
    },
    async ({ content }) => {
      try {
        db.prepare(`INSERT INTO skills (name, content, owner_role) VALUES ('PRODUCT_VISION', ?, 'product-owner') ON CONFLICT(name) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`).run(content);
        return { content: [{ type: "text" as const, text: `Product vision updated (${content.length} chars).` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_backlog",
    "List all backlog tickets — unassigned to any sprint or carried over from closed sprints",
    {},
    async () => {
      const tickets = db.prepare(`
        SELECT t.id, t.ticket_ref, t.title, t.priority, t.status, t.story_points, t.assigned_to, t.milestone
        FROM tickets t
        WHERE t.sprint_id IS NULL
          OR (t.status IN ('TODO','NOT_DONE') AND t.sprint_id IN (SELECT id FROM sprints WHERE status = 'closed'))
        ORDER BY t.priority, t.created_at
      `).all() as any[];
      if (tickets.length === 0) return { content: [{ type: "text" as const, text: "Backlog is empty." }] };
      const text = tickets.map(t => `[${t.status}] ${t.priority} ${t.ticket_ref || "#"+t.id}: ${t.title} (${t.story_points || 0}sp) @${t.assigned_to || "?"}`).join("\n");
      return { content: [{ type: "text" as const, text: `# Backlog (${tickets.length})\n\n${text}` }] };
    }
  );

  server.tool(
    "plan_sprint",
    "Create a new sprint and assign tickets to it in one operation",
    {
      name: z.string().describe("Sprint name (e.g. 'sprint-2026-04-07')"),
      goal: z.string().optional().describe("Sprint goal"),
      ticket_ids: z.array(z.number()).describe("Array of ticket IDs to assign to this sprint"),
      velocity_committed: z.number().optional().describe("Committed velocity in story points"),
    },
    async ({ name, goal, ticket_ids, velocity_committed }) => {
      try {
        const result = db.prepare(`INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, 'planning', ?)`).run(name, goal || null, velocity_committed || 0);
        const sprintId = result.lastInsertRowid;
        const updateStmt = db.prepare(`UPDATE tickets SET sprint_id=?, updated_at=datetime('now') WHERE id=?`);
        for (const tid of ticket_ids) {
          updateStmt.run(sprintId, tid);
        }
        return { content: [{ type: "text" as const, text: `Sprint "${name}" created (id: ${sprintId}) with ${ticket_ids.length} tickets assigned.` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE DUMP / RESTORE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "dump_database",
    "Export the entire database to JSON for backup/restore",
    {
      tables: z.array(z.string()).optional().describe("Specific tables to export (default: all)"),
    },
    async ({ tables }) => {
      try {
        const allTables = [
          "agents", "sprints", "tickets", "subtasks", "retro_findings",
          "blockers", "bugs", "skills", "processes", "milestones",
          "files", "exports", "dependencies", "directories", "changes"
        ];
        const targetTables = tables && tables.length > 0 ? tables : allTables;

        const dump: Record<string, any[]> = {};
        for (const table of targetTables) {
          try {
            dump[table] = db.prepare(`SELECT * FROM ${table}`).all();
          } catch {
            // Table might not exist — skip
          }
        }

        const output = {
          version: "2.0.0",
          exported_at: new Date().toISOString(),
          tables: dump,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "restore_database",
    "Restore database from a JSON dump. Wraps in transaction for safety.",
    {
      dump_json: z.string().describe("The full JSON dump string from dump_database"),
    },
    async ({ dump_json }) => {
      try {
        const dump = JSON.parse(dump_json);
        if (!dump.version || !dump.tables) {
          return { content: [{ type: "text" as const, text: "Error: Invalid dump format. Expected {version, tables}." }], isError: true };
        }

        // Foreign key ordering: parents before children
        const order = [
          "milestones", "agents", "skills", "processes",
          "sprints", "tickets", "subtasks",
          "retro_findings", "blockers", "bugs",
          "files", "exports", "dependencies", "directories", "changes"
        ];

        const results: string[] = [];
        const transaction = db.transaction(() => {
          for (const table of order) {
            const rows = dump.tables[table];
            if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

            const cols = Object.keys(rows[0]);
            const placeholders = cols.map(() => "?").join(",");
            const stmt = db.prepare(
              `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`
            );

            let count = 0;
            for (const row of rows) {
              stmt.run(...cols.map(c => row[c] ?? null));
              count++;
            }
            results.push(`${table}: ${count} rows`);
          }
        });

        transaction();

        return { content: [{ type: "text" as const, text: `# Restore Complete\n\nVersion: ${dump.version}\nExported: ${dump.exported_at}\n\n${results.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "export_to_file",
    "Export database to a JSON file on disk",
    {
      output_path: z.string().optional().describe("File path (default: ./code-context-dump.json)"),
    },
    async ({ output_path }) => {
      try {
        const filePath = output_path || "./code-context-dump.json";

        const allTables = [
          "agents", "sprints", "tickets", "subtasks", "retro_findings",
          "blockers", "bugs", "skills", "processes", "milestones",
          "files", "exports", "dependencies", "directories", "changes"
        ];

        const dump: Record<string, any[]> = {};
        for (const table of allTables) {
          try { dump[table] = db.prepare(`SELECT * FROM ${table}`).all(); } catch {}
        }

        const output = {
          version: "2.0.0",
          exported_at: new Date().toISOString(),
          tables: dump,
        };

        const fs = await import("fs");
        const json = JSON.stringify(output, null, 2);
        fs.writeFileSync(filePath, json);

        const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
        const tableCount = Object.keys(dump).filter(k => dump[k].length > 0).length;
        const rowCount = Object.values(dump).reduce((s, rows) => s + rows.length, 0);

        return { content: [{ type: "text" as const, text: `Exported to ${filePath} (${sizeMB}MB, ${tableCount} tables, ${rowCount} rows)` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "import_from_file",
    "Restore database from a JSON dump file on disk",
    {
      input_path: z.string().describe("Path to the JSON dump file"),
    },
    async ({ input_path }) => {
      try {
        const fs = await import("fs");
        if (!fs.existsSync(input_path)) {
          return { content: [{ type: "text" as const, text: `Error: File not found: ${input_path}` }], isError: true };
        }

        const json = fs.readFileSync(input_path, "utf-8");
        const dump = JSON.parse(json);

        if (!dump.version || !dump.tables) {
          return { content: [{ type: "text" as const, text: "Error: Invalid dump format." }], isError: true };
        }

        // Same restore logic as restore_database
        const order = [
          "milestones", "agents", "skills", "processes",
          "sprints", "tickets", "subtasks",
          "retro_findings", "blockers", "bugs",
          "files", "exports", "dependencies", "directories", "changes"
        ];

        const results: string[] = [];
        const transaction = db.transaction(() => {
          for (const table of order) {
            const rows = dump.tables[table];
            if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
            const cols = Object.keys(rows[0]);
            const placeholders = cols.map(() => "?").join(",");
            const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`);
            let count = 0;
            for (const row of rows) { stmt.run(...cols.map(c => row[c] ?? null)); count++; }
            results.push(`${table}: ${count} rows`);
          }
        });
        transaction();

        return { content: [{ type: "text" as const, text: `# Restored from ${input_path}\n\nVersion: ${dump.version}\nExported: ${dump.exported_at}\n\n${results.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Sprint Process Instructions ────────────────────────────────────────────
  const INSTRUCTION_SECTIONS: Record<string, string> = {
    lifecycle: `## Sprint Lifecycle (10 phases)
1. **preparation** → Groom backlog, confirm capacity, prepare sprint backlog (0.5 day)
2. **kickoff** → Align team on goals, assign roles, Sprint Kickoff ceremony (0.5 day)
3. **planning** → Define sprint goal, assign tickets & points, commit velocity (~19pts target) (0.5 day)
4. **implementation** → Development work in progress, daily standups (3 days)
5. **qa** → Verify acceptance criteria, run tests — MANDATORY gate, bugs return to implementation (1 day)
6. **refactoring** → Code cleanup, tech debt reduction (0.5 day)
7. **retro** → Auto-generate analysis, collect findings, Retrospective ceremony (0.5 day)
8. **review** → Stakeholder demo, approve deliverables, Sprint Review ceremony (0.5 day)
9. **closed** → Rebuild marketing stats, archive sprint — CANNOT close without retro findings
10. **rest** → Team recovery, knowledge sharing (1 day)

**Status flow:** preparation → kickoff → planning → implementation → qa → refactoring → retro → review → closed → rest
**Bug return:** If QA finds bugs, sprint returns to implementation phase.`,

    tickets: `## Ticket Workflow
**Status flow:** TODO → IN_PROGRESS → DONE

### Critical Rules
1. **Move to IN_PROGRESS** — When starting work on a ticket, IMMEDIATELY set status to IN_PROGRESS. Do not leave tickets in TODO while actively working on them.
2. **Query Before Update** — ALWAYS use \`list_tickets\` to get IDs before \`update_ticket\`. Internal DB IDs are NOT sequential.
3. **QA Gate** — \`qa_verified\` must be true before status → DONE.
4. **Acceptance Criteria** — Must be defined during sprint planning.
5. **Point Cap** — No single dev should exceed 8 story points.
6. **Minimum Ticket Rule** — Every team member must be assigned at least 1 ticket per sprint. Be creative with assignments: security specialist can audit a feature, QA can write test plans, architect can document decisions, manager can review metrics, marketing can draft release notes. No one sits idle.
7. **Burnout Protection** — It is FORBIDDEN to assign tickets to team members who are burned out (mood ≤ 2). If a dev is burned out, reduce sprint scope instead of overloading the team. Check agent mood via \`list_agents\` before sprint planning. Sustainable pace > velocity targets.`,

    retro: `## Retrospective Process
Retros are **MANDATORY** — never skip, even when sprint is green.

### Required Categories
- **went_well** — What worked? Continue doing this.
- **went_wrong** — What caused friction? Root-cause it.
- **try_next** — What experiments for next sprint?

### Rules
- Each role contributes at least one finding
- Action items need an \`action_owner\` assigned
- Sprint CANNOT close until retro findings exist (minimum 3, one per category)`,

    roles: `## Role Responsibilities
- **product-owner** — Requirements, prioritization, milestone roadmap, accept/reject work
- **scrum-master** — Blockers, status tracking, process enforcement, ceremonies
- **architect** — System design, infrastructure, CI/CD, technical standards
- **lead-developer** — Technical decisions, code quality, conflict resolution
- **backend-developer** — APIs, database, business logic, integrations
- **frontend-developer** — UI components, styling, responsive design, UX (lead frontend)
- **frontend-developer-2** — React component architecture, Zustand stores, Framer Motion, data visualization
- **frontend-developer-3** — Design systems, accessibility, SVG icons, CSS architecture, visual polish
- **qa** — Test plans, acceptance verification, bug tickets, set qa_verified
- **security-specialist** — Vulnerability audits, CVE monitoring, input sanitization
- **manager** — Cost efficiency, prevent over-engineering, business alignment
- **marketing-senior-1** — Release communications, feature announcements, changelog narratives, product positioning
- **marketing-senior-2** — Market research, competitive analysis, user-facing documentation, growth metrics`,

    checklist: `## Sprint Close Checklist
- [ ] All tickets DONE or explicitly NOT_DONE with reason
- [ ] All DONE tickets have \`qa_verified = true\`
- [ ] No tickets stuck in IN_PROGRESS
- [ ] Retro findings added (min 3: one went_well, one went_wrong, one try_next)
- [ ] Action items have owners assigned
- [ ] Sprint \`velocity_completed\` updated
- [ ] Sprint status set to \`closed\``,

    pitfalls: `## Common Pitfalls
- **Skipping Retros** — "Sprint went perfectly" → Wrong: even green sprints have lessons
- **Assuming Ticket IDs** — "T-042 is probably ID 42" → Wrong: always query with list_tickets
- **DONE Without QA** — "Works on my machine" → Wrong: qa_verified must be true
- **Overloading Devs** — "Alice can do 15pts" → Wrong: max 8pts per dev
- **Burning Out Devs** — "They can push through" → Wrong: burned-out devs (mood ≤ 2) CANNOT be assigned tickets. Reduce scope.
- **Closing Early** — "All tickets done" → Wrong: must add retro findings first`,
  };

  server.tool(
    "get_sprint_instructions",
    "Get sprint process instructions — lifecycle, ticket workflow, retro rules, role responsibilities, and close checklist. Call with no args for full guide, or pass a section name.",
    { section: z.enum(["lifecycle", "tickets", "retro", "roles", "checklist", "pitfalls"]).optional().describe("Specific section to retrieve") },
    async ({ section }) => {
      if (section) {
        const text = INSTRUCTION_SECTIONS[section];
        if (!text) return { content: [{ type: "text" as const, text: `Unknown section. Available: ${Object.keys(INSTRUCTION_SECTIONS).join(", ")}` }], isError: true };
        return { content: [{ type: "text" as const, text }] };
      }
      const full = `# Sprint Process Instructions\n\n${Object.values(INSTRUCTION_SECTIONS).join("\n\n---\n\n")}`;
      return { content: [{ type: "text" as const, text: full }] };
    }
  );

  // ─── Project Status ──────────────────────────────────────────────────────────
  server.tool(
    "get_project_status",
    "Check if the project is properly set up and return health status",
    {},
    async () => {
      const fileCount = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any).c;
      const agentCount = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c;
      const sprintCount = (db.prepare("SELECT COUNT(*) as c FROM sprints").get() as any).c;
      const ticketCount = (db.prepare("SELECT COUNT(*) as c FROM tickets").get() as any).c;
      const skillCount = (db.prepare("SELECT COUNT(*) as c FROM skills").get() as any).c;

      const status = {
        initialized: fileCount > 0,
        files_indexed: fileCount,
        agents_configured: agentCount,
        sprints_created: sprintCount,
        tickets_total: ticketCount,
        skills_loaded: skillCount,
      };

      const lines = [
        "# Project Status",
        "",
        `Files indexed: ${status.files_indexed}`,
        `Agents: ${status.agents_configured}`,
        `Sprints: ${status.sprints_created}`,
        `Tickets: ${status.tickets_total}`,
        `Skills: ${status.skills_loaded}`,
        "",
        status.initialized ? "Project is set up and ready." : "Project needs setup. Run: code-context-mcp setup .",
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  // ─── Onboarding ──────────────────────────────────────────────────────────────
  server.tool(
    "get_onboarding_status",
    "Check project setup status and return what is configured vs missing",
    {},
    async () => {
      const checks = [
        { name: "Database initialized", check: () => { try { db.prepare("SELECT 1 FROM files LIMIT 1").get(); return true; } catch { return false; } }, fix: "Run: code-context-mcp setup ." },
        { name: "Files indexed", check: () => (db.prepare("SELECT COUNT(*) as c FROM files").get() as any).c > 0, fix: "Run: code-context-mcp setup . (or index_directory tool)" },
        { name: "Agents configured", check: () => (db.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c > 0, fix: "Create .claude/agents/ with agent .md files, then run sync_scrum_data" },
        { name: "Sprint process loaded", check: () => { const s = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name='SPRINT_PROCESS'").get() as any; return s.c > 0; }, fix: "Create .claude/skills/SPRINT_PROCESS.md" },
        { name: "Product vision exists", check: () => { const s = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name='PRODUCT_VISION'").get() as any; return s.c > 0; }, fix: "Create .claude/skills/PRODUCT_VISION.md or use update_vision tool" },
        { name: "Milestones defined", check: () => { const m = db.prepare("SELECT COUNT(*) as c FROM milestones").get() as any; const s = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name='MILESTONES'").get() as any; return m.c > 0 || s.c > 0; }, fix: "Create milestones with create_milestone tool" },
        { name: "At least one sprint", check: () => (db.prepare("SELECT COUNT(*) as c FROM sprints").get() as any).c > 0, fix: "Create a sprint with create_sprint or plan_sprint tool" },
      ];

      const results = checks.map(c => {
        const ok = c.check();
        return `${ok ? "✅" : "❌"} ${c.name}${ok ? "" : "\n   Fix: " + c.fix}`;
      });

      const done = checks.filter(c => c.check()).length;
      const total = checks.length;

      return { content: [{ type: "text" as const, text: `# Onboarding Status (${done}/${total})\n\n${results.join("\n\n")}` }] };
    }
  );

  server.tool(
    "run_onboarding",
    "Run the full project onboarding sequence — checks and fixes all missing setup steps",
    {
      project_path: z.string().optional().describe("Project root path (default: cwd)"),
    },
    async ({ project_path }) => {
      const steps: string[] = [];
      const projectDir = project_path || process.cwd();

      // Step 1: Check agents
      const agentCount = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c;
      if (agentCount === 0) {
        // Try to import from .claude/agents/
        const fs = await import("fs");
        const path = await import("path");
        const claudeDir = path.resolve(projectDir, ".claude");
        const agentsDir = path.join(claudeDir, "agents");
        if (fs.existsSync(agentsDir)) {
          const { importScrumData } = await import("../scrum/import.js");
          const result = importScrumData(db, claudeDir);
          steps.push(`Imported ${result.agents} agents, ${result.sprints} sprints, ${result.skills} skills`);
        } else {
          steps.push("⚠️ No .claude/agents/ found — run setup first to create templates");
        }
      } else {
        steps.push(`✅ ${agentCount} agents already configured`);
      }

      // Step 2: Check sprint process
      const sprintProcess = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name='SPRINT_PROCESS'").get() as any;
      if (sprintProcess.c === 0) {
        steps.push("⚠️ No sprint process loaded — create .claude/skills/SPRINT_PROCESS.md");
      } else {
        steps.push("✅ Sprint process loaded");
      }

      // Step 3: Check files indexed
      const fileCount = (db.prepare("SELECT COUNT(*) as c FROM files").get() as any).c;
      if (fileCount === 0) {
        steps.push("⚠️ No files indexed — run: code-context-mcp setup . (or index_directory tool)");
      } else {
        steps.push(`✅ ${fileCount} files indexed`);
      }

      return { content: [{ type: "text" as const, text: `# Onboarding Complete\n\n${steps.join("\n")}` }] };
    }
  );

  server.tool(
    "sync_linear_data",
    "Sync Linear workspace data to the dashboard. Pass user, issues, cycles, and projects fetched from Linear MCP tools.",
    {
      user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        avatarUrl: z.string().nullable(),
      }).optional().describe("Linear user profile from get_user"),
      issues: z.array(z.object({
        id: z.string(),
        identifier: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        priority: z.number(),
        priorityLabel: z.string(),
        status: z.string(),
        statusColor: z.string(),
        labels: z.array(z.string()),
        projectName: z.string().nullable(),
        assigneeId: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
        url: z.string().nullable().optional(),
      })).optional().describe("Linear issues from list_issues"),
      cycles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        startsAt: z.string(),
        endsAt: z.string(),
        completedIssueCount: z.number(),
        totalIssueCount: z.number(),
        status: z.string(),
      })).optional().describe("Linear cycles from list_cycles"),
      projects: z.array(z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        progress: z.number(),
        leadName: z.string().nullable(),
        targetDate: z.string().nullable(),
      })).optional().describe("Linear projects from list_projects"),
      dashboardPort: z.number().optional().default(3333).describe("Dashboard server port (default 3333)"),
    },
    async (params) => {
      try {
        const port = params.dashboardPort ?? 3333;
        const payload = {
          user: params.user,
          issues: params.issues,
          cycles: params.cycles,
          projects: params.projects,
        };

        const response = await fetch(`http://localhost:${port}/api/me/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const synced = result.synced?.join(', ') || 'nothing';
        return {
          content: [{ type: "text" as const, text: `Linear data synced to dashboard: ${synced}` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Sync failed: ${err.message}. Is the dashboard running on port ${params.dashboardPort ?? 3333}?` }],
          isError: true,
        };
      }
    }
  );

  // ─── Remotion Vision Animation ──────────────────────────────────────────────
  server.tool(
    "generate_vision_animation",
    "Generate project vision animation data (JSON) and provide the Remotion render command",
    {
      output_path: z.string().optional().describe("Output path for JSON data (default: ./vision-data.json)"),
    },
    async ({ output_path }) => {
      try {
        const filePath = output_path || "./vision-data.json";

        // Gather data from database
        const vision = db.prepare("SELECT content FROM skills WHERE name = 'PRODUCT_VISION' LIMIT 1").get() as { content: string } | undefined;
        const milestoneRows = db.prepare("SELECT name, status FROM milestones ORDER BY id").all() as { name: string; status: string }[];
        const sprintCount = (db.prepare("SELECT COUNT(*) as c FROM sprints WHERE status = 'closed'").get() as any).c;
        const ticketCount = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = 'DONE'").get() as any).c;
        const totalPoints = (db.prepare("SELECT COALESCE(SUM(velocity_completed), 0) as p FROM sprints WHERE status = 'closed'").get() as any).p;
        const agentCount = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as any).c;

        const data = {
          productName: "vlm-code-context-mcp",
          vision: vision?.content || "AI-powered virtual IT department via MCP",
          milestones: milestoneRows,
          stats: {
            sprints: sprintCount,
            tickets: ticketCount,
            points: totalPoints,
            agents: agentCount,
          },
        };

        const fs = await import("fs");
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        const lines = [
          `# Vision Animation Data Generated`,
          ``,
          `Output: ${filePath}`,
          ``,
          `## Data Summary`,
          `- Product: ${data.productName}`,
          `- Vision: ${data.vision.slice(0, 80)}...`,
          `- Milestones: ${milestoneRows.length}`,
          `- Sprints: ${sprintCount}`,
          `- Tickets: ${ticketCount}`,
          `- Story Points: ${totalPoints}`,
          `- Agents: ${agentCount}`,
          ``,
          `## Render Commands`,
          ``,
          `Preview in browser:`,
          `  npx remotion preview src/remotion/index.tsx`,
          ``,
          `Render MP4:`,
          `  npx remotion render src/remotion/index.tsx VisionVideo --props=${filePath} --output=vision.mp4`,
          ``,
          `Render GIF:`,
          `  npx remotion render src/remotion/index.tsx VisionVideo --props=${filePath} --codec=gif --output=vision.gif`,
        ];

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Epic CRUD Tools ────────────────────────────────────────────────

  server.tool(
    "create_epic",
    "Create a new epic to group related tickets",
    {
      name: z.string().describe("Epic name"),
      description: z.string().optional().describe("Epic description"),
      milestone_id: z.number().optional().describe("Milestone ID to associate with"),
      color: z.string().default("#3b82f6").describe("Hex color for the epic (default #3b82f6)"),
      priority: z.number().min(0).max(4).default(0).describe("Priority 0-4 (default 0)"),
    },
    async ({ name, description, milestone_id, color, priority }) => {
      try {
        const result = db.prepare(
          `INSERT INTO epics (name, description, milestone_id, color, priority) VALUES (?, ?, ?, ?, ?)`
        ).run(name, description ?? null, milestone_id ?? null, color, priority);
        return {
          content: [{ type: "text" as const, text: `Epic created — id: ${result.lastInsertRowid}, name: "${name}"` }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error creating epic: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "update_epic",
    "Update an existing epic's fields",
    {
      epic_id: z.number().describe("Epic ID"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      status: z.string().optional().describe("New status"),
      color: z.string().optional().describe("New hex color"),
      priority: z.number().min(0).max(4).optional().describe("New priority 0-4"),
    },
    async ({ epic_id, name, description, status, color, priority }) => {
      try {
        const fields: string[] = [];
        const values: any[] = [];
        if (name !== undefined) { fields.push("name = ?"); values.push(name); }
        if (description !== undefined) { fields.push("description = ?"); values.push(description); }
        if (status !== undefined) { fields.push("status = ?"); values.push(status); }
        if (color !== undefined) { fields.push("color = ?"); values.push(color); }
        if (priority !== undefined) { fields.push("priority = ?"); values.push(priority); }
        if (fields.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update." }] };
        }
        values.push(epic_id);
        const result = db.prepare(`UPDATE epics SET ${fields.join(", ")} WHERE id = ?`).run(...values);
        if (result.changes === 0) {
          return { content: [{ type: "text" as const, text: `Epic ${epic_id} not found.` }] };
        }
        return { content: [{ type: "text" as const, text: `Epic ${epic_id} updated (${fields.length} field(s)).` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error updating epic: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_epics",
    "List epics with optional status and milestone filters, including ticket progress counts",
    {
      status: z.string().optional().describe("Filter by status"),
      milestone_id: z.number().optional().describe("Filter by milestone ID"),
    },
    async ({ status, milestone_id }) => {
      let q = `SELECT e.*, COUNT(t.id) as ticket_count, SUM(CASE WHEN t.status='DONE' THEN 1 ELSE 0 END) as done_count FROM epics e LEFT JOIN tickets t ON t.epic_id = e.id`;
      const conditions: string[] = [];
      const params: any[] = [];
      if (status) { conditions.push("e.status = ?"); params.push(status); }
      if (milestone_id !== undefined) { conditions.push("e.milestone_id = ?"); params.push(milestone_id); }
      if (conditions.length) { q += " WHERE " + conditions.join(" AND "); }
      q += " GROUP BY e.id ORDER BY e.priority DESC, e.id";
      const epics = db.prepare(q).all(...params) as any[];
      if (epics.length === 0) return { content: [{ type: "text" as const, text: "No epics found." }] };
      const text = epics.map(
        (e: any) => `**${e.name}** (#${e.id}) [${e.status || "open"}] priority=${e.priority || 0} color=${e.color || "#3b82f6"}\n${e.description || "—"}\nTickets: ${e.done_count || 0}/${e.ticket_count || 0} done`
      ).join("\n\n");
      return { content: [{ type: "text" as const, text: `# Epics (${epics.length})\n\n${text}` }] };
    }
  );

  server.tool(
    "link_ticket_to_epic",
    "Link a ticket to an epic, or unlink by passing null epic_id",
    {
      ticket_id: z.number().describe("Ticket ID"),
      epic_id: z.number().nullable().describe("Epic ID (null to unlink)"),
    },
    async ({ ticket_id, epic_id }) => {
      try {
        const result = db.prepare(`UPDATE tickets SET epic_id = ? WHERE id = ?`).run(epic_id, ticket_id);
        if (result.changes === 0) {
          return { content: [{ type: "text" as const, text: `Ticket ${ticket_id} not found.` }] };
        }
        const action = epic_id === null ? "unlinked from epic" : `linked to epic ${epic_id}`;
        return { content: [{ type: "text" as const, text: `Ticket ${ticket_id} ${action}.` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error linking ticket: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // DECISIONS (M12-016)
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "log_decision",
    "Log an architectural or process decision with rationale and alternatives considered",
    {
      title: z.string().describe("Decision title"),
      rationale: z.string().optional().describe("Why this decision was made"),
      alternatives: z.string().optional().describe("Alternatives considered"),
      outcome: z.string().optional().describe("Expected or actual outcome"),
      category: z.string().optional().default("technical").describe("Category (e.g. technical, process, product)"),
    },
    async ({ title, rationale, alternatives, outcome, category }) => {
      try {
        const result = db.prepare(`INSERT INTO decisions (title, rationale, alternatives, outcome, category) VALUES (?,?,?,?,?)`).run(title, rationale || null, alternatives || null, outcome || null, category);
        return { content: [{ type: "text" as const, text: `Decision logged: #${result.lastInsertRowid} — ${title}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_decisions",
    "List logged decisions with optional category filter",
    {
      category: z.string().optional().describe("Filter by category"),
      limit: z.number().optional().default(20).describe("Max results (default 20)"),
    },
    async ({ category, limit }) => {
      let q = `SELECT * FROM decisions WHERE 1=1`;
      const p: any[] = [];
      if (category) { q += " AND category=?"; p.push(category); }
      q += ` ORDER BY created_at DESC LIMIT ?`;
      p.push(limit);
      const decisions = db.prepare(q).all(...p) as any[];
      if (decisions.length === 0) return { content: [{ type: "text" as const, text: "No decisions found." }] };
      const text = decisions.map((d: any) => [
        `**#${d.id}: ${d.title}** [${d.category}]`,
        d.rationale ? `  Rationale: ${d.rationale}` : null,
        d.alternatives ? `  Alternatives: ${d.alternatives}` : null,
        d.outcome ? `  Outcome: ${d.outcome}` : null,
        `  Created: ${d.created_at}`,
      ].filter(Boolean).join("\n")).join("\n\n");
      return { content: [{ type: "text" as const, text: `# Decisions (${decisions.length})\n\n${text}` }] };
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RETRO PATTERN DETECTION (M12-019)
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "analyze_retro_patterns",
    "Analyze retrospective findings across all sprints — category breakdown, recurring issues, and action follow-through rate",
    {},
    async () => {
      try {
        // Total findings count
        const totalRow = db.prepare(`SELECT COUNT(*) as total FROM retro_findings`).get() as any;
        const total = totalRow.total;
        if (total === 0) return { content: [{ type: "text" as const, text: "No retro findings to analyze." }] };

        // Category breakdown
        const categories = db.prepare(`SELECT category, COUNT(*) as count FROM retro_findings GROUP BY category ORDER BY count DESC`).all() as any[];

        // Action applied rate
        const actionStats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN action_applied = 1 THEN 1 ELSE 0 END) as applied FROM retro_findings WHERE action_owner IS NOT NULL`).get() as any;
        const actionRate = actionStats.total > 0 ? Math.round((actionStats.applied / actionStats.total) * 100) : 0;

        // Top recurring went_wrong findings — simple word-frequency approach
        const wrongFindings = db.prepare(`SELECT finding FROM retro_findings WHERE category = 'went_wrong'`).all() as any[];
        const wordCounts: Record<string, { count: number; examples: string[] }> = {};
        const stopWords = new Set(["the", "a", "an", "is", "was", "were", "are", "be", "been", "to", "of", "in", "for", "and", "or", "not", "with", "on", "at", "by", "from", "it", "this", "that", "we", "our", "had", "has", "no", "but"]);
        for (const f of wrongFindings) {
          const words = (f.finding as string).toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
          const seen = new Set<string>();
          for (const w of words) {
            if (seen.has(w)) continue;
            seen.add(w);
            if (!wordCounts[w]) wordCounts[w] = { count: 0, examples: [] };
            wordCounts[w].count++;
            if (wordCounts[w].examples.length < 2) wordCounts[w].examples.push(f.finding);
          }
        }
        const topWords = Object.entries(wordCounts)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 3)
          .map(([word, data]) => `"${word}" (${data.count}x) — e.g. ${data.examples[0]}`);

        // Build report
        const lines = [
          `# Retro Pattern Analysis`,
          ``,
          `**Total findings:** ${total}`,
          ``,
          `## Category Breakdown`,
          ...categories.map((c: any) => `- **${c.category}**: ${c.count} (${Math.round((c.count / total) * 100)}%)`),
          ``,
          `## Action Follow-Through`,
          `- Actions with owners: ${actionStats.total}`,
          `- Actions applied: ${actionStats.applied}`,
          `- Follow-through rate: ${actionRate}%`,
          ``,
          `## Top Recurring Issues (went_wrong)`,
          wrongFindings.length === 0 ? "No went_wrong findings yet." : (topWords.length > 0 ? topWords.map((t, i) => `${i + 1}. ${t}`).join("\n") : "Not enough data for patterns."),
        ];

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ── Sprint Process Config (data-driven) ────────────────────────────────────

  server.tool(
    "get_sprint_config",
    "Read the SPRINT_PROCESS skill from the database — returns the current sprint process configuration",
    {},
    async () => {
      try {
        const row = db.prepare(`SELECT content, owner_role, updated_at FROM skills WHERE name = ?`).get("SPRINT_PROCESS") as any;
        if (!row) {
          return { content: [{ type: "text" as const, text: "No SPRINT_PROCESS config found in skills table. Use update_sprint_config to create one." }] };
        }
        return { content: [{ type: "text" as const, text: `# Sprint Process Config\n\nOwner: ${row.owner_role || "—"}\nUpdated: ${row.updated_at || "—"}\n\n${row.content}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "update_sprint_config",
    "Create or update the SPRINT_PROCESS skill — stores sprint process configuration in the database",
    {
      content: z.string().describe("Sprint process configuration content (markdown)"),
    },
    async ({ content }) => {
      try {
        db.prepare(
          `INSERT INTO skills (name, content, owner_role) VALUES ('SPRINT_PROCESS', ?, 'scrum-master') ON CONFLICT(name) DO UPDATE SET content=excluded.content, owner_role='scrum-master', updated_at=datetime('now')`
        ).run(content);
        return { content: [{ type: "text" as const, text: `Sprint process config updated (${content.length} chars).` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M20: Sprint Metrics & Burndown
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "snapshot_sprint_metrics",
    "Capture a daily burndown snapshot for a sprint — records remaining, completed, added, and removed points",
    {
      sprint_id: z.number().describe("Sprint ID"),
      date: z.string().optional().describe("Date (ISO 8601, defaults to today)"),
    },
    async ({ sprint_id, date }) => {
      try {
        const d = date || new Date().toISOString().split("T")[0];
        const tickets = db.prepare(`SELECT status, story_points FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL`).all(sprint_id) as any[];
        const remaining = tickets.filter(t => t.status !== "DONE").reduce((s, t) => s + (t.story_points || 0), 0);
        const completed = tickets.filter(t => t.status === "DONE").reduce((s, t) => s + (t.story_points || 0), 0);
        db.prepare(`INSERT INTO sprint_metrics (sprint_id, date, remaining_points, completed_points) VALUES (?, ?, ?, ?) ON CONFLICT(sprint_id, date) DO UPDATE SET remaining_points=excluded.remaining_points, completed_points=excluded.completed_points`).run(sprint_id, d, remaining, completed);
        return { content: [{ type: "text" as const, text: `Snapshot ${d}: ${completed}pts done, ${remaining}pts remaining` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_burndown",
    "Get burndown data for a sprint — daily snapshots of remaining vs completed points",
    {
      sprint_id: z.number().describe("Sprint ID"),
    },
    async ({ sprint_id }) => {
      try {
        const sprint = db.prepare(`SELECT name, velocity_committed FROM sprints WHERE id = ?`).get(sprint_id) as any;
        if (!sprint) return { content: [{ type: "text" as const, text: "Sprint not found" }], isError: true };
        const rows = db.prepare(`SELECT date, remaining_points, completed_points, added_points, removed_points FROM sprint_metrics WHERE sprint_id = ? ORDER BY date`).all(sprint_id) as any[];
        if (rows.length === 0) return { content: [{ type: "text" as const, text: `No burndown data for ${sprint.name}. Use snapshot_sprint_metrics to capture data points.` }] };
        const lines = rows.map((r: any) => `${r.date}: ${r.completed_points}pts done, ${r.remaining_points}pts remaining${r.added_points ? ` (+${r.added_points} added)` : ""}${r.removed_points ? ` (-${r.removed_points} removed)` : ""}`);
        return { content: [{ type: "text" as const, text: `# Burndown: ${sprint.name}\nCommitted: ${sprint.velocity_committed}pts\n\n${lines.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M20: Ticket Dependencies
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "add_dependency",
    "Add a dependency between two tickets (blocks, blocked_by, or related)",
    {
      source_ticket_id: z.number().describe("Source ticket ID"),
      target_ticket_id: z.number().describe("Target ticket ID"),
      dependency_type: z.enum(["blocks", "blocked_by", "related"]).default("blocks"),
    },
    async ({ source_ticket_id, target_ticket_id, dependency_type }) => {
      try {
        if (source_ticket_id === target_ticket_id) return { content: [{ type: "text" as const, text: "Cannot create self-dependency" }], isError: true };
        // Check for circular: if target already blocks source
        if (dependency_type === "blocks") {
          const circular = db.prepare(`SELECT id FROM ticket_dependencies WHERE source_ticket_id = ? AND target_ticket_id = ? AND dependency_type = 'blocks'`).get(target_ticket_id, source_ticket_id);
          if (circular) return { content: [{ type: "text" as const, text: "Circular dependency detected — target already blocks source" }], isError: true };
        }
        db.prepare(`INSERT INTO ticket_dependencies (source_ticket_id, target_ticket_id, dependency_type) VALUES (?, ?, ?)`).run(source_ticket_id, target_ticket_id, dependency_type);
        return { content: [{ type: "text" as const, text: `Dependency added: ticket ${source_ticket_id} ${dependency_type} ticket ${target_ticket_id}` }] };
      } catch (e: any) {
        if (e.message.includes("UNIQUE")) return { content: [{ type: "text" as const, text: "Dependency already exists" }], isError: true };
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "remove_dependency",
    "Remove a dependency between two tickets",
    {
      source_ticket_id: z.number().describe("Source ticket ID"),
      target_ticket_id: z.number().describe("Target ticket ID"),
    },
    async ({ source_ticket_id, target_ticket_id }) => {
      try {
        const result = db.prepare(`DELETE FROM ticket_dependencies WHERE source_ticket_id = ? AND target_ticket_id = ?`).run(source_ticket_id, target_ticket_id);
        return { content: [{ type: "text" as const, text: result.changes > 0 ? "Dependency removed." : "No dependency found." }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_dependency_graph",
    "Get all dependencies for a ticket or sprint",
    {
      ticket_id: z.number().optional().describe("Ticket ID (get deps for one ticket)"),
      sprint_id: z.number().optional().describe("Sprint ID (get all deps in sprint)"),
    },
    async ({ ticket_id, sprint_id }) => {
      try {
        let rows: any[];
        if (ticket_id) {
          rows = db.prepare(`
            SELECT d.*, s.ticket_ref as source_ref, s.title as source_title, t.ticket_ref as target_ref, t.title as target_title
            FROM ticket_dependencies d
            JOIN tickets s ON d.source_ticket_id = s.id
            JOIN tickets t ON d.target_ticket_id = t.id
            WHERE d.source_ticket_id = ? OR d.target_ticket_id = ?
          `).all(ticket_id, ticket_id) as any[];
        } else if (sprint_id) {
          rows = db.prepare(`
            SELECT d.*, s.ticket_ref as source_ref, s.title as source_title, t.ticket_ref as target_ref, t.title as target_title
            FROM ticket_dependencies d
            JOIN tickets s ON d.source_ticket_id = s.id
            JOIN tickets t ON d.target_ticket_id = t.id
            WHERE s.sprint_id = ? OR t.sprint_id = ?
          `).all(sprint_id, sprint_id) as any[];
        } else {
          return { content: [{ type: "text" as const, text: "Provide ticket_id or sprint_id" }], isError: true };
        }
        if (rows.length === 0) return { content: [{ type: "text" as const, text: "No dependencies found." }] };
        const lines = rows.map((r: any) => `${r.source_ref} (${r.source_title}) —[${r.dependency_type}]→ ${r.target_ref} (${r.target_title})`);
        return { content: [{ type: "text" as const, text: `# Dependencies (${rows.length})\n\n${lines.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M20: Ticket Tags
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "add_tag",
    "Add a tag to a ticket (creates tag if it doesn't exist)",
    {
      ticket_id: z.number().describe("Ticket ID"),
      tag_name: z.string().describe("Tag name (e.g. 'tech-debt', 'security')"),
      color: z.string().optional().describe("Hex color for new tags (default #6b7280)"),
    },
    async ({ ticket_id, tag_name, color }) => {
      try {
        db.prepare(`INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)`).run(tag_name, color || "#6b7280");
        const tag = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(tag_name) as any;
        db.prepare(`INSERT OR IGNORE INTO ticket_tags (ticket_id, tag_id) VALUES (?, ?)`).run(ticket_id, tag.id);
        return { content: [{ type: "text" as const, text: `Tag '${tag_name}' added to ticket ${ticket_id}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "remove_tag",
    "Remove a tag from a ticket",
    {
      ticket_id: z.number().describe("Ticket ID"),
      tag_name: z.string().describe("Tag name"),
    },
    async ({ ticket_id, tag_name }) => {
      try {
        const tag = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(tag_name) as any;
        if (!tag) return { content: [{ type: "text" as const, text: `Tag '${tag_name}' not found` }], isError: true };
        db.prepare(`DELETE FROM ticket_tags WHERE ticket_id = ? AND tag_id = ?`).run(ticket_id, tag.id);
        return { content: [{ type: "text" as const, text: `Tag '${tag_name}' removed from ticket ${ticket_id}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_tags",
    "List all available tags with usage counts",
    {},
    async () => {
      try {
        const rows = db.prepare(`SELECT t.name, t.color, COUNT(tt.ticket_id) as usage_count FROM tags t LEFT JOIN ticket_tags tt ON t.id = tt.tag_id GROUP BY t.id ORDER BY usage_count DESC`).all() as any[];
        if (rows.length === 0) return { content: [{ type: "text" as const, text: "No tags defined." }] };
        const lines = rows.map((r: any) => `- **${r.name}** (${r.color}) — ${r.usage_count} tickets`);
        return { content: [{ type: "text" as const, text: `# Tags (${rows.length})\n\n${lines.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M20: Time Tracking
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "log_time",
    "Log estimated or actual hours on a ticket",
    {
      ticket_id: z.number().describe("Ticket ID"),
      estimated_hours: z.number().optional().describe("Estimated hours"),
      actual_hours: z.number().optional().describe("Actual hours spent"),
    },
    async ({ ticket_id, estimated_hours, actual_hours }) => {
      try {
        const sets: string[] = []; const vals: any[] = [];
        if (estimated_hours !== undefined) { sets.push("estimated_hours=?"); vals.push(estimated_hours); }
        if (actual_hours !== undefined) { sets.push("actual_hours=?"); vals.push(actual_hours); }
        if (sets.length === 0) return { content: [{ type: "text" as const, text: "Provide estimated_hours or actual_hours" }], isError: true };
        vals.push(ticket_id);
        db.prepare(`UPDATE tickets SET ${sets.join(",")} WHERE id=?`).run(...vals);
        return { content: [{ type: "text" as const, text: `Time logged on ticket ${ticket_id}${estimated_hours !== undefined ? ` — est: ${estimated_hours}h` : ""}${actual_hours !== undefined ? ` — actual: ${actual_hours}h` : ""}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_time_report",
    "Get time tracking report for a sprint — estimated vs actual hours per agent",
    {
      sprint_id: z.number().describe("Sprint ID"),
    },
    async ({ sprint_id }) => {
      try {
        const rows = db.prepare(`
          SELECT assigned_to, COUNT(*) as tickets,
            SUM(estimated_hours) as total_estimated, SUM(actual_hours) as total_actual,
            CASE WHEN SUM(estimated_hours) > 0 THEN ROUND(SUM(actual_hours) / SUM(estimated_hours) * 100, 1) ELSE NULL END as accuracy_pct
          FROM tickets WHERE sprint_id = ? AND deleted_at IS NULL GROUP BY assigned_to ORDER BY assigned_to
        `).all(sprint_id) as any[];
        if (rows.length === 0) return { content: [{ type: "text" as const, text: "No time data for this sprint." }] };
        const lines = rows.map((r: any) => `- **${r.assigned_to}**: ${r.tickets} tickets, est ${r.total_estimated || 0}h, actual ${r.total_actual || 0}h${r.accuracy_pct ? ` (${r.accuracy_pct}% accuracy)` : ""}`);
        const totEst = rows.reduce((s: number, r: any) => s + (r.total_estimated || 0), 0);
        const totAct = rows.reduce((s: number, r: any) => s + (r.total_actual || 0), 0);
        return { content: [{ type: "text" as const, text: `# Time Report\n\n${lines.join("\n")}\n\n**Total:** est ${totEst}h, actual ${totAct}h` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M20: Agent Mood History
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "record_mood",
    "Record an agent's mood for a sprint (1-5 scale)",
    {
      agent_id: z.number().describe("Agent ID"),
      sprint_id: z.number().describe("Sprint ID"),
      mood: z.number().min(1).max(5).describe("Mood 1-5 (1=burned out, 5=energized)"),
      workload_points: z.number().optional().describe("Story points assigned this sprint"),
      notes: z.string().optional().describe("Notes about mood/workload"),
    },
    async ({ agent_id, sprint_id, mood, workload_points, notes }) => {
      try {
        db.prepare(`INSERT INTO agent_mood_history (agent_id, sprint_id, mood, workload_points, notes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(agent_id, sprint_id) DO UPDATE SET mood=excluded.mood, workload_points=excluded.workload_points, notes=excluded.notes`).run(agent_id, sprint_id, mood, workload_points || 0, notes || null);
        const warning = mood <= 2 ? "\n⚠️ BURNOUT RISK — mood ≤ 2. Reduce workload next sprint." : "";
        return { content: [{ type: "text" as const, text: `Mood recorded: agent ${agent_id}, sprint ${sprint_id}, mood ${mood}/5${warning}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_mood_trends",
    "Get mood history for an agent or all agents — detects burnout patterns",
    {
      agent_id: z.number().optional().describe("Agent ID (omit for all agents)"),
      last_n_sprints: z.number().optional().describe("Number of recent sprints (default 5)"),
    },
    async ({ agent_id, last_n_sprints }) => {
      try {
        const limit = last_n_sprints || 5;
        let rows: any[];
        if (agent_id) {
          rows = db.prepare(`
            SELECT m.*, a.name as agent_name, s.name as sprint_name
            FROM agent_mood_history m
            JOIN agents a ON m.agent_id = a.id
            JOIN sprints s ON m.sprint_id = s.id
            WHERE m.agent_id = ?
            ORDER BY s.created_at DESC LIMIT ?
          `).all(agent_id, limit) as any[];
        } else {
          rows = db.prepare(`
            SELECT m.*, a.name as agent_name, s.name as sprint_name
            FROM agent_mood_history m
            JOIN agents a ON m.agent_id = a.id
            JOIN sprints s ON m.sprint_id = s.id
            ORDER BY a.name, s.created_at DESC
          `).all() as any[];
        }
        if (rows.length === 0) return { content: [{ type: "text" as const, text: "No mood data recorded. Use record_mood to start tracking." }] };

        // Detect burnout: mood ≤ 2 for 2+ consecutive sprints
        const byAgent = new Map<string, any[]>();
        rows.forEach((r: any) => { const arr = byAgent.get(r.agent_name) || []; arr.push(r); byAgent.set(r.agent_name, arr); });
        const alerts: string[] = [];
        byAgent.forEach((moods, name) => {
          const consecutive = moods.filter((m: any) => m.mood <= 2).length;
          if (consecutive >= 2) alerts.push(`🔴 **${name}** — mood ≤ 2 for ${consecutive} sprints — BURNOUT RISK`);
        });

        const lines = rows.map((r: any) => `- ${r.agent_name} @ ${r.sprint_name}: mood ${r.mood}/5, ${r.workload_points}pts${r.notes ? ` — ${r.notes}` : ""}`);
        return { content: [{ type: "text" as const, text: `# Mood Trends\n\n${alerts.length > 0 ? alerts.join("\n") + "\n\n" : ""}${lines.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M20: Audit Trail / Event Log
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "get_audit_trail",
    "Get audit trail for an entity — all state changes over time",
    {
      entity_type: z.enum(["ticket", "sprint", "epic", "milestone", "agent", "blocker", "bug"]).describe("Entity type"),
      entity_id: z.number().describe("Entity ID"),
      limit: z.number().optional().describe("Max results (default 50)"),
    },
    async ({ entity_type, entity_id, limit }) => {
      try {
        const rows = db.prepare(`SELECT * FROM event_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT ?`).all(entity_type, entity_id, limit || 50) as any[];
        if (rows.length === 0) return { content: [{ type: "text" as const, text: `No audit trail for ${entity_type} #${entity_id}` }] };
        const lines = rows.map((r: any) => `[${r.created_at}] ${r.action}${r.field_name ? ` ${r.field_name}` : ""}: ${r.old_value || "—"} → ${r.new_value || "—"}${r.actor ? ` (by ${r.actor})` : ""}`);
        return { content: [{ type: "text" as const, text: `# Audit Trail: ${entity_type} #${entity_id} (${rows.length} events)\n\n${lines.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "log_event",
    "Manually log an event in the audit trail",
    {
      entity_type: z.enum(["ticket", "sprint", "epic", "milestone", "agent", "blocker", "bug"]),
      entity_id: z.number(),
      action: z.enum(["created", "updated", "deleted", "status_changed"]),
      field_name: z.string().optional(),
      old_value: z.string().optional(),
      new_value: z.string().optional(),
      actor: z.string().optional(),
    },
    async ({ entity_type, entity_id, action, field_name, old_value, new_value, actor }) => {
      try {
        db.prepare(`INSERT INTO event_log (entity_type, entity_id, action, field_name, old_value, new_value, actor) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(entity_type, entity_id, action, field_name || null, old_value || null, new_value || null, actor || null);
        return { content: [{ type: "text" as const, text: `Event logged: ${entity_type} #${entity_id} ${action}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M20: Velocity Trends
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "get_velocity_trends",
    "Get velocity trend data across sprints — committed vs completed, completion rate, bugs",
    {
      last_n_sprints: z.number().optional().describe("Number of recent sprints (default 10)"),
      status: z.string().optional().describe("Filter by sprint status (e.g. 'closed')"),
    },
    async ({ last_n_sprints, status }) => {
      try {
        let sql = `SELECT * FROM velocity_trends`;
        const params: any[] = [];
        if (status) { sql += ` WHERE status = ?`; params.push(status); }
        sql += ` LIMIT ?`;
        params.push(last_n_sprints || 10);
        const rows = db.prepare(sql).all(...params) as any[];
        if (rows.length === 0) return { content: [{ type: "text" as const, text: "No velocity data available." }] };
        const lines = rows.map((r: any) => `- **${r.sprint_name}** [${r.status}]: ${r.completed}/${r.committed}pts (${r.completion_rate}%), ${r.tickets_done}/${r.tickets_total} tickets, ${r.bugs_found} bugs (${r.bugs_fixed} fixed)`);
        const avgRate = rows.length > 0 ? Math.round(rows.reduce((s: number, r: any) => s + r.completion_rate, 0) / rows.length) : 0;
        return { content: [{ type: "text" as const, text: `# Velocity Trends (${rows.length} sprints)\nAvg completion: ${avgRate}%\n\n${lines.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // M17: Recent Events for Claude Reactivity
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_recent_events",
    "List recent events from the audit trail — use this to detect dashboard-initiated changes (e.g. user moved a Linear issue on the kanban board)",
    {
      entity_type: z.string().optional().describe("Filter by entity type (ticket, sprint, epic, milestone)"),
      limit: z.number().optional().describe("Max results (default 20)"),
    },
    async ({ entity_type, limit }) => {
      try {
        const max = limit || 20;
        let sql = `SELECT * FROM event_log`;
        const params: any[] = [];
        if (entity_type) { sql += ` WHERE entity_type = ?`; params.push(entity_type); }
        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(max);
        const rows = db.prepare(sql).all(...params) as any[];
        if (rows.length === 0) return { content: [{ type: "text" as const, text: "No recent events." }] };
        const lines = rows.map((r: any) => `[${r.created_at}] ${r.action} ${r.entity_type}#${r.entity_id}${r.field_name ? ` (${r.field_name}: ${r.old_value || '—'} → ${r.new_value || '—'})` : ""}${r.actor ? ` by ${r.actor}` : ""}`);
        return { content: [{ type: "text" as const, text: `# Recent Events (${rows.length})\n\n${lines.join("\n")}` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
}
