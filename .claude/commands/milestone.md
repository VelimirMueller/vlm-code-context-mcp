# /milestone — Milestone Management

Create, update, and close milestones using MCP tools.

## Step 0 — Load Context (1-2 calls)

```
get_resume_state()                     # project state, milestones, epics
```

### Deferred — use `load_phase_context()` when needed

| Action | Call |
|--------|------|
| View epics for milestone | `load_phase_context({ phase: "epics" })` |
| Estimate remaining sprints | `load_phase_context({ phase: "tickets" })` (has velocity) |
| Review discovery coverage | `load_phase_context({ phase: "discovery" })` |

---

## View milestones

Already loaded in Step 0. Display the data from `get_resume_state()`.

## Update milestone progress

```
update_milestone({ milestone_id: <id>, progress: <0-100> })
```

## Close / complete a milestone

First verify all epics are done (use data from Step 0):

```
list_epics({ milestone_id: <id> })
```

Only close if ALL epics linked to it are completed:

```
update_milestone({ milestone_id: <id>, status: "completed", progress: 100 })
```

## Archive a finished milestone

Archive hides a completed milestone (and, separately, completed epics) from lists and the dashboard. It does not change status or metrics.

```
update_milestone({ milestone_id: <id>, archived: true })     # must be completed
update_epic({ epic_id: <id>, archived: true })               # same rule for epics
list_milestones({ include_archived: true })                  # find archived ones
update_milestone({ milestone_id: <id>, archived: false })    # restore
```

Only use `force: true` to archive unfinished work when the user asks for it.

## Update milestone details

```
update_milestone({ milestone_id: <id>, description: "...", target_date: "2026-05-01" })
```

## Link a sprint to a milestone

```
# Via sprint creation
start_sprint({ ..., milestone_id: <id> })

# Or update existing sprint
update_sprint({ sprint_id: <id>, milestone_id: <id> })
```

## Link epic to milestone

```
create_epic({ name: "...", description: "...", milestone_id: <id> })
```

## Rules

1. **Context first.** Always load from MCP DB before acting. Never assume state.
2. **Code context before file reads.** Use `search_files()` and `get_file_context({ include_changes: false })` before any `Read` tool call.
3. **Surface anomalies.** Flag milestones past target date, epics with no progress, or discoveries not yet implemented.
4. **Verify before closing.** Never close a milestone without checking all epics are completed.
