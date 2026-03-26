# Dashboard Feature Audit

## Page 1: Code Explorer (id: page-explorer)

### Layout
- Left sidebar (300px): file tree with search
- Main panel: 3 tabs (Detail, Changes, Graph)
- Topbar: logo, search, stat counters (files/lines/size/lang), live dot

### Components
- **Search bar**: `.search` input, filters file tree on keyup (debounced)
- **File tree**: hierarchical folders + files, currently auto-expands first 2 levels
- **Detail tab**: file path, language, size, line count, exports table, imports list, imported-by list
- **Changes tab**: time-grouped feed of file modifications with expandable diffs
- **Graph tab**: canvas-based force-directed dependency visualization with pan/zoom

### Interactions
- Click file → loads detail + changes + graph via `selectFile(id)`
- Click folder → toggle expand/collapse via `expandedDirs` Set
- Cmd+K → focus search (`handleKeyboard`)
- Arrow keys → navigate file list
- Esc → dismiss search
- Hash routing: `#file/{id}`, `#graph`, `#changes`

### State
- `selectedFileId` — JS var, synced to URL hash
- `allFiles`, `allDirs` — fetched once on `init()`
- `expandedDirs` — Set, ephemeral (not persisted)
- `graphData` — fetched once on `init()`

### API Dependencies
| Endpoint | Response | Used By |
|----------|----------|---------|
| GET /api/files | File[] | Sidebar file tree |
| GET /api/directories | Dir[] | Sidebar folder tree |
| GET /api/file/{id} | FileDetail (exports, imports, imported_by) | Detail tab |
| GET /api/file/{id}/changes | Change[] | Changes tab |
| GET /api/graph | {nodes, edges} | Graph tab (canvas) |
| GET /api/stats | {files, exports, deps, lines, size, languages} | Topbar counters |

---

## Page 2: Sprint (id: page-sprint)

### Sub-tab: Board (stab-board)
- Left panel: sprint list cards (name, status badge, ticket counts, velocity progress bar)
- Right panel: sprint detail with overview stats + kanban board (TODO/IN_PROGRESS/DONE/BLOCKED columns)
- Ticket cards show: ref, title, assignee, priority badge, story points
- Retro findings section grouped by category (went_well/went_wrong/try_next)

### Sub-tab: Team (stab-team)
- Grid of agent cards (`agent-grid`, auto-fill minmax 280px)
- Each card: role name, description, model, health dot (active/idle/blocked), mood emoji + score + progress bar
- Mood computed server-side (base 50, +5 done tickets, -20 blocked, etc.)

### Sub-tab: Retro Insights (stab-insights)
- Bento grid with 6 cards: Recurring Topics (wide), Stats, Recurring Good, Recurring Bad, Best Moment, Worst Moment
- Stats card shows live counts fetched from all sprint retro endpoints
- Content is synthesized analysis from all retro findings

### Interactions
- Click sprint card → `loadSprintDetail(id)` fetches overview + tickets + retro
- Sub-tab switching via `.sprint-sub-tab` click handlers scoped to parent `.sprint-page-content`

### State
- Sprint list fetched on page switch (`loadSprintList()`)
- Selected sprint detail fetched on card click
- Team data fetched on page switch (`loadTeam()`)
- Insights fetched on page switch (`loadInsights()`)

### API Dependencies
| Endpoint | Response | Used By |
|----------|----------|---------|
| GET /api/sprints | Sprint[] (with ticket_count, done_count, retro_count) | Sprint list sidebar |
| GET /api/sprint/{id} | SprintDetail | Sprint overview panel |
| GET /api/sprint/{id}/tickets | Ticket[] | Kanban board |
| GET /api/sprint/{id}/retro | RetroFinding[] | Retro tab, Insights bento |
| GET /api/agents | Agent[] (with mood, health) | Team grid |

---

## Page 3: Project Management (id: page-planning)

### Sub-tab: Milestones (ptab-milestones)
- Rendered from `/api/skill/MILESTONES` skill content
- Markdown rendered to HTML via `renderMarkdown()` helper
- Currently **read-only** display

### Sub-tab: Product Vision (ptab-vision)
- Rendered from `/api/skill/PRODUCT_VISION` skill content
- Markdown rendered to HTML
- Currently **read-only** display

### Sub-tab: Gantt Chart (ptab-gantt)
- Timeline bar visualization of sprints
- Shows sprint name, date range, status color coding
- Responsive: switches to vertical on mobile

### Interactions
- Sub-tab switching only — **no editing, no creation, no linking**

### State
- All 3 sub-tabs fetched on page switch (`loadMilestones()`, `loadVision()`, `loadGantt()`)
- Data fetched fresh each time (no caching)

### API Dependencies
| Endpoint | Response | Used By |
|----------|----------|---------|
| GET /api/skill/MILESTONES | {content: string} | Milestones markdown |
| GET /api/skill/PRODUCT_VISION | {content: string} | Vision markdown |
| GET /api/sprints | Sprint[] | Gantt timeline bars |

---

## Full API Inventory

### Code Context APIs (read-only)
| Endpoint | Method | Handler | Used By |
|----------|--------|---------|---------|
| /api/files | GET | `apiFiles()` | Code Explorer sidebar |
| /api/directories | GET | `apiDirectories()` | Code Explorer file tree |
| /api/file/{id} | GET | `apiFile(id)` | Code Explorer detail |
| /api/file/{id}/changes | GET | `apiFileChanges(id, limit)` | Code Explorer changes |
| /api/graph | GET | `apiGraph()` | Code Explorer graph |
| /api/stats | GET | `apiStats()` | Topbar counters |
| /api/changes | GET | `apiChanges(limit)` | (unused in UI) |

### Skills & Agents APIs (read-only)
| Endpoint | Method | Handler | Used By |
|----------|--------|---------|---------|
| /api/skills | GET | `apiSkills()` | (unused in UI) |
| /api/skill/{name} | GET | `apiSkill(name)` | Project Management tabs |
| /api/agents | GET | `apiAgents()` | Sprint team tab |

### Scrum APIs (read-only)
| Endpoint | Method | Handler | Used By |
|----------|--------|---------|---------|
| /api/sprints | GET | `apiSprints()` | Sprint board, Gantt |
| /api/sprint/{id} | GET | `apiSprintDetail(id)` | Sprint detail panel |
| /api/sprint/{id}/tickets | GET | `apiSprintTickets(id)` | Sprint kanban |
| /api/sprint/{id}/retro | GET | `apiSprintRetro(id)` | Sprint retro, Insights |

### New Write APIs (Sprint 8)
| Endpoint | Method | Handler | Purpose |
|----------|--------|---------|---------|
| /api/milestones | GET | `apiMilestones()` | List milestones with ticket counts |
| /api/milestones | POST | `apiCreateMilestone(body)` | Create milestone |
| /api/milestone/{id} | PUT | `apiMilestoneUpdate(id, body)` | Update milestone |
| /api/vision | PUT | `apiVisionUpdate(body)` | Update product vision |
| /api/backlog | GET | `apiBacklog()` | Unassigned tickets |
| /api/sprints/plan | POST | `apiPlanSprint(body)` | Create sprint with tickets |

### Real-time
| Endpoint | Type | Events |
|----------|------|--------|
| /api/events | SSE (EventSource) | `"updated"` on file change (chokidar watcher) |

---

## Gap Analysis — Missing for Sprint 9 Workflows

| Workflow | Current State | What's Needed |
|----------|--------------|---------------|
| Create milestone | No UI — API exists (Sprint 8) | Form in Milestones tab |
| Edit milestone | No UI — API exists (Sprint 8) | Inline edit or modal |
| Link ticket to milestone | No UI — API exists (Sprint 8) | Dropdown on ticket card or milestone detail |
| Edit product vision | Read-only markdown display | Markdown editor with preview + save button |
| Plan a sprint | MCP tools only | Modal flow: name → select backlog tickets → confirm |
| View backlog | Not visible in dashboard | Backlog list in sprint planning flow |
| File explorer default | Auto-expands first 2 levels | All collapsed, auto-expand on select/search |

### UI Patterns Missing
- No forms or input fields anywhere in the dashboard (all read-only)
- No modal/dialog system
- No toast/notification system for save confirmations
- No optimistic updates (all data flows are fetch → render)
- No error boundaries or retry mechanisms for failed fetches
