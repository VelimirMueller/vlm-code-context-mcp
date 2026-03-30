<div align="center">

# vlm-code-context-mcp

**AI-Powered Virtual IT Department via Model Context Protocol**

Your codebase, indexed. Your sprints, managed. Your team, automated.
One MCP server. 81 tools. Zero context waste.

[![npm](https://img.shields.io/npm/v/vlm-code-context-mcp)](https://www.npmjs.com/package/vlm-code-context-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![Tests](https://img.shields.io/badge/tests-219%20passing-brightgreen)](#testing)

</div>

---

## What is this?

Most AI coding assistants burn through context windows reading raw source files just to understand what a codebase does. `vlm-code-context-mcp` eliminates that waste by pre-indexing your entire project into a SQLite database, then exposing structured metadata through the [Model Context Protocol](https://modelcontextprotocol.io). AI agents query files, exports, dependencies, and change history through MCP tools instead of reading source code directly — using **3x fewer tokens** and **8x less data**.

But code intelligence is only the beginning. This package ships a complete **virtual IT department**: a 9-role AI scrum team that runs real sprint processes through MCP. Product Owner, Scrum Master, Architect, Backend and Frontend Developers, Lead Developer, QA Engineer, Manager, and Security Specialist — each with defined responsibilities, system prompts, and tool access. Sprints, tickets, epics, discoveries, retrospectives, blockers, bugs, milestones, and velocity tracking all persist in the same SQLite database and are managed through 71 dedicated MCP tools.

The included **React dashboard** brings everything together in a single enterprise-grade interface. Built with Vite, React 19, Zustand, Tailwind CSS, and Framer Motion, it provides a code explorer with dependency graphs, a full sprint board with kanban and planning views, project management with Gantt charts and milestone timelines, and a team overview with agent health indicators. Dark theme, keyboard shortcuts, live reload — production-ready out of the box.

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

Full lifecycle via MCP: planning, tickets, kanban, retrospectives, blockers, bugs, milestones, epics, and velocity tracking. 71 tools cover every workflow.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### React Dashboard

Vite + React 19 + Zustand + Framer Motion. 68 components across 6 pages: code explorer, sprint board, kanban, Gantt charts, team overview, retro board. Dark theme, keyboard shortcuts, live reload.

</td>
<td width="33%" valign="top">

### External Integrations

Sync data from GitHub (issues, PRs, commits) and Linear (issues, cycles, projects) directly into the scrum database through dedicated MCP tools.

</td>
<td width="33%" valign="top">

### Database Persistence

All state lives in a single SQLite file. Dump and restore the entire database through MCP tools. Progress survives reinstalls, branch switches, and CI runs.

</td>
</tr>
</table>

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      vlm-code-context-mcp                        │
├───────────────┬───────────────────┬──────────────────────────────┤
│  MCP Server   │   Scrum System    │       React Dashboard        │
│  src/server/  │   src/scrum/      │       src/dashboard/         │
│               │                   │                              │
│ - TS parser   │ - 15 DB tables    │ - 68 React components        │
│   & indexer   │ - 71 MCP tools    │ - 6 Zustand stores           │
│ - 10 MCP      │ - 9 agent roles   │ - Atomic design              │
│   tools       │ - Sprint process  │   (atoms/molecules/organisms)│
│ - 5 DB tables │ - GitHub sync     │ - Framer Motion animations   │
│ - File        │ - Linear sync     │ - Tailwind CSS               │
│   watcher     │ - Epics/discover. │ - Vite 8 build               │
│               │ - Time tracking   │ - 6 pages                    │
├───────────────┼───────────────────┼──────────────────────────────┤
│               │    Bridge Layer   │                              │
│               │    src/bridge/    │                              │
│               │  Claude Code hook │                              │
│               │  → dashboard sync │                              │
└───────────────┴───────────────────┴──────────────────────────────┘
                           │
                    context.db (SQLite)
                       15 tables
```

| Component | Count |
| --- | --- |
| MCP tools | 81 (10 code + 71 scrum) |
| React components | 68 (atoms, molecules, organisms) |
| Zustand stores | 6 (file, sprint, agent, planning, ui, toast) |
| Database tables | 15 (5 code + 10 scrum) |
| Agent roles | 9 |
| Test cases | 219 |

## MCP Tools (81)

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

### Sprint Management — Read (27 tools)

| Tool | Description |
| --- | --- |
| `list_agents` | List all scrum team agents |
| `get_agent` | Get agent details by role |
| `list_sprints` | List sprints with ticket counts |
| `get_sprint` | Full sprint details (tickets, bugs, blockers, retro) |
| `list_tickets` | Filter tickets by sprint, status, assignee |
| `get_ticket` | Ticket details with subtasks and linked bugs |
| `list_retro_findings` | Filter retro findings by sprint, category |
| `search_scrum` | Full-text search across scrum data |
| `export_sprint_report` | Generate complete markdown sprint report |
| `get_backlog` | View backlog items across sprints |
| `get_project_status` | Project health check with metrics |
| `get_sprint_instructions` | Sprint process guide for agents |
| `get_sprint_playbook` | Detailed playbook for sprint execution |
| `get_sprint_config` | Current sprint configuration settings |
| `get_onboarding_status` | Check setup completeness |
| `get_velocity_trends` | Velocity metrics across sprints |
| `get_burndown` | Sprint burndown data |
| `get_time_report` | Time tracking report |
| `get_mood_trends` | Team mood trends over time |
| `get_audit_trail` | Audit trail of system changes |
| `get_dependency_graph` | Ticket dependency visualization |
| `get_discovery_coverage` | Discovery-to-ticket coverage analysis |
| `list_epics` | List all epics |
| `list_discoveries` | List product discoveries |
| `list_decisions` | List recorded decisions |
| `list_tags` | List all tags |
| `list_recent_events` | Recent system events |

### Sprint Management — Write (40 tools)

| Tool | Description |
| --- | --- |
| `create_sprint` | Create a new sprint |
| `start_sprint` | Transition sprint to active |
| `advance_sprint` | Move sprint to next phase |
| `update_sprint` | Update sprint status and velocity |
| `update_sprint_config` | Modify sprint configuration |
| `plan_sprint` | Auto-plan a sprint from backlog |
| `create_ticket` | Add a ticket to a sprint |
| `update_ticket` | Change ticket status, assignment, QA sign-off |
| `create_epic` | Create an epic for grouping tickets |
| `update_epic` | Update epic details and status |
| `link_ticket_to_epic` | Associate a ticket with an epic |
| `create_milestone` | Create a project milestone |
| `update_milestone` | Update milestone status and dates |
| `link_ticket_to_milestone` | Associate a ticket with a milestone |
| `create_discovery` | Record a product discovery |
| `update_discovery` | Update discovery status |
| `link_discovery_to_ticket` | Link a discovery to implementation tickets |
| `create_blocker` | Report a blocker |
| `resolve_blocker` | Mark blocker as resolved |
| `log_bug` | Log a bug with severity |
| `add_retro_finding` | Add a retrospective finding |
| `analyze_retro_patterns` | Identify patterns across retrospectives |
| `log_decision` | Record an architectural or process decision |
| `log_event` | Log a system or team event |
| `log_time` | Track time spent on tickets |
| `record_mood` | Record team member mood/morale |
| `snapshot_sprint_metrics` | Capture sprint metrics at a point in time |
| `add_tag` | Add a tag to a ticket |
| `remove_tag` | Remove a tag from a ticket |
| `add_dependency` | Add a dependency between tickets |
| `remove_dependency` | Remove a ticket dependency |
| `update_vision` | Update product vision document |
| `generate_vision_animation` | Generate animated vision video (Remotion) |
| `sync_scrum_data` | Re-import from .claude/ directory |
| `sync_github_data` | Sync issues, PRs, and commits from GitHub |
| `sync_linear_data` | Sync issues, cycles, and projects from Linear |
| `run_onboarding` | Execute onboarding setup steps |
| `reset_agents` | Reset agents to factory defaults |
| `reset_skills` | Reset skills to factory defaults |
| `reset_sprint_process` | Reset sprint process definitions |

### Database Persistence (4 tools)

| Tool | Description |
| --- | --- |
| `dump_database` | Export entire database as JSON |
| `restore_database` | Restore database from JSON dump |
| `export_to_file` | Export database to a file on disk |
| `import_from_file` | Import database from a file on disk |

## Dashboard

The dashboard serves at `http://localhost:3333` and provides six pages:

**Code Explorer** — File tree sidebar with expandable directories. Select a file to view its exports, imports, dependents, and change history. Dependency graph filters to the selected file's connections. Keyboard shortcuts include Cmd+K for search and arrow keys for navigation.

**Sprint Board** — Sprint cards with velocity bars and process health checklists. Kanban board with TODO, IN_PROGRESS, DONE, and BLOCKED columns. Planning view for sprint preparation. QA view for quality gate tracking.

**Project Management** — Velocity trend chart across all sprints. Gantt-style milestone timeline. Milestone detail cards with linked tickets. Product vision editor with version history. Planning insights panel.

**Team Overview** — Agent cards for all 9 roles with health indicators, computed mood scores (derived from ticket load and retro sentiment), and workload distribution bars.

**Retro Board** — Retrospective findings organized by category (went well, went wrong, try next). Pattern analysis across sprints. Action item tracking.

**Marketing / Landing** — Framer Motion animation sequence introducing the product. Serves as the entry point before transitioning to the main interface.

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

Each agent is defined in the `templates/agents/` directory with a role identifier, description, model preference, available tools, and a system prompt that guides its behavior during sprint activities.

## Sprint Process

The virtual team follows a structured 5-day sprint cycle:

1. **Day 1 — Planning**: Product Owner presents goals, team estimates tickets, sprint backlog is committed
2. **Day 2-3 — Execution**: Developers implement tickets, QA writes test plans, Security reviews changes
3. **Day 4 — Review**: Lead Developer reviews code, QA verifies acceptance criteria, bugs are logged
4. **Day 5 — Retro**: Team records what went well, what went wrong, and what to try next

All ceremonies are executed through MCP tools. Sprint state, velocity metrics, and retrospective findings persist across sessions in the SQLite database. Automated gates enforce estimation, assignment, and QA verification before phase transitions.

## External Integrations

### GitHub Sync

The `sync_github_data` tool imports issues, pull requests, and commits from a GitHub repository into the scrum database. This enables tracking external contributions alongside sprint work.

### Linear Sync

The `sync_linear_data` tool imports issues, cycles, and projects from a Linear workspace. Linear data maps to the scrum schema, allowing unified tracking across both systems.

### Claude Code Bridge

The bridge layer (`src/bridge/`) provides a `PreToolUse` hook that connects Claude Code to the dashboard. Actions triggered in the dashboard UI are queued and processed by Claude Code, enabling bidirectional interaction between the AI agent and the visual interface.

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
code-context-mcp --defaults            # Skip prompts, auto-create vision & milestone
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
    agents/               # Agent role definitions (markdown)
    scrum/                # Sprint data, processes, skills
    instructions/         # Project-level instructions
```

## Testing

The project includes 219 test cases across 13 test suites, all running on Vitest:

```bash
npm test                  # Run all backend tests
npm run test:frontend     # Run dashboard component tests
npm run test:all          # Run both backend and frontend tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

## Development

```bash
git clone https://github.com/VelimirMueller/mcp-server.git
cd mcp-server
npm install
npm run build             # Compile TypeScript + build dashboard
npm test                  # Run test suite
```

### Dashboard Development

```bash
npm run dashboard:dev     # Vite dev server on port 5173
npm run dev               # Dashboard HTTP server on port 3333
```

The Vite dev server proxies `/api/*` requests to the dashboard HTTP server at `localhost:3333`.

### Build

```bash
npm run build
# 1. tsc → compiles src/ to dist/
# 2. Copies dashboard.html to dist/dashboard/
# 3. Vite builds React app into dist/dashboard/app/
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| MCP Server | `@modelcontextprotocol/sdk`, `better-sqlite3`, `zod` |
| File Watching | `chokidar` |
| Dashboard UI | React 19, Vite 8, Tailwind CSS 4, Zustand 5, Framer Motion |
| Animation | Remotion |
| Testing | Vitest, Testing Library |
| Language | TypeScript 5.9 (ES modules) |

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

## License

MIT
