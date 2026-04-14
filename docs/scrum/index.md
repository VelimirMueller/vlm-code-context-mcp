# Scrum Tools Overview

vlm-code-context-mcp includes **82 scrum management tools** that turn any MCP client into a full virtual IT department.

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| **Sprint Lifecycle** | `start_sprint`, `advance_sprint`, `plan_sprint`, `get_sprint_playbook` | Create, run, and close sprints with gate enforcement |
| **Tickets** | `create_ticket`, `update_ticket`, `get_ticket`, `list_tickets` | Full CRUD with QA verification, priority, and assignment |
| **Epics** | `create_epic`, `update_epic`, `list_epics`, `link_ticket_to_epic` | Group tickets into workstreams |
| **Milestones** | `create_milestone`, `update_milestone`, `link_ticket_to_milestone` | Track big goals spanning multiple sprints |
| **Retro** | `add_retro_finding`, `list_retro_findings`, `analyze_retro_patterns` | Capture went_well, went_wrong, try_next per sprint |
| **Discovery** | `create_discovery`, `update_discovery`, `list_discoveries`, `link_discovery_to_ticket` | Track spikes, risks, and scope decisions |
| **Analytics** | `get_burndown`, `get_velocity_trends`, `export_sprint_report`, `snapshot_sprint_metrics` | Burndown charts, velocity comparison, sprint reports |
| **Agents** | `list_agents`, `get_agent`, `record_mood`, `get_mood_trends` | 7-agent team with mood and workload tracking |
| **Blockers & Bugs** | `create_blocker`, `resolve_blocker`, `log_bug` | Track and resolve impediments |
| **Context Loaders** | `get_resume_state`, `load_phase_context`, `get_sprint_instructions` | Single-call context bundles for efficient workflows |

## Quick Start

```bash
# Start a sprint with tickets in one call
start_sprint({
  name: "Sprint 1 — Auth",
  goal: "Users can register and login",
  tickets: [
    { title: "Login API", story_points: 3, assigned_to: "developer" },
    { title: "Register endpoint", story_points: 2, assigned_to: "be-engineer" }
  ]
})

# Advance through phases
advance_sprint({ sprint_id: 1 })  # planning → implementation

# Update tickets as work progresses
update_ticket({ ticket_id: 1, status: "DONE", qa_verified: true })

# Close with retro
add_retro_finding({ sprint_id: 1, category: "went_well", finding: "Clean API design" })
advance_sprint({ sprint_id: 1 })  # implementation → done → rest
```

## Compact Modes

Most scrum tools support `compact=true` for token-efficient output:

| Tool | Full output | Compact output | Savings |
|------|-----------|---------------|---------|
| `get_sprint_playbook` | ~60 tokens | ~23 tokens | 62% |
| `export_sprint_report` | ~206 tokens | ~27 tokens | 87% |
| `get_burndown` | ~31 tokens | ~20 tokens | 35% |
| `list_discoveries` | ~41 tokens | ~24 tokens | 41% |

`get_sprint_instructions` auto-adapts: full guide for new teams, pitfalls-only for veterans (10+ sprints).
