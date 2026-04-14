# Dashboard

vlm-code-context-mcp includes a full React dashboard with live-updating views.

## Launch

```bash
npx code-context-dashboard ./context.db
# Opens at http://localhost:3333

npx code-context-dashboard ./context.db 4000 .
# Custom port + file watcher
```

The dashboard respects the `DASHBOARD_PORT` environment variable.

## Pages

### Sprint Board
Kanban board with drag-and-drop ticket management. Tickets move between TODO, IN_PROGRESS, and DONE columns. Live updates via SSE — every MCP tool call refreshes the board instantly.

### Code Explorer
File tree browser with tabbed detail panel showing exports, imports, dependencies, and metadata. Search across all indexed files.

### Project Management
Milestone progress bars, epic tracking with ticket counts, and Gantt timeline visualization.

### Team
Agent grid showing roles, departments, mood scores, and workload distribution. Team health indicators surface at-risk agents.

### Retro
Sprint retrospective viewer with findings by category (went_well, went_wrong, try_next). Pattern analysis across sprints.

### Benchmark
A/B comparison of token efficiency — per-call averages, S/M/L task projections, and audit notes. Data sourced from `comparison.json`.

## Architecture

```
Browser ←→ SSE ←→ Dashboard Server ←→ SQLite DB ←→ MCP Server
```

- **Single SQLite database** shared between dashboard and MCP server (WAL mode for concurrent access)
- **SSE (Server-Sent Events)** for real-time updates — no polling
- **MCP notification bridge** — every MCP tool call POSTs to the dashboard, triggering instant SSE refresh
- **React 19 + Vite + Tailwind CSS 4** — code-split into 18 chunks

## Bridge

The dashboard-to-Claude bridge enables bidirectional communication:

1. Click a button in the dashboard UI
2. Dashboard creates a `pending_action` in SQLite
3. Claude's bridge hook detects it and executes the MCP tool
4. Result writes back to SQLite → SSE notifies dashboard

This lets non-technical users trigger sprint operations from the UI without typing commands.
