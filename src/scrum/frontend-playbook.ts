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

/** The skill row the Commit contract block is distilled from. */
export const COMMIT_SKILL_NAME = "wf:write-commit-messages";

/**
 * Compact "Commit contract" derived live from the `wf:write-commit-messages`
 * skill so a delegated subagent prompt carries the contract verbatim instead of
 * relying on the agent pulling the skill. Single-sourced: every line below is
 * extracted from the stored SKILL.md, so editing the skill (→ regenerate
 * defaults → reseed) updates the injected block — there is no second copy.
 *
 * Extraction targets, all stable structural anchors in the skill:
 *  - subject rule: the first prose line under `## 3. Draft the subject`
 *  - body template: the fenced ```text Why/What/How block under `## 4.`
 *  - trailer note: emitted when the skill still names a `Co-Authored-By:` trailer
 *
 * Returns null if the skill row is absent or either anchor is missing (workflow
 * set enabled but content not seeded / restructured) — caller omits the block
 * rather than ship a stale paraphrase. The block is intentionally ≤ ~15 lines:
 * it rides in every delegated prompt, so token diet matters (see C1 comments).
 */
export function buildCommitContract(db: Database.Database): string | null {
  // Skill CONTENT is always seeded; only SERVE it when the project opted into
  // the workflow set — mirrors buildWorkflowPlaybook's enablement gate (AC1).
  if (!getEnabledSkillSets(db).workflow) return null;
  const content = getSkillContent(db, COMMIT_SKILL_NAME);
  if (!content) return null;

  // Step 3 → the subject rule. Grab the first non-empty line after the heading.
  const subjectSection = content.split(/^## 3\. Draft the subject\s*$/m)[1];
  const subjectRule = subjectSection
    ?.split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);

  // Step 4 → the fenced ```text Why/What/How template (the canonical body shape).
  const bodySection = content.split(/^## 4\./m)[1];
  const bodyTemplate = bodySection?.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1];

  if (!subjectRule || !bodyTemplate) return null; // skill restructured → omit, don't fabricate

  const trailerNote = /Co-Authored-By:/.test(content)
    ? "Preserve the house trailer(s) the audit detects (e.g. `Co-Authored-By:`) after the three groups."
    : null;

  const lines = [
    "",
    "### Commit contract",
    `Apply this when committing — distilled from \`${COMMIT_SKILL_NAME}\`; load it with \`get_skill\` for the full discipline.`,
    `- **Subject:** ${subjectRule}`,
    "- **Body:** exactly three labeled bullet groups, every bullet derived from the diff:",
    "```text",
    bodyTemplate,
    "```",
  ];
  if (trailerNote) lines.push(`- ${trailerNote}`);
  return lines.join("\n");
}
