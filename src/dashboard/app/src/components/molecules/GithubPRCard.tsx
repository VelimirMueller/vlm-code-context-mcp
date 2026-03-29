import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { GithubPullRequest } from '@/types';

interface Props {
  pr: GithubPullRequest;
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

const STATE_COLORS: Record<string, string> = {
  open: '#10b981',
  closed: '#ef4444',
  merged: '#a855f7',
};

export function GithubPRCard({ pr }: Props) {
  return (
    <motion.div
      whileHover={cardHover}
      onClick={() => pr.html_url && window.open(pr.html_url, '_blank')}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            #{pr.number}
          </span>
          {pr.draft && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#6b7280', color: 'white', fontWeight: 700 }}>
              draft
            </span>
          )}
        </div>
        <span style={{
          padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700,
          background: STATE_COLORS[pr.state] ?? '#6b7280', color: 'white',
        }}>
          {pr.state}
        </span>
      </div>

      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
        {pr.title}
      </div>

      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', marginBottom: 6 }}>
        {pr.head_branch} → {pr.base_branch}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text3)' }}>
        <span>{pr.author}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pr.ci_status && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: pr.ci_status === 'success' ? '#10b981' : pr.ci_status === 'failure' ? '#ef4444' : '#f59e0b' }} />
          )}
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)' }}>{timeAgo(pr.updated_at)}</span>
        </div>
      </div>
    </motion.div>
  );
}
