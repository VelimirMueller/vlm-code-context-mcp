import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema, runMigrations } from "../src/scrum/schema.js";
import { seedSkillSets } from "../src/scrum/defaults.js";
import { setEnabledSkillSets } from "../src/scrum/skill-sets.js";
import { registerScrumTools } from "../src/scrum/tools.js";
import {
  buildCommitContract,
  getSkillContent,
  COMMIT_SKILL_NAME,
} from "../src/scrum/frontend-playbook.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  initScrumSchema(db);
  seedSkillSets(db); // content is always seeded; serving is the per-project choice
});

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
class FakeServer {
  tools = new Map<string, Handler>();
  tool(name: string, _d: string, _s: unknown, h: Handler): void {
    this.tools.set(name, h);
  }
}
const text = (r: { content: Array<{ text: string }> }): string => r.content.map((c) => c.text).join("\n");

describe("buildCommitContract — enablement (AC1 + AC3)", () => {
  it("is null when the workflow set is disabled (default)", () => {
    // wf content IS seeded, but the set is not served by default → block absent.
    expect(getSkillContent(db, COMMIT_SKILL_NAME)).not.toBeNull();
    expect(buildCommitContract(db)).toBeNull();
  });

  it("renders the contract when the workflow set is enabled", () => {
    setEnabledSkillSets(db, { workflow: true });
    const block = buildCommitContract(db)!;
    expect(block).toContain("### Commit contract");
    expect(block).toContain(COMMIT_SKILL_NAME); // points back at the source skill
  });
});

describe("buildCommitContract — derived content (AC2: single-sourced from the skill)", () => {
  beforeEach(() => setEnabledSkillSets(db, { workflow: true }));

  it("carries the three labeled body groups verbatim from the skill's step-4 template", () => {
    const block = buildCommitContract(db)!;
    expect(block).toContain("Why:");
    expect(block).toContain("What:");
    expect(block).toContain("How:");
    // The exact template lines come from the fenced ```text block in the skill.
    expect(block).toContain("the problem or motivation");
    expect(block).toContain("the change at a glance");
    expect(block).toContain("the approach taken and its trade-offs");
  });

  it("carries the subject convention (conventional commits, ≤72 chars, imperative)", () => {
    const block = buildCommitContract(db)!;
    expect(block).toContain("≤72 characters");
    expect(block).toMatch(/imperative/);
    expect(block).toMatch(/convention/);
  });

  it("preserves the Co-Authored-By trailer instruction", () => {
    const block = buildCommitContract(db)!;
    expect(block).toContain("Co-Authored-By:");
  });

  it("stays compact (≤15 content lines — it rides in every delegated prompt)", () => {
    // Drop the leading structural separator (matches the sibling builders'
    // join convention); measure the contract payload itself. Two of these lines
    // are the blank separators inside the skill's verbatim Why/What/How template.
    const contentLines = buildCommitContract(db)!.replace(/^\n/, "").split("\n");
    expect(contentLines.length).toBeLessThanOrEqual(15);
  });

  it("is derived, not a hardcoded copy: the body template equals the skill's fenced step-4 block", () => {
    // Parity guard. If the skill's step-4 template is edited (or removed), this
    // assertion fails — proving the injected block tracks the single source and
    // is not a freestanding paraphrase that could silently drift.
    const content = getSkillContent(db, COMMIT_SKILL_NAME)!;
    const skillTemplate = content.split(/^## 4\./m)[1].match(/```text\r?\n([\s\S]*?)\r?\n```/)![1];
    expect(buildCommitContract(db)).toContain(skillTemplate);
  });
});

describe("buildCommitContract — graceful degradation", () => {
  it("returns null when the workflow set is enabled but the skill row is absent", () => {
    const bare = new Database(":memory:");
    initScrumSchema(bare);
    setEnabledSkillSets(bare, { workflow: true }); // enabled, but no skills seeded
    expect(getSkillContent(bare, COMMIT_SKILL_NAME)).toBeNull();
    expect(buildCommitContract(bare)).toBeNull();
  });

  it("returns null when the skill content lost its step-4 template (restructured)", () => {
    // Replace the content with a version missing the fenced body template; the
    // extractor must omit the block rather than emit a half-formed contract.
    db.prepare("UPDATE skills SET content = ? WHERE name = ?").run(
      "---\nname: write-commit-messages\n---\n## 3. Draft the subject\n\nSome subject rule.\n",
      COMMIT_SKILL_NAME,
    );
    expect(buildCommitContract(db)).toBeNull();
  });
});

// AC1 end-to-end: the block must actually ride in the delegated prompt that
// load_phase_context emits for a specific ticket — present when the workflow set
// is served, absent when it is not.
describe("load_phase_context(implementation) wiring (AC1)", () => {
  let handlers: Map<string, Handler>;
  let sprintId: number;
  let ticketId: number;

  beforeEach(() => {
    runMigrations(db); // ticket_assignments etc. for the routing section
    db.prepare(`INSERT OR IGNORE INTO agents (role, name, model) VALUES ('developer','developer','claude-opus-4-8')`).run();
    db.prepare(`INSERT INTO sprints (name, status, velocity_committed) VALUES ('Live','implementation',5)`).run();
    sprintId = (db.prepare(`SELECT id FROM sprints WHERE name = 'Live'`).get() as any).id;
    db.prepare(`INSERT INTO tickets (sprint_id, title, assigned_to, story_points, description) VALUES (?,?,?,?,?)`)
      .run(sprintId, "do the thing", "developer", 5, "implement T-273");
    ticketId = Number((db.prepare(`SELECT last_insert_rowid() as id`).get() as any).id);
    const server = new FakeServer();
    registerScrumTools(server as never, db);
    handlers = server.tools;
  });

  it("injects the Commit contract alongside Model routing when the workflow set is enabled", async () => {
    setEnabledSkillSets(db, { workflow: true });
    const out = text(await handlers.get("load_phase_context")!({ phase: "implementation", sprint_id: sprintId, ticket_id: ticketId }));
    expect(out).toContain("## Model routing");
    expect(out).toContain("### Commit contract");
    expect(out).toContain("Why:");
    expect(out).toContain("What:");
    expect(out).toContain("How:");
  });

  it("omits the Commit contract when the workflow set is disabled (default)", async () => {
    const out = text(await handlers.get("load_phase_context")!({ phase: "implementation", sprint_id: sprintId, ticket_id: ticketId }));
    expect(out).toContain("## Model routing"); // routing still present
    expect(out).not.toContain("### Commit contract");
  });
});
