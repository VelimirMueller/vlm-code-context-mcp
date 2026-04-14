# Architecture

## Module Dependency Graph

```
┌─────────────────────────────────────────────┐
│                 server/                      │
│   index.ts (MCP entry point)                │
│   indexer.ts (codebase scanner)             │
│   schema.ts (files/exports/deps DDL)        │
│   setup.ts (CLI bootstrapper)               │
│                     │                        │
│                     │ imports                 │
│                     ▼                        │
│                 scrum/                        │
│   tools.ts → tools/ (domain modules)        │
│   schema.ts (scrum DDL + migrations)        │
│   defaults.ts (agent/skill factory)         │
│   queries.ts (data access layer)            │
│                                              │
│              ┌──────┘  (no reverse import)   │
│              │                               │
│              ▼                               │
│           dashboard/                         │
│   dashboard.ts → handlers/ (HTTP handlers)  │
│   dashboard.html (landing page)             │
│   app/ (React SPA)                          │
│       stores/ (Zustand)                     │
│       pages/ (route-level components)       │
│       components/ (atoms/molecules/orgs)    │
└─────────────────────────────────────────────┘
```

## Module Rules

1. **server/** is the MCP entry point — imports from scrum/ for tool registration
2. **scrum/** is self-contained business logic — never imports from server/ or dashboard/
3. **dashboard/** is the UI layer — imports from server/ (indexer) and scrum/ (schema, defaults) for setup only
4. **scrum/ → dashboard/** communication is via HTTP POST (fire-and-forget), not direct imports

## Key Files

| File | Lines | Role |
|------|-------|------|
| `scrum/tools.ts` | ~3,100 | 82 scrum MCP tools (being split into tools/ modules) |
| `scrum/queries.ts` | ~130 | Data access layer — reusable query functions |
| `scrum/schema.ts` | ~530 | DDL + migrations for 25 scrum tables |
| `dashboard/dashboard.ts` | ~2,100 | HTTP server + API (being split into handlers/) |
| `server/index.ts` | ~460 | 11 code intelligence MCP tools |
| `server/indexer.ts` | ~750 | File parser, export extractor, dep graph builder |

## Data Flow

```
AI Client → MCP Protocol → server/index.ts → SQLite (context.db)
                                                    ↑
Dashboard (React) ← SSE ← dashboard.ts ← WAL watcher ─┘
```

All state lives in `context.db`. No in-memory state is shared between server and dashboard — they communicate via SQLite WAL monitoring.

## Refactoring Status

### Server (scrum/)
- `queries.ts` extracted as data access layer (Sprint 14)
- `tools/` directory created with domain module structure
- Tools being incrementally migrated: sprint, ticket, epic, discovery, analytics, bridge

### Dashboard
- `handlers/` directory created for HTTP handler extraction
- Planned modules: code, sprint, planning, team, bridge

### Frontend (dashboard/app/)
- Identified 10 components exceeding 450 lines for splitting
- sprintStore needs decomposition into 3 focused stores
- Inline styles → design token migration planned
