# Navigation Flattening — Implementation Migration Guide

**Created:** 2026-03-27
**Sprint:** 15 (Navigation Flattening)
**Author:** UX Designer Agent
**Tickets:** #1793 (5sp), #1794 (3sp), #1795 (3sp)

---

## Overview

This guide provides step-by-step instructions for implementing the flattened navigation architecture. It includes code changes, component creation, store updates, and testing procedures.

**Estimated Timeline:** 4 weeks (1 sprint)
**Risk Level:** Medium (navigation changes affect entire app)
**Breaking Changes:** Yes (URL structure, store schema, component exports)

---

## Phase 1: Foundation (Week 1)

### Step 1.1: Create New Navigation Components

#### 1.1.1: TopNav Component

**File:** `src/dashboard/app/src/components/molecules/TopNav.tsx`

```typescript
import { ReactNode } from 'react';
import { useUIStore } from '@/stores/uiStore';

interface NavItem {
  id: 'dashboard' | 'code' | 'planning' | 'team' | 'retro';
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'code', label: 'Code', icon: '📁' },
  { id: 'planning', label: 'Planning', icon: '🎯' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'retro', label: 'Retro', icon: '⚡' },
];

export function TopNav() {
  const activePage = useUIStore((s) => s.activePage);
  const setPage = useUIStore((s) => s.setPage);

  return (
    <nav className="top-nav" role="tablist" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            className={`top-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            <span className="top-nav-icon">{item.icon}</span>
            <span className="top-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

**CSS:** Add to `src/dashboard/app/src/globals.css`

```css
.top-nav {
  display: flex;
  gap: 0;
  padding: 0 24px;
  height: 48px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.top-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  font-size: 13.5px;
  font-weight: 600;
  font-family: var(--font);
  color: var(--text3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  margin-bottom: -1px;
}

.top-nav-item:hover {
  color: var(--text2);
}

.top-nav-item.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.top-nav-icon {
  font-size: 16px;
  line-height: 1;
}

.top-nav-label {
  letter-spacing: -0.01em;
}
```

#### 1.1.2: QuickActionsBar Component

**File:** `src/dashboard/app/src/components/molecules/QuickActionsBar.tsx`

```typescript
import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useSprintStore } from '@/stores/sprintStore';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  count?: number;
  highlight?: boolean;
  onClick: () => void;
}

export function QuickActionsBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const quickFilter = useUIStore((s) => s.quickFilter);
  const setQuickFilter = useUIStore((s) => s.setQuickFilter);

  // Get counts from store
  const tickets = useSprintStore((s) => s.tickets);
  const myTicketsCount = tickets.filter(t => t.assigned_to === 'current-user').length;
  const blockersCount = tickets.filter(t => t.status === 'BLOCKED').length;
  const qaPendingCount = tickets.filter(t => !t.qa_verified && t.status === 'DONE').length;

  const actions: QuickAction[] = [
    {
      id: 'my-tickets',
      label: 'My Tickets',
      icon: '🎯',
      count: myTicketsCount,
      onClick: () => setQuickFilter('mine'),
    },
    {
      id: 'blockers',
      label: 'Blockers',
      icon: '🚫',
      count: blockersCount,
      highlight: blockersCount > 0,
      onClick: () => setQuickFilter('blocked'),
    },
    {
      id: 'qa-pending',
      label: 'QA Pending',
      icon: '✓',
      count: qaPendingCount,
      onClick: () => setQuickFilter('qa-pending'),
    },
  ];

  return (
    <div className="quick-actions-bar">
      <Breadcrumb />
      <div className="quick-actions">
        {actions.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            active={quickFilter === action.id.replace('-', '')}
          />
        ))}
        <button className="quick-action-btn" onClick={() => {/* New ticket */}}>
          <span>+</span>
          <span>New Ticket</span>
        </button>
        <button
          className={`quick-action-search ${searchOpen ? 'open' : ''}`}
          onClick={() => setSearchOpen(!searchOpen)}
        >
          🔍
        </button>
      </div>
    </div>
  );
}

function QuickActionButton({ action, active }: { action: QuickAction; active: boolean }) {
  return (
    <button
      className={`quick-action-btn ${active ? 'active' : ''} ${action.highlight ? 'highlight' : ''}`}
      onClick={action.onClick}
    >
      <span>{action.icon}</span>
      <span>{action.label}</span>
      {action.count !== undefined && action.count > 0 && (
        <span className="quick-action-badge">{action.count}</span>
      )}
    </button>
  );
}

function Breadcrumb() {
  const activePage = useUIStore((s) => s.activePage);
  const quickFilter = useUIStore((s) => s.quickFilter);

  const trail = getBreadcrumbTrail(activePage, quickFilter);

  return (
    <div className="breadcrumb" aria-label="Breadcrumb navigation">
      {trail.map((item, index) => (
        <span key={index} className="breadcrumb-item">
          {item.label}
          {index < trail.length - 1 && <span className="breadcrumb-separator"> > </span>}
        </span>
      ))}
    </div>
  );
}

function getBreadcrumbTrail(page: string, filter: string): Array<{label: string}> {
  // Implementation
  return [];
}
```

**CSS:** Add to `src/dashboard/app/src/globals.css`

```css
.quick-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 24px;
  height: 40px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.quick-actions {
  display: flex;
  gap: 8px;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-action-btn:hover {
  background: var(--surface-hover);
  border-color: var(--text3);
}

.quick-action-btn.active {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.quick-action-btn.highlight {
  border-color: #ef4444;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}

.quick-action-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: #ef4444;
  border-radius: 9px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--text3);
  max-width: 60%;
  overflow: hidden;
}

.breadcrumb-item {
  white-space: nowrap;
}

.breadcrumb-separator {
  margin: 0 4px;
}
```

#### 1.1.3: Breadcrumb Component

**File:** `src/dashboard/app/src/components/molecules/Breadcrumb.tsx`

```typescript
import { useUIStore } from '@/stores/uiStore';

export function Breadcrumb() {
  const activePage = useUIStore((s) => s.activePage);
  const quickFilter = useUIStore((s) => s.quickFilter);

  const trail = getBreadcrumbTrail(activePage, quickFilter);

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb navigation">
      {trail.map((item, index) => (
        <span key={index} className="breadcrumb-item">
          <span className={item.clickable ? 'breadcrumb-link' : ''}>
            {item.label}
          </span>
          {index < trail.length - 1 && (
            <span className="breadcrumb-separator" aria-hidden="true"> > </span>
          )}
        </span>
      ))}
    </nav>
  );
}

interface BreadcrumbItem {
  label: string;
  clickable?: boolean;
}

function getBreadcrumbTrail(page: string, filter: string): BreadcrumbItem[] {
  const base = getBaseBreadcrumb(page);
  const filterCrumb = getFilterBreadcrumb(filter);

  if (filterCrumb) {
    return [...base, filterCrumb];
  }
  return base;
}

function getBaseBreadcrumb(page: string): BreadcrumbItem[] {
  const map: Record<string, BreadcrumbItem[]> = {
    dashboard: [{ label: 'Dashboard', clickable: false }, { label: 'Sprint Board', clickable: false }],
    code: [{ label: 'Code', clickable: false }, { label: 'File Explorer', clickable: false }],
    planning: [{ label: 'Planning', clickable: false }, { label: 'Roadmap', clickable: false }],
    team: [{ label: 'Team', clickable: false }, { label: 'Agent Grid', clickable: false }],
    retro: [{ label: 'Retro', clickable: false }, { label: 'Insights', clickable: false }],
  };
  return map[page] || [{ label: page, clickable: false }];
}

function getFilterBreadcrumb(filter: string): BreadcrumbItem | null {
  if (filter === 'all') return null;
  const map: Record<string, string> = {
    mine: 'My Tickets',
    blocked: 'Blockers',
    'qa-pending': 'QA Pending',
  };
  const label = map[filter];
  return label ? { label, clickable: false } : null;
}
```

### Step 1.2: Update UI Store

**File:** `src/dashboard/app/src/stores/uiStore.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UIStore {
  // Updated pages
  activePage: 'dashboard' | 'code' | 'planning' | 'team' | 'retro';

  // Sub-tab for pages with multiple views (e.g., planning?tab=vision)
  activeTab: string;

  // Quick filter for boards
  quickFilter: 'all' | 'mine' | 'blocked' | 'qa-pending';

  // User role for smart defaults
  userRole: 'developer' | 'tech-lead' | 'product-owner' | 'qa' | 'designer' | null;

  // Existing state
  sidebarCollapsed: boolean;
  expandedFolders: Set<string>;
  searchQuery: string;
  searchFocused: boolean;

  // Actions
  setPage: (page: string) => void;
  setTab: (tab: string) => void;
  setQuickFilter: (filter: UIStore['quickFilter']) => void;
  setUserRole: (role: UIStore['userRole']) => void;
  toggleSidebar: () => void;
  toggleFolder: (path: string) => void;
  expandFolderPath: (filePath: string) => void;
  setSearch: (query: string) => void;
  setSearchFocused: (focused: boolean) => void;
}

function defaultTabForPage(page: string): string {
  switch (page) {
    case 'dashboard': return 'board';
    case 'code': return 'files';
    case 'planning': return 'roadmap';
    case 'team': return 'grid';
    case 'retro': return 'insights';
    default: return 'files';
  }
}

function defaultPageForRole(role: string): UIStore['activePage'] {
  switch (role) {
    case 'developer': return 'dashboard';
    case 'tech-lead': return 'planning';
    case 'product-owner': return 'planning';
    case 'qa': return 'dashboard';
    case 'designer': return 'team';
    default: return 'dashboard';
  }
}

const setReplacer = (_: string, v: unknown) =>
  v instanceof Set ? { __type: 'Set', values: [...v] } : v;
const setReviver = (_: string, v: unknown) =>
  v && typeof v === 'object' && (v as Record<string, unknown>).__type === 'Set'
    ? new Set((v as { values: string[] }).values)
    : v;

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      activePage: 'dashboard',
      activeTab: 'board',
      quickFilter: 'all',
      userRole: null,
      sidebarCollapsed: false,
      expandedFolders: new Set<string>(),
      searchQuery: '',
      searchFocused: false,

      setPage: (page) =>
        set({
          activePage: page as UIStore['activePage'],
          activeTab: defaultTabForPage(page),
          quickFilter: 'all',
        }),

      setTab: (tab) => set({ activeTab: tab }),

      setQuickFilter: (filter) => set({ quickFilter: filter }),

      setUserRole: (role) => {
        set({ userRole: role });
        // Only change page if no page is explicitly set
        if (role && !get().userRole) {
          set({ activePage: defaultPageForRole(role) });
        }
      },

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      toggleFolder: (path) =>
        set((s) => {
          const next = new Set(s.expandedFolders);
          next.has(path) ? next.delete(path) : next.add(path);
          return { expandedFolders: next };
        }),

      expandFolderPath: (filePath) => {
        const parts = filePath.split('/');
        const ancestors: string[] = [];
        for (let i = 1; i < parts.length; i++) {
          ancestors.push(parts.slice(0, i).join('/'));
        }
        set((s) => ({ expandedFolders: new Set([...s.expandedFolders, ...ancestors]) }));
      },

      setSearch: (query) => set({ searchQuery: query }),

      setSearchFocused: (focused) => set({ searchFocused: focused }),
    }),
    {
      name: 'mcp-ui-store',
      storage: createJSONStorage(() => localStorage, {
        replacer: setReplacer,
        reviver: setReviver,
      }),
      partialize: (s) => ({
        activePage: s.activePage,
        userRole: s.userRole,
        sidebarCollapsed: s.sidebarCollapsed,
        expandedFolders: s.expandedFolders,
      }),
    },
  ),
);
```

### Step 1.3: Create URL Redirects

**File:** `src/dashboard/app/src/hooks/useLegacyRedirect.ts` (NEW)

```typescript
import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

const LEGACY_URL_MAP: Record<string, string> = {
  '#explorer': '#code',
  '#planning': '#planning',
  '#planning/vision': '#planning?tab=vision',
  '#planning/gantt': '#planning?tab=timeline',
  '#planning/insights': '#retro',
  '#sprint': '#dashboard',
  '#sprint/team': '#team',
  '#sprint/insights': '#retro',
};

export function useLegacyRedirect() {
  const setPage = useUIStore((s) => s.setPage);

  useEffect(() => {
    const hash = window.location.hash;
    const redirectUrl = LEGACY_URL_MAP[hash];

    if (redirectUrl) {
      // Parse the redirect URL
      const [page, query] = redirectUrl.split('?');
      const params = new URLSearchParams(query);
      const tab = params.get('tab');

      // Update store
      setPage(page);

      // Update URL without page reload
      window.location.hash = redirectUrl;
    }
  }, [setPage]);
}
```

### Step 1.4: Update Router Hook

**File:** `src/dashboard/app/src/hooks/useHashRouter.ts` (MODIFY)

```typescript
import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

export function useHashRouter() {
  const setPage = useUIStore((s) => s.setPage);
  const setTab = useUIStore((s) => s.setTab);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove #
      const [page, query] = hash.split('?');
      const params = new URLSearchParams(query);
      const tab = params.get('tab');

      if (page) {
        setPage(page);
        if (tab) {
          setTab(tab);
        }
      }
    };

    // Initial load
    handleHashChange();

    // Listen for changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setPage, setTab]);

  // Update URL when store changes
  useEffect(() => {
    const activePage = useUIStore.getState().activePage;
    const activeTab = useUIStore.getState().activeTab;
    const hash = `#${activePage}${activeTab && activeTab !== defaultTabForPage(activePage) ? `?tab=${activeTab}` : ''}`;
    window.location.hash = hash;
  }, []);
}
```

---

## Phase 2: Page Components (Week 2)

### Step 2.1: Create Dashboard Page

**File:** `src/dashboard/app/src/pages/Dashboard.tsx` (NEW)

```typescript
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useSprintStore } from '@/stores/sprintStore';
import { useUIStore } from '@/stores/uiStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { SprintList } from '@/components/organisms/SprintList';
import { SprintDetail } from '@/components/organisms/SprintDetail';
import { tabVariants, tabTransition } from '@/lib/motion';

export function Dashboard() {
  useSprints();

  const quickFilter = useUIStore((s) => s.quickFilter);
  const sprints = useSprintStore((s) => s.sprints);
  const tickets = useSprintStore((s) => s.tickets);
  const sprintDetail = useSprintStore((s) => s.sprintDetail);

  // Auto-select active sprint on first load
  useEffect(() => {
    const activeSprint = sprints.find(s => s.status === 'active');
    if (activeSprint && !sprintDetail) {
      useSprintStore.getState().fetchSprintDetail(activeSprint.id);
    }
  }, [sprints, sprintDetail]);

  // Filter tickets based on quickFilter
  const filteredTickets = getFilteredTickets(tickets, quickFilter);
  const doneCount = filteredTickets.filter((t) => t.status === 'DONE').length;
  const totalCount = filteredTickets.length;
  const velocity = sprintDetail?.velocity_completed ?? 0;

  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={tabTransition}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* Hero */}
      <HeroText>
        {'Sprint '}
        <span style={{ fontFamily: 'var(--font)', color: 'var(--accent)', fontWeight: 700 }}>
          {sprintDetail?.name ?? '—'}
        </span>
        {' — '}
        <AnimatedNumber value={doneCount} />
        {'/'}
        <AnimatedNumber value={totalCount} />
        {' tickets shipped, '}
        <AnimatedNumber value={velocity} />
        {'pt velocity'}
      </HeroText>

      {/* Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sprint list sidebar */}
        <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Sprints
          </div>
          <SprintList />
        </div>

        {/* Sprint detail */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SprintDetail quickFilter={quickFilter} />
        </div>
      </div>
    </motion.div>
  );
}

function getFilteredTickets(tickets: Ticket[], filter: string): Ticket[] {
  switch (filter) {
    case 'mine':
      return tickets.filter(t => t.assigned_to === 'current-user');
    case 'blocked':
      return tickets.filter(t => t.status === 'BLOCKED');
    case 'qa-pending':
      return tickets.filter(t => !t.qa_verified && t.status === 'DONE');
    default:
      return tickets;
  }
}
```

### Step 2.2: Rename Code Explorer

**File:** `src/dashboard/app/src/pages/Code.tsx` (RENAMED from CodeExplorer.tsx)

```typescript
// Rename export from CodeExplorer to Code
export function Code() {
  // Existing implementation unchanged
}
```

### Step 2.3: Redesign Planning Page

**File:** `src/dashboard/app/src/pages/Planning.tsx` (MODIFY)

```typescript
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlanning } from '@/hooks/usePlanning';
import { usePlanningStore } from '@/stores/planningStore';
import { useUIStore } from '@/stores/uiStore';
import { MilestoneList } from '@/components/organisms/MilestoneList';
import { VisionEditor } from '@/components/organisms/VisionEditor';
import { GanttChart } from '@/components/organisms/GanttChart';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { tabVariants, tabTransition } from '@/lib/motion';

type PlanningTab = 'roadmap' | 'timeline' | 'vision';

export function Planning() {
  usePlanning();
  const { activeTab, setTab } = usePlanningTabs();

  const milestones = usePlanningStore((s) => s.milestones);
  const activeMilestone = milestones.find((m) => m.status === 'in_progress') ?? milestones[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <PlanningTabBar active={activeTab} onChange={setTab} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'roadmap' && (
            <motion.div key="roadmap" variants={tabVariants} initial="initial" animate="animate" exit="exit" transition={tabTransition}>
              {activeMilestone && (
                <HeroText>
                  {'Milestone '}
                  <span style={{ fontFamily: 'var(--font)', color: 'var(--accent)', fontWeight: 700 }}>
                    {activeMilestone.name}
                  </span>
                  {' — '}
                  <AnimatedNumber value={activeMilestone.progress} />
                  {'% complete'}
                </HeroText>
              )}
              <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 250px)' }}>
                <div style={{ width: 280, flexShrink: 0 }}>
                  <MilestoneList />
                </div>
                <div style={{ flex: 1 }}>
                  <GanttChart />
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'timeline' && (
            <motion.div key="timeline" variants={tabVariants} initial="initial" animate="animate" exit="exit" transition={tabTransition}>
              <HeroText>Timeline — Sprint roadmap and dependencies</HeroText>
              <GanttChart fullWidth />
            </motion.div>
          )}
          {activeTab === 'vision' && (
            <motion.div key="vision" variants={tabVariants} initial="initial" animate="animate" exit="exit" transition={tabTransition}>
              <VisionEditor />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PlanningTabBar({ active, onChange }: { active: PlanningTab; onChange: (tab: PlanningTab) => void }) {
  const tabs: { id: PlanningTab; label: string }[] = [
    { id: 'roadmap', label: 'Roadmap' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'vision', label: 'Vision' },
  ];

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              color: isActive ? 'var(--accent)' : 'var(--text3)',
              cursor: 'pointer',
              border: 'none',
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              background: 'none',
              fontFamily: 'var(--font)',
              transition: 'all .2s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function usePlanningTabs() {
  const activeTab = useUIStore((s) => s.activeTab) as PlanningTab;
  const setTab = useUIStore((s) => s.setTab);

  // Default to roadmap
  useEffect(() => {
    if (!activeTab || !['roadmap', 'timeline', 'vision'].includes(activeTab)) {
      setTab('roadmap');
    }
  }, [activeTab, setTab]);

  return {
    activeTab: activeTab || 'roadmap',
    setTab,
  };
}
```

### Step 2.4: Extract Team Page

**File:** `src/dashboard/app/src/pages/Team.tsx` (NEW, extracted from Sprint.tsx)

```typescript
import { motion } from 'framer-motion';
import { useAgents } from '@/hooks/useAgents';
import { useAgentStore } from '@/stores/agentStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { TeamGrid } from '@/components/organisms/TeamGrid';
import { tabVariants, tabTransition } from '@/lib/motion';

export function Team() {
  useAgents();

  const agents = useAgentStore((s) => s.agents);
  const avgMood = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.mood, 0) / agents.length)
    : 0;

  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={tabTransition}
      style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <HeroText>
        <AnimatedNumber value={agents.length} />
        {' agents active — '}
        <AnimatedNumber value={avgMood} />
        {' average mood'}
      </HeroText>
      <TeamGrid />
    </motion.div>
  );
}
```

### Step 2.5: Extract Retro Page

**File:** `src/dashboard/app/src/pages/Retro.tsx` (NEW, extracted from Sprint.tsx)

```typescript
import { motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useSprintStore } from '@/stores/sprintStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { BentoGrid } from '@/components/organisms/BentoGrid';
import { tabVariants, tabTransition } from '@/lib/motion';

export function Retro() {
  useSprints();

  const sprints = useSprintStore((s) => s.sprints);
  const retroFindings = useSprintStore((s) => s.retroFindings);

  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={tabTransition}
      style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <HeroText>
        <AnimatedNumber value={retroFindings.length} />
        {' findings across '}
        <AnimatedNumber value={sprints.length} />
        {" sprints — here's what we learned"}
      </HeroText>
      <BentoGrid />
    </motion.div>
  );
}
```

---

## Phase 3: App Integration (Week 2-3)

### Step 3.1: Update App.tsx

**File:** `src/dashboard/app/src/App.tsx` (MODIFY)

```typescript
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useFileStore } from '@/stores/fileStore';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { useEventSource } from '@/hooks/useEventSource';
import { useHashRouter } from '@/hooks/useHashRouter';
import { useLegacyRedirect } from '@/hooks/useLegacyRedirect';
import { useKeyboard } from '@/hooks/useKeyboard';
import { pageVariants, pageTransition, reducedMotion } from '@/lib/motion';
import { ToastContainer } from '@/components/atoms/ToastContainer';
import { LandingAnimation } from '@/components/organisms/LandingAnimation';
import { TopNav } from '@/components/molecules/TopNav';
import { QuickActionsBar } from '@/components/molecules/QuickActionsBar';
import './globals.css';

// Lazy load pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Code = lazy(() => import('@/pages/Code'));
const Planning = lazy(() => import('@/pages/Planning'));
const Team = lazy(() => import('@/pages/Team'));
const Retro = lazy(() => import('@/pages/Retro'));

const pages = ['dashboard', 'code', 'planning', 'team', 'retro'] as const;
type Page = (typeof pages)[number];

const pageLabels: Record<Page, string> = {
  dashboard: 'Dashboard',
  code: 'Code',
  planning: 'Planning',
  team: 'Team',
  retro: 'Retro',
};

export function App() {
  const activePage = useUIStore((s) => s.activePage);
  const prefersReducedMotion = useReducedMotion();

  // Show landing animation once per session
  const [showLanding, setShowLanding] = useState(
    () => sessionStorage.getItem('landing-played') !== 'true'
  );

  // SSE: refresh stores on server events
  const refreshFiles = useFileStore((s) => s.refresh);
  const fetchSprints = useSprintStore((s) => s.fetchSprints);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  useEventSource({
    onEvent: () => {
      refreshFiles();
      fetchSprints();
      fetchAgents();
    },
  });

  // URL hash sync
  useHashRouter();

  // Legacy URL redirects
  useLegacyRedirect();

  // Keyboard shortcuts
  useKeyboard();

  const variants = prefersReducedMotion ? reducedMotion : pageVariants;

  return (
    <div className="app">
      {showLanding && (
        <LandingAnimation onComplete={() => setShowLanding(false)} />
      )}

      {/* Header */}
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <span className="logo-text">
            Code Context <span className="logo-sub">MCP</span>
          </span>
        </div>
      </header>

      {/* Top Navigation */}
      <TopNav />

      {/* Quick Actions Bar */}
      <QuickActionsBar />

      {/* Main Content */}
      <main className="page-content">
        <Suspense fallback={<div>Loading...</div>}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={prefersReducedMotion ? { duration: 0 } : pageTransition}
              style={{ height: '100%' }}
            >
              {activePage === 'dashboard' && <Dashboard />}
              {activePage === 'code' && <Code />}
              {activePage === 'planning' && <Planning />}
              {activePage === 'team' && <Team />}
              {activePage === 'retro' && <Retro />}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      <ToastContainer />
    </div>
  );
}
```

### Step 3.2: Update CSS

**File:** `src/dashboard/app/src/globals.css` (MODIFY)

```css
/* Update page-nav to top-nav */
.top-nav {
  display: flex;
  gap: 0;
  padding: 0 24px;
  height: 48px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

/* Remove old page-nav styles */
.page-nav {
  /* DEPRECATED - replaced by top-nav */
}

/* Add quick actions bar styles */
.quick-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 24px;
  height: 40px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
```

---

## Phase 4: Testing (Week 3)

### Step 4.1: Unit Tests

**File:** `src/dashboard/app/src/components/__tests__/TopNav.test.tsx` (NEW)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TopNav } from '@/components/molecules/TopNav';
import { useUIStore } from '@/stores/uiStore';

describe('TopNav', () => {
  it('renders all navigation items', () => {
    render(<TopNav />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Retro')).toBeInTheDocument();
  });

  it('highlights active tab', () => {
    render(<TopNav />);
    const dashboardTab = screen.getByText('Dashboard');
    expect(dashboardTab).toHaveClass('active');
  });

  it('calls setPage when tab is clicked', () => {
    render(<TopNav />);
    const codeTab = screen.getByText('Code');
    fireEvent.click(codeTab);
    // Assert store was updated
  });
});
```

### Step 4.2: Integration Tests

**File:** `src/dashboard/app/src/pages/__tests__/Dashboard.test.tsx` (NEW)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '@/pages/Dashboard';
import { useSprintStore } from '@/stores/sprintStore';

describe('Dashboard', () => {
  it('auto-selects active sprint on load', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Sprint/)).toBeInTheDocument();
    });
  });

  it('applies quick filter to tickets', async () => {
    render(<Dashboard />);
    // Test filter functionality
  });
});
```

### Step 4.3: E2E Tests

**File:** `src/dashboard/e2e/navigation.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Navigation Flattening', () => {
  test('redirects legacy URLs', async ({ page }) => {
    await page.goto('#sprint');
    await expect(page).toHaveURL('#dashboard');
  });

  test('navigates between pages', async ({ page }) => {
    await page.goto('#dashboard');
    await page.click('[data-testid="nav-planning"]');
    await expect(page).toHaveURL('#planning');
  });

  test('quick actions filter tickets', async ({ page }) => {
    await page.goto('#dashboard');
    await page.click('[data-testid="quick-action-my-tickets"]');
    // Assert filtered tickets
  });
});
```

---

## Phase 5: Launch (Week 4)

### Step 5.1: Feature Flags

**File:** `src/dashboard/app/src/features.ts` (NEW)

```typescript
export const FEATURES = {
  NEW_NAVIGATION: process.env.FEATURE_NEW_NAVIGATION === 'true',
  QUICK_ACTIONS: process.env.FEATURE_QUICK_ACTIONS === 'true',
  ROLE_BASED_DEFAULTS: process.env.FEATURE_ROLE_BASED_DEFAULTS === 'true',
} as const;
```

### Step 5.2: Analytics Events

**File:** `src/dashboard/app/src/lib/analytics.ts` (NEW)

```typescript
export function trackNavigation(event: string, properties: Record<string, unknown>) {
  // Implementation
}

// Usage in components
trackNavigation('nav_tab_click', { tab: 'dashboard', previous_tab: 'code' });
trackNavigation('quick_action_click', { action: 'my_tickets', count: 5 });
```

### Step 5.3: User Feedback

**File:** `src/dashboard/app/src/components/atoms/FeedbackWidget.tsx` (NEW)

```typescript
export function FeedbackWidget() {
  // Collect user feedback on new navigation
}
```

---

## Rollback Plan

If critical issues are found:

1. **Immediate Rollback:** Revert to old navigation
   - Git revert to pre-flattening commit
   - Deploy old version

2. **Graceful Degradation:** Keep new nav but disable problematic features
   - Disable quick actions via feature flag
   - Disable role-based defaults
   - Keep flat navigation but fix bugs

3. **Progressive Rollout:** Roll out to subset of users
   - Enable for beta users only
   - Monitor analytics and feedback
   - Fix issues before full rollout

---

## Success Metrics

Track these metrics after launch:

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Clicks to find tickets | 7 | 2-3 | Analytics |
| Time to first action | 8s | 3s | Analytics |
| Tab visibility | 33% | 100% | Heuristic |
| User satisfaction | N/A | 4.5/5 | Survey |
| Navigation errors | N/A | <1% | Error tracking |

---

**Document Version:** 1.0
**Last Updated:** 2026-03-27
**Status:** Ready for Implementation
