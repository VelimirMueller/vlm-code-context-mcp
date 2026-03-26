# Dashboard Design Specification

## Current State Assessment

The dashboard is a single 774-line HTML file (`src/dashboard/dashboard.html`) served by a 222-line Node HTTP server (`src/dashboard/dashboard.ts`). All CSS (~148 lines), HTML structure, and JavaScript logic live in one file. The server exposes 7 API endpoints and an SSE channel for live updates.

### What exists today
- **Layout**: CSS Grid shell with topbar, sidebar (file tree), main panel (tabs), statusbar
- **Views**: File detail (exports, imports, dependents, changes), dependency graph (canvas), changes feed
- **Interactivity**: Search filter, tree expand/collapse, file selection, tab switching, SSE live reload
- **Styling**: Dark theme with CSS custom properties, Geist font family, monospace for code/data
- **Graph**: Raw canvas 2D rendering with force-directed layout (all in inline JS)

### What a senior engineer sees immediately
1. **No separation of concerns** -- 774 lines of inline CSS + HTML + JS = unmaintainable
2. **No build step** -- raw HTML, no minification, no tree-shaking, no sourcemaps
3. **No component model** -- DOM manipulation via `document.getElementById` and string concatenation
4. **No state management** -- scattered `let` variables, no reactive data flow
5. **No error boundaries** -- API failures silently swallowed or produce broken UI
6. **No loading states** -- data appears or does not; no skeleton screens, no spinners
7. **No accessibility** -- no ARIA roles, no keyboard navigation, no screen reader support
8. **No responsive design** -- fixed grid assumes desktop viewport
9. **Graph rendering is naive** -- O(n^2) force sim on every frame, no WebGL, no level-of-detail
10. **No URL routing** -- refreshing the page loses all state (selected file, active tab)

---

## Target Architecture

### Principle: Zero-dependency dashboard that ships as a single file

The dashboard must remain a **single HTML file** that the server reads and serves. No npm build step for the frontend. No React, no Vue, no framework. The reason: this tool is installed via `npx` and the dashboard is a debugging/exploration UI, not a web app. It must Just Work.

However, "single file" does not mean "unstructured." The target is a well-organized single HTML file using modern vanilla patterns.

### Design Principles for Developer Tools

1. **Information density over whitespace** -- Senior devs want data, not marketing layouts. Every pixel should earn its place.
2. **Keyboard-first** -- `Cmd+K` search, arrow key navigation, `Esc` to dismiss, tab to move focus.
3. **Progressive disclosure** -- Overview first, details on demand. Never hide information behind unnecessary clicks.
4. **Sub-100ms interactions** -- Filtering, searching, and tab switching must feel instant. Debounce only network calls.
5. **Readable at a glance** -- Monospace for data, proportional for labels. Color for semantics (green=added, red=removed, blue=function, purple=type), never for decoration.
6. **Offline-capable** -- Once loaded, the dashboard works without network (except SSE updates). No CDN fonts in production.
7. **URL-driven state** -- Hash routing (`#file/42`, `#graph`, `#changes`) so refreshing and sharing links works.

---

## Component Architecture (within single HTML file)

Organize the inline JavaScript as ES module-style IIFE sections with clear boundaries:

```
// ====== STATE ======
// Central state object, event bus for reactivity

// ====== ROUTER ======
// Hash-based routing, state serialization/deserialization

// ====== COMPONENTS ======
//   Topbar (search, stats, connection indicator)
//   Sidebar (file tree with virtual scrolling)
//   FileDetail (metadata, exports, deps, changes)
//   GraphView (dependency visualization)
//   ChangesView (change feed with filtering)
//   Statusbar (connection status, last indexed timestamp)

// ====== API LAYER ======
// Fetch wrapper with caching, error handling, retry

// ====== INIT ======
// Bootstrap, SSE connection, initial data load
```

### Component Breakdown

#### 1. State Manager
- Single `state` object: `{ files, selectedFileId, activeTab, searchQuery, graphData, changes, stats, connectionStatus }`
- Simple pub/sub: `state.on('change', key, callback)` pattern
- Serialize active state to URL hash on every meaningful change

#### 2. API Layer
- `api.files()`, `api.file(id)`, `api.graph()`, `api.stats()`, `api.changes(limit)`, `api.directories()`
- In-memory LRU cache (Map with max 200 entries) for file detail responses
- Cache invalidation on SSE `updated` event
- Fetch timeout (5s) with retry (1x) and error propagation to UI
- Request deduplication (do not fire the same request twice concurrently)

#### 3. Sidebar / File Tree
- **Virtual scrolling** for repos with 10K+ files -- only render visible rows plus 20-row buffer
- Tree nodes: folder (expandable) and file (selectable)
- Search filtering: highlight matched characters, hide non-matching branches
- Sort options: name (default), size, modification date, dependency count
- Lazy load directory contents (expand = fetch children from already-loaded flat list)
- Show language-colored dot, file name, and size for each file

#### 4. File Detail Panel
- **Header card**: path, language badge, size, line count, created/modified dates
- **Description**: editable inline (PATCH to future API endpoint)
- **Exports table**: name, kind (color-coded badge), description. Sortable by name/kind.
- **Imports section**: clickable file links (navigate to that file in sidebar)
- **Imported By section**: same as imports, reverse direction
- **External packages**: listed as badges with links to npmjs.com
- **Changes timeline**: vertical timeline with expand/collapse for diffs
- **Loading skeleton**: gray pulsing blocks matching the layout shape

#### 5. Graph View
- Replace raw canvas with layered approach:
  - **Tier 1 (current sprint)**: Fix the force layout to use Barnes-Hut approximation, cap at 500 visible nodes, cluster by directory
  - **Tier 2 (future)**: WebGL via a lightweight lib or OffscreenCanvas for >1K nodes
- Pan/zoom with mouse and touchpad
- Click node = select file in sidebar
- Hover = show tooltip with file summary
- Color nodes by language, size edges by symbol count
- Filter: show only files connected to selected file (ego graph)

#### 6. Changes View
- Reverse-chronological feed grouped by time window (today, yesterday, this week, older)
- Filter by event type (add, change, delete) via toggle buttons
- Filter by file path (reuse search)
- Each change card: file path (clickable), event badge, timestamp, line/size delta, summary diff
- Expandable diff block with syntax-highlighted additions/deletions
- Reason display (if set via MCP tool)

#### 7. Statusbar
- Left: connection status dot (green=connected, yellow=reconnecting, red=disconnected)
- Left: "Watching: /path/to/project"
- Center: "Last indexed: 2 min ago" (relative time, auto-updating)
- Right: file count, export count, dependency count (mirrors topbar stats in compact form)

---

## Information Architecture: What Senior Devs Want

### At a Glance (no clicks required)
- How many files, exports, dependencies are indexed
- Is the watcher connected and running
- When was the last re-index
- File tree structure of the entire project

### One Click
- Full metadata for any file (the Detail panel)
- Dependency graph for the whole project
- Recent changes across the codebase

### Two Clicks
- Diff details for a specific change
- Navigate from a dependency to the depended-upon file
- Filter changes to a specific file

### Search (Cmd+K)
- Find any file by name or summary content
- Find any exported symbol by name
- Results ranked: exact match > prefix > contains

---

## Performance Requirements

### Targets for 10K+ file repos
| Metric | Target | Current |
|--------|--------|---------|
| Initial load (API + render) | < 800ms | Unknown (no measurement) |
| File tree render (10K files) | < 200ms | Likely > 2s (no virtual scroll) |
| Search filtering (10K files) | < 50ms | Likely 100-300ms (DOM thrashing) |
| File detail load | < 100ms | Likely OK (single row query) |
| Graph render (500 nodes) | < 500ms initial, 60fps after | Likely < 30fps |
| SSE reconnect | < 2s | Untested |
| Memory (10K files loaded) | < 50MB | Unknown |

### Implementation strategies
1. **Virtual scrolling** for file tree: render only ~40 visible items at a time
2. **Debounced search** (150ms) with pre-computed lowercase paths for fast filtering
3. **Lazy graph initialization**: do not compute force layout until Graph tab is active
4. **Incremental DOM updates**: on SSE update, diff the new file list against current state, only re-render changed items
5. **Web Worker** for graph force calculation (future sprint, not M1)
6. **RequestAnimationFrame** for all DOM batch updates

---

## Visual Design Tokens (already established)

The current CSS custom properties are well-chosen. Keep them. Key tokens:

```
--bg: #0c0c10          (page background)
--surface: #131318     (card/panel background)
--surface2: #18181f    (hover/secondary)
--accent: #10b981      (primary action, green)
--mono: 'Geist Mono'   (data, code, numbers)
--font: 'Geist Sans'   (labels, prose)
--radius: 14px         (card corners)
```

### Font strategy for production
- Bundle a subset of Geist Sans (400, 500, 600, 700) and Geist Mono (400, 500, 700) as base64 in the HTML file
- Fallback stack: `-apple-system, system-ui, sans-serif` for sans, `monospace` for mono
- Remove CDN dependency for offline operation

---

## Migration Path (Milestone 1 scope)

Sprint 1 does NOT rewrite the dashboard. It focuses on:

1. **Extract inline JS into organized sections** with clear comment boundaries
2. **Add hash routing** so file selection and active tab survive page refresh
3. **Add loading and error states** for all API calls
4. **Add keyboard shortcuts** (Cmd+K for search, Esc to clear, arrows for tree navigation)
5. **Add virtual scrolling** for the file tree sidebar (the single biggest perf win)
6. **Add basic ARIA attributes** (role, aria-label, aria-expanded on tree nodes)
7. **Self-host fonts** as base64 (remove CDN dependency)

These are surgical improvements to the existing file, not a rewrite. A rewrite comes in Milestone 2.
