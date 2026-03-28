import { useRef } from 'react';
import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { NormalizedLinearIssue } from '@/types';

interface LinearKanbanCardProps {
  issue: NormalizedLinearIssue;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
}

const PRIORITY_COLORS: Record<number, string> = {
  0: '#6b7280', // No priority
  1: 'var(--red)', // Urgent
  2: 'var(--orange)', // High
  3: 'var(--blue)', // Medium
  4: '#6b7280', // Low
};

const PRIORITY_LABELS: Record<number, string> = {
  0: '—',
  1: '!!!',
  2: '!!',
  3: '!',
  4: '·',
};

export function LinearKanbanCard({ issue, onDragStart, onClick }: LinearKanbanCardProps) {
  const pColor = PRIORITY_COLORS[issue.priority] ?? '#6b7280';
  const ref = useRef<HTMLDivElement>(null);

  // Attach native HTML5 drag via ref to avoid framer-motion conflict
  const handleRef = (el: HTMLDivElement | null) => {
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el && onDragStart) {
      el.draggable = true;
      el.ondragstart = onDragStart as unknown as (e: DragEvent) => void;
    }
  };

  return (
    <motion.div
      ref={handleRef}
      whileHover={cardHover}
      layout
      onClick={onClick}
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 6,
        cursor: onDragStart ? 'grab' : onClick ? 'pointer' : 'default',
      }}
    >
      {/* Header: identifier + priority */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {issue.identifier}
        </span>
        <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700, background: pColor, color: 'white' }}>
          {issue.priority_label ?? PRIORITY_LABELS[issue.priority] ?? '·'}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
        {issue.title}
      </div>

      {/* Footer: assignee + state */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text3)' }}>
        <span>{issue.assignee_name ?? '—'}</span>
        {issue.state_color && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: issue.state_color }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>{issue.state_name}</span>
          </span>
        )}
      </div>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {issue.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(99, 102, 241, 0.12)',
                color: 'rgb(129, 140, 248)',
              }}
            >
              {label}
            </span>
          ))}
          {issue.labels.length > 3 && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{issue.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Project */}
      {issue.project_name && (
        <span
          style={{
            display: 'inline-block',
            marginTop: 4,
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: 'rgba(16, 185, 129, 0.12)',
            color: 'rgb(52, 211, 153)',
          }}
        >
          {issue.project_name}
        </span>
      )}
    </motion.div>
  );
}
