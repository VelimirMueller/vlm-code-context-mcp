# /retro — Retrospective & Cumulative Learnings

Run retrospective for the current sprint and surface patterns from all past sprints.

## Step 0 — Load Context (2 calls)

```
get_resume_state()                                   # identify current sprint
load_phase_context({ phase: "retro", sprint_id })    # all retro data in one call
```

This returns sprint state, burndown, mood, retro patterns (including the try_next lifecycle: open/adopted/dropped counts), and velocity comparison.

Use this data to inform specific, data-backed retro observations. For example:
- "Velocity dropped 20% — what caused it?"
- "Auth tickets were flagged as underestimated in Sprint 3 AND Sprint 5"
- "QA agent mood has been declining for 3 sprints"

---

## Step 1 — Add findings for the current sprint

Ask the three reflections **one at a time as free text** (they are genuinely open-ended — no option chips): went_well, went_wrong, try_next. Where a finding echoes loaded data, quote the numbers.

For try_next, confirm the **action_owner** via AskUserQuestion (the 9 team roles, recommended owner first).

```
add_retro_finding({ sprint_id: <id>, category: "went_well",  finding: "<specific, data-backed>", role: "developer" })
add_retro_finding({ sprint_id: <id>, category: "went_wrong", finding: "<specific, data-backed>", role: "qa" })
add_retro_finding({ sprint_id: <id>, category: "try_next",   finding: "<experiment>", role: "developer", action_owner: "developer" })
```

**Lifecycle note:** every try_next enters the planning gate as `open`. It will demand a triage decision (adopt / drop / defer via `triage_retro_finding`) at the next sprint's planning — capture happens here, the decision happens there. Tell the user this so the experiment doesn't feel like it vanishes into a list.

## Step 2 — Cumulative summary

The retro patterns are already loaded from Step 0. Review them to surface:
- Recurring problems (went_wrong appearing multiple sprints)
- Consistent wins to keep doing (went_well)
- try_next follow-through: triage rate, applied rate, and the oldest still-open item

Summarize as a brief report. Group by category. Highlight anything that appeared in 3+ sprints, and call out open try_next items that have been deferred more than twice.

## Step 3 — Advance sprint to rest

```
advance_sprint({ sprint_id: <id>, format: "card" })   # done → rest — print the card verbatim in a ```diff fence
```

## View past findings

```
list_retro_findings()                     # all findings
list_retro_findings({ sprint_id: <id> })  # specific sprint
list_retro_findings({ category: "try_next" })  # the gate's working set
```

## Rules

1. **Context first.** Always load from MCP DB before acting. Never assume state.
2. **Code context before file reads.** Use `search_files()` and `get_file_context({ include_changes: false })` before any `Read` tool call.
3. **Data-backed findings.** Use burndown, mood, time, and velocity data to write specific observations.
4. **Surface recurring patterns.** If a finding echoes past sprints, call it out explicitly.
5. **Track mood.** If agent mood is declining, flag it as a try_next action item.
6. **Server cards are verbatim** — print `format: "card"` output unchanged inside ```diff fences.
