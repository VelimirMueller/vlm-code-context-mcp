'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useSprints } from '@/hooks/useSprints';
import { useSprintStore } from '@/stores/sprintStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { BentoGrid } from '@/components/organisms/BentoGrid';
import { tabVariants, tabTransition } from '@/lib/motion';

export function Retro() {
  // Kick off data fetching
  useSprints();

  // Insights hero data — retroFindings aggregated across all sprints
  const retroFindings = useSprintStore((s) => s.retroFindings);
  const sprints = useSprintStore((s) => s.sprints);

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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
