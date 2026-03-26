# code-context-mcp

[![CI](https://github.com/VelimirMueller/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/VelimirMueller/mcp-server/actions/workflows/ci.yml)

AI agents waste most of their context window reading raw source files just to understand what a codebase does. This MCP server pre-indexes your project into a SQLite database so agents can query structured metadata instead — **3x fewer tokens, 8x less data, instant answers.**

```
npx code-context-mcp .
```

That's it. Your codebase is indexed, `.mcp.json` is configured, and your AI client has 10 tools to query files, exports, dependencies, changes, and directory metadata — without ever reading a single source file. With a `.claude/` directory present, 25 additional scrum management tools activate.

## The problem

Every time an AI agent needs to understand your codebase, it reads files. All of them. A 25-file project burns ~62K tokens just to answer "what does the server directory do?" With pre-indexed metadata, the same answer costs ~20K tokens. The gap widens with larger codebases.

## How it works

1. **Index once** — the indexer walks your project, parses JS/TS imports and exports, extracts summaries from comments and JSDoc, builds a dependency graph, and generates descriptions for every file and directory.
2. **Query many times** — AI agents use MCP tools to get structured answers: file context, symbol lookups, dependency edges, change history with reasons — all pre-computed.
3. **Stay current** — the dashboard watches for file changes and re-indexes automatically. Descriptions persist across re-indexes.

## Architecture

Three integrated components form the system:

**MCP Server** (`src/server/`) — TypeScript parser indexes files, exports, imports, and dependencies into SQLite. Ten MCP tools expose structured metadata to AI agents, replacing raw file reads.

**Scrum System** (`src/scrum/`) — 10 database tables covering the full sprint lifecycle. 25 MCP tools for sprint, ticket, milestone, retro, blocker, and bug management. Imports from a `.claude/` directory structure.

**React Dashboard** (`src/dashboard/`) — Vite + React 18 + Tailwind CSS frontend with Framer Motion animations, served by a Node.js HTTP server. Five Zustand stores manage file, sprint, agent, planning, and UI state.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full component hierarchy, API endpoint reference, and build pipeline.

## MCP Tools (35 total: 10 code-context + 25 scrum)


| Tool                        | What it does                                                             |
| --------------------------- | ------------------------------------------------------------------------ |
| `index_directory`           | Scan a directory, build the full index                                   |
| `find_symbol`               | Find which files export a given function, type, or constant              |
| `get_file_context`          | Full file context: summary, exports, imports, dependents, change history |
| `set_description`           | Set a human-written description for a file (persists across re-indexes)  |
| `set_directory_description` | Set a description for a directory                                        |
| `set_change_reason`         | Annotate a recorded change with a reason                                 |
| `get_changes`               | View recent file changes with diffs and reasons                          |
| `search_files`              | Search files by path or summary                                          |
| `query`                     | Read-only SQL against the database                                       |
| `execute`                   | Write SQL (INSERT/UPDATE/DELETE)                                         |

## Setup

```bash
# Install globally
npm install -g vlm-code-context-mcp

# Or run directly
npx code-context-mcp /path/to/your/project
```

This will:

- Create `context.db` in your project root
- Index all files, exports, dependencies, and directories
- Auto-generate descriptions for every file and folder
- Write `.mcp.json` so your AI client picks up the tools

## Dashboard

```bash
npx code-context-dashboard ./context.db
```

Opens at `http://localhost:3333` with a landing page and two main sections:

**Code Explorer:**

- Folder tree sidebar with expandable directories
- File detail panel: exports, packages, imports, dependents, folder metadata
- Change history with inline diffs and reasons
- Dependency graph that filters to the selected file's connections
- Keyboard shortcuts: Cmd+K search, arrow navigation, hash routing for state persistence
- Live reload — watches for file changes and re-indexes automatically

**Sprint Process** (when `.claude/` directory is present):

- Sprint Board: sprint cards with velocity bars and process health checklist, kanban board (TODO/IN_PROGRESS/DONE/BLOCKED columns), planning view, QA view, retro view
- Project Planning: velocity trend chart across all sprints, Gantt-style milestone timeline, milestones detail, product vision
- Team: agent cards with health indicators, mood scores (computed from ticket load + retro sentiment), workload bars

## Agent Team (9 roles)

When a `.claude/agents/` directory is present, the scrum MCP service loads the team:


| Role                | Responsibility                                         |
| ------------------- | ------------------------------------------------------ |
| Product Owner       | Vision, milestones, tickets                            |
| Scrum Master        | Blockers, process, sprint health                       |
| Manager             | Cost efficiency, anti-overengineering                  |
| Lead Developer      | Conflict resolution, code quality                      |
| Backend Developer   | APIs, services, database                               |
| Frontend Developer  | UI, dashboard, styling                                 |
| Architect           | Infrastructure, CI/CD, system design                   |
| QA Engineer         | Testing, bug verification, quality gate                |
| Security Specialist | Vulnerability audit, input validation, secure defaults |

## What gets indexed

- **Files** — path, language, size, line count, summary, auto-generated description, content
- **Exports** — name and kind (function, const, type, class, interface)
- **Dependencies** — which file imports what from which file, with symbol names
- **Directories** — file count, total lines, size, language breakdown, description
- **Changes** — append-only log of add/change/delete events with before/after snapshots, inline diffs, and reasons

## Context efficiency

Tested on this project (25 files, 7K lines):


| Metric               | With MCP  | Without MCP |
| -------------------- | --------- | ----------- |
| Tokens per analysis  | ~20K      | ~62K        |
| Raw data transferred | ~6K chars | ~111K chars |
| Tool calls           | 7         | 16          |

The first index costs more (you need to read files to generate metadata). Every subsequent query is 3x cheaper. Break-even after ~2 uses.

## Schema reference

### Code context tables


| Table          | Columns                                                                                                                     | Purpose                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `files`        | path, language, extension, size_bytes, line_count, summary, description, external_imports, content, created_at, modified_at | Every indexed file             |
| `exports`      | file_id, name, kind (function/class/type/interface/enum/const/re-export)                                                    | Named exports from JS/TS files |
| `dependencies` | source_id, target_id, symbols                                                                                               | Import edges between files     |
| `directories`  | path, name, parent_path, depth, file_count, total_size_bytes, total_lines, language_breakdown, description                  | Directory-level aggregates     |
| `changes`      | file_path, event (add/change/delete), timestamp, old/new summary/lines/size/exports, diff_text, reason                      | Append-only change log         |

### Scrum tables


| Table            | Columns                                                                                                             | Purpose                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `agents`         | role, name, description, model, tools, system_prompt                                                                | Team agent definitions        |
| `sprints`        | name, goal, start_date, end_date, status, velocity_committed/completed                                              | Sprint tracking               |
| `tickets`        | sprint_id, ticket_ref, title, priority (P0-P3), status, assigned_to, story_points, qa_verified, acceptance_criteria | User stories                  |
| `subtasks`       | ticket_id, description, status, assigned_to                                                                         | Task breakdown                |
| `retro_findings` | sprint_id, role, category (went_well/went_wrong/try_next), finding, action_owner                                    | Retrospective items           |
| `blockers`       | sprint_id, ticket_id, description, status (open/resolved)                                                           | Impediments                   |
| `bugs`           | sprint_id, ticket_id, severity, description, status (open/fixed/deferred)                                           | Defects                       |
| `skills`         | name, content, owner_role                                                                                           | Team knowledge docs           |
| `processes`      | name, content, version                                                                                              | Versioned process definitions |

## Scrum MCP tools

In addition to the 10 code context tools, the server exposes 25 scrum management tools when a `.claude/` directory is present:


| Tool                  | Type  | What it does                                         |
| --------------------- | ----- | ---------------------------------------------------- |
| `list_agents`         | Read  | List all scrum team agents                           |
| `get_agent`           | Read  | Get agent details by role                            |
| `list_sprints`        | Read  | List sprints with ticket counts                      |
| `get_sprint`          | Read  | Full sprint details (tickets, bugs, blockers, retro) |
| `list_tickets`        | Read  | Filter tickets by sprint, status, assignee           |
| `get_ticket`          | Read  | Ticket details with subtasks and linked bugs         |
| `list_retro_findings` | Read  | Filter retro findings by sprint, category            |
| `search_scrum`        | Read  | Full-text search across scrum data                   |
| `create_sprint`       | Write | Create a new sprint                                  |
| `update_sprint`       | Write | Update sprint status/velocity                        |
| `create_ticket`       | Write | Add a ticket to a sprint                             |
| `update_ticket`       | Write | Change ticket status, assignment, QA sign-off        |
| `add_retro_finding`   | Write | Add a retrospective finding                          |
| `create_blocker`      | Write | Report a blocker                                     |
| `resolve_blocker`     | Write | Mark blocker as resolved                             |
| `log_bug`             | Write | Log a bug with severity                              |
| `sync_scrum_data`     | Write | Re-import from .claude/ directory                    |
| `export_sprint_report`| Read  | Generate complete markdown sprint report              |
