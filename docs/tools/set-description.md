# set_description

Set a human-readable description for any indexed file.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | yes | Absolute file path |
| `description` | string | yes | Human-readable description |

## Example

```
set_description({
  path: "/home/user/project/src/auth/middleware.ts",
  description: "Express middleware that validates JWT tokens and attaches user to req.user"
})
```

## Notes

Descriptions persist in the SQLite database and appear in `get_file_context` and `index_directory` output. They help AI agents understand file purpose without reading the full source.
