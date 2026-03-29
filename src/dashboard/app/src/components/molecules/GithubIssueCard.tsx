import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { GithubIssue } from '@/types';

interface Props {
  issue: GithubIssue;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function GithubIssueCard({ issue }: Props) {
  return (
    <motion.div
      whileHover={cardHover}
      onClick={() => issue.html_url && window.open(issue.html_url, '_blank')}
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 6,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          #{issue.number}
        </span>
        <span style={{
          padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700,
          background: issue.state === 'open' ? '#10b981' : '#ef4444', color: 'white',
        }}>
          {issue.state}
        </span>
      </div>

      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
        {issue.title}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text3)' }}>
        <span>{issue.author}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>{timeAgo(issue.updated_at)}</span>
      </div>

      {issue.labels.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {issue.labels.slice(0, 3).map((label) => (
            <span key={label} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.12)', color: 'rgb(129, 140, 248)' }}>
              {label}
            </span>
          ))}
          {issue.labels.length > 3 && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{issue.labels.length - 3}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}
