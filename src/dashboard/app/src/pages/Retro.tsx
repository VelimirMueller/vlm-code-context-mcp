'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useSprintStore } from '@/stores/sprintStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { BentoGrid } from '@/components/organisms/BentoGrid';
import { tabVariants, tabTransition } from '@/lib/motion';
import { get } from '@/lib/api';
import type { RetroFinding } from '@/types';

export function Retro() {
  // Kick off data fetching
  useSprints();

  // Insights hero data — retroFindings aggregated across all sprints
  const retroFindings = useSprintStore((s) => s.retroFindings);
  const sprints = useSprintStore((s) => s.sprints);

  // Fetch auto-analysis findings separately
  const [autoFindings, setAutoFindings] = useState<(RetroFinding & { sprint_name?: string })[]>([]);
  useEffect(() => {
    get<(RetroFinding & { sprint_name?: string })[]>('/api/retro/all')
      .then((findings) => {
        const auto = (Array.isArray(findings) ? findings : []).filter(
          (f) => f.category === 'auto_analysis'
        );
        setAutoFindings(auto);
      })
      .catch(() => setAutoFindings([]));
  }, [sprints.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <AnimatePresence mode="wait">
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

          {/* Auto-analysis cards — highlighted section */}
          {autoFindings.length > 0 && (
            <div style={{ padding: '0 20px 8px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue, #3b82f6)' }}>
                  Auto-Analysis
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {autoFindings.length} generated insight{autoFindings.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 10,
                }}
              >
                {autoFindings.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      background: 'rgba(59,130,246,.08)',
                      border: '1px solid rgba(59,130,246,.25)',
                      borderLeft: '3px solid var(--blue, #3b82f6)',
                      borderRadius: 'var(--radius, 8px)',
                      padding: '12px 14px',
                    }}
                  >
                    {f.sprint_name && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: 'var(--blue, #3b82f6)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 4,
                        }}
                      >
                        {f.sprint_name}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                      {f.finding}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
