# /kickoff — Full Sprint Lifecycle

Run the complete sprint lifecycle from discovery through retrospective using MCP tools. Claude asks the user what to build, then automates the plan → implement → QA → retro → archive sequence.

## How it works

1. Read existing project state
2. **Ask the user** what to build (discovery)
3. Create and start a sprint from user input
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
get_backlog()
get_velocity_trends()
analyze_retro_patterns()
```

Check existing state with these resume rules:

- **Sprint in `implementation`** → skip to Step 4 (ticket loop)
- **Sprint in `done`** → skip to Step 5 (retro)
- **All sprints in `rest` or no sprints** → continue to Step 2 (discovery)

---

## Step 2 — Discovery (Interactive)

**Always ask the user.** Never invent features or derive scope silently.

Use `AskUserQuestion` to gather:

1. **What to build** — "What should this sprint focus on? Describe the features, fixes, or improvements you want."
2. **Sprint goal** — "What's the measurable goal for this sprint?" (offer examples based on what the user described)
3. **Milestone** — If no active milestone exists, ask: "What should we call this milestone?" with suggestions based on context. If one exists, confirm it's still the right one.
4. **Epic grouping** — If the work doesn't fit existing epics, ask: "How should we group this work?" and suggest 2–3 epic names based on the user's description.

After gathering answers, summarize the plan back to the user:
- Sprint name, goal, milestone
- Proposed tickets with point estimates and agent assignments
- Ask: "Does this plan look right? Any changes before I start?"

Only proceed to Step 3 after the user confirms.

**Context to share with the user** (helps them decide):
- Current velocity trend (from `get_velocity_trends()`)
- Retro patterns (from `analyze_retro_patterns()`) — what went well/wrong
- Open backlog items (from `get_backlog()`)
- Existing discoveries (from `list_discoveries()`)

---

## Step 3 — Plan and Start Sprint

Based on user-confirmed plan from Step 2:

1. **Milestone** — If none active, create one using the name the user chose:
   ```
   create_milestone({ name: "<user's milestone name>", description: "...", status: "active" })
   ```

2. **Vision** — If missing, set it from user's described goals:
   ```
   update_vision({ content: "..." })
   ```

3. **Epics** — Create any new epics the user confirmed:
   ```
   create_epic({ name: "...", description: "...", milestone_id: <id>, priority: N })
   ```

4. **Sprint** — Create with user-confirmed tickets:
   ```
   start_sprint({
     name: "Sprint N — <descriptive name from user>",
     goal: "<user's measurable goal>",
     milestone_id: <active milestone id>,
     velocity: <committed points based on velocity trends>,
     tickets: [
       { title: "...", description: "...", assigned_to: "<agent role>", story_points: N, priority: "P1" },
       ...
     ]
   })
   ```

5. **Link & advance**:
   ```
   link_ticket_to_epic({ ticket_id, epic_id })   # for each ticket
   advance_sprint({ sprint_id })                  # planning → implementation
   ```

Rules:
- Assign tickets to roles from `list_agents()`
- Aim for ~19 story points total
- Auto-create a QA ticket (1pt, assigned to `qa`) for every feature ticket
- Link every ticket to an epic via `link_ticket_to_epic({ ticket_id, epic_id })`

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
