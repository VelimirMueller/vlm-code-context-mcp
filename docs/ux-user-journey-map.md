# Dashboard UX Analysis & User Journey Maps

**Created:** 2026-03-27
**Sprint:** 14 (UX Overhaul)
**Author:** UX Designer Agent

---

## Executive Summary

This document analyzes the current dashboard UX, identifies pain points, and proposes user journey improvements for the Code Context MCP dashboard. The current implementation shows solid foundations but lacks critical status indicators and has navigation friction in key workflows.

---

## Current State Analysis

### Page Structure
```
┌─────────────────────────────────────────────────────────┐
│  Header: [Logo] Code Context MCP                         │
├─────────────────────────────────────────────────────────┤
│  Nav: [Code Explorer] [Project Management] [Sprint]     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Main Content Area (3 pages)                              │
│  - Code Explorer: File tree, dependencies, graph         │
│  - Project Management: Milestones, Vision, Gantt, Insights│
│  - Sprint: Board, Team, Retro Insights                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Key Components Identified

| Component | File | Purpose |
|-----------|------|---------|
| KanbanBoard | `KanbanBoard.tsx` | 4-column ticket board (TODO/IN_PROGRESS/DONE/BLOCKED) |
| SprintDetail | `SprintDetail.tsx` | Sprint header, metrics, burndown, kanban, retro |
| TicketCard | `TicketCard.tsx` | Individual ticket card with priority & assignee |
| TicketDetailModal | `TicketDetailModal.tsx` | Modal for ticket details & milestone linking |
| SprintList | `SprintList.tsx` | Left sidebar with sprint cards |
| SprintCard | `SprintCard.tsx` | Compact sprint card with progress |
| GanttChart | `GanttChart.tsx` | Timeline visualization of sprints |

---

## Critical UX Issues

### 1. Missing Sprint Status Indicators
**Location:** `SprintCard.tsx` (lines 17-96)

**Problem:** Sprint cards show basic metrics but DO NOT indicate:
- Whether retro has been completed
- Whether QA has been verified
- Whether velocity target was achieved

**Current display:**
- Status (active/closed/planned)
- Done/total ticket count
- Velocity completed/committed

**Missing indicators:**
```typescript
// These fields exist in the API but not shown in UI:
sprint.retro_count  // Number of retro findings (not clearly shown)
sprint.qa_count     // Number of QA-verified tickets (not shown)
// No visual indicator for retro completion
// No visual indicator for QA completion
// No indicator for velocity achievement (% of target)
```

### 2. Gantt Chart Visual Clarity
**Location:** `GanttChart.tsx` (lines 1-272)

**Problems:**
- Nested layout with velocity fill inside time bar is confusing
- Color scheme uses semi-transparent overlays that are hard to distinguish
- No clear axis labels for dates (only "velocity pt" labels)
- Status indicators are subtle and hard to scan
- Missing: milestone connections, dependency visualization

**Current visualization:**
- Time bar with position + width
- Velocity fill overlay (opacity 0.45)
- Status badges with low-contrast colors

### 3. Navigation Depth Issues
**Location:** `App.tsx`, `Sprint.tsx`, `ProjectManagement.tsx`

**Problem:** Tab-within-tab navigation creates hidden content
- Sprint page has 3 tabs: Board, Team, Insights
- Project Management has 4 tabs: Milestones, Vision, Gantt, Insights
- Users can't see what's in other tabs without clicking
- No breadcrumbs or location indicators

**Current click depth:**
- Landing → Click "Sprint" → See Board tab → Click "Team" tab
- Landing → Click "Project Management" → See Milestones tab → Click "Gantt" tab

---

## User Journey Maps

### Journey 1: New User Onboarding

```
┌────────────────────────────────────────────────────────────────────┐
│ USER: New team member joining project                              │
│ GOAL: Understand project status and current work                  │
└────────────────────────────────────────────────────────────────────┘

Step 1: Landing Experience
  ├─ Action: User opens dashboard URL
  ├─ Current: LandingAnimation plays (one-time)
  ├─ Pain Point: Animation delays getting to work
  └─ Improvement Idea: Skip button for returning users

Step 2: First Impression
  ├─ Action: Sees default page (likely "Code Explorer")
  ├─ Current: Shows file tree and dependencies
  ├─ Pain Point: No context about what the project IS
  └─ Improvement: Show "Sprint" tab by default for team context

Step 3: Finding Current Sprint
  ├─ Action: Navigates to "Sprint" page
  ├─ Current: Shows "Board" tab with sprint list (left) + detail (right)
  ├─ Pain Point: Must scan list to find "active" sprint
  └─ Improvement: Auto-select active sprint on load

Step 4: Understanding Sprint Status
  ├─ Action: Reads sprint card
  ├─ Current: Shows "4/7 tickets, 12/19 pts"
  ├─ Pain Point: Doesn't know if retro done, QA verified
  └─ Improvement: Add status badges [✓ Retro] [✓ QA] [⚠ Velocity]

Step 5: Finding Assigned Work
  ├─ Action: Scans Kanban board for their tickets
  ├─ Current: Must read all cards to find their name
  ├─ Pain Point: No filter by assignee
  └─ Improvement: "Show mine" filter button

──────────────────────────────────────────────────────────────────────
METRICS: 7 clicks to find assigned work
TARGET:   2-3 clicks
```

### Journey 2: Daily Scrum Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│ USER: Developer preparing for daily standup                       │
│ GOAL: Report status on assigned tickets                           │
└────────────────────────────────────────────────────────────────────┘

Step 1: Open Dashboard
  ├─ Current: Lands on last-viewed page
  ├─ Ideal: Go directly to "Sprint → Board"

Step 2: View My Tickets
  ├─ Current: Scan all 4 Kanban columns manually
  ├─ Pain Point: No "My Tickets" view
  └─ Improvement: Filter chip [My Tickets]

Step 3: Update Ticket Status
  ├─ Current: Click ticket → Modal opens → See details
  ├─ Pain Point: Can't update status from modal (read-only view)
  └─ Improvement: Add status dropdown in modal

Step 4: Check Blockers
  ├─ Current: Navigate to "Board" tab, scan BLOCKED column
  ├─ Pain Point: Blockers mixed with other tickets
  └─ Improvement: Dedicated "Blockers" panel or alert

Step 5: Check Velocity
  ├─ Current: Read numbers "12/19 pts" in header
  ├─ Pain Point: No context on if this is "on track"
  └─ Improvement: Color-coded velocity (green=on-track, red=behind)

──────────────────────────────────────────────────────────────────────
METRICS: 4-5 actions to prepare status report
TARGET:   2 actions (filter → scan)
```

### Journey 3: Sprint Planning Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│ USER: Tech Lead planning upcoming sprint                          │
│ GOAL: Select tickets from backlog, assign, set velocity           │
└────────────────────────────────────────────────────────────────────┘

Step 1: Open Project Management
  ├─ Action: Click "Project Management" nav
  ├─ Current: Shows "Milestones" tab
  ├─ Pain Point: Need to click "+ Plan Sprint" button (top-right)
  └─ OK: Button placement is visible

Step 2: Review Backlog
  ├─ Current: No backlog view visible
  ├─ Pain Point: Must open Sprint Planner modal first
  └─ Improvement: Show backlog preview in Milestones tab

Step 3: Create Sprint
  ├─ Action: Click "+ Plan Sprint" → Modal opens
  ├─ Current: SprintPlanner modal (not analyzed in detail)
  ├─ Pain Point: Context switch to modal
  └─ Note: May need separate journey for modal UX

Step 4: Assign Tickets
  ├─ Current: Done within modal
  ├─ Pain Point: Can't see team capacity while assigning
  └─ Improvement: Show team workload in modal sidebar

Step 5: Set Velocity Target
  ├─ Current: Done within modal
  ├─ Pain Point: No historical velocity reference
  └─ Improvement: Show velocity trend from last 3 sprints

──────────────────────────────────────────────────────────────────────
METRICS: 2 clicks to start planning
TARGET:   1 click (ideally backlog visible on dashboard)
```

### Journey 4: Retro/QA Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│ USER: Team completing sprint closure                              │
│ GOAL: Run retro, verify QA, mark sprint complete                  │
└────────────────────────────────────────────────────────────────────┘

Step 1: Navigate to Sprint
  ├─ Action: Click "Sprint" nav → Select completed sprint
  ├─ Current: Sprint list shows active sprints first
  ├─ Pain Point: Completed sprints sorted last
  └─ Improvement: Jump to current sprint, then previous

Step 2: Check QA Status
  ├─ Current: No dashboard-level QA summary
  ├─ Pain Point: Must scan each ticket to see QA status
  └─ Improvement: QA summary widget in SprintDetail
    - Shows: X/Y tickets verified, Z remaining
    - Color: Red if < 80%, Green if ≥ 95%

Step 3: Access Retro
  ├─ Current: Retro findings shown at bottom of SprintDetail
  ├─ Pain Point: Collapsed by default, easy to miss
  └─ Improvement: Prominent "Retro" tab or indicator

Step 4: Verify Velocity
  ├─ Current: Shows "12/19 pts" with progress bar
  ├─ Pain Point: No comparison to committed velocity
  └─ Improvement: Badge showing [63% of target]

Step 5: Close Sprint
  ├─ Current: No visible "Close Sprint" action
  ├─ Pain Point: How do users actually close sprints?
  └─ Improvement: Add "Complete Sprint" button when all criteria met:
    - All tickets DONE or NOT_DOCUMENTED
    - QA verified > 90%
    - Retro findings recorded

──────────────────────────────────────────────────────────────────────
METRICS: Multiple tabs and scrolling needed
TARGET:   Single "Sprint Completion" panel with checklist
```

### Journey 5: Project Planning (Gantt/Milestones)

```
┌────────────────────────────────────────────────────────────────────┐
│ USER: Product Owner planning roadmap                              │
│ GOAL: View timeline, check milestone progress, adjust dates        │
└────────────────────────────────────────────────────────────────────┘

Step 1: Open Project Management
  ├─ Action: Click "Project Management" nav
  ├─ Current: Shows "Milestones" tab by default
  └─ OK: Good default for PO workflow

Step 2: Review Milestones
  ├─ Current: MilestoneList component (not analyzed)
  ├─ Expected: List of milestones with progress
  └─ Note: Need to review MilestoneList for UX issues

Step 3: View Timeline
  ├─ Action: Click "Gantt" tab
  ├─ Current: Shows sprint timeline with velocity overlay
  ├─ Pain Points:
    │  • No date axis (only "velocity pt" labels)
    │  • Can't see milestone boundaries
    │  • Overlapping bars hard to distinguish
    │  • No hover tooltips for exact dates
  └─ Improvements:
    - Add date axis (top or bottom of chart)
    - Use distinct colors for milestones vs sprints
    - Add hover state showing exact date range
    - Connect related tickets to milestones with lines

Step 4: Check Product Vision
  ├─ Action: Click "Vision" tab
  ├─ Current: VisionEditor component (not analyzed)
  └─ Note: Need to review for UX issues

──────────────────────────────────────────────────────────────────────
METRICS: Tab switching needed to see different views
TARGET:   Unified dashboard with all views visible
```

---

## Proposed Design System Guidelines

### Status Indicators

```css
/* Sprint Status Badges */
.badge-retro-done {
  background: var(--accent);
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
}

.badge-qa-pending {
  background: var(--orange);
  color: white;
}

.badge-qa-verified {
  background: var(--accent);
  color: white;
}

.badge-velocity-low {   /* < 70% of target */
  background: var(--red);
  color: white;
}

.badge-velocity-good {  /* 70-100% of target */
  background: var(--accent);
  color: white;
}

.badge-velocity-exceeded { /* > 100% of target */
  background: var(--purple);
  color: white;
}
```

### SprintCard Enhancement

```typescript
// Proposed additions to SprintCard.tsx

// Add to card header (after status badge):
<div style={{ display: 'flex', gap: 4 }}>
  {sprint.retro_count > 0 && (
    <StatusBadge icon="✓" label="Retro" color="var(--accent)" />
  )}
  {sprint.qa_count >= sprint.ticket_count * 0.9 && (
    <StatusBadge icon="✓" label="QA" color="var(--accent)" />
  )}
  {velocityPct >= 100 && (
    <StatusBadge icon="★" label="Target Met" color="var(--purple)" />
  )}
</div>

// Add to card footer:
<VelocityIndicator
  completed={sprint.velocity_completed}
  committed={sprint.velocity_committed}
  showPercentage
  color={velocityPct >= 80 ? 'green' : velocityPct >= 50 ? 'orange' : 'red'}
/>
```

### Color Coding Standards

| Purpose | Color | Hex | Usage |
|---------|-------|-----|-------|
| Success/Done | `--accent` | #10b981 | Completed items, verified QA |
| Warning | `--orange` | #f59e0b | Pending QA, at-risk velocity |
| Error/Blocked | `--red` | #ef4444 | Blocked tickets, failed QA |
| Info/Progress | `--blue` | #3b82f6 | In progress, planning |
| Neutral | `--text3` | #6b7280 | Disabled, closed items |
| Special | `--purple` | #8b5cf6 | Exceeded target, bonus |

### Progress Bar Patterns

```typescript
// Standard progress bar (used in SprintCard, burndown)
interface ProgressBarProps {
  value: number;        // 0-100
  total?: number;       // Optional total for display
  showLabel?: boolean;  // Show percentage text
  size?: 'sm' | 'md' | 'lg';
  color?: 'auto' | 'green' | 'orange' | 'red';
}

// Usage examples:
<ProgressBar value={65} showLabel />  // Shows "65%"
<ProgressBar value={30} color="red" />  // Red bar for low velocity
<ProgressBar value={95} color="green" />  // Green for high completion
```

---

## Navigation Improvements

### Proposed Navigation Structure

```
┌────────────────────────────────────────────────────────────────────┐
│  [Logo] Code Context MCP                                   [⚙]   │
├────────────────────────────────────────────────────────────────────┤
│  Context Tabs:                                                    │
│  [📊 Dashboard] [📁 Code] [🎯 Planning] [👥 Team] [⚡ Retro]      │
├────────────────────────────────────────────────────────────────────┤
│  Breadcrumb + Actions:                                            │
│  Dashboard > Sprint Board (Active)    [My Tickets] [Blockers] [+]│
├────────────────────────────────────────────────────────────────────┤
│  Content Area                                                     │
│  ...                                                              │
└────────────────────────────────────────────────────────────────────┘
```

### Key Changes:

1. **Flatten Navigation:** Remove tab-within-tab pattern
2. **Add Context Tabs:** Single-level tabs with clear purpose
3. **Persistent Actions:** Filter buttons visible at all times
4. **Smart Defaults:**
   - Auto-select active sprint
   - Auto-filter to "My Tickets" for developers
   - Show "Blockers" panel if any exist

### Quick Actions Panel

```typescript
// Add persistent quick actions bar
<QuickActions>
  <ActionButton icon="🎯" label="My Tickets" count={5} />
  <ActionButton icon="🚫" label="Blockers" count={2} highlight />
  <ActionButton icon="✓" label="QA Pending" count={3} />
  <ActionButton icon="+" label="New Ticket" />
</QuickActions>
```

---

## Priority Recommendations

### High Priority (Sprint 14)

1. **Add Sprint Status Badges** (SprintCard.tsx)
   - Retro complete indicator
   - QA verification status
   - Velocity achievement badge

2. **Gantt Chart Improvements** (GanttChart.tsx)
   - Add date axis
   - Improve color contrast
   - Add hover tooltips

3. **Quick Filters** (KanbanBoard.tsx)
   - "My Tickets" filter
   - "Blockers" quick view

### Medium Priority (Sprint 15)

4. **Navigation Flattening**
   - Remove nested tabs
   - Single-level navigation

5. **Sprint Completion Panel**
   - Checklist view for sprint closure
   - QA summary widget

6. **User Preferences**
   - Remember last view
   - Default tab per role

### Low Priority (Future)

7. **Keyboard Shortcuts**
   - Cmd+K for quick actions
   - Arrow key navigation

8. **Dashboard Customization**
   - Drag-and-drop widgets
   - Personalized layouts

---

## Appendix: Component Inventory

| Component | Status | Issues | Priority |
|-----------|--------|--------|----------|
| App.tsx | ✅ OK | Animation delay | Low |
| Sprint.tsx | ⚠️ Review | Nested tabs | Medium |
| SprintList.tsx | ⚠️ Review | No status badges | High |
| SprintCard.tsx | ⚠️ Review | Missing indicators | High |
| SprintDetail.tsx | ✅ OK | Retro collapsed | Medium |
| KanbanBoard.tsx | ⚠️ Review | No filters | High |
| TicketCard.tsx | ✅ OK | - | - |
| TicketDetailModal.tsx | ✅ OK | Read-only | Low |
| ProjectManagement.tsx | ⚠️ Review | Nested tabs | Medium |
| GanttChart.tsx | ❌ Issues | Visual clarity | High |

---

**Next Steps:**
1. Review this document with team
2. Prioritize fixes for Sprint 14
3. Create detailed specs for high-priority components
4. Implement and test with real users
