import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlanning } from '@/hooks/usePlanning';
import { usePlanningStore } from '@/stores/planningStore';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { useUIStore } from '@/stores/uiStore';
import { MilestoneList } from '@/components/organisms/MilestoneList';
import { VisionEditor } from '@/components/organisms/VisionEditor';
import { VisionPlayer } from '@/components/organisms/VisionPlayer';
import { GanttChart } from '@/components/organisms/GanttChart';
import { ProcessFlow } from '@/components/organisms/ProcessFlow';
import { PlanningInsights } from '@/components/organisms/PlanningInsights';
import { SprintPlanningView } from '@/components/organisms/SprintPlanningView';
import { SprintPlanner } from '@/components/organisms/SprintPlanner';
import { EpicList } from '@/components/organisms/EpicList';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { tabVariants, tabTransition } from '@/lib/motion';

type Tab = 'vision' | 'roadmap' | 'planning' | 'timeline' | 'insights';

const tabs: { id: Tab; label: string }[] = [
  { id: 'vision', label: 'Vision' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'planning', label: 'Sprint Planning' },
  { id: 'timeline', label: 'Process Flow' },
  { id: 'insights', label: 'Insights' },
];

export function ProjectManagement() {
  usePlanning();
  const activeTab = useUIStore((s) => s.activeTab) as Tab;
  const storeSetTab = useUIStore((s) => s.setTab);
  const setActiveTab = (tab: Tab) => storeSetTab(tab);
  const [showPlanner, setShowPlanner] = useState(false);
  const [roadmapView, setRoadmapView] = useState<'milestones' | 'epics'>('milestones');

  // Pre-fetch sprint and agent data for the Insights tab
  const sprints = useSprintStore((s) => s.sprints);
  const agents = useAgentStore((s) => s.agents);
  useEffect(() => {
    useSprintStore.getState().fetchSprints();
    useAgentStore.getState().fetchAgents();
  }, []);
  // Suppress unused-variable lint — consumed by child via stores
  void sprints; void agents;

  // Milestones hero — first active (in_progress) milestone, fallback to first
  const milestones = usePlanningStore((s) => s.milestones);
  const activeMilestone = milestones.find((m) => m.status === 'in_progress') ?? milestones[0] ?? null;

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
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 9,
            padding: '8px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            letterSpacing: '-0.01em',
            flexShrink: 0,
          }}
        >
          + Plan Sprint
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
          {activeTab === 'roadmap' && (
            <motion.div
              key="roadmap"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={tabTransition}
            >
              <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
                {(['milestones', 'epics'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setRoadmapView(view)}
                    style={{
                      padding: '6px 16px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: roadmapView === view ? '#000' : 'var(--text3)',
                      background: roadmapView === view ? 'var(--accent)' : 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: view === 'milestones' ? '6px 0 0 6px' : '0 6px 6px 0',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      transition: 'all .2s',
                    }}
                  >
                    {view === 'milestones' ? 'Milestones' : 'Epics'}
                  </button>
                ))}
              </div>
              {roadmapView === 'milestones' && (
                <>
                  {activeMilestone && (
                    <HeroText>
                      {'Milestone '}
                      <span style={{ fontFamily: 'var(--font)', color: 'var(--accent)', fontWeight: 700 }}>
                        {activeMilestone.name}
                      </span>
                      {' — '}
                      <AnimatedNumber value={activeMilestone.progress} />
                      {'% complete'}
                    </HeroText>
                  )}
                  <MilestoneList />
                </>
              )}
              {roadmapView === 'epics' && <EpicList />}
            </motion.div>
          )}
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
              <div style={{ marginBottom: 16 }}>
                <ProcessFlow />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <GanttChart />
              </div>
            </motion.div>
          )}
          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={tabTransition}
            >
              <PlanningInsights />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sprint Planner modal */}
      {showPlanner && <SprintPlanner onClose={() => setShowPlanner(false)} />}
    </div>
  );
}
