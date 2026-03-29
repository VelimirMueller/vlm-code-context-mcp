import type { GithubCommit } from '@/types';

interface Props {
  commit: GithubCommit;
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

export function GithubCommitItem({ commit }: Props) {
  const firstLine = commit.message.split('\n')[0];
  const truncated = firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, marginBottom: 4,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)',
        flexShrink: 0, marginTop: 5,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{truncated}</div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
          <span>{commit.sha.slice(0, 7)}</span>
          <span>{commit.author}</span>
          <span>{commit.date ? timeAgo(commit.date) : ''}</span>
        </div>
      </div>
    </div>
  );
}
