# get_changes

Get recent file changes grouped by file path, showing what changed (size, lines, exports, summary diffs).

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file_path` | string | no | Filter to a specific file path (supports `%` wildcards) |
| `limit` | number | no | Max changes to return (default 50) |

## Examples

All recent changes:
```
get_changes
```

Changes for a specific file:
```
get_changes file_path="%schema%"
```
