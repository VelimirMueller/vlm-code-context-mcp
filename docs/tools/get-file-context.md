# get_file_context

Get a file's summary, exports, dependencies (what it imports), dependents (what imports it), and recent change history.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | yes | Absolute file path |

## Output Sections

- **Header**: path, language, size, line count, timestamps
- **Exports**: list of exported symbols with kinds
- **External packages**: third-party imports
- **Imports from**: local file dependencies with symbols
- **Imported by**: reverse dependencies (who uses this file)
- **Recent changes**: last 20 changes with diffs
