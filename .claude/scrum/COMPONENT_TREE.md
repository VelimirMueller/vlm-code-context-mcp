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
│   │   ├── AnimatedNumber.tsx        # Framer Motion number counter (S10)
│   │   ├── Badge.tsx                 # Status/priority badge (color variants)
│   │   ├── Button.tsx                # Action button (primary/ghost/danger)
│   │   ├── Dot.tsx                   # Status dot (language color, health)
│   │   ├── Icon.tsx                  # SVG icon wrapper
│   │   ├── Input.tsx                 # Text input with optional icon
│   │   ├── Skeleton.tsx              # Shimmer loading placeholder
│   │   ├── Stat.tsx                  # Single stat (number + label)
│   │   ├── Toast.tsx                 # Notification toast with animation (S10)
│   │   └── Tooltip.tsx               # Hover tooltip
│   │
│   ├── molecules/
│   │   ├── FileItem.tsx              # File row in tree (dot + name + size)
│   │   ├── FolderItem.tsx            # Folder row with chevron + count
│   │   ├── HeroText.tsx              # Animated hero heading with motion (S10)
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
│   │   ├── LandingAnimation.tsx      # Framer Motion landing intro sequence (S10)
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

**Total: 51 components** — 10 atoms, 12 molecules, 13 organisms, 3 templates, 3 pages, 8 hooks, 5 stores, 3 lib files, 1 types file (S10: +AnimatedNumber, +Toast, +HeroText, +LandingAnimation)

---

## Smart vs Dumb Classification

### Smart Components (own state, side effects, store access)
| Component | Why Smart |
|-----------|----------|
| `FileTree` | Manages expandedDirs in local state, auto-expand logic |
| `DependencyGraph` | Canvas rendering, pan/zoom state, requestAnimationFrame |
| `MilestoneList` | Fetches data, handles create/edit forms, POST/PUT calls |
| `VisionEditor` | Manages edit mode toggle, preview, save via PUT |
| `SprintPlanner` | Multi-step modal flow, backlog fetching, sprint creation |
| `Topbar` | Fetches stats on mount, manages search focus state |
| `CodeExplorer` | Page-level data orchestration, tab management |
| `Sprint` | Page-level data orchestration, sub-tab management |
| `ProjectManagement` | Page-level data orchestration, sub-tab management |

### Dumb Components (props only, no side effects)
All atoms, most molecules, layout templates, and display organisms:
- **Atoms**: AnimatedNumber, Badge, Button, Dot, Icon, Input, Skeleton, Stat, Toast, Tooltip
- **Molecules**: FileItem, FolderItem, HeroText, TicketCard, AgentCard, SprintCard, BentoCard, StatGroup, SearchBar, TabBar, SubTabBar, MarkdownRenderer
- **Organisms**: KanbanBoard, BentoGrid, TeamGrid, SprintList, SprintDetail, GanttChart
- **Templates**: ExplorerLayout, SprintLayout, PlanningLayout

---

## Vanilla JS → React Mapping

| Vanilla JS Function | React Component | Notes |
|--------------------|----------------|-------|
| `renderFileTree(files, dirs)` | `<FileTree />` | Recursive, manages expandedDirs in local state |
| `createFileItem(f)` | `<FileItem />` | Pure dumb component |
| `renderDir(dirPath, container, depth)` | `<FolderItem />` + recursion | Chevron, expand/collapse |
| `renderDetail(data)` | `<CodeExplorer />` detail tab | Data from fileStore |
| `renderGraph()` | `<DependencyGraph />` | Canvas ref, manual rendering |
| `loadSprintList()` | `<SprintList />` | Data from sprintStore |
| `loadSprintDetail(id)` | `<SprintDetail />` | Kanban + overview |
| `showBoardView()` | `<KanbanBoard />` | 4-column layout |
| `loadTeam()` | `<TeamGrid />` | Data from agentStore |
| `loadInsights()` | `<BentoGrid />` | Data from sprintStore retro |
| `makeBentoCard(opts)` | `<BentoCard />` | Pure props |
| `loadMilestones()` | `<MilestoneList />` | Skill fetch → planningStore |
| `loadVision()` | `<VisionEditor />` | Skill fetch → planningStore |
| `loadGantt()` | `<GanttChart />` | Sprint data → timeline bars |
| `selectFile(id)` | `fileStore.selectFile()` | Zustand action |
| `parseHash()` / hash routing | `useHashRouter()` | Custom hook |
| `handleKeyboard(e)` | `useKeyboard()` | Custom hook |
| `renderMarkdown(md)` | `<MarkdownRenderer />` | Pure component |
| `fmtSize(bytes)` | `lib/utils.ts` | Utility function |
| `esc(str)` | `lib/utils.ts` | Utility function |
| search filtering logic | `useSearch()` | Debounced hook |
| `EventSource('/api/events')` | `useEventSource()` | SSE hook |

### Logic Extraction Plan
| Current Location | Target | Type |
|-----------------|--------|------|
| Inline stat counting in topbar | `fileStore.fetchStats()` | Store action |
| `langColors` object | `lib/constants.ts` | Constant map |
| `fmtSize()`, `esc()`, `fmtDate()` | `lib/utils.ts` | Utility functions |
| Sprint kanban column logic | `lib/utils.ts` → `groupByStatus()` | Utility function |
| Markdown regex rendering | `<MarkdownRenderer />` | Component |
| Agent mood color logic | `lib/utils.ts` → `getMoodColor()` | Utility function |
| Graph force simulation | `<DependencyGraph />` | Internal to component |
