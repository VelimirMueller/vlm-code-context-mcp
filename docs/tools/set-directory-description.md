# set_directory_description

Set a description for an indexed directory.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | yes | Absolute directory path |
| `description` | string | yes | Human-readable description |

## Example

```
set_directory_description({
  path: "/home/user/project/src/auth",
  description: "Authentication and authorization — JWT handling, session management, role-based access control"
})
```

## Notes

Directory descriptions appear in `index_directory` output and help AI agents navigate the codebase structure. They persist across re-indexing.
