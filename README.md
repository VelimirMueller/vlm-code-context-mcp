# vlm-code-context-mcp

**Structured codebase context and scrum process management for AI agents via MCP.**

```bash
npm install vlm-code-context-mcp
npx code-context-mcp setup .
npx code-context-dashboard ./context.db
# Opens at http://localhost:3333
```

---

## Slash Commands

Two built-in commands for Claude Code users. Type these directly in your Claude Code session.

### `/kickoff` — Full guided lifecycle (start here)

Interactive walkthrough from zero to sprint complete. Claude asks you one beautiful question at a time, executes MCP tools based on your answers, and enforces all QA gates.

```
/kickoff
```

Covers: vision → discovery → milestone → epics → tickets → sprint → implementation → retro → rest → archive

**Smart resume:** If you already have a vision, discoveries, or an active sprint, `/kickoff` detects them and picks up where you left off instead of starting from scratch.

### `/sprint` — Sprint-only (for repeat cycles)

Already have your vision, milestone, and epics? Skip straight to sprint planning and execution.

```
/sprint
```

Covers: plan → implement → QA verify → retro → rest → archive

Both commands archive discoveries, epics, and milestones on sprint close — nothing is left dangling.

---

## Overview

AI coding tools burn through context windows reading raw source files, then lose everything when the session ends. There is no structure, no process, and no continuity.

`vlm-code-context-mcp` solves this by pre-indexing your project into a structured SQLite database. Agents query metadata instead of raw source — **25x fewer tokens, 26x less data on a 224-file codebase.** On top of that, it provides a virtual scrum team with sprint ceremonies, phase gates, velocity tracking, and a live React dashboard — all through 79 MCP tools.

No API keys. No external services. No cloud dependency. Everything lives in a single `context.db` file.

---

## Getting Started (Step by Step)

This walks you through every command from zero to your first sprint. Copy-paste each step in order.

### Step 1 — Install

```bash
npm install vlm-code-context-mcp
```

This installs the MCP server, dashboard, and all 79 tools. No API keys, no cloud accounts.

### Step 2 — Run setup

```bash
npx code-context-mcp setup .
```

This does four things automatically:
1. Creates `context.db` — a single SQLite file that holds everything
2. Indexes your codebase — scans all files, extracts metadata, exports, and dependencies
3. Seeds the default team — 4 agents (Product Owner, Developer, QA, DevOps)
4. Writes `.mcp.json` — configures the MCP server so your AI client can find it

You should see output like:
```
=== Code Context MCP — Setup (my-project) ===

[1/4] Initializing database...
[2/4] Indexing target directory...
  Indexed 174 files, 328 exports, 59 dependencies.
[3/4] Seeding factory defaults...
  Seeded 4 agents, 2 skills
[4/4] Configuring MCP client...
  Wrote .mcp.json

=== Setup complete! ===
```

### Step 3 — Restart your AI client

After setup, **restart Claude Code** (or whichever MCP client you use). This loads the 79 MCP tools. You can verify by asking your AI:

> "Call `get_project_status`"

It should respond with your file count, agent count, and "Project is set up and ready."

### Step 4 — Open the dashboard (optional)

```bash
npx code-context-dashboard ./context.db
# Opens at http://localhost:3333
```

The dashboard shows your sprint board, code explorer, team health, and more. It updates live — every MCP tool call triggers an instant UI refresh.

To also watch for file changes on disk (auto-reindex when you save files):

```bash
npx code-context-dashboard ./context.db 3333 .
```

### Step 5 — Set your product vision

Tell your AI client:

> "Update the product vision to: We are building [your project description]. Our target users are [who]. Success looks like [what]."

This calls `update_vision` behind the scenes. The vision guides sprint planning.

### Step 6 — Create a milestone

Milestones group sprints toward a larger goal. Setup creates a default "M1 — Getting Started" milestone automatically. To create your own:

> "Create a milestone called 'M1 — MVP Launch' with description 'Core features ready for first users'"

This calls `create_milestone`.

### Step 7 — Start your first sprint

This is the big one. Tell your AI:

> "Start a new sprint called 'Sprint 1 — [Your Goal]' with these tickets: [list your tasks]"

Or be more specific:

> "Start a sprint with goal 'Set up authentication and user profiles' with these tickets:
> - Implement login endpoint (3 points, assigned to developer)
> - Add JWT middleware (2 points, assigned to developer)
> - Write auth tests (2 points, assigned to qa)
> - Review security posture (1 point, assigned to devops)"

This calls ` `, which creates the sprint, creates all tickets, assigns agents, and returns a playbook telling you what to do next.

### Step 8 — Work through the sprint

The sprint follows 4 phases. Your AI handles the ceremony — you focus on the work.

```
planning → implementation → done → rest
```

**During implementation**, update tickets as you work:

> "Mark ticket [id] as IN_PROGRESS"
> "Mark ticket [id] as DONE"

**To advance phases**, tell your AI:

> "Advance sprint [id] to the next phase"

This calls `advance_sprint`, which checks gate conditions (e.g., "all tickets must be QA-verified before closing") and either advances or tells you what's blocking.

### Step 9 — Close the sprint

Before closing, the sprint **requires**:
- All tickets marked DONE (or explicitly NOT_DONE with a reason)
- All DONE tickets QA-verified (`qa_verified = true`)
- At least 3 retrospective findings (one went_well, one went_wrong, one try_next)

Add retro findings:

> "Add retro finding: went_well — 'Auth implementation was smooth, good test coverage'"
> "Add retro finding: went_wrong — 'Underestimated JWT complexity, took extra day'"
> "Add retro finding: try_next — 'Spike complex features before committing points'"

Then advance to done → rest.

### Step 10 — Repeat

Start the next sprint. Your velocity history, retro patterns, and team mood carry forward. The system learns from each sprint.

---

### Quick Reference — Key Commands

| What you want | What to tell your AI |
|---|---|
| Check project health | "Call `get_project_status`" |
| See all agents | "Call `list_agents`" |
| List all sprints | "Call `list_sprints`" |
| See sprint details | "Call `get_sprint` for sprint [id]" |
| See backlog | "Call `get_backlog`" |
| Start a sprint | "Start a sprint with goal '...' and tickets [...]" |
| Update a ticket | "Mark ticket [id] as DONE" |
| Report a bug | "Log a bug on sprint [id]: [description]" |
| Report a blocker | "Create a blocker on sprint [id]: [description]" |
| Add retro finding | "Add retro finding: [category] — [finding]" |
| Advance phase | "Advance sprint [id]" |
| Search everything | "Search scrum for '[query]'" |
| View sprint process | "Call `get_sprint_instructions`" |

---

## Default team

| Role | Responsibility |
|---|---|
| Product Owner | Requirements, priorities, acceptance criteria |
| Developer | Feature implementation, bug fixes |
| QA Engineer | Testing, quality gates, verification |
| DevOps | CI/CD, deployment, infrastructure |

Agents are fully configurable. Add, remove, or modify roles through MCP tools or direct database access. Each agent carries a mood score computed from workload and retrospective sentiment.

---

## Sprint process

Sprints follow 4 phases with gate checks:

```
planning → implementation → done → rest
```

- **Planning** (1 day) — Define sprint goal, assign tickets and points (~19pts target), confirm capacity
- **Implementation** (3 days) — Development work, daily standups, QA verification, code reviews
- **Done** (0.5 day) — Sprint summary, retrospective findings, velocity review (requires retro findings + all tickets resolved)
- **Rest** (0.5 day) — Team recovery, knowledge sharing

Phases, durations, and gate criteria are fully customizable via the `update_sprint_config` MCP tool.

---

## Dashboard

**6 pages. Live SSE updates.**

Every database mutation triggers an instant dashboard refresh via SQLite WAL monitoring. No polling.

- **Sprint Board** — Kanban, planning view, burndown chart
- **Code Explorer** — File tree, dependency graph, export/import map, change history
- **Project Management** — Gantt timeline, milestone tracker, discovery pipeline, vision editor
- **Team** — Agent health cards, mood trends, workload distribution
- **Retro** — Findings by category, cross-sprint pattern analysis, action tracking
- **Marketing** — Release notes, positioning, Remotion vision animation

<img width="3840" height="2585" alt="image" src="https://github.com/user-attachments/assets/52e2fbca-1e65-4ec9-a0fe-f11f000b1510" />

---

## Bridge layer

`src/bridge/` implements a `PreToolUse` hook that connects Claude Code to the dashboard bidirectionally. Actions queued in the UI are processed by the running Claude Code session.

This layer is still being hardened. PRs welcome.

---

## Context efficiency

Measured on this project's own codebase (224 files, 54K lines, 2.1 MB):

| Metric | With MCP | Without MCP | Improvement |
|---|---|---|---|
| Tokens per feature task | ~1,800 | ~46,000 | **25x reduction** |
| Raw data transferred | ~7K chars | ~184K chars | **26x reduction** |
| Tool calls required | 8 | 21 | **2.6x fewer** |

The agent queries structured metadata via `search_files`, `find_symbol`, and `get_file_context` — summaries, export lists, and dependency graphs instead of raw source. The first index costs more (files must be read to generate metadata); every subsequent query is 25x cheaper. Break-even after 1 use.

---

## At a glance

| Component | Count |
|---|---|
| MCP tools | 79 (10 code + 69 scrum) |
| React components | 58 |
| Database tables | 30 (25 scrum + 5 code) |
| Default agent roles | 4 |
| Source files | 112 |

---

## Project history

Built entirely through its own scrum process across multiple milestones and sprints, with velocity tracking and retrospectives driving continuous improvement.

### Key learnings

<img width="1922" height="968" alt="image" src="https://github.com/user-attachments/assets/4b1059e1-e1d8-43b2-99af-f62ca504a74b" />

**What works well:**

- **Discovery-first approach** — spiking multiple approaches before writing code eliminates wasted implementation.
- **Parallel agent execution** — independent tasks run simultaneously while the main thread coordinates.
- **Research-before-code** — catching dead ends early (e.g., evaluating bridge approaches) saves significant rework.
- **Schema migration pattern** — `schema_versions` table makes incremental DB changes safe and repeatable.
- **Security audits in parallel** — running audits alongside implementation, not after, catches issues before code ships.
- **SSE + WAL watcher** — every MCP mutation triggers instant UI updates. No polling required.

**Known limitations:**

- Bridge only works when Claude is actively making tool calls — no push-based signaling yet.
- Frontend components carry accumulated tech debt from rapid iteration.

---
