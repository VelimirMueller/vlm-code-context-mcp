# Tickets & Epics

## Tickets

Tickets are the atomic unit of work. Each belongs to a sprint and optionally to an epic.

### Creating Tickets

```
create_ticket({
  sprint_id: 5,
  title: "Implement login API",
  description: "POST /auth/login with JWT response",
  priority: "P1",
  assigned_to: "developer",
  story_points: 3,
  epic_id: 12
})
```

### Updating Tickets

```
update_ticket({
  ticket_id: 42,
  status: "DONE",
  qa_verified: true,
  verified_by: "qa"
})
# Returns: "Ticket #42 updated: IN_PROGRESS → DONE [DONE | developer | 3pt | qa:yes]"
```

The response includes inline state — no need for a follow-up `get_ticket` call.

### Listing Tickets

```
list_tickets({ sprint_id: 5 })
# Full mode: ticket table with all fields

list_tickets({ sprint_id: 5, compact: true })
# Compact mode: one line per ticket
```

### Priority Levels

| Priority | Meaning |
|----------|---------|
| P0 | Critical — blocks everything |
| P1 | High — must complete this sprint |
| P2 | Medium — should complete |
| P3 | Low — nice to have |

### QA Gates

Every ticket must have `qa_verified: true` before the sprint can close. This is enforced by advisory gates in `advance_sprint`.

## Epics

Epics group related tickets into workstreams that span sprints.

```
create_epic({
  name: "Authentication System",
  description: "Login, registration, session management, password reset",
  milestone_id: 3
})

link_ticket_to_epic({ ticket_id: 42, epic_id: 12 })
```

Epics are marked `completed` when all their tickets are DONE.
