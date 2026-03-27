'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useAgents } from '@/hooks/useAgents';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { SprintList } from '@/components/organisms/SprintList';
import { SprintDetail } from '@/components/organisms/SprintDetail';
import { QuickFilters } from '@/components/molecules/QuickFilters';
import { SubTabBar } from '@/components/molecules/SubTabBar';
import { Me } from '@/pages/Me';
import { pageVariants, pageTransition } from '@/lib/motion';

const DASHBOARD_TABS = [
  { key: 'board', label: 'Board' },
  { key: 'me', label: 'Me' },
];

export function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('board');

  // Kick off data fetching
  useSprints();
  useAgents();

  // Auto-select active sprint on mount
  const sprints = useSprintStore((s) => s.sprints);
  const selectedSprintId = useSprintStore((s) => s.selectedSprintId);
  const selectSprint = useSprintStore((s) => s.selectSprint);

  useEffect(() => {
    setMounted(true);

    // Auto-select first active sprint if none selected
    if (!selectedSprintId && sprints.length > 0) {
      const activeSprint = sprints.find((s) => s.status === 'active');
      if (activeSprint) {
        selectSprint(activeSprint.id);
      }
    }
  }, [sprints, selectedSprintId, selectSprint]);

  // Board hero data
  const sprintDetail = useSprintStore((s) => s.sprintDetail);
  const tickets = useSprintStore((s) => s.tickets);
  const doneCount = tickets.filter((t) => t.status === 'DONE').length;
  const totalCount = tickets.length;
  const velocity = sprintDetail?.velocity_completed ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Sub-tab bar: Board | Me */}
      <SubTabBar tabs={DASHBOARD_TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'board' && (
        <>
          {/* Quick Filters Bar */}
          <div
            style={{
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
              flexShrink: 0,
            }}
          >
            <QuickFilters
              onFilterChange={() => {}}
              counts={{ all: 0, mine: 0, blocked: 0, qaPending: 0 }}
              activeFilter="all"
            />
          </div>

          {/* Sprint Board */}
          <motion.div
            variants={pageVariants}
            initial="initial"
            animate={mounted ? "animate" : "initial"}
            transition={pageTransition}
            style={{ display: 'flex', flex: 1, overflow: 'hidden' }}
          >
            {/* Sprint list sidebar */}
            <div
              style={{
                width: 260,
                flexShrink: 0,
                borderRight: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  flexShrink: 0,
                }}
              >
                Sprints
              </div>
              <SprintList />
            </div>

            {/* Sprint detail panel */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
              <SprintDetail />
            </div>
          </motion.div>
        </>
      )}

      {activeTab === 'me' && <Me />}
    </div>
  );
}
