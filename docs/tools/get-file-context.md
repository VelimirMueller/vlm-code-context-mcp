# get_file_context

Get a file's summary, exports, dependencies (what it imports), dependents (what imports it), and recent change history.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | yes | Absolute file path |
| `include_changes` | boolean | no | Include recent change history with diffs (default: `true`). Set to `false` to save tokens. |
| `change_limit` | number | no | Max number of recent changes to include (default: `3`). |

## Output Sections

- **Header**: path, language, size, line count, timestamps, and `description` (if set separately from the auto-generated summary)
- **Exports**: list of exported symbols with kinds
- **External packages**: third-party imports
- **Imports from**: local file dependencies with symbols
- **Imported by**: reverse dependencies (who uses this file)
- **Recent changes**: last 3 changes by default (controlled by `change_limit`); omitted when `include_changes` is `false`
