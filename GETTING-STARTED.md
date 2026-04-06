nonono # Getting Started

**An AI-powered virtual IT department via MCP — codebase intelligence, 9-agent scrum team, sprint management, and React dashboard in one npm package.**

---

## What is this?

`vlm-code-context-mcp` is a Model Context Protocol (MCP) server that gives AI agents deep understanding of your codebase without burning through context windows. It wraps that intelligence in a complete virtual scrum team with:

- **Codebase indexing** — File tree, exports, imports, dependencies, change history
- **10 MCP code-context tools** — Query your codebase structure 25x more efficiently
- **GitHub integration** — Sync issues, PRs, and commits via `sync_github_data` MCP tool
- **9 AI agents** — Product Owner, Architect, Lead Dev, Backend, Frontend, QA, Security, Scrum Master, Manager
- **Full scrum process** — Sprints, tickets, retrospectives, velocity tracking, phase gates
- **React dashboard** — Live project management with SSE updates
- **81 MCP tools total** — Code context + scrum management

**Context efficiency:** On a 224-file codebase, this reduces token usage by **25x** compared to reading raw files.

---

## MCP Tools Overview

This package provides **81 MCP tools** divided into two categories:

### Code Context Tools (10 tools)

These tools give AI agents structured access to your codebase:

| Tool | Description |
|------|-------------|
| `index_directory` | Scan a directory, parse files, extract metadata and build dependency graph |
| `search_files` | Search indexed files by path or summary (supports % wildcards) |
| `get_file_context` | Get file's summary, exports, imports (dependencies), and what imports it |
| `find_symbol` | Find which file(s) export a function, component, type, or constant |
| `get_changes` | Get recent file changes grouped by path with size, lines, and summary diffs |
| `dump_database` | Export entire database to JSON for backup/restore |
| `export_to_file` | Export database to JSON file on disk |
| `restore_database` | Restore database from JSON dump |
| `import_from_file` | Import database from JSON dump file on disk |
| `set_change_reason` | Set a reason/explanation for a recorded file change |

**Why this matters:** Instead of reading 20+ raw files (avg 9,200 chars each), agents query structured metadata. Example: "find where `useButton` is exported" returns instant results vs. grepping through megabytes of code.

### GitHub Integration (1 tool)

| Tool | Description |
|------|-------------|
| `sync_github_data` | Sync GitHub repo data (issues, PRs, commits, metadata) to the dashboard |

**Setup:**
```bash
# Set your GitHub token as environment variable
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Then in Claude Code, use the tool:
"sync_github_data for VelimirMueller/mcp-server"
```

The GitHub integration:
- Fetches open issues (excludes PRs)
- Fetches all pull requests (open and closed)
- Fetches recent commits (last 50)
- Syncs everything to your local `context.db`
- Displays in the dashboard under the "GitHub" tab

**No cloud dependency** — Data lives in your local database. Only the initial fetch hits GitHub's API.

### Scrum Tools (71 tools)

Full sprint management, ticket tracking, retrospectives, agent management, and more. See [MCP Tool Reference](#mcp-tool-reference) below for the complete list.

---

## Prerequisites

- **Node.js** 18+ (tested on v20+)
- **npm** 9+ 
- **Claude Code** or any MCP-compatible AI client
- **git** (recommended, for import of sprint history)
- **GitHub Token** (optional, for GitHub integration)

### Check your versions

```bash
node --version  # Should be v18+
npm --version   # Should be v9+
```

### GitHub Token (for GitHub integration)

To use the `sync_github_data` MCP tool, create a GitHub personal access token:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Select scopes: `repo` (for private repos) or `public_repo` (for public repos)
4. Generate and copy the token

Set it as an environment variable:

```bash
# Linux/Mac
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Windows (PowerShell)
$env:GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# Windows (Command Prompt)
set GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

**Security note:** The token is only used to make authenticated requests to GitHub's API. It's never stored or transmitted anywhere except directly to GitHub's API servers.

---

## Installation

### Option 1: Use in an existing project (recommended)

The easiest way to add this to your project is via `npx` — no installation required:

```bash
# From your project root
npx vlm-code-context-mcp setup .
```

This will:
1. Create `context.db` in your project directory
2. Index all your source files
3. Initialize the scrum schema
4. Import any existing sprint history from `.claude/`
5. Configure your MCP server entry in `.mcp.json`

### Option 2: Install globally

```bash
npm install -g vlm-code-context-mcp

# Then run from any project
code-context-mcp setup .
```

### Option 3: Install as a dependency

```bash
npm install vlm-code-context-mcp --save-dev

# Run setup
npx code-context-mcp setup .
```

---

## Setup Process

The setup command will guide you through:

```bash
$ npx vlm-code-context-mcp setup my-project

=== Code Context MCP — Setup (my-project) ===

  Target directory : /path/to/my-project
  Database         : /path/to/my-project/context.db
  MCP server       : /path/to/dist/server/index.js

[1/4] Initializing database...
  Code-context schema ready.
  Scrum schema ready.

[2/4] Indexing files...
  Indexed 25 files, 142 exports, 87 dependencies

[3/4] Seeding defaults...
  Seeded 9 agents, 3 skills from factory defaults

[4/4] Writing .mcp.json...
  Configured MCP server entry

=== Setup complete! (my-project) ===

Next steps:
  1. Restart Claude Code to load the MCP server
  2. Open dashboard: npx code-context-dashboard ./context.db
```

### Setup Options

```bash
# Re-index from scratch (deletes existing database)
code-context-mcp setup . --force

# Skip prompts and use defaults
code-context-mcp setup . --defaults

# Custom project name
code-context-mcp setup . --name "My Awesome Project"
```

---

## Running the Dashboard

Once setup is complete, start the React dashboard:

```bash
# From your project root
npx code-context-dashboard ./context.db
```

Or if you installed globally:

```bash
code-context-dashboard ./context.db
```

The dashboard will open at **http://localhost:3333**

### Dashboard Features

- **Sprint Board** — Kanban view, planning, QA gates, burndown
- **Code Explorer** — File tree, dependencies, exports, change history
- **Project Management** — Gantt, milestones, vision editor
- **Team** — Agent health, mood trends, workload
- **Retro** — Findings, patterns, action items
- **Marketing** — Release notes, vision animations

All updates are **live** via Server-Sent Events — no refresh needed.

---

## Using with Claude Code

### Step 1: Verify MCP Configuration

After setup, you should have a `.mcp.json` file in your project:

```json
{
  "mcpServers": {
    "code-context": {
      "command": "node",
      "args": [
        "./dist/server/index.js",
        "./context.db"
      ]
    }
  }
}
```

### Step 2: Restart Claude Code

Quit and restart Claude Code to load the MCP server. You should see:

```
[MCP] Connected to code-context
```

### Step 3: Use the Tools

In Claude Code, you now have access to 81 tools. Here are the most commonly used:

#### Code Context Examples

```
You: What files export the useButton hook?

Claude: [Uses find_symbol tool]
The useButton hook is exported in:
- src/components/hooks/useButton.ts
- src/components/hooks/useButton.test.ts
```

```
You: Show me the recent changes to the auth module

Claude: [Uses get_changes tool]
Recent changes to src/auth/:
- AuthService.ts (+45 lines, -12 lines)
- Added OAuth2 integration
- Fixed token refresh bug
- Updated types
```

#### GitHub Integration Examples

```
You: Sync my GitHub repo to the dashboard

Claude: [Uses sync_github_data tool]
Fetching data from GitHub...
- Repository: VelimirMueller/mcp-server
- Issues: 12 open
- Pull Requests: 8 open, 45 closed
- Commits: 50 recent

Data synced to dashboard. View at http://localhost:3333 → GitHub tab
```

```
You: What's the status of PR #123?

Claude: [Queries synced GitHub data from context.db]
PR #123: "Fix ProcessFlow rendering"
- Status: Open
- Author: velimir
- Branch: fix/process-flow → main
- Draft: No
- CI Status: pending
```

#### Scrum Examples

```
You: Create a new sprint for next week

Claude: [Uses start_sprint tool]
Created Sprint 78 — "Feature Implementation"
- Goal: Implement user authentication flow
- Start: 2026-04-07
- End: 2026-04-11
- Velocity: 21 points

Would you like me to create tickets?
```

```
You: How's the team feeling this sprint?

Claude: [Uses get_mood_trends tool]
Team mood analysis:
- Backend Dev: 3/5 (moderate load, 13 pts assigned)
- Frontend Dev: 2/5 (elevated burnout risk, 18 pts)
- QA: 4/5 (healthy, 8 pts)

Recommendation: Consider redistributing 3-5 points from frontend to backend
```

### Example Usage

```
You: What files export the useButton hook?

Claude: [Uses find_symbol tool]
The useButton hook is exported in:
- src/components/hooks/useButton.ts
- src/components/hooks/useButton.test.ts
```

```
You: Create a new sprint for next week

Claude: [Uses start_sprint tool]
Created Sprint 78 — "Feature Implementation"
- Goal: Implement user authentication flow
- Start: 2026-04-07
- End: 2026-04-11
- Velocity: 21 points

Would you like me to create tickets?
```

---

## Development

### Building from Source

If you want to contribute or modify the project:

```bash
# Clone the repository
git clone https://github.com/VelimirMueller/mcp-server.git
cd mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Start dashboard in development mode
npm run dashboard:dev
```

### Project Structure

```
mcp-server/
├── src/
│   ├── server/        # MCP server and code-context tools
│   ├── scrum/         # Scrum schema, tools, agents
│   └── dashboard/     # React dashboard
│       ├── dashboard.ts    # Backend server
│       └── app/            # Frontend (Vite + React)
├── dist/              # Compiled output
├── context.db         # SQLite database (created after setup)
└── .mcp.json          # MCP configuration (created after setup)
```

### Scripts

```bash
npm run dev           # Start dashboard server
npm run build         # Build for production
npm run test          # Run tests
npm run lint          # Lint code
npm run format        # Format code
```

---

## MCP Tool Reference

### Code Context Tools (10)

| Tool | Parameters | Description |
|------|------------|-------------|
| `index_directory` | `path: string` | Scan directory, parse files, extract metadata/exports, build dependency graph |
| `search_files` | `query: string` | Search indexed files by path or summary (supports % wildcards) |
| `get_file_context` | `path: string` | Get file summary, exports, imports (dependencies), dependents |
| `find_symbol` | `name: string` | Find which file(s) export a function, component, type, or constant |
| `get_changes` | `file_path?: string`, `limit?: number` | Get recent file changes with diffs (size, lines, exports, summary) |
| `set_change_reason` | `id: number`, `reason: string` | Set reason/explanation for a recorded file change |
| `dump_database` | `tables?: string[]` | Export entire database to JSON for backup/restore |
| `export_to_file` | `output_path?: string` | Export database to JSON file on disk |
| `restore_database` | `dump_json: string` | Restore database from JSON dump |
| `import_from_file` | `input_path: string` | Import database from JSON dump file on disk |

### GitHub Integration (1)

| Tool | Parameters | Description |
|------|------------|-------------|
| `sync_github_data` | `owner: string`, `repo: string`, `since?: string`, `dashboardPort?: number` | Sync GitHub repo (issues, PRs, commits, metadata) to dashboard using GITHUB_TOKEN env var |

### Scrum Tools - Sprints (12)

| Tool | Parameters | Description |
|------|------------|-------------|
| `create_sprint` | `name, startDate, endDate, goal, milestoneId?` | Create new sprint |
| `start_sprint` | `name, goal, tickets[]` | Create sprint with tickets in one call |
| `update_sprint` | `sprintId, status?, goal?, velocity?, milestoneId?` | Update sprint status or details |
| `advance_sprint` | `sprintId, velocityCompleted?` | Advance sprint to next phase (checks all gates) |
| `get_sprint` | `sprintId` | Get full sprint details with tickets, bugs, blockers |
| `get_sprint_playbook` | `sprintId?` | Get current sprint playbook: phase, tickets, gates, blockers, next actions |
| `get_sprint_config` | — | Read SPRINT_PROCESS skill from database |
| `get_sprint_instructions` | `section?` | Get sprint process instructions (lifecycle, tickets, retro, roles, checklist) |
| `list_sprints` | `status?` | List all sprints with status and ticket counts |
| `get_burndown` | `sprintId` | Get burndown data: daily snapshots of remaining vs completed |
| `snapshot_sprint_metrics` | `sprintId, date?` | Capture daily burndown snapshot |
| `get_velocity_trends` | `lastNSprints?, status?` | Get velocity trend: committed vs completed, completion rate, bugs |

### Scrum Tools - Tickets (15)

| Tool | Parameters | Description |
|------|------------|-------------|
| `create_ticket` | `sprintId, title, description?, priority?, assignedTo?, storyPoints?` | Create ticket in sprint |
| `update_ticket` | `ticketId, status?, assignedTo?, qaVerified?, notes?` | Update ticket status, assignment, QA verification |
| `get_ticket` | `ticketId` | Get full ticket details with subtasks and linked bugs |
| `list_tickets` | `sprintId?, status?, assignedTo?` | List tickets with optional filters |
| `get_backlog` | — | List all backlog tickets (unassigned or carried over) |
| `log_time` | `ticketId, estimatedHours?, actualHours?` | Log estimated or actual hours on ticket |
| `add_tag` | `ticketId, tagName, color?` | Add tag to ticket (creates tag if doesn't exist) |
| `remove_tag` | `ticketId, tagName` | Remove tag from ticket |
| `link_ticket_to_epic` | `ticketId, epicId` | Link ticket to epic |
| `link_ticket_to_milestone` | `ticketId, milestoneId` | Link ticket to milestone |
| `add_dependency` | `sourceTicketId, targetTicketId, dependencyType` | Add dependency (blocks, blocked_by, related) |
| `remove_dependency` | `sourceTicketId, targetTicketId` | Remove dependency between tickets |
| `get_dependency_graph` | `ticketId?, sprintId?` | Get all dependencies for ticket or sprint |

### Scrum Tools - Retrospectives (4)

| Tool | Parameters | Description |
|------|------------|-------------|
| `add_retro_finding` | `sprintId, category, finding, role?, actionOwner?` | Add retrospective finding to sprint |
| `list_retro_findings` | `sprintId?, category?` | List retrospective findings with filters |
| `analyze_retro_patterns` | — | Analyze findings across all sprints: category breakdown, recurring issues |
| `export_sprint_report` | `sprintId` | Generate complete markdown sprint report |

### Scrum Tools - Agents (3)

| Tool | Parameters | Description |
|------|------------|-------------|
| `list_agents` | — | List all scrum team agents with roles and capabilities |
| `get_agent` | `role` | Get full details of scrum agent by role |
| `record_mood` | `agentId, sprintId, mood, workloadPoints?, notes?` | Record agent mood for sprint (1-5 scale) |

### Scrum Tools - Blockers & Bugs (4)

| Tool | Parameters | Description |
|------|------------|-------------|
| `create_blocker` | `sprintId, description, ticketId?, reportedBy?, escalatedTo?` | Report blocker on sprint |
| `resolve_blocker` | `blockerId` | Mark blocker as resolved |
| `log_bug` | `sprintId, severity, description, ticketId?, stepsToReproduce?, expected?, actual?` | Log bug against sprint |
| `get_audit_trail` | `entityType, entityId, limit?` | Get audit trail for entity (all state changes over time) |

### Scrum Tools - Milestones & Epics (8)

| Tool | Parameters | Description |
|------|------------|-------------|
| `create_milestone` | `name, description?, targetDate?, status?` | Create new milestone for roadmap |
| `update_milestone` | `milestoneId, status?, description?, progress?, targetDate?` | Update milestone |
| `create_epic` | `name, description?, color?, priority?, milestoneId?` | Create epic to group tickets |
| `update_epic` | `epicId, name?, description?, status?, color?, priority?` | Update epic |
| `list_milestones` | — | List all milestones (requires MCP server query) |
| `list_epics` | — | List epics with optional filters |
| `link_ticket_to_epic` | `ticketId, epicId` | Link ticket to epic (null to unlink) |

### Scrum Tools - Discoveries (7)

| Tool | Parameters | Description |
|------|------------|-------------|
| `create_discovery` | `sprintId, finding, category?, priority?, resolutionPlan?, createdBy?` | Log finding from discovery sprint |
| `update_discovery` | `discoveryId, status?, priority?, dropReason?, resolutionPlan?` | Update discovery status/priority |
| `link_discovery_to_ticket` | `discoveryId, ticketId` | Link discovery to implementation ticket |
| `list_discoveries` | `sprintId?, status?, category?` | List discovery findings with filters |
| `get_discovery_coverage` | `sprintId?` | Get coverage report for discovery sprint |
| `fetch_discoveries` | — | Fetch discoveries (store action) |
| `fetch_discovery_coverage` | `sprintId?` | Fetch discovery coverage (store action) |

### Scrum Tools - Vision & Process (4)

| Tool | Parameters | Description |
|------|------------|-------------|
| `update_vision` | `content` | Create or update PRODUCT_VISION skill content |
| `update_sprint_config` | `content` | Create or update SPRINT_PROCESS skill (stores in database) |
| `log_decision` | `title, rationale?, alternatives?, outcome?, category?` | Log architectural or process decision |

### Scrum Tools - Utilities (3)

| Tool | Parameters | Description |
|------|------------|-------------|
| `export_sprint_report` | `sprintId` | Generate complete markdown sprint report |
| `generate_vision_animation` | `outputPath?` | Generate project vision animation data (JSON) + Remotion render command |
| `list_recent_events` | `entityType?, limit?` | List recent events from audit trail (dashboard-initiated changes) |

---

## Troubleshooting

### "MCP server not found"

1. Check `.mcp.json` exists in your project root
2. Verify the paths point to `./dist/server/index.js`
3. Run `npm run build` if `dist/` is missing
4. Restart Claude Code

### "Database locked"

```bash
# Only one process can write at a time
# Make sure dashboard isn't running twice
pkill -f "dashboard"
```

### Dashboard shows no data

```bash
# Re-index your codebase
npx code-context-mcp . --force
```

### "Cannot find module 'better-sqlite3'"

```bash
# Rebuild native modules
npm rebuild better-sqlite3
```

### Port 3333 already in use

```bash
# Use a different port
PORT=8080 npx code-context-dashboard ./context.db
```

---

## Data Location

All data is stored in `context.db` (SQLite):

- **Code context** — Files, exports, dependencies, changes
- **Scrum data** — Sprints, tickets, agents, retros
- **Team config** — Agents, skills, process config

### Back up your data

```bash
cp context.db context.db.backup
```

### Export/Import

```bash
# Export everything to JSON
npx code-context-mcp dump > backup.json

# Import from backup
npx code-context-mcp restore < backup.json
```

---

## Next Steps

1. **Explore the dashboard** — Open `http://localhost:3333` and explore
2. **Create your first sprint** — Use the "Plan Sprint" button
3. **Assign tickets to agents** — Watch the AI team collaborate
4. **Check out retrospectives** — Learn from patterns across sprints
5. **Customize your process** — Edit sprint phases, agent roles

---

## Support

- **GitHub Issues**: https://github.com/VelimirMueller/mcp-server/issues
- **Documentation**: See `docs/` directory for detailed guides
- **Examples**: Check `e2e/` for integration examples

---

## License

MIT — See LICENSE file for details
