# code-context-mcp

MCP server that indexes codebases into a SQLite database, exposing file metadata, exports, dependency graphs, and per-file change tracking.

## Features

- **File indexing** — scans directories, extracts metadata, summaries, exports, and import dependencies (JS/TS)
- **Change tracking** — records per-file diffs (added/removed/changed lines) between index runs
- **Symbol search** — find which files export a given function, type, or constant
- **Dependency graph** — maps internal import relationships between files
- **File descriptions** — set manual descriptions that persist across re-indexes
- **Dashboard** — web UI with file browser, detail view, change history, and dependency graph visualization
- **Live watching** — dashboard auto-reindexes on file changes via chokidar

## MCP Tools

| Tool | Description |
|------|-------------|
| `index_directory` | Scan a directory and build the index |
| `get_file_context` | Get file summary, exports, dependencies, and recent changes |
| `find_symbol` | Find files exporting a given symbol (supports `%` wildcards) |
| `search_files` | Search files by path or summary |
| `get_changes` | Get recent changes grouped by file |
| `set_description` | Set a manual description for a file |
| `query` | Run a read-only SELECT against the database |
| `execute` | Run INSERT/UPDATE/DELETE statements |

## Setup

```bash
npm install
npm run build
```

## Usage

### As an MCP server

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "code-context": {
      "command": "node",
      "args": ["dist/index.js", "./context.db"]
    }
  }
}
```

Then use the tools to index and query your codebase.

### Dashboard

```bash
npm run dashboard -- ./context.db 3333
```

Opens at `http://localhost:3333` with:
- File sidebar with language-colored indicators
- Detail panel showing exports, packages, imports, and dependents
- Changes tab with per-file diff history (collapsible inline diffs)
- Dependency graph visualization
- Live reload on file changes

## Schema

- **files** — path, language, size, line count, summary, description, content
- **exports** — name, kind (function/const/type/class/interface)
- **dependencies** — source file imports target file, with symbol list
- **changes** — per-file event log with before/after metadata and unified diff text
