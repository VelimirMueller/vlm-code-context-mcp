# Server-Provided Frontend Skills, Auto-Loaded on `/kickoff`

- **Date:** 2026-06-09
- **Status:** Design approved — pending spec review
- **Supersedes the delivery model in:** `docs/superpowers/plans/2026-06-09-bundle-skills-plugin.md` (file-copy install)

## Problem

The repo vendors 22 frontend `SKILL.md` files under `skills/frontend/`, and `setup.ts` (step 7, `src/server/setup.ts:214`) copies them into each consumer project's `.claude/skills/`. Two problems:

1. **Wrong distribution model.** Delivering skills as a folder copied into every project repo scatters files the server should own. The MCP server should *provide* the skills.
2. **Not live, not workflow-aware.** File-copied skills are only discovered by Claude Code at session start (needs a restart) and aren't connected to the scrum workflow.

**Desired behavior:** run `/kickoff`; when frontend work is reached, the session auto-loads the frontend guidance needed for the work — live, no restart, served by the server.

## Goals

- The MCP server is the **single source of truth** for frontend skills. No skill folder copied into consumer repos.
- `/kickoff` **auto-injects** frontend guidance into the live session when frontend work is detected — no restart, no slash-skill registration.
- **Progressive disclosure:** a compact index + house-style primer up front; full skill body on demand.
- Skills are **editable per project** so they become the user's preferred ways of working.

## Non-Goals

- Registering invocable `/slash` skills at runtime — an MCP server cannot do this (Claude Code discovers slash skills from disk at session start). Out of scope by design.
- Backend / infrastructure skill domains — future work; the design leaves room via `owner_role`.
- Changing the upstream `claude_development_skills` repo.

## Key Decisions (resolved in brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Source of truth | **Hybrid** — package ships compiled defaults → seeds DB `skills` table → served from DB (live-editable) |
| 2 | Load strategy | **Index + primer at kickoff; full skill body on demand** (progressive disclosure) |
| 3 | Trigger | **`fe-engineer` agent assignment** (automatic, data-driven, per-ticket scoping) |
| 4 | Vendored source location | Move to `vendor/frontend-skills/` — build input only (default; override in review) |
| 5 | Primer seed | Seed `fe:_house-style` with a starter distilled from the 22 skills' shared conventions; user-editable (default; override in review) |

## Architecture — three layers, one source of truth

```
BUILD TIME      sync-skills.mjs vendors upstream .md  ──►  build step compiles them
                into FRONTEND_SKILL_DEFAULTS (shipped compiled in the package)
                          │
SETUP / STARTUP seedFrontendSkills(db): insert any MISSING fe skills into the
                project's `skills` table (owner_role='fe-engineer'). Idempotent.
                          │
RUNTIME         load_phase_context({phase:'implementation'}) detects fe-engineer
(/kickoff)      work ──► injects house-style primer + skill INDEX into the session.
                Agent calls get_skill({name}) ──► full skill body injected. No restart.
```

The **DB is the live source of truth**; the package only *seeds* it. This mirrors the existing `SKILL_DEFAULTS → seedDefaults → skills` table flow (`src/scrum/defaults.ts:130`), extended to a frontend set.

## Data Model — no migration

Reuse the `skills` table as-is (`src/scrum/schema.ts:115`): `(id, name UNIQUE, content, owner_role, created_at, updated_at)`.

| column | value |
|---|---|
| `name` | `fe:<slug>` (e.g. `fe:set-up-auth`) — namespaced; avoids colliding with `SPRINT_PROCESS_JSON` etc. |
| `content` | the full `SKILL.md` (frontmatter + body) |
| `owner_role` | `fe-engineer` — **this is the frontend selector** (no new `domain` column needed) |

- Index one-liners are parsed from each skill's frontmatter `description:` at serve time (22 rows — trivial).
- One primer row, `fe:_house-style`, holds the cross-cutting "preferred ways of working" — the artifact that makes the set *yours* to edit.

## Components

### 1. `seedFrontendSkills(db)` — `src/scrum/defaults.ts`
- Adds `FRONTEND_SKILL_DEFAULTS` (compiled from the vendored `.md`) + the primer.
- **Insert-if-absent per skill** (by `name`), NOT the table-empty guard the structural defaults use (`defaults.ts:202`) — so frontend skills coexist with the 5 structural skills and **user edits survive** re-seeding.
- Called from `seedDefaults()` and on setup.

### 2. `load_phase_context` frontend branch — `src/scrum/tools.ts:1524`
- The implementation branch already pulls the sprint's tickets with `assigned_to`. If any ticket is `fe-engineer` → append a **Frontend Playbook** section:
  - the `fe:_house-style` primer, plus
  - a compact index: `fe:set-up-auth — <summary>` … with the instruction "load full guidance with `get_skill({ name })`".
- When called with a specific `ticket_id` that is fe-engineer-assigned, the Frontend Playbook is ensured present; which skill to pull is the agent's call via `get_skill` (progressive disclosure — no server-side relevance matching, per Decision 2).

### 3. `get_skill({ name })` tool — `src/scrum/tools.ts`
- New **read-only** tool returning one skill's full `content` from the DB. The on-demand fetch. Handles missing name gracefully.

### 4. Build / sync compile step — `scripts/sync-skills.mjs` + build
- Compile vendored `.md` → `FRONTEND_SKILL_DEFAULTS`. Vendored source moves to `vendor/frontend-skills/` (build input). The compiled defaults ship in the package; the folder is never copied into consumer repos.

## Trigger Logic

Fully automatic; zero new `/kickoff` questions. The index appears once a sprint has any `fe-engineer` ticket; `load_phase_context({ ticket_id })` for an fe-engineer ticket keeps the Frontend Playbook present so the agent can `get_skill` what it needs.

## Editing & Curation

The seed is the 22 vendored skills + the primer. The user makes them their own by **editing the DB rows** (or the primer). Re-sync only fills *missing* rows, so edits survive. (Optional follow-up: a `set_skill` / `reset_skill` tool; for now lean on existing `execute` / `reset_skills`.)

## Backward Compatibility

Existing projects that already have `.claude/skills/<fe-skill>/` copies: those are harmless leftovers — we simply stop adding/updating them. The new behavior is additive (DB seed + serve). CHANGELOG will note that the old copied files can be deleted.

## Documentation & Release Surfaces

Explicitly in scope — every spot that references the version or the old skills behavior:

- **`package.json` version:** `1.2.1` → `1.3.0`. (Note: removing the `.claude/skills` file-copy is arguably a breaking change → `2.0.0`. Default to `1.3.0` as a new capability superseding a barely-used install path; confirm in review.)
- **`CHANGELOG.md`:** new `1.3.0` entry — server-provided frontend skills, kickoff auto-load, removal of file-copy install, migration note.
- **`README.md`:**
  - Rewrite **"Bundled Frontend Skills"** (lines 135–145) — now served by the MCP server into the session on `/kickoff`, seeded into the DB, editable; not copied into `.claude/skills/`.
  - Update **Quick Start** (line 70) — `setup` no longer "installs the bundled frontend skills into `.claude/skills/`".
  - **Slash Commands** (line 120) — note `/kickoff` auto-loads frontend skills for `fe-engineer` work.
- **`docs/api-reference.md`** — add `get_skill`; update `load_phase_context`.
- **`docs/ARCHITECTURE.md`** and **`docs/guide/architecture.md`** — the build→seed→serve skills flow.
- **`docs/user-guide.md`** — how frontend skills load on kickoff and how to edit them.
- **`docs/tools/`** — optional new `get-skill.md` page (follow existing per-tool doc pattern).
- **`.claude/commands/kickoff.md`** — one note in Phase 7 (the injected content is otherwise self-describing).
- VitePress `docs/.vitepress/dist/*` is generated — rebuild, do **not** hand-edit.

## Files Changed (summary)

- `src/scrum/defaults.ts` — `FRONTEND_SKILL_DEFAULTS` + `seedFrontendSkills()`
- `src/scrum/tools.ts` — frontend branch in `load_phase_context` + new `get_skill` tool
- `src/server/setup.ts` — remove the frontend file-copy (step 7)
- `scripts/sync-skills.mjs` + build — compile `.md` → defaults; vendored source → `vendor/frontend-skills/`
- `.claude/commands/kickoff.md` — Phase 7 note
- `package.json`, `CHANGELOG.md`, `README.md`, `docs/**` — version + documentation (above)
- Tests — see below

## Testing

- `seedFrontendSkills` idempotency: coexists with the 5 structural skills; re-seed preserves user edits; missing rows refilled.
- `fe-engineer` detection: sprint-level (any fe ticket) and ticket-level.
- Index format: summaries parsed from frontmatter; `get_skill` instruction present.
- `get_skill`: returns content for a valid name; graceful on missing.
- `load_phase_context`: frontend branch fires only when an `fe-engineer` ticket is present; absent for backend-only sprints.
- `setup`: no longer copies frontend skills into `.claude/skills/`.

## Open Questions

None blocking. Decisions 4 and 5 are defaults — confirm or override in spec review.
