'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useSprintStore } from '@/stores/sprintStore';
import { useUIStore } from '@/stores/uiStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { SubTabBar } from '@/components/molecules/SubTabBar';
import { BentoGrid } from '@/components/organisms/BentoGrid';
import { tabVariants, tabTransition } from '@/lib/motion';
import { get } from '@/lib/api';
import type { RetroFinding } from '@/types';

const RETRO_TABS = [
  { key: 'insights', label: 'Findings' },
  { key: 'history', label: 'History' },
  { key: 'patterns', label: 'Patterns' },
];

function HistoryView() {
  const [allFindings, setAllFindings] = useState<(RetroFinding & { sprint_name?: string })[]>([]);
  const sprints = useSprintStore((s) => s.sprints);

  useEffect(() => {
    get<(RetroFinding & { sprint_name?: string })[]>('/api/retro/all')
      .then((f) => setAllFindings(Array.isArray(f) ? f : []))
      .catch(() => setAllFindings([]));
  }, [sprints.length]);

  const byCategory = (cat: string) => allFindings.filter((f) => f.category === cat);
  const categories = [
    { key: 'went_well', label: 'Went Well', color: '#10b981' },
    { key: 'went_wrong', label: 'Went Wrong', color: '#ef4444' },
    { key: 'try_next', label: 'Try Next', color: '#8b5cf6' },
  ];

  if (allFindings.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No retro findings yet.</div>;
  }

  return (
    <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
      {categories.map(({ key, label, color }) => {
        const items = byCategory(key);
        if (items.length === 0) return null;
        return (
          <div key={key} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              {label} ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.slice(0, 20).map((f) => (
                <div key={f.id} style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, borderRadius: 6, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {f.finding}
                  {f.sprint_name && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8, fontFamily: 'var(--mono)' }}>— {f.sprint_name}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PatternsView() {
  const [autoFindings, setAutoFindings] = useState<(RetroFinding & { sprint_name?: string })[]>([]);
  const sprints = useSprintStore((s) => s.sprints);

  useEffect(() => {
    get<(RetroFinding & { sprint_name?: string })[]>('/api/retro/all')
      .then((findings) => {
        const auto = (Array.isArray(findings) ? findings : []).filter((f) => f.category === 'auto_analysis');
        setAutoFindings(auto);
      })
      .catch(() => setAutoFindings([]));
  }, [sprints.length]);

  if (autoFindings.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No auto-analysis patterns yet. Close a sprint to generate analysis.</div>;
  }

  return (
    <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue, #3b82f6)', marginBottom: 16 }}>Auto-Analysis Patterns</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {autoFindings.map((f) => (
          <div key={f.id} style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.25)', borderLeft: '3px solid var(--blue, #3b82f6)', borderRadius: 8, padding: '12px 14px' }}>
            {f.sprint_name && (
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue, #3b82f6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.sprint_name}</div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{f.finding}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Retro() {
  useSprints();

  const retroFindings = useSprintStore((s) => s.retroFindings);
  const sprints = useSprintStore((s) => s.sprints);
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <SubTabBar tabs={RETRO_TABS} />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
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

          {(activeTab === 'insights' || !['history', 'patterns'].includes(activeTab)) && <BentoGrid />}
          {activeTab === 'history' && <HistoryView />}
          {activeTab === 'patterns' && <PatternsView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
