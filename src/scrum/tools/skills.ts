import type Database from "better-sqlite3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSkillContent } from "../frontend-playbook.js";
import {
  SKILL_SETS,
  formatEnablement,
  getEnabledSkillSets,
  setEnabledSkillSets,
  skillSetForName,
  skillSetsConfigured,
} from "../skill-sets.js";
import { notifyDashboard } from "../tools.js";

/**
 * Skill-serving, factory-reset, and sprint-instruction MCP tools extracted from
 * registerScrumTools (T-268). Handlers are byte-identical to their prior inline
 * definitions; the only dependencies are module-level helpers imported from
 * skill-sets.js, frontend-playbook.js, defaults.js, and tools.js (notifyDashboard).
 */
export function registerSkillsTools(server: McpServer, db: Database.Database): void {

  server.tool(
    "get_skill",
    "Fetch the full content of a single skill by name (e.g. 'fe:set-up-auth', 'la:build-landing-page', 'wf:write-pull-requests', the primer 'fe:_house-style', or a shared/companion ref like 'fe:_shared/<file>'). Use after load_phase_context surfaces a skill index.",
    { name: z.string().describe("Skill name, e.g. 'fe:set-up-auth' or 'wf:write-pull-requests'") },
    async ({ name }) => {
      const set = skillSetForName(name);
      if (set && !getEnabledSkillSets(db)[set.id]) {
        return {
          content: [{
            type: "text" as const,
            text: `Skill set '${set.id}' (${set.prefix}:*) is disabled for this project. Enable it with update_skill_sets({ ${set.id}: true }) — /kickoff also asks on its first run.`,
          }],
        };
      }
      const content = getSkillContent(db, name);
      if (content === null) return { content: [{ type: "text" as const, text: `Skill '${name}' not found.` }] };
      return { content: [{ type: "text" as const, text: content }] };
    },
  );

  server.tool(
    "update_skill_sets",
    "Enable or disable predefined skill sets (frontend fe:*, landing la:*, workflow wf:*) for this project. Partial update — omitted sets keep their current state. Enabled sets are indexed into phase context and served by get_skill.",
    {
      frontend: z.boolean().optional().describe("Serve fe:* skills (default: enabled)"),
      landing: z.boolean().optional().describe("Serve la:* landing-page skills (default: disabled)"),
      workflow: z.boolean().optional().describe("Serve wf:* PR/commit skills (default: disabled)"),
    },
    async ({ frontend, landing, workflow }) => {
      if (frontend === undefined && landing === undefined && workflow === undefined) {
        const current = formatEnablement(getEnabledSkillSets(db), skillSetsConfigured(db));
        return { content: [{ type: "text" as const, text: `Skill sets: ${current}\nPass at least one of { frontend, landing, workflow } to change.` }] };
      }
      const map = setEnabledSkillSets(db, { frontend, landing, workflow });
      const hints = SKILL_SETS.filter((s) => map[s.id]).map((s) => `${s.prefix}:*`);
      return {
        content: [{
          type: "text" as const,
          text: `Skill sets updated: ${formatEnablement(map, true)}\nEnabled sets (${hints.join(", ") || "none"}) are indexed into load_phase_context and pullable via get_skill.`,
        }],
      };
    },
  );

  server.tool(
    "reset_agents",
    "Reset all agents to factory defaults. WARNING: This deletes all current agents and re-seeds from TypeScript defaults.",
    {},
    async () => {
      const { resetAgents } = await import("../defaults.js");
      const count = resetAgents(db);
      notifyDashboard(db);
      return { content: [{ type: "text" as const, text: `Reset complete: ${count} agents restored to factory defaults.` }] };
    }
  );

  server.tool(
    "reset_skills",
    "Reset all skills to factory defaults. WARNING: This deletes all current skills and re-seeds from TypeScript defaults.",
    {},
    async () => {
      const { resetSkills } = await import("../defaults.js");
      const count = resetSkills(db);
      notifyDashboard(db);
      return { content: [{ type: "text" as const, text: `Reset complete: ${count} skills restored to factory defaults.` }] };
    }
  );

  server.tool(
    "reset_sprint_process",
    "Reset sprint process configuration to factory defaults.",
    {},
    async () => {
      const { resetSprintProcess } = await import("../defaults.js");
      resetSprintProcess(db);
      notifyDashboard(db);
      return { content: [{ type: "text" as const, text: `Sprint process reset to factory defaults.` }] };
    }
  );

  const INSTRUCTION_SECTIONS: Record<string, string> = {
    lifecycle: `## Sprint Lifecycle (4 phases)
1. **planning** → Define sprint goal, assign tickets & points, commit velocity (~19pts target), confirm capacity (1 day)
2. **implementation** → Development work, daily standups, QA verification, code reviews (3 days)
3. **done** → Sprint summary, retrospective findings, velocity review (0.5 day)
4. **rest** → Team recovery, knowledge sharing (0.5 day)

**Status flow:** planning → implementation → done → rest
**Gate checks:** Advancing to implementation requires tickets + velocity. Advancing to done requires all tickets resolved. Closing requires retro findings.`,

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

    roles: (() => {
      try {
        const agents = db.prepare("SELECT role, name, description, department FROM agents ORDER BY department, role").all() as { role: string; name: string; description: string; department: string }[];
        if (agents.length === 0) return "## Role Responsibilities\nNo agents configured. Use `reset_agents` to seed the default team.";
        const lines = agents.map(a => `- **${a.role}** (${a.department}) — ${a.description}`);
        return `## Role Responsibilities (${agents.length} agents from DB)\n${lines.join("\n")}\n\nManage agents via \`list_agents\`, \`create_agent\`, or \`reset_agents\`. Always use \`list_agents\` to check real roles before assigning tickets.`;
      } catch { return "## Role Responsibilities\nUse `list_agents` to see current team."; }
    })(),

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
}
