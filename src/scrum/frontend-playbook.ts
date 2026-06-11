import type Database from "better-sqlite3";
import { getEnabledSkillSets, SKILL_SETS, type SkillSetDef } from "./skill-sets.js";

/** Read one skill's full content by name. Returns null if the skill is absent or has no content. */
export function getSkillContent(db: Database.Database, name: string): string | null {
  const row = db.prepare(`SELECT content FROM skills WHERE name = ?`).get(name) as { content: string | null } | undefined;
  return row?.content ?? null;
}

/** Pull the `description:` line out of a SKILL.md YAML frontmatter block. */
export function parseSkillSummary(content: string): string {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return "";
  const m = fm[1].match(/^description:\s*(.+)$/m);
  if (!m) return "";
  const val = m[1].trim().replace(/\r$/, "");
  if (val === "|" || val === ">") return ""; // YAML block-scalar indicator, not a summary
  return val.replace(/^["']|["']$/g, "").slice(0, 120);
}

/**
 * Index lines for one skill set: top-level skills only. Companion docs
 * (`<prefix>:<skill>/<file>`), shared docs (`<prefix>:_shared/...`) and the
 * primer are excluded — they are reachable on demand via get_skill.
 * Returns [] when the set has no skills seeded.
 */
export function buildSkillSetIndex(db: Database.Database, set: SkillSetDef): string[] {
  const rows = db
    .prepare(
      `SELECT name, content FROM skills
       WHERE name LIKE ? AND name NOT LIKE ?
       ORDER BY name`,
    )
    .all(`${set.prefix}:%`, `${set.prefix}:%/%`) as { name: string; content: string }[];
  // `_`-prefixed entries are meta (primer, _shared); LIKE can't exclude them without
  // an ESCAPE clause (`_` is a wildcard), so filter here.
  const skills = rows.filter((r) => !r.name.startsWith(`${set.prefix}:_`));
  return skills.map((r) => {
    const summary = parseSkillSummary(r.content);
    return `- \`${r.name}\`${summary ? ` — ${summary}` : ""}`;
  });
}

/**
 * Build the Frontend Playbook markdown injected into the session: the editable
 * house-style primer plus an index of top-level frontend skills — and, when the
 * landing set is enabled, the landing index (landing work is fe-engineer work).
 * Returns null when the frontend set is disabled or nothing is seeded.
 */
export function buildFrontendPlaybook(db: Database.Database): string | null {
  const enabled = getEnabledSkillSets(db);
  if (!enabled.frontend) return null;

  const primer = db.prepare(`SELECT content FROM skills WHERE name = 'fe:_house-style'`).get() as
    | { content: string }
    | undefined;
  const feSet = SKILL_SETS.find((s) => s.id === "frontend")!;
  const index = buildSkillSetIndex(db, feSet);

  if (!primer?.content && index.length === 0) return null;

  const sections: string[] = ["", "## Frontend Playbook"];
  if (primer?.content) sections.push(primer.content.trim());
  if (index.length) {
    sections.push("", "### Available frontend skills", "Load full guidance with `get_skill({ name })`:", ...index);
  }
  if (enabled.landing) {
    const laSet = SKILL_SETS.find((s) => s.id === "landing")!;
    const laIndex = buildSkillSetIndex(db, laSet);
    if (laIndex.length) {
      sections.push("", "### Available landing-page skills", "Load full guidance with `get_skill({ name })`:", ...laIndex);
    }
  }
  return sections.join("\n");
}

/**
 * Workflow (PRs & commits) index for implementation-phase context. Role-agnostic:
 * applies to every implementer, not just fe tickets. Returns null when the
 * workflow set is disabled or nothing is seeded.
 */
export function buildWorkflowPlaybook(db: Database.Database): string | null {
  const enabled = getEnabledSkillSets(db);
  if (!enabled.workflow) return null;
  const wfSet = SKILL_SETS.find((s) => s.id === "workflow")!;
  const index = buildSkillSetIndex(db, wfSet);
  if (index.length === 0) return null;
  return [
    "",
    "## Workflow Skills",
    "Use these when writing commits and pull requests for this sprint's work — load with `get_skill({ name })`:",
    ...index,
  ].join("\n");
}
