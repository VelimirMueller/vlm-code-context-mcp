'use client';

import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlanning } from '@/hooks/usePlanning';
import { useUIStore } from '@/stores/uiStore';
import { useBridgeStore } from '@/stores/bridgeStore';
import { VisionEditor } from '@/components/organisms/VisionEditor';
import { VisionPlayer } from '@/components/organisms/VisionPlayer';
import { ProcessFlow } from '@/components/organisms/ProcessFlow';
import { SprintPlanningView } from '@/components/organisms/SprintPlanningView';
import { SprintPlanner } from '@/components/organisms/SprintPlanner';
import { tabVariants, tabTransition } from '@/lib/motion';

type Tab = 'vision' | 'planning' | 'timeline';

const tabs: { id: Tab; label: string }[] = [
  { id: 'vision', label: 'Vision' },
  { id: 'planning', label: 'Sprint Planning' },
  { id: 'timeline', label: 'Process Flow' },
];

export function ProjectManagement() {
  usePlanning();
  const activeTab = useUIStore((s) => s.activeTab) as Tab;
  const storeSetTab = useUIStore((s) => s.setTab);
  const setActiveTab = (tab: Tab) => storeSetTab(tab);
  const [showPlanner, setShowPlanner] = useState(false);

  const queueAction = useBridgeStore((s) => s.queueAction);

  // Map step IDs to their corresponding tabs
  const stepTabMap: Record<string, Tab> = {
    vision: 'vision',
    tickets: 'planning',
    sprint: 'planning',
    implementation: 'planning',
    retro: 'timeline',
    archive: 'timeline',
  };

  const handleStepClick = useCallback((stepId: string) => {
    if (stepId === 'kickoff') {
      queueAction('run_kickoff', 'ceremony', undefined, { step: 'kickoff' });
      return;
    }

    const tab = stepTabMap[stepId];
    if (tab) {
      setActiveTab(tab);
    }
  }, [queueAction, setActiveTab]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
          gap: 16,
        }}
      >
        {/* Sub-tab bar */}
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 20px',
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
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)';
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Plan Sprint button */}
        <button
            onClick={() => setShowPlanner(true)}
            style={{
              background: 'var(--surface2)',
              color: 'var(--text2)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              flexShrink: 0,
            }}
          >
            Advanced Planner
          </button>
      </div>

      {/* Page content */}
      <div
        style={{
          flex: 1,
          overflowY: activeTab === 'vision' ? 'hidden' : 'auto',
          padding: activeTab === 'vision' ? 0 : '24px 28px',
        }}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'vision' && (
            <motion.div
              key="vision"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={tabTransition}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(600px, 800px) 1fr', gap: 0, height: '100%' }}
              className="vision-layout"
            >
              <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', borderRight: '1px solid var(--border)' }}>
                <VisionEditor />
              </div>
              <VisionPlayer />
            </motion.div>
          )}
          {activeTab === 'planning' && (
            <motion.div
              key="planning"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={tabTransition}
            >
              <SprintPlanningView />
            </motion.div>
          )}
          {activeTab === 'timeline' && (
            <motion.div
              key="timeline"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={tabTransition}
            >
              <ProcessFlow onStepClick={handleStepClick} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sprint Planner modal */}
      {showPlanner && <SprintPlanner onClose={() => setShowPlanner(false)} />}
    </div>
  );
}
