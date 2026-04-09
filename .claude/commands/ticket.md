# /ticket — Ticket Management

Move tickets through their lifecycle using MCP tools.

## Step 0 — Load Context (2 calls)

```
get_resume_state()                     # project state + active sprint
get_sprint_playbook()                  # current phase, gates, next actions
```

### Deferred — use `load_phase_context()` when needed

| Action | Call |
|--------|------|
| View/work on ticket | `load_phase_context({ phase: "implementation", sprint_id, ticket_id })` |
| Reassign ticket | `list_agents()` |

---

## View a ticket

Load full ticket context before acting:

```
get_ticket({ ticket_id: <id> })                                    # full details, subtasks, bugs
search_files({ query: "<ticket keywords>" })                       # find related code
get_file_context({ path: "<relevant file>", include_changes: false })  # deps only, skip diff history
```

**Before reading any source file with the Read tool, check the code context DB first:**
1. `search_files()` — find the right file path
2. `get_file_context({ include_changes: false })` — deps and exports, skip change history
3. Only then use Read to see actual content

## Move a ticket

```
update_ticket({ ticket_id: <id>, status: "IN_PROGRESS" })
update_ticket({ ticket_id: <id>, status: "DONE", qa_verified: true, verified_by: "qa" })
update_ticket({ ticket_id: <id>, status: "BLOCKED" })
update_ticket({ ticket_id: <id>, status: "NOT_DONE" })
```

## Reassign a ticket

Check agent workload first:

```
list_agents()                          # see who has capacity
load_phase_context({ phase: "retro" }) # includes mood data for workload assessment
```

Then:

```
update_ticket({ ticket_id: <id>, assigned_to: "<agent role>" })
```

## Link ticket to epic / milestone

```
link_ticket_to_epic({ ticket_id: <id>, epic_id: <id> })
link_ticket_to_milestone({ ticket_id: <id>, milestone_id: <id> })
```

## List all tickets in a sprint

```
get_sprint({ sprint_id: <id> })
```

## Log a bug against a ticket

```
log_bug({ sprint_id: <id>, ticket_id: <id>, severity: "HIGH", description: "...", expected: "...", actual: "..." })
```

## Block / unblock

```
create_blocker({ sprint_id: <id>, ticket_id: <id>, description: "..." })
resolve_blocker({ blocker_id: <id> })
```

## Rules

1. **Context first.** Always load from MCP DB before acting. Never assume state.
2. **Code context before file reads.** Use `search_files()` and `get_file_context({ include_changes: false })` before any `Read` tool call.
3. **Check workload before reassigning.** Don't pile tickets onto overloaded agents.
4. **Surface anomalies.** If a ticket has been in progress too long or has dependency issues, mention it.
