# Loop Gates & Terminal Cockpit — Design

**Date:** 2026-06-11
**Status:** Approved scope, pending spec review
**Target:** Sprints 22–24, delivered as a stacked PR chain. Milestone: create a new one at kickoff — current #20 "UI Improvements" sits at 100% and should be closed (itself an instance of the hygiene drift this spec addresses).

## Summary

Two failures, one cause. After 21 sprints the process *senses* everything (retro patterns, discovery coverage, mood, velocity) but *actuates* nothing: retro follow-through is 0/15, the oldest open P0 discovery dates to Sprint 10, and `analyze_retro_patterns` lists "because (5x)" as a top recurring issue. Meanwhile the `/kickoff` terminal experience is monochrome, hand-padded ASCII that the LLM must align by counting spaces, and the dashboard wizard is blind during terminal-driven ceremonies.

This spec adds **gates** (data that demands a decision at planning) and a **cockpit** (server-rendered, colored terminal output + a live statusline), plus a token/quality audit of the command & skills pipeline.

Evidence (from this project's own `context.db`, 2026-06-11):

- `analyze_retro_patterns`: 84 findings, follow-through **0%** (0 of 15 owned actions applied). Sprint 1's try_next ("auto-build on MCP reconnect") was never adopted; "stale dist / agent seeding" is now the top recurring went_wrong (5×). Sprint 13's "security regression tests" — never adopted.
- `list_discoveries(status=discovered)`: 9 open; **P0 #10 open since Sprint 10** (11 sprints). Kickoff Phase 5 loads velocity/backlog/epics but never discoveries or try_next.
- Velocity 100% five sprints running — commitments mirror outcomes because scope changes are not tracked against a frozen baseline.
- `kickoff.md` draws every card as a hand-padded box in a plain fence (no color); `send_claude_step`/`send_step_progress` exist but kickoff never calls them.

## Goals

1. No sprint starts while try_next items and open discoveries sit untriaged — adopt, defer, or drop, explicitly.
2. Follow-through and velocity become honest, computed metrics.
3. `/kickoff` output is colored, perfectly aligned, and server-rendered; sprint state is permanently visible in a statusline; the dashboard mirrors terminal ceremonies live.
4. Full kickoff cycle costs measurably fewer tokens than today.

## Non-goals

- No npm publish automation (standing policy).
- No rewrite of `tools.ts` into modules (discovery #16) — the triage gate will *surface* it; scheduling it is a planning decision.
- No new dashboard UI beyond consuming already-supported events.
- Statusline targets Claude Code only.

---

## A1 — Retro Loop Gate (5 pts)

**Problem.** `retro_findings.action_applied` and `linked_ticket_id` exist but nothing sets them; try_next items have no lifecycle, so nothing can close one.

**Design.**

- **Migration v21:** add to `retro_findings`: `status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','adopted','dropped'))` (meaningful for `try_next` only) and `dropped_reason TEXT`. Backfill: all existing try_next → `open`. Keep `action_applied` for compatibility; it becomes derived (see below).
- **New tool `triage_retro_finding({ finding_id, resolution: 'adopt'|'drop'|'defer', ticket_id?, dropped_reason? })`:**
  - `adopt` → status `adopted`, sets `linked_ticket_id` (required).
  - `drop` → status `dropped`, requires `dropped_reason`.
  - `defer` → stays `open`, logs an audit event (defer count visible at next gate).
- **Auto-apply:** like `get_discovery_coverage`'s auto-promote — when a finding's linked ticket reaches DONE, set `action_applied = 1`. Run inside `analyze_retro_patterns` and `load_phase_context`.
- **Gate injection:** `load_phase_context({ phase: "tickets" })` returns an `OPEN TRY_NEXT (n)` block — compact one-liners with id, sprint of origin, age in sprints, owner — plus the directive: *"Triage every item (adopt ≥1 as a ticket, or defer/drop with reason) before start_sprint."*
- **Gate enforcement:** `triage_retro_finding(defer)` stamps `deferred_at`. `start_sprint` refuses — listing the items — when any try_next is `open` with `deferred_at` NULL or older than 24 h (heuristic for "not looked at during this planning"; a planning session fits in a day, and the next planning re-surfaces deferred items). Escape hatch: `acknowledge_open_items: true` (shared with A2). Soft-hard: the decision moment is forced, autonomy is preserved.
- **Metric:** `analyze_retro_patterns` follow-through becomes `adopted-and-done / (adopted + dropped + open)`, with the open-item age histogram.

**Acceptance criteria.**
- Migration v21 applies cleanly to a v20 DB with 19 existing try_next rows; all become `open`.
- `start_sprint` without triage and without the ack flag returns a refusal listing open items.
- Adopting a finding and completing its ticket flips `action_applied` to 1 without manual calls.
- `analyze_retro_patterns` shows non-degenerate follow-through after one adopt + one drop.

## A2 — Discovery Triage Gate (3 pts)

**Problem.** Discoveries have a full lifecycle (`discovered/planned/implemented/dropped`) but planning never reads them.

**Design.** Same injection point and triage UX as A1 (built together):

- `load_phase_context({ phase: "tickets" })` adds an `OPEN DISCOVERIES (n)` block sorted by priority then age, each annotated `open N sprints`, with `⚠ ESCALATED` when a P0/P1 exceeds 3 sprints.
- Triage uses existing tools (`link_discovery_to_ticket`, `update_discovery`) — no new tool. Defer = leave `discovered`; the block reappears next planning with age incremented.
- `start_sprint`'s `acknowledge_open_items` flag covers both gates; escalated P0s are named individually in the refusal.

**Acceptance criteria.**
- Planning context lists the 9 current discoveries with correct ages; #10/#9/#8 show as escalated.
- Pulling a discovery into the sprint links it and flips it to `planned`; completion auto-promotes to `implemented` (existing behavior, regression-tested).

## A3 — Honest Velocity (3 pts)

**Problem.** `velocity_committed` exists but the 100%-forever pattern shows scope is reconciled, not frozen.

**Design.**

- `start_sprint` freezes `velocity_committed` (sum of points at launch) — never recalculated afterward (audit current code paths; remove any recalc on ticket add/remove).
- **Added scope** is derived, no schema change: tickets whose `sprint_id` = sprint and `created_at` > sprint start. **Removed scope** from audit-trail events where a ticket leaves the sprint (log if missing).
- `get_velocity_trends` and `export_sprint_report` gain `committed / +added / −removed / landed` and a completion rate computed **against frozen committed**. Past sprints: committed stays as recorded; added/removed best-effort from `created_at` (documented caveat).

**Acceptance criteria.**
- Creating a ticket mid-sprint leaves `velocity_committed` unchanged and shows as `+N added`.
- A sprint that lands added-but-not-committed work can no longer report 100% by construction.

## A4 — Real Recurring-Issue Analysis (2 pts)

**Problem.** Top-issue extraction is raw word frequency; stopwords win.

**Design.** Dependency-free upgrade inside `analyze_retro_patterns`:

- Normalize (lowercase, strip punctuation), drop a curated stopword list (English + domain noise: "sprint", "ticket", "because", "time"…), extract unigrams + bigrams.
- Cluster *findings, not words*: a recurring issue = a keyword/bigram appearing in went_wrong findings from **≥2 distinct sprints**; report cluster size, sprints, roles, and one example finding.
- Output capped at top 5 clusters; bigrams outrank unigrams at equal counts.

**Acceptance criteria.**
- "because"/"time"-class tokens cannot appear as issues (unit test with current 84-finding corpus snapshot).
- The stale-dist/agent-seeding cluster surfaces as one issue with its sprint list.

---

## B1 — Design Language 2.0: server-rendered cards (5 pts)

**Problem.** LLM-drawn boxes are token-expensive and shear on any width miscount. Color is absent even though Claude Code's renderer colors `diff` fences (+green/−red), `yaml`/`json` keys, headers, bold, and emoji.

**Design.**

- **New module `src/scrum/cards.ts`** — pure functions, fully unit-testable: `progressBar(done, total, width)`, `sparkline(series)`, `ticketDoneCard(...)`, `phaseBanner(...)`, `sprintPulse(...)`, `launchCard(...)`, `sprintCompleteCard(...)`.
- **Diff-flavored output:** every card line is pre-marked for a ```diff fence — `+ ` for positive state (done, passed, launched), `- ` for warnings (blocked, QA pending, escalated), two spaces for neutral. Color and alignment are both server-controlled; the LLM relays verbatim.
- **Glyph discipline:** padded regions use only verified single-width glyphs (`▰ ▱ ▇▆▅▄▃▂▁ ✓ ⚙ ○ ◈ ✦ ⚠ ✗`); no emoji inside aligned columns (double-width breaks padding). A `displayWidth()` helper + tests enforce every card line renders equal width.
- **Tool surface:** `format: "card"` param on `update_ticket`, `advance_sprint`, `start_sprint`, `get_sprint_playbook`, `get_burndown`. Card mode returns the card **plus** the compact state line (keeps discovery #12's fix: no follow-up `get_ticket` round-trip).
- **Command contract:** kickoff/sprint/retro commands instruct: *"Print returned cards verbatim inside a ```diff fence. Never redraw or restyle them."* Phase banners become `## ◈ Phase N — Title` + a `yaml` data card. All hand-drawn boxes are deleted from the command files.

Reference render (ticket completion):

```diff
+ ✓ T-231 Statusline HUD  (3pt · fe-engineer · QA verified)
  ────────────────────────────────────────────
  Sprint 22 — Close the Loop          day 2/5
  ▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱  9/19 pt    burndown ▇▆▅▄▃
  ✓ 4 done   ⚙ 1 in progress   ○ 4 todo
- ⚠ QA gate pending: T-232
```

**Acceptance criteria.**
- Snapshot tests for every card type; width-equality test across all lines incl. em-dash/diacritic content.
- `update_ticket(format:"card")` returns card + compact state in one call.
- `kickoff.md` contains zero hand-drawn box borders after the rewrite.

## B2 — AskUserQuestion-native kickoff (3 pts)

**Problem.** Every kickoff question is free-text against a drawn card; structured choices (discovery type, backlog confirm, triage) deserve native UI.

**Design.** Command-file rewrite (no server code):

- Structured decisions use Claude Code's **AskUserQuestion** tool: discovery type, backlog confirmation (`confirm / adjust / add more`), A1/A2 triage (multi-select adopt/defer/drop), retro category prompts, phase-gate confirmations. Free text remains for vision, sprint goal, epic descriptions.
- **Precedence:** dashboard up → `request_user_input` (wizard) stays primary; fallback order becomes wizard → AskUserQuestion → plain text (last resort), replacing today's wizard → plain text.
- **4-option limit:** lists longer than 4 (e.g. 19 try_next items) are chunked: a `yaml` summary card first, then batched multi-select questions (4 per call, ≤4 calls), remainder handled conversationally.

**Acceptance criteria.**
- Updated `kickoff.md` (question protocol, planning-gate triage) and `retro.md` (category prompts; capture stays here, triage stays in planning) specify the tool, the fallback chain, and the chunking rule.
- Dry-run transcript of a full kickoff shows no free-text prompt for any enumerable choice.

## B3 — Sprint Statusline HUD (3 pts)

**Problem.** Sprint state is invisible unless asked for; asking costs tokens.

**Design.**

- **New bin `code-context-statusline`** (`dist/server/statusline.js`): reads Claude Code's statusline JSON from stdin, resolves the project dir (`workspace.current_dir`, fallback cwd), walks up to find `context.db` (reuse `bridge/hook.ts` `findDb`), opens read-only, prints one ANSI line, exits. Budget: <50 ms, zero LLM involvement.
- **Content:** active sprint name/status/day (from `start_date` vs sprint length read from sprint config, default 5), points bar, ticket counts, blockers, mood average. No active sprint → `◆ <project> ▸ next: <next_phase> · <n> open discoveries`. Honors `NO_COLOR`; degrades gracefully when no DB is found (prints nothing, exit 0).

```
◆ mcp-server ▸ S22 implementation · day 2/5  ▰▰▰▰▱▱▱▱ 9/19pt  ✓4 ⚙1 ○4 ⛔0  ☀ 4.2
```

- **Install:** `setup` gains an opt-in step writing `statusLine: { type: "command", command: "code-context-statusline" }` into `.claude/settings.json` — merge-safe, never clobbers an existing statusline.

**Acceptance criteria.**
- Renders correct line against a fixture DB in all three states (active sprint / between sprints / no DB).
- Setup merge test: pre-existing settings keys survive.

## B4 — Dashboard Live Mirror (2 pts)

**Problem.** Terminal ceremonies are invisible to the dashboard wizard despite `send_claude_step`/`send_step_progress` existing.

**Design.** Server-side first, to avoid a token regression:

- **Auto-emit:** state-changing tools (`start_sprint`, `advance_sprint`, `update_ticket`, `create_ticket`, `log_bug`, `resolve_blocker`) call `notifyDashboard` with a step/progress event themselves — zero extra LLM tool calls, mirrors *any* client.
- **Explicit calls** remain only for narrative moments with no state change: kickoff.md adds `send_claude_step` at phase entry (≤9 calls per full cycle). All emission stays fire-and-forget (existing `.catch(() => {})` pattern) — a down dashboard never blocks a ceremony.

**Acceptance criteria.**
- With the dashboard running, a terminal-driven `update_ticket` produces a visible wizard step event (e2e: SSE assertion).
- With the dashboard down, tool latency is unchanged (timeout-bounded, test with fake port).

---

## C1 — Command & skills token/quality audit (3 pts)

User-added scope; operationalizes discoveries #8–#11 and Sprint 11's try_next.

**Design.**

- **Compact by default:** add/flip compact modes on `get_sprint_playbook`, `get_burndown`, `list_discoveries`, `get_velocity_trends`, `export_sprint_report`, `list_tickets`; flip `get_file_context` `include_changes` default to **false** (discovery #10). Verbose becomes the opt-in.
- **`load_phase_context` propagates compact** everywhere (Sprint 11 try_next) and stops over-querying (mood: aggregate query instead of 35 rows — discovery #13; retro phase: aggregates only — same).
- **Smart verbosity** (discovery #11): lifecycle-tutorial text in instructions/playbook is emitted only for sprints 1–3; later sprints get the terse form.
- **Skills pipeline:** house-style primer injected only with the sprint's *first* fe-engineer ticket (server check: no other fe ticket in the sprint already IN_PROGRESS/DONE — deterministic, no session state); later tickets get the skill index only, with `get_skill` granular pulls covering the rest.
- **Measurement:** a small script replays a recorded kickoff tool-call sequence and reports total output tokens before/after; result lands in the sprint review. B1's deletion of hand-drawn boxes from command files counts toward the same number.
- **Guardrail (adopts Sprint 5's try_next — first Retro-Gate adoption):** CI check validating `.claude/commands/*` structure: required `## Phase` headers, required Rules section, line-count ceiling.

**Acceptance criteria.**
- Measured ≥30% output-token reduction on the replayed kickoff sequence (target; report actual).
- All compact defaults covered by tests; CI command-structure check green.

---

## D1 — Live-editable board tickets with session reaction (8 pts)

**Problem.** Board tickets are effectively read-mostly from the UI, and a terminal session has no way to notice mid-sprint edits. The two halves of the system can silently diverge.

**Design.**

- **Migration v22 (shared with D2):** `tickets` gains `change_seq INTEGER NOT NULL DEFAULT 0` and `pending_change INTEGER NOT NULL DEFAULT 0` (the change flag). New `ticket_revisions` table: `id, ticket_id, source ('ui'|'mcp'), changed_fields TEXT (JSON array), old_values TEXT (JSON), new_values TEXT (JSON), created_at` — a field-level diff trail.
- **Dashboard write path:** one full-field `PATCH /api/ticket/:id` (title, description, points, status within allowed transitions, assignments, model) behind existing bearer auth. Every UI-sourced change, in one transaction: bump `change_seq`, set `pending_change = 1`, write a `ticket_revisions` row, insert a `pending_actions` row (`action: 'ticket_changed'`, payload = field diff), emit SSE.
- **UI:** inline editing on the ticket detail (and quick-edit on board cards): title, description, points, assignments + per-assignment model (D2), status transitions. **Guardrail:** the UI can never set `qa_verified` and cannot move a ticket to DONE — DONE remains process-controlled (QA gate integrity). Allowed UI transitions: TODO ↔ IN_PROGRESS ↔ BLOCKED.
- **Session reaction — two channels, both flag-driven:**
  1. The existing PreToolUse bridge hook already injects `pending_actions` as additionalContext — `ticket_changed` rides it for free mid-task.
  2. `load_phase_context` (implementation) and `get_sprint_playbook` prepend a `⚠ CHANGED TICKETS (n)` block (from `pending_change = 1`) with per-field diffs, so ceremonies and resumes always see edits even without the hook installed.
- **New tool `acknowledge_ticket_changes({ ticket_ids })`:** clears `pending_change`, completes the corresponding pending_action. Command contract: when a change block appears → re-read the ticket, state the adjustment (or that none is needed), acknowledge. Points edits feed A3's added/removed scope accounting automatically.

**Acceptance criteria.**
- UI edit → flag set, revision row written, pending_action queued, SSE emitted (one transaction; e2e test).
- A session calling `load_phase_context(implementation)` after a UI edit sees the diff block; after `acknowledge_ticket_changes` it does not.
- UI cannot produce `qa_verified = 1` or status DONE (server-enforced, tested).
- Mid-sprint point edits appear in A3's `+added/−removed` accounting.

## D2 — Multi-agent assignment & per-assignment model (8 pts)

**Problem.** A ticket has exactly one agent; "pair" work (implement + security review, fe + be) can't be expressed, and model choice exists only as a per-agent default.

**Design.**

- **Migration v22 (cont.):** new `ticket_assignments` table: `ticket_id, role TEXT NOT NULL, model TEXT NULL (override; NULL = agent default), is_lead INTEGER NOT NULL DEFAULT 0, UNIQUE(ticket_id, role)`. Backfill: every existing `tickets.agent` becomes its ticket's lead assignment. `tickets.agent` is kept and mirrors the lead (compat for all existing queries/UI).
- **MCP surface:** `create_ticket`/`update_ticket` accept `agents: [{ role, model?, lead? }]` (exactly one lead; single-string `agent` keeps working). `get_ticket` and `load_phase_context(implementation)` emit an extended **Model routing** directive listing every assignment with its resolved model (override ?? agent default).
- **Multi-agent execution mode** (kickoff/sprint Phase 7): the **lead** assignment implements via a subagent at its resolved model; **supporting** assignments run as parallel reviewer/verifier subagents at their resolved models after implementation (e.g. security-specialist audits the diff, qa verifies acceptance criteria). The QA gate aggregates: all supporting verdicts must pass before `qa_verified`. Single-assignment tickets behave exactly as today.
- **Dashboard UI:** agent multi-select chips on the ticket editor (D1), lead marker, and a per-assignment model dropdown validated against the allowed model list (incl. `claude-opus-4-8`) — covering "make sure the model can be selected" at both levels: agent default (exists) and per-assignment override (new).

**Acceptance criteria.**
- Backfill: post-migration, every ticket has exactly one lead assignment matching its old `agent`.
- `create_ticket(agents:[dev(lead), security])` → routing directive lists both with correct resolved models; mixed override/default tested.
- Lead invariant enforced server-side (exactly one lead per ticket; clear error otherwise).
- UI: assigning two agents with different model overrides round-trips through PATCH and shows on the board card.

---

## Delivery — stacked PRs, sequential merge

One PR per sprint, each based on the previous sprint's branch, so review/merge cascades in order and every PR diff shows only its own sprint:

| PR | Branch | Base | CHANGELOG |
|----|--------|------|-----------|
| Sprint 22 | `feat/sprint-22-loop-gates-cockpit` | `main` | 1.4.0 |
| Sprint 23 | `feat/sprint-23-honest-metrics-token-diet` | `feat/sprint-22-…` | 1.5.0 |
| Sprint 24 | `feat/sprint-24-live-board-multi-agent` | `feat/sprint-23-…` | 1.6.0 |

Merge order: 22 → 23 → 24. When a base PR merges (with branch auto-delete), GitHub retargets the next PR to `main` automatically; each PR body states its position in the stack. This satisfies main's up-to-date requirement without cross-sprint rebase pain.

## Cross-cutting

- **One migration (v21)** covers A1; A2/A3 need none. Follows the existing transaction-wrapped versioned-migration pattern in `schema.ts`.
- **`kickoff.md` is rewritten once**, absorbing A1+A2 (gate phase), B1 (card contract), B2 (question protocol), B4 (phase steps) — not four times. `/sprint` and `/retro` get the same treatment where they overlap.
- **Testing:** vitest throughout; card snapshots; migration fixture from a v20 DB copy; e2e SSE test for B4 (playwright config exists).
- **Docs:** CHANGELOG entries per workstream; README statusline section.

## Sprint slicing

| Sprint | Scope | Points |
|--------|-------|--------|
| **22 — Close the Loop & Light the Cockpit** | A1, A2, B1, B2, B3 | 19 |
| **23 — Honest Metrics & Token Diet** | A3, A4, B4, C1 | 10 (+ headroom) |
| **24 — Live Board & Multi-Agent Mode** | D1, D2 | 16 |

Sprint 23's planning will be the **first run of the new gates** — it will surface the 19 legacy try_next items and remaining discoveries, and its light load leaves capacity to adopt some. The system starts eating its own dog food on day one. Sprint 24 then builds on both: D1's point edits feed A3's honest velocity, and D2's routing extends v1.3.0's model delegation. QA tickets are auto-generated on top per standing process.

## Risks & open decisions

1. **Gate hardness** — chosen: refusal + explicit `acknowledge_open_items` override rather than an unskippable hard gate. *Decision point for review.*
2. **Statusline layout/colors** — the line above is a default; taste decision, cheap to change. *Bring opinions to review.*
3. **AskUserQuestion availability** — command files are Claude Code-specific already; the wizard/plain-text fallbacks cover other clients.
4. **Diff-fence rendering** relies on Claude Code's highlighter; cards remain fully legible (just monochrome) if a client doesn't colorize.
5. **A3 backfill** — historical added/removed scope is best-effort; trends are honest from Sprint 22 onward.
6. **UI status edits vs QA gate** — chosen: UI may move TODO ↔ IN_PROGRESS ↔ BLOCKED but never DONE/`qa_verified`; completion stays process-controlled. *Decision point for review.*
7. **Multi-agent semantics** — chosen: one lead implements, supporting assignments review/verify in parallel (not co-implementation, which would conflict on shared files). Co-implementation can be a later mode.
8. **Stacked-PR retarget** relies on branch auto-delete on merge; if disabled, retarget PRs manually after each merge.
