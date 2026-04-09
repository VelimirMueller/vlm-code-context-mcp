# /milestone — Milestone Management

Create, update, and close milestones using MCP tools.

## Step 0 — Load Context

Before any milestone operation, load the full context. You may be a fresh agent.

### 0a. Codebase context (ALWAYS first)

```
index_directory()                      # ensure file index is fresh
search_files({ query: "" })            # get file tree overview
```

### 0b. Essential reads

```
get_project_status()                   # overall health
list_sprints()                         # sprint landscape + milestone links
list_agents()                          # team roster
get_velocity_trends()                  # capacity to estimate remaining sprints
analyze_retro_patterns()               # past lessons
```

### 0c. Milestone-specific reads

```
list_epics()                           # epics + milestone links + ticket progress
list_discoveries({ status: "planned" }) # open discoveries to track
get_discovery_coverage()               # what's been implemented
```

### 0d. Display smart summary

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  CONTEXT LOADED                             │
│                                                 │
│   Project:  <name> — <file count> files indexed │
│   Milestones: <active> active, <done> completed │
│   Epics:    <N> total (<done> completed)        │
│   Velocity: <avg> pts/sprint                    │
│   Codebase: <files> files, <exports> exports    │
│                                                 │
│   ⚠ <epics with no progress>                    │
│   ⚠ <milestones past target date>               │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## View milestones

Already loaded in Step 0. Display the data from `list_epics()` and `get_project_status()`.

## Update milestone progress

```
update_milestone({ milestone_id: <id>, progress: <0-100> })
```

## Close / complete a milestone

First verify all epics are done (use data from Step 0):

```
list_epics({ milestone_id: <id> })
```

Only close if ALL epics linked to it are completed:

```
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

## Rules

1. **Context first.** Always load from MCP DB before acting. Never assume state.
2. **Code context before file reads.** Use `search_files()` and `get_file_context()` before any `Read` tool call.
3. **Surface anomalies.** Flag milestones past target date, epics with no progress, or discoveries not yet implemented.
4. **Verify before closing.** Never close a milestone without checking all epics are completed.
