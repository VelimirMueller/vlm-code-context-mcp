# Full Project Kickoff — Interactive Guided Sprint Lifecycle

Run the complete scrum lifecycle from product vision through sprint rest. Ask the user beautifully formatted questions at each phase. Enforce all QA gates.

## Step 0 — Load Context (2 calls)

```
index_directory({ freshness_check: true })   # skip if <5 min old
get_resume_state()                           # single-call resume detection
```

That's it. `get_resume_state()` returns vision, sprints, discoveries, milestones, epics, agents, and next_phase in ~150 tokens.

### Phase context — load with `load_phase_context()` when entering each phase

| Phase | Call |
|-------|------|
| Phase 2 | `load_phase_context({ phase: "discovery" })` |
| Phase 4 | `load_phase_context({ phase: "epics" })` |
| Phase 5 | `load_phase_context({ phase: "tickets" })` |
| Phase 7 | `load_phase_context({ phase: "implementation", sprint_id, ticket_id })` |
| Phase 8 | `load_phase_context({ phase: "retro", sprint_id })` |

### Display summary

Show a context card from the `get_resume_state()` data:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  CONTEXT LOADED                             │
│                                                 │
│   <render get_resume_state() fields>            │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Resume Logic

Using the data already loaded in Step 0, determine where to pick up:

**Resume rules:**
- If a vision already exists (non-empty) → skip Phase 1, confirm the existing vision to the user
- If active/planned discoveries exist → skip Phase 2, show them and ask if more are needed
- If an active milestone exists → skip Phase 3, show it
- If epics already linked to the milestone → skip Phase 4, show them
- If a sprint is in progress (not `rest`) → skip to Phase 7 (implementation loop)
- Always start from the earliest phase that has NOT been completed yet

Tell the user what was detected and where you're picking up:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  RESUMING PROJECT                           │
│                                                 │
│   ✓  Vision ................ set                │
│   ✓  Discovery ............. 2 active           │
│   ○  Milestone ............. none yet           │
│                                                 │
│   Picking up at: MILESTONE                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Question Format

Present every question as a boxed card. Consistent visual style throughout:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  PHASE TITLE                                │
│                                                 │
│   Context — why this step matters.              │
│                                                 │
│   The question itself.                          │
│                                                 │
│   Hints:                                        │
│     ▸ Option or example A                       │
│     ▸ Option or example B                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Rules:**
- One question block at a time. Wait for the user's answer before proceeding.
- Never batch questions. Never assume answers.
- After each user response, execute the MCP calls, confirm what was saved, then show the next card.

---

## Phase 1 — Product Vision

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  PRODUCT VISION                             │
│                                                 │
│   The vision anchors every sprint, ticket, and  │
│   priority decision. Get this right and the     │
│   rest follows naturally.                       │
│                                                 │
│   Describe your project in plain language:      │
│                                                 │
│     ▸ What are you building?                    │
│     ▸ Who is it for?                            │
│     ▸ What does success look like?              │
│                                                 │
│   Example: "A CLI tool for devs that generates  │
│   API docs from code comments. Success = used   │
│   by 3 internal teams within a quarter."        │
│                                                 │
└─────────────────────────────────────────────────┘
```

→ `update_vision({ vision: "<cleaned up response>" })`

---

## Phase 2 — Discovery

Before asking, load discovery context in one call:

```
load_phase_context({ phase: "discovery" })
```

Use the discoveries, decisions, and coverage data to suggest discoveries the user might not have thought of.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  DISCOVERY                                  │
│                                                 │
│   Before building, capture what needs figuring  │
│   out. Discoveries track spikes, risks, and     │
│   scope decisions.                              │
│                                                 │
│   What's the main thing to investigate first?   │
│                                                 │
│     ▸ spike — "Can we use X for Y?"             │
│     ▸ feature_scope — "What's the MVP set?"     │
│     ▸ risk — "Will it scale to N users?"        │
│     ▸ architecture — "Monolith or services?"    │
│                                                 │
│   Describe the discovery and pick a type.       │
│                                                 │
└─────────────────────────────────────────────────┘
```

→ `create_discovery({ title, description, discovery_type })`

---

## Phase 3 — Milestone

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  MILESTONE                                  │
│                                                 │
│   Milestones are big goals spanning multiple    │
│   sprints. Think "v1.0" or "beta launch" —      │
│   not individual features.                      │
│                                                 │
│   What's the first major milestone?             │
│                                                 │
│     ▸ Name  (e.g. "M1 — MVP Launch")           │
│     ▸ Done looks like...                        │
│     ▸ Target date (optional)                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

→ `create_milestone({ title, description, target_date })`
→ Link discoveries to milestone where relevant

---

## Phase 4 — Epics

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  EPICS                                      │
│                                                 │
│   Epics break the milestone into 2–4 big        │
│   workstreams that together deliver the goal.   │
│                                                 │
│   What are the major workstreams?               │
│                                                 │
│   Example for an API project:                   │
│     ▸ Core API — endpoints, auth, validation    │
│     ▸ Frontend — UI, forms, dashboard           │
│     ▸ Infra — CI/CD, monitoring, deploy         │
│                                                 │
│   List your epics (name + one-liner each).      │
│                                                 │
└─────────────────────────────────────────────────┘
```

→ For each: `create_epic({ title, description })`
→ `link_ticket_to_milestone({ ticket_id: <epic_id>, milestone_id })`

---

## Phase 5 — Tickets

Before ticket creation, load context in one call:

```
load_phase_context({ phase: "tickets" })
```

This returns velocity trends, backlog, and active epics. Use codebase knowledge to suggest realistic point estimates.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  SPRINT TICKETS                             │
│                                                 │
│   Break the first epic(s) into sprint-sized     │
│   work. Each ticket = one task completable in   │
│   a day or less.                                │
│                                                 │
│   For each ticket provide:                      │
│     ▸ Title                                     │
│     ▸ Points (1=trivial, 2=small, 3=med, 5=lg) │
│     ▸ Which epic                                │
│                                                 │
│   Target ~<velocity from trends> points total.  │
│   I'll auto-create a QA ticket for every        │
│   feature ticket.                               │
│                                                 │
│   List your tickets.                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

After parsing, auto-generate a QA verification ticket (1–2pts, assigned to `qa`) for every feature ticket.

Show a confirmation table:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ◈  CONFIRM BACKLOG                                            │
│                                                                 │
│   #  │ Title                    │ Pts │ Agent     │ Epic        │
│   ───┼──────────────────────────┼─────┼───────────┼─────────────│
│   1  │ Implement login API      │  3  │ developer │ Core API    │
│   2  │ QA: Verify login API     │  1  │ qa        │ Core API    │
│   …  │ …                        │  …  │ …         │ …           │
│   ───┼──────────────────────────┼─────┼───────────┼─────────────│
│      │ TOTAL                    │ 19  │           │             │
│                                                                 │
│   Look good?  (yes / adjust / add more)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Wait for confirmation before proceeding.

---

## Phase 6 — Start Sprint

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  SPRINT LAUNCH                              │
│                                                 │
│   Everything is queued up. Name the sprint and  │
│   set a one-line measurable goal.               │
│                                                 │
│   Example:                                      │
│     ▸ Name: "Sprint 1 — Auth Foundation"        │
│     ▸ Goal: "Users can register, log in, and    │
│       access protected routes"                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

→ `start_sprint({ name, goal, milestone_id, velocity, tickets: [...] })`
→ `advance_sprint({ sprint_id })` to move planning → implementation

Show launch confirmation:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ✦  SPRINT STARTED                             │
│                                                 │
│   Sprint:   <name>                              │
│   Goal:     <goal>                              │
│   Tickets:  <count> (<points> pts)              │
│   Phase:    implementation                      │
│                                                 │
│   Start working. Tell me when each ticket is    │
│   done and I'll handle status + QA gates.       │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Phase 7 — Implementation Loop

Before working on each ticket, load its context in one call:

```
load_phase_context({ phase: "implementation", sprint_id: <id>, ticket_id: <id> })
```

This returns sprint progress, ticket detail, and open blockers. For file-level context, use `search_files()` and `get_file_context({ include_changes: false })` as needed.

For each ticket the user completes:

1. `update_ticket({ ticket_id, status: "IN_PROGRESS" })`
2. User does the work
3. `update_ticket({ ticket_id, status: "DONE", qa_verified: true, verified_by: "qa" })`
4. Also close the matching QA ticket

**QA gate is mandatory.** Never mark `qa_verified: true` without verifying the work. If verification fails → `log_bug()` and keep the ticket in progress.

Once all tickets are DONE + QA-verified:

→ `advance_sprint({ sprint_id })` moves implementation → done

---

## Phase 8 — Retrospective

Before the retro, load all performance data in one call:

```
load_phase_context({ phase: "retro", sprint_id: <id> })
```

This returns sprint state, burndown, mood, retro patterns, and velocity comparison. Use this data to surface specific observations.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ◈  RETROSPECTIVE                              │
│                                                 │
│   Three quick reflections to close the sprint.  │
│   Be honest — this feeds future planning.       │
│                                                 │
│     1. What went well?                          │
│        (What should we keep doing?)             │
│                                                 │
│     2. What went wrong?                         │
│        (What slowed us down or hurt?)           │
│                                                 │
│     3. What to try next sprint?                 │
│        (One concrete experiment)                │
│                                                 │
└─────────────────────────────────────────────────┘
```

→ `add_retro_finding` × 3 (one per category: went_well, went_wrong, try_next)

---

## Phase 9 — Close & Archive

After retro findings are saved:

→ `advance_sprint({ sprint_id })` moves done → rest

**Archive everything tied to this sprint:**

1. Mark discoveries as `implemented` or `dropped`:
   ```
   update_discovery({ discovery_id, status: "implemented" })   # if ticket DONE
   update_discovery({ discovery_id, status: "dropped", drop_reason: "..." })  # if not
   ```

2. Complete epics where all tickets are DONE:
   ```
   update_epic({ epic_id, status: "completed" })
   ```

3. If ALL epics in the milestone are completed, close the milestone:
   ```
   update_milestone({ milestone_id, status: "completed", progress: 100 })
   ```

4. If epics/milestone are NOT fully done, update progress:
   ```
   update_milestone({ milestone_id, progress: <calculated %> })
   ```

Show final summary:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ✦  SPRINT COMPLETE                            │
│                                                 │
│   Sprint:     <name>                            │
│   Velocity:   <completed>/<committed> pts       │
│   Tickets:    <done>/<total>                    │
│   QA:         All verified ✓                    │
│                                                 │
│   Archived:                                     │
│     ▸ <N> discoveries → implemented/dropped     │
│     ▸ <N> epics → completed                     │
│     ▸ Milestone → <status> (<progress>%)        │
│                                                 │
│   Run /kickoff again for the next cycle.        │
│   Run /sprint to jump straight to planning.     │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Rules

1. **Context first.** Always load from MCP DB before acting. Never assume state.
2. **Code context before file reads.** Use `search_files()` and `get_file_context({ include_changes: false })` before any `Read` tool call. Only include change history when debugging.
3. **One card at a time.** Never skip ahead. Never batch questions.
4. **Wait for user input** before calling any write MCP tool.
5. **Never assume answers.** Ambiguous → ask a follow-up.
6. **QA gates are mandatory.** Every ticket must be `qa_verified: true`.
7. **Auto-generate QA tickets** for every feature ticket.
8. **Link everything** — tickets→epics, epics→milestones, discoveries→tickets.
9. **Archive on close** — discoveries, epics, milestones all get their final status.
10. **Resume from where you left off** — check existing state before asking redundant questions.
11. **Surface anomalies.** If retro patterns, mood trends, or velocity suggest a problem, highlight it.
