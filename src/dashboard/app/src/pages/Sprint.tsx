'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useAgents } from '@/hooks/useAgents';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { useUIStore } from '@/stores/uiStore';
import { SubTabBar } from '@/components/molecules/SubTabBar';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { SprintList } from '@/components/organisms/SprintList';
import { SprintDetail } from '@/components/organisms/SprintDetail';
import { TeamGrid } from '@/components/organisms/TeamGrid';
import { BentoGrid } from '@/components/organisms/BentoGrid';
import { PlanningInsights } from '@/components/organisms/PlanningInsights';
import { SprintPlanner } from '@/components/organisms/SprintPlanner';
import { tabVariants, tabTransition } from '@/lib/motion';

const TABS = [
  { key: 'board', label: 'Board' },
  { key: 'team', label: 'Team' },
  { key: 'retro', label: 'Retro' },
  { key: 'planning', label: 'Planning' },
  { key: 'insights', label: 'Insights' },
];

interface SprintProps {
  defaultTab?: 'board' | 'team' | 'retro' | 'planning' | 'insights';
}

export function Sprint({ defaultTab }: SprintProps = {}) {
  const activeTab = useUIStore((s) => s.activeTab) || defaultTab || 'board';
  const setActiveTab = useUIStore((s) => s.setTab);

  // Kick off data fetching
  useSprints();
  useAgents();

  // Board hero data
  const sprintDetail = useSprintStore((s) => s.sprintDetail);
  const sprints = useSprintStore((s) => s.sprints);
  const tickets = useSprintStore((s) => s.tickets);
  const doneCount = tickets.filter((t) => t.status === 'DONE').length;
  const totalCount = tickets.length;
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
              <SprintDetail onNavigate={setActiveTab} />
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

        {/* Retro tab — sprint-specific retro findings */}
        {activeTab === 'retro' && (
          <motion.div
            key="retro"
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
                Sprint Retros
              </div>
              <SprintList />
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <HeroText>
                {'Retro — '}
                <span style={{ fontFamily: 'var(--font)', color: 'var(--accent)', fontWeight: 700 }}>
                  {sprintDetail?.name ?? 'Select a sprint'}
                </span>
              </HeroText>
              <RetroTab />
            </div>
          </motion.div>
        )}

        {/* Planning tab — velocity, capacity, milestones */}
        {activeTab === 'planning' && (
          <motion.div
            key="planning"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={tabTransition}
            style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <HeroText>
              {'Planning — '}
              <AnimatedNumber value={sprints.filter(s => s.status === 'closed').length} />
              {' sprints closed, '}
              <AnimatedNumber value={sprints.filter(s => s.status === 'active').length} />
              {' active'}
            </HeroText>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
              <PlanningInsights />
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                <PlanSprintButton />
              </div>
            </div>
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

/* ─── Retro Tab content ─────────────────────────────────────────────────────── */

function RetroTab() {
  const findings = useSprintStore((s) => s.selectedRetroFindings);
  const sprintDetail = useSprintStore((s) => s.sprintDetail);
  const selectedSprintId = useSprintStore((s) => s.selectedSprintId);

  if (!selectedSprintId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14, flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>&#128270;</div>
        Select a sprint to view its retro
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14, flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>&#9888;</div>
        No retro findings for this sprint
        <div style={{ fontSize: 12, color: 'var(--red)' }}>Retro is mandatory before closing</div>
      </div>
    );
  }

  const well = findings.filter((f: any) => f.category === 'went_well');
  const wrong = findings.filter((f: any) => f.category === 'went_wrong');
  const tryNext = findings.filter((f: any) => f.category === 'try_next');

  const categories = [
    { items: well, label: 'Went Well', color: 'var(--accent)' },
    { items: wrong, label: 'Went Wrong', color: 'var(--red)' },
    { items: tryNext, label: 'Try Next', color: 'var(--purple)' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {categories.map(({ items, label, color }) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color }}>{items.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Findings by category */}
      {categories.map(({ items, label, color }) =>
        items.length > 0 ? (
          <div key={label} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {label}
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 400, color: 'var(--text3)' }}>({items.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((f: any, i: number) => (
                <div
                  key={f.id ?? i}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    borderLeft: `3px solid ${color}`,
                    fontSize: 13,
                    color: 'var(--text2)',
                    lineHeight: 1.5,
                  }}
                >
                  {f.finding}
                  {f.action_owner && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                      Owner: {f.action_owner}
                    </div>
                  )}
                  {f.role && (
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>({f.role})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

/* ─── Plan Sprint Button ────────────────────────────────────────────────────── */

function PlanSprintButton() {
  const [showPlanner, setShowPlanner] = useState(false);
  return (
    <>
      <button
        onClick={() => setShowPlanner(true)}
        style={{
          padding: '10px 24px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid var(--accent)',
          background: 'rgba(16,185,129,.1)',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontFamily: 'var(--font)',
          transition: 'all .2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#000'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,.1)'; e.currentTarget.style.color = 'var(--accent)'; }}
      >
        + Plan New Sprint
      </button>
      {showPlanner && <SprintPlanner onClose={() => setShowPlanner(false)} />}
    </>
  );
}
