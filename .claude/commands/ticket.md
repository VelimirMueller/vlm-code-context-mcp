# /ticket — Ticket Management

Move tickets through their lifecycle using MCP tools.

## Step 0 — Load Context

Before any ticket operation, load the full context. You may be a fresh agent.

### 0a. Codebase context (ALWAYS first)

```
index_directory()                      # ensure file index is fresh
search_files({ query: "" })            # get file tree overview
```

### 0b. Essential reads

```
get_project_status()                   # overall health
get_sprint_playbook()                  # current phase, gates, next actions
list_sprints()                         # sprint landscape
list_agents()                          # team roster, workload
get_velocity_trends()                  # capacity context
analyze_retro_patterns()               # past lessons
```

### 0c. Ticket-specific reads

```
get_sprint({ sprint_id: <id> })        # all tickets in current sprint
list_tickets({ status: "IN_PROGRESS" }) # what's actively being worked
list_tickets({ status: "BLOCKED" })    # what's stuck
get_dependency_graph()                 # blocking relationships
```

### 0d. Display smart summary

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  CONTEXT LOADED                             │
│                                                 │
│   Sprint:   <name> (<phase>)                    │
│   Tickets:  <done>/<total> done                 │
│   Active:   <N> in progress, <N> blocked        │
│   Team:     <N> agents                          │
│   Codebase: <files> files indexed               │
│                                                 │
│   ⚠ <blockers or anomalies>                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## View a ticket

Load full ticket context before acting:

```
get_ticket({ ticket_id: <id> })                    # full details, subtasks, bugs
get_dependency_graph({ ticket_id: <id> })           # what blocks / is blocked by
search_files({ query: "<ticket keywords>" })       # find related code
get_file_context({ path: "<relevant file>" })      # understand file deps
```

**IMPORTANT: Before reading any source file with the Read tool, ALWAYS check the code context DB first:**
1. `search_files()` — find the right file path
2. `get_file_context()` — understand its role, exports, imports, dependents
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
get_mood_trends()                      # avoid overloading burned-out agents
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
2. **Code context before file reads.** Use `search_files()` and `get_file_context()` before any `Read` tool call.
3. **Check workload before reassigning.** Don't pile tickets onto overloaded agents.
4. **Surface anomalies.** If a ticket has been in progress too long or has dependency issues, mention it.
