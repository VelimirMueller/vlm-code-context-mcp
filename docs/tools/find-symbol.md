# find_symbol

Find which file(s) export a given function, component, type, or constant.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Symbol name to search for (supports `%` wildcards) |

## Examples

Exact match:
```
find_symbol initSchema
```

Wildcard:
```
find_symbol %Schema%
```
