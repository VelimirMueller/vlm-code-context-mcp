# vlm-code-context-mcp

**A full AI engineering team. One npm package. Zero context waste.**

> Product Owner. Architect. QA. Security. Two developers. A Scrum Master. A Manager. A Lead Dev.  
> All running real sprints. All talking to your codebase. All inside a single SQLite database.

```bash
npx code-context-mcp setup .
```

---

## Why this exists

Every AI coding tool hits the same wall: the model burns through its context window just *reading* your codebase before it can do anything useful. Then the session ends, and next time it starts over.

The second problem is worse — there's no process. You get a capable AI that has no idea what it's supposed to build, in what order, or why.

`vlm-code-context-mcp` solves both. It pre-indexes your entire project into a structured SQLite database so agents query metadata instead of raw source — **3x fewer tokens, 8x less data, from the second query onwards.** And it wraps that intelligence in a complete virtual scrum team that runs real sprint ceremonies through 81 MCP tools, with phase gates, retrospectives, velocity tracking, and a live React dashboard.

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

**6 pages. 68 components. Live SSE updates.**

Every mutation — ticket status change, agent mood update, sprint phase transition — triggers an instant dashboard refresh via SQLite WAL monitoring. No polling. No manual refresh.

- **Sprint Board** — Kanban, planning view, QA gate tracker, burndown chart
- **Code Explorer** — File tree, dependency graph, export/import map, change history
- **Project Management** — Gantt timeline, milestone tracker, discovery pipeline, vision editor
- **Team** — Agent health cards, mood trends, workload distribution
- **Retro** — Findings by category, cross-sprint pattern analysis, action tracking
- **Marketing** — Release notes, positioning, Remotion vision animation

> 📸 *[screenshot here]*  
> 📸 *[screenshot here]*

---

## The bridge layer

The hardest problem in agentic tooling is bidirectional communication — getting the UI and the AI to actually talk to each other in real time.

`src/bridge/` implements a `PreToolUse` hook that connects Claude Code to the dashboard. Actions queued in the UI are processed by the running Claude Code session. This is what makes the team feel alive instead of like a static board.

This is still being hardened. PRs welcome.

---

## Context efficiency

Tested on a 25-file, 7K-line TypeScript project:

| Metric | With MCP | Without MCP | Improvement |
|---|---|---|---|
| Tokens per analysis | ~20K | ~62K | **3x reduction** |
| Raw data transferred | ~6K chars | ~111K chars | **8x reduction** |
| Tool calls required | 7 | 16 | **2x fewer** |

The first index costs more — files must be read to generate metadata. Every subsequent query is 3x cheaper. Break-even after approximately 2 uses.

---

## At a glance

| Component | Count |
|---|---|
| MCP tools | 81 (10 code + 71 scrum) |
| React components | 68 |
| Database tables | 15 |
| Agent roles | 9 |
| Test cases | 219 |

---