import type Database from "better-sqlite3";

/** Read one skill's full content by name. Returns null if absent. */
export function getSkillContent(db: Database.Database, name: string): string | null {
  const row = db.prepare(`SELECT content FROM skills WHERE name = ?`).get(name) as { content: string } | undefined;
  return row ? (row.content ?? "") : null;
}

/** Pull the `description:` line out of a SKILL.md YAML frontmatter block. */
export function parseSkillSummary(content: string): string {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return "";
  const m = fm[1].match(/^description:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, "").slice(0, 120) : "";
}

/**
 * Build the Frontend Playbook markdown injected into the session: the editable
 * house-style primer plus an index of top-level frontend skills. Companion docs
 * (`fe:<skill>/<file>`) and shared docs (`fe:_shared/...`) are excluded from the
 * index — they are reachable on demand via get_skill. Returns null when the
 * project has no frontend skills seeded.
 */
export function buildFrontendPlaybook(db: Database.Database): string | null {
  const primer = db.prepare(`SELECT content FROM skills WHERE name = 'fe:_house-style'`).get() as
    | { content: string }
    | undefined;
  const indexRows = db
    .prepare(
      `SELECT name, content FROM skills
       WHERE owner_role = 'fe-engineer' AND name LIKE 'fe:%'
         AND name NOT LIKE 'fe:%/%' AND name != 'fe:_house-style'
       ORDER BY name`,
    )
    .all() as { name: string; content: string }[];

  if (!primer && indexRows.length === 0) return null;

  const sections: string[] = ["", "## Frontend Playbook"];
  if (primer?.content) sections.push(primer.content.trim());
  if (indexRows.length) {
    sections.push("", "### Available frontend skills", "Load full guidance with `get_skill({ name })`:");
    for (const r of indexRows) {
      const summary = parseSkillSummary(r.content);
      sections.push(`- \`${r.name}\`${summary ? ` — ${summary}` : ""}`);
    }
  }
  return sections.join("\n");
}
