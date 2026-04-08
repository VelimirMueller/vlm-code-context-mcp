# /retro — Retrospective & Cumulative Learnings

Run retrospective for the current sprint and surface patterns from all past sprints.

## Step 1 — Add findings for the current sprint

```
add_retro_finding({ sprint_id: <id>, category: "went_well",  finding: "<specific, actionable>", role: "developer" })
add_retro_finding({ sprint_id: <id>, category: "went_wrong", finding: "<specific, actionable>", role: "qa" })
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
