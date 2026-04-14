# Sprint Lifecycle

Sprints follow a 4-phase lifecycle: **planning → implementation → done → rest**.

## Creating a Sprint

Use `start_sprint` to create a sprint with tickets in one atomic call:

```
start_sprint({
  name: "Sprint 5 — Dashboard Polish",
  goal: "All dashboard pages responsive and error-handled",
  milestone_id: 3,
  velocity: 22,
  tickets: [
    { title: "Add error boundaries", story_points: 3, assigned_to: "fe-engineer", priority: "P1" },
    { title: "Mobile responsive layout", story_points: 5, assigned_to: "fe-engineer", priority: "P1" },
    { title: "Fix SSE reconnect", story_points: 2, assigned_to: "developer", priority: "P0" }
  ]
})
```

## Phase Transitions

```
planning → implementation → done → rest
```

Use `advance_sprint({ sprint_id })` to move between phases. Gates are advisory — the sprint always advances, but warnings surface when:

- **planning → implementation**: No tickets assigned, no velocity committed
- **implementation → done**: Tickets still IN_PROGRESS
- **done → rest**: No retro findings added

## Sprint Playbook

`get_sprint_playbook` returns the current phase, progress, gate status, and next actions:

```
get_sprint_playbook({ sprint_id: 5 })
# Full: phase, ticket breakdown, gate status, action items (~60 tokens)

get_sprint_playbook({ sprint_id: 5, compact: true })
# Compact: single-line status (~23 tokens)
```

## Sprint Reports

```
export_sprint_report({ sprint_id: 5 })
# Full markdown report with ticket table, bugs, blockers, retro

export_sprint_report({ sprint_id: 5, compact: true })
# One-line summary: "Sprint 5 [done]: 22/22pt, 8/8 tickets, 1 bug, 3 retro"
```

## Sprint Instructions

```
get_sprint_instructions()
# Auto-adapts: full guide for sprints 1-2, checklist+pitfalls for 3-9, pitfalls-only for 10+

get_sprint_instructions({ section: "checklist" })
# Single section only
```
