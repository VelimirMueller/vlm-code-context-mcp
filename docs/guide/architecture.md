# Architecture

## Project Structure

### `src/` — TypeScript source code

Server, dashboard, and database modules. 7 files, 2,430 lines, 111KB.

#### `src/server/` — Core MCP server logic

Tool definitions, database schema, file indexer, and setup script. 4 files, 1,013 lines, 42KB, all TypeScript.

| File | Lines | Size | Description |
|------|------:|-----:|-------------|
| `index.ts` | 333 | 14.6KB | MCP server entry point. Registers all tools (`index_directory`, `find_symbol`, `get_file_context`, `set_description`, `set_directory_description`, `get_changes`, `search_files`, `query`, `execute`) and connects via stdio transport. |
| `schema.ts` | 82 | 2.9KB | SQLite schema definitions. Creates tables for files, exports, dependencies, directories, and changes with appropriate indexes for fast lookups. |
| `indexer.ts` | 532 | 21.7KB | Core indexing engine. Walks directories, parses JS/TS imports and exports, extracts summaries from comments/JSDoc, resolves dependency graphs, computes diffs between index runs, and aggregates directory metadata. |
| `setup.ts` | 66 | 2.5KB | One-time setup script. Initializes the database, indexes a target directory, and writes `.mcp.json` configuration for AI client integration. |

#### `src/dashboard/` — Web dashboard

HTTP server, API endpoints, and the single-page explorer UI. 2 files, 1,391 lines, 69KB.

| File | Lines | Size | Description |
|------|------:|-----:|-------------|
| `dashboard.ts` | 672 | 31KB | HTTP server for the web dashboard. Serves the HTML UI, provides JSON API endpoints for files, directories, stats, graph data, and changes. Includes SSE for live updates and chokidar file watcher for auto-reindexing. |
| `dashboard.html` | 719 | 37KB | Single-page dashboard UI. Features a folder tree sidebar, file detail panel with exports/imports/dependents, change history with inline diffs, and a dependency graph visualization. Styled to match the portfolio design language. |

#### `src/database/` — Standalone database utilities

Utilities for testing and prototyping. 1 file, 26 lines.

| File | Lines | Size | Description |
|------|------:|-----:|-------------|
| `setup.ts` | 26 | 646B | Standalone database utility. Creates a sample SQLite database with users and products tables for testing purposes. |

#### `docs/` — VitePress documentation site

Guides, tool references, and architecture docs. 12 files.

| Subdirectory | Description |
|--------------|-------------|
| `docs/guide/` | Getting started guide and architecture overview (2 files) |
| `docs/tools/` | Reference pages for each MCP tool — parameters, examples, and usage (7 files) |

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
