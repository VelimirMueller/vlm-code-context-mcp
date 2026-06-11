// Runtime sync of vendored skill sets (fe:*, la:*, wf:*) from the latest
// claude_development_skills release. Baked defaults
// (frontend-skill-defaults.generated.ts) remain the offline fallback; this
// module brings an installed user's DB up to the newest upstream release tag
// without requiring a new npm publish. Pure helpers are exported for tests.
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { FE_PRIMER_NAME, type SkillDefault } from "./defaults.js";
import { SKILL_SETS } from "./skill-sets.js";

export const SKILLS_REPO = "VelimirMueller/claude_development_skills";
export const FE_SKILLS_SOURCE_KEY = "FE_SKILLS_SOURCE_JSON";

export interface UpstreamFile {
  /** Path relative to the upstream set directory (e.g. skills/frontend/). */
  path: string;
  content: string;
}

export interface SkillSourceManifest {
  source: string;
  tag: string;
  commit: string;
  syncedAt: string;
  skillCount: number;
  /** name → sha1 of the factory content last written, used to detect user edits. */
  contentHashes: Record<string, string>;
}

export type SyncResult =
  | { ok: true; skipped: true; tag: string }
  | { ok: true; skipped?: false; tag: string; inserted: number; updated: number; preserved: number }
  | { ok: false; reason: string };

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const SEMVER_TAG = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Highest semver tag (numeric compare), keeping the original string. Null if none qualify. */
export function pickLatestTag(tags: string[]): string | null {
  let best: string | null = null;
  let bestKey: [number, number, number] | null = null;
  for (const tag of tags) {
    const m = SEMVER_TAG.exec(tag);
    if (!m) continue;
    const key: [number, number, number] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (
      !bestKey ||
      key[0] > bestKey[0] ||
      (key[0] === bestKey[0] && key[1] > bestKey[1]) ||
      (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] > bestKey[2])
    ) {
      best = tag;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Map upstream files to skill rows using the same naming scheme as
 * scripts/compile-skills.mjs, so synced rows replace their baked counterparts:
 *   <skill>/SKILL.md    -> <prefix>:<skill>
 *   <skill>/<companion> -> <prefix>:<skill>/<companion>
 *   _shared/<relpath>   -> <prefix>:_shared/<relpath>
 */
export function toSkillRows(
  files: UpstreamFile[],
  prefix = "fe",
  ownerRole: string | null = "fe-engineer",
): SkillDefault[] {
  const rows: SkillDefault[] = [];
  for (const f of files) {
    const segments = f.path.split("/");
    if (segments.length < 2) continue; // top-level files have no skill directory
    const dir = segments[0];
    const rel = segments.slice(1).join("/");
    const name =
      dir === "_shared" ? `${prefix}:_shared/${rel}` : rel === "SKILL.md" ? `${prefix}:${dir}` : `${prefix}:${dir}/${rel}`;
    rows.push({ name, content: f.content, owner_role: ownerRole });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function hashContent(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

// ─── DB layer ─────────────────────────────────────────────────────────────────

export function getSkillSource(db: Database.Database): SkillSourceManifest | null {
  const row = db.prepare("SELECT content FROM skills WHERE name = ?").get(FE_SKILLS_SOURCE_KEY) as
    | { content: string | null }
    | undefined;
  if (!row?.content) return null;
  try {
    return JSON.parse(row.content) as SkillSourceManifest;
  } catch {
    return null;
  }
}

/**
 * Upsert synced skill rows inside one transaction and record the source manifest.
 * A row is updated only while its content still matches the last factory sync;
 * user-edited rows are preserved (reset_skills remains the factory-reset path).
 * The fe:_house-style primer is owned by defaults.ts and never written here.
 */
export function applySkillSync(
  db: Database.Database,
  rows: SkillDefault[],
  meta: { source: string; tag: string; commit: string },
): { inserted: number; updated: number; preserved: number } {
  const prevHashes = getSkillSource(db)?.contentHashes ?? {};
  const selectContent = db.prepare("SELECT content FROM skills WHERE name = ?");
  const insert = db.prepare("INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?)");
  const update = db.prepare("UPDATE skills SET content = ?, updated_at = datetime('now') WHERE name = ?");
  const upsertManifest = db.prepare(
    `INSERT INTO skills (name, content, owner_role) VALUES (?, ?, NULL)
     ON CONFLICT(name) DO UPDATE SET content = excluded.content, updated_at = datetime('now')`,
  );

  const result = { inserted: 0, updated: 0, preserved: 0 };
  const contentHashes: Record<string, string> = {};
  db.transaction(() => {
    for (const row of rows) {
      if (row.name === FE_PRIMER_NAME) continue;
      contentHashes[row.name] = hashContent(row.content);
      const existing = selectContent.get(row.name) as { content: string | null } | undefined;
      if (!existing) {
        insert.run(row.name, row.content, row.owner_role);
        result.inserted++;
        continue;
      }
      const current = existing.content ?? "";
      if (current === row.content) continue;
      const lastFactoryHash = prevHashes[row.name];
      if (lastFactoryHash && hashContent(current) !== lastFactoryHash) {
        result.preserved++; // user-edited since the last sync — leave it alone
        continue;
      }
      update.run(row.content, row.name);
      result.updated++;
    }
    const manifest: SkillSourceManifest = {
      source: meta.source,
      tag: meta.tag,
      commit: meta.commit,
      syncedAt: new Date().toISOString(),
      skillCount: Object.keys(contentHashes).length,
      contentHashes,
    };
    upsertManifest.run(FE_SKILLS_SOURCE_KEY, JSON.stringify(manifest));
  })();
  return result;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

const GH_HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "code-context-mcp" };
const RAW_FETCH_CONCURRENCY = 8;

export interface SyncOptions {
  repo?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetch the latest upstream release tag and upsert every vendored skill set
 * (frontend, landing, workflow) into the DB. Sets the upstream has not
 * published are simply absent that release; frontend is required as the
 * sanity anchor. Short-circuits when the DB is already at that tag. Never
 * throws — network or shape failures return { ok: false } so boot can fall
 * back to baked defaults.
 */
export async function syncSkillsFromUpstream(
  db: Database.Database,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  const repo = opts.repo ?? SKILLS_REPO;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const signal = AbortSignal.timeout(opts.timeoutMs ?? 10_000);

    const tagsRes = await fetchImpl(`https://api.github.com/repos/${repo}/tags?per_page=100`, {
      headers: GH_HEADERS,
      signal,
    });
    if (!tagsRes.ok) return { ok: false, reason: `tags request failed (${tagsRes.status})` };
    const tags = (await tagsRes.json()) as { name: string; commit: { sha: string } }[];
    if (!Array.isArray(tags)) return { ok: false, reason: "unexpected tags response shape" };

    const latest = pickLatestTag(tags.map((t) => t.name));
    if (!latest) return { ok: false, reason: "no semver release tags upstream" };
    if (getSkillSource(db)?.tag === latest) return { ok: true, skipped: true, tag: latest };
    const sha = tags.find((t) => t.name === latest)?.commit?.sha;
    if (!sha) return { ok: false, reason: `no commit sha for tag ${latest}` };

    const treeRes = await fetchImpl(`https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`, {
      headers: GH_HEADERS,
      signal,
    });
    if (!treeRes.ok) return { ok: false, reason: `tree request failed (${treeRes.status})` };
    const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[] };
    const allBlobs = (tree.tree ?? []).filter((t) => t.type === "blob");

    const rows: SkillDefault[] = [];
    for (const set of SKILL_SETS) {
      const blobs = allBlobs.filter((t) => t.path.startsWith(set.upstreamDir));
      if (blobs.length === 0) {
        // The anchor set must exist — a release without skills/frontend/ means
        // the repo layout changed; bail before touching anything.
        if (set.id === "frontend") {
          return { ok: false, reason: `no ${set.upstreamDir} files in ${latest} — aborting without changes` };
        }
        continue;
      }
      const files: UpstreamFile[] = [];
      for (let i = 0; i < blobs.length; i += RAW_FETCH_CONCURRENCY) {
        const batch = await Promise.all(
          blobs.slice(i, i + RAW_FETCH_CONCURRENCY).map(async (b) => {
            const res = await fetchImpl(`https://raw.githubusercontent.com/${repo}/${sha}/${b.path}`, { signal });
            if (!res.ok) throw new Error(`raw fetch failed for ${b.path} (${res.status})`);
            return { path: b.path.slice(set.upstreamDir.length), content: await res.text() };
          }),
        );
        files.push(...batch);
      }
      rows.push(...toSkillRows(files, set.prefix, set.ownerRole));
    }
    if (rows.length === 0) return { ok: false, reason: "upstream files produced no skill rows" };

    const counts = applySkillSync(db, rows, {
      source: `https://github.com/${repo}`,
      tag: latest,
      commit: sha,
    });
    return { ok: true, tag: latest, ...counts };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
