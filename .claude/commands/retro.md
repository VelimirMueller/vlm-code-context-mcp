# /retro — Retrospective & Cumulative Learnings

Run retrospective for the current sprint and surface patterns from all past sprints.

## Step 0 — Load Context

Before any retro operation, load the full context. You may be a fresh agent.

### 0a. Codebase context (ALWAYS first)

```
index_directory()                      # ensure file index is fresh
search_files({ query: "" })            # get file tree overview
```

### 0b. Essential reads

```
get_project_status()                   # overall health
list_sprints()                         # sprint landscape
list_agents()                          # team roster
get_velocity_trends()                  # capacity trends
get_sprint_config()                    # process settings
```

### 0c. Retro-specific reads

```
get_sprint({ sprint_id: <id> })        # full current sprint state
get_burndown({ sprint_id: <id> })      # how points burned down over time
get_mood_trends()                      # team health / burnout signals
get_time_report({ sprint_id: <id> })   # actual vs estimated hours
list_retro_findings()                  # all historical findings
analyze_retro_patterns()               # recurring themes across sprints
get_dependency_graph()                 # what blocked what
```

### 0d. Display smart summary

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  CONTEXT LOADED                             │
│                                                 │
│   Sprint:   <name> — <phase>                    │
│   Velocity: <completed>/<committed> pts (<pct>) │
│   Tickets:  <done>/<total> done                 │
│   Team:     <N> agents, avg mood <score>        │
│   History:  <N> past findings across <N> sprints│
│   Codebase: <files> files indexed               │
│                                                 │
│   ⚠ <velocity drop/gain vs last sprint>         │
│   ⚠ <recurring retro patterns to revisit>       │
│   ⚠ <mood concerns>                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

Use this data to inform specific, data-backed retro observations. For example:
- "Velocity dropped 20% — what caused it?"
- "Auth tickets were flagged as underestimated in Sprint 3 AND Sprint 5"
- "QA agent mood has been declining for 3 sprints"

---

## Step 1 — Add findings for the current sprint

Use the loaded performance data to write specific, actionable findings — not generic ones.

```
add_retro_finding({ sprint_id: <id>, category: "went_well",  finding: "<specific, data-backed>", role: "developer" })
add_retro_finding({ sprint_id: <id>, category: "went_wrong", finding: "<specific, data-backed>", role: "qa" })
add_retro_finding({ sprint_id: <id>, category: "try_next",   finding: "<experiment>", role: "developer", action_owner: "developer" })
```

## Step 2 — Cumulative summary

After logging findings, run:

```
analyze_retro_patterns()
```

This compares all past sprint findings and surfaces:
- Recurring problems (went_wrong appearing multiple sprints)
- Consistent wins to keep doing (went_well)
- Experiments that were tried and their outcomes

Summarize the patterns as a brief report. Group by category. Highlight anything that appeared in 3+ sprints.

## Step 3 — Advance sprint to rest

```
advance_sprint({ sprint_id: <id> })   # done → rest
```

## View past findings

```
list_retro_findings()                     # all findings
list_retro_findings({ sprint_id: <id> })  # specific sprint
```

## Rules

1. **Context first.** Always load from MCP DB before acting. Never assume state.
2. **Code context before file reads.** Use `search_files()` and `get_file_context()` before any `Read` tool call.
3. **Data-backed findings.** Use burndown, mood, time, and velocity data to write specific observations.
4. **Surface recurring patterns.** If a finding echoes past sprints, call it out explicitly.
5. **Track mood.** If agent mood is declining, flag it as a try_next action item.
