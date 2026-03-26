# Sprint 5 Planning

## Sprint Goal
Restructure the dashboard into a multi-page layout with separate Code Explorer and Sprint Process sections, add sprint board planning/QA/retro views, onboard a security specialist agent, and add skills+health API endpoints.

## Dates
Day 1: 2026-04-14 | Day 2-3: 2026-04-15-16 | Day 4: 2026-04-17 | Day 5: 2026-04-18

## Capacity (8pt cap per dev, 19pt target)
| Role | Budget | Committed |
|------|--------|-----------|
| Frontend Dev | 8 | 8 (T-021) + carries T-022 (5) with architect support |
| Backend Dev | 8 | 3 (T-024) |
| Architect | 8 | 3 (T-023) |
| Lead Dev | 3 | review only |
| QA | — | verify all 4 tickets |
**Total: 19 pts**

## Retro Actions Applied
- 19pt velocity target (S4 retro)
- 8pt cap per dev enforced
- All src/ writes done directly
- Dashboard sections need all 4 states (loading/content/error/empty)
- Checkpoint after first 2 tickets complete

## Committed Tickets
- T-021: Dashboard restructure (8pts, frontend)
- T-022: Sprint board views (5pts, frontend) — NOTE: frontend at 13pts exceeds 8pt cap. Manager decision: T-022 is pure HTML/CSS continuation of T-021, no context switch. Allow as exception with checkpoint.
- T-023: Security specialist agent (3pts, architect)
- T-024: Skills + health API (3pts, backend)

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Frontend at 13pts (over 8pt cap) | T-022 is a natural extension of T-021. Checkpoint after T-021, descope T-022 if needed. |
| Dashboard HTML getting too large | Keep sections organized with clear comment boundaries. Consider extracting CSS to separate section. |
| Security agent scope creep | Agent definition only — no security scanning implementation this sprint. |

## Definition of Done
1. All acceptance criteria met and checked in TICKETS.md
2. `npm test` passes (44+ tests)
3. `npm run build` succeeds
4. Dashboard loads in browser without errors
5. QA verified with evidence recorded
6. Ticket sign-off in TICKETS.md per process

## Sprint Summary (Day 5)
**Completed**: _TBD_
**Velocity**: _TBD_ / 19
