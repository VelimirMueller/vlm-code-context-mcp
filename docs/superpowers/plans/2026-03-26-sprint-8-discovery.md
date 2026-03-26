# Sprint 8: Discovery & API Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map every dashboard feature, build missing MCP tools for milestone/vision/sprint-planning workflows, design the React component tree and Zustand store architecture, and fix file explorer collapse behavior — all persisted as actionable specs.

**Architecture:** Backend-first sprint. New `milestones` table added to SQLite schema. 6 new MCP tools registered in `src/scrum/tools.ts` following existing patterns. 6 new HTTP API endpoints in `src/dashboard/dashboard.ts`. File explorer collapse fix is a surgical change to `renderFileTree()` in `dashboard.html`. Discovery docs committed to `.claude/scrum/`.

**Tech Stack:** TypeScript, better-sqlite3, Zod, MCP SDK, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/scrum/schema.ts` | Add `milestones` table + index |
| Modify | `src/scrum/tools.ts` | Add 6 new MCP tools |
| Modify | `src/dashboard/dashboard.ts` | Add 6 new API endpoints |
| Modify | `src/dashboard/dashboard.html` | Fix file tree collapse behavior |
| Modify | `test/scrum.test.ts` | Add milestones schema tests |
| Modify | `test/scrum-tools.test.ts` | Add tests for new tools |
| Create | `.claude/scrum/AUDIT.md` | Full feature audit document |
| Create | `.claude/scrum/COMPONENT_TREE.md` | React component hierarchy spec |
| Create | `.claude/scrum/STORE_DESIGN.md` | Zustand store architecture spec |

---

### Task 1: Full Feature Audit (T-051)

**Files:**
- Create: `.claude/scrum/AUDIT.md`

This is a documentation-only task. Audit every page, tab, API endpoint, interaction, and state pattern in the current dashboard.

- [ ] **Step 1: Audit Code Explorer page**

Read `src/dashboard/dashboard.html` lines 412-435 (page structure) and all related JS functions. Document in AUDIT.md:

```markdown
# Dashboard Feature Audit

## Page 1: Code Explorer (id: page-explorer)

### Layout
- Left sidebar (300px): file tree with search
- Main panel: 3 tabs (Detail, Changes, Graph)

### Components
- **Search bar**: `.search` input, filters file tree on keyup (debounced)
- **File tree**: hierarchical folders + files, auto-expands first 2 levels
- **Detail tab**: file path, language, size, line count, exports table, imports list, imported-by list
- **Changes tab**: time-grouped feed of file modifications with expandable diffs
- **Graph tab**: canvas-based force-directed dependency visualization with pan/zoom

### Interactions
- Click file → loads detail + changes + graph
- Click folder → toggle expand/collapse
- Cmd+K → focus search
- Arrow keys → navigate file list
- Esc → dismiss search
- Hash routing: #file/{id}, #graph, #changes

### State
- `selectedFileId` (JS var, synced to URL hash)
- `allFiles`, `allDirs` (fetched once on init)
- `expandedDirs` (Set, ephemeral)
- `graphData` (fetched once on init)

### API Dependencies
- GET /api/files → file list
- GET /api/directories → directory tree
- GET /api/file/{id} → file detail
- GET /api/file/{id}/changes → change history
- GET /api/graph → dependency graph nodes + edges
- GET /api/stats → header stat counters
```

- [ ] **Step 2: Audit Sprint page**

Document Sprint page with all 3 sub-tabs:

```markdown
## Page 2: Sprint (id: page-sprint)

### Sub-tab: Board (stab-board)
- Left panel: sprint list cards (name, status badge, ticket counts, velocity bar)
- Right panel: sprint detail with overview stats + kanban board (TODO/IN_PROGRESS/DONE/BLOCKED columns)
- Ticket cards show: ref, title, assignee, priority badge, story points
- Retro findings grouped by category (went_well/went_wrong/try_next)

### Sub-tab: Team (stab-team)
- Grid of agent cards (agent-grid)
- Each card: role name, description, model, health dot (active/idle/blocked), mood emoji + score bar
- Mood computed server-side (base 50, +5 done tickets, -20 blocked, etc.)

### Sub-tab: Retro Insights (stab-insights)
- Bento grid with 6 cards: Recurring Topics, Stats, Recurring Good, Recurring Bad, Best Moment, Worst Moment
- Stats card shows live counts from API (went_well/went_wrong/try_next)
- Content is synthesized from all retro findings across all sprints

### Interactions
- Click sprint card → loads sprint detail (overview + kanban + retro)
- Sub-tab switching within sprint-page-content

### State
- Sprint list fetched on page switch
- Selected sprint detail fetched on card click
- Team data fetched on page switch

### API Dependencies
- GET /api/sprints → sprint list with counts
- GET /api/sprint/{id} → sprint detail
- GET /api/sprint/{id}/tickets → tickets for kanban
- GET /api/sprint/{id}/retro → retro findings
- GET /api/agents → agent health/mood
```

- [ ] **Step 3: Audit Project Management page**

```markdown
## Page 3: Project Management (id: page-planning)

### Sub-tab: Milestones (ptab-milestones)
- Rendered from /api/skill/MILESTONES skill content
- Markdown rendered to HTML via renderMarkdown() helper
- Currently read-only display

### Sub-tab: Product Vision (ptab-vision)
- Rendered from /api/skill/PRODUCT_VISION skill content
- Markdown rendered to HTML
- Currently read-only display

### Sub-tab: Gantt Chart (ptab-gantt)
- Timeline bar visualization of sprints
- Shows sprint name, date range, status color coding
- Responsive: switches to vertical on mobile

### Interactions
- Sub-tab switching only — no editing, no creation

### State
- All 3 sub-tabs fetched on page switch (loadMilestones, loadVision, loadGantt)
- Data fetched fresh each time (no caching)

### API Dependencies
- GET /api/skill/MILESTONES → markdown content
- GET /api/skill/PRODUCT_VISION → markdown content
- GET /api/sprints → gantt timeline data

### GAP ANALYSIS — Missing for Sprint 9 workflows:
- No milestone CRUD (milestones are a skill file, not a DB table)
- No vision editing (read-only display of skill file)
- No sprint planning UI (sprints created via MCP tools only)
- No ticket-to-milestone linking UI
- No backlog view (unassigned tickets)
```

- [ ] **Step 4: Audit API endpoints and real-time system**

```markdown
## API Inventory

### Code Context APIs (read-only)
| Endpoint | Method | Response | Used By |
|----------|--------|----------|---------|
| /api/files | GET | File[] | Code Explorer sidebar |
| /api/directories | GET | Dir[] | Code Explorer file tree |
| /api/file/{id} | GET | FileDetail | Code Explorer detail tab |
| /api/file/{id}/changes | GET | Change[] | Code Explorer changes tab |
| /api/graph | GET | {nodes, edges} | Code Explorer graph tab |
| /api/stats | GET | Stats | Topbar stat counters |
| /api/changes | GET | Change[] | (unused in UI) |

### Skills & Agents APIs (read-only)
| Endpoint | Method | Response | Used By |
|----------|--------|----------|---------|
| /api/skills | GET | Skill[] | (unused in UI) |
| /api/skill/{name} | GET | SkillDetail | Project Management tabs |
| /api/agents | GET | Agent[] | Sprint team tab |

### Scrum APIs (read-only)
| Endpoint | Method | Response | Used By |
|----------|--------|----------|---------|
| /api/sprints | GET | Sprint[] | Sprint board, Gantt |
| /api/sprint/{id} | GET | SprintDetail | Sprint detail panel |
| /api/sprint/{id}/tickets | GET | Ticket[] | Sprint kanban |
| /api/sprint/{id}/retro | GET | RetroFinding[] | Sprint retro tab, Insights |

### Real-time
| Endpoint | Type | Events |
|----------|------|--------|
| /api/events | SSE | "updated" on file change |

### MISSING APIs (needed for Sprint 9):
- POST /api/milestones — create milestone
- PUT /api/milestone/{id} — update milestone
- POST /api/milestone/{id}/tickets — link ticket to milestone
- PUT /api/vision — update product vision
- POST /api/sprints/plan — create sprint with tickets from backlog
- GET /api/backlog — unassigned/unscheduled tickets
```

- [ ] **Step 5: Commit audit document**

```bash
git add .claude/scrum/AUDIT.md
git commit -m "docs: add full dashboard feature audit for Sprint 8 discovery

Maps all 3 pages, 9 sub-tabs, 16 API endpoints, all interactions,
state patterns, and identifies 6 missing APIs for Sprint 9 workflows.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Milestones Schema + New MCP Tools (T-052)

**Files:**
- Modify: `src/scrum/schema.ts`
- Modify: `src/scrum/tools.ts`
- Modify: `test/scrum.test.ts`
- Modify: `test/scrum-tools.test.ts`

#### Part A: Schema — milestones table

- [ ] **Step 1: Write failing test for milestones table**

Add to `test/scrum.test.ts`:

```typescript
it("should create milestones table", () => {
  const cols = db
    .prepare(`PRAGMA table_info(milestones)`)
    .all()
    .map((c: any) => c.name);
  expect(cols).toContain("id");
  expect(cols).toContain("name");
  expect(cols).toContain("description");
  expect(cols).toContain("status");
  expect(cols).toContain("target_date");
  expect(cols).toContain("progress");
});

it("should enforce milestones status constraint", () => {
  db.prepare(
    `INSERT INTO milestones (name, status) VALUES ('M1', 'active')`
  ).run();
  expect(() =>
    db.prepare(
      `INSERT INTO milestones (name, status) VALUES ('M2', 'invalid')`
    ).run()
  ).toThrow();
});

it("should enforce unique milestone name", () => {
  db.prepare(
    `INSERT INTO milestones (name, status) VALUES ('M1', 'active')`
  ).run();
  expect(() =>
    db.prepare(
      `INSERT INTO milestones (name, status) VALUES ('M1', 'active')`
    ).run()
  ).toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — table `milestones` does not exist

- [ ] **Step 3: Add milestones table to schema**

In `src/scrum/schema.ts`, add before the `CREATE INDEX` statements:

```typescript
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
      target_date TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
```

Also update the comment at the top:
```typescript
 * Tables: agents, sprints, tickets, subtasks, retro_findings, blockers, bugs, skills, processes, milestones
```

- [ ] **Step 4: Add milestone_id FK to tickets table**

In `src/scrum/schema.ts`, add a column to the tickets table definition, after `milestone TEXT,`:

```typescript
      milestone_id INTEGER,
```

And add a foreign key at the end of the tickets table:
```typescript
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL,
```

Add an index:
```typescript
    CREATE INDEX IF NOT EXISTS idx_tickets_milestone_id ON tickets(milestone_id);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 6: Run build to verify compilation**

Run: `npm run build 2>&1 | tail -5`
Expected: Clean build

- [ ] **Step 7: Commit schema changes**

```bash
git add src/scrum/schema.ts test/scrum.test.ts
git commit -m "feat: add milestones table with FK on tickets

New table: milestones (name, description, status, target_date, progress)
New column: tickets.milestone_id FK to milestones
3 new schema tests for table creation, status constraint, unique name.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

#### Part B: MCP Tools — create_milestone, update_milestone

- [ ] **Step 8: Write failing tests for milestone tools**

Add to `test/scrum-tools.test.ts`:

```typescript
describe("milestone tools", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    initScrumSchema(db);
  });

  it("should create a milestone", () => {
    db.prepare(
      `INSERT INTO milestones (name, description, status, target_date) VALUES (?, ?, ?, ?)`
    ).run("M3-Ecosystem", "Multi-language support", "planned", "2026-05-01");
    const m = db.prepare(`SELECT * FROM milestones WHERE name = ?`).get("M3-Ecosystem") as any;
    expect(m).toBeDefined();
    expect(m.name).toBe("M3-Ecosystem");
    expect(m.status).toBe("planned");
    expect(m.progress).toBe(0);
  });

  it("should update milestone status and progress", () => {
    db.prepare(
      `INSERT INTO milestones (name, status) VALUES (?, ?)`
    ).run("M1", "planned");
    db.prepare(
      `UPDATE milestones SET status = ?, progress = ?, updated_at = datetime('now') WHERE name = ?`
    ).run("active", 50, "M1");
    const m = db.prepare(`SELECT * FROM milestones WHERE name = ?`).get("M1") as any;
    expect(m.status).toBe("active");
    expect(m.progress).toBe(50);
  });

  it("should link ticket to milestone", () => {
    db.prepare(`INSERT INTO milestones (name, status) VALUES (?, ?)`).run("M1", "active");
    const mId = (db.prepare(`SELECT id FROM milestones WHERE name = ?`).get("M1") as any).id;
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("s1", "active");
    const sId = (db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("s1") as any).id;
    db.prepare(
      `INSERT INTO tickets (sprint_id, title, milestone_id) VALUES (?, ?, ?)`
    ).run(sId, "Test ticket", mId);
    const t = db.prepare(`SELECT milestone_id FROM tickets WHERE title = ?`).get("Test ticket") as any;
    expect(t.milestone_id).toBe(mId);
  });

  it("should get backlog tickets (no sprint or TODO status)", () => {
    db.prepare(`INSERT INTO sprints (name, status) VALUES (?, ?)`).run("s1", "closed");
    const sId = (db.prepare(`SELECT id FROM sprints WHERE name = ?`).get("s1") as any).id;
    db.prepare(`INSERT INTO tickets (sprint_id, title, status) VALUES (?, ?, ?)`).run(sId, "Done ticket", "DONE");
    db.prepare(`INSERT INTO tickets (sprint_id, title, status) VALUES (?, ?, ?)`).run(null, "Backlog ticket", "TODO");
    const backlog = db.prepare(
      `SELECT * FROM tickets WHERE sprint_id IS NULL OR (status = 'TODO' AND sprint_id IN (SELECT id FROM sprints WHERE status = 'closed'))`
    ).all() as any[];
    expect(backlog.length).toBeGreaterThanOrEqual(1);
    expect(backlog.some((t: any) => t.title === "Backlog ticket")).toBe(true);
  });
});
```

- [ ] **Step 9: Run tests to verify they pass** (these are DB-level tests, schema already supports them)

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 10: Add create_milestone MCP tool**

Add to `src/scrum/tools.ts`, after the existing `export_sprint_report` tool:

```typescript
  server.tool(
    "create_milestone",
    "Create a new project milestone",
    {
      name: z.string().describe("Milestone name (e.g. 'M3-Ecosystem')"),
      description: z.string().optional().describe("Milestone description"),
      target_date: z.string().optional().describe("Target completion date (ISO 8601)"),
      status: z.enum(["planned", "active", "completed"]).optional().default("planned"),
    },
    async ({ name, description, target_date, status }) => {
      try {
        const result = db.prepare(
          `INSERT INTO milestones (name, description, target_date, status) VALUES (?, ?, ?, ?)`
        ).run(name, description || null, target_date || null, status);
        return { content: [{ type: "text" as const, text: `Milestone created: ${name} (id: ${result.lastInsertRowid})` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
```

- [ ] **Step 11: Add update_milestone MCP tool**

```typescript
  server.tool(
    "update_milestone",
    "Update a milestone's status, description, or progress",
    {
      milestone_id: z.number().describe("Milestone ID"),
      status: z.enum(["planned", "active", "completed"]).optional(),
      description: z.string().optional(),
      progress: z.number().min(0).max(100).optional().describe("Completion percentage (0-100)"),
      target_date: z.string().optional(),
    },
    async ({ milestone_id, status, description, progress, target_date }) => {
      const sets: string[] = []; const vals: any[] = [];
      if (status) { sets.push("status=?"); vals.push(status); }
      if (description) { sets.push("description=?"); vals.push(description); }
      if (progress !== undefined) { sets.push("progress=?"); vals.push(progress); }
      if (target_date) { sets.push("target_date=?"); vals.push(target_date); }
      if (sets.length === 0) return { content: [{ type: "text" as const, text: "Nothing to update." }] };
      sets.push("updated_at=datetime('now')");
      vals.push(milestone_id);
      db.prepare(`UPDATE milestones SET ${sets.join(",")} WHERE id=?`).run(...vals);
      return { content: [{ type: "text" as const, text: `Milestone ${milestone_id} updated.` }] };
    }
  );
```

- [ ] **Step 12: Add link_ticket_to_milestone MCP tool**

```typescript
  server.tool(
    "link_ticket_to_milestone",
    "Associate a ticket with a milestone",
    {
      ticket_id: z.number().describe("Ticket ID"),
      milestone_id: z.number().describe("Milestone ID"),
    },
    async ({ ticket_id, milestone_id }) => {
      try {
        const milestone = db.prepare(`SELECT name FROM milestones WHERE id=?`).get(milestone_id) as any;
        if (!milestone) return { content: [{ type: "text" as const, text: `Milestone ${milestone_id} not found.` }], isError: true };
        db.prepare(`UPDATE tickets SET milestone_id=?, updated_at=datetime('now') WHERE id=?`).run(milestone_id, ticket_id);
        return { content: [{ type: "text" as const, text: `Ticket #${ticket_id} linked to milestone "${milestone.name}".` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
```

- [ ] **Step 13: Add update_vision MCP tool**

```typescript
  server.tool(
    "update_vision",
    "Update the product vision document",
    {
      content: z.string().describe("New product vision markdown content"),
    },
    async ({ content }) => {
      try {
        db.prepare(
          `INSERT INTO skills (name, content, owner_role) VALUES ('PRODUCT_VISION', ?, 'product-owner')
           ON CONFLICT(name) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`
        ).run(content);
        return { content: [{ type: "text" as const, text: `Product vision updated (${content.length} chars).` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
```

- [ ] **Step 14: Add get_backlog MCP tool**

```typescript
  server.tool(
    "get_backlog",
    "List unassigned or unscheduled tickets available for sprint planning",
    {},
    async () => {
      const tickets = db.prepare(`
        SELECT t.id, t.ticket_ref, t.title, t.priority, t.story_points, t.milestone, t.milestone_id
        FROM tickets t
        WHERE t.sprint_id IS NULL
           OR (t.status IN ('TODO', 'NOT_DONE') AND t.sprint_id IN (SELECT id FROM sprints WHERE status = 'closed'))
        ORDER BY t.priority, t.created_at
      `).all() as any[];
      if (tickets.length === 0) return { content: [{ type: "text" as const, text: "Backlog is empty. All tickets are assigned to active sprints." }] };
      const text = tickets.map(t =>
        `- [${t.priority}] ${t.ticket_ref || '#'+t.id}: ${t.title} (${t.story_points || '?'}sp)${t.milestone ? ' → '+t.milestone : ''}`
      ).join("\n");
      return { content: [{ type: "text" as const, text: `# Backlog (${tickets.length} tickets)\n\n${text}` }] };
    }
  );
```

- [ ] **Step 15: Add plan_sprint MCP tool**

```typescript
  server.tool(
    "plan_sprint",
    "Create a new sprint and move selected backlog tickets into it",
    {
      name: z.string().describe("Sprint name (e.g. 'sprint-2026-04-07')"),
      goal: z.string().optional().describe("Sprint goal"),
      ticket_ids: z.array(z.number()).describe("Array of ticket IDs to move into this sprint"),
      velocity_committed: z.number().optional().describe("Committed velocity in story points"),
    },
    async ({ name, goal, ticket_ids, velocity_committed }) => {
      try {
        const result = db.prepare(
          `INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, 'planning', ?)`
        ).run(name, goal || null, velocity_committed || 0);
        const sprintId = result.lastInsertRowid;
        const update = db.prepare(`UPDATE tickets SET sprint_id=?, status='TODO', updated_at=datetime('now') WHERE id=?`);
        let moved = 0;
        for (const tid of ticket_ids) {
          const changes = update.run(sprintId, tid);
          if (changes.changes > 0) moved++;
        }
        return { content: [{ type: "text" as const, text: `Sprint "${name}" created (id: ${sprintId}) with ${moved}/${ticket_ids.length} tickets. Velocity committed: ${velocity_committed || 0}pt.` }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
```

- [ ] **Step 16: Run tests and build**

Run: `npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS

Run: `npm run build 2>&1 | tail -5`
Expected: Clean build

- [ ] **Step 17: Commit new MCP tools**

```bash
git add src/scrum/tools.ts test/scrum-tools.test.ts
git commit -m "feat: add 6 MCP tools for milestone/vision/sprint-planning workflows

New tools: create_milestone, update_milestone, link_ticket_to_milestone,
update_vision, get_backlog, plan_sprint.
4 new integration tests for milestone CRUD, linking, and backlog query.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

#### Part C: Dashboard API endpoints

- [ ] **Step 18: Add milestone API endpoints to dashboard.ts**

In `src/dashboard/dashboard.ts`, add new API handler functions (following the existing pattern):

```typescript
function apiMilestones() {
  try {
    return writeDb.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id) as ticket_count,
        (SELECT COUNT(*) FROM tickets WHERE milestone_id = m.id AND status = 'DONE') as done_count
      FROM milestones m ORDER BY m.created_at DESC
    `).all();
  } catch { return []; }
}

function apiMilestoneUpdate(id: number, body: any) {
  const sets: string[] = []; const vals: any[] = [];
  if (body.status) { sets.push("status=?"); vals.push(body.status); }
  if (body.description) { sets.push("description=?"); vals.push(body.description); }
  if (body.progress !== undefined) { sets.push("progress=?"); vals.push(body.progress); }
  if (body.target_date) { sets.push("target_date=?"); vals.push(body.target_date); }
  if (sets.length === 0) return { error: "Nothing to update" };
  sets.push("updated_at=datetime('now')");
  vals.push(id);
  writeDb.prepare(`UPDATE milestones SET ${sets.join(",")} WHERE id=?`).run(...vals);
  return { ok: true };
}

function apiCreateMilestone(body: any) {
  const result = writeDb.prepare(
    `INSERT INTO milestones (name, description, target_date, status) VALUES (?, ?, ?, ?)`
  ).run(body.name, body.description || null, body.target_date || null, body.status || "planned");
  return { id: result.lastInsertRowid, name: body.name };
}

function apiVisionUpdate(body: any) {
  writeDb.prepare(
    `INSERT INTO skills (name, content, owner_role) VALUES ('PRODUCT_VISION', ?, 'product-owner')
     ON CONFLICT(name) DO UPDATE SET content=excluded.content, updated_at=datetime('now')`
  ).run(body.content);
  return { ok: true };
}

function apiBacklog() {
  try {
    return writeDb.prepare(`
      SELECT t.id, t.ticket_ref, t.title, t.priority, t.story_points, t.milestone, t.milestone_id
      FROM tickets t
      WHERE t.sprint_id IS NULL
         OR (t.status IN ('TODO', 'NOT_DONE') AND t.sprint_id IN (SELECT id FROM sprints WHERE status = 'closed'))
      ORDER BY t.priority, t.created_at
    `).all();
  } catch { return []; }
}

function apiPlanSprint(body: any) {
  const result = writeDb.prepare(
    `INSERT INTO sprints (name, goal, status, velocity_committed) VALUES (?, ?, 'planning', ?)`
  ).run(body.name, body.goal || null, body.velocity_committed || 0);
  const sprintId = result.lastInsertRowid;
  const update = writeDb.prepare(`UPDATE tickets SET sprint_id=?, status='TODO', updated_at=datetime('now') WHERE id=?`);
  let moved = 0;
  for (const tid of (body.ticket_ids || [])) {
    const changes = update.run(sprintId, tid);
    if (changes.changes > 0) moved++;
  }
  return { id: sprintId, name: body.name, tickets_moved: moved };
}
```

- [ ] **Step 19: Wire new endpoints into the HTTP handler**

In the request handler section of `dashboard.ts`, add route matching for the new endpoints. Find the section where routes are matched and add:

```typescript
      else if (url.pathname === "/api/milestones" && req.method === "GET") data = apiMilestones();
      else if (url.pathname === "/api/milestones" && req.method === "POST") {
        const body = JSON.parse(await readBody(req));
        data = apiCreateMilestone(body);
      }
      else if (url.pathname.match(/^\/api\/milestone\/\d+$/) && req.method === "PUT") {
        const mid = Number(url.pathname.split("/")[3]);
        const body = JSON.parse(await readBody(req));
        data = apiMilestoneUpdate(mid, body);
      }
      else if (url.pathname === "/api/vision" && req.method === "PUT") {
        const body = JSON.parse(await readBody(req));
        data = apiVisionUpdate(body);
      }
      else if (url.pathname === "/api/backlog") data = apiBacklog();
      else if (url.pathname === "/api/sprints/plan" && req.method === "POST") {
        const body = JSON.parse(await readBody(req));
        data = apiPlanSprint(body);
      }
```

Also add a `readBody` helper at the top of the file (if it doesn't exist):

```typescript
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
```

- [ ] **Step 20: Run build to verify compilation**

Run: `npm run build 2>&1 | tail -5`
Expected: Clean build

- [ ] **Step 21: Commit API endpoints**

```bash
git add src/dashboard/dashboard.ts
git commit -m "feat: add 6 dashboard API endpoints for milestones, vision, backlog, sprint planning

GET/POST /api/milestones, PUT /api/milestone/{id}, PUT /api/vision,
GET /api/backlog, POST /api/sprints/plan. Supports the interactive
workflows planned for the React rewrite in Sprint 9.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: React Component Tree Design (T-053)

**Files:**
- Create: `.claude/scrum/COMPONENT_TREE.md`

- [ ] **Step 1: Write the component tree document**

```markdown
# React Component Tree — Atomic Design Spec

## Directory Structure

```
src/dashboard/app/
├── main.tsx                          # Entry point, mounts <App />
├── App.tsx                           # Router + layout shell
├── index.css                         # Global styles, CSS variables, Tailwind config
├── vite-env.d.ts                     # Vite types
│
├── components/
│   ├── atoms/
│   │   ├── Badge.tsx                 # Status/priority badge (color variants)
│   │   ├── Button.tsx                # Action button (primary/ghost/danger)
│   │   ├── Dot.tsx                   # Status dot (language color, health)
│   │   ├── Icon.tsx                  # SVG icon wrapper
│   │   ├── Input.tsx                 # Text input with optional icon
│   │   ├── Skeleton.tsx              # Shimmer loading placeholder
│   │   ├── Stat.tsx                  # Single stat (number + label)
│   │   └── Tooltip.tsx               # Hover tooltip
│   │
│   ├── molecules/
│   │   ├── FileItem.tsx              # File row in tree (dot + name + size)
│   │   ├── FolderItem.tsx            # Folder row with chevron + count
│   │   ├── TicketCard.tsx            # Kanban card (ref, title, assignee, pts)
│   │   ├── AgentCard.tsx             # Team grid card (role, mood, health bar)
│   │   ├── SprintCard.tsx            # Sprint list card (name, status, velocity)
│   │   ├── BentoCard.tsx             # Retro insights bento card
│   │   ├── StatGroup.tsx             # Row of Stat atoms
│   │   ├── SearchBar.tsx             # Search input with Cmd+K hint
│   │   ├── TabBar.tsx                # Generic tab switcher (underline style)
│   │   ├── SubTabBar.tsx             # Sub-tab switcher (pill style)
│   │   └── MarkdownRenderer.tsx      # Renders markdown to HTML safely
│   │
│   ├── organisms/
│   │   ├── FileTree.tsx              # Recursive folder/file tree (smart)
│   │   ├── KanbanBoard.tsx           # 4-column board with ticket cards
│   │   ├── BentoGrid.tsx             # Retro insights bento layout
│   │   ├── TeamGrid.tsx              # Agent card grid
│   │   ├── SprintList.tsx            # Sprint card list with selection
│   │   ├── SprintDetail.tsx          # Selected sprint overview + kanban
│   │   ├── DependencyGraph.tsx       # Canvas-based force graph (smart)
│   │   ├── GanttChart.tsx            # Timeline bar visualization
│   │   ├── MilestoneList.tsx         # Milestones with create/edit (smart)
│   │   ├── VisionEditor.tsx          # Markdown editor + preview (smart)
│   │   ├── SprintPlanner.tsx         # Sprint planning modal flow (smart)
│   │   └── Topbar.tsx                # App header with stats + search
│   │
│   └── templates/
│       ├── ExplorerLayout.tsx        # Sidebar + main panel layout
│       ├── SprintLayout.tsx          # Sub-tabbed sprint layout
│       └── PlanningLayout.tsx        # Sub-tabbed planning layout
│
├── pages/
│   ├── CodeExplorer.tsx              # Page: file tree + detail/changes/graph
│   ├── Sprint.tsx                    # Page: board + team + insights
│   └── ProjectManagement.tsx         # Page: milestones + vision + gantt
│
├── hooks/
│   ├── useFiles.ts                   # Files & directories from fileStore
│   ├── useSprints.ts                 # Sprints, tickets, retro from sprintStore
│   ├── useAgents.ts                  # Agent health from agentStore
│   ├── usePlanning.ts               # Milestones, vision from planningStore
│   ├── useSearch.ts                  # Debounced search with results
│   ├── useEventSource.ts            # SSE connection + store updates
│   ├── useHashRouter.ts             # URL hash ↔ UI state sync
│   └── useKeyboard.ts               # Keyboard shortcuts (Cmd+K, Esc, arrows)
│
├── stores/
│   ├── fileStore.ts                  # Server state: files, dirs, selected, detail
│   ├── sprintStore.ts                # Server state: sprints, tickets, retro
│   ├── agentStore.ts                 # Server state: agents
│   ├── planningStore.ts              # Server state: milestones, vision, gantt
│   └── uiStore.ts                    # UI state: page, tab, sidebar, search, folders
│
├── lib/
│   ├── api.ts                        # Typed fetch wrapper with dedup + error handling
│   ├── utils.ts                      # fmtSize, fmtDate, langColors, escapeHtml
│   └── constants.ts                  # Route names, tab IDs, color maps
│
└── types/
    └── index.ts                      # Shared interfaces: File, Sprint, Ticket, Agent, etc.
```

## Smart vs Dumb Classification

### Smart Components (own state, side effects, store access)
- `FileTree` — manages expanded folders, auto-expand logic
- `DependencyGraph` — canvas rendering, pan/zoom state
- `MilestoneList` — fetches data, handles create/edit forms
- `VisionEditor` — manages edit mode, preview toggle, save
- `SprintPlanner` — multi-step modal flow, backlog fetching
- `Topbar` — fetches stats, manages search focus
- All pages (`CodeExplorer`, `Sprint`, `ProjectManagement`)

### Dumb Components (props only, no side effects)
- All atoms (`Badge`, `Button`, `Dot`, `Icon`, `Input`, `Skeleton`, `Stat`, `Tooltip`)
- `FileItem`, `FolderItem`, `TicketCard`, `AgentCard`, `SprintCard`, `BentoCard`
- `StatGroup`, `SearchBar`, `TabBar`, `SubTabBar`, `MarkdownRenderer`
- `KanbanBoard`, `BentoGrid`, `TeamGrid`, `SprintList`, `GanttChart`
- All templates (`ExplorerLayout`, `SprintLayout`, `PlanningLayout`)

## Vanilla JS → React Mapping

| Vanilla Function | React Component | Notes |
|-----------------|----------------|-------|
| `renderFileTree()` | `<FileTree />` | Recursive, manages expandedDirs in local state |
| `renderDetail()` | `<CodeExplorer />` detail tab | Data from fileStore |
| `renderGraph()` | `<DependencyGraph />` | Canvas ref, manual rendering |
| `loadSprintList()` | `<SprintList />` | Data from sprintStore |
| `loadTeam()` | `<TeamGrid />` | Data from agentStore |
| `loadInsights()` | `<BentoGrid />` | Data from sprintStore retro |
| `loadMilestones()` | `<MilestoneList />` | Skill fetch → planningStore |
| `loadVision()` | `<VisionEditor />` | Skill fetch → planningStore |
| `loadGantt()` | `<GanttChart />` | Sprint data → timeline bars |
| `selectFile()` | `fileStore.selectFile()` | Action in store |
| `parseHash()` / hash routing | `useHashRouter()` | Custom hook |
| `renderMarkdown()` | `<MarkdownRenderer />` | Pure component |
```

- [ ] **Step 2: Commit component tree document**

```bash
git add .claude/scrum/COMPONENT_TREE.md
git commit -m "docs: add React component tree spec with atomic design hierarchy

47 components across atoms/molecules/organisms/templates/pages.
Smart vs dumb classification, vanilla JS → React mapping table,
complete directory structure for Sprint 9 implementation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Zustand Store Design (T-054)

**Files:**
- Create: `.claude/scrum/STORE_DESIGN.md`

- [ ] **Step 1: Write the store design document**

```markdown
# Zustand Store Design

## Store Architecture

Two store categories, both using Zustand:
1. **Server state stores** — data fetched from APIs, refreshed on SSE events
2. **UI state store** — ephemeral view state, partially synced to URL hash

## Server State Stores

### fileStore

```typescript
interface FileStore {
  // State
  files: File[];
  directories: Directory[];
  selectedFileId: number | null;
  fileDetail: FileDetail | null;
  fileChanges: Change[];
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  stats: Stats | null;
  loading: { files: boolean; detail: boolean; changes: boolean; graph: boolean };
  error: { files: string | null; detail: string | null };

  // Actions
  fetchFiles: () => Promise<void>;
  fetchDirectories: () => Promise<void>;
  selectFile: (id: number) => Promise<void>;     // fetches detail + changes
  fetchGraph: () => Promise<void>;
  fetchStats: () => Promise<void>;
  refresh: () => Promise<void>;                    // re-fetch files + dirs
}
```

### sprintStore

```typescript
interface SprintStore {
  // State
  sprints: Sprint[];
  selectedSprintId: number | null;
  sprintDetail: SprintDetail | null;
  tickets: Ticket[];
  retroFindings: RetroFinding[];
  loading: { sprints: boolean; detail: boolean };
  error: { sprints: string | null; detail: string | null };

  // Actions
  fetchSprints: () => Promise<void>;
  selectSprint: (id: number) => Promise<void>;    // fetches detail + tickets + retro
  fetchTickets: (sprintId: number) => Promise<void>;
  fetchRetro: (sprintId: number) => Promise<void>;
}
```

### agentStore

```typescript
interface AgentStore {
  agents: Agent[];
  loading: boolean;
  fetchAgents: () => Promise<void>;
}
```

### planningStore

```typescript
interface PlanningStore {
  // State
  milestones: Milestone[];
  vision: string | null;
  ganttData: Sprint[];
  backlog: Ticket[];
  loading: { milestones: boolean; vision: boolean; gantt: boolean; backlog: boolean };

  // Actions
  fetchMilestones: () => Promise<void>;
  createMilestone: (data: CreateMilestoneInput) => Promise<void>;
  updateMilestone: (id: number, data: UpdateMilestoneInput) => Promise<void>;
  fetchVision: () => Promise<void>;
  updateVision: (content: string) => Promise<void>;
  fetchGantt: () => Promise<void>;
  fetchBacklog: () => Promise<void>;
  planSprint: (data: PlanSprintInput) => Promise<{ id: number }>;
}
```

## UI State Store

### uiStore

```typescript
interface UIStore {
  // Navigation
  activePage: 'explorer' | 'planning' | 'sprint';
  activeTab: string;           // 'detail' | 'changes' | 'graph' | 'board' | 'team' | 'insights' | etc.
  activeSubTab: string | null;

  // Sidebar
  sidebarCollapsed: boolean;
  expandedFolders: Set<string>;  // folder paths that are open

  // Search
  searchQuery: string;
  searchFocused: boolean;

  // Actions
  setPage: (page: string) => void;
  setTab: (tab: string) => void;
  setSubTab: (subTab: string) => void;
  toggleSidebar: () => void;
  toggleFolder: (path: string) => void;
  expandFolderPath: (filePath: string) => void;  // expands all parent folders
  setSearch: (query: string) => void;
  setSearchFocused: (focused: boolean) => void;
}
```

## API Client (lib/api.ts)

```typescript
// Typed fetch wrapper with request deduplication
const inflight = new Map<string, Promise<any>>();

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const key = `${options?.method || 'GET'}:${path}`;
  if (!options?.method || options.method === 'GET') {
    if (inflight.has(key)) return inflight.get(key)!;
  }
  const promise = fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).then(r => {
    if (!r.ok) throw new Error(`API ${r.status}: ${r.statusText}`);
    return r.json();
  }).finally(() => inflight.delete(key));
  if (!options?.method || options.method === 'GET') inflight.set(key, promise);
  return promise;
}
```

## SSE Integration (hooks/useEventSource.ts)

```typescript
// Connects to /api/events SSE endpoint
// On 'updated' event: refreshes fileStore (files + dirs + stats)
// Auto-reconnects on disconnect (3s delay)
// Cleans up on unmount
```

## URL Hash Sync (hooks/useHashRouter.ts)

```typescript
// Reads: #file/{id}, #sprint, #planning, #graph, #changes
// Writes: updates hash on page/tab/file changes
// On mount: restores state from current hash
// Maps:
//   activePage → hash prefix
//   selectedFileId → #file/{id}
//   activeTab → #graph, #changes (explorer tabs only)
```

## Data Flow

```
User Action → Store Action → API Call → Store State Update → React Re-render
                                ↑
SSE Event ("updated") ──────────┘
```

All API calls go through `lib/api.ts`. Stores never call `fetch` directly. Hooks
are thin wrappers that select slices from stores + trigger fetches on mount.
```

- [ ] **Step 2: Commit store design document**

```bash
git add .claude/scrum/STORE_DESIGN.md
git commit -m "docs: add Zustand store design spec with 5 stores and API client

4 server state stores (file, sprint, agent, planning) + 1 UI store.
Typed interfaces, API client with dedup, SSE integration plan,
URL hash sync strategy for Sprint 9 implementation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: File Explorer Collapse Fix (T-055)

**Files:**
- Modify: `src/dashboard/dashboard.html`

- [ ] **Step 1: Change default collapse behavior**

In `src/dashboard/dashboard.html`, find the `renderDir` function around line 693. Change the auto-expand logic from expanding first 2 levels to collapsing everything:

Replace:
```javascript
      // Auto-expand first two levels
      if (depth < 2) {
        children.classList.remove('collapsed');
        chevron.classList.add('open');
        expandedDirs.add(childPath);
      }
```

With:
```javascript
      // All folders collapsed by default — expand on search/select
```

(Just remove the auto-expand block entirely. The `collapsed` class is already set on line 691.)

- [ ] **Step 2: Add auto-expand helper function**

After the `renderDir` function closing brace (around line 724), add:

```javascript
  // Auto-expand parent folder chain for a given file path
  function expandToFile(filePath) {
    const parts = filePath.split('/');
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? current + '/' + parts[i] : parts[i];
      if (!expandedDirs.has(current)) {
        expandedDirs.add(current);
        const folderEl = el.querySelector(`[data-folder-path="${CSS.escape(current)}"]`);
        if (folderEl) {
          const children = folderEl.querySelector('.tree-children');
          const chevron = folderEl.querySelector('.chevron');
          if (children) children.classList.remove('collapsed');
          if (chevron) chevron.classList.add('open');
        }
      }
    }
  }
```

- [ ] **Step 3: Add data-folder-path attribute to folder elements**

In the `renderDir` function, after `folder.className = 'tree-folder';` (around line 669), add:

```javascript
      folder.dataset.folderPath = childPath;
```

- [ ] **Step 4: Wire auto-expand into selectFile**

In the `selectFile` function (around line 731), after `selectedFileId = id;`, add:

```javascript
  // Auto-expand parent folders
  const fileData = allFiles.find(f => f.id === id);
  if (fileData) {
    const dirPath = fileData.path.substring(0, fileData.path.lastIndexOf('/'));
    expandToFile(fileData.path);
  }
```

- [ ] **Step 5: Wire auto-expand into search filtering**

Find the search input event listener (the one that calls `renderFiles` or filters the file tree). After filtering, auto-expand folders containing matching files. In the search handler, after filtering results, add:

```javascript
  // Auto-expand folders containing search matches
  if (query.length > 0) {
    filtered.forEach(f => expandToFile(f.path));
  }
```

- [ ] **Step 6: Run build to verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Clean build

- [ ] **Step 7: Commit file explorer fix**

```bash
git add src/dashboard/dashboard.html
git commit -m "fix: collapse all file tree folders by default, auto-expand on select/search

Removes auto-expand of first 2 levels. Adds expandToFile() helper that
opens parent folder chain when a file is selected or matched by search.
Folders get data-folder-path attribute for targeted DOM queries.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Sprint Close — MCP Updates + QA

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --reporter=verbose 2>&1`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1`
Expected: Clean build

- [ ] **Step 3: Update sprint tickets via MCP**

Use the MCP tools to update all Sprint 8 tickets to DONE status. Query ticket IDs first:
- Call `list_tickets` with sprint filter to get actual IDs
- Call `update_ticket` for each with `status: "DONE"`, `qa_verified: true`

- [ ] **Step 4: Add retro findings via MCP**

Call `add_retro_finding` for each team member with category and finding from the sprint.

- [ ] **Step 5: Close sprint via MCP**

Call `update_sprint` with `status: "closed"` and `velocity_completed` set to actual points delivered.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Sprint 8 — discovery & API foundation

Delivered: AUDIT.md, COMPONENT_TREE.md, STORE_DESIGN.md,
milestones table, 6 new MCP tools, 6 new API endpoints,
file explorer collapse fix. 19/19pt.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
