# code-context-mcp

[![CI](https://github.com/VelimirMueller/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/VelimirMueller/mcp-server/actions/workflows/ci.yml)

AI agents waste most of their context window reading raw source files just to understand what a codebase does. This MCP server pre-indexes your project into a SQLite database so agents can query structured metadata instead — **3x fewer tokens, 8x less data, instant answers.**

```
npx code-context-mcp .
```

That's it. Your codebase is indexed, `.mcp.json` is configured, and your AI client has 10 tools to query files, exports, dependencies, changes, and directory metadata — without ever reading a single source file.

## The problem

Every time an AI agent needs to understand your codebase, it reads files. All of them. A 25-file project burns ~62K tokens just to answer "what does the server directory do?" With pre-indexed metadata, the same answer costs ~20K tokens. The gap widens with larger codebases.

## How it works

1. **Index once** — the indexer walks your project, parses JS/TS imports and exports, extracts summaries from comments and JSDoc, builds a dependency graph, and generates descriptions for every file and directory.
2. **Query many times** — AI agents use MCP tools to get structured answers: file context, symbol lookups, dependency edges, change history with reasons — all pre-computed.
3. **Stay current** — the dashboard watches for file changes and re-indexes automatically. Descriptions persist across re-indexes.

## MCP Tools (10)

| Tool | What it does |
|------|-------------|
| `index_directory` | Scan a directory, build the full index |
| `find_symbol` | Find which files export a given function, type, or constant |
| `get_file_context` | Full file context: summary, exports, imports, dependents, change history |
| `set_description` | Set a human-written description for a file (persists across re-indexes) |
| `set_directory_description` | Set a description for a directory |
| `set_change_reason` | Annotate a recorded change with a reason |
| `get_changes` | View recent file changes with diffs and reasons |
| `search_files` | Search files by path or summary |
| `query` | Read-only SQL against the database |
| `execute` | Write SQL (INSERT/UPDATE/DELETE) |

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

Opens at `http://localhost:3333` with:

- Folder tree sidebar with expandable directories
- File detail panel: exports, packages, imports, dependents, folder metadata
- Change history with inline diffs and reasons
- Dependency graph that filters to the selected file's connections
- Live reload — watches for file changes and re-indexes automatically

## What gets indexed

- **Files** — path, language, size, line count, summary, auto-generated description, content
- **Exports** — name and kind (function, const, type, class, interface)
- **Dependencies** — which file imports what from which file, with symbol names
- **Directories** — file count, total lines, size, language breakdown, description
- **Changes** — append-only log of add/change/delete events with before/after snapshots, inline diffs, and reasons

## Context efficiency

Tested on this project (25 files, 7K lines):

| Metric | With MCP | Without MCP |
|--------|---------|-------------|
| Tokens per analysis | ~20K | ~62K |
| Raw data transferred | ~6K chars | ~111K chars |
| Tool calls | 7 | 16 |

The first index costs more (you need to read files to generate metadata). Every subsequent query is 3x cheaper. Break-even after ~2 uses.
