import type { LinearIssue } from '@/types';

interface LinearActivityItemProps {
  issue: LinearIssue;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function LinearActivityItem({ issue }: LinearActivityItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '6px 0',
      }}
    >
      {/* Timeline dot */}
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--accent)',
          flexShrink: 0,
          marginTop: 5,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Timestamp */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
            marginBottom: 2,
          }}
        >
          {relativeTime(issue.updatedAt)}
        </div>

        {/* Identifier + title */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text)',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mono)',
              color: 'var(--text3)',
              fontSize: 10,
              fontWeight: 700,
              marginRight: 6,
            }}
          >
            {issue.identifier}
          </span>
          {issue.title}
        </div>

        {/* Status badge */}
        <div style={{ marginTop: 3 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 3,
              background: issue.statusColor || 'var(--surface2)',
              color: 'white',
            }}
          >
            {issue.status}
          </span>
        </div>
      </div>
    </div>
  );
}
