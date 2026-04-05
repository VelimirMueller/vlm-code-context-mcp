'use client';

import React, { Suspense, lazy, useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useUIStore, type PageType } from '@/stores/uiStore';
import { useFileStore } from '@/stores/fileStore';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useGithubStore } from '@/stores/githubStore';
import { useBridgeStore } from '@/stores/bridgeStore';
import { useEventSource } from '@/hooks/useEventSource';
import { useHashRouter } from '@/hooks/useHashRouter';
import { useKeyboard } from '@/hooks/useKeyboard';

const CodeExplorer = lazy(() => import('@/pages/CodeExplorer').then(m => ({ default: m.CodeExplorer })));
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Team = lazy(() => import('@/pages/Team').then(m => ({ default: m.Team })));
const Retro = lazy(() => import('@/pages/Retro').then(m => ({ default: m.Retro })));
const ProjectManagement = lazy(() => import('@/pages/ProjectManagement').then(m => ({ default: m.ProjectManagement })));
import { pageVariants, pageTransition, reducedMotion } from '@/lib/motion';
import { ToastContainer } from '@/components/atoms/ToastContainer';
import { BridgeStatusBadge } from '@/components/atoms/BridgeStatusBadge';
import { ErrorBoundary } from '@/components/atoms/ErrorBoundary';
import { LandingAnimation } from '@/components/organisms/LandingAnimation';
import { TopNav } from '@/components/molecules/TopNav';
import { QuickActionsBar } from '@/components/molecules/QuickActionsBar';
import { Breadcrumb } from '@/components/molecules/Breadcrumb';

// Legacy page name mapping (old -> new PageType)
const pageMapping: Record<string, PageType> = {
  explorer: 'code',
  sprint: 'dashboard',
};

// Legacy URL redirect map: old hash -> new hash
const legacyUrlMap: Record<string, string> = {
  '#sprint': '#dashboard',
  '#sprint/board': '#dashboard/board',
  '#sprint/team': '#team',
  '#sprint/insights': '#retro',
  '#explorer': '#code',
  '#explorer/files': '#code/files',
};

function PageSkeleton() {
  return (
    <div style={{ padding: 20, height: '100%' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ width: 80, height: 32, background: 'var(--surface2)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, height: 'calc(100% - 60px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: 56, background: 'var(--surface2)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ height: 24, width: '40%', background: 'var(--surface2)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 16, width: '70%', background: 'var(--surface2)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const activePage = useUIStore((s) => s.activePage);
  const setPage = useUIStore((s) => s.setPage);
  const prefersReducedMotion = useReducedMotion();

  // Map legacy page names to new PageType
  const normalizedPage: PageType = pageMapping[activePage as keyof typeof pageMapping] || activePage as PageType;

  const quickActions: { id: string; label: string; icon: React.ReactNode; count: number; onClick: () => void }[] = [];

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
  const selectedSprintId = useSprintStore((s) => s.selectedSprintId);
  const fetchTickets = useSprintStore((s) => s.fetchTickets);
  const fetchRetro = useSprintStore((s) => s.fetchRetro);
  const fetchAllRetro = useSprintStore((s) => s.fetchAllRetro);
  const fetchBurndown = useSprintStore((s) => s.fetchBurndown);
  const fetchBlockers = useSprintStore((s) => s.fetchBlockers);
  const fetchBugs = useSprintStore((s) => s.fetchBugs);
  const fetchMilestones = usePlanningStore((s) => s.fetchMilestones);
  const fetchBacklog = usePlanningStore((s) => s.fetchBacklog);
  const fetchDiscoveries = usePlanningStore((s) => s.fetchDiscoveries);
  const fetchDiscoveryCoverage = usePlanningStore((s) => s.fetchDiscoveryCoverage);
  const fetchGithubRepos = useGithubStore((s) => s.fetchRepos);
  const fetchGithubSyncStatus = useGithubStore((s) => s.fetchSyncStatus);
  const fetchGithubAll = useGithubStore((s) => s.fetchAll);
  const githubSelectedRepoId = useGithubStore((s) => s.selectedRepoId);
  const fetchBridgeStatus = useBridgeStore((s) => s.fetchStatus);
  const fetchBridgeActions = useBridgeStore((s) => s.fetchActions);

  useEventSource({
    onEvent: () => {
      // Refresh all data stores on any server event
      refreshFiles();
      fetchSprints();
      fetchAgents();
      fetchMilestones();
      fetchBacklog();
      fetchDiscoveries();
      fetchDiscoveryCoverage();
      fetchGithubRepos();
      fetchGithubSyncStatus();
      fetchGithubAll(githubSelectedRepoId ?? undefined);
      fetchBridgeStatus();
      fetchBridgeActions();
      fetchAllRetro();
      // Re-fetch sprint-specific data for the currently selected sprint
      if (selectedSprintId) {
        fetchTickets(selectedSprintId);
        fetchRetro(selectedSprintId);
        fetchBurndown(selectedSprintId);
        fetchBlockers(selectedSprintId);
        fetchBugs(selectedSprintId);
      }
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
        <BridgeStatusBadge />
      </header>

      {/* Top Navigation */}
      <TopNav
        activeTab={normalizedPage}
        onTabChange={(tab) => {
          setPage(tab);
        }}
      />

      {/* Quick Actions Bar */}
      <QuickActionsBar
        actions={quickActions}
        searchQuery={useUIStore((s) => s.searchQuery)}
        onSearchChange={useUIStore((s) => s.setSearch)}
        breadcrumbItems={breadcrumb}
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
            <Suspense fallback={<PageSkeleton />}>
              {normalizedPage === 'dashboard' && <ErrorBoundary><Dashboard /></ErrorBoundary>}
              {normalizedPage === 'planning' && <ErrorBoundary><ProjectManagement /></ErrorBoundary>}
              {normalizedPage === 'code' && <ErrorBoundary><CodeExplorer /></ErrorBoundary>}
              {normalizedPage === 'team' && <ErrorBoundary><Team /></ErrorBoundary>}
              {normalizedPage === 'retro' && <ErrorBoundary><Retro /></ErrorBoundary>}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <ToastContainer />
    </div>
  );
}
