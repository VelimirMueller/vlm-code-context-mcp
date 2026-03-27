import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { LinearProject } from '@/types';

interface LinearProjectCardProps {
  project: LinearProject;
}

const statusColors: Record<string, string> = {
  started: 'var(--accent)',
  planned: 'var(--blue)',
  backlog: 'var(--text3)',
  completed: 'var(--purple)',
  canceled: 'var(--red)',
  paused: 'var(--orange)',
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function LinearProjectCard({ project }: LinearProjectCardProps) {
  const progress = Math.round(project.progress * 100);
  const sColor = statusColors[project.status] ?? 'var(--text3)';

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
      {/* Project name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
        {project.name}
      </div>

      {/* Status badge */}
      <div>
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
          {project.status}
        </span>
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

      {/* Lead + target date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: 'var(--text3)',
        }}
      >
        <span>{project.leadName ?? '—'}</span>
        <span>{project.targetDate ? shortDate(project.targetDate) : '—'}</span>
      </div>
    </motion.div>
  );
}
