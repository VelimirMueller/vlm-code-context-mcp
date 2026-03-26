# search_files

Search indexed files by path or summary (supports `%` wildcards).

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | yes | Search term matched against path and summary |

## Examples

```
search_files schema
search_files %dashboard%
```
