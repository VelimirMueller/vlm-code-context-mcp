import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * Import scrum data from .claude/ directory into the SQLite database.
 * Reads agents, skills, sprints (with tickets, retro findings, bugs, blockers).
 */
export function importScrumData(db: Database.Database, claudeDir: string): { agents: number; sprints: number; tickets: number; skills: number } {
  if (!fs.existsSync(claudeDir)) return { agents: 0, sprints: 0, tickets: 0, skills: 0 };

  let agentCount = 0, sprintCount = 0, ticketCount = 0, skillCount = 0;

  // ─── Import agents ────────────────────────────────────────────────────────
  const agentsDir = path.join(claudeDir, "agents");
  if (fs.existsSync(agentsDir)) {
    const upsertAgent = db.prepare(`
      INSERT OR REPLACE INTO agents (role, name, description, model, tools, system_prompt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const file of fs.readdirSync(agentsDir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const content = fs.readFileSync(path.join(agentsDir, file), "utf-8");
        const parsed = parseAgentFrontmatter(content);
        if (parsed) {
          upsertAgent.run(parsed.role || file.replace(".md", ""), parsed.name || file.replace(".md", ""), parsed.description || null, parsed.model || null, parsed.tools || null, parsed.body || null);
          agentCount++;
        }
      } catch (e) { console.warn(`[scrum-import] skip agent ${file}: ${(e as Error).message}`); }
    }
  }

  // ─── Import skills ────────────────────────────────────────────────────────
  const skillsDir = path.join(claudeDir, "skills");
  if (fs.existsSync(skillsDir)) {
    const upsertSkill = db.prepare(`INSERT OR REPLACE INTO skills (name, content, owner_role) VALUES (?, ?, ?)`);
    for (const file of fs.readdirSync(skillsDir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const content = fs.readFileSync(path.join(skillsDir, file), "utf-8");
        upsertSkill.run(file.replace(".md", ""), content, null);
        skillCount++;
      } catch (e) { console.warn(`[scrum-import] skip skill ${file}: ${(e as Error).message}`); }
    }
  }

  // ─── Import sprints ───────────────────────────────────────────────────────
  const scrumDir = path.join(claudeDir, "scrum");
  if (fs.existsSync(scrumDir)) {
    const upsertSprint = db.prepare(`
      INSERT INTO sprints (name, goal, status, velocity_committed, velocity_completed)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        goal=CASE WHEN excluded.goal != '' THEN excluded.goal ELSE sprints.goal END,
        velocity_committed=CASE WHEN excluded.velocity_committed > 0 THEN excluded.velocity_committed ELSE sprints.velocity_committed END,
        velocity_completed=CASE WHEN excluded.velocity_completed > 0 THEN excluded.velocity_completed ELSE sprints.velocity_completed END
    `);
    const upsertTicket = db.prepare(`
      INSERT INTO tickets (sprint_id, ticket_ref, title, description, priority, status, assigned_to, story_points, milestone, qa_verified, verified_by, acceptance_criteria, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sprint_id, ticket_ref) DO UPDATE SET
        title=excluded.title, description=excluded.description, priority=excluded.priority,
        assigned_to=excluded.assigned_to, story_points=excluded.story_points, milestone=excluded.milestone,
        acceptance_criteria=excluded.acceptance_criteria, notes=excluded.notes,
        status=CASE WHEN tickets.status='DONE' THEN 'DONE' ELSE excluded.status END,
        qa_verified=CASE WHEN tickets.qa_verified=1 THEN 1 ELSE excluded.qa_verified END
    `);
    const upsertRetro = db.prepare(`
      INSERT INTO retro_findings (sprint_id, role, category, finding, action_owner, action_applied)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const upsertBug = db.prepare(`
      INSERT INTO bugs (sprint_id, severity, description, status)
      VALUES (?, ?, ?, ?)
    `);

    for (const dir of fs.readdirSync(scrumDir)) {
      const sprintPath = path.join(scrumDir, dir);
      if (!fs.statSync(sprintPath).isDirectory()) continue;
      if (dir === "default") continue; // skip template folder

      try {
        // Parse planning.md for goal and velocity
        let goal = "", status = "closed", committed = 0, completed = 0;
        const planningPath = path.join(sprintPath, "PLANNING.md");
        if (fs.existsSync(planningPath)) {
          const planContent = fs.readFileSync(planningPath, "utf-8");
          const goalMatch = planContent.match(/Sprint [Gg]oal[:\s]*(.+)/);
          if (goalMatch) goal = goalMatch[1].trim();
          const committedMatch = planContent.match(/[Cc]ommitted.*?(\d+)\s*(?:story )?points/);
          if (committedMatch) committed = Number(committedMatch[1]);
          const completedMatch = planContent.match(/[Cc]ompleted.*?(\d+)/);
          if (completedMatch) completed = Number(completedMatch[1]);
          if (planContent.includes("to be filled") || planContent.includes("_TBD_")) status = "active";
        }

        upsertSprint.run(dir, goal, status, committed, completed);
        const sprintRow = db.prepare(`SELECT id FROM sprints WHERE name = ?`).get(dir) as { id: number };
        sprintCount++;

        // Parse tickets
        const ticketsPath = path.join(sprintPath, "TICKETS.md");
        if (fs.existsSync(ticketsPath)) {
          const content = fs.readFileSync(ticketsPath, "utf-8");
          const ticketBlocks = content.split(/\n## /);
          for (const block of ticketBlocks.slice(1)) {
            try {
              const titleMatch = block.match(/^(T-\d+):\s*(.+)/);
              if (!titleMatch) continue;
              const ref = titleMatch[1];
              const title = titleMatch[2].trim();
              const priority = extractField(block, "Priority") || "P2";
              const assignedTo = extractField(block, "Assigned to");
              const pointsStr = extractField(block, "Story Points");
              const points = pointsStr ? Number(pointsStr) : null;
              const milestone = extractField(block, "Milestone");
              const statusRaw = extractField(block, "Status") || "TODO";
              const ticketStatus = statusRaw.includes("DONE") ? "DONE" : statusRaw.includes("PARTIAL") ? "PARTIAL" : statusRaw.includes("NOT DONE") ? "NOT_DONE" : statusRaw.includes("IN_PROGRESS") ? "IN_PROGRESS" : statusRaw.includes("BLOCKED") ? "BLOCKED" : "TODO";
              const qaField = extractField(block, "QA Verified");
              const qaVerified = qaField && qaField.toUpperCase() === "YES" ? 1 : 0;
              const verifiedBy = extractField(block, "Verified by");
              const description = extractField(block, "Description");
              const note = extractField(block, "Note");

              // Extract acceptance criteria checkboxes
              const criteriaMatches = block.match(/- \[[ x]\] .+/g);
              const criteria = criteriaMatches ? JSON.stringify(criteriaMatches.map(c => c.replace(/^- \[[ x]\] /, ""))) : null;

              upsertTicket.run(sprintRow.id, ref, title, description, priority, ticketStatus, assignedTo, points, milestone, qaVerified, verifiedBy, criteria, note);
              ticketCount++;
            } catch (e) { console.warn(`[scrum-import] skip ticket in ${dir}: ${(e as Error).message}`); }
          }
        }

        // Parse retro findings
        const retroPath = path.join(sprintPath, "RETRO_FINDINGS.md");
        if (fs.existsSync(retroPath)) {
          const content = fs.readFileSync(retroPath, "utf-8");
          // Find role sections and their findings
          const roleBlocks = content.split(/\n## /);
          for (const roleBlock of roleBlocks.slice(1)) {
            const roleMatch = roleBlock.match(/^(\w[\w\s-]*)/);
            const roleName = roleMatch ? roleMatch[1].trim() : "team";

            // Skip non-finding sections
            if (roleName.startsWith("What") || roleName.startsWith("Format") || roleName.startsWith("Sprint") || roleName.startsWith("ACTION")) continue;

            const wellMatch = roleBlock.match(/\*\*What went well\*\*:\s*(.+)/i);
            if (wellMatch) upsertRetro.run(sprintRow.id, roleName, "went_well", wellMatch[1].trim(), null, 0);

            const wrongMatch = roleBlock.match(/\*\*What went wrong\*\*:\s*(.+)/i);
            if (wrongMatch) upsertRetro.run(sprintRow.id, roleName, "went_wrong", wrongMatch[1].trim(), null, 0);

            const tryMatch = roleBlock.match(/\*\*What to try\*\*:\s*(.+)/i);
            if (tryMatch) upsertRetro.run(sprintRow.id, roleName, "try_next", tryMatch[1].trim(), null, 0);
          }

          // Parse ACTION items
          const actionBlocks = content.match(/### ACTION \d+:.+[\s\S]*?(?=### ACTION|\n---|\n## |$)/g);
          if (actionBlocks) {
            for (const action of actionBlocks) {
              const findingMatch = action.match(/### ACTION \d+:\s*(.+)/);
              const ownerMatch = action.match(/\*\*Owner\*\*:\s*(.+)/);
              if (findingMatch) {
                upsertRetro.run(sprintRow.id, "team", "try_next", findingMatch[1].trim(), ownerMatch ? ownerMatch[1].trim() : null, 0);
              }
            }
          }
        }

        // Parse bugs
        const bugsPath = path.join(sprintPath, "BUGS.md");
        if (fs.existsSync(bugsPath)) {
          const content = fs.readFileSync(bugsPath, "utf-8");
          const bugMatches = content.match(/\| (BUG-\d+) \| (\w+) \| .+? \| (.+?) \|/g);
          if (bugMatches) {
            for (const bugLine of bugMatches) {
              const parts = bugLine.split("|").map(s => s.trim()).filter(Boolean);
              if (parts.length >= 3 && parts[0].startsWith("BUG-")) {
                upsertBug.run(sprintRow.id, parts[1].toUpperCase(), parts[3] || parts[2], "open");
              }
            }
          }
        }
      } catch (e) { console.warn(`[scrum-import] skip sprint ${dir}: ${(e as Error).message}`); }
    }
  }

  return { agents: agentCount, sprints: sprintCount, tickets: ticketCount, skills: skillCount };
}

function parseAgentFrontmatter(content: string): { role?: string; name?: string; description?: string; model?: string; tools?: string; body?: string } | null {
  const parts = content.split("---");
  if (parts.length < 2) return null;
  const fm = parts[1].trim();
  // If no closing ---, body starts after the frontmatter lines end (first blank line or non-key:value line)
  const body = parts.length >= 3 ? parts.slice(2).join("---").trim() : (() => {
    const lines = fm.split("\n");
    const bodyStart = lines.findIndex(l => !l.match(/^\w[\w-]*:/) && l.trim() !== "");
    return bodyStart >= 0 ? lines.slice(bodyStart).join("\n").trim() : "";
  })();

  const result: any = { body };
  for (const line of fm.split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === "name") result.role = val; // "name" in frontmatter is the role identifier
      if (key === "description") { result.description = val; result.name = val.split(".")[0].trim(); }
      if (key === "model") result.model = val;
      if (key === "tools") result.tools = val;
    }
  }
  return result.role ? result : null;
}

function extractField(block: string, field: string): string | null {
  const re = new RegExp(`\\*\\*${field}\\*\\*:\\s*(.+)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}
