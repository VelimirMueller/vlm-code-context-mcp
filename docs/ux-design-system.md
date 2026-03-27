# Dashboard Design System Specifications

**Created:** 2026-03-27
**Sprint:** 14 (UX Overhaul)
**Companion:** ux-user-journey-map.md

---

## Component Specifications

### 1. Enhanced SprintCard

#### Current State
```
┌─────────────────────────────────────────┐
│ Sprint-2026-03-20                       │
│ ACTIVE  4/7 tickets  12/19 pts         │
│ ████████░░░░░░░░░░░░                    │
└─────────────────────────────────────────┘
```

#### Proposed Design
```
┌──────────────────────────────────────────────────────┐
│ ✓ Retro  ✓ QA  ★ Target                             │ ← NEW: Status badges
│ Sprint-2026-03-20                    63% velocity    │
│ ACTIVE  4/7 tickets  12/19 pts                       │
│ ████████░░░░░░░░░░░░                                 │
└──────────────────────────────────────────────────────┘
```

#### Specifications
```tsx
// File: components/molecules/SprintCard.tsx
interface SprintCardProps {
  sprint: Sprint;
  selected: boolean;
  onClick: (id: number) => void;
  showStatusBadges?: boolean;  // NEW
}

// Status Badge Component
interface StatusBadgeProps {
  icon: string;        // '✓' | '★' | '⚠' | '✗'
  label: string;
  color: string;       // CSS var or hex
  variant?: 'solid' | 'outline';
}
```

#### Color Matrix
| Status | Background | Border | Text | Icon |
|--------|-----------|--------|------|------|
| Retro Done | var(--accent) | none | white | ✓ |
| QA Verified | var(--accent) | none | white | ✓ |
| QA Pending | var(--orange) | none | white | ⚠ |
| Velocity Met | var(--purple) | none | white | ★ |
| Velocity Low | var(--red) | none | white | ⚠ |

---

### 2. Quick Filters Bar

#### Placement
Above Kanban board, below sprint header.

#### Design
```
┌────────────────────────────────────────────────────────────────┐
│ Filters: [All Tickets ▼] [My Tickets] [Blocked] [QA Pending]  │
│         24           5              2            3            │
└────────────────────────────────────────────────────────────────┘
```

#### Specifications
```tsx
// File: components/molecules/QuickFilters.tsx
interface QuickFiltersProps {
  onFilterChange: (filter: TicketFilter) => void;
  counts: {
    all: number;
    mine: number;
    blocked: number;
    qaPending: number;
  };
  activeFilter: TicketFilter;
}

type TicketFilter = 'all' | 'mine' | 'blocked' | 'qaPending' | 'unassigned';
```

#### Button States
| State | Background | Text | Border |
|-------|-----------|------|--------|
| Default | var(--surface) | var(--text) | var(--border) |
| Hover | var(--surface2) | var(--text) | var(--border) |
| Active | var(--accent)20 | var(--accent) | var(--accent) |
| Count Badge | var(--surface3) | var(--text3) | none |

---

### 3. Gantt Chart Improvements

#### Current Issues
- No date axis
- Nested bars confusing (time bar + velocity overlay)
- Low contrast colors
- No hover state

#### Proposed Design
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Sprint Timeline                                          Mar ▼                    │
├─────────────────────────────────────────────────────────────────────────┤
│          Sprint Mar 1  Mar 8  Mar 15  Mar 22  Mar 29  Apr 5            │
│          ────────────────────────────────────────────────────────────   │
│ Active    ████                                                          │
│           ██████████████  ████████████████████████████████             │
│ Review                    ██████████████                                 │
│ Closed                    ████████████████████████████████████           │
├─────────────────────────────────────────────────────────────────────────┤
│ ● Active  ● Review  ● Closed  ● Planning                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Key Improvements
1. **Date Axis:** Top or bottom with month selector
2. **Simpler Bars:** Single color per sprint, no nested overlay
3. **Milestone Markers:** Diamond markers for milestone boundaries
4. **Hover Tooltip:** Show exact dates + velocity
5. **Current Week Indicator:** Vertical line highlighting today

#### Specifications
```tsx
// File: components/organisms/GanttChart.tsx
interface GanttChartProps {
  sprints: Sprint[];
  milestones: Milestone[];
  dateRange: { start: Date; end: Date };
  onSprintClick?: (sprint: Sprint) => void;
  onMilestoneClick?: (milestone: Milestone) => void;
}

// Tooltip Component
interface GanttTooltipProps {
  sprint: Sprint;
  position: { x: number; y: number };
}
```

---

### 4. Sprint Completion Panel

#### New Component for Sprint Detail

#### Design
```
┌────────────────────────────────────────────────────────────┐
│ Sprint Completion Checklist                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ✓ All tickets DONE or NOT_DONE                           │
│  ⚠ QA Verified (8/10 tickets - 80%)                       │
│  ✓ Retro findings recorded (5 findings)                   │
│  ⚠ Velocity target met (12/19 = 63%)                      │
│                                                            │
│  ───────────────────────────────────────────────────────  │
│                                                            │
│  [Complete Sprint]  [View Retro]  [QA Report]             │
└────────────────────────────────────────────────────────────┘
```

#### Specifications
```tsx
// File: components/organisms/SprintCompletionPanel.tsx
interface CompletionPanelProps {
  sprint: Sprint;
  onComplete: () => void;
  onRetroClick: () => void;
  onQaClick: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  value?: string;  // e.g. "8/10 tickets"
  threshold?: number;  // e.g. 0.9 for 90%
}
```

#### Color Logic
| Status | Icon | Color |
|--------|------|-------|
| Complete | ✓ | var(--accent) |
| Partial (≥70%) | ⚠ | var(--orange) |
| Incomplete (<70%) | ✗ | var(--red) |
| N/A | — | var(--text3) |

---

## Typography Scale

```css
/* Font Families */
--font-display: 'Inter', -apple-system, sans-serif;
--font-body: 'Inter', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;

/* Font Sizes */
--text-xs:   10px;   /* Labels, badges */
--text-sm:   11px;   /* Meta info, counts */
--text-base: 12px;   /* Body text */
--text-md:   13px;   /* Secondary headers */
--text-lg:   14px;   /* Primary headers */
--text-xl:   16px;   /* Page titles */
--text-2xl:  18px;   /* Hero text */

/* Font Weights */
--font-normal:   400;
--font-medium:   500;
--font-semibold: 600;
--font-bold:     700;

/* Line Heights */
--leading-tight:  1.2;
--leading-normal: 1.4;
--leading-relaxed: 1.6;
```

---

## Spacing System

```css
/* Spacing Scale (4px base unit) */
--space-1:  4px;   /* Tight spacing */
--space-2:  8px;   /* Small gaps */
--space-3:  12px;  /* Default padding */
--space-4:  16px;  /* Section spacing */
--space-5:  20px;  /* Large gaps */
--space-6:  24px;  /* Component separation */
--space-8:  32px;  /* Page margins */

/* Component Padding */
--padding-sm:  8px 12px;
--padding-md:  12px 16px;
--padding-lg:  16px 20px;
--padding-xl:  20px 28px;
```

---

## Border Radius

```css
--radius-sm:  4px;   /* Badges, tags */
--radius-md:  8px;   /* Cards, buttons */
--radius-lg:  10px;  /* Panels */
--radius-xl:  12px;  /* Modals */
--radius-full: 9999px;  /* Pills */
```

---

## Shadows

```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05);
--shadow-md:  0 4px 6px rgba(0,0,0,0.07);
--shadow-lg:  0 10px 15px rgba(0,0,0,0.1);
--shadow-xl:  0 20px 25px rgba(0,0,0,0.15);
```

---

## Animation Standards

```css
/* Durations */
--duration-fast:   150ms;
--duration-base:   200ms;
--duration-slow:   300ms;
--duration-slower: 500ms;

/* Easing */
--ease-in:    cubic-bezier(0.4, 0, 1, 1);
--ease-out:   cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Standard Transition */
transition: all var(--duration-base) var(--ease-out);

/* Hover Effect */
transform: translateY(-1px);
box-shadow: var(--shadow-md);
```

---

## Icon System

### Status Icons
| Icon | Usage | Unicode |
|------|-------|---------|
| ✓ | Complete, verified | U+2713 |
| ✗ | Incomplete, failed | U+2717 |
| ⚠ | Warning, pending | U+26A0 |
| ★ | Achievement, bonus | U+2605 |
| → | Next step, action | U+2192 |
| ● | Status indicator | U+25CF |
| ○ | Empty status | U+25CB |

### Action Icons (use lucide-react or heroicons)
| Icon | Usage |
|------|-------|
| Filter | Filters menu |
| Search | Search input |
| Plus | Create new |
| X | Close, clear |
| ChevronDown | Dropdown |
| ChevronRight | Navigate |
| Menu | Hamburger |

---

## Responsive Breakpoints

```css
/* Breakpoints */
--screen-sm:  640px;   /* Small tablets */
--screen-md:  768px;   /* Tablets */
--screen-lg:  1024px;  /* Small desktops */
--screen-xl:  1280px;  /* Desktops */

/* Mobile Adaptations */
@media (max-width: --screen-md) {
  /* Hide sprint list sidebar */
  /* Stack kanban columns */
  /* Simplify header */
}
```

---

## Accessibility Standards

### ARIA Labels
```tsx
// Example: Status Badge
<span
  role="status"
  aria-label={`Retro findings: ${retroCount} recorded`}
  className="badge badge-retro"
>
  ✓ Retro
</span>

// Example: Progress Bar
<div
  role="progressbar"
  aria-valuenow={completed}
  aria-valuemin={0}
  aria-valuemax={total}
  aria-label={`${completed} of ${total} tickets complete`}
>
  <div style={{ width: `${pct}%` }} />
</div>
```

### Keyboard Navigation
```
Tab     - Move focus through interactive elements
Enter   - Activate focused element
Escape  - Close modals, panels
Arrow Keys - Navigate lists, grids
Cmd/Ctrl + K - Quick actions menu
```

### Focus States
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

---

## Component File Structure

```
components/
├── atoms/
│   ├── StatusBadge.tsx          (NEW)
│   ├── ProgressBar.tsx          (NEW)
│   ├── QuickFilterButton.tsx    (NEW)
│   └── ...
├── molecules/
│   ├── SprintCard.tsx           (ENHANCE)
│   ├── TicketCard.tsx           (OK)
│   ├── QuickFilters.tsx         (NEW)
│   └── ...
└── organisms/
    ├── SprintDetail.tsx         (ENHANCE)
    ├── KanbanBoard.tsx          (ENHANCE)
    ├── GanttChart.tsx           (REWORK)
    ├── SprintCompletionPanel.tsx (NEW)
    └── ...
```

---

## Implementation Priority

### Sprint 14 (Week 1)
1. StatusBadge component
2. Enhanced SprintCard with badges
3. QuickFilters component
4. Filter integration in KanbanBoard

### Sprint 14 (Week 2)
5. GanttChart date axis
6. GanttChart hover tooltips
7. Improved color contrast

### Sprint 15
8. SprintCompletionPanel component
9. Navigation flattening
10. User preferences

---

## Design Assets

When creating visual designs, reference these dimensions:

### SprintCard
- Width: 100% of sidebar (260px)
- Height: Auto (typically 80-100px)
- Padding: 12px 14px
- Border radius: 8px

### Kanban Column
- Width: 1/4 of container
- Gap: 12px
- Header height: 38px
- Card gap: 6px

### TicketCard
- Width: 100%
- Height: Auto (typically 70-90px)
- Padding: 10px 12px
- Border radius: 10px

### Modal
- Max width: 520px
- Max height: 80vh
- Padding: 24px 28px
- Border radius: 12px

---

**End of Design System Specifications**
