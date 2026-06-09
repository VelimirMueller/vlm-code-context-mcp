# index_directory

Scan a directory, parse all files, extract metadata/exports and build a dependency graph.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | yes | Absolute path to the directory to index |
| `freshness_check` | boolean | no | If `true`, skip re-indexing when the index is less than 5 minutes old. Returns a compact one-line summary instead of running a full index. |

## Response

A full index run returns a structured multi-section markdown document:

```
# Index Summary
Indexed 42 files, 87 exports, 31 dependencies

## Directories

### src/
Entry point and core modules. 12 files, 3,400 lines.
- **index.ts** — MCP server entry point; registers all tools and starts the transport
- **indexer.ts** — Walks the filesystem, parses files, and writes to the SQLite DB

### src/scrum/
- **tools/** (8 files) — Scrum MCP tool implementations

## Root Files

- **package.json** — Project manifest and dependency declarations
- **tsconfig.json** — TypeScript compiler configuration
```

When `freshness_check=true` and the index is less than 5 minutes old, re-indexing is skipped and a compact summary is returned instead:

```
Index fresh (2m ago): 42 files, 87 exports, 31 deps. Skipped re-index.
```

## Example

```
index_directory /home/user/my-project
```

```
index_directory /home/user/my-project freshness_check=true
```
