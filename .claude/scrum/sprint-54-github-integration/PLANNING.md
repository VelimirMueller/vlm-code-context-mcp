# Sprint 54 Planning — GitHub Integration

## Sprint Goal
Deliver GitHub MCP tools that sync issues, PRs, and repo metadata to SQLite, with a dashboard GitHub tab and full test coverage — following the Linear integration pattern.

## Dates
Day 1: 2026-03-29 | Day 2-3: 2026-03-30-31 | Day 4: 2026-04-01 | Day 5: 2026-04-02

## Milestone
Milestone 4: Ecosystem Growth

## Retro Actions Applied (from Sprint 9)
- Add frontend component tests (QA finding: zero frontend coverage)
- API client needs timeout + retry logic (Security finding)
- Keep 8pt-per-dev cap strict (Manager finding: frontend exceeded cap last sprint)
- Architect agent needs full tool access when dispatched (Scrum Master finding)

## Capacity (19pt target, 8pt cap)
| Role | Budget | Committed |
|------|--------|-----------|
| Backend Dev | 8 | 8 (T-054 + T-055) |
| Frontend Dev | 8 | 5 (T-056) |
| QA | 3 | 3 (T-057) |
| Security Specialist | 3 | 3 (T-058) |
**Total: 19 pts**

## Committed Tickets
| ID | Title | Points | Assignee |
|----|-------|--------|----------|
| T-054 | GitHub MCP Tools — Auth + Core Sync | 5 | backend-dev |
| T-055 | GitHub Data Schema + Sync Pipeline | 3 | backend-dev |
| T-056 | Dashboard GitHub Tab | 5 | frontend-dev |
| T-057 | GitHub Integration Tests | 3 | qa |
| T-058 | Security Review — GitHub Token Handling | 3 | security-specialist |

## Risks
- GitHub API rate limiting (5000 req/hr for authenticated) — mitigate with conditional requests + ETag caching
- OAuth vs PAT decision — start with PAT via env var, same as Linear pattern

## Sprint Summary (Day 5)
**Completed**: _TBD_
**Velocity**: _TBD_ / 19
