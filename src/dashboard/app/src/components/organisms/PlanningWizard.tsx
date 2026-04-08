'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSprintPhase, type SprintPhase } from '@/hooks/useSprintPhase';
import { useSprintStore } from '@/stores/sprintStore';
import { useBridgeStore } from '@/stores/bridgeStore';
import { post } from '@/lib/api';

interface StepConfig {
  label: string;
  icon: string;
  color: string;
  description: string;
  buttonLabel: string;
  buttonAction: 'advance' | 'start' | 'implement' | null;
  position: 'first' | 'next' | 'last';
}

function getStepConfig(phase: SprintPhase, ticketsDone: number, ticketsTotal: number): StepConfig {
  switch (phase) {
    case 'none':
      return {
        label: 'First Step',
        icon: '◈',
        color: '#8b5cf6',
        description: 'Add tickets below, then start a sprint.',
        buttonLabel: 'Start Sprint',
        buttonAction: 'start',
        position: 'first',
      };
    case 'rest':
      return {
        label: 'First Step',
        icon: '◈',
        color: '#8b5cf6',
        description: 'Previous sprint complete. Create tickets and start the next one.',
        buttonLabel: 'Start Sprint',
        buttonAction: 'start',
        position: 'first',
      };
    case 'planning':
      return {
        label: 'Next Step',
        icon: '▶',
        color: '#3b82f6',
        description: 'Review tickets, adjust points and assignees. Begin when ready.',
        buttonLabel: 'Start Implementation',
        buttonAction: 'advance',
        position: 'next',
      };
    case 'implementation': {
      const allDone = ticketsTotal > 0 && ticketsDone === ticketsTotal;
      return {
        label: allDone ? 'Last Step' : 'Next Step',
        icon: allDone ? '✓' : '▶',
        color: allDone ? '#10b981' : '#10b981',
        description: allDone
          ? `All ${ticketsTotal} tickets done. Finish the sprint.`
          : `${ticketsDone}/${ticketsTotal} tickets done. Implement remaining tickets.`,
        buttonLabel: allDone ? 'Finish Sprint' : 'Implement Next Ticket',
        buttonAction: allDone ? 'advance' : 'implement',
        position: allDone ? 'last' : 'next',
      };
    }
    case 'qa':
      return {
        label: 'Next Step',
        icon: '✓',
        color: '#f59e0b',
        description: 'Verify completed work passes QA.',
        buttonLabel: 'Advance',
        buttonAction: 'advance',
        position: 'next',
      };
    case 'done':
      return {
        label: 'Last Step',
        icon: '◁',
        color: '#ec4899',
        description: 'Sprint work complete. Close it out.',
        buttonLabel: 'Close Sprint',
        buttonAction: 'advance',
        position: 'last',
      };
  }
}

interface PlanningWizardProps {
  onStartSprint?: () => void;
}

export function PlanningWizard({ onStartSprint }: PlanningWizardProps) {
  const { phase, sprint } = useSprintPhase();
  const fetchSprints = useSprintStore((s) => s.fetchSprints);
  const queueAction = useBridgeStore((s) => s.queueAction);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const ticketsDone = sprint?.done_count ?? 0;
  const ticketsTotal = sprint?.ticket_count ?? 0;
  const step = getStepConfig(phase, ticketsDone, ticketsTotal);

  const handleAction = async () => {
    if (busy) return;
    setBusy(true);
    setLastResult(null);

    try {
      if (step.buttonAction === 'advance' && sprint) {
        const res = await post<{ from: string; to: string; automations: string[] }>(`/api/sprint/${sprint.id}/advance`, {});
        const auto = res.automations?.length ? ` (${res.automations.join(', ')})` : '';
        setLastResult(`${res.from} → ${res.to}${auto}`);
        await fetchSprints();
      } else if (step.buttonAction === 'start') {
        if (onStartSprint) onStartSprint();
      } else if (step.buttonAction === 'implement' && sprint) {
        // Queue implement action for Claude to pick up via /sprint-connect
        const tickets = await import('@/lib/api').then(m => m.get<{ id: number; title: string; status: string }[]>(`/api/sprint/${sprint.id}/tickets`));
        const next = tickets?.find(t => t.status === 'TODO' || t.status === 'IN_PROGRESS');
        if (next) {
          await queueAction('implement_ticket', 'ticket', next.id, { sprint_id: sprint.id, title: next.title });
          setLastResult(`Queued: ${next.title} — waiting for Claude...`);
        } else {
          setLastResult('No remaining tickets to implement');
        }
      }
    } catch (e) {
      setLastResult(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const positionColor = step.position === 'first' ? '#8b5cf6' : step.position === 'last' ? '#ec4899' : step.color;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 20,
        borderLeft: `3px solid ${positionColor}`,
      }}
    >
      {/* Step label */}
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: positionColor,
        marginBottom: 12,
      }}>
        {step.icon} {step.label}
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          {sprint && (
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {sprint.name}
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
            {step.description}
          </div>
          {sprint?.goal && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
              Goal: {sprint.goal}
            </div>
          )}
        </div>

        {/* Single action button */}
        {step.buttonAction && (
          <button
            onClick={handleAction}
            disabled={busy}
            style={{
              background: busy ? 'var(--surface3)' : positionColor,
              color: busy ? 'var(--text3)' : '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {busy ? '...' : step.buttonLabel}
          </button>
        )}
      </div>

      {/* Progress bar for implementation */}
      {phase === 'implementation' && ticketsTotal > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            height: 4,
            background: 'var(--surface2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(ticketsDone / ticketsTotal) * 100}%` }}
              transition={{ duration: 0.5 }}
              style={{ height: '100%', background: step.color, borderRadius: 2 }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
            {ticketsDone}/{ticketsTotal} done
            {sprint && sprint.velocity_committed > 0 && ` · ${sprint.velocity_completed}/${sprint.velocity_committed} pts`}
          </div>
        </div>
      )}

      {/* Result feedback */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: lastResult.startsWith('Error') ? 'rgba(239,68,68,0.1)' : `${positionColor}10`,
              borderRadius: 8,
              fontSize: 12,
              color: lastResult.startsWith('Error') ? '#ef4444' : 'var(--text2)',
            }}
          >
            {lastResult}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
