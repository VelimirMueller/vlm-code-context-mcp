# /milestone — Milestone Management

Create, update, and close milestones using MCP tools.

## View milestones

```
list_epics()                          # shows epics + their milestone links
get_project_status()                  # overall health
```

## Update milestone progress

```
update_milestone({ milestone_id: <id>, progress: <0-100> })
```

## Close / complete a milestone

Only close when ALL epics linked to it are completed:

```
# First verify all epics are done
list_epics({ milestone_id: <id> })

# Then close
update_milestone({ milestone_id: <id>, status: "completed", progress: 100 })
```

## Update milestone details

```
update_milestone({ milestone_id: <id>, description: "...", target_date: "2026-05-01" })
```

## Link a sprint to a milestone

```
# Via sprint creation
start_sprint({ ..., milestone_id: <id> })

# Or update existing sprint
update_sprint({ sprint_id: <id>, milestone_id: <id> })
```

## Link epic to milestone

```
create_epic({ name: "...", description: "...", milestone_id: <id> })
```
