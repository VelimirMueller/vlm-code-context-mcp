# Sprint Lifecycle — Automated MCP Tool Chain

Run a complete sprint from planning to rest using code-context MCP tools. All data lives in context.db.

## Phase Flow

```
planning → implementation → done → rest → (next sprint)
```

## Step 1: Gather Context

Before creating the sprint, understand current state:

```
get_project_status()
get_backlog()
list_sprints({ status: "rest" })      # find last completed sprint
get_velocity_trends()                  # understand capacity
analyze_retro_patterns()               # learn from past sprints
```

Use retro patterns and velocity to inform ticket sizing and sprint goal.

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

For each ticket, follow this cycle:

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

Go back to Step 1. Use `get_velocity_trends()` and `analyze_retro_patterns()` to improve.

## Minimal Chain (no issues)

```
 1. start_sprint(...)                                         # plan
 2. advance_sprint({ sprint_id: N })                          # → implementation
 3. update_ticket({ ticket_id: X, status: "IN_PROGRESS" })   # work
 4. update_ticket({ ticket_id: X, status: "DONE", qa_verified: true })
 5. advance_sprint({ sprint_id: N })                          # → done
 6. add_retro_finding({ sprint_id: N, category: "went_well", ... })
 7. add_retro_finding({ sprint_id: N, category: "went_wrong", ... })
 8. add_retro_finding({ sprint_id: N, category: "try_next", ... })
 9. advance_sprint({ sprint_id: N })                          # → rest
10. update_discovery({ discovery_id: D, status: "implemented" })  # archive
11. update_epic({ epic_id: E, status: "completed" })              # archive
12. update_milestone({ milestone_id: M, status: "completed" })    # archive
```

## Recovery

- **Sprint stuck?** `get_sprint_playbook()` tells you exactly what's blocking and what to do
- **Wrong phase?** `update_sprint({ sprint_id: N, status: "planning" })` to force-reset
- **Need to see everything?** `get_sprint({ sprint_id: N })` shows full sprint with tickets, bugs, blockers, retro
