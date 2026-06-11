import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedFrontendSkills, FE_PRIMER_NAME, FRONTEND_HOUSE_STYLE_PRIMER } from "../src/scrum/defaults.js";
import {
  pickLatestTag,
  toSkillRows,
  hashContent,
  getSkillSource,
  applySkillSync,
  syncSkillsFromUpstream,
  FE_SKILLS_SOURCE_KEY,
} from "../src/scrum/skill-sync.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
});

const getContent = (name: string) =>
  (db.prepare("SELECT content FROM skills WHERE name = ?").get(name) as { content: string } | undefined)?.content;

describe("pickLatestTag", () => {
  it("returns the highest semver tag, keeping the original tag string", () => {
    expect(pickLatestTag(["v0.4.0", "v0.5.1", "v0.5.0", "v0.2.2"])).toBe("v0.5.1");
  });

  it("compares numerically, not lexically", () => {
    expect(pickLatestTag(["v0.9.0", "v0.10.0"])).toBe("v0.10.0");
  });

  it("ignores non-semver tags and returns null when none qualify", () => {
    expect(pickLatestTag(["v0.5.1", "nightly", "v1.2"])).toBe("v0.5.1");
    expect(pickLatestTag(["nightly", "rc-1"])).toBeNull();
    expect(pickLatestTag([])).toBeNull();
  });
});

describe("toSkillRows", () => {
  it("maps files using the compile-skills naming scheme", () => {
    const rows = toSkillRows([
      { path: "set-up-auth/SKILL.md", content: "auth skill" },
      { path: "set-up-auth/auth-patterns.md", content: "companion" },
      { path: "_shared/tokens.md", content: "shared doc" },
    ]);
    expect(rows.map((r) => r.name)).toEqual([
      "fe:_shared/tokens.md",
      "fe:set-up-auth",
      "fe:set-up-auth/auth-patterns.md",
    ]);
    expect(rows.every((r) => r.owner_role === "fe-engineer")).toBe(true);
  });

  it("skips files at the top level (no skill directory)", () => {
    expect(toSkillRows([{ path: "README.md", content: "stray" }])).toEqual([]);
  });
});

describe("applySkillSync", () => {
  const meta = { source: "repo", tag: "v0.5.0", commit: "aaa" };

  it("inserts new rows and records a source manifest with content hashes", () => {
    const result = applySkillSync(db, [{ name: "fe:demo", content: "v1", owner_role: "fe-engineer" }], meta);
    expect(result).toMatchObject({ inserted: 1, updated: 0, preserved: 0 });
    expect(getContent("fe:demo")).toBe("v1");
    const manifest = getSkillSource(db);
    expect(manifest?.tag).toBe("v0.5.0");
    expect(manifest?.contentHashes["fe:demo"]).toBe(hashContent("v1"));
  });

  it("updates rows whose content still matches the last factory sync", () => {
    applySkillSync(db, [{ name: "fe:demo", content: "v1", owner_role: "fe-engineer" }], meta);
    const result = applySkillSync(
      db,
      [{ name: "fe:demo", content: "v2", owner_role: "fe-engineer" }],
      { ...meta, tag: "v0.5.1" },
    );
    expect(result).toMatchObject({ inserted: 0, updated: 1, preserved: 0 });
    expect(getContent("fe:demo")).toBe("v2");
  });

  it("preserves user-edited rows instead of overwriting them", () => {
    applySkillSync(db, [{ name: "fe:demo", content: "v1", owner_role: "fe-engineer" }], meta);
    db.prepare("UPDATE skills SET content = 'MY EDIT' WHERE name = 'fe:demo'").run();
    const result = applySkillSync(
      db,
      [{ name: "fe:demo", content: "v2", owner_role: "fe-engineer" }],
      { ...meta, tag: "v0.5.1" },
    );
    expect(result).toMatchObject({ inserted: 0, updated: 0, preserved: 1 });
    expect(getContent("fe:demo")).toBe("MY EDIT");
  });

  it("never touches the fe:_house-style primer", () => {
    seedFrontendSkills(db);
    const result = applySkillSync(
      db,
      [{ name: FE_PRIMER_NAME, content: "hijacked", owner_role: "fe-engineer" }],
      meta,
    );
    expect(result).toMatchObject({ inserted: 0, updated: 0 });
    expect(getContent(FE_PRIMER_NAME)).toBe(FRONTEND_HOUSE_STYLE_PRIMER);
  });

  it("skips identical content without counting it as an update", () => {
    applySkillSync(db, [{ name: "fe:demo", content: "v1", owner_role: "fe-engineer" }], meta);
    const result = applySkillSync(db, [{ name: "fe:demo", content: "v1", owner_role: "fe-engineer" }], meta);
    expect(result).toMatchObject({ inserted: 0, updated: 0, preserved: 0 });
  });
});

describe("syncSkillsFromUpstream", () => {
  const REPO = "owner/skills-repo";
  const TAGS = [
    { name: "v0.4.0", commit: { sha: "aaa" } },
    { name: "v0.5.1", commit: { sha: "bbb" } },
    { name: "v0.5.0", commit: { sha: "ccc" } },
  ];
  const TREE = {
    tree: [
      { path: "skills/frontend/demo/SKILL.md", type: "blob" },
      { path: "skills/frontend/_shared/tokens.md", type: "blob" },
      { path: "skills/frontend/demo", type: "tree" },
      { path: "skills/README.md", type: "blob" },
      { path: "README.md", type: "blob" },
    ],
  };
  const RAW: Record<string, string> = {
    "skills/frontend/demo/SKILL.md": "# Demo v0.5.1",
    "skills/frontend/_shared/tokens.md": "tokens doc",
  };

  function stubFetch(calls: string[] = []): typeof fetch {
    return (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/tags")) return new Response(JSON.stringify(TAGS), { status: 200 });
      if (url.includes("/git/trees/bbb")) return new Response(JSON.stringify(TREE), { status: 200 });
      const raw = Object.keys(RAW).find((p) => url.endsWith(`/bbb/${p}`));
      if (raw) return new Response(RAW[raw], { status: 200 });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  }

  it("fetches the latest release and upserts its frontend skills", async () => {
    const result = await syncSkillsFromUpstream(db, { repo: REPO, fetchImpl: stubFetch() });
    expect(result).toMatchObject({ ok: true, tag: "v0.5.1", inserted: 2, updated: 0 });
    expect(getContent("fe:demo")).toBe("# Demo v0.5.1");
    expect(getContent("fe:_shared/tokens.md")).toBe("tokens doc");
    expect(getSkillSource(db)?.commit).toBe("bbb");
  });

  it("short-circuits when the DB is already at the latest tag", async () => {
    await syncSkillsFromUpstream(db, { repo: REPO, fetchImpl: stubFetch() });
    const calls: string[] = [];
    const result = await syncSkillsFromUpstream(db, { repo: REPO, fetchImpl: stubFetch(calls) });
    expect(result).toMatchObject({ ok: true, skipped: true, tag: "v0.5.1" });
    expect(calls).toHaveLength(1); // tags endpoint only — no tree or raw fetches
  });

  it("returns ok:false and leaves the DB untouched when the network fails", async () => {
    seedFrontendSkills(db);
    const before = db.prepare("SELECT COUNT(*) as c FROM skills").get() as { c: number };
    const failingFetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const result = await syncSkillsFromUpstream(db, { repo: REPO, fetchImpl: failingFetch });
    expect(result).toMatchObject({ ok: false });
    const after = db.prepare("SELECT COUNT(*) as c FROM skills").get() as { c: number };
    expect(after.c).toBe(before.c);
    expect(getSkillSource(db)).toBeNull();
  });

  it("aborts without writing when the upstream tree has no frontend skills", async () => {
    const emptyTreeFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/tags")) return new Response(JSON.stringify(TAGS), { status: 200 });
      if (url.includes("/git/trees/")) return new Response(JSON.stringify({ tree: [] }), { status: 200 });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    const result = await syncSkillsFromUpstream(db, { repo: REPO, fetchImpl: emptyTreeFetch });
    expect(result).toMatchObject({ ok: false });
    expect(getSkillSource(db)).toBeNull();
  });

  it("treats a repo with no semver tags as a failure, not a crash", async () => {
    const noTagsFetch = (async () =>
      new Response(JSON.stringify([{ name: "nightly", commit: { sha: "zzz" } }]), { status: 200 })) as unknown as typeof fetch;
    const result = await syncSkillsFromUpstream(db, { repo: REPO, fetchImpl: noTagsFetch });
    expect(result).toMatchObject({ ok: false });
  });

  it("uses the manifest key reserved for the skills source", () => {
    expect(FE_SKILLS_SOURCE_KEY).toBe("FE_SKILLS_SOURCE_JSON");
  });
});
