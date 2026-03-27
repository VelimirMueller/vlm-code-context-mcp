import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { LinearCycle } from '@/types';

interface LinearCycleCardProps {
  cycle: LinearCycle;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const statusColors: Record<string, string> = {
  active: 'var(--accent)',
  completed: 'var(--blue)',
  upcoming: 'var(--orange)',
};

export function LinearCycleCard({ cycle }: LinearCycleCardProps) {
  const progress =
    cycle.totalIssueCount > 0
      ? Math.round((cycle.completedIssueCount / cycle.totalIssueCount) * 100)
      : 0;
  const sColor = statusColors[cycle.status] ?? 'var(--text3)';

  return (
    <motion.div
      whileHover={cardHover}
      layout
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 6,
        display: 'grid',
        gap: 6,
      }}
    >
      {/* Cycle name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
        {cycle.name}
      </div>

      {/* Date range */}
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
        {shortDate(cycle.startsAt)} &mdash; {shortDate(cycle.endsAt)}
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: 'var(--surface2)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 2,
              background: 'var(--accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
          {progress}%
        </span>
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            background: sColor,
            color: 'white',
            textTransform: 'capitalize',
          }}
        >
          {cycle.status}
        </span>
      </div>
    </motion.div>
  );
}
