'use client';

import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useUIStore, type PageType } from '@/stores/uiStore';
import { useFileStore } from '@/stores/fileStore';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { useEventSource } from '@/hooks/useEventSource';
import { useHashRouter } from '@/hooks/useHashRouter';
import { useKeyboard } from '@/hooks/useKeyboard';
import { CodeExplorer } from '@/pages/CodeExplorer';
import { Dashboard } from '@/pages/Dashboard';
import { Team } from '@/pages/Team';
import { Retro } from '@/pages/Retro';
import { ProjectManagement } from '@/pages/ProjectManagement';
import { pageVariants, pageTransition, reducedMotion } from '@/lib/motion';
import { ToastContainer } from '@/components/atoms/ToastContainer';
import { LandingAnimation } from '@/components/organisms/LandingAnimation';
import { TopNav } from '@/components/molecules/TopNav';
import { QuickActionsBar } from '@/components/molecules/QuickActionsBar';
import { Breadcrumb } from '@/components/molecules/Breadcrumb';

// Page mapping: old pages -> new PageType
const pageMapping: Record<string, PageType> = {
  explorer: 'code',
  planning: 'planning',
  sprint: 'dashboard',
};

// Reverse mapping for URL hash compatibility
const reversePageMapping: Record<PageType, string> = {
  dashboard: 'sprint',
  code: 'explorer',
  planning: 'planning',
  team: 'sprint',
  retro: 'sprint',
};

// Legacy URL redirect map: old hash -> new hash
const legacyUrlMap: Record<string, string> = {
  // Old sprint URLs redirect to dashboard
  '#sprint': '#dashboard',
  '#sprint/board': '#dashboard/board',
  '#sprint/team': '#team',
  '#sprint/insights': '#retro',
  // Old explorer URLs redirect to code
  '#explorer': '#code',
  '#explorer/files': '#code/files',
};

export function App() {
  const activePage = useUIStore((s) => s.activePage);
  const setPage = useUIStore((s) => s.setPage);
  const prefersReducedMotion = useReducedMotion();

  // Map legacy page names to new PageType
  const normalizedPage: PageType = pageMapping[activePage as keyof typeof pageMapping] || activePage as PageType;

  // Quick actions data
  const tickets = useSprintStore((s) => s.tickets);
  const quickFilter = useUIStore((s) => s.quickFilter);
  const setQuickFilter = useUIStore((s) => s.setQuickFilter);

  const quickActions = useMemo(() => {
    const myTicketsCount = tickets.filter((t) => t.assigned_to === 'Me').length;
    const blockedCount = tickets.filter((t) => t.status === 'BLOCKED').length;
    const qaPendingCount = tickets.filter((t) => t.qa_verified === 0 && t.status !== 'TODO').length;

    return [
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
        count: blockedCount,
        highlight: blockedCount > 0,
        onClick: () => setQuickFilter('blocked'),
      },
      {
        id: 'qa-pending',
        label: 'QA Pending',
        icon: '⚠',
        count: qaPendingCount,
        onClick: () => setQuickFilter('qa-pending'),
      },
      ];
  }, [tickets, quickFilter, setQuickFilter]);

  const breadcrumb = useUIStore((s) => s.breadcrumbTrail);

  // Legacy URL redirect handling
  useEffect(() => {
    const hash = window.location.hash;
    const cleanHash = hash.split('?')[0]; // Remove query params for redirect lookup

    // Check if the current hash matches any legacy URLs
    if (cleanHash && legacyUrlMap[cleanHash]) {
      window.location.hash = legacyUrlMap[cleanHash];
    }
  }, []);

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
      // Refresh all data stores on any server event
      refreshFiles();
      fetchSprints();
      fetchAgents();
    },
  });

  // URL hash sync
  useHashRouter();

  // Keyboard shortcuts
  useKeyboard();

  const variants = prefersReducedMotion ? reducedMotion : pageVariants;

  return (
    <div className="app">
      {showLanding && (
        <LandingAnimation onComplete={() => setShowLanding(false)} />
      )}
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
          <span className="logo-text">
            Code Context <span className="logo-sub">MCP</span>
          </span>
        </div>
      </header>

      {/* Top Navigation */}
      <TopNav
        activeTab={normalizedPage}
        onTabChange={(tab) => {
          // Map new PageType back to legacy page name for internal routing
          const legacyPage = reversePageMapping[tab as PageType];
          setPage(legacyPage);
        }}
      />

      {/* Quick Actions Bar */}
      <QuickActionsBar
        actions={quickActions}
        searchQuery={useUIStore((s) => s.searchQuery)}
        onSearchChange={useUIStore((s) => s.setSearch)}
      />
      <main className="page-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={normalizedPage}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={prefersReducedMotion ? { duration: 0 } : pageTransition}
            style={{ height: '100%' }}
          >
            {/* Dashboard page - shows Sprint board with quick actions */}
            {normalizedPage === 'dashboard' && <Dashboard />}

            {/* Code page - shows Code Explorer */}
            {normalizedPage === 'code' && <CodeExplorer />}

            {/* Planning page - shows Project Management */}
            {normalizedPage === 'planning' && <ProjectManagement />}

            {/* Team page - shows Team grid */}
            {normalizedPage === 'team' && <Team />}

            {/* Retro page - shows Retro insights */}
            {normalizedPage === 'retro' && <Retro />}
          </motion.div>
        </AnimatePresence>
      </main>
      <ToastContainer />
    </div>
  );
}
