'use client';

import React from 'react';
import { useBridgeStore } from '@/stores/bridgeStore';

const ceremonies = [
  {
    id: 'kickoff',
    label: 'Kickoff',
    icon: '◈',
    description: 'Start the full project lifecycle from vision through sprint',
    action: 'run_kickoff',
    highlight: true,
  },
  {
    id: 'planning',
    label: 'Plan Sprint',
    icon: '⚡',
    description: 'Define sprint goal, assign tickets, and commit velocity',
    action: 'plan_sprint',
    highlight: false,
  },
  {
    id: 'retro',
    label: 'Retro',
    icon: '◁',
    description: 'Run retrospective for current sprint',
    action: 'run_retro',
    highlight: false,
  },
  {
    id: 'review',
    label: 'Review',
    icon: '✓',
    description: 'Sprint review and demo',
    action: 'run_review',
    highlight: false,
  },
];

export interface CeremoniesBarProps {
  sprintId?: number | null;
}

export function CeremoniesBar({ sprintId }: CeremoniesBarProps) {
  const queueAction = useBridgeStore((s) => s.queueAction);
  const loading = useBridgeStore((s) => s.loading);

  const handleCeremony = async (action: string) => {
    if (action === 'run_kickoff' || action === 'plan_sprint') {
      // Kickoff and planning don't require a sprint ID - they start the process
      await queueAction(action, 'ceremony', null, { step: action === 'run_kickoff' ? 'kickoff' : 'planning' });
    } else if (sprintId) {
      // Retro and review require a sprint
      await queueAction(action, 'sprint', sprintId, { sprint_id: sprintId });
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      padding: '12px 20px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      alignItems: 'center',
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text3)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginRight: 8,
      }}>
        Ceremonies
      </span>
      {ceremonies.map((ceremony) => (
        <button
          key={ceremony.id}
          onClick={() => handleCeremony(ceremony.action)}
          disabled={loading || (ceremony.action !== 'run_kickoff' && ceremony.action !== 'plan_sprint' && !sprintId)}
          title={ceremony.description + (ceremony.action !== 'run_kickoff' && ceremony.action !== 'plan_sprint' && !sprintId ? ' (No sprint selected)' : '')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: ceremony.highlight ? 'var(--accent)' : 'var(--text2)',
            background: ceremony.highlight ? 'var(--accent-container, #fef3c7)' : 'var(--surface2)',
            border: ceremony.highlight ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: 8,
            cursor: (loading || (ceremony.action !== 'run_kickoff' && ceremony.action !== 'plan_sprint' && !sprintId)) ? 'not-allowed' : 'pointer',
            opacity: (loading || (ceremony.action !== 'run_kickoff' && ceremony.action !== 'plan_sprint' && !sprintId)) ? 0.5 : 1,
            fontFamily: 'var(--font)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!loading && (ceremony.action === 'run_kickoff' || ceremony.action === 'plan_sprint' || sprintId)) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span aria-hidden="true">{ceremony.icon}</span>
          <span>{ceremony.label}</span>
        </button>
      ))}
      {loading && (
        <span style={{
          fontSize: 11,
          color: 'var(--text3)',
          marginLeft: 'auto',
        }}>
          Processing...
        </span>
      )}
    </div>
  );
}
