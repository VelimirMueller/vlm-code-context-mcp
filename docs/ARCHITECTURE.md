# Architecture

## Overview

vlm-code-context-mcp is an MCP server that pre-indexes TypeScript/JavaScript codebases into SQLite, plus a React dashboard for visualization and sprint management.

## System Components

### MCP Server (src/server/)

- TypeScript parser indexes files, exports, imports, dependencies
- SQLite database stores all metadata
- MCP tools expose read/write operations to AI agents

### Scrum System (src/scrum/)

- 20+ database tables: agents, sprints, tickets, subtasks, retro_findings, blockers, bugs, skills, processes, milestones, decisions, epics, sprint_metrics, ticket_dependencies, tags, ticket_tags, agent_mood_history, event_log, discoveries
- 71 MCP tools for full sprint lifecycle management (including bridge wizard)
- All data lives in SQLite (context.db) — no file-based storage

### Dashboard (src/dashboard/)

- **App**: Vite + React 18 + TypeScript + Tailwind CSS (src/dashboard/app/)
- **Server**: Node.js HTTP server serving APIs + static files (src/dashboard/dashboard.ts)
- **State**: Zustand stores (file, sprint, agent, planning, UI)
- **Animation**: Framer Motion for transitions + micro-interactions

## Component Architecture (Atomic Design)

```
atoms/       → AnimatedNumber, Badge, Button, Dot, Skeleton, Stat, Toast
molecules/   → AgentCard, BentoCard, FileItem, FolderItem, HeroText,
               MarkdownRenderer, SearchBar, SprintCard, StatGroup, SubTabBar,
               TabBar, TicketCard
organisms/   → BentoGrid, DependencyGraph, FileTree, GanttChart, KanbanBoard,
               LandingAnimation, MilestoneList, SprintDetail, SprintList,
               SprintPlanner, TeamGrid, Topbar, VisionEditor
templates/   → (via index.ts: ExplorerLayout, SprintLayout, PlanningLayout)
pages/       → CodeExplorer, Sprint, ProjectManagement
```

## State Management

5 Zustand stores:

- **fileStore** — files, directories, selected file detail, graph, stats
- **sprintStore** — sprints, tickets, retro findings
- **agentStore** — agent health and mood
- **planningStore** — milestones, vision, gantt, backlog (read + write)
- **uiStore** — page navigation, tabs, sidebar, search, folder expand state

## API Endpoints

### Code Context (read-only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/files` | GET | All indexed files with export/import counts |
| `GET /api/file/:id` | GET | Full file context: exports, imports, importedBy |
| `GET /api/file/:id/changes` | GET | Per-file change history with diffs |
| `GET /api/directories` | GET | All directory metadata |
| `GET /api/stats` | GET | Aggregate counts, language breakdown, extensions |
| `GET /api/graph` | GET | Dependency graph nodes and edges |
| `GET /api/changes` | GET | Recent changes across all files (with `?limit=`) |
| `GET /api/events` | SSE | Server-Sent Events stream for live reload |

### Skills & Agents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/skills` | GET | All skills with name, content, owner_role |
| `GET /api/skill/:name` | GET | Single skill by name |
| `GET /api/agents` | GET | Agent health + computed mood scores |

### Scrum (Sprint 8 additions)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/sprints` | GET | All sprints with ticket/done/qa/retro/blocker counts |
| `GET /api/sprint/:id` | GET | Single sprint detail |
| `GET /api/sprint/:id/tickets` | GET | Tickets for a sprint |
| `GET /api/sprint/:id/retro` | GET | Retro findings for a sprint |
| `GET /api/milestones` | GET | All milestones with ticket counts |
| `POST /api/milestones` | POST | Create a new milestone |
| `PUT /api/milestone/:id` | PUT | Update milestone status/progress/description |
| `GET /api/backlog` | GET | Unassigned and carried-over tickets |
| `POST /api/sprints/plan` | POST | Create sprint and assign tickets in one call |
| `PUT /api/vision` | PUT | Update PRODUCT_VISION skill content |

## Build Pipeline

```
npm run build
  → tsc (compiles MCP server to dist/)
  → vite build (compiles React app to dist/dashboard/)

npm run dashboard:dev
  → vite dev server on :5173, proxies /api/* to :3333

npm run dashboard
  → tsx src/dashboard/dashboard.ts (full server on :3333)
```
