# /retro — Retrospective & Cumulative Learnings

Run retrospective for the current sprint and surface patterns from all past sprints.

## Step 0 — Load Context (2 calls)

```
get_resume_state()                                   # identify current sprint
load_phase_context({ phase: "retro", sprint_id })    # all retro data in one call
```

This returns sprint state, burndown, mood, retro patterns, and velocity comparison.

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

After logging findings, the retro patterns are already loaded from Step 0. Review them to surface:
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
2. **Code context before file reads.** Use `search_files()` and `get_file_context({ include_changes: false })` before any `Read` tool call.
3. **Data-backed findings.** Use burndown, mood, time, and velocity data to write specific observations.
4. **Surface recurring patterns.** If a finding echoes past sprints, call it out explicitly.
5. **Track mood.** If agent mood is declining, flag it as a try_next action item.
