# Sprint Process

## Overview

5-day sprint cycle optimized for an AI-agent development team of 8 roles. Every sprint ships something usable. Every retro produces at least one concrete process change.

**Before every sprint**: Read RETRO_FINDINGS.md and apply learnings from the previous sprint. This is not optional.

---

## Day 1 -- Sprint Planning (max 30 min)

### Phase 1: Backlog Presentation (10 min)
- PO presents prioritized tickets from TICKETS.md with clear acceptance criteria
- Each ticket must include: goal, acceptance criteria, priority (P0-P3), estimated complexity
- PO links every ticket to a milestone in MILESTONES.md -- orphan tickets are rejected

### Phase 2: Estimation and Review (10 min)
- Team estimates using Fibonacci story points: 1, 2, 3, 5, 8
- Any ticket estimated at 8+ must be split before commitment
- Manager reviews each ticket against the overengineering checklist:
  - Is this solving a real, current problem?
  - Can we ship a 70% solution now instead of 100% in 3 weeks?
  - Are we adding complexity that nobody asked for?
- Architect reviews for technical feasibility and infrastructure impact
- Manager can reject tickets NOW (adds to REJECTED_TICKETS.md with reason) -- never during the sprint

### Phase 3: Assignment and Subtasks (10 min)
- Team self-assigns based on expertise and current load
- **No single developer takes more than 8 story points.** If they finish early, they pick from backlog.
- Sprint capacity is calculated (see RESOURCE_PLANNING.md)
- Team commits to a set of tickets that fits within capacity
- Each member creates their own subtasks in SUBTASKS.md -- nobody assigns subtasks to someone else
- Sprint goal is written in PLANNING.md (one sentence, measurable)

### Planning Outputs
- PLANNING.md: sprint goal, committed tickets, capacity, risks
- SUBTASKS.md: individual breakdowns by each team member
- TICKETS.md: updated with sprint assignment and estimates

---

## Day 2-3 -- Implementation

### Work Rules
- Devs work autonomously within their lanes
- Backend announces new/changed APIs to Frontend immediately (comment on the ticket)
- Frontend does not start UI work for an API that does not exist yet -- work on independent UI tasks first
- Lead Dev only steps in on conflicts or cross-cutting decisions
- Scrum Master checks SUBTASKS.md for blockers every few hours and updates BLOCKERS.md

### The 30-Minute Rule
If stuck for 30 minutes: escalate. No heroics. No silent suffering.
- Unclear requirements --> Scrum Master pings PO
- Technical decision needed --> Lead Dev decides within 1 hour
- Infrastructure dependency --> Architect unblocks
- Waiting on another dev --> Scrum Master facilitates, blocked dev swaps to another subtask

### Status Updates
- Each dev updates their subtask status in SUBTASKS.md: TODO / IN_PROGRESS / DONE / BLOCKED
- Blocked tasks must include what they are blocked on
- **Scrum Master runs a MANDATORY status check at end of Day 2:** Every dev must have at least one subtask IN_PROGRESS or DONE with evidence (file exists, test written, code changed). Zero-progress roles are escalated immediately — they swap tasks or pair with another dev.

### Subagent Output Verification
When work is delegated to subagents, the developer MUST verify before marking anything done:
1. Check that files actually exist on disk (`ls`, `test -f`)
2. Run `npm test` and confirm tests pass
3. Verify specific acceptance criteria against actual state
"Subagent said it's done" is NOT evidence. QA will reject tickets where the only proof is subagent output.

### Communication Protocol
- Async-first: use ticket comments, not synchronous calls
- If a conversation needs more than 3 back-and-forth messages, schedule a 10-min sync (max)
- Backend publishes API contracts (endpoint, method, request/response shape) before implementation is complete so Frontend can code against the interface

---

## Day 4 -- QA + Polish

### QA Phase (full day, not an afterthought)
- QA runs full verification using Playwright MCP
- Every committed ticket gets tested against its acceptance criteria
- Bugs logged in BUGS.md with:
  - Severity: CRITICAL / HIGH / MEDIUM / LOW
  - Steps to reproduce
  - Expected vs actual behavior
  - Which ticket it relates to

### Bug Triage
| Severity | Action | Timeline |
|----------|--------|----------|
| CRITICAL | Back to implementation immediately | Must fix Day 4 |
| HIGH | Back to implementation immediately | Must fix Day 4 |
| MEDIUM | Added to next sprint backlog | Next sprint |
| LOW | Added to next sprint backlog | Next sprint |

### Security Review (Day 4, alongside QA)
- Security Specialist runs the security review checklist (see security-specialist agent)
- SQL injection audit on all new SQL queries
- Input validation check on all new MCP tool parameters
- `npm audit` for dependency vulnerabilities
- Findings logged as bugs with severity in BUGS.md

### Polish Work
- Frontend polishes UI based on QA feedback
- Backend fixes API edge cases found during QA
- Lead Dev reviews code quality on completed tickets
- No new features on Day 4 -- only fixes and polish

---

## Day 5 -- Ship + Retro

### Final QA Pass (morning)
- QA re-verifies all CRITICAL/HIGH bug fixes from Day 4
- If any CRITICAL bug remains unfixed: sprint ships without that ticket (ticket moves back to backlog)
- Final pass confirms acceptance criteria are met for all committed tickets

### Ticket Completion Sign-Off (MANDATORY)

**This is non-negotiable. A ticket is NOT done until sign-off is recorded in TICKETS.md.**

For each committed ticket, the Scrum Master or PO must update TICKETS.md with:

1. **Status field**: Set to `DONE`, `PARTIAL`, or `NOT DONE`
2. **QA Verified field**: Set to `YES` or `NO`
3. **Acceptance criteria checkboxes**: Change `- [ ]` to `- [x]` for each criterion that is verified on disk/in tests. Leave unchecked criteria with a note explaining what is missing.
4. **Verified by line**: Add `**Verified by**: QA — [brief evidence]` with concrete proof (test counts, file existence, manual verification)
5. **Bugs Found line** (if any): List bug IDs from BUGS.md that were discovered during QA for this ticket

**Sign-off rules:**
- The person who IMPLEMENTED the ticket cannot sign off their own work. QA or another role must verify.
- "It works on my machine" is not verification. Evidence must be recorded: test output, file existence, manual check.
- Partial tickets get credit for completed criteria only. Remaining criteria carry to next sprint.
- NOT DONE tickets must include a `**Note**:` explaining why and whether they carry to the next sprint.
- Sign-off happens BEFORE the sprint summary is written — the summary reflects the verified state.

### Sprint Summary (midday)
Written in PLANNING.md sprint section:
- What shipped (list of completed ticket IDs with QA VERIFIED status)
- What did not ship and why
- Sprint velocity (total story points for DONE tickets only — PARTIAL and NOT DONE do not count)
- Key metrics: bugs found, bugs fixed, tickets completed vs committed
- Carry-over tickets: list tickets moving to next sprint with remaining criteria

### Retrospective (afternoon, max 30 min)
Every role adds findings to RETRO_FINDINGS.md in a new section for the sprint:
- What went well (keep doing)
- What went wrong (stop doing)
- What to try next sprint (experiment)

**Retro findings MUST produce at least one concrete change** applied to the next sprint. "We should communicate better" is not a finding. "Backend will post API contracts in SUBTASKS.md by end of Day 2" is a finding.

### Milestone Review
- PO reviews milestone progress in MILESTONES.md
- PO updates milestone completion percentages
- PO flags any milestones at risk

---

## Key Principles

1. **No meetings longer than 30 minutes. Ever.** If it cannot be decided in 30 min, the decision owner decides alone and informs the team.
2. **Async-first communication** via ticket comments and status updates in markdown files.
3. **"Done" means tested, documented, reviewed, AND signed off in TICKETS.md.** Not "it works on my machine." No checkmark in TICKETS.md = not done.
4. **Every sprint ships something usable.** If nothing ships, the sprint failed.
5. **Devs choose their own subtasks.** Autonomy = ownership = quality = happiness.
6. **Manager rejects tickets BEFORE sprint starts, never during.** Once committed, the team executes.
7. **Retro findings MUST be applied.** Documented but ignored findings are worse than no retro.
8. **No scope creep mid-sprint.** New ideas go to the backlog. PO prioritizes them for the next sprint.
9. **Blocked devs swap tasks, never sit idle.** The Scrum Master facilitates this.
10. **QA is a full day, not an afterthought.** Quality is not negotiable.

---

## Anti-Patterns to Prevent

| Anti-Pattern | Prevention |
|-------------|------------|
| Scope creep mid-sprint | Manager + Scrum Master enforce commitment. New requests go to backlog. |
| Over-engineering "just in case" | Manager reviews every ticket before sprint. 70% solution > 100% solution. |
| Blocked devs sitting idle | 30-min rule + task swapping. Scrum Master monitors SUBTASKS.md. |
| QA as afterthought | Full Day 4 dedicated. QA has veto power on shipping CRITICAL bugs. |
| Retros that produce no changes | Each retro must produce at least one actionable change with an owner. |
| Silent suffering | 30-min escalation rule. No heroics. Ask for help early. |
| Ticket without acceptance criteria | PO must include criteria. Team rejects tickets without them in planning. |
| 8+ point tickets | Must be split before commitment. No exceptions. |

---

## File Responsibilities

| File | Owner | When Updated |
|------|-------|-------------|
| TICKETS.md | PO | Before planning, during planning |
| PLANNING.md | Scrum Master | Day 1 (planning), Day 5 (summary) |
| SUBTASKS.md | Each dev (own section) | Day 1 (creation), Day 2-4 (status) |
| BUGS.md | QA | Day 4 (logging), Day 5 (verification) |
| BLOCKERS.md | Scrum Master | Day 2-4 (as discovered and resolved) |
| RETRO_FINDINGS.md | All roles | Day 5 (retro) |
| REJECTED_TICKETS.md | Manager | Day 1 (planning review) |
| MILESTONES.md | PO | Day 5 (milestone review) |
| RESOURCE_PLANNING.md | Manager | Before planning, updated as needed |

---

## Sprint Folder Structure

Each sprint gets its own folder: `.claude/scrum/sprint-{ISO-timestamp}/`

Files copied from `.claude/scrum/default/` at sprint start:
- PLANNING.md
- TICKETS.md
- SUBTASKS.md
- BUGS.md
- BLOCKERS.md
- RETRO_FINDINGS.md
- REJECTED_TICKETS.md

The default folder contains templates. Sprint folders contain the living documents for that sprint.
