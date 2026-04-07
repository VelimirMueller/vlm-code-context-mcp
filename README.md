# vlm-code-context-mcp

**A full AI engineering team. One npm package. Zero context waste.**

> 📖 **[Getting Started Guide](GETTING-STARTED.md)** — New here? Start here!

> Product Owner. Architect. QA. Security. Two developers. A Scrum Master. A Manager. A Lead Dev.  
> All running real sprints. All talking to your codebase. All inside a single SQLite database.

```bash
npm install vlm-code-context-mcp
npx code-context-mcp setup .
npx code-context-dashboard ./context.db
```

---

## Why this exists

Every AI coding tool hits the same wall: the model burns through its context window just *reading* your codebase before it can do anything useful. Then the session ends, and next time it starts over.

The second problem is worse — there's no process. You get a capable AI that has no idea what it's supposed to build, in what order, or why.

`vlm-code-context-mcp` solves both. It pre-indexes your entire project into a structured SQLite database so agents query metadata instead of raw source — **25x fewer tokens, 26x less data on a 224-file codebase.** And it wraps that intelligence in a complete virtual scrum team that runs real sprint ceremonies through 80 MCP tools, with phase gates, retrospectives, velocity tracking, and a live React dashboard.

This isn't a task tracker with Claude bolted on. It's an operating system for AI-driven development.

---

## What you get in 60 seconds

```
Step 1/4 — Indexing files into context.db...
  Indexed 25 files, 142 exports, 87 dependencies

Step 2/4 — Loading scrum schema...
  Created 10 scrum tables

Step 3/4 — Importing team from .claude/agents/...
  Loaded 9 agents, 3 sprints, 24 tickets

Step 4/4 — Writing .mcp.json...
  Configured MCP server entry

=== Setup complete! (my-project) ===
```

Then open the dashboard:

```bash
npx code-context-dashboard ./context.db
# Opens at http://localhost:3333
```

**That's it.** Your AI team is ready. No API keys. No external services. No cloud dependency. Everything lives in `context.db`.

---

## The team

| Role | Responsibility |
|---|---|
| Product Owner | Vision, backlog, acceptance criteria |
| Scrum Master | Sprint ceremonies, blockers, velocity |
| Architect | System design, tech selection, scalability |
| Lead Developer | Code quality, PR reviews, conflict resolution |
| Backend Developer | APIs, services, database, integrations |
| Frontend Developer | UI, dashboard, animations, UX |
| QA Engineer | Test coverage, quality gates, regression |
| Security Specialist | Vulnerability audits, secure defaults |
| Manager | Cost control, anti-overengineering, timelines |

Each agent has a defined role, a system prompt, tool access scoped to their responsibilities, and a mood score derived from ticket load and retro sentiment. The system tracks burnout signals across sprints.

---

## The sprint process

Sprints run through 10 enforced phases with automated gate checks:

```
preparation → kickoff → planning → implementation → qa → refactoring → retro → review → closed → rest
```

Gates are real. The sprint won't advance to QA until tickets are assigned and estimated. It won't close until retro findings are logged. Velocity is tracked automatically across every sprint and surfaces in the dashboard.

---

## The dashboard

**6 pages. 69 components. Live SSE updates.**

Every mutation — ticket status change, agent mood update, sprint phase transition — triggers an instant dashboard refresh via SQLite WAL monitoring. No polling. No manual refresh.

- **Sprint Board** — Kanban, planning view, QA gate tracker, burndown chart
- **Code Explorer** — File tree, dependency graph, export/import map, change history
- **Project Management** — Gantt timeline, milestone tracker, discovery pipeline, vision editor
- **Team** — Agent health cards, mood trends, workload distribution
- **Retro** — Findings by category, cross-sprint pattern analysis, action tracking
- **Marketing** — Release notes, positioning, Remotion vision animation

<img width="3840" height="2585" alt="image" src="https://github.com/user-attachments/assets/52e2fbca-1e65-4ec9-a0fe-f11f000b1510" />

<img width="1922" height="968" alt="image" src="https://github.com/user-attachments/assets/4b1059e1-e1d8-43b2-99af-f62ca504a74b" />


---

## The bridge layer

The hardest problem in agentic tooling is bidirectional communication — getting the UI and the AI to actually talk to each other in real time.

`src/bridge/` implements a `PreToolUse` hook that connects Claude Code to the dashboard. Actions queued in the UI are processed by the running Claude Code session. This is what makes the team feel alive instead of like a static board.

This is still being hardened. PRs welcome.

---

## Context efficiency

Measured on this project's own codebase (224 files, 54K lines, 2.1 MB):

| Metric | With MCP | Without MCP | Improvement |
|---|---|---|---|
| Tokens per feature task | ~1,800 | ~46,000 | **25x reduction** |
| Raw data transferred | ~7K chars | ~184K chars | **26x reduction** |
| Tool calls required | 8 | 21 | **2.6x fewer** |

Methodology: "understand and modify a feature" task — locating relevant files, understanding exports/imports/dependents, reviewing recent changes. Without MCP the agent reads ~20 raw files (avg 9,200 chars each). With MCP it queries structured metadata via `search_files`, `find_symbol`, and `get_file_context` — summaries, export lists, and dependency graphs instead of raw source.

The first index costs more — files must be read to generate metadata. Every subsequent query is 25x cheaper. Break-even after 1 use. Savings scale with codebase size: a 25-file project sees 3x reduction, this 224-file project sees 25x.

---

## At a glance

| Component | Count |
|---|---|
| MCP tools | 80 (10 code + 70 scrum) |
| React components | 69 |
| Database tables | 34 (25 scrum + 5 code + 4 github) |
| Agent roles | 9 |
| Test cases | 332 |
| Source files | 140 |
| Lines of code | 51,427 |

---

## Project history

Built entirely through its own scrum process. The virtual team has completed **22 milestones**, **69 productive sprints**, and **211 tickets** totaling **534 story points** with a rolling velocity of ~20 pts/sprint.

### Retro findings across 19 sprints

**What went well (top patterns):**

- **Discovery-first approach** consistently eliminated wasted implementation. Spiking 3-4 approaches before writing code saved days of rework (S59, S65, S68).
- **Parallel agent execution** cut implementation time dramatically. 4 agents working independent tickets simultaneously while the main thread coordinated (S59, S65, S67).
- **Research-before-code** caught dead ends early. S68 eliminated 3 candidate bridge approaches (named pipes, unix sockets, MCP resource subscriptions) in hours instead of days.
- **Schema migration pattern** (schema_versions table) made incremental DB changes safe and repeatable. Zero regressions across 7 schema additions (S53, S55).
- **Security audit in parallel** caught 2 HIGH findings before any code shipped (S68). Running audits alongside implementation, not after, is the right pattern.
- **Wave-based execution** — shipping foundation first, then building features on top in parallel — produced zero rework (S57).
- **SSE + WAL watcher** for reactive dashboard eliminated manual refresh. Every MCP mutation triggers instant UI update (S53).

**What went wrong (top patterns):**

- **Tests marked DONE without running them.** Agents wrote tests but couldn't execute them — build verification must happen before marking DONE (S61, S65, S66).
- **Pre-existing test failures** created noise masking real regressions. Stale tests from old schema changes kept surfacing (S53, S67, S68).
- **Discovery velocity was misleading.** S56 had 46sp committed but all tickets were documentation-only. Discovery points should be tracked separately from implementation.
- **Generic ticket titles** with no descriptions or acceptance criteria made QA impossible. Every ticket needs concrete scope (S53).
- **Frontend tech debt accumulated** — 800+ LOC components, 850+ inline styles, zero tests. Should have addressed this earlier (S59).
- **Bridge only works when Claude is actively making tool calls.** No "nudge" mechanism to wake Claude for queued actions (S68).

**Try next (top action items):**

- Run `npm run build` after each agent completes, before marking ticket DONE (S65, S66, S67).
- Add acceptance criteria to every ticket at creation time (S55).
- Verify current state before creating fix tickets — some were already resolved (S58).
- Every new write-MCP-tool must trigger SSE notification — add as checklist item (S53).
- Implement Channels for true push-based bridge signaling when API stabilizes (S68).
- Track discovery points separately from implementation velocity (S56).

---
