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
    lifecycle: `## Sprint Lifecycle
1. **planning** → Team defines tickets, assigns points, sets velocity target (~19pts)
2. **active** → Development work in progress
3. **review** → Team reviews completed work, updates ticket statuses
4. **closed** → Sprint finalized (CANNOT close without retro findings)`,

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
}
