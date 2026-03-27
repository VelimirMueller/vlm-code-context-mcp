'use client';

import React from 'react';
import type { Sprint } from '@/types';

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  value?: string;
  threshold?: number;
}

interface SprintCompletionPanelProps {
  sprint: Sprint;
  tickets: { total: number; done: number };
  retroFindings: { count: number; hasFindings: boolean };
  onComplete?: () => void;
  onRetroClick?: () => void;
  onQaClick?: () => void;
}

function getCompletionStatus(
  complete: boolean,
  threshold?: number,
  value?: string
): { icon: string; color: string } {
  if (complete) {
    return { icon: '✓', color: 'var(--accent)' };
  }
  if (threshold !== undefined && value) {
    // Parse value like "8/10" to get percentage
    const match = value.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      const current = parseInt(match[1], 10);
      const pct = (current / parseInt(match[2], 10)) * 100;
      if (pct >= (threshold * 100)) {
        return { icon: '⚠', color: 'var(--orange)' };
      }
    }
  }
  return { icon: '✗', color: 'var(--red)' };
}

export function SprintCompletionPanel({
  sprint,
  tickets,
  retroFindings,
  onComplete,
  onRetroClick,
  onQaClick,
}: SprintCompletionPanelProps) {
  const done = sprint.velocity_completed ?? 0;
  const committed = sprint.velocity_committed ?? 0;
  const velocityPct = committed > 0 ? Math.round((done / committed) * 100) : 0;

  // All tickets are DONE or NOT_DONE (partial completion)
  const ticketsComplete = tickets.done >= tickets.total && tickets.total > 0;

  // QA verified: 90%+ of non-TODO tickets verified
  const qaVerified = sprint.qa_count ?? 0;
  const qaThreshold = Math.round(tickets.total * 0.9);
  const qaComplete = qaVerified >= qaThreshold;

  // Retro findings recorded
  const retroComplete = retroFindings.hasFindings;

  // Velocity target met: 80%+ of committed
  const velocityComplete = velocityPct >= 80;

  const checklistItems: ChecklistItem[] = [
    {
      id: 'tickets',
      label: 'All tickets DONE or NOT_DONE',
      complete: ticketsComplete,
      value: `${tickets.done}/${tickets.total}`,
    },
    {
      id: 'qa',
      label: 'QA Verified',
      complete: qaComplete,
      value: `${qaVerified}/${tickets.total} tickets`,
      threshold: 0.9,
    },
    {
      id: 'retro',
      label: 'Retro findings recorded',
      complete: retroComplete,
      value: `${retroFindings.count} findings`,
    },
    {
      id: 'velocity',
      label: 'Velocity target met',
      complete: velocityComplete,
      value: `${done}/${committed} = ${velocityPct}%`,
      threshold: 0.8,
    },
  ];

  const allComplete = checklistItems.every((item) => item.complete);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 16,
        }}
      >
        Sprint Completion Checklist
      </div>

      {/* Checklist Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {checklistItems.map((item) => {
          const status = getCompletionStatus(item.complete, item.threshold, item.value);
          const isPartial = !item.complete && status.icon === '⚠';

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                background: item.complete ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)',
                border: `1px solid ${item.complete ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {/* Status Icon */}
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: status.color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {status.icon}
              </span>

              {/* Label */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text)',
                  flex: 1,
                }}
              >
                {item.label}
              </span>

              {/* Value Badge */}
              {item.value && (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--mono)',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: isPartial
                      ? 'rgba(245, 158, 11, 0.15)'
                      : item.complete
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'var(--surface3)',
                    color: isPartial
                      ? 'var(--orange)'
                      : item.complete
                      ? 'var(--accent)'
                      : 'var(--text3)',
                  }}
                >
                  {item.value}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: 'var(--border)',
          margin: '16px 0',
        }}
      />

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={onComplete}
          disabled={!allComplete}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: allComplete ? 'pointer' : 'not-allowed',
            background: allComplete ? 'var(--accent)' : 'var(--surface3)',
            color: allComplete ? 'white' : 'var(--text3)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (allComplete) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Complete Sprint
        </button>

        <button
          onClick={onRetroClick}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            fontWeight: 500,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface2)';
            e.currentTarget.style.borderColor = 'var(--text3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          View Retro
        </button>

        <button
          onClick={onQaClick}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            fontWeight: 500,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface2)';
            e.currentTarget.style.borderColor = 'var(--text3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          QA Report
        </button>
      </div>

      {/* Progress Summary */}
      <div
        style={{
          marginTop: 16,
          padding: '12px',
          borderRadius: 'var(--radius)',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: 'var(--surface3)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(checklistItems.filter((i) => i.complete).length / checklistItems.length) * 100}%`,
              height: '100%',
              background: allComplete ? 'var(--accent)' : velocityPct >= 50 ? 'var(--orange)' : 'var(--red)',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--mono)',
            color: 'var(--text3)',
          }}
        >
          {checklistItems.filter((i) => i.complete).length}/{checklistItems.length}
        </span>
      </div>
    </div>
  );
}
