# index_directory

Scan a directory, parse all files, extract metadata/exports and build a dependency graph.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | yes | Absolute path to the directory to index |

## Example

```
index_directory /home/user/my-project
```

**Response:**
```
Indexed 42 files, 87 exports, 31 dependencies
```
