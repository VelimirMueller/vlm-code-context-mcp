# MCP Tools Overview

The server exposes **9 tools** via the Model Context Protocol. Tool descriptions and directory metadata are maintained by the MCP server itself — the same indexing engine that powers these tools also keeps their documentation up to date.

| Tool | Description |
|------|-------------|
| [`index_directory`](./index-directory) | Scan a directory and build the index |
| [`find_symbol`](./find-symbol) | Find which files export a given symbol |
| [`get_file_context`](./get-file-context) | Get full file context: exports, imports, dependents, changes |
| [`set_description`](./set-description) | Set a human-readable description for any indexed file |
| [`set_directory_description`](./set-directory-description) | Set a description for an indexed directory |
| [`get_changes`](./get-changes) | View recent file changes with diffs |
| [`search_files`](./search-files) | Search indexed files by path or summary |
| [`query`](./query-execute) | Run read-only SQL against the database |
| [`execute`](./query-execute) | Run write SQL against the database |

## Context Efficiency

MCP returns structured metadata (summaries, exports, dependency edges) instead of raw file contents. In practice this yields **~2.7x less context** than reading files directly, allowing AI agents to work with larger codebases without exceeding token limits.
