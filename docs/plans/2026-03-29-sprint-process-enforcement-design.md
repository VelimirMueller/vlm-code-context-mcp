# Sprint Process Enforcement & Config-as-Code Design

**Date**: 2026-03-29
**Milestone**: M17 — Integrations & Ecosystem
**Sprints**: 55, 56, 57 (54pt total)

## Problem

Dual source of truth: `.claude/` markdown files AND SQLite DB both define agents, skills, and processes. `importScrumData()` overwrites DB on every startup. Sprint process is documented but not enforced — Claude can skip phases, forget QA verification, or update tickets without logging.

## Design Principles

1. **DB is runtime truth** — every runtime query hits SQLite, never reads `.claude/` files
2. **TypeScript constants are factory defaults** — seed empty tables on first run, reset on demand
3. **MCP tools enforce gates** — state transitions check preconditions, return errors if violated
4. **Ceremony tool orchestrates** — `advance_sprint` handles phase transitions intelligently
5. **Event trail for everything** — every mutation logs to `event_log` for dashboard visibility

## Epic A: Config as Code (Sprint 55, 19pt)

Move agents, skills, process, templates from files to TypeScript defaults + DB runtime.

- `src/scrum/defaults.ts` — factory default constants
- `seedDefaults()` replaces `importScrumData()` — only seeds empty tables
- Reset tools: `reset_agents`, `reset_sprint_process`, `reset_skills`
- All runtime reads switch from file I/O to DB queries

## Epic B: Sprint Enforcement (Sprint 56, 19pt)

Gate checks + ceremony tool.

- Gates on `update_ticket`: must have assignee, sprint in correct phase
- Gates on `update_sprint`: all tickets done for QA, qa_verified for close
- `advance_sprint` tool: check gates, advance phase, log events, return next actions
- Event trail: every state change → event_log with actor + context

## Epic C: Sprint Lifecycle Blueprint (Sprint 57, 16pt)

Convenience tools + dashboard indicators.

- `start_sprint`: creates sprint + tickets + assignments in one call
- `get_sprint_playbook`: returns "what do I do now" for current phase
- Auto-generated process docs from DB config
- Dashboard gate status indicators per sprint phase
