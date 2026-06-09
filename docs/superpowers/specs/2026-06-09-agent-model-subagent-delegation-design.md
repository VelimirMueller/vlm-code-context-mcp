# Assigned Agent Model Takes Effect via Subagent Delegation

- **Date:** 2026-06-09
- **Status:** Design approved — pending spec review
- **Branch:** `chore/agent-models-and-lint-fix` (already carries the lint fix + model-default updates)
- **Ships in:** v1.3.0 (alongside the server-provided frontend skills — PR #30)

## Problem

The dashboard lets you set a per-agent `model`, but a smoke test proved it's **advisory metadata only**: the value persists to the DB and surfaces in `list_agents`/`get_agent` output, yet **nothing reads it to select or route execution**. Setting a model in the UI changes nothing about which model does the work.

The hard constraint: an MCP server hands the session data and instructions — it **cannot** change the Claude Code session's model. Only the human (`/model`) or the **Task tool's `model` parameter** (when spawning a subagent) picks a model.

## Goal

Make a ticket's assigned-agent model actually take effect by **delegating every ticket's implementation to a subagent spawned at that agent's model tier**. The MCP server surfaces a machine-actionable routing directive at the point of work; the `/kickoff` and `/sprint` command docs instruct Claude to act on it.

## Non-Goals

- Switching the live session's model from the server — impossible by design.
- Pinning an exact minor version (e.g. `4.8`) per subagent — the Task tool routes by **tier** (`opus`/`sonnet`/`haiku`); a subagent at `opus` uses the session's current opus.
- Spawning subagents from the server — Claude Code owns the Task tool; the server only emits the directive.

## Key Decisions (resolved in brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | What "matter" means | **Delegate ticket work to a subagent at the assigned model tier** (true execution routing) |
| 2 | When to delegate | **Every ticket, always** — uniform, clean per-ticket context |
| 3 | Where the directive is surfaced | `load_phase_context` (implementation phase) **and** `get_ticket`, via a shared helper |
| 4 | Release | Ships in **v1.3.0** (coordinate the CHANGELOG with PR #30 at merge — see Release) |

## Architecture

```
agents.model (DB)  ──modelToTier()──▶  'opus' | 'sonnet' | 'haiku'
        │
        ▼
load_phase_context({phase:'implementation', ticket_id})   get_ticket(ticket_id)
        │   (join agents on ticket.assigned_to)                   │
        └──────────────▶  formatModelRouting(role, modelId)  ◀────┘
                                   │  returns a "## Model routing" directive
                                   ▼
        Claude (per command-doc instruction) spawns a subagent:
            Task tool { model: <tier>, prompt: ticket details (+ fe playbook) }
                                   ▼
        subagent implements → reports back → main session QA-gates → ticket DONE
```

No schema change — reuse the existing `agents.model` column.

## Components

### 1. `src/scrum/agent-model.ts` (new, pure + unit-tested)
- `modelToTier(modelId: string | null): "opus" | "sonnet" | "haiku"` — prefix match: `claude-opus-*`→`opus`, `claude-sonnet-*`→`sonnet`, `claude-haiku-*`→`haiku`. Unknown/null → `sonnet` (defensive mid-tier default).
- `formatModelRouting(role: string, modelId: string | null): string` — returns the directive markdown:
  > `## Model routing`
  > `This ticket is assigned to **<role>** (model \`<modelId>\` → tier \`<tier>\`).`
  > `Implement it by spawning a subagent: Task tool with \`model: "<tier>"\`. Pass the ticket title, description, and acceptance criteria (for \`fe-engineer\`, also the frontend playbook). Have the subagent implement and report back; then run the QA gate and mark the ticket DONE.`

### 2. `src/scrum/tools.ts` — surface the directive
- **`load_phase_context`** implementation branch: when `ticket_id` is provided, look up the ticket's `assigned_to`, join `agents` for its `model`, and `sections.push(formatModelRouting(role, model))`. (Every ticket is assigned in this workflow — kickoff assigns feature tickets to dev roles and QA tickets to `qa`; the no-assignee/no-agent skip is purely a defensive guard for malformed data, not a behavioral carve-out from "every ticket".)
- **`get_ticket`**: after the `Assigned: <role>` line, if assigned, append the routing directive via the same helper.

### 3. Command docs — instruct delegation
- **`.claude/commands/kickoff.md`** Phase 7 (Implementation Loop) and **the `/sprint` command** implementation step: add a step — "For each ticket, read the **Model routing** directive from `load_phase_context`, spawn a subagent via the Task tool at the given tier with the ticket details (+ frontend playbook for `fe-engineer`), let it implement, then verify (QA gate) and mark DONE."

## Data Flow

1. Sprint implementation begins; for ticket N, Claude calls `load_phase_context({phase:'implementation', sprint_id, ticket_id: N})`.
2. The tool returns sprint/ticket context **plus** the `## Model routing` directive (tier derived from the assigned agent's model).
3. Claude spawns a subagent via Task with `model: <tier>` and the ticket details; the subagent runs at that tier.
4. Subagent reports its result; the main session QA-verifies and marks the ticket DONE (existing gate, unchanged).

## Caveat (documented in code + docs)

Routing is **tier-level**. The stored full ID (`claude-opus-4-8`) is the record and the display value; the Task tool routes by tier, so the precise minor version isn't pinned per subagent. This is acceptable — tier is what determines opus-vs-sonnet-vs-haiku, which is the routing decision that matters.

## Release (v1.3.0 — coordinate with PR #30)

This feature ships as part of **1.3.0**, the same release as the server-provided frontend skills (PR #30).

- `package.json`: bump `1.2.1` → `1.3.0` on this branch.
- `CHANGELOG.md`: add a `## [1.3.0]` section covering **all** of this branch's work — the SprintPlanningView lint fix, the agent-model default updates (strongest for dev/QA; dropped `claude-opus-4-6`), and this **subagent model-routing** feature.
- **Merge coordination:** PR #30 also introduces a `## [1.3.0]` section and bumps to `1.3.0`. Whichever PR merges second will hit a trivial CHANGELOG conflict — resolve by **combining the two 1.3.0 sections' bullets** (package.json `1.3.0` is identical, no version conflict). Flag this in the PR description.

## Files Changed

- `src/scrum/agent-model.ts` — new helper (`modelToTier`, `formatModelRouting`)
- `src/scrum/tools.ts` — directive in `load_phase_context` (implementation) + `get_ticket`
- `.claude/commands/kickoff.md` — Phase 7 delegation step; `/sprint` command doc — implementation delegation step
- `package.json`, `CHANGELOG.md` — v1.3.0 (covering lint + models + delegation)
- `test/agent-model.test.ts` — new
- (`docs/api-reference.md` / `README` — optional note that ticket implementation delegates to a subagent at the assigned tier)

## Testing

- `modelToTier`: `claude-opus-4-8`→`opus`, `claude-sonnet-4-6`→`sonnet`, `claude-haiku-4-5`→`haiku`, unknown/null→`sonnet`.
- `formatModelRouting`: output contains the role, the tier, and `Task` (the spawn instruction).
- `load_phase_context` implementation: directive present for an `fe-engineer`-assigned ticket (tier `opus`); absent for an unassigned ticket.
- `get_ticket`: directive present for an assigned ticket; absent for an unassigned one.

## Open Questions

None blocking. The tier-routing caveat and the 1.3.0 merge coordination are noted above.
