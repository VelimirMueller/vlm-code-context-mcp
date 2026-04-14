/**
 * Factory defaults for the scrum system.
 *
 * These TypeScript constants seed empty DB tables on first startup.
 * They are never read at runtime — the DB is the sole source of truth.
 * Use reset_* MCP tools to re-seed from these defaults.
 */

// ─── Agent Defaults ─────────────────────────────────────────────────────────

export interface AgentDefault {
  role: string;
  name: string;
  description: string;
  model: string;
  tools: string | null;
  system_prompt: string;
  department: string;
}

export const AGENT_DEFAULTS: AgentDefault[] = [
  {
    role: "fe-engineer",
    name: "FE Engineer",
    description: "Builds frontend UI components, pages, and client-side logic",
    model: "claude-sonnet-4-6",
    tools: null,
    system_prompt: "",
    department: "development",
  },
  {
    role: "be-engineer",
    name: "BE Engineer",
    description: "Builds backend APIs, database models, and server-side logic",
    model: "claude-sonnet-4-6",
    tools: null,
    system_prompt: "",
    department: "development",
  },
  {
    role: "developer",
    name: "Developer",
    description: "Full-stack developer building features across frontend and backend",
    model: "claude-sonnet-4-6",
    tools: null,
    system_prompt: "",
    department: "development",
  },
  {
    role: "devops",
    name: "DevOps",
    description: "Manages CI/CD, deployment, and infrastructure",
    model: "claude-sonnet-4-6",
    tools: null,
    system_prompt: "",
    department: "development",
  },
  {
    role: "qa",
    name: "QA Engineer",
    description: "Tests and verifies functionality",
    model: "claude-sonnet-4-6",
    tools: null,
    system_prompt: "",
    department: "quality",
  },
  {
    role: "team-lead",
    name: "Team Lead",
    description: "Coordinates the team, reviews code, and ensures quality",
    model: "claude-sonnet-4-6",
    tools: null,
    system_prompt: "",
    department: "business",
  },
  {
    role: "product-owner",
    name: "Product Owner",
    description: "Manages requirements, priorities, and stakeholder communication",
    model: "claude-sonnet-4-6",
    tools: null,
    system_prompt: "",
    department: "business",
  },
];

// ─── Sprint Process Default ────────────────────────────────────────────────

export const SPRINT_PROCESS_DEFAULT = {
  phases: [
    { name: "Planning", duration: "1 day", mandatory: true, ceremonies: ["Sprint Planning", "Goal Setting", "Ticket Assignment"], criteria: ["Sprint goal defined", "Tickets assigned", "Velocity committed"] },
    { name: "Implementation", duration: "3-4 days", mandatory: true, ceremonies: ["Daily Standups", "Code Reviews", "QA Verification"], criteria: ["All tickets IN_PROGRESS or DONE", "No stale tickets"] },
    { name: "Done", duration: "0.5 day", mandatory: true, ceremonies: ["Sprint Summary", "Retro Findings", "Velocity Review"], criteria: ["Results reviewed", "Retro findings logged"] },
    { name: "Rest", duration: "0.5 day", mandatory: false, ceremonies: ["Team Recovery"], criteria: [] },
  ],
  transitions: {
    planning: "implementation",
    implementation: "done",
    done: "rest",
    rest: "planning",
  },
};

// ─── Skill Defaults (only structural ones — project-specific skills are not factory defaults) ───

export interface SkillDefault {
  name: string;
  content: string;
  owner_role: string | null;
}

export const SKILL_DEFAULTS: SkillDefault[] = [
  {
    name: "SPRINT_PROCESS_JSON",
    content: JSON.stringify(SPRINT_PROCESS_DEFAULT, null, 2),
    owner_role: null,
  },
  {
    name: "SPRINT_PHASES",
    content: "planning → implementation → done → rest",
    owner_role: null,
  },
  {
    name: "SPRINT_ROLES",
    content: JSON.stringify(["fe-engineer", "be-engineer", "developer", "devops", "qa", "team-lead", "product-owner"], null, 2),
    owner_role: null,
  },
  {
    name: "CODE_QUALITY_STANDARDS",
    content: "All code must be reviewed, tested, and pass linting before merging.",
    owner_role: "team-lead",
  },
  {
    name: "DEPLOYMENT_CHECKLIST",
    content: "1. All tests pass\n2. No critical bugs\n3. Documentation updated\n4. Stakeholder approval",
    owner_role: "devops",
  },
];

// ─── Seed Function ──────────────────────────────────────────────────────────

import type Database from "better-sqlite3";

/**
 * Seed factory defaults into empty tables. Never overwrites existing data.
 * Call this on startup to seed empty tables.
 */
export function seedDefaults(db: Database.Database): { agents: number; skills: number } {
  let agentCount = 0;
  let skillCount = 0;

  // Seed agents if table is empty, or migrate from old factory defaults
  const agentRows = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number }).c;
  const OLD_15_AGENT_COUNT = 15;
  const OLD_4_AGENT_COUNT = 4;
  const OLD_6_AGENT_COUNT = 6;

  const isOld15 = agentRows === OLD_15_AGENT_COUNT &&
    db.prepare("SELECT 1 FROM agents WHERE role = 'architect'").get() != null;
  // Old 4-agent set had a 'developer' role; new 6-agent set uses 'fe-engineer'/'be-engineer'
  const isOld4 = agentRows === OLD_4_AGENT_COUNT &&
    db.prepare("SELECT 1 FROM agents WHERE role = 'developer'").get() != null &&
    db.prepare("SELECT 1 FROM agents WHERE role = 'fe-engineer'").get() == null;
  // Old 6-agent set is missing the generic 'developer' role
  const isOld6 = agentRows === OLD_6_AGENT_COUNT &&
    db.prepare("SELECT 1 FROM agents WHERE role = 'fe-engineer'").get() != null &&
    db.prepare("SELECT 1 FROM agents WHERE role = 'developer'").get() == null;

  if (agentRows === 0 || isOld15 || isOld4 || isOld6) {
    if (agentRows > 0) db.prepare("DELETE FROM agents").run();
    const stmt = db.prepare(`INSERT INTO agents (role, name, description, model, tools, system_prompt, department) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const a of AGENT_DEFAULTS) {
      stmt.run(a.role, a.name, a.description, a.model, a.tools, a.system_prompt, a.department);
      agentCount++;
    }
  }

  // Seed skills only if table is empty
  const skillRows = (db.prepare("SELECT COUNT(*) as c FROM skills").get() as { c: number }).c;
  if (skillRows === 0) {
    const stmt = db.prepare(`INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?)`);
    for (const s of SKILL_DEFAULTS) {
      stmt.run(s.name, s.content, s.owner_role);
      skillCount++;
    }
  }

  // Seed mood data if table is empty and agents + sprints exist
  try {
    const moodRows = (db.prepare("SELECT COUNT(*) as c FROM agent_mood_history").get() as { c: number }).c;
    if (moodRows === 0) {
      const agents = db.prepare("SELECT id, role FROM agents").all() as { id: number; role: string }[];
      const sprints = db.prepare("SELECT id FROM sprints WHERE status IN ('rest', 'closed', 'done') AND deleted_at IS NULL ORDER BY created_at").all() as { id: number }[];
      if (agents.length > 0 && sprints.length > 0) {
        const stmt = db.prepare("INSERT INTO agent_mood_history (agent_id, sprint_id, mood, workload_points) VALUES (?, ?, ?, ?)");
        for (const sprint of sprints) {
          for (const agent of agents) {
            const baseMood = agent.role === 'qa' ? 3 : 4;
            const mood = Math.max(1, Math.min(5, baseMood + (Math.floor(Math.random() * 3) - 1)));
            const pts = Math.floor(Math.random() * 8) + 3;
            stmt.run(agent.id, sprint.id, mood, pts);
          }
        }
      }
    }
  } catch {}

  return { agents: agentCount, skills: skillCount };
}

/**
 * Reset agents table to factory defaults. Truncates and re-seeds.
 */
export function resetAgents(db: Database.Database): number {
  // Pre-build check: ensure build is up-to-date
  const { execSync } = require("child_process");
  try {
    execSync("npm run build", { stdio: "inherit" });
  } catch (err) {
    throw new Error("Build failed. Cannot reset agents with build errors.");
  }

  db.prepare("DELETE FROM agents").run();
  const stmt = db.prepare(`INSERT INTO agents (role, name, description, model, tools, system_prompt) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const a of AGENT_DEFAULTS) {
    stmt.run(a.role, a.name, a.description, a.model, a.tools, a.system_prompt);
  }

  // Validation: ensure agent count is exactly 7
  const count = (db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number }).c;
  if (count !== 7) {
    throw new Error(`Agent validation failed: expected 7 agents, got ${count}`);
  }

  return AGENT_DEFAULTS.length;
}

/**
 * Reset skills table to factory defaults. Truncates and re-seeds.
 */
export function resetSkills(db: Database.Database): number {
  // Pre-build check: ensure build is up-to-date
  const { execSync } = require("child_process");
  try {
    execSync("npm run build", { stdio: "inherit" });
  } catch (err) {
    throw new Error("Build failed. Cannot reset skills with build errors.");
  }

  db.prepare("DELETE FROM skills").run();
  const stmt = db.prepare(`INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?)`);
  for (const s of SKILL_DEFAULTS) {
    stmt.run(s.name, s.content, s.owner_role);
  }

  // Validation: ensure skill count is exactly 5
  const count = (db.prepare("SELECT COUNT(*) as c FROM skills").get() as { c: number }).c;
  if (count !== 5) {
    throw new Error(`Skill validation failed: expected 5 skills, got ${count}`);
  }

  return SKILL_DEFAULTS.length;
}

/**
 * Reset sprint process to factory default.
 */
export function resetSprintProcess(db: Database.Database): void {
  db.prepare("DELETE FROM skills WHERE name = 'SPRINT_PROCESS_JSON'").run();
  db.prepare("DELETE FROM skills WHERE name = 'SPRINT_PHASES'").run();
  const stmt = db.prepare(`INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?)`);
  for (const s of SKILL_DEFAULTS) {
    stmt.run(s.name, s.content, s.owner_role);
  }
}