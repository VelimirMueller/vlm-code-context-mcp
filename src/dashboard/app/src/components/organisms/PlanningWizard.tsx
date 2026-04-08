'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSprintPhase, type SprintPhase } from '@/hooks/useSprintPhase';
import { useSprintStore } from '@/stores/sprintStore';
import { post } from '@/lib/api';

const PHASE_CONFIG: Record<SprintPhase, { icon: string; color: string; title: string; description: string }> = {
  none: {
    icon: '◈',
    color: '#8b5cf6',
    title: 'No Sprint Yet',
    description: 'Create your tickets below, then start a sprint when you\'re ready.',
  },
  planning: {
    icon: '≡',
    color: '#3b82f6',
    title: 'Planning',
    description: 'Refine your tickets — adjust points, assignees, and priorities. Start implementation when ready.',
  },
  implementation: {
    icon: '▶',
    color: '#10b981',
    title: 'Implementation',
    description: 'Sprint is in progress. Update ticket status as work completes.',
  },
  qa: {
    icon: '✓',
    color: '#f59e0b',
    title: 'QA Review',
    description: 'Verify completed work. Mark tickets as QA-verified when they pass.',
  },
  done: {
    icon: '◁',
    color: '#ec4899',
    title: 'Sprint Done',
    description: 'All work complete. Run the retrospective and close the sprint.',
  },
  rest: {
    icon: '○',
    color: '#6b7280',
    title: 'Between Sprints',
    description: 'Previous sprint is closed. Plan new tickets and start the next sprint.',
  },
};

const PHASES_ORDER: SprintPhase[] = ['planning', 'implementation', 'qa', 'done'];

interface PlanningWizardProps {
  onStartSprint?: () => void;
}

export function PlanningWizard({ onStartSprint }: PlanningWizardProps) {
  const { phase, sprint, nextAction, canStartSprint, canAdvance } = useSprintPhase();
  const fetchSprints = useSprintStore((s) => s.fetchSprints);
  const [advancing, setAdvancing] = useState(false);
  const config = PHASE_CONFIG[phase];

  const handleAdvance = async () => {
    if (!sprint || advancing) return;
    setAdvancing(true);
    try {
      await post(`/api/sprint/${sprint.id}/advance`, {});
      await fetchSprints();
    } catch {
      // silent
    } finally {
      setAdvancing(false);
    }
  };

  const handleStartSprint = () => {
    if (onStartSprint) {
      onStartSprint();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 20,
      }}
    >
      {/* Phase stepper */}
      {phase !== 'none' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
          {PHASES_ORDER.map((p, i) => {
            const pConf = PHASE_CONFIG[p];
            const isActive = p === phase;
            const isPast = PHASES_ORDER.indexOf(phase) > i;
            const opacity = isActive ? 1 : isPast ? 0.7 : 0.3;

            return (
              <React.Fragment key={p}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: isActive ? pConf.color : isPast ? `${pConf.color}44` : 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: isActive ? '#fff' : isPast ? pConf.color : 'var(--text3)',
                      fontWeight: 700,
                      border: isActive ? `2px solid ${pConf.color}` : '1px solid var(--border2)',
                      flexShrink: 0,
                    }}
                  >
                    {isPast ? '✓' : pConf.icon}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--text)' : 'var(--text3)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pConf.title}
                  </span>
                </div>
                {i < PHASES_ORDER.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: isPast ? pConf.color : 'var(--border2)',
                      margin: '0 12px',
                      borderRadius: 1,
                      minWidth: 20,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Current phase info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${config.color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            color: config.color,
            flexShrink: 0,
          }}
        >
          {config.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {sprint ? sprint.name : config.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            {config.description}
          </div>
          {sprint && sprint.goal && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
              Goal: {sprint.goal}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {canAdvance && (
            <button
              onClick={handleAdvance}
              disabled={advancing}
              style={{
                background: advancing ? 'var(--surface3)' : config.color,
                color: advancing ? 'var(--text3)' : '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: advancing ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              {advancing ? 'Advancing...' : phase === 'planning' ? 'Start Implementation' : phase === 'done' ? 'Close Sprint' : 'Advance'}
            </button>
          )}
          {canStartSprint && (
            <button
              onClick={handleStartSprint}
              style={{
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Start Sprint
            </button>
          )}
        </div>
      </div>

      {/* Next action hint */}
      <div
        style={{
          marginTop: 14,
          padding: '8px 12px',
          background: `${config.color}08`,
          borderRadius: 8,
          border: `1px solid ${config.color}20`,
          fontSize: 12,
          color: 'var(--text3)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color: config.color }}>▸</span>
        Next: {nextAction}
        {sprint && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
            {sprint.done_count}/{sprint.ticket_count} done
            {sprint.velocity_committed > 0 && ` · ${sprint.velocity_completed}/${sprint.velocity_committed} pts`}
          </span>
        )}
      </div>
    </motion.div>
  );
}
