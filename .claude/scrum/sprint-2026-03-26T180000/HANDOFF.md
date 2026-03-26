# Sprint 5 Handoff — Resume in New Session

## What's Done

### T-023: Security Specialist Agent (3pts) — DONE
- Created `.claude/agents/security-specialist.md` with frontmatter, responsibilities, security review checklist
- Updated `RESOURCE_PLANNING.md` — added Security Specialist role to capacity table, updated velocity target to 19pts
- Updated `SPRINT_PROCESS.md` — added "Security Review" step on Day 4 alongside QA

### Sprint 5 Planning — DONE
- `.claude/scrum/sprint-2026-03-26T180000/TICKETS.md` — 4 tickets (T-021 to T-024), 19pts total
- `.claude/scrum/sprint-2026-03-26T180000/PLANNING.md` — sprint goal, capacity, risks, retro actions

## What's Remaining

### T-024: Skills & Agent Health API (3pts, backend-dev)
**File to edit**: `src/dashboard/dashboard.ts`
**Add these functions** before the `// ─── Server ──` section:
```
function apiSkills() { return writeDb.prepare('SELECT name, content, owner_role FROM skills ORDER BY name').all(); }
function apiSkill(name) { return writeDb.prepare('SELECT * FROM skills WHERE name = ?').get(name); }
function apiAgentsHealth() {
  return writeDb.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'DONE') as done_tickets,
      (SELECT COUNT(*) FROM tickets WHERE assigned_to = a.role AND status = 'BLOCKED') as blocked_tickets,
      (SELECT COUNT(*) FROM blockers WHERE reported_by = a.role AND status = 'open') as open_blockers
    FROM agents a ORDER BY a.role
  `).all();
}
```
**Add these routes** in the router `if` chain:
```
else if (url.pathname === "/api/skills") data = apiSkills();
else if (url.pathname.startsWith("/api/skill/")) { const name = decodeURIComponent(url.pathname.slice(11)); data = apiSkill(name); if (!data) { res.writeHead(404); res.end('{"error":"skill not found"}'); return; } }
else if (url.pathname === "/api/agents") data = apiAgentsHealth();
```

### T-021: Dashboard Restructure (8pts, frontend-dev)
**File to edit**: `src/dashboard/dashboard.html` (957 lines)

**Architecture change**:
Replace the current single `.main` div with a two-level navigation:
1. Top bar gets two primary nav items: "Code Explorer" and "Sprint Process"
2. Code Explorer contains the existing tabs (Detail, Changes, Graph)
3. Sprint Process contains new sub-tabs: Board, Milestones, Vision, Team

**Implementation plan**:
1. Add a `<div class="page-nav">` above `.tabs` with two buttons: Code Explorer (active) and Sprint Process
2. Wrap existing `.main` content in `<div class="page code-explorer-page active">`
3. Add `<div class="page sprint-page">` with sub-tabs: Board, Milestones, Vision, Team
4. Board sub-tab: convert the existing sprint dropdown to a **card list** — each sprint is a clickable card showing name, status badge, velocity bar, ticket counts
5. Milestones sub-tab: fetch `/api/skill/MILESTONES` and render the markdown content
6. Vision sub-tab: fetch `/api/skill/PRODUCT_VISION` and render the markdown content
7. Team sub-tab: fetch `/api/agents` and render agent cards with role, model, description, health dot (green/yellow/red)
8. Add `@media (max-width: 768px)` rules to collapse sidebar and stack layout

**CSS to add** (~40 lines):
```css
.page-nav { display: flex; gap: 0; border-bottom: 2px solid var(--border); background: var(--surface); padding: 0 16px; }
.page-nav-item { padding: 14px 24px; font-size: 14px; font-weight: 600; color: var(--text3); cursor: pointer; border-bottom: 2px solid transparent; transition: all .25s; }
.page-nav-item.active { color: var(--accent); border-bottom-color: var(--accent); }
.page { display: none; flex: 1; flex-direction: column; min-height: 0; }
.page.active { display: flex; }
.sprint-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; cursor: pointer; transition: border-color .2s; }
.sprint-card:hover { border-color: var(--accent); }
.sprint-card.active { border-color: var(--accent); box-shadow: var(--shadow-glow); }
.sprint-list { display: flex; flex-direction: column; gap: 8px; padding: 16px; max-width: 400px; }
.agent-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.agent-health { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.agent-health.active { background: var(--accent); }
.agent-health.idle { background: var(--orange); }
.agent-health.blocked { background: var(--red); }
.content-view { flex: 1; overflow-y: auto; padding: 16px 20px; }
.markdown-content { font-size: 14px; line-height: 1.7; }
.markdown-content h1 { font-size: 20px; margin: 20px 0 12px; }
.markdown-content h2 { font-size: 16px; margin: 16px 0 8px; color: var(--accent); }
.markdown-content h3 { font-size: 14px; margin: 12px 0 6px; }
.markdown-content ul, .markdown-content ol { padding-left: 20px; }
.markdown-content li { margin: 4px 0; }
.markdown-content strong { color: var(--text); }
.markdown-content code { background: var(--surface2); padding: 2px 6px; border-radius: 4px; font-family: var(--mono); font-size: 12px; }
@media (max-width: 768px) {
  .container, body > div { grid-template-columns: 1fr !important; }
  .sidebar { display: none; }
  .page-nav { overflow-x: auto; }
}
```

**JS to add** (~60 lines):
- Page switching: click handler on `.page-nav-item` toggles `.page.active`
- Sprint card list: fetch `/api/sprints`, render as cards instead of `<select>`
- Milestones view: fetch `/api/skill/MILESTONES`, simple markdown-to-HTML renderer (headings, lists, bold, code)
- Vision view: same pattern with `/api/skill/PRODUCT_VISION`
- Team view: fetch `/api/agents`, render cards with health indicator
- Simple markdown renderer: replace `## ` with `<h2>`, `**x**` with `<strong>`, `- ` with `<li>`, etc.

### T-022: Sprint Board Views (5pts, frontend-dev)
**After T-021 is done**, enhance the sprint board (when a sprint card is clicked):
1. Add pill buttons: "Tickets" | "Planning" | "QA" | "Retro"
2. Planning view: tickets grouped by `assigned_to` with point totals and 8pt cap indicator
3. QA view: tickets with acceptance criteria rendered as checklist
4. Retro view: findings grouped by category (already implemented, just move into sub-view)

## Build & Test Commands
```bash
npm test          # 44 pass, 1 skip
npm run build     # tsc + copy HTML
```

## Database State
- 6 agents (including new security-specialist)
- 5 sprints (S1-S4 closed, S5 = sprint-2026-03-26T180000)
- 31+ tickets across all sprints
- context.db has both code-context and scrum tables

## Retro Actions to Apply (from Sprint 4)
- [x] All src/ writes done directly (no subagents)
- [x] 19pt velocity target
- [x] 8pt dev cap
- [ ] Dashboard sections need loading/content/error/empty states
- [ ] Import idempotency (ON CONFLICT DO UPDATE)

## Files Modified This Sprint
- `.claude/agents/security-specialist.md` — NEW
- `.claude/skills/RESOURCE_PLANNING.md` — updated capacity table + velocity target
- `.claude/skills/SPRINT_PROCESS.md` — added security review step
- `.claude/scrum/sprint-2026-03-26T180000/` — TICKETS.md, PLANNING.md, HANDOFF.md

## Resume Command
In new session: "Resume Sprint 5 from HANDOFF.md — implement T-024, T-021, T-022, then QA verify, retro, and close sprint. Follow all scrum process rules."
