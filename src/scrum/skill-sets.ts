/**
 * Skill-set registry + per-project enablement.
 *
 * The upstream claude_development_skills repo ships multiple top-level skill
 * categories; each becomes a "skill set" with its own name prefix in the
 * skills table. Set CONTENT is always seeded/synced (cheap, offline-ready);
 * whether a set is SERVED (playbook injection, get_skill) is a per-project
 * choice persisted as a config row — /kickoff asks once, update_skill_sets
 * changes it any time.
 */
import type Database from "better-sqlite3";

export type SkillSetId = "frontend" | "landing" | "workflow";

export interface SkillSetDef {
  id: SkillSetId;
  /** Name prefix in the skills table, e.g. "fe" → fe:set-up-auth */
  prefix: string;
  /** Human label used in kickoff's question and playbook headings */
  label: string;
  /** owner_role written on seeded/synced rows (null = role-agnostic) */
  ownerRole: string | null;
  /** Directory under the upstream repo root, with trailing slash */
  upstreamDir: string;
  /** Served without explicit opt-in (back-compat for pre-existing projects) */
  defaultEnabled: boolean;
}

export const SKILL_SETS: SkillSetDef[] = [
  {
    id: "frontend",
    prefix: "fe",
    label: "Frontend",
    ownerRole: "fe-engineer",
    upstreamDir: "skills/frontend/",
    defaultEnabled: true,
  },
  {
    id: "landing",
    prefix: "la",
    label: "Landing pages",
    ownerRole: "fe-engineer",
    upstreamDir: "skills/landing/",
    defaultEnabled: false,
  },
  {
    id: "workflow",
    prefix: "wf",
    label: "Workflow (PRs & commits)",
    ownerRole: null,
    upstreamDir: "skills/workflow/",
    defaultEnabled: false,
  },
];

/** Config row in the skills table holding the project's enablement choice. */
export const SKILL_SETS_ENABLED_KEY = "SKILL_SETS_ENABLED_JSON";

export type SkillSetEnablement = Record<SkillSetId, boolean>;

export function defaultEnablement(): SkillSetEnablement {
  const map = {} as SkillSetEnablement;
  for (const s of SKILL_SETS) map[s.id] = s.defaultEnabled;
  return map;
}

/**
 * Enabled map for this project. A missing or unparsable row yields the
 * registry defaults (frontend-only), so pre-existing DBs behave unchanged.
 * Unknown keys are dropped; missing keys fall back to their set default.
 */
export function getEnabledSkillSets(db: Database.Database): SkillSetEnablement {
  const row = db.prepare("SELECT content FROM skills WHERE name = ?").get(SKILL_SETS_ENABLED_KEY) as
    | { content: string | null }
    | undefined;
  const map = defaultEnablement();
  if (!row?.content) return map;
  try {
    const parsed = JSON.parse(row.content) as Record<string, unknown>;
    for (const s of SKILL_SETS) {
      if (typeof parsed[s.id] === "boolean") map[s.id] = parsed[s.id] as boolean;
    }
  } catch {
    /* corrupt row → defaults */
  }
  return map;
}

/** True once a project explicitly chose (the config row exists) — kickoff skips its question then. */
export function skillSetsConfigured(db: Database.Database): boolean {
  return db.prepare("SELECT 1 FROM skills WHERE name = ?").get(SKILL_SETS_ENABLED_KEY) != null;
}

/** Merge a partial choice into the current map and persist it. Returns the new map. */
export function setEnabledSkillSets(
  db: Database.Database,
  partial: Partial<SkillSetEnablement>,
): SkillSetEnablement {
  const map = getEnabledSkillSets(db);
  for (const s of SKILL_SETS) {
    const v = partial[s.id];
    if (typeof v === "boolean") map[s.id] = v;
  }
  db.prepare(
    `INSERT INTO skills (name, content, owner_role) VALUES (?, ?, NULL)
     ON CONFLICT(name) DO UPDATE SET content = excluded.content, updated_at = datetime('now')`,
  ).run(SKILL_SETS_ENABLED_KEY, JSON.stringify(map));
  return map;
}

/** The set a skill name belongs to, by its "<prefix>:" — null for structural/config rows. */
export function skillSetForName(name: string): SkillSetDef | null {
  const idx = name.indexOf(":");
  if (idx <= 0) return null;
  const prefix = name.slice(0, idx);
  return SKILL_SETS.find((s) => s.prefix === prefix) ?? null;
}

/** One-line human summary, e.g. "frontend ✓ · landing ✗ · workflow ✗ (defaults — not configured yet)". */
export function formatEnablement(map: SkillSetEnablement, configured: boolean): string {
  const parts = SKILL_SETS.map((s) => `${s.id} ${map[s.id] ? "✓" : "✗"}`);
  return `${parts.join(" · ")}${configured ? "" : " (defaults — not configured yet)"}`;
}
