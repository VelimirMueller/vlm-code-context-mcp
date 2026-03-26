# Retrospective Findings -- Sprint 5

## Sprint Metrics
- **Velocity**: 19 / 19 committed (100%)
- **Tickets DONE**: 4 / 4 (T-021, T-022, T-023, T-024)
- **Tests**: 44 passing, 1 skipped
- **New agent**: Security Specialist onboarded

---

## Product Owner
**What went well**: The INSTRUCTIONS.md epic is progressing well. Dashboard restructure gives the product a professional multi-page feel. Sprint list as cards is much better than dropdown.
**What went wrong**: The INSTRUCTIONS.md has more scope than originally planned — landing page animation and mobile polish still need Sprint 6.
**What to try**: Break remaining INSTRUCTIONS.md work into a final Sprint 6 with clear scope: landing page, mobile responsive polish, and final documentation update.

## Scrum Master
**What went well**: All retro actions from Sprint 4 were applied. The handoff file worked as a context preservation mechanism.
**What went wrong**: Context limits from plugin injections forced a handoff mid-sprint. Need to manage context budget better.
**What to try**: Start implementation immediately after planning — minimize context spent on research/exploration before coding.

## Manager
**What went well**: Zero new dependencies added. All changes were HTML/CSS/JS in the dashboard and 3 lines of API functions. Cost-efficient sprint.
**What went wrong**: Nothing to flag.
**What to try**: Continue this pattern.

## Backend Developer
**What went well**: T-024 API endpoints were 3 clean functions + 3 routes. Took 5 minutes. Skills and agent health data flows correctly.
**What went wrong**: The agent health query doesn't correctly attribute tickets to agents because the import stores inconsistent assigned_to values.
**What to try**: Normalize assigned_to values during import (strip whitespace, lowercase).

## Architect
**What went well**: Security specialist agent is well-scoped — review only, no blocking. The security review checklist is practical and specific.
**What went wrong**: Nothing.
**What to try**: Run the first real security review in Sprint 6.

## Frontend Developer
**What went well**: Major dashboard restructure completed. Two-level navigation (Code Explorer / Sprint Process), sprint cards, milestones/vision/team views, planning/QA/retro pill tabs. All using existing CSS variables.
**What went wrong**: The markdown renderer is very basic — doesn't handle tables, blockquotes, or nested lists.
**What to try**: Consider a tiny markdown library or improve the regex renderer for common patterns.

## QA Engineer
**What went well**: Build passes, dashboard loads, all APIs return correct data.
**What went wrong**: No automated tests for the new dashboard APIs or the new HTML views.
**What to try**: Add API integration tests in Sprint 6.

---

## Actionable Changes for Sprint 6

### ACTION 1: Normalize assigned_to during import
Strip whitespace and lowercase all assigned_to values in the import function.
**Owner**: Backend Developer

### ACTION 2: Start implementation immediately after planning
Minimize exploration/research time. Plan, then code.
**Owner**: Scrum Master

### ACTION 3: Run first security review
Security specialist reviews all MCP tool handlers for OWASP Top 10 issues.
**Owner**: Security Specialist
