# vlm-code-context-mcp

**Your AI agents forget everything between sessions. This fixes that.**

A Node.js MCP server that gives AI coding agents persistent memory, structured project context, and a full scrum process — so they stop re-reading your entire codebase every conversation.

```bash
# cd /path/to/your/project
npm install vlm-code-context-mcp

npx code-context-mcp setup .

claude mcp add code-context npx -y vlm-code-context-mcp ./context.db 

npx code-context-dashboard ./context.db
```

Three commands. Zero API keys. Everything lives in a single `context.db` file.

---

## The Problem

AI coding tools burn through context windows reading raw source files, then lose everything when the session ends. Every new conversation starts from scratch — no memory of what was built, what failed, or what's next.

**Without this tool:**
- Agent burns ~314K tokens per task exploring with Grep/Read
- 52 tool calls avg — most spent discovering file structure
- No continuity between sessions
- No process, no tracking, no quality gates

**With this tool:**
- Agent uses ~189K tokens per task with structured context lookups (**40% fewer tokens**)
- 35 tool calls avg — targeted queries replace exploratory reads (**32% fewer calls**)
- Full project state persists in SQLite across sessions
- Sprint ceremonies, QA gates, velocity tracking built in

---

## Complete Setup (5 minutes)

### 1. Install

```bash
npm install vlm-code-context-mcp
```

Installs the MCP server, React dashboard, and all 93 tools. No API keys, no cloud accounts.

### 2. Initialize your project

```bash
npx code-context-mcp setup .
```

This creates `context.db`, indexes your codebase (files, exports, dependencies), seeds the default team (7 agents), and writes `.mcp.json` so your AI client finds the server.

```
=== Code Context MCP — Setup (my-project) ===

[1/4] Initializing database...
[2/4] Indexing target directory...
  Indexed 201 files, 347 exports, 89 dependencies.
[3/4] Seeding factory defaults...
  Seeded 7 agents, 5 skills
[4/4] Configuring MCP client...
  Wrote .mcp.json

=== Setup complete! ===
```

### 3. Restart your AI client

Restart Claude Code (or any MCP client). This loads the 93 tools. Verify:

> "Call `get_project_status`"

Should respond with your file count, agent count, and "Project is set up and ready."

### 4. Open the dashboard

```bash
npx code-context-dashboard ./context.db
```

Opens at `http://localhost:3333`. The dashboard updates live — every MCP tool call triggers an instant UI refresh via SSE.

To also auto-reindex when you save files on disk:

```bash
npx code-context-dashboard ./context.db 3333 .
```

### 5. Run your first sprint

Type in Claude Code:

```
/kickoff
```

The orchestrator walks you through vision, discovery, milestone, epics, tickets, and launches your first sprint — one question at a time. Smart resume means you can stop and pick up later.

### Manual MCP Server Setup

If the automatic `.mcp.json` setup doesn't work, or you want to add the server to a specific Claude Code project manually:

```bash
# Add to current project (recommended)
claude mcp add code-context node /path/to/node_modules/vlm-code-context-mcp/dist/server/index.js ./context.db

# Or with npx (no global install needed)
claude mcp add code-context npx -y vlm-code-context-mcp ./context.db

# Add globally (available in all projects)
claude mcp add --scope user code-context node /path/to/node_modules/vlm-code-context-mcp/dist/server/index.js ./context.db
```

After adding, restart Claude Code and verify with `get_project_status`.

To remove:

```bash
claude mcp remove code-context
```

---

## Slash Commands

Six built-in commands for Claude Code. Type these directly in your session.

### `/kickoff` — Full guided lifecycle (start here)

Interactive walkthrough from zero to sprint complete. Claude asks one question at a time, executes MCP tools, and enforces all QA gates.

**Phases:** vision → discovery → milestone → epics → tickets → sprint → implementation → retro → archive

**Smart resume:** Detects existing state and picks up where you left off.

### `/sprint` — Sprint-only (repeat cycles)

Already have vision, milestone, and epics? Skip straight to sprint planning.

**Phases:** plan → implement → QA verify → retro → rest → archive

### `/ticket` — Ticket management

Move tickets through their lifecycle. Loads full ticket context, related code files, and dependency graph before acting.

### `/milestone` — Milestone management

Create, update, and close milestones. Verifies all epics are complete before closing.

### `/retro` — Retrospective

Data-backed retrospectives using burndown, mood trends, and velocity data. Surfaces recurring patterns across sprints.

### `/sprint-connect` — Bridge UI to Claude

Connects the dashboard to your Claude session. Button clicks in the UI become MCP tool calls in your terminal.

---

## Context-First Architecture

Every command follows the same pattern: **load context from the database before doing anything.** This is what makes the system work with small context windows.

```
Step 0a: index_directory() + search_files()     ← codebase map
Step 0b: get_project_status() + list_sprints()   ← project state
         list_agents() + get_velocity_trends()   ← team + capacity
         analyze_retro_patterns()                ← lessons learned
Step 0c: command-specific reads                  ← deep context
Step 0d: display smart summary with anomalies    ← user visibility
```

The MCP database is the shared brain. Agents pull from it, act, and write back. No agent needs to hold the full project in its context window — they query what they need.

**Before reading any source file, agents check the code context DB first:**

```
search_files("auth middleware")     → find the right file
get_file_context("src/auth.ts")    → understand role, exports, dependents
Read("src/auth.ts")                → only now read the actual code
```

This replaces "read everything and hope for the best" with "query the map, then read the territory."

---

## The Dashboard

**7 pages. Live SSE updates. Zero polling.**

Every database mutation triggers an instant refresh via SQLite WAL monitoring.

<img width="3840" height="2585" alt="Dashboard overview showing sprint board with kanban, phase stepper, and completion checklist" src="https://github.com/user-attachments/assets/52e2fbca-1e65-4ec9-a0fe-f11f000b1510" />

| Page | What it shows |
|---|---|
| **Dashboard** | Kanban board, phase gate stepper, burndown chart, velocity metrics, sprint completion checklist |
| **Planning** | Milestone tracker, epic progress, discovery pipeline |
| **Code** | File tree, dependency graph, export/import map, change history |
| **Team** | Agent cards with model badges, mood trends, workload bars |
| **Retro** | Bento grid insights, cross-sprint patterns, recurring themes |
| **Benchmark** | MCP vs Vanilla comparison with animated metric bars, savings %, and reasoning |
| **Velocity** | Sprint-by-sprint velocity trends, completion rates, committed vs completed |

### Running the dashboard in development

If you're contributing to the project:

```bash
# Terminal 1: MCP server
npm run dev

# Terminal 2: Dashboard (Vite dev server with HMR)
npm run dashboard:dev
```

The Vite dev server runs on `http://localhost:5173` with hot module replacement.

---

## Why This Exists

### Persistent memory across sessions

The `context.db` file survives session resets. Sprint state, retro findings, velocity trends, team mood — everything persists. A fresh agent can run `/kickoff` and immediately know: what was built, what failed, what's next.

### Small context windows, big projects

Each agent reads structured metadata (summaries, export lists, dependency graphs) instead of raw source. The database acts as external memory — agents query what they need instead of loading everything.

### Process that actually works

Sprint ceremonies aren't bureaucracy — they're guard rails. QA gates prevent shipping unverified work. Retro patterns prevent repeating mistakes. Velocity trends prevent overcommitting.

### Real-time visibility

The dashboard isn't a reporting tool. It's a live view of what's happening. Every MCP tool call updates the UI instantly. You see tickets move, phases advance, and gates clear in real time.

---

## The Agent Team

| Role | Model | Responsibility |
|---|---|---|
| Product Owner | Opus 4.6 | Vision, priorities, stakeholder alignment |
| Scrum Master | Sonnet 4.6 | Sprint facilitation, process improvement |
| Lead Developer | Opus 4.6 | Architecture decisions, complex implementations |
| Backend Developer | Sonnet 4.6 | API endpoints, database, server logic |
| Frontend Developer | Sonnet 4.6 | Dashboard components, UI/UX |
| QA Engineer | Sonnet 4.6 | Testing, verification, quality gates |
| DevOps | Haiku 4.5 | CI/CD, build automation, deployment |

Agents are fully configurable — add, remove, or modify roles through MCP tools. Each agent carries a mood score computed from workload and retrospective sentiment. Models can be changed per agent with a single click in the dashboard.

---

## Sprint Process

Sprints follow 4 phases with gate checks:

```
planning → implementation → done → rest
```

| Phase | Duration | Gate to advance |
|---|---|---|
| **Planning** | 1 day | Tickets assigned, velocity committed |
| **Implementation** | 3 days | All tickets DONE or NOT_DONE, blockers resolved |
| **Done** | 0.5 day | Retro findings recorded, QA verified |
| **Rest** | 0.5 day | Automatic after retro |

Phases, durations, and gate criteria are fully customizable via the `update_sprint_config` MCP tool.

---

## MCP vs Vanilla Benchmark

We ran the same 3 tasks twice — once with MCP tools for context, once without (vanilla Grep/Read/Glob only). Same codebase, same goals, same model.


![benchmark](https://github.com/user-attachments/assets/2e76e697-4a46-4c58-a168-4d8792500ad9)

![bench2](https://github.com/user-attachments/assets/13f8c5dc-79fb-416c-96a0-ad79dbd6ab1e)

![bench3](https://github.com/user-attachments/assets/a6bdec34-e4f3-4efc-8ba8-7e9b4e2b9938)

### Results by task size

| Task | Size | MCP Time | Vanilla Time | MCP Tokens | Vanilla Tokens | Time Saved | Tokens Saved |
|---|---|---|---|---|---|---|---|
| Add compact flag | 2pt | 12m | 22m | 48K | 84K | **45%** | **42%** |
| Add MCP tool + tests | 3pt | 25m | 45m | 134K | 237K | **44%** | **43%** |
| Dashboard page + SSE | 5pt | 35m | 52m | 385K | 620K | **33%** | **38%** |

### Why MCP wins

**Small tasks** — `search_files` and `get_file_context` pinpoint the exact file and its test in 2 lookups. Vanilla needs 5+ extra tool calls just to locate the right file and understand the parameter schema.

**Medium tasks** — `index_directory` provides the full dependency graph upfront (exports, imports, summaries). Vanilla reads 4 files sequentially to understand registration patterns. 9 targeted context lookups replace ~15 exploratory reads.

**Large tasks** — `load_phase_context` and `search_files` reveal the entire dashboard architecture (page patterns, store conventions, routing, SSE wiring, server endpoints) in ~14 lookups. Vanilla needs 12+ sequential Grep/Read calls just to discover how pages are wired across 7 integration points.

### Aggregate benchmark stats

Measured across 3 tasks (10pts total) on a 211-file, 32K-line codebase:

| Metric | MCP | Vanilla | Improvement |
|---|---|---|---|
| Total tokens | 567K | 941K | **40% fewer** |
| Total tool calls | 106 | 156 | **32% fewer** |
| Total time | 72 min | 119 min | **40% faster** |
| Avg tokens/task | 189K | 314K | **1.7x less** |
| Avg tool calls/task | 35 | 52 | **1.5x fewer** |

The savings come from replacing exploratory Grep/Read loops with targeted `search_files` and `get_file_context` queries that return structured metadata. The larger the task, the more exploration overhead MCP eliminates.

---

## Technical Details

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Claude Code / MCP Client                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ /kickoff │  │ /sprint  │  │ /ticket  │  ...      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       └──────────────┼─────────────┘                │
│                      ▼                              │
│              76 MCP Tools                           │
│       (32 read + 44 write)                          │
│                      │                              │
│                      ▼                              │
│  ┌─────────────────────────────────────┐            │
│  │         context.db (SQLite)         │            │
│  │  30 tables · WAL mode · <5ms reads  │            │
│  └──────────────────┬──────────────────┘            │
│                     │ WAL watcher                   │
│                     ▼                               │
│  ┌─────────────────────────────────────┐            │
│  │      React Dashboard (Vite)         │            │
│  │  58 components · SSE live updates   │            │
│  └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

### Engine numbers

| Component | Count |
|---|---|
| MCP tools | 76 (32 read + 44 write) |
| Database tables | 30 (25 scrum + 5 code) |
| React components | 62 |
| Agent roles | 7 (configurable) |
| Source files | 211 |
| Sprint phases | 4 with gate checks |
| Slash commands | 6 |

### Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 LTS |
| Database | SQLite via better-sqlite3, WAL mode |
| MCP protocol | @anthropic-ai/sdk |
| Dashboard | React 19 + Vite + Zustand + Framer Motion |
| Styling | CSS variables + Tailwind, dark theme |
| Live updates | SSE via WAL file watcher |
| Testing | Vitest (backend + frontend) |
| Build | TypeScript strict mode |

### Database schema highlights

- **Sprints** — id, name, goal, status, velocity_committed/completed, dates
- **Tickets** — id, ref, title, priority, status, assigned_to, story_points, qa_verified
- **Agents** — role, name, model, mood, active/done/blocked ticket counts
- **Retro findings** — category (went_well/went_wrong/try_next), finding, action_owner
- **File index** — path, language, line_count, exports, imports, summary
- **Audit trail** — every state change logged with old/new values

### Bridge layer

`src/bridge/` implements a `PreToolUse` hook connecting Claude Code to the dashboard bidirectionally:

| SSE Event | Fires when |
|---|---|
| `updated` | Any DB mutation (WAL watcher) |
| `bridge_action` | Dashboard queues an action |
| `input_requested` | MCP tool requests user input |
| `response_ready` | User submits wizard form |
| `step_progress` | Agent reports progress |
| `claude_output` | Agent streams output |

---

## Key Learnings

Built entirely through its own scrum process — 8 sprints, 3 milestones, 77 tickets shipped.

<img width="1922" height="968" alt="Retro insights showing cross-sprint patterns and recurring themes" src="https://github.com/user-attachments/assets/4b1059e1-e1d8-43b2-99af-f62ca504a74b" />

**What works:**
- **Discovery-first** — spiking approaches before coding eliminates wasted implementation
- **Context-first commands** — agents load from DB before acting, never assume state
- **SSE + WAL watcher** — every mutation triggers instant UI updates, no polling
- **Gate checks** — QA verification is mandatory, not optional
- **Retro patterns** — recurring findings surface automatically across sprints

**What we learned the hard way:**
- Mood tracking catches burnout before it causes quality drops
---

## License

MIT
