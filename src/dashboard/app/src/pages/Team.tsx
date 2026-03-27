'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useAgents } from '@/hooks/useAgents';
import { useAgentStore } from '@/stores/agentStore';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { TeamGrid } from '@/components/organisms/TeamGrid';
import { tabVariants, tabTransition } from '@/lib/motion';

export function Team() {
  // Kick off data fetching
  useAgents();

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
      <AnimatePresence mode="wait">
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
      </AnimatePresence>
    </div>
  );
}
