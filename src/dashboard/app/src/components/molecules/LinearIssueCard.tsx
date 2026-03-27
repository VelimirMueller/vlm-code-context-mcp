import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { LinearIssue } from '@/types';

interface LinearIssueCardProps {
  issue: LinearIssue;
  onClick?: () => void;
}

const priorityColors: Record<number, string> = {
  1: 'var(--red)',
  2: 'var(--orange)',
  3: 'var(--blue)',
  4: '#6b7280',
  0: '#6b7280',
};

const priorityLabels: Record<number, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  0: 'None',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function LinearIssueCard({ issue, onClick }: LinearIssueCardProps) {
  const pColor = priorityColors[issue.priority] ?? '#6b7280';
  const pLabel = issue.priorityLabel || priorityLabels[issue.priority] || 'None';

  return (
    <motion.div
      whileHover={cardHover}
      layout
      onClick={onClick}
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 6,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Top row: identifier + priority */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        {issue.url ? (
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text3)',
              fontFamily: 'var(--mono)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
            onClick={(e) => e.stopPropagation()}
          >
            {issue.identifier}
          </a>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text3)',
              fontFamily: 'var(--mono)',
            }}
          >
            {issue.identifier}
          </span>
        )}
        <span
          style={{
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 700,
            background: pColor,
            color: 'white',
          }}
        >
          {pLabel}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text)',
          marginBottom: 6,
          lineHeight: 1.4,
        }}
      >
        {issue.title}
      </div>

      {/* Labels + project name */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {issue.labels.map((label) => (
            <span
              key={label}
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'var(--surface2)',
                color: 'var(--text2)',
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          ))}
        </div>
        {issue.projectName && (
          <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
            {issue.projectName}
          </span>
        )}
      </div>

      {/* Updated timestamp */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
          }}
        >
          {relativeTime(issue.updatedAt)}
        </span>
      </div>
    </motion.div>
  );
}
