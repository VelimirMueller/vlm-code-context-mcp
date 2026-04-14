<div align="center">

# vlm-code-context-mcp

### Persistent memory for AI coding agents.

**Your agents forget everything between sessions. This fixes that.**

[![npm](https://img.shields.io/npm/v/vlm-code-context-mcp)](https://www.npmjs.com/package/vlm-code-context-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```bash
npm install vlm-code-context-mcp
npx code-context-mcp setup .
claude mcp add code-context npx -y vlm-code-context-mcp ./context.db
```

Three commands. Zero API keys. One `context.db` file.

</div>

---

## Why

AI coding tools burn through context windows reading raw source files, then lose everything when the session ends. Every new conversation starts from scratch.

| | Without | With |
|---|---|---|
| **Tokens per task** | ~314K | ~189K **(40% less)** |
| **Tool calls** | 52 avg | 35 avg **(32% less)** |
| **Session memory** | None | Full SQLite persistence |
| **Process** | Ad hoc | Sprint ceremonies + QA gates |

![benchmark](https://github.com/user-attachments/assets/e553c734-ebc0-4e9e-8efb-5f79ab010d3e)

---

## Quick Start

**1 · Install**

```bash
npm install vlm-code-context-mcp
```

**2 · Initialize**

```bash
npx code-context-mcp setup .
```

Creates `context.db`, indexes your codebase, seeds a 7-agent team, and writes `.mcp.json`.

**3 · Restart your AI client**

Restart Claude Code (or any MCP client). Verify with `get_project_status`.

**4 · Launch the dashboard**

```bash
npx code-context-dashboard ./context.db
```

Opens at `http://localhost:3333` with live SSE updates. To also auto-reindex on file save:

```bash
npx code-context-dashboard ./context.db 3333 .
```

**5 · Run your first sprint**

Type in Claude Code:

```
/kickoff
```

The orchestrator walks you through vision → discovery → milestone → epics → tickets → sprint → implementation → retro — one question at a time. Smart resume lets you stop and pick up later.

---

## Dashboard

**7 pages. Live SSE updates. Zero polling.**

<img width="3840" height="2585" alt="Dashboard overview showing sprint board with kanban, phase stepper, and completion checklist" src="https://github.com/user-attachments/assets/52e2fbca-1e65-4ec9-a0fe-f11f000b1510" />

| Page | What it shows |
|---|---|
| **Dashboard** | Kanban board, phase gate stepper, burndown, velocity, sprint checklist |
| **Planning** | Milestone tracker, epic progress, discovery pipeline |
| **Code** | File tree, dependency graph, export/import map, change history |
| **Team** | Agent cards, model badges, mood trends, workload bars |
| **Retro** | Bento grid insights, cross-sprint patterns, recurring themes |
| **Benchmark** | MCP vs Vanilla comparison with animated metrics |
| **Velocity** | Sprint-by-sprint trends, committed vs completed |

Every database mutation triggers an instant refresh via SQLite WAL monitoring.

---

## Slash Commands

Type these directly in Claude Code.

| Command | What it does |
|---|---|
| `/kickoff` | Full guided lifecycle — vision to retro. **Start here.** |
| `/sprint` | Sprint-only loop — plan → implement → QA → retro → archive |
| `/ticket` | Move tickets through their lifecycle with full context |
| `/milestone` | Create, update, close milestones with epic verification |
| `/retro` | Data-backed retrospectives with burndown + velocity analysis |
| `/sprint-connect` | Bridge the dashboard UI to your Claude session |

---

## How It Works

Every command follows the same pattern: **load context from the database before doing anything.**

```
search_files("auth middleware")       → find the right file
get_file_context("src/auth.ts")      → understand role, exports, dependents
Read("src/auth.ts")                  → only now read the actual code
```

No agent holds the full project in its context window. They query what they need from a shared SQLite brain and write results back.

```
┌─────────────────────────────────────────────────────┐
│               Claude Code / MCP Client              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ /kickoff │  │ /sprint  │  │ /ticket  │  ...     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       └──────────────┼─────────────┘                │
│                      ▼                              │
│              76 MCP Tools                           │
│          (32 read + 44 write)                       │
│                      │                              │
│                      ▼                              │
│  ┌─────────────────────────────────────┐            │
│  │       context.db (SQLite)           │            │
│  │  30 tables · WAL mode · <5ms reads  │            │
│  └──────────────────┬──────────────────┘            │
│                     │ WAL watcher                   │
│                     ▼                               │
│  ┌─────────────────────────────────────┐            │
│  │    React Dashboard (Vite)           │            │
│  │  62 components · SSE live updates   │            │
│  └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

---

## The Agent Team

7 configurable agents, each with a role, model, and mood score.

| Role | Model | Focus |
|---|---|---|
| Product Owner | Opus 4.6 | Vision, priorities, stakeholder alignment |
| Scrum Master | Sonnet 4.6 | Sprint facilitation, process improvement |
| Lead Developer | Opus 4.6 | Architecture, complex implementations |
| Backend Developer | Sonnet 4.6 | APIs, database, server logic |
| Frontend Developer | Sonnet 4.6 | Dashboard components, UI/UX |
| QA Engineer | Sonnet 4.6 | Testing, verification, quality gates |
| DevOps | Haiku 4.5 | CI/CD, builds, deployment |

Add, remove, or swap models through MCP tools or with a single click in the dashboard.

---

## Sprint Process

4 phases with enforced gate checks:

```
planning → implementation → done → rest
```

| Phase | Duration | Gate |
|---|---|---|
| **Planning** | 1 day | Tickets assigned, velocity committed |
| **Implementation** | 3 days | All tickets DONE or NOT_DONE, blockers resolved |
| **Done** | 0.5 day | Retro findings recorded, QA verified |
| **Rest** | 0.5 day | Automatic after retro |

Phases, durations, and gates are fully customizable via `update_sprint_config`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 LTS |
| Database | SQLite via better-sqlite3, WAL mode |
| MCP protocol | @anthropic-ai/sdk |
| Dashboard | React 19 + Vite + Zustand + Framer Motion |
| Styling | CSS variables + Tailwind, dark theme |
| Live updates | SSE via WAL file watcher |
| Testing | Vitest |
| Build | TypeScript strict mode |

---

## Engine Numbers

| Component | Count |
|---|---|
| MCP tools | 76 (32 read + 44 write) |
| Database tables | 30 (25 scrum + 5 code) |
| React components | 62 |
| Agent roles | 7 (configurable) |
| Sprint phases | 4 with gate checks |
| Slash commands | 6 |

---

## Manual MCP Server Setup

If the automatic `.mcp.json` setup doesn't work:

```bash
# Add to current project
claude mcp add code-context npx -y vlm-code-context-mcp ./context.db

# Add globally
claude mcp add --scope user code-context node /path/to/node_modules/vlm-code-context-mcp/dist/server/index.js ./context.db

# Remove
claude mcp remove code-context
```

---

## Development

```bash
# MCP server
npm run dev

# Dashboard (Vite dev server with HMR)
npm run dashboard:dev
```

---

## License

MIT
