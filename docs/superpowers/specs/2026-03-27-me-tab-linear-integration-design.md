# Me Tab — Linear Integration Design

## Overview

Add a new top-level "Me" tab to the dashboard navigation that serves as the user's personal Linear command center. It displays assigned issues, active cycles, projects, and recent activity — all fetched from the Linear MCP server via the dashboard backend.

The Me tab is **Linear-only**. Internal sprint tickets remain on the Dashboard with the existing "My Tickets" quick filter.

## Navigation Changes

- Add `'me'` to the `PageType` union type in `uiStore.ts`
- Add `me` as the **first** item in `navItems` array in `TopNav.tsx` (before Dashboard)
- Icon: user silhouette SVG (consistent with existing nav icon style)
- Update `defaultTabForPage`, `breadcrumbForPage`, and `getDefaultPageForRole` to handle `'me'`
- Add page routing in `App.tsx` for the `me` page
- Update `legacyUrlMap` if needed

## Page Layout — Stacked Sections

The Me page is a single scrollable page with four stacked sections. No sub-tabs.

### Section 1 — My Issues

- Issues grouped by status: **Todo**, **In Progress**, **Done**, **Cancelled**
- Each status group is collapsible (chevron toggle, framer-motion animation)
- Group header shows status name + issue count badge
- Within each group, issues sorted by priority ascending (Linear convention: 1=Urgent, 2=High, 3=Medium, 4=Low, 0=None — lower non-zero number = higher priority, 0 sorts last)
- Issue card displays:
  - Identifier (e.g., `ENG-123`) — top left
  - Priority icon — top right, color-coded (same scheme as existing P0-P3 but mapped to Linear's 0-4 scale)
  - Title — main content
  - Labels — small badges below title
  - Project name — bottom left, muted text
  - Updated timestamp — bottom right, relative time

### Section 2 — My Cycles

- Shows current and upcoming cycles where the user has assigned issues
- Compact card layout (CSS grid, 2-3 per row responsive)
- Each card shows:
  - Cycle name
  - Date range (startsAt — endsAt)
  - Progress bar (completedIssueCount / totalIssueCount)
  - Status badge

### Section 3 — My Projects

- Projects where the user has assigned issues
- Compact card layout (same grid as cycles)
- Each card shows:
  - Project name
  - Status badge
  - Progress percentage (visual bar)
  - Lead name
  - Target date

### Section 4 — Recent Activity

- Last ~20 issues sorted by `updatedAt` descending
- Timeline-style list (vertical line with dots)
- Each entry shows:
  - Relative timestamp
  - Issue identifier + title
  - Current status
- This approximates an activity feed using issue update timestamps (Linear MCP has no dedicated activity endpoint)

## Data Flow

### Backend — Dashboard Server (`dashboard.ts`)

New API endpoints:

| Endpoint | Method | Source MCP Tool | Description |
|----------|--------|-----------------|-------------|
| `/api/me/user` | GET | `mcp__linear__get_user` | Current user identity |
| `/api/me/issues` | GET | `mcp__linear__list_issues` | Issues assigned to current user |
| `/api/me/cycles` | GET | `mcp__linear__list_cycles` | Active/upcoming cycles |
| `/api/me/projects` | GET | `mcp__linear__list_projects` | Projects with user's issues |

### MCP Integration Layer — `src/dashboard/linear.ts`

New module that wraps Linear MCP tool calls:

- **User resolution**: On first call, invoke `mcp__linear__get_user` to get the current user's ID and profile. Cache in memory for subsequent requests.
- **Issue fetching**: Call `mcp__linear__list_issues` with `assignee` filter set to the resolved user ID.
- **Cycle fetching**: Call `mcp__linear__list_cycles` for active team cycles.
- **Project fetching**: Call `mcp__linear__list_projects` filtered to projects the user participates in.

The module communicates with the Linear MCP server using the MCP SDK client (`@modelcontextprotocol/sdk`), connecting to the Linear MCP server configured in `.mcp.json`.

**Important**: The Linear MCP server must be added to `.mcp.json` configuration. The exact connection details (command/args or SSE URL) depend on how the user has Linear MCP set up.

### Frontend Store — `src/dashboard/app/src/stores/meStore.ts`

New Zustand store:

```
State:
  user: LinearUser | null
  issues: LinearIssue[]
  cycles: LinearCycle[]
  projects: LinearProject[]
  loading: { user, issues, cycles, projects } — booleans
  error: { user, issues, cycles, projects } — string | null
  collapsedGroups: Set<string> — tracks which status groups are collapsed

Actions:
  fetchAll() — hits all /api/me/* endpoints in parallel
  toggleGroup(status: string) — collapse/expand a status group
```

- `fetchAll()` called on component mount
- Refreshes on SSE events (same `useEventSource` pattern as sprint store)

### Frontend Page — `src/dashboard/app/src/pages/Me.tsx`

- Calls `meStore.fetchAll()` on mount via `useEffect`
- Renders four sections using shared components
- Each section has a loading skeleton state and error state
- Empty states with helpful messages (e.g., "No issues assigned to you")

## Types — `src/dashboard/app/src/types/index.ts`

```typescript
interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface LinearIssue {
  id: string;
  identifier: string;      // e.g., "ENG-123"
  title: string;
  description: string | null;
  priority: number;         // 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
  priorityLabel: string;    // "Urgent", "High", etc.
  status: string;           // Status name: "Todo", "In Progress", "Done", etc.
  statusColor: string;      // Hex color for status
  labels: string[];         // Label names
  projectName: string | null;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
}

interface LinearCycle {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  completedIssueCount: number;
  totalIssueCount: number;
  status: string;           // "active", "upcoming", "completed"
}

interface LinearProject {
  id: string;
  name: string;
  status: string;
  progress: number;         // 0-100
  leadName: string | null;
  targetDate: string | null;
}
```

## New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Me.tsx` | `pages/` | Main page, orchestrates sections |
| `LinearIssueCard.tsx` | `molecules/` | Single issue card (identifier, title, priority, labels, project) |
| `LinearIssueGroup.tsx` | `organisms/` | Collapsible status group with header + issue list |
| `LinearCycleCard.tsx` | `molecules/` | Cycle card with progress bar |
| `LinearProjectCard.tsx` | `molecules/` | Project card with progress |
| `LinearActivityItem.tsx` | `molecules/` | Timeline entry for recent activity |
| `MeSection.tsx` | `molecules/` | Reusable section wrapper (title, count, loading/error/empty states) |

## Styling

- Dark-mode zinc/neutral palette consistent with existing app
- Section headers: `text-sm font-medium text-zinc-400 uppercase tracking-wide` style
- Issue cards: similar dimensions and spacing to `TicketCard`
- Collapsible groups: framer-motion `AnimatePresence` for smooth expand/collapse
- Progress bars: thin horizontal bars with accent color fill
- Timeline: vertical line with small dot markers, muted timestamp text

## Configuration

The Linear MCP server must be added to `.mcp.json`:

```json
{
  "mcpServers": {
    "code-context": { ... },
    "linear": {
      "command": "npx",
      "args": ["-y", "@anthropic/linear-mcp-server"]
    }
  }
}
```

The dashboard server reads this config to connect to the Linear MCP server. If the Linear server is not configured or unavailable, the Me tab shows a configuration prompt instead of data.

## Error Handling

- If Linear MCP is not configured: show a setup instructions card in the Me tab
- If Linear MCP is unreachable: show error banner with retry button per section
- If user has no assigned issues: show empty state with message
- Network errors on individual sections don't block other sections (parallel fetch, independent error states)

## Scope Exclusions

- No write operations to Linear (read-only)
- No linking between Linear issues and internal tickets
- No real-time webhooks from Linear (poll on mount + SSE refresh)
- No caching in SQLite (in-memory only, fresh on each page load)
