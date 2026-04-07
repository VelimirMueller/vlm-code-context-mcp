# vlm-code-context-mcp

**Structured codebase context and scrum process management for AI agents via MCP.**

> **[Getting Started Guide](GETTING-STARTED.md)** | New here? Start here.

```bash
npm install vlm-code-context-mcp
npx code-context-mcp setup .
npx code-context-dashboard ./context.db
```

---

## Overview

AI coding tools burn through context windows reading raw source files, then lose everything when the session ends. There is no structure, no process, and no continuity.

`vlm-code-context-mcp` solves this by pre-indexing your project into a structured SQLite database. Agents query metadata instead of raw source — **25x fewer tokens, 26x less data on a 224-file codebase.** On top of that, it provides a virtual scrum team with sprint ceremonies, phase gates, velocity tracking, and a live React dashboard — all through 79 MCP tools.

No API keys. No external services. No cloud dependency. Everything lives in a single `context.db` file.

---

## Quick start

```
Step 1/4 — Indexing files into context.db...
  Indexed 25 files, 142 exports, 87 dependencies

Step 2/4 — Loading scrum schema...
  Created scrum tables

Step 3/4 — Seeding default team...
  Loaded 4 agents

Step 4/4 — Writing .mcp.json...
  Configured MCP server entry

=== Setup complete! (my-project) ===
```

```bash
npx code-context-dashboard ./context.db
# Opens at http://localhost:3333
```

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

Sprints follow 4 phases with configurable gate checks:

```
planning → implementation → done → rest
```

- **Planning** (1 day) — Goal setting, task assignment, velocity commitment
- **Implementation** (3-4 days) — Daily standups, code reviews, QA verification
- **Done** (0.5 day) — Sprint summary, retrospective findings, velocity review
- **Rest** (0.5 day, optional) — Team recovery

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
