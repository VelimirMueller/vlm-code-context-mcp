# Milestones & Discovery

## Milestones

Milestones are big goals that span multiple sprints — think "v1.0 Launch" or "Beta Release".

```
create_milestone({
  name: "M1 — MVP Launch",
  description: "Core features complete, docs deployed, CI green",
  target_date: "2026-05-01"
})
```

### Progress Tracking

Milestone progress is calculated from linked epic completion:

```
update_milestone({ milestone_id: 1, progress: 75 })
```

When all linked epics are completed, close the milestone:

```
update_milestone({ milestone_id: 1, status: "completed", progress: 100 })
```

## Discovery

Discoveries track unknowns that need investigation before building — spikes, risks, scope decisions, and architecture questions.

```
create_discovery({
  sprint_id: 5,
  finding: "API needs rate limiting before public launch",
  category: "architecture",
  priority: "P1",
  resolution_plan: "Spike: evaluate express-rate-limit vs custom middleware. 2hrs."
})
```

### Discovery Lifecycle

```
discovered → planned → implemented (or dropped)
```

Link a discovery to the ticket that resolves it:

```
link_discovery_to_ticket({ discovery_id: 3, ticket_id: 42 })
```

When the linked ticket moves to DONE, the discovery auto-promotes to `implemented`.

### Listing Discoveries

```
list_discoveries({ status: "planned" })
# Full mode: all metadata per discovery

list_discoveries({ compact: true })
# Compact: "#3 [planned] P1 API needs rate limiting"
```
