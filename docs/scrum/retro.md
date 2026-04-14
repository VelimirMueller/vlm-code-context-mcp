# Retro & Analytics

## Retrospective

Every sprint closes with a retrospective — 3 findings minimum:

```
add_retro_finding({ sprint_id: 5, category: "went_well", finding: "API design was clean" })
add_retro_finding({ sprint_id: 5, category: "went_wrong", finding: "Dashboard took longer than expected" })
add_retro_finding({ sprint_id: 5, category: "try_next", finding: "Pair program on complex UI", action_owner: "team-lead" })
```

### Retro Patterns

Analyze trends across sprints:

```
analyze_retro_patterns()
# Shows category distribution, action follow-through rate, recurring themes
```

## Burndown

Track daily progress within a sprint:

```
snapshot_sprint_metrics({ sprint_id: 5 })
# Captures current completed/remaining points

get_burndown({ sprint_id: 5 })
# Full: daily snapshots with added/removed points

get_burndown({ sprint_id: 5, compact: true })
# Compact: "Burndown Sprint 5: 18/22pts done, 4 remaining, on track (5 snapshots)"
```

## Sprint Reports

Generate a complete sprint summary:

```
export_sprint_report({ sprint_id: 5 })
# Full markdown: ticket table, bugs, blockers, retro findings

export_sprint_report({ sprint_id: 5, compact: true })
# One-line: "Sprint 5 [rest]: 22/22pt, 10/10 tickets, 0 bugs, 3 retro"
```

## Decisions

Log architectural and process decisions with rationale:

```
log_decision({
  title: "Use SQLite over PostgreSQL",
  rationale: "Zero-config, single-file, embedded — matches MCP server deployment model",
  alternatives: "PostgreSQL (too heavy), Redis (no relational queries)",
  category: "technical"
})
```

## Event Trail

Full audit log of every status change, ticket update, and sprint transition:

```
list_recent_events({ entity_type: "ticket", limit: 10 })
```
