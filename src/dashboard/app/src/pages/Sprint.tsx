import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useAgents } from '@/hooks/useAgents';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { SubTabBar } from '@/components/molecules/SubTabBar';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { SprintList } from '@/components/organisms/SprintList';
import { SprintDetail } from '@/components/organisms/SprintDetail';
import { TeamGrid } from '@/components/organisms/TeamGrid';
import { BentoGrid } from '@/components/organisms/BentoGrid';
import { tabVariants, tabTransition } from '@/lib/motion';

const TABS = [
  { key: 'board', label: 'Board' },
  { key: 'team', label: 'Team' },
  { key: 'insights', label: 'Retro Insights' },
];

export function Sprint() {
  const [activeTab, setActiveTab] = useState('board');

  // Kick off data fetching
  useSprints();
  useAgents();

  // Board hero data
  const sprintDetail = useSprintStore((s) => s.sprintDetail);
  const sprints = useSprintStore((s) => s.sprints);
  const doneCount = sprintDetail?.tickets.filter((t) => t.status === 'done').length ?? 0;
  const totalCount = sprintDetail?.tickets.length ?? 0;
  const velocity = sprintDetail?.velocity_completed ?? 0;

  // Insights hero data — retroFindings aggregated across all sprints (populated by BentoGrid)
  const retroFindings = useSprintStore((s) => s.retroFindings);

  // Team hero data
  const agents = useAgentStore((s) => s.agents);
  const avgMood = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + a.mood, 0) / agents.length)
    : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <SubTabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {/* Board tab: sprint list (left) + sprint detail (right) */}
        {activeTab === 'board' && (
          <motion.div
            key="board"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={tabTransition}
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
        )}

        {/* Team tab */}
        {activeTab === 'team' && (
          <motion.div
            key="team"
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
        )}

        {/* Insights tab */}
        {activeTab === 'insights' && (
          <motion.div
            key="insights"
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
        )}
      </AnimatePresence>
    </div>
  );
}
