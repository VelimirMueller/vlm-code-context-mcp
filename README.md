<div align="center">

# vlm-code-context-mcp

**AI-Powered Virtual IT Department via Model Context Protocol**

Your codebase, indexed. Your sprints, managed. Your team, automated.
One MCP server. 42 tools. Zero context waste.

[![CI](https://github.com/VelimirMueller/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/VelimirMueller/mcp-server/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/vlm-code-context-mcp)](https://www.npmjs.com/package/vlm-code-context-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)

</div>

---

## What is this?

Most AI coding assistants burn through context windows reading raw source files just to understand what a codebase does. `vlm-code-context-mcp` eliminates that waste by pre-indexing your entire project into a SQLite database, then exposing structured metadata through the [Model Context Protocol](https://modelcontextprotocol.io). AI agents query files, exports, dependencies, and change history through MCP tools instead of reading source code directly — using 3x fewer tokens and 8x less data.

But code intelligence is only the beginning. This package ships a complete virtual IT department: a 9-role AI scrum team that runs real sprint processes through MCP. Product Owner, Scrum Master, Architect, Backend and Frontend Developers, Lead Developer, QA Engineer, Manager, and Security Specialist — each with defined responsibilities, system prompts, and tool access. Sprints, tickets, retrospectives, blockers, bugs, milestones, and velocity tracking all persist in the same SQLite database and are managed through 32 dedicated MCP tools.

The included React dashboard brings everything together in a single enterprise-grade interface. Built with Vite, React 19, Zustand, Tailwind CSS, and Framer Motion, it provides a code explorer with dependency graphs, a full sprint board with kanban and planning views, project management with Gantt charts and milestone timelines, and a team overview with agent health indicators. Dark theme, keyboard shortcuts, live reload — production-ready out of the box.

## Quick Start

```bash
# Install globally
npm install -g vlm-code-context-mcp

# Or run setup directly
npx code-context-mcp setup .
```

The setup command runs four steps automatically:

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

## Features

<table>
<tr>
<td width="33%" valign="top">

### Code Intelligence

Pre-indexes JS/TS files into SQLite. AI agents query structured metadata — exports, imports, dependency graphs, change history — instead of reading raw source. Break-even after 2 queries.

</td>
<td width="33%" valign="top">

### Virtual Scrum Team

9 AI agent roles with defined responsibilities, system prompts, and tool access. Each agent participates in sprint ceremonies, reviews work, and tracks quality metrics.

</td>
<td width="33%" valign="top">

### Sprint Management

Full lifecycle via MCP: planning, tickets, kanban, retrospectives, blockers, bugs, milestones, and velocity tracking. 42 tools cover every workflow.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### React Dashboard

Vite + React 19 + Zustand + Framer Motion. Code explorer, sprint board, kanban, Gantt charts, team overview. Dark theme, keyboard shortcuts, live reload.

</td>
<td width="33%" valign="top">

### Database Persistence

All state lives in a single SQLite file. Dump and restore the entire database through MCP tools. Progress survives reinstalls, branch switches, and CI runs.

</td>
<td width="33%" valign="top">

### Developer Experience

CLI with `--help`, `--force`, `--name` flags. Onboarding wizard detects missing setup steps. File watcher re-indexes on save. Zero configuration required.

</td>
</tr>
</table>

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     vlm-code-context-mcp                    │
├───────────────────┬───────────────────┬─────────────────────┤
│   MCP Server      │   Scrum System    │   React Dashboard   │
│   src/server/     │   src/scrum/      │   src/dashboard/    │
│                   │                   │                     │
│ - TypeScript      │ - 10 DB tables    │ - 38 components     │
│   parser/indexer  │ - 32 MCP tools    │ - 6 Zustand stores  │
│ - 10 MCP tools    │ - 9 agent roles   │ - Atomic design     │
│ - 5 DB tables     │ - Sprint process  │ - Framer Motion     │
│ - SQLite via      │ - Import/export   │ - Tailwind CSS      │
│   better-sqlite3  │ - Dump/restore    │ - Vite 8 build      │
└───────────────────┴───────────────────┴─────────────────────┘
         │                   │                     │
         └───────────────────┴─────────────────────┘
                    context.db (SQLite)
                      15 tables
```

| Component | Count |
| --- | --- |
| MCP tools | 42 (10 code + 32 scrum) |
| React components | 38 (atoms, molecules, organisms) |
| Zustand stores | 6 (file, sprint, agent, planning, ui, toast) |
| Database tables | 15 (5 code + 10 scrum) |
| Agent roles | 9 |

## MCP Tools (42)

### Code Intelligence (10 tools)

| Tool | Description |
| --- | --- |
| `index_directory` | Scan a directory and build the full index |
| `find_symbol` | Find which files export a given function, type, or constant |
| `get_file_context` | Full file context: summary, exports, imports, dependents, change history |
| `set_description` | Set a human-written description for a file (persists across re-indexes) |
| `set_directory_description` | Set a description for a directory |
| `set_change_reason` | Annotate a recorded change with a reason |
| `get_changes` | View recent file changes with diffs and reasons |
| `search_files` | Search files by path or summary |
| `query` | Read-only SQL against the database |
| `execute` | Write SQL (INSERT/UPDATE/DELETE) |

### Sprint Management (28 tools)

| Tool | Type | Description |
| --- | --- | --- |
| `list_agents` | Read | List all scrum team agents |
| `get_agent` | Read | Get agent details by role |
| `list_sprints` | Read | List sprints with ticket counts |
| `get_sprint` | Read | Full sprint details (tickets, bugs, blockers, retro) |
| `list_tickets` | Read | Filter tickets by sprint, status, assignee |
| `get_ticket` | Read | Ticket details with subtasks and linked bugs |
| `list_retro_findings` | Read | Filter retro findings by sprint, category |
| `search_scrum` | Read | Full-text search across scrum data |
| `export_sprint_report` | Read | Generate complete markdown sprint report |
| `get_backlog` | Read | View backlog items across sprints |
| `get_project_status` | Read | Project health check with metrics |
| `get_sprint_instructions` | Read | Sprint process guide for agents |
| `get_onboarding_status` | Read | Check setup completeness |
| `create_sprint` | Write | Create a new sprint |
| `update_sprint` | Write | Update sprint status and velocity |
| `create_ticket` | Write | Add a ticket to a sprint |
| `update_ticket` | Write | Change ticket status, assignment, QA sign-off |
| `add_retro_finding` | Write | Add a retrospective finding |
| `create_blocker` | Write | Report a blocker |
| `resolve_blocker` | Write | Mark blocker as resolved |
| `log_bug` | Write | Log a bug with severity |
| `sync_scrum_data` | Write | Re-import from .claude/ directory |
| `create_milestone` | Write | Create a project milestone |
| `update_milestone` | Write | Update milestone status and dates |
| `link_ticket_to_milestone` | Write | Associate a ticket with a milestone |
| `update_vision` | Write | Update product vision document |
| `plan_sprint` | Write | Auto-plan a sprint from backlog |
| `run_onboarding` | Write | Execute onboarding setup steps |

### Bootstrap and Persistence (4 tools)

| Tool | Type | Description |
| --- | --- | --- |
| `dump_database` | Read | Export entire database as JSON |
| `restore_database` | Write | Restore database from JSON dump |
| `export_to_file` | Write | Export database to a file on disk |
| `import_from_file` | Write | Import database from a file on disk |

## Dashboard

The dashboard serves at `http://localhost:3333` and provides three main sections:

**Code Explorer** — File tree sidebar with expandable directories. Select a file to view its exports, imports, dependents, and change history. Dependency graph filters to the selected file's connections. Keyboard shortcuts include Cmd+K for search and arrow keys for navigation.

**Sprint Board** — Sprint cards with velocity bars and process health checklists. Kanban board with TODO, IN_PROGRESS, DONE, and BLOCKED columns. Planning view for sprint preparation. QA view for quality gate tracking. Retrospective view for findings and action items.

**Project Management** — Velocity trend chart across all sprints. Gantt-style milestone timeline. Milestone detail cards with linked tickets. Product vision editor with version history. Planning insights panel.

**Team Overview** — Agent cards for all 9 roles with health indicators, computed mood scores (derived from ticket load and retro sentiment), and workload distribution bars.

The landing page features a Framer Motion animation sequence introducing the product before transitioning to the main interface.

## The Virtual IT Team

| Role | Agent | Responsibility |
| --- | --- | --- |
| Product Owner | Defines what to build | Vision, milestones, backlog prioritization, acceptance criteria |
| Scrum Master | Keeps the process healthy | Sprint ceremonies, blocker resolution, velocity tracking, process improvements |
| Manager | Guards efficiency | Cost control, anti-overengineering, resource allocation, timeline oversight |
| Lead Developer | Resolves technical conflicts | Code quality standards, PR reviews, conflict resolution, architectural decisions |
| Backend Developer | Builds the server side | APIs, services, database schema, integrations, server logic |
| Frontend Developer | Builds the interface | UI components, dashboard, styling, animations, user experience |
| Architect | Designs the system | Infrastructure, CI/CD, system design, technology selection, scalability |
| QA Engineer | Validates quality | Test coverage, bug verification, quality gates, regression testing |
| Security Specialist | Protects the product | Vulnerability audits, input validation, secure defaults, dependency scanning |

Each agent is defined in the `.claude/agents/` directory with a role identifier, description, model preference, available tools, and a system prompt that guides its behavior during sprint activities.

## Sprint Process

The virtual team follows a structured 5-day sprint cycle:

1. **Day 1 — Planning**: Product Owner presents goals, team estimates tickets, sprint backlog is committed
2. **Day 2-3 — Execution**: Developers implement tickets, QA writes test plans, Security reviews changes
3. **Day 4 — Review**: Lead Developer reviews code, QA verifies acceptance criteria, bugs are logged
4. **Day 5 — Retro**: Team records what went well, what went wrong, and what to try next

All ceremonies are executed through MCP tools. Sprint state, velocity metrics, and retrospective findings persist across sessions in the SQLite database.

## Context Efficiency

Tested on a 25-file, 7K-line TypeScript project:

| Metric | With MCP | Without MCP | Improvement |
| --- | --- | --- | --- |
| Tokens per analysis | ~20K | ~62K | 3x reduction |
| Raw data transferred | ~6K chars | ~111K chars | 8x reduction |
| Tool calls required | 7 | 16 | 2x fewer |

The first index costs more (files must be read to generate metadata). Every subsequent query is 3x cheaper. Break-even after approximately 2 uses.

## Schema Reference

### Code Context Tables (5)

| Table | Key Columns | Purpose |
| --- | --- | --- |
| `files` | path, language, size_bytes, line_count, summary, description, content | Every indexed file |
| `exports` | file_id, name, kind | Named exports (function, class, type, interface, enum, const) |
| `dependencies` | source_id, target_id, symbols | Import edges between files |
| `directories` | path, name, depth, file_count, total_lines, language_breakdown | Directory-level aggregates |
| `changes` | file_path, event, timestamp, diff_text, reason | Append-only change log |

### Scrum Tables (10)

| Table | Key Columns | Purpose |
| --- | --- | --- |
| `agents` | role, name, description, model, tools, system_prompt | Team agent definitions |
| `sprints` | name, goal, start_date, end_date, status, velocity_committed/completed | Sprint tracking |
| `tickets` | sprint_id, ticket_ref, title, priority, status, story_points, qa_verified | User stories and tasks |
| `subtasks` | ticket_id, description, status, assigned_to | Task breakdown |
| `retro_findings` | sprint_id, role, category, finding, action_owner | Retrospective items |
| `blockers` | sprint_id, ticket_id, description, status | Impediments |
| `bugs` | sprint_id, ticket_id, severity, description, status | Defects |
| `skills` | name, content, owner_role | Team knowledge documents |
| `processes` | name, content, version | Versioned process definitions |
| `milestones` | name, description, target_date, status | Project milestones |

## Configuration

### CLI Flags

```bash
code-context-mcp [path]                # Index a directory (default: cwd)
code-context-mcp setup [path]          # Full setup: index + scrum + .mcp.json
code-context-mcp --force .             # Re-initialize from scratch
code-context-mcp --name my-project .   # Set project name
code-context-mcp --help                # Show all options
```

### .mcp.json

The setup command writes an MCP server entry to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "code-context": {
      "command": "node",
      "args": ["node_modules/vlm-code-context-mcp/dist/server/index.js", "./context.db"]
    }
  }
}
```

### Project Structure

```
your-project/
  context.db              # SQLite database (auto-generated)
  .mcp.json               # MCP server configuration (auto-generated)
  .claude/
    agents/               # Agent role definitions (YAML)
    scrum/                # Sprint data, processes, skills
    instructions/         # Project-level instructions
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

```bash
git clone https://github.com/VelimirMueller/mcp-server.git
cd mcp-server
npm install
npm run build
npm test
```

The project uses Vitest for testing and TypeScript for all server-side code. The dashboard is a separate Vite application under `src/dashboard/app/`.

## License

MIT
