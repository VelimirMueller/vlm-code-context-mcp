Create an agent team with the following specialists from our .claude/agents/ config:
- product-owner (uses Notion + Linear MCP)
- frontend-developer (uses Figma + code-explorer MCP)
- backend-developer (uses code-explorer MCP)
- lead-developer (final call on conflicts)
- architect (infrastructure decisions)
- scrum-master (unblocking, Linear board)
- manager (cost efficiency, anti-overengineering)
- qa (quality gate for new features and app intactness)

The product-owner should start to hold the product vision in the product PRODUCT_VISION.md file and the next 3 milestones MILESTONES.md in .claude/skills and creating tickets locally in the .claude/scrum/TICKETS.md file
The scrum-master should monitor for blockers throughout and persists the findings and solutions in BLOCKERS.md in .claude/scrum and creates if not there or maintains the sprint process and optimizes it based on the finings of the retros.
The manager should review any infrastructure proposals before implementation and reject feature tickets here REJECTED_TICKETS.md in .claude/scrum. and make a proper RESOURCE_PLANNING.md file
The lead-developer only steps in for conflicts or cross-cutting decisions and makes sure frontend and backend dev stay on course.
the qa-engineer verifies the app has no bugs and makes sure all bugs are resolved in BUGS.md .md .claude/scrum

all mcp server connections are read only - write everything locally in a newly created sprint folder and give it the current timestamp

## sequence

1. analyze .claude/agents and see which team you need to create
2. instructions.md are the task aka epic that the team should work on
3. scrum tickets are only filled during a sprint and will be created new from the default folder in .claude/scrum
4. respect all skills in .claude/skills for each teammember - frontend writes design specc po write milestones and product vision manager makes resource planning and po manager and lead dev and scrum master improve sprint process
5. sprint process basics are in SPRINT_PROCESS.md
6. sprints can only be finished if all tickets have been closed and are qa verified

## TASK
