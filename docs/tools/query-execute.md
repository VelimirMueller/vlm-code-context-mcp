# query / execute

Escape-hatch tools for direct SQL access to the context database.

## query

Run a read-only `SELECT` statement.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sql` | string | yes | A SELECT SQL statement |

```
query sql="SELECT path, line_count FROM files ORDER BY line_count DESC LIMIT 5"
```

## execute

Run an `INSERT`, `UPDATE`, or `DELETE` statement.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sql` | string | yes | A write SQL statement |
| `params` | array | no | Optional positional parameters |

```
execute sql="UPDATE files SET description = ? WHERE path = ?" params=["Main entry point", "/home/user/project/src/index.ts"]
```
