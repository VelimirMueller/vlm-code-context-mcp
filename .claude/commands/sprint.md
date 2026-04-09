# Sprint Lifecycle — Automated MCP Tool Chain

Run a complete sprint from planning to rest using code-context MCP tools. All data lives in context.db.

## Phase Flow

```
planning → implementation → done → rest → (next sprint)
```

## Step 0: Load Context

Before anything else, populate your context window from the MCP database. You may be a fresh agent with no prior conversation — the DB is your memory.

### 0a. Codebase context (ALWAYS first)

```
index_directory()                      # ensure file index is fresh
search_files({ query: "" })            # get file tree overview
```

### 0b. Essential reads

```
get_project_status()                   # overall health, setup status
get_sprint_playbook()                  # current phase, gates, next actions
list_sprints()                         # sprint landscape
list_agents()                          # team roster, roles, workload
get_velocity_trends()                  # capacity history
analyze_retro_patterns()               # lessons from past sprints
get_sprint_config()                    # process customization
```

### 0c. Sprint-specific reads

```
get_backlog()                          # unassigned / carryover tickets
get_mood_trends()                      # team health / burnout signals
list_discoveries({ status: "planned" }) # open discoveries to implement
list_epics()                           # active workstreams
```

### 0d. Display smart summary

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  CONTEXT LOADED                             │
│                                                 │
│   Project:  <name> — <file count> files indexed │
│   Sprints:  <completed> done, <active> active   │
│   Velocity: <avg> pts/sprint (trend: ↑/↓/→)    │
│   Team:     <N> agents (<active> active now)    │
│   Backlog:  <N> unassigned tickets              │
│   Codebase: <files> files, <exports> exports    │
│                                                 │
│   ⚠ <retro pattern warnings>                    │
│   ⚠ <mood/burnout concerns>                     │
│   ⚠ <velocity trend alerts>                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

Only show ⚠ lines when something is noteworthy.

---

## Step 1: Gather Planning Context

Using data from Step 0, make informed decisions:

- Use **velocity trends** to set realistic committed points
- Use **retro patterns** to avoid past mistakes (e.g., "auth tickets were underestimated last sprint")
- Use **backlog** to carry over unfinished work
- Use **agent workload** to balance ticket assignment
- Use **mood trends** to reduce load on burned-out agents
- Use **codebase context** to inform ticket scoping — call `get_file_context()` for files related to planned work

## Step 2: Create Sprint — `start_sprint`

One call creates the sprint + all tickets in `planning` phase:

```
start_sprint({
  name: "Sprint N — <descriptive name>",
  goal: "<one sentence, measurable>",
  milestone_id: <id>,
  velocity: <committed points based on velocity trends>,
  tickets: [
    { title: "...", description: "...", assigned_to: "<agent role>", story_points: N, priority: "P1" },
    ...
  ]
})
```

Rules:
- Assign tickets to roles from `list_agents()` (developer, qa, product-owner, devops)
- Total story points should match committed velocity
- Every ticket needs story points and a priority (P0-P3)
- Sprint goal must be measurable

Save the returned `sprint_id` — used in every subsequent call.

## Step 3: Start Implementation — `advance_sprint`

```
advance_sprint({ sprint_id: <id> })
```

This moves `planning → implementation`. Gate warnings appear if:
- Tickets are missing story points
- Velocity not committed

## Step 4: Work Through Tickets

Before working on each ticket, load its context from the DB:

```
get_ticket({ ticket_id: <id> })                    # full details, subtasks, bugs
search_files({ query: "<ticket keywords>" })       # find related code files
get_file_context({ path: "<relevant file>" })      # understand file role + deps
get_dependency_graph({ ticket_id: <id> })           # blocking relationships
```

**IMPORTANT: Before using the Read tool on any file, ALWAYS check the code context DB first:**
1. `search_files()` to find the right file
2. `get_file_context()` to understand its role, exports, imports, and dependents
3. Only then Read the actual file content — now you know what to look for

For each ticket:

```
update_ticket({ ticket_id: <id>, status: "IN_PROGRESS" })
```

Do the actual implementation work. Then mark done:

```
update_ticket({ ticket_id: <id>, status: "DONE", qa_verified: true, verified_by: "qa" })
```

### Handle Issues as They Arise

**Blockers:**
```
create_blocker({ sprint_id: <id>, description: "...", ticket_id: <id> })
# ... resolve the issue ...
resolve_blocker({ blocker_id: <id> })
```

**Bugs:**
```
log_bug({ sprint_id: <id>, severity: "HIGH", description: "...", ticket_id: <id> })
```

**Check progress anytime:**
```
get_sprint_playbook({ sprint_id: <id> })
```

The playbook shows current phase, ticket status, gate warnings, and exactly what to do next.

## Step 5: Complete Implementation — `advance_sprint`

Once all tickets are DONE:

```
advance_sprint({ sprint_id: <id> })
```

Moves `implementation → done`. Auto-calculates velocity and generates retro analysis. Gate warnings if tickets still in progress or blockers open.

## Step 6: Retrospective — `add_retro_finding`

Before the retro, load performance data:

```
get_sprint({ sprint_id: <id> })        # full sprint state
get_burndown({ sprint_id: <id> })      # point burndown over time
get_mood_trends()                      # team health changes
get_time_report({ sprint_id: <id> })   # actual vs estimated hours
analyze_retro_patterns()               # compare against historical patterns
```

Use this data to inform specific, data-backed findings — not generic observations.

Add at least one finding per category:

```
add_retro_finding({ sprint_id: <id>, category: "went_well", finding: "...", role: "developer" })
add_retro_finding({ sprint_id: <id>, category: "went_wrong", finding: "...", role: "qa" })
add_retro_finding({ sprint_id: <id>, category: "try_next", finding: "...", role: "developer", action_owner: "developer" })
```

Findings should be specific and actionable, not generic.

## Step 7: Rest — `advance_sprint`

```
advance_sprint({ sprint_id: <id> })
```

Moves `done → rest`. Gate warns if no retro findings logged.

## Step 8: Archive — Close Out Everything

After rest, archive all entities tied to the sprint:

**Discoveries:**
```
list_discoveries({ status: "planned" })
# For each linked to a DONE ticket:
update_discovery({ discovery_id: <id>, status: "implemented" })
# For each linked to a NOT_DONE/BLOCKED ticket:
update_discovery({ discovery_id: <id>, status: "dropped", drop_reason: "Sprint closed without completion" })
```

**Epics:**
```
list_epics({ status: "active" })
# For each epic where ALL tickets are DONE:
update_epic({ epic_id: <id>, status: "completed" })
```

**Milestones:**
```
# If ALL epics in the milestone are completed:
update_milestone({ milestone_id: <id>, status: "completed", progress: 100 })
# Otherwise, update progress percentage:
update_milestone({ milestone_id: <id>, progress: <calculated %> })
```

## Step 9: Next Sprint

Go back to Step 0. The context loading ensures you always start with fresh, complete state.

## Minimal Chain (no issues)

```
 0. index_directory() + get_project_status() + list_agents() + ...  # context
 1. start_sprint(...)                                         # plan
 2. advance_sprint({ sprint_id: N })                          # → implementation
 3. get_ticket() + search_files() + get_file_context()        # load ticket context
 4. update_ticket({ ticket_id: X, status: "IN_PROGRESS" })   # work
 5. update_ticket({ ticket_id: X, status: "DONE", qa_verified: true })
 6. advance_sprint({ sprint_id: N })                          # → done
 7. get_burndown() + get_mood_trends() + analyze_retro_patterns()  # retro context
 8. add_retro_finding({ sprint_id: N, category: "went_well", ... })
 9. add_retro_finding({ sprint_id: N, category: "went_wrong", ... })
10. add_retro_finding({ sprint_id: N, category: "try_next", ... })
11. advance_sprint({ sprint_id: N })                          # → rest
12. update_discovery({ discovery_id: D, status: "implemented" })  # archive
13. update_epic({ epic_id: E, status: "completed" })              # archive
14. update_milestone({ milestone_id: M, status: "completed" })    # archive
```

## Recovery

- **Sprint stuck?** `get_sprint_playbook()` tells you exactly what's blocking and what to do
- **Wrong phase?** `update_sprint({ sprint_id: N, status: "planning" })` to force-reset
- **Need to see everything?** `get_sprint({ sprint_id: N })` shows full sprint with tickets, bugs, blockers, retro

## Rules

1. **Context first.** Always load from MCP DB before acting. Never assume state.
2. **Code context before file reads.** Use `search_files()` and `get_file_context()` before any `Read` tool call.
3. **Surface anomalies.** Highlight retro patterns, mood concerns, velocity shifts to the user.
4. **Data-backed findings.** Use burndown, mood, and time data to write specific retro findings.
