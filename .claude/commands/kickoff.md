# /kickoff — Full Sprint Lifecycle (Automated)

Run the complete sprint lifecycle from vision through retrospective using MCP tools. All steps are automated — no user input required during execution.

## How it works

1. Read existing project state
2. Derive vision, milestone, epics, and tickets from context
3. Create and start a sprint
4. Work through all tickets
5. Write retro findings
6. Close and archive the sprint

---

## Step 1 — Read Project State

```
get_project_status()
list_sprints()
list_epics()
list_discoveries({ status: "discovered" })
list_discoveries({ status: "planned" })
```

Check existing state with these resume rules:

- **Vision exists** → use it. If missing → derive from project name and code context, then call `update_vision({ content: "..." })`
- **Active milestone** → use it. If none → create one: `create_milestone({ name: "M1 — MVP", description: "...", status: "active" })`
- **Epics linked to milestone** → use them. If none → create 2–3 from discovery/context
- **Sprint in `implementation`** → skip to Step 4 (ticket loop)
- **Sprint in `done`** → skip to Step 5 (retro)
- **All sprints in `rest`** → start fresh from Step 2

---

## Step 2 — Discovery (Automated)

Read `list_discoveries({ status: "discovered" })`. For each discovery, use it to shape the sprint goal and tickets.

If no discoveries exist, derive scope from:
- Existing epics and their ticket coverage
- Recent retro findings via `analyze_retro_patterns()`
- Open items in the backlog via `get_backlog()`

---

## Step 3 — Plan and Start Sprint

```
start_sprint({
  name: "Sprint N — <descriptive name>",
  goal: "<one sentence, measurable>",
  milestone_id: <active milestone id>,
  velocity: <committed points based on velocity trends>,
  tickets: [
    { title: "...", description: "...", assigned_to: "<agent role>", story_points: N, priority: "P1" },
    ...
  ]
})
```

Rules:
- Assign tickets to roles from `list_agents()`
- Aim for ~19 story points total
- Auto-create a QA ticket (1pt, assigned to `qa`) for every feature ticket
- Link every ticket to an epic via `link_ticket_to_epic({ ticket_id, epic_id })`
- Advance sprint: `advance_sprint({ sprint_id })` → moves `planning → implementation`

---

## Step 4 — Work Through Tickets

For each ticket in priority order:

```
update_ticket({ ticket_id, status: "IN_PROGRESS" })
```

Do the work (read files, write code, run tests, check output). Then:

```
update_ticket({ ticket_id, status: "DONE", qa_verified: true, verified_by: "qa" })
```

**QA gate:** Verify the work actually happened before marking `qa_verified: true`. If it fails → `log_bug({ sprint_id, severity, description, ticket_id })` and keep the ticket `IN_PROGRESS`.

Once all tickets are DONE:

```
advance_sprint({ sprint_id })   # → done
```

---

## Step 5 — Retrospective (Automated)

Generate retro findings based on what happened this sprint:

```
add_retro_finding({ sprint_id, category: "went_well",  finding: "...", role: "developer" })
add_retro_finding({ sprint_id, category: "went_wrong", finding: "...", role: "qa" })
add_retro_finding({ sprint_id, category: "try_next",   finding: "...", role: "developer", action_owner: "developer" })
```

Then produce a cumulative summary by comparing with past sprints:

```
analyze_retro_patterns()
```

Summarize: what patterns repeat, what improved, what to prioritize next sprint.

---

## Step 6 — Close and Archive

```
advance_sprint({ sprint_id })   # → rest
```

Archive linked entities:

```
# Discoveries: mark implemented if their ticket is DONE, else dropped
update_discovery({ discovery_id, status: "implemented" })
update_discovery({ discovery_id, status: "dropped", drop_reason: "Sprint closed without completion" })

# Epics: complete if all tickets DONE
update_epic({ epic_id, status: "completed" })

# Milestone: complete if ALL epics done, else update progress %
update_milestone({ milestone_id, status: "completed", progress: 100 })
update_milestone({ milestone_id, progress: <calculated %> })
```

---

## Minimal chain (no issues)

```
 1. start_sprint(...)                                          # plan
 2. advance_sprint({ sprint_id })                             # → implementation
 3. update_ticket({ ticket_id, status: "IN_PROGRESS" })       # work
 4. update_ticket({ ticket_id, status: "DONE", qa_verified: true })
 5. advance_sprint({ sprint_id })                             # → done
 6. add_retro_finding({ sprint_id, category: "went_well",  ... })
 7. add_retro_finding({ sprint_id, category: "went_wrong", ... })
 8. add_retro_finding({ sprint_id, category: "try_next",   ... })
 9. advance_sprint({ sprint_id })                             # → rest
10. update_discovery({ discovery_id, status: "implemented" }) # archive
11. update_epic({ epic_id, status: "completed" })             # archive
12. update_milestone({ milestone_id, status: "completed" })   # archive
```

---

## Recovery

- **Sprint stuck?** → `get_sprint_playbook({ sprint_id })` tells you exactly what to fix
- **Wrong phase?** → `update_sprint({ sprint_id, status: "planning" })` to reset
- **See full state?** → `get_sprint({ sprint_id })` shows everything
