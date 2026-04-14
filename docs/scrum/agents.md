# Agents & Team

## The 9-Agent Team

vlm-code-context-mcp seeds a default team of 9 specialized agents:

| Role | Name | Department | Focus |
|------|------|------------|-------|
| `fe-engineer` | Frontend Engineer | development | UI, React, CSS, dashboard |
| `be-engineer` | Backend Engineer | development | APIs, database, server logic |
| `developer` | Full-Stack Developer | development | General implementation |
| `devops` | DevOps Engineer | development | CI/CD, deployment, infrastructure |
| `architect` | Architect | development | System design, technical standards, scalability |
| `qa` | QA Engineer | quality | Testing, verification, bug tracking |
| `security-specialist` | Security Specialist | quality | Vulnerability review, auth audits, dependency security |
| `team-lead` | Team Lead | business | Coordination, sprint planning |
| `product-owner` | Product Owner | business | Priorities, vision, stakeholders |

## Agent Tools

```
list_agents()
# Shows all agents with role, department, and description

get_agent({ role: "developer" })
# Full agent details including system prompt and model
```

## Mood Tracking

Agents have a mood score (1-5) that reflects workload and team health:

```
record_mood({ agent_id: 3, sprint_id: 5, mood: 4 })

get_mood_trends()
# Shows mood averages and at-risk agents (mood ≤ 2)
```

Mood data feeds into `load_phase_context({ phase: "retro" })` — at-risk agents are surfaced automatically.

## Workload Protection

The sprint process enforces:
- **Max 8 story points per agent** per sprint
- **Burned-out agents (mood ≤ 2) flagged** in playbook warnings
- **Assignment is optional** — tickets can be unassigned

## Resetting to Defaults

```
reset_agents()   # Truncate and re-seed the 7 factory agents
reset_skills()   # Truncate and re-seed the 5 factory skills
```
