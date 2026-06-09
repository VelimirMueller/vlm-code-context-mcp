# Agent-Model Subagent Delegation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a ticket's assigned-agent model take effect by surfacing a "Model routing" directive (assigned model → `opus`/`sonnet`/`haiku` tier) in `load_phase_context` and `get_ticket`, which the `/kickoff` and `/sprint` flows act on by spawning a subagent at that tier.

**Architecture:** A pure helper (`src/scrum/agent-model.ts`) maps the stored model id to a Task-tool tier and formats the directive. Two MCP tools (`load_phase_context` implementation branch, `get_ticket`) join `agents` on the ticket's `assigned_to` and append the directive. Command docs instruct Claude to spawn a subagent at that tier. The server never spawns subagents — it only emits the directive.

**Tech Stack:** TypeScript (NodeNext), better-sqlite3, `@modelcontextprotocol/sdk`, Vitest. Spec: `docs/superpowers/specs/2026-06-09-agent-model-subagent-delegation-design.md`.

**Conventions:** Each `git commit` ends with `-m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"`. Run from repo root. Work on the current branch `chore/agent-models-and-lint-fix` (already carries the lint fix + model-default commits). Do NOT push.

---

### Task 1: `agent-model.ts` helper (tier mapping + directive)

**Files:**
- Create: `src/scrum/agent-model.ts`
- Test: `test/agent-model.test.ts`

- [ ] **Step 1: Write the failing test** — create `test/agent-model.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { modelToTier, formatModelRouting } from "../src/scrum/agent-model.js";

describe("modelToTier", () => {
  it("maps opus/sonnet/haiku ids to Task-tool tiers", () => {
    expect(modelToTier("claude-opus-4-8")).toBe("opus");
    expect(modelToTier("claude-sonnet-4-6")).toBe("sonnet");
    expect(modelToTier("claude-haiku-4-5")).toBe("haiku");
  });
  it("defaults unknown/null/undefined to sonnet", () => {
    expect(modelToTier(null)).toBe("sonnet");
    expect(modelToTier(undefined)).toBe("sonnet");
    expect(modelToTier("gpt-9")).toBe("sonnet");
  });
});

describe("formatModelRouting", () => {
  it("includes the role, the tier, and the Task-tool instruction", () => {
    const md = formatModelRouting("fe-engineer", "claude-opus-4-8");
    expect(md).toContain("## Model routing");
    expect(md).toContain("fe-engineer");
    expect(md).toContain('model: "opus"');
    expect(md).toContain("Task tool");
  });
  it("renders the tier even when the model id is null", () => {
    expect(formatModelRouting("qa", null)).toContain('model: "sonnet"');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/agent-model.test.ts`
Expected: FAIL — `Cannot find module '../src/scrum/agent-model.js'`.

- [ ] **Step 3: Write the helper** — create `src/scrum/agent-model.ts`:

```ts
export type Tier = "opus" | "sonnet" | "haiku";

/** Map a stored agent model id to the Task-tool subagent tier. Unknown/null → "sonnet". */
export function modelToTier(modelId: string | null | undefined): Tier {
  if (!modelId) return "sonnet";
  if (modelId.startsWith("claude-opus")) return "opus";
  if (modelId.startsWith("claude-haiku")) return "haiku";
  return "sonnet";
}

/**
 * Build the "Model routing" directive appended to a ticket's context. Tells the
 * session to implement the ticket by spawning a subagent at the assigned tier.
 * Routing is tier-level (opus/sonnet/haiku); the exact minor version is not pinned.
 */
export function formatModelRouting(role: string, modelId: string | null | undefined): string {
  const tier = modelToTier(modelId);
  return [
    "## Model routing",
    `This ticket is assigned to **${role}** (model \`${modelId ?? "default"}\` → tier \`${tier}\`).`,
    `Implement it by spawning a subagent: **Task tool with \`model: "${tier}"\`**. Give the subagent the ticket's title, description, and acceptance criteria (for \`fe-engineer\`, also load the frontend playbook). Have it implement and report back; then run the QA gate and mark the ticket DONE.`,
  ].join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/agent-model.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scrum/agent-model.ts test/agent-model.test.ts
git commit -m "feat(agents): add model->tier mapping + model-routing directive helper" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Surface the directive in `load_phase_context` + `get_ticket`

**Files:**
- Modify: `src/scrum/tools.ts` (import; `get_ticket` block; `load_phase_context` implementation branch)
- Test: `test/model-routing-context.test.ts`

Locate edit points by CONTENT (grep), not line numbers.

- [ ] **Step 1: Write the failing test** — create `test/model-routing-context.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initScrumSchema } from "../src/scrum/schema.js";
import { seedDefaults } from "../src/scrum/defaults.js";
import { formatModelRouting } from "../src/scrum/agent-model.js";

let db: Database.Database;
beforeEach(() => {
  db = new Database(":memory:");
  initScrumSchema(db);
  seedDefaults(db);
});

/** Mirrors the lookup load_phase_context / get_ticket perform for an assigned ticket. */
function routingFor(assignedRole: string): string {
  const ag = db.prepare("SELECT model FROM agents WHERE role = ?").get(assignedRole) as
    | { model: string }
    | undefined;
  return formatModelRouting(assignedRole, ag?.model ?? null);
}

describe("ticket model routing (DB join → tier)", () => {
  it("routes an fe-engineer ticket to the opus tier", () => {
    expect(routingFor("fe-engineer")).toContain('model: "opus"'); // fe-engineer defaults to claude-opus-4-8
  });
  it("routes a qa ticket to the opus tier", () => {
    expect(routingFor("qa")).toContain('model: "opus"'); // qa defaults to claude-opus-4-8
  });
  it("routes a devops ticket to the sonnet tier", () => {
    expect(routingFor("devops")).toContain('model: "sonnet"'); // devops stays claude-sonnet-4-6
  });
});
```

- [ ] **Step 2: Run it to verify it passes at the logic level**

Run: `npx vitest run test/model-routing-context.test.ts`
Expected: PASS (3 tests) — this confirms the seeded models map to the right tiers. Steps 3-5 wire the real tools (verified by the spec/quality reviewers + `tsc`).

- [ ] **Step 3: Import the helper in `tools.ts`**

Add alongside the existing top-of-file imports (right after `import { resolveDashboardToken } from "../dashboard/auth.js";`):

```ts
import { formatModelRouting } from "./agent-model.js";
```

- [ ] **Step 4: Append the directive in `get_ticket`**

Find the `server.tool("get_ticket", …)` handler. Its `sections` array ends just before `return { content: [{ type: "text" as const, text: sections.join("\n") }] };`. Immediately before that `return`, add:

```ts
      if (t.assigned_to) {
        const ag = db.prepare(`SELECT model FROM agents WHERE role = ?`).get(t.assigned_to) as { model: string } | undefined;
        sections.push("", formatModelRouting(t.assigned_to, ag?.model ?? null));
      }
```

(`t` is the ticket row already fetched at the top of `get_ticket`; it has `assigned_to`.)

- [ ] **Step 5: Append the directive in `load_phase_context` (implementation branch)**

Find `else if (phase === "implementation") {`. Inside it there is an `if (ticket_id) { const t = db.prepare(\`SELECT * FROM tickets WHERE id = ?\`).get(ticket_id) as any; if (t) { … } }` block that pushes the ticket detail (description, acceptance criteria). Inside that inner `if (t) { … }`, after the acceptance-criteria push and before it closes, add:

```ts
              if (t.assigned_to) {
                const ag = db.prepare(`SELECT model FROM agents WHERE role = ?`).get(t.assigned_to) as { model: string } | undefined;
                sections.push("", formatModelRouting(t.assigned_to, ag?.model ?? null));
              }
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: clean (the import resolves; both insertions are well-typed; `t`/`sections`/`db` are in scope).
Run: `npx vitest run test/model-routing-context.test.ts`
Expected: PASS.
Run: `npm test`
Expected: full suite green; paste the summary line.

- [ ] **Step 7: Commit**

```bash
git add src/scrum/tools.ts test/model-routing-context.test.ts
git commit -m "feat(agents): surface model-routing directive in load_phase_context + get_ticket" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire delegation into the command docs

**Files:**
- Modify: `.claude/commands/kickoff.md` (Phase 7 — Implementation Loop)
- Modify: `.claude/commands/sprint.md` (Step 4 — Implementation)

- [ ] **Step 1: Add the delegation instruction to `kickoff.md`**

In `.claude/commands/kickoff.md`, in Phase 7 (Implementation Loop), after the paragraph describing `load_phase_context({ phase: "implementation", … })`, insert:

```markdown
**Delegate by model.** `load_phase_context` returns a **Model routing** directive for the ticket. Implement every ticket by spawning a subagent via the **Task tool with the `model` tier from that directive** (`opus`/`sonnet`/`haiku`) — pass the ticket's title, description, and acceptance criteria. Let the subagent implement and report back; then run the QA gate and mark the ticket DONE. This is how a ticket's assigned-agent model actually takes effect.
```

- [ ] **Step 2: Add the same instruction to `sprint.md`**

In `.claude/commands/sprint.md`, after the Step 4 implementation `load_phase_context({ phase: "implementation", sprint_id, ticket_id })` block, insert the same paragraph:

```markdown
**Delegate by model.** The returned **Model routing** directive gives the ticket's tier. Implement each ticket by spawning a subagent via the **Task tool with that `model` tier** (`opus`/`sonnet`/`haiku`), passing the ticket's title, description, and acceptance criteria; then QA-gate and mark DONE.
```

- [ ] **Step 3: Verify the edits landed**

Run: `grep -c "Delegate by model" .claude/commands/kickoff.md .claude/commands/sprint.md`
Expected: `1` in each file.

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/kickoff.md .claude/commands/sprint.md
git commit -m "docs(commands): delegate ticket implementation to a subagent at the assigned model tier" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Version bump + CHANGELOG (v1.3.0)

**Files:**
- Modify: `package.json` (version)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump the version**

In `package.json`, change `"version": "1.2.1"` → `"version": "1.3.0"`.

- [ ] **Step 2: Prepend the CHANGELOG entry**

In `CHANGELOG.md`, insert above the `## [1.2.1] - 2026-06-09` heading:

```markdown
## [1.3.0] - 2026-06-09

### Added
- **Per-agent model routing via subagent delegation** — each ticket's implementation is delegated to a subagent spawned (Task tool) at its assigned agent's model tier (`opus`/`sonnet`/`haiku`). `load_phase_context` (implementation) and `get_ticket` now emit a **Model routing** directive, and the `/kickoff` and `/sprint` flows act on it. This is what makes a ticket's assigned-agent model actually take effect (the dashboard model field was previously advisory only).

### Changed
- Agent model defaults updated to current IDs: `fe-engineer`, `be-engineer`, `developer`, and `qa` default to the strongest model (`claude-opus-4-8`); other roles use `claude-sonnet-4-6`. The dashboard model picker and `/api/agent` validation now offer `claude-opus-4-8`, replacing the outdated `claude-opus-4-6`.

### Fixed
- Dashboard `SprintPlanningView` had a malformed conditional (`cond ? (<jsx/>)` with no `:` branch) that failed the TypeScript parser and ESLint; completed it as a `cond && (<jsx/>)` render. `npm run lint` now reports 0 errors.
```

- [ ] **Step 3: Verify**

Run: `grep -m1 '"version"' package.json` → expect `1.3.0`.
Run: `node -e "require('./package.json')"` → valid JSON (no output).
Run: `grep -c "## \[1.3.0\]" CHANGELOG.md` → expect `1`.

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.3.0 — model routing, agent model defaults, lint fix" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Merge coordination (for the PR description, not a code step):** PR #30 (server-provided frontend skills) also introduces a `## [1.3.0]` section and bumps to `1.3.0`. Whichever PR merges second hits a trivial CHANGELOG conflict — resolve by combining the two 1.3.0 sections' bullets. `package.json` is `1.3.0` in both, so there is no version-number conflict.

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: completes with no TypeScript errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green, including `agent-model` and `model-routing-context`. Paste the summary line.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: **0 errors** (pre-existing warnings are fine).

- [ ] **Step 4: Smoke the directive end-to-end against built output**

Run:
```bash
node -e "const D=require('better-sqlite3'); const {initScrumSchema}=require('./dist/scrum/schema.js'); const {seedDefaults}=require('./dist/scrum/defaults.js'); const {formatModelRouting}=require('./dist/scrum/agent-model.js'); const db=new D(':memory:'); initScrumSchema(db); seedDefaults(db); const ag=db.prepare(\"SELECT model FROM agents WHERE role='fe-engineer'\").get(); console.log(formatModelRouting('fe-engineer', ag.model));"
```
Expected: prints a `## Model routing` block naming `fe-engineer`, `claude-opus-4-8`, and `model: "opus"`.

- [ ] **Step 5: Confirm green, then finish the branch**

Use superpowers:finishing-a-development-branch (the user has asked to push + open a PR after this work).

---

## Self-Review

**Spec coverage:** delegation mechanism (Tasks 1-3) ✓; `modelToTier` + `formatModelRouting` helper (Task 1) ✓; surfaced in `load_phase_context` + `get_ticket` (Task 2) ✓; command-doc wiring (Task 3) ✓; tier-level caveat documented in the helper JSDoc + CHANGELOG (Tasks 1, 4) ✓; v1.3.0 release covering lint + models + delegation, with PR #30 merge note (Task 4) ✓; every-ticket delegation (command-doc text says "every ticket"/"each ticket") ✓.

**Placeholder scan:** no TBD/TODO; all code blocks complete; CHANGELOG and directive text are literal.

**Type/name consistency:** `modelToTier`, `formatModelRouting`, `Tier` defined once (Task 1) and used consistently (Tasks 2, 5). The DB lookup `SELECT model FROM agents WHERE role = ?` and `formatModelRouting(role, model)` call shape are identical across `get_ticket`, `load_phase_context`, and both tests. Tier string literals (`"opus"`/`"sonnet"`/`"haiku"`) match the Task tool's `model` enum.
