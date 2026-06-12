<div align="center">

# vlm-code-context-mcp

### Persistent memory for AI coding agents.

**Your agents forget everything between sessions. This fixes that.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/vlm-code-context-mcp.svg)](https://www.npmjs.com/package/vlm-code-context-mcp)
[![npm downloads](https://img.shields.io/npm/dt/vlm-code-context-mcp.svg)](https://www.npmjs.com/package/vlm-code-context-mcp)

```bash
npm install vlm-code-context-mcp
npx code-context-mcp setup .
npx code-context-dashboard ./context.db   # optional — live dashboard on :3333
```

Two commands, then restart Claude Code — `setup` writes `.mcp.json`, so the server loads automatically. Zero API keys. One `context.db` file.

</div>

---

## Benchmark

Tested across 10 real development tasks (retrieval, debugging, refactoring, implementation), then validated with 200 randomized trials and a Wilcoxon signed-rank test.

| | MCP | Vanilla | Saved |
|---|---|---|---|
| **Tokens** | 4,806 | 8,726 | **44.9%** |
| **Tool calls** | 49 | 68 | **27.9%** |
| **Stochastic win rate** | — | — | **90.5%** (p < 0.001) |

MCP tools return structured summaries (exports, deps, file role) instead of raw file content. Agents read less, know more. (Re-validated for v2.0.0 — and since 2.0, sprint ceremonies themselves cost **−39% output tokens** via compact-by-default tools, measured on a replayed kickoff.)

<img width="1239" height="716" alt="benchmark2" src="https://github.com/user-attachments/assets/97662418-e16b-4c12-9d32-66546d3f95b7" />


<details>
<summary>Reproduce it yourself</summary>

```bash
# Deterministic — 10 tasks, 6 categories
npm test -- test/benchmark.test.ts

# Stochastic — 200 randomized trials, Wilcoxon test, bootstrap CI
npm test -- test/benchmark-stochastic.test.ts
```

Full methodology in [BENCHMARK-GUIDE.md](BENCHMARK-GUIDE.md).
</details>

---

## New in 2.2 — Discipline & Telemetry 📐

- **Commit contract, injected and enforced** — delegated implementation prompts carry the `Why:/What:/How:` commit-body contract (derived live from the `wf:write-commit-messages` skill), and `update_ticket` refuses `qa_verified` while a ticket's commits don't follow it — offending hashes named, docs-only tickets exempt, always fail-open.
- **Telemetry without ceremony** — closing a ticket auto-snapshots the burndown and can log `actual_hours` against the assigned agent; phase transitions snapshot too. Retros quote real numbers instead of `0h`.
- **Leaner internals** — `tools.ts` and `dashboard.ts` both decomposed into domain modules (dashboard server −37%), with byte-identical tool/route surfaces pinned by mutation-verified parity tests.
- **Claude Fable 5 tier** — dev roles default to `claude-fable-5`; ticket routing gains the `fable` tier.

---

## New in 2.0 — Process 2.0 🚦

- **Planning gates that close the retro loop** — sprints refuse to start while retro `try_next` learnings sit untriaged; adopt, drop, or defer each one (`triage_retro_finding`), and adopted items auto-flag as applied when their ticket lands.
- **Honest velocity** — commitment freezes when implementation starts; mid-sprint scope shows as `+added / removed` instead of inflating completion rates.
- **Terminal cockpit** — tools render width-locked progress cards in colored ```diff fences, and the `code-context-statusline` bin puts a live sprint HUD in Claude Code's status line at zero token cost.
- **Live-editable board + session reaction** — edit tickets on the dashboard; the Claude session sees a `⚠ CHANGED TICKETS` diff block and acknowledges your changes.
- **Multi-agent tickets** — several agents per ticket with per-assignment model overrides: the lead implements, supporters verify in parallel, QA aggregates the verdicts.

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

Creates `context.db`, indexes your codebase, seeds a 9-agent team, seeds the frontend skill library into the project database, writes `.mcp.json`, and offers to wire the sprint statusline into `.claude/settings.json` (pass `--defaults` to skip the prompts). Run it again later and it switches to **update mode** — migrate (with automatic backup) + config repair, never touching your data; `--force` renames the old database instead of deleting it.

**3 · Restart your AI client**

Restart Claude Code (or any MCP client) — it picks the server up from the `.mcp.json` that setup wrote. Verify with `get_project_status`.

> Registering manually instead? The equivalent is
> `claude mcp add code-context -- node node_modules/vlm-code-context-mcp/dist/server/index.js ./context.db`

**4 · Launch the dashboard**

```bash
npx code-context-dashboard ./context.db
```

Opens at `http://localhost:3333` with live SSE updates. File watching + auto-reindex on save are on by default (derived from the indexed files); pass a directory as the 4th argument only to override it — e.g. on a database that has nothing indexed yet:

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

Every database mutation triggers an instant refresh via SQLite WAL monitoring. Since 2.0 the board is **live-editable** — title, description, points, status, and multi-agent assignments (with per-assignment models) — and every edit raises a change flag the Claude session sees and acknowledges at its next context load. Completion stays earned: the UI can never set DONE or `qa_verified`.

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

> `/kickoff` auto-loads the frontend skill playbook into the session when a sprint has `fe-engineer` work — pull any skill's full guidance with `get_skill`.

---

## Skill Sets (server-provided)

The server ships three predefined skill libraries — **Frontend** (22 skills: React 19 / Vue 3 scaffolding, routing, state, forms, auth, i18n, testing, accessibility, performance, design systems, motion, PWA, plus an editable **house-style primer**), **Landing pages** (structure, SEO, lead capture, content audits), and **Workflow** (write-pull-requests, write-commit-messages).

Unlike a plugin, these are **served by the MCP server into your live session**, not copied into your repo. `/kickoff` asks once which sets to enable (frontend is on by default; `update_skill_sets` changes it any time). When a sprint has `fe-engineer` work, `load_phase_context` injects the house-style primer and the enabled skill indexes — workflow skills inject for every implementer; your agent then pulls any skill's full guidance on demand with `get_skill({ name })`. No restart, no files to manage.

| | |
|---|---|
| Source | [`claude_development_skills`](https://github.com/VelimirMueller/claude_development_skills) — vendored under `vendor/skills/` (build input) |
| Storage | seeded into the project DB `skills` table (`fe:*`, `la:*`, `wf:*`); **edit them to make them yours** — re-seeds never overwrite your edits |
| Opt-in | `/kickoff` Phase 1b asks once; `update_skill_sets({ landing: true, ... })` any time |
| Trigger | fe/la on `fe-engineer` tickets, wf on any implementation work during `/kickoff` |
| Load | index + primer up front; full body via `get_skill({ name })` |
| Update | boot-time auto-sync from the latest upstream release; `npm run sync:skills` re-vendors the offline fallback |

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
│              97 MCP Tools                           │
│      (reads · writes · ceremony cards)              │
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

9 configurable agents, each with a role, model, and mood score. Dev roles default to the strongest model (`claude-fable-5`), QA to `claude-opus-4-8`; the rest use `claude-sonnet-4-6`.

| Role | Focus |
|---|---|
| Product Owner | Vision, priorities, stakeholder alignment |
| Team Lead | Coordination, code review, quality |
| Architect | System design, technology decisions, structural integrity |
| Backend Developer | APIs, database, server logic |
| Frontend Developer | Dashboard components, UI/UX |
| Developer | Full-stack features across frontend and backend |
| QA Engineer | Testing, verification, quality gates |
| Security Engineer | Vulnerability review, threat modeling, security best practices |
| DevOps | CI/CD, builds, deployment |

Add, remove, or swap models through MCP tools or with a single click in the dashboard — and the choice **routes execution**: during `/kickoff` and `/sprint`, each ticket is implemented by a subagent spawned at its assigned agent's model tier (`fable`/`opus`/`sonnet`/`haiku`).

Since 2.0, tickets can carry **multiple agents with per-assignment model overrides**: the lead implements, supporting agents verify the diff in parallel from their role's perspective, and the QA gate requires every verdict before a ticket counts as done.

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

Since 2.0, planning is **gated**: `start_sprint` and `advance_sprint` refuse to proceed while untriaged retro `try_next` findings or escalated open discoveries (P0/P1 older than 3 sprints) exist — triage them, or override explicitly with `acknowledge_open_items: true`. Retro learnings stop being write-only.

Since 2.2, the QA gate also checks **commit discipline**: a ticket can't reach `qa_verified` while its referencing commits lack the `Why:/What:/How:` body groups — and closes feed the burndown automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 LTS |
| Database | SQLite via better-sqlite3, WAL mode |
| MCP protocol | @modelcontextprotocol/sdk |
| Dashboard | React 19 + Vite + Zustand + Framer Motion |
| Styling | CSS variables + Tailwind, dark theme |
| Live updates | SSE via WAL file watcher |
| Testing | Vitest |
| Build | TypeScript strict mode |

---

## Engine Numbers

| Component | Count |
|---|---|
| MCP tools | 97 |
| Database tables | 32 (27 scrum + 5 code) |
| React components | 75 |
| Tests | 762 (677 backend + 85 frontend) |
| Agent roles | 9 (configurable) |
| Sprint phases | 4 with gate checks + planning gate |
| Slash commands | 6 |
| CLI bins | 3 (`code-context-mcp`, `code-context-dashboard`, `code-context-statusline`) |

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
