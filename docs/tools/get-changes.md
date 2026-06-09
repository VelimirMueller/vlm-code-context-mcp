# get_changes

Get recent file changes grouped by file path, showing what changed (size, lines, exports, summary diffs).

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file_path` | string | no | Filter to a specific file path (supports `%` wildcards). If the value contains no `%`, it is automatically wrapped as `%value%` (substring match). |
| `limit` | number | no | Max changes to return (default 50) |

## Examples

All recent changes:
```
get_changes
```

Changes for a specific file (plain string — auto-wrapped to `%schema%`):
```
get_changes file_path="schema"
```

Changes using an explicit wildcard pattern:
```
get_changes file_path="%schema%"
```
