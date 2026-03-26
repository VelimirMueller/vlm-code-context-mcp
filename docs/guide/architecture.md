# Architecture

## Project Structure

```
src/
├── server/          # MCP server + core logic
│   ├── index.ts     # MCP server entry point, tool definitions
│   ├── schema.ts    # SQLite schema (files, exports, dependencies, changes)
│   ├── indexer.ts   # File walker, parser, diff engine
│   └── setup.ts     # One-time setup script
├── dashboard/       # Web dashboard
│   ├── dashboard.ts # HTTP server + SSE + file watcher
│   └── dashboard.html
└── database/        # Standalone DB utilities
    └── setup.ts
```

## Data Model

### files
Stores metadata for every indexed file: path, language, size, line count, summary, and full content.

### exports
Tracks named exports from JS/TS files (functions, classes, types, constants).

### dependencies
Maps import relationships between files with the imported symbols.

### changes
Append-only log of file changes: add, change, delete events with before/after snapshots and inline diffs.

## How Indexing Works

1. **Walk** the directory tree, skipping ignored dirs (`node_modules`, `.git`, `dist`, etc.)
2. **Parse** each file for imports, exports, and a summary (JSDoc, comments, or export list)
3. **Upsert** file metadata into SQLite
4. **Resolve** import paths to build the dependency graph
5. **Diff** the before/after snapshots and log changes
