# Server-Provided Frontend Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MCP server the single source of truth for frontend skills and auto-inject them into a live `/kickoff` session (index + primer up front, full skill on demand) when `fe-engineer` work is present — no file copy into repos, no restart.

**Architecture:** Vendored `.md` (build input under `vendor/skills/`) is compiled to a generated TS defaults module shipped in the package; `seedDefaults` idempotently seeds those into the project DB `skills` table (`owner_role='fe-engineer'`); `load_phase_context` detects `fe-engineer` tickets and appends a Frontend Playbook (editable house-style primer + skill index); a new read-only `get_skill` tool returns any skill's full body on demand.

**Tech Stack:** TypeScript (NodeNext), better-sqlite3, `@modelcontextprotocol/sdk`, zod, Vitest. Spec: `docs/superpowers/specs/2026-06-09-server-provided-frontend-skills-design.md`.

**Conventions:** Every commit ends with the repo's trailer — append `-m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"` to each `git commit`. Run from repo root `/home/velimir/WebstormProjects/mcp-server`.

**Branch first (one-time, before Task 1):**
```bash
git checkout -b feat/server-provided-frontend-skills
```

---

### Task 1: Relocate vendored source + compile skills → generated defaults module

**Files:**
- Move: `skills/` → `vendor/skills/` (contains `frontend/<skill>/SKILL.md` + `frontend/_shared/…`)
- Create: `scripts/compile-skills.mjs`
- Create (generated, committed): `src/scrum/frontend-skill-defaults.generated.ts`
- Modify: `scripts/sync-skills.mjs:18` (`VENDOR_DIR`)
- Modify: `package.json` (`scripts`, `files`)
- Test: `test/compile-skills.test.ts`

- [ ] **Step 1: Move the vendored tree out of repo root**

```bash
mkdir -p vendor
git mv skills vendor/skills
ls vendor/skills/frontend/set-up-auth/SKILL.md   # sanity: should exist
```

- [ ] **Step 2: Point the sync script at the new location**

In `scripts/sync-skills.mjs`, change line 18:

```js
const VENDOR_DIR = path.join(REPO_ROOT, "vendor", "skills");
```

- [ ] **Step 3: Write the failing test for the compiler helper**

Create `test/compile-skills.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileSkills, renderModule } from "../scripts/compile-skills.mjs";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "compile-skills-"));
  // a real skill
  fs.mkdirSync(path.join(tmp, "set-up-auth"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "set-up-auth", "SKILL.md"),
    "---\nname: set-up-auth\ndescription: Use when adding authentication.\n---\nBody.",
  );
  // a shared helper
  fs.mkdirSync(path.join(tmp, "_shared"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "_shared", "react.md"), "shared conventions");
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("compileSkills", () => {
  it("emits one fe:<slug> row per SKILL.md with owner_role fe-engineer", () => {
    const rows = compileSkills(tmp);
    const auth = rows.find((r) => r.name === "fe:set-up-auth");
    expect(auth).toBeDefined();
    expect(auth!.owner_role).toBe("fe-engineer");
    expect(auth!.content).toContain("description: Use when adding authentication.");
  });

  it("emits shared files as fe:_shared/<relpath>", () => {
    const rows = compileSkills(tmp);
    expect(rows.find((r) => r.name === "fe:_shared/react.md")).toBeDefined();
  });

  it("renderModule produces a valid TS export", () => {
    const mod = renderModule(compileSkills(tmp));
    expect(mod).toContain("export const FRONTEND_SKILL_DEFAULTS");
    expect(mod).toContain('"fe:set-up-auth"');
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run test/compile-skills.test.ts`
Expected: FAIL — `Cannot find module '../scripts/compile-skills.mjs'`.

- [ ] **Step 5: Write the compiler**

Create `scripts/compile-skills.mjs`:

```js
#!/usr/bin/env node
// Compile vendored frontend skill .md files into a generated TS defaults module.
// Pure helpers are exported for tests; main() runs only on direct invocation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const FRONTEND_SRC = path.join(REPO_ROOT, "vendor", "skills", "frontend");
const OUT_FILE = path.join(REPO_ROOT, "src", "scrum", "frontend-skill-defaults.generated.ts");

function walkFiles(dir) {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walkFiles(p));
    else if (e.isFile()) files.push(p);
  }
  return files;
}

/** Walk srcDir; return [{ name, content, owner_role }] for every skill + shared file. */
export function compileSkills(srcDir) {
  const out = [];
  if (!fs.existsSync(srcDir)) return out;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(srcDir, entry.name);
    if (entry.name === "_shared") {
      for (const f of walkFiles(dirPath)) {
        const rel = path.relative(dirPath, f).split(path.sep).join("/");
        out.push({ name: `fe:_shared/${rel}`, content: fs.readFileSync(f, "utf-8"), owner_role: "fe-engineer" });
      }
      continue;
    }
    const skillFile = path.join(dirPath, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      out.push({ name: `fe:${entry.name}`, content: fs.readFileSync(skillFile, "utf-8"), owner_role: "fe-engineer" });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Render the generated TS module. JSON.stringify yields valid TS for the array literal. */
export function renderModule(skills) {
  return (
    `// AUTO-GENERATED by scripts/compile-skills.mjs — do not edit by hand.\n` +
    `import type { SkillDefault } from "./defaults.js";\n\n` +
    `export const FRONTEND_SKILL_DEFAULTS: SkillDefault[] = ${JSON.stringify(skills, null, 2)};\n`
  );
}

function main() {
  const skills = compileSkills(FRONTEND_SRC);
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, renderModule(skills));
  console.log(`Compiled ${skills.length} frontend skill entries → ${path.relative(REPO_ROOT, OUT_FILE)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/compile-skills.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Generate the real module + wire npm scripts**

Run: `node scripts/compile-skills.mjs`
Expected: `Compiled NN frontend skill entries → src/scrum/frontend-skill-defaults.generated.ts` (NN ≈ 22 skills + shared files).

In `package.json` `scripts`, add `compile:skills` and chain it into `build` and `sync:skills`:

```json
"build": "node scripts/compile-skills.mjs && tsc && cp src/dashboard/dashboard.html dist/dashboard/ && cd src/dashboard/app && npx vite build",
"compile:skills": "node scripts/compile-skills.mjs",
"sync:skills": "node scripts/sync-skills.mjs && node scripts/compile-skills.mjs",
```

In `package.json` `files`, remove the `"skills"` entry (vendored source is build input, no longer shipped) and confirm `"dist"` is present. The generated module ships compiled inside `dist/`.

- [ ] **Step 8: Commit**

```bash
git add vendor/skills scripts/compile-skills.mjs scripts/sync-skills.mjs src/scrum/frontend-skill-defaults.generated.ts test/compile-skills.test.ts package.json
git commit -m "feat(skills): compile vendored frontend skills to a generated defaults module" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Seed frontend skills into the DB + house-style primer

**Files:**
- Modify: `src/scrum/defaults.ts` (add import, primer, `seedFrontendSkills`, call in `seedDefaults`, fix `resetSkills`)
- Test: `test/seed-frontend-skills.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/seed-frontend-skills.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedDefaults, seedFrontendSkills, FE_PRIMER_NAME } from "../src/scrum/defaults.js";
import { FRONTEND_SKILL_DEFAULTS } from "../src/scrum/frontend-skill-defaults.generated.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
});

const feCount = () =>
  (db.prepare("SELECT COUNT(*) as c FROM skills WHERE name LIKE 'fe:%'").get() as { c: number }).c;

describe("seedFrontendSkills", () => {
  it("inserts the primer plus every compiled frontend skill", () => {
    const inserted = seedFrontendSkills(db);
    expect(inserted).toBe(FRONTEND_SKILL_DEFAULTS.length + 1); // +1 primer
    expect(feCount()).toBe(FRONTEND_SKILL_DEFAULTS.length + 1);
    const primer = db.prepare("SELECT content FROM skills WHERE name = ?").get(FE_PRIMER_NAME) as { content: string };
    expect(primer.content).toContain("Frontend House Style");
  });

  it("is idempotent — a second run inserts nothing", () => {
    seedFrontendSkills(db);
    expect(seedFrontendSkills(db)).toBe(0);
  });

  it("preserves user edits across re-seeds", () => {
    seedFrontendSkills(db);
    db.prepare("UPDATE skills SET content = 'MY EDIT' WHERE name = ?").run(FE_PRIMER_NAME);
    seedFrontendSkills(db);
    const row = db.prepare("SELECT content FROM skills WHERE name = ?").get(FE_PRIMER_NAME) as { content: string };
    expect(row.content).toBe("MY EDIT");
  });

  it("coexists with the 5 structural skills via seedDefaults", () => {
    seedDefaults(db);
    const structural = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name NOT LIKE 'fe:%'").get() as { c: number };
    expect(structural.c).toBe(5);
    expect(feCount()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/seed-frontend-skills.test.ts`
Expected: FAIL — `seedFrontendSkills` / `FE_PRIMER_NAME` not exported.

- [ ] **Step 3: Add the import, primer, and seeder to `defaults.ts`**

At the top of `src/scrum/defaults.ts` (with the other top-of-file declarations, above `SKILL_DEFAULTS`):

```ts
import { FRONTEND_SKILL_DEFAULTS } from "./frontend-skill-defaults.generated.js";

export const FE_PRIMER_NAME = "fe:_house-style";

export const FRONTEND_HOUSE_STYLE_PRIMER = `# Frontend House Style — Preferred Ways of Working

Applies to all \`fe-engineer\` work. Load any referenced skill with \`get_skill({ name })\`.

## Stack
- Build: Vite. Framework: React 19 (function components + hooks only).
- Routing: TanStack Router (typed, file-based). Server state: TanStack Query.
- Client state: minimal — prefer URL + Query cache over global stores.
- Styling: Tailwind v4 with \`@theme\` tokens. No inline hex; use tokens.
- Forms: React Hook Form + Zod resolver. Validate at the edge.
- Lint/format: Biome. TypeScript strict.
- Tests: Vitest + Testing Library. Test behavior, not implementation.

## Conventions
- Atomic-design folders: atoms → molecules → organisms → templates → pages.
- Treat the current user as server state (fetched), never duplicated into client state.
- Accessibility is non-negotiable: semantic HTML, labelled controls, Biome a11y rules on.
- Env vars validated via a typed schema (\`import.meta.env\`) — fail fast on missing.
- Error boundaries at the app shell + per route; report via the \`captureError\` seam.

## How to use these skills
When you start a task, pull the matching skill's full guidance with
\`get_skill({ name: "fe:<slug>" })\`. Shared references (\`../_shared/...\`) load via
\`get_skill({ name: "fe:_shared/<file>" })\`.`;

/** Idempotently insert any missing frontend skills + primer. Returns count inserted. */
export function seedFrontendSkills(db: Database.Database): number {
  const insert = db.prepare(
    `INSERT INTO skills (name, content, owner_role) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING`,
  );
  const rows: SkillDefault[] = [
    { name: FE_PRIMER_NAME, content: FRONTEND_HOUSE_STYLE_PRIMER, owner_role: "fe-engineer" },
    ...FRONTEND_SKILL_DEFAULTS,
  ];
  let inserted = 0;
  for (const s of rows) {
    if (insert.run(s.name, s.content, s.owner_role).changes > 0) inserted++;
  }
  return inserted;
}
```

> Note: `seedFrontendSkills` references the `Database` type. `defaults.ts` already imports it (`import type Database from "better-sqlite3";`) further down; move that import to the top of the file if the seeder is placed above it.

- [ ] **Step 4: Call the seeder from `seedDefaults`**

In `src/scrum/defaults.ts`, immediately after the structural-skills block that ends at line 209 (the `if (skillRows === 0) { … }`), add — unconditionally so existing projects also get frontend skills:

```ts
  // Frontend skills: additive, idempotent (independent of the structural-skills guard)
  skillCount += seedFrontendSkills(db);
```

- [ ] **Step 5: Fix `resetSkills` so it validates only structural skills and restores frontend ones**

In `src/scrum/defaults.ts`, replace the validation + return in `resetSkills` (lines 279-285):

```ts
  // Validation: exactly 5 structural skills (frontend skills are seeded separately)
  const structural = (db.prepare("SELECT COUNT(*) as c FROM skills WHERE name NOT LIKE 'fe:%'").get() as { c: number }).c;
  if (structural !== 5) {
    throw new Error(`Skill validation failed: expected 5 structural skills, got ${structural}`);
  }

  // Factory reset restores frontend skills too (DELETE above cleared them).
  seedFrontendSkills(db);

  return SKILL_DEFAULTS.length;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/seed-frontend-skills.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/scrum/defaults.ts test/seed-frontend-skills.test.ts
git commit -m "feat(skills): seed frontend skills + editable house-style primer into the DB" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Frontend playbook + skill-read helpers

**Files:**
- Create: `src/scrum/frontend-playbook.ts`
- Test: `test/frontend-playbook.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/frontend-playbook.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedFrontendSkills } from "../src/scrum/defaults.js";
import { getSkillContent, parseSkillSummary, buildFrontendPlaybook } from "../src/scrum/frontend-playbook.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  initScrumSchema(db);
  seedFrontendSkills(db);
});

describe("parseSkillSummary", () => {
  it("extracts the frontmatter description", () => {
    expect(parseSkillSummary("---\nname: x\ndescription: Hello there.\n---\nBody")).toBe("Hello there.");
  });
  it("returns empty string when no frontmatter", () => {
    expect(parseSkillSummary("no frontmatter")).toBe("");
  });
});

describe("getSkillContent", () => {
  it("returns content for a real skill", () => {
    expect(getSkillContent(db, "fe:_house-style")).toContain("Frontend House Style");
  });
  it("returns null for a missing skill", () => {
    expect(getSkillContent(db, "fe:does-not-exist")).toBeNull();
  });
});

describe("buildFrontendPlaybook", () => {
  it("includes the primer, the index, and the get_skill instruction", () => {
    const md = buildFrontendPlaybook(db)!;
    expect(md).toContain("## Frontend Playbook");
    expect(md).toContain("Frontend House Style");
    expect(md).toContain("get_skill({ name })");
    expect(md).toMatch(/- `fe:[a-z-]+`/); // at least one indexed skill
  });
  it("excludes the primer and _shared rows from the index list", () => {
    const md = buildFrontendPlaybook(db)!;
    expect(md).not.toMatch(/- `fe:_house-style`/);
    expect(md).not.toMatch(/- `fe:_shared\//);
  });
  it("returns null when no frontend skills are present", () => {
    const empty = new Database(":memory:");
    initScrumSchema(empty);
    expect(buildFrontendPlaybook(empty)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/frontend-playbook.test.ts`
Expected: FAIL — `Cannot find module '../src/scrum/frontend-playbook.js'`.

- [ ] **Step 3: Write the helpers**

Create `src/scrum/frontend-playbook.ts`:

```ts
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
 * house-style primer plus an index of available frontend skills. Returns null
 * when the project has no frontend skills seeded.
 */
export function buildFrontendPlaybook(db: Database.Database): string | null {
  const primer = db.prepare(`SELECT content FROM skills WHERE name = 'fe:_house-style'`).get() as
    | { content: string }
    | undefined;
  const indexRows = db
    .prepare(
      `SELECT name, content FROM skills
       WHERE owner_role = 'fe-engineer' AND name LIKE 'fe:%'
         AND name != 'fe:_house-style' AND name NOT LIKE 'fe:\\_shared/%' ESCAPE '\\'
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/frontend-playbook.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scrum/frontend-playbook.ts test/frontend-playbook.test.ts
git commit -m "feat(skills): add frontend playbook + skill-read helpers" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `get_skill` tool + `load_phase_context` frontend branch

**Files:**
- Modify: `src/scrum/tools.ts` (import helpers; add `get_skill` after the `get_ticket` block ~line 288; add frontend branch in the `implementation` phase ~line 1556)
- Test: `test/get-skill-tool.test.ts`

- [ ] **Step 1: Write the failing test (drives the wiring via the helpers the tool/branch use)**

Create `test/get-skill-tool.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedDefaults } from "../src/scrum/defaults.js";
import { buildFrontendPlaybook, getSkillContent } from "../src/scrum/frontend-playbook.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initScrumSchema(db);
  seedDefaults(db);
});

/** Mirrors the load_phase_context implementation-phase guard. */
function playbookForSprintTickets(tickets: { assigned_to: string | null }[]): string | null {
  return tickets.some((t) => t.assigned_to === "fe-engineer") ? buildFrontendPlaybook(db) : null;
}

describe("frontend skill serving", () => {
  it("get_skill logic returns a seeded frontend skill body", () => {
    const body = getSkillContent(db, "fe:_house-style");
    expect(body).toContain("Frontend House Style");
  });

  it("playbook is injected only when a sprint has fe-engineer work", () => {
    expect(playbookForSprintTickets([{ assigned_to: "be-engineer" }])).toBeNull();
    expect(playbookForSprintTickets([{ assigned_to: "fe-engineer" }])).toContain("## Frontend Playbook");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/get-skill-tool.test.ts`
Expected: FAIL — import of `buildFrontendPlaybook`/`getSkillContent` resolves, but assertion fails only if helpers are missing; if Task 3 is done this passes at the logic level. If it passes here, still complete Steps 3-4 to wire the actual tool + branch (verified by the build in Task 8).

- [ ] **Step 3: Import the helpers and register `get_skill`**

In `src/scrum/tools.ts`, add after the existing imports (after line 4):

```ts
import { buildFrontendPlaybook, getSkillContent } from "./frontend-playbook.js";
```

Add a new tool immediately after the `get_ticket` registration block (which closes at line 288, before the `list_retro_findings` tool at line 290):

```ts
  server.tool(
    "get_skill",
    "Fetch the full content of a single skill by name (e.g. 'fe:set-up-auth', the primer 'fe:_house-style', or a shared ref 'fe:_shared/<file>'). Use after load_phase_context surfaces the frontend index.",
    { name: z.string().describe("Skill name, e.g. 'fe:set-up-auth'") },
    async ({ name }) => {
      const content = getSkillContent(db, name);
      if (content === null) return { content: [{ type: "text" as const, text: `Skill '${name}' not found.` }] };
      return { content: [{ type: "text" as const, text: content }] };
    },
  );
```

- [ ] **Step 4: Add the frontend branch to `load_phase_context`**

In `src/scrum/tools.ts`, inside `else if (phase === "implementation") {`, immediately after the Open Blockers block (lines 1552-1556) and before the branch's closing `}` (line 1557), add:

```ts
          if (tickets.some((t: any) => t.assigned_to === "fe-engineer")) {
            const playbook = buildFrontendPlaybook(db);
            if (playbook) sections.push(playbook);
          }
```

- [ ] **Step 5: Run the test + typecheck**

Run: `npx vitest run test/get-skill-tool.test.ts`
Expected: PASS (2 tests).
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/scrum/tools.ts test/get-skill-tool.test.ts
git commit -m "feat(skills): serve frontend skills via get_skill + load_phase_context playbook" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Remove the `.claude/skills` file-copy install

**Files:**
- Modify: `src/server/setup.ts` (delete step 7 block, lines 214-237)
- Delete: `src/server/skills-install.ts` (its only caller was step 7)

- [ ] **Step 1: Confirm the installer has no other callers**

Run: `grep -rn "skills-install\|copyDirNonDestructive" src/ --include='*.ts' | grep -v '\.test\.'`
Expected: only `src/server/setup.ts` and `src/server/skills-install.ts` itself.

- [ ] **Step 2: Remove step 7 from `setup.ts`**

In `src/server/setup.ts`, delete the entire block from line 214 (`// 7. Copy bundled skills into the project's .claude/skills`) through line 237 (the trailing `console.log("");` of that step), and remove the now-unused import on line 10 (`import { copyDirNonDestructive } from "./skills-install.js";`). Skills are seeded into the DB by `seedDefaults(db)` already called at line 88.

- [ ] **Step 3: Delete the dead installer + its test**

```bash
git rm src/server/skills-install.ts
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (no dangling references to `copyDirNonDestructive`).

- [ ] **Step 5: Commit**

```bash
git add src/server/setup.ts
git commit -m "refactor(setup): stop copying skills into .claude/skills (now DB-seeded)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Update existing tests + CI for the new layout

**Files:**
- Modify: `test/agent-skill-seeding.test.ts`
- Delete: `test/skills-install.test.ts`, `test/skills-package-install.test.ts`
- Modify: `test/sync-skills.test.ts`
- Modify: `.github/workflows/sync-skills.yml`

- [ ] **Step 1: Fix the structural-skill count assertion**

In `test/agent-skill-seeding.test.ts`, the test "creates exactly 5 skills from defaults" (line 129) now counts structural skills only. Replace its body with:

```ts
  it("creates exactly 5 structural skills from defaults", () => {
    seedDefaults(db);
    const result = db
      .prepare("SELECT COUNT(*) as c FROM skills WHERE name NOT LIKE 'fe:%'")
      .get() as { c: number };
    expect(result.c).toBe(5);
  });

  it("also seeds frontend skills", () => {
    seedDefaults(db);
    const fe = db.prepare("SELECT COUNT(*) as c FROM skills WHERE name LIKE 'fe:%'").get() as { c: number };
    expect(fe.c).toBeGreaterThan(0);
  });
```

(The `SKILL_DEFAULTS has 5 entries` test at line 161 stays — `SKILL_DEFAULTS` is still the 5 structural defaults.)

- [ ] **Step 2: Remove the obsolete file-copy tests**

```bash
git rm test/skills-install.test.ts test/skills-package-install.test.ts
```

- [ ] **Step 3: Update `sync-skills.test.ts` paths**

In `test/sync-skills.test.ts`, update any expectation that the vendor directory is `skills/` to `vendor/skills/`. The pure helpers (`copyTree`, `countSkillFiles`, `writeSourceManifest`) are unchanged; only path-based assertions move. Run it to confirm:

Run: `npx vitest run test/sync-skills.test.ts`
Expected: PASS.

- [ ] **Step 4: Update the sync workflow**

In `.github/workflows/sync-skills.yml`: change the provenance-check path from `skills/.source.json` to `vendor/skills/.source.json`; add a `node scripts/compile-skills.mjs` step after the sync; and include `vendor/skills` and `src/scrum/frontend-skill-defaults.generated.ts` in the files the PR commits. (Match the existing step/commit syntax in that file.)

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run test/agent-skill-seeding.test.ts test/sync-skills.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add test/agent-skill-seeding.test.ts test/sync-skills.test.ts .github/workflows/sync-skills.yml
git commit -m "test(skills): update suites + sync workflow for DB-served frontend skills" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Version bump + changelog + README + docs

**Files:**
- Modify: `package.json` (version), `CHANGELOG.md`, `README.md`, `docs/api-reference.md`, `docs/ARCHITECTURE.md`, `docs/guide/architecture.md`, `docs/user-guide.md`, `.claude/commands/kickoff.md`

- [ ] **Step 1: Bump the version**

In `package.json`, change `"version": "1.2.1"` → `"version": "1.3.0"`.

- [ ] **Step 2: Prepend the CHANGELOG entry**

In `CHANGELOG.md`, insert above the `## [1.2.1] - 2026-06-09` line (after line 6):

```markdown
## [1.3.0] - 2026-06-09

### Added
- **Server-provided frontend skills** — the frontend skill set is now served by the MCP server straight into a live `/kickoff` session instead of being copied into each project. When a sprint has `fe-engineer` work, `load_phase_context` injects a house-style primer plus an index of available skills; the agent pulls any skill's full body on demand via the new **`get_skill`** tool. No restart, no slash-skill registration.
- **`get_skill({ name })`** — read tool returning one skill's full content from the DB (e.g. `fe:set-up-auth`, or a shared ref `fe:_shared/<file>`).
- **`seedFrontendSkills()`** — idempotently seeds the frontend skills + the editable `fe:_house-style` primer into the project DB `skills` table (`owner_role: 'fe-engineer'`); per-skill insert-if-absent, so edits survive re-seeds.
- **`npm run compile:skills`** (`scripts/compile-skills.mjs`) — compiles the vendored `vendor/skills/frontend/**` into `src/scrum/frontend-skill-defaults.generated.ts`, shipped compiled in the package.

### Changed
- Frontend skills now live in the server DB (single source of truth, editable per project) rather than as files in your repo. Vendored source moved from `skills/` to `vendor/skills/` (build input only); `package.json` `files[]` no longer ships it.
- `setup` no longer copies skills into `.claude/skills/`; the former step 7 is removed. Skills are seeded into the DB by `seedDefaults`.

### Removed
- The `.claude/skills/<skill>/` file-copy install (added in 1.2.0) and the dead `src/server/skills-install.ts`.

### Notes
- Existing projects may still have `.claude/skills/<frontend-skill>/` files from 1.2.0 — these are harmless leftovers and can be deleted; the server no longer manages them.
```

- [ ] **Step 3: Rewrite the README skills section**

In `README.md`, replace the `## Bundled Frontend Skills` section (lines 135-145) with:

```markdown
## Frontend Skills (server-provided)

The server ships a curated library of **22 frontend skills** — state-of-the-art practices for building scalable React 19 / Vue 3 frontends (scaffolding, routing, state, forms, auth, i18n, testing, accessibility, performance, design systems, motion, PWA, and more) — plus an editable **house-style primer**.

Unlike a plugin, these are **served by the MCP server into your live session**, not copied into your repo. When you run `/kickoff` and a sprint has `fe-engineer` work, `load_phase_context` injects the house-style primer and an index of available skills; your agent then pulls any skill's full guidance on demand with `get_skill({ name })`. No restart, no files to manage.

| | |
|---|---|
| Source | [`claude_development_skills`](https://github.com/VelimirMueller/claude_development_skills) — vendored under `vendor/skills/` (build input) |
| Storage | seeded into the project DB `skills` table (`owner_role: fe-engineer`); **edit them to make them yours** — re-seeds never overwrite your edits |
| Trigger | automatic on `fe-engineer` tickets during `/kickoff` |
| Load | index + primer up front; full body via `get_skill({ name })` |
| Update | `npm run sync:skills` (re-vendors + recompiles), or the daily `sync-skills` workflow |
```

Also update the Quick Start line (line 70) — replace `installs the bundled frontend skills into `.claude/skills/`,` with `seeds the frontend skill library into the project database,`.

- [ ] **Step 4: Document `get_skill` in the API reference**

In `docs/api-reference.md`, add after the `get_ticket` entry (before `## Epics & Milestones` at line 391):

```markdown
### `get_skill`

Fetch the full content of a single skill by name.

| Param | Type | Description |
|-------|------|-------------|
| `name` | string | Skill name — e.g. `fe:set-up-auth`, the primer `fe:_house-style`, or a shared ref `fe:_shared/<file>` |

Frontend skills are surfaced as an index by `load_phase_context` during `/kickoff` (when a sprint has `fe-engineer` work); call `get_skill` to pull the full guidance for a specific one on demand.
```

- [ ] **Step 5: Document the flow in the architecture + user docs**

Append to `docs/ARCHITECTURE.md` and `docs/guide/architecture.md` a subsection (match each file's heading depth):

```markdown
### Frontend skills

Frontend skills are vendored from `claude_development_skills` into `vendor/skills/` (build input), compiled by `scripts/compile-skills.mjs` into a generated defaults module, and seeded into the project DB `skills` table (`owner_role='fe-engineer'`) by `seedDefaults`. They are served — not copied: during `/kickoff`, `load_phase_context` detects `fe-engineer` tickets and injects a Frontend Playbook (editable house-style primer + skill index), and the agent fetches full skill bodies on demand via `get_skill`.
```

Append to `docs/user-guide.md` a short subsection:

```markdown
### Frontend skills on `/kickoff`

When a sprint has tickets assigned to the `fe-engineer` role, `/kickoff` automatically surfaces a Frontend Playbook — a house-style primer plus an index of available frontend skills. As you start a frontend ticket, ask for the full guidance with `get_skill({ name: "fe:<slug>" })`. The skills live in your project database — edit them (or the `fe:_house-style` primer) to encode your team's preferred ways of working; your edits survive updates.
```

- [ ] **Step 6: Note the auto-load in the kickoff command**

In `.claude/commands/kickoff.md`, in Phase 7 (after the `load_phase_context({ phase: "implementation", … })` paragraph around line 320), add:

```markdown
**Frontend work:** if the sprint has `fe-engineer` tickets, `load_phase_context` injects a Frontend Playbook (house-style primer + skill index). When you start a frontend ticket, pull the specific guidance with `get_skill({ name: "fe:<slug>" })` (and any `fe:_shared/<file>` it references).
```

- [ ] **Step 7: Verify no stale references remain**

Run: `grep -rn "1\.2\.1" package.json CHANGELOG.md` → expect only historical CHANGELOG mentions, not the live `package.json` version.
Run: `grep -rn "installs the bundled frontend skills into" README.md` → expect no matches.

- [ ] **Step 8: Commit**

```bash
git add package.json CHANGELOG.md README.md docs/api-reference.md docs/ARCHITECTURE.md docs/guide/architecture.md docs/user-guide.md .claude/commands/kickoff.md
git commit -m "docs: server-provided frontend skills; release v1.3.0" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build (regenerates skills + compiles)**

Run: `npm run build`
Expected: completes with no TypeScript errors; `dist/scrum/frontend-skill-defaults.generated.js` exists.

- [ ] **Step 2: Full backend test suite**

Run: `npm test`
Expected: all suites PASS, including `compile-skills`, `seed-frontend-skills`, `frontend-playbook`, `get-skill-tool`, and the updated `agent-skill-seeding` / `sync-skills`. No references to the deleted `skills-install` / `skills-package-install` tests.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run:
```bash
node -e "const D=require('better-sqlite3'); const {initScrumSchema}=require('./dist/scrum/schema.js'); const {seedDefaults}=require('./dist/scrum/defaults.js'); const {buildFrontendPlaybook}=require('./dist/scrum/frontend-playbook.js'); const db=new D(':memory:'); initScrumSchema(db); seedDefaults(db); console.log(buildFrontendPlaybook(db).slice(0,400));"
```
Expected: prints the `## Frontend Playbook` header, primer text, and an index of `fe:` skills.

- [ ] **Step 5: Confirm green, then finish the branch**

Use superpowers:finishing-a-development-branch to open the PR / merge.

---

## Self-Review

**Spec coverage:** hybrid source-of-truth (Tasks 1-2) ✓; index + on-demand load (Tasks 3-4) ✓; `fe-engineer` trigger (Task 4) ✓; vendored source → `vendor/skills/` (Task 1) ✓; primer seeded + editable (Task 2) ✓; remove file-copy (Task 5) ✓; backward-compat note (Task 7 CHANGELOG) ✓; every doc/release surface (Task 7) ✓; broken existing tests/reset logic (Tasks 2, 6) ✓.

**Placeholder scan:** no TBD/TODO; all code blocks are complete; primer and CHANGELOG text are literal.

**Type/name consistency:** `seedFrontendSkills`, `FE_PRIMER_NAME`, `FRONTEND_HOUSE_STYLE_PRIMER`, `FRONTEND_SKILL_DEFAULTS`, `getSkillContent`, `parseSkillSummary`, `buildFrontendPlaybook` are defined once and referenced consistently. Skill naming `fe:<slug>` / `fe:_shared/<file>` / `fe:_house-style` is uniform across compiler, seeder, playbook query, and docs. `owner_role='fe-engineer'` is the single selector throughout.
