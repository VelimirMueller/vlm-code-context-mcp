# /ticket — Ticket Management

Move tickets through their lifecycle using MCP tools.

## Move a ticket

```
update_ticket({ ticket_id: <id>, status: "IN_PROGRESS" })
update_ticket({ ticket_id: <id>, status: "DONE", qa_verified: true, verified_by: "qa" })
update_ticket({ ticket_id: <id>, status: "BLOCKED" })
update_ticket({ ticket_id: <id>, status: "NOT_DONE" })
```

## Reassign a ticket

```
update_ticket({ ticket_id: <id>, assigned_to: "<agent role>" })
```

## Link ticket to epic / milestone

```
link_ticket_to_epic({ ticket_id: <id>, epic_id: <id> })
link_ticket_to_milestone({ ticket_id: <id>, milestone_id: <id> })
```

## View a ticket

```
get_ticket({ ticket_id: <id> })
```

## List all tickets in a sprint

```
get_sprint({ sprint_id: <id> })
```

## Log a bug against a ticket

```
log_bug({ sprint_id: <id>, ticket_id: <id>, severity: "HIGH", description: "...", expected: "...", actual: "..." })
```

## Block / unblock

```
create_blocker({ sprint_id: <id>, ticket_id: <id>, description: "..." })
resolve_blocker({ blocker_id: <id> })
```
