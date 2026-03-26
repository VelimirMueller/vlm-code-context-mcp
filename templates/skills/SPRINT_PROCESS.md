# Sprint Process

## Overview

5-day sprint cycle for an AI-agent development team. Every sprint ships something usable. Every retro produces at least one concrete process change.

**Before every sprint**: Read RETRO_FINDINGS.md and apply learnings from the previous sprint.

---

## Day 1 -- Sprint Planning (max 30 min)

### Phase 1: Backlog Presentation (10 min)
- PO presents prioritized tickets with clear acceptance criteria
- Each ticket must include: goal, acceptance criteria, priority (P0-P3), estimated complexity
- Every ticket links to a milestone -- orphan tickets are rejected

### Phase 2: Estimation and Review (10 min)
- Team estimates using Fibonacci story points: 1, 2, 3, 5, 8
- Any ticket estimated at 8+ must be split before commitment
- Manager reviews each ticket against the overengineering checklist

### Phase 3: Assignment and Subtasks (10 min)
- Team self-assigns based on expertise and current load
- No single developer takes more than 8 story points
- Sprint goal is written in PLANNING.md (one sentence, measurable)

---

## Day 2-3 -- Implementation

### Work Rules
- Devs work autonomously within their lanes
- Backend announces new/changed APIs to Frontend immediately
- Lead Dev only steps in on conflicts or cross-cutting decisions

### The 30-Minute Rule
If stuck for 30 minutes: escalate. No heroics.

---

## Day 4 -- QA + Polish

- QA runs full verification against acceptance criteria
- Bugs logged in BUGS.md with severity, steps to reproduce, expected vs actual
- Security review runs alongside QA
- No new features on Day 4 -- only fixes and polish

---

## Day 5 -- Ship + Retro

- Final QA pass on bug fixes
- Ticket completion sign-off in TICKETS.md
- Sprint summary written in PLANNING.md
- Retrospective: each role adds findings to RETRO_FINDINGS.md

---

## Key Principles

1. No meetings longer than 30 minutes.
2. Async-first communication via ticket comments.
3. "Done" means tested, documented, reviewed, AND signed off.
4. Every sprint ships something usable.
5. Devs choose their own subtasks.
6. No scope creep mid-sprint.
7. QA is a full day, not an afterthought.
