# MCP Tools API Reference

Complete reference for all 83 MCP tools provided by `vlm-code-context-mcp`.

## Table of Contents

- [Codebase Indexing Tools](#codebase-indexing-tools)
- [File Context & Search](#file-context--search)
- [Scrum Management](#scrum-management)
- [Query & Execute](#query--execute)
- [Project Status](#project-status)

---

## Codebase Indexing Tools

### `index_directory`

Scan a directory, parse all files, extract metadata/exports and build a dependency graph.

**Parameters:**
```typescript
{
  path: string  // Absolute path to the directory to index
}
```

**Returns:** Structured markdown with directories, files, exports, and summaries.

**Example:**
```javascript
// Index your project
await index_directory({ path: "/home/user/my-project" });

// Returns summary like:
// "Indexed 174 files, 328 exports, 59 dependencies"
// ## Directories
// ### src/
// - **index.ts** — Main entry point
// - **utils/** (12 files) — Utility functions
```

---

### `find_symbol`

Find which file(s) export a given function, component, type, or constant.

**Parameters:**
```typescript
{
  name: string  // Symbol name to search for (supports % wildcards)
}
```

**Returns:** List of files with matching exports, including file path and summary.

**Example:**
```javascript
// Find where useEffect is exported
await find_symbol({ name: "useEffect" });
// Returns: "useEffect (hook) — src/hooks/index.ts
//          Custom React useEffect hook with cleanup handling"

// Wildcard search
await find_symbol({ name: "%Service" });
// Returns all symbols ending in "Service"
```

---

## File Context & Search

### `get_file_context`

Get a file's summary, its exports, what it imports (dependencies), and what imports it (dependents).

**Parameters:**
```typescript
{
  path: string  // Absolute file path
}
```

**Returns:** Comprehensive file metadata including:
- Language, extension, size, line count
- Created/modified/indexed timestamps
- All exports with kinds (function, type, constant)
- Internal dependencies (imports from other files)
- External packages imported
- Files that import this one
- Recent change history

**Example:**
```javascript
await get_file_context({ path: "/home/user/project/src/utils.ts" });
// Returns:
// "# src/utils.ts
// Language: TypeScript | Extension: .ts | Size: 4.2 KB | Lines: 145
// ## Exports (5)
//   - formatDate (function)
//   - debounce (function)
//   - DEFAULT_TIMEOUT (constant)"
```

---

### `search_files`

Search indexed files by path or summary (supports `%` wildcards).

**Parameters:**
```typescript
{
  query: string  // Search term (matched against path and summary)
}
```

**Returns:** List of matching files with metadata.

**Example:**
```javascript
await search_files({ query: "test" });
// Returns all files with "test" in path or summary

await search_files({ query: "%.test.ts" });
// Returns files ending in ".test.ts"
```

---

### `set_description`

Set a manual description for a file (persists across re-indexes).

**Parameters:**
```typescript
{
  path: string,        // Absolute file path
  description: string  // Description of what the file does
}
```

**Example:**
```javascript
await set_description({
  path: "/home/user/project/src/core.ts",
  description: "Core business logic for order processing"
});
```

---

### `set_directory_description`

Set a manual description for a directory (persists across re-indexes).

**Parameters:**
```typescript
{
  path: string,        // Absolute directory path
  description: string  // Description of what the directory contains
}
```

---

### `get_changes`

Get recent file changes grouped by file path, showing what changed (size, lines, exports, summary diffs).

**Parameters:**
```typescript
{
  file_path?: string,  // Filter to specific file (supports % wildcards)
  limit?: number       // Max changes to return (default 50)
}
```

**Returns:** Grouped changes by file with before/after comparisons.

---

## Scrum Management

### `get_project_status`

Check project setup status and return what is configured vs missing.

**Parameters:** None

**Returns:** Project health including file count, agent count, sprint count, and setup status.

**Example:**
```javascript
await get_project_status();
// Returns:
// "Files indexed: 195
//  Agents: 7
//  Sprints: 2
//  Tickets: 19
//  Skills: 5
// Project is set up and ready."
```

---

### `list_sprints`

List all sprints with status and ticket counts.

**Parameters:**
```typescript
{
  status?: string  // Filter by status: planning|implementation|qa|done|rest|closed
}
```

**Returns:** All sprints with goal, ticket counts, and completion status.

---

### `get_sprint`

Get full sprint details with tickets, bugs, blockers, and retro findings.

**Parameters:**
```typescript
{
  sprint_id: number  // Sprint ID
}
```

**Returns:** Complete sprint information including all tickets and their status.

---

### `create_sprint`

Create a new sprint.

**Parameters:**
```typescript
{
  name: string,           // Sprint name (e.g. 'sprint-2026-04-07')
  goal: string,           // Sprint goal
  start_date?: string,    // Start date (ISO 8601)
  end_date?: string,      // End date (ISO 8601)
  milestone_id?: number   // Milestone ID to associate with
}
```

---

### `start_sprint`

Create a sprint with tickets in one call. Creates the sprint, creates tickets, assigns agents, links to milestone/epic.

**Parameters:**
```typescript
{
  name: string,
  goal: string,
  milestone_id?: number,
  epic_id?: number,
  velocity?: number,
  start_date?: string,
  end_date?: string,
  tickets: Array<{
    title: string,
    description?: string,
    priority?: "P0" | "P1" | "P2" | "P3",
    assigned_to?: string,
    story_points?: number
  }>
}
```

**Example:**
```javascript
await start_sprint({
  name: "Sprint 4 — Feature X",
  goal: "Complete user authentication flow",
  velocity: 19,
  tickets: [
    { title: "Add login form", story_points: 5, assigned_to: "fe-engineer" },
    { title: "Implement auth API", story_points: 5, assigned_to: "be-engineer" }
  ]
});
```

---

### `advance_sprint`

Advance sprint to the next phase. Checks all gates, advances if they pass, returns summary + next actions.

**Parameters:**
```typescript
{
  sprint_id: number,
  velocity_completed?: number  // Required when advancing to closed
}
```

**Returns:** Sprint status after phase transition with any warnings or next actions required.

---

### `update_ticket`

Update a ticket's status, assignment, milestone, epic, or QA verification.

**Parameters:**
```typescript
{
  ticket_id: number,
  status?: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "PARTIAL" | "NOT_DONE",
  assigned_to?: string,
  qa_verified?: boolean,
  verified_by?: string,
  notes?: string,
  milestone_id?: number | null,
  epic_id?: number | null
}
```

**Example:**
```javascript
// Mark ticket as done and QA verified
await update_ticket({
  ticket_id: 42,
  status: "DONE",
  qa_verified: true,
  verified_by: "qa"
});
```

---

### `create_ticket`

Create a new ticket in a sprint.

**Parameters:**
```typescript
{
  sprint_id: number,
  title: string,
  ticket_ref?: string,      // Reference ID (e.g. T-021)
  description?: string,
  priority?: "P0" | "P1" | "P2" | "P3",
  assigned_to?: string,
  story_points?: number,
  milestone?: string,
  milestone_id?: number,
  epic_id?: number
}
```

---

### `list_tickets`

List tickets with optional filters.

**Parameters:**
```typescript
{
  sprint_id?: number,
  status?: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "PARTIAL" | "NOT_DONE",
  assigned_to?: string
}
```

---

### `get_ticket`

Get full ticket details with subtasks and linked bugs.

**Parameters:**
```typescript
{
  ticket_id: number
}
```

---

## Epics & Milestones

### `create_epic`

Create a new epic to group related tickets.

**Parameters:**
```typescript
{
  name: string,
  description?: string,
  milestone_id?: number,
  color?: string,    // Hex color (default #3b82f6)
  priority?: number  // 0-4 (default 0)
}
```

---

### `update_epic`

Update an existing epic's fields.

**Parameters:**
```typescript
{
  epic_id: number,
  name?: string,
  description?: string,
  status?: string,
  color?: string,
  priority?: number
}
```

---

### `link_ticket_to_epic`

Link a ticket to an epic, or unlink by passing null epic_id.

**Parameters:**
```typescript
{
  ticket_id: number,
  epic_id: number | null
}
```

---

### `list_epics`

List epics with optional status and milestone filters, including ticket progress counts.

**Parameters:**
```typescript
{
  status?: string,
  milestone_id?: number
}
```

---

### `create_milestone`

Create a new milestone for the product roadmap.

**Parameters:**
```typescript
{
  name: string,             // Must be unique
  description?: string,
  target_date?: string,     // ISO 8601
  status?: "planned" | "active" | "completed"
}
```

---

### `update_milestone`

Update a milestone's status, progress, or details.

**Parameters:**
```typescript
{
  milestone_id: number,
  status?: "planned" | "active" | "completed",
  description?: string,
  progress?: number,    // 0-100
  target_date?: string
}
```

---

## Query & Execute (SQL Escape Hatches)

### `query`

Run a read-only SELECT query against the context database.

**Parameters:**
```typescript
{
  sql: string  // A SELECT SQL statement
}
```

**Returns:** JSON array of query results.

**Example:**
```javascript
await query({ sql: "SELECT * FROM tickets WHERE status = 'DONE'" });
// Returns: [{ id: 1, title: "...", status: "DONE" }, ...]
```

---

### `execute`

Run an INSERT, UPDATE, or DELETE against the context database.

**Parameters:**
```typescript
{
  sql: string,                // A write SQL statement
  params?: Array<any>          // Optional positional parameters
}
```

**Returns:** Rows affected and last insert ID.

**Example:**
```javascript
await execute({
  sql: "UPDATE tickets SET status = ? WHERE id = ?",
  params: ["DONE", 42]
});
// Returns: "Rows affected: 1, last id: 127"
```

---

## Agents

### `list_agents`

List all scrum team agents with their roles and capabilities.

**Parameters:** None

**Returns:** All agents with role, name, description, and model.

---

### `get_agent`

Get full details of a scrum agent by role.

**Parameters:**
```typescript
{
  role: string  // e.g. 'backend-developer'
}
```

---

### `record_mood`

Record an agent's mood for a sprint (1-5 scale) for burnout detection.

**Parameters:**
```typescript
{
  agent_id: number,
  sprint_id: number,
  mood: number,        // 1-5 (1=burned out, 5=energized)
  workload_points?: number,
  notes?: string
}
```

---

### `get_mood_trends`

Get mood history for an agent or all agents — detects burnout patterns.

**Parameters:**
```typescript
{
  agent_id?: number,
  last_n_sprints?: number
}
```

---

## Blockers & Bugs

### `create_blocker`

Report a blocker on a sprint.

**Parameters:**
```typescript
{
  sprint_id: number,
  description: string,
  ticket_id?: number,
  reported_by?: string,
  escalated_to?: string
}
```

---

### `resolve_blocker`

Mark a blocker as resolved.

**Parameters:**
```typescript
{
  blocker_id: number
}
```

---

### `log_bug`

Log a bug against a sprint.

**Parameters:**
```typescript
{
  sprint_id: number,
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  description: string,
  ticket_id?: number,
  steps_to_reproduce?: string,
  expected?: string,
  actual?: string
}
```

---

## Retrospective

### `add_retro_finding`

Add a retrospective finding to a sprint.

**Parameters:**
```typescript
{
  sprint_id: number,
  category: "went_well" | "went_wrong" | "try_next",
  finding: string,
  role: string,
  action_owner?: string
}
```

---

### `list_retro_findings`

List retrospective findings with optional filters.

**Parameters:**
```typescript
{
  sprint_id?: number,
  category?: "went_well" | "went_wrong" | "try_next"
}
```

---

### `analyze_retro_patterns`

Analyze retrospective findings across all sprints — category breakdown, recurring issues, and action follow-through rate.

**Parameters:** None

---

## Dependencies

### `add_dependency`

Add a dependency between two tickets.

**Parameters:**
```typescript
{
  source_ticket_id: number,
  target_ticket_id: number,
  dependency_type: "blocks" | "blocked_by" | "related"
}
```

---

### `remove_dependency`

Remove a dependency between two tickets.

**Parameters:**
```typescript
{
  source_ticket_id: number,
  target_ticket_id: number
}
```

---

### `get_dependency_graph`

Get all dependencies for a ticket or sprint.

**Parameters:**
```typescript
{
  ticket_id?: number,
  sprint_id?: number
}
```

---

## Discoveries

### `create_discovery`

Log a finding from a discovery sprint.

**Parameters:**
```typescript
{
  sprint_id: number,
  finding: string,
  resolution_plan: string,
  category?: "architecture" | "ux" | "performance" | "testing" | "integration" | "general",
  priority?: "P0" | "P1" | "P2" | "P3",
  created_by?: string
}
```

---

### `update_discovery`

Update a discovery's status, priority, or drop reason.

**Parameters:**
```typescript
{
  discovery_id: number,
  status?: "discovered" | "planned" | "implemented" | "dropped",
  priority?: "P0" | "P1" | "P2" | "P3",
  drop_reason?: string,
  resolution_plan?: string
}
```

---

### `list_discoveries`

List discovery findings with optional filters.

**Parameters:**
```typescript
{
  sprint_id?: number,
  status?: "discovered" | "planned" | "implemented" | "dropped",
  category?: "architecture" | "ux" | "performance" | "testing" | "integration" | "general"
}
```

---

## Time Tracking

### `log_time`

Log estimated or actual hours on a ticket.

**Parameters:**
```typescript
{
  ticket_id: number,
  estimated_hours?: number,
  actual_hours?: number
}
```

---

### `get_time_report`

Get time tracking report for a sprint — estimated vs actual hours per agent.

**Parameters:**
```typescript
{
  sprint_id: number
}
```

---

## Velocity & Metrics

### `get_burndown`

Get burndown data for a sprint — daily snapshots of remaining vs completed points.

**Parameters:**
```typescript
{
  sprint_id: number
}
```

---

### `get_velocity_trends`

Get velocity trend data across sprints — committed vs completed, completion rate, bugs.

**Parameters:**
```typescript
{
  last_n_sprints?: number,
  status?: string
}
```

---

## Vision & Skills

### `update_vision`

Create or update the PRODUCT_VISION skill content.

**Parameters:**
```typescript
{
  content: string  // Markdown product vision content
}
```

---

### `list_skills`

List all available skills with usage counts.

**Parameters:** None

---

## Database Management

### `dump_database`

Export the entire database to JSON for backup/restore.

**Parameters:**
```typescript
{
  tables?: Array<string>  // Specific tables to export (default: all)
}
```

---

### `restore_database`

Restore database from a JSON dump.

**Parameters:**
```typescript
{
  dump_json: string  // The full JSON dump string
}
```

---

### `export_to_file`

Export database to a JSON file on disk.

**Parameters:**
```typescript
{
  output_path?: string  // File path (default: ./code-context-dump.json)
}
```

---

### `import_from_file`

Restore database from a JSON dump file on disk.

**Parameters:**
```typescript
{
  input_path: string  // Path to the JSON dump file
}
```

---

## Full Reference

For complete tool listings with all 83 tools, use the MCP tool inspector or call `list_agents` to see team capabilities.
