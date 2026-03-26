# MCP Tools Overview

The server exposes these tools via the Model Context Protocol:

| Tool | Description |
|------|-------------|
| [`index_directory`](./index-directory) | Scan a directory and build the index |
| [`find_symbol`](./find-symbol) | Find which files export a given symbol |
| [`get_file_context`](./get-file-context) | Get full file context: exports, imports, dependents, changes |
| [`get_changes`](./get-changes) | View recent file changes with diffs |
| [`search_files`](./search-files) | Search indexed files by path or summary |
| [`query`](./query-execute) | Run read-only SQL against the database |
| [`execute`](./query-execute) | Run write SQL against the database |
