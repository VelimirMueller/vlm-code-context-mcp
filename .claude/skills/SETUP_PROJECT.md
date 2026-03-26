# Setup Project Skill

## When to use
When a new user installs the npm package and wants to set up code-context-mcp for their project, or when Claude needs to initialize a fresh project.

## Prerequisites
```bash
npm install -g vlm-code-context-mcp
# or
npx code-context-mcp /path/to/project
```

## What setup does (current state)
1. Creates `context.db` in the target directory
2. Initializes code-context schema (files, exports, dependencies, directories, changes)
3. Indexes all JS/TS files — parses exports, imports, builds dependency graph
4. Writes `.mcp.json` pointing AI clients to the MCP server

## What setup is MISSING (gaps to fix)

### Critical gaps
- **Scrum schema not initialized** — `setup.ts` calls `initSchema()` but not `initScrumSchema()`. The 25 scrum MCP tools will fail with "no such table" errors.
- **No agent templates shipped** — `.claude/agents/` configs are not in the npm `"files"` array. New users get zero agents loaded.
- **No `.claude/` scaffolding** — if the user's project doesn't have `.claude/agents/`, `.claude/scrum/default/`, `.claude/skills/`, the scrum import does nothing silently.
- **No DB dump/restore** — re-indexing or reinstalling loses all sprint/ticket/retro data.

### Package issues
- `react`, `react-dom`, `framer-motion`, `zustand` are in `dependencies` but should be in `devDependencies` — they're only needed for building the dashboard, not for the MCP server runtime.
- `"files"` array only ships `dist/` and `README.md` — should also ship `.claude/agents/`, `.claude/scrum/default/`, `.claude/skills/` as templates.

### UX gaps
- No `--help` flag on `code-context-mcp` CLI
- No post-setup guidance showing what MCP tools are available
- Dashboard binary (`code-context-dashboard`) needs a DB path argument — not documented clearly
- No health check: "is my setup working?" tool

## Full setup flow (what it SHOULD be)

```bash
# Step 1: Install
npm install -g vlm-code-context-mcp

# Step 2: Setup (in your project directory)
code-context-mcp setup .
# → Creates context.db
# → Initializes BOTH code-context AND scrum schemas
# → Indexes all JS/TS files
# → Creates .claude/ directory with:
#   - agents/ (9 agent templates: architect, backend-dev, frontend-dev, etc.)
#   - scrum/default/ (sprint template files: TICKETS.md, PLANNING.md, etc.)
#   - skills/ (SPRINT_PROCESS.md, PRODUCT_VISION.md template, MILESTONES.md template)
#   - instructions/INSTRUCTIONS.md (team setup instructions)
# → Writes .mcp.json with code-context server entry
# → Prints summary: files indexed, tools available, dashboard URL

# Step 3: Dashboard (optional)
code-context-dashboard
# → Opens http://localhost:3333 with Code Explorer, Sprint board, Project Management

# Step 4: AI client picks up .mcp.json automatically
# → 35 MCP tools available (10 code-context + 25 scrum)
```

## MCP tools available after setup

### Code Context (10 tools)
| Tool | Purpose |
|------|---------|
| `index_directory` | Re-index a directory |
| `find_symbol` | Search exports by name |
| `get_file_context` | Full file context (exports, imports, dependents) |
| `set_description` | Set file description (persists across re-index) |
| `set_directory_description` | Set directory description |
| `set_change_reason` | Annotate a change |
| `get_changes` | View recent changes |
| `search_files` | Search by path or summary |
| `query` | Read-only SQL |
| `execute` | Write SQL |

### Scrum (25 tools)
| Tool | Purpose |
|------|---------|
| `list_agents` / `get_agent` | Team management |
| `list_sprints` / `get_sprint` | Sprint queries |
| `create_sprint` / `update_sprint` | Sprint lifecycle |
| `list_tickets` / `get_ticket` | Ticket queries |
| `create_ticket` / `update_ticket` | Ticket management |
| `list_retro_findings` | Retrospective data |
| `add_retro_finding` | Add retro finding |
| `create_blocker` / `resolve_blocker` | Blocker tracking |
| `log_bug` | Bug tracking |
| `search_scrum` | Full-text search |
| `get_sprint_instructions` | Process documentation |
| `sync_scrum_data` | Re-import from .claude/ |
| `export_sprint_report` | Markdown report |
| `create_milestone` / `update_milestone` | Milestone CRUD |
| `link_ticket_to_milestone` | Ticket-milestone linking |
| `update_vision` | Product vision |
| `get_backlog` | Unplanned tickets |
| `plan_sprint` | Create sprint from backlog |

## Implementation plan for Sprint 11

The `sprint-11-mcp-bootstrap` sprint (19pt, 5 tickets) covers:
1. T-066: `setup_project` + `get_project_status` MCP tools
2. T-067: `dump_database` + `restore_database` MCP tools
3. T-068: Onboarding wizard (`get_onboarding_status` + `run_onboarding`)
4. T-069: Dashboard API for dump/restore
5. T-070: Enhanced CLI setup command

## Verification checklist (for QA after setup)

- [ ] `context.db` exists in project root
- [ ] `.mcp.json` has `code-context` server entry
- [ ] `sqlite3 context.db ".tables"` shows: agents, sprints, tickets, subtasks, retro_findings, blockers, bugs, skills, processes, milestones, files, exports, dependencies, directories, changes
- [ ] `sqlite3 context.db "SELECT COUNT(*) FROM files"` returns > 0
- [ ] Dashboard loads at http://localhost:3333 without errors
- [ ] Code Explorer shows file tree
- [ ] Sprint page shows sprint list (if .claude/scrum/ exists)
- [ ] All 35 MCP tools respond (test with `list_agents`, `list_sprints`, `search_files`)
