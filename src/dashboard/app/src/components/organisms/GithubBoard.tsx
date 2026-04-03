import { useEffect, useState } from 'react';
import { useGithubStore } from '@/stores/githubStore';
import { GithubIssueCard } from '@/components/molecules/GithubIssueCard';
import { GithubPRCard } from '@/components/molecules/GithubPRCard';
import { GithubCommitItem } from '@/components/molecules/GithubCommitItem';
import { SyncButton } from '@/components/atoms/SyncButton';

type SubTab = 'issues' | 'prs' | 'commits';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'issues', label: 'Issues' },
  { key: 'prs', label: 'Pull Requests' },
  { key: 'commits', label: 'Commits' },
];

export function GithubBoard() {
  const [subTab, setSubTab] = useState<SubTab>('issues');
  const repos = useGithubStore((s) => s.repos);
  const issues = useGithubStore((s) => s.issues);
  const prs = useGithubStore((s) => s.prs);
  const commits = useGithubStore((s) => s.commits);
  const syncStatus = useGithubStore((s) => s.syncStatus);
  const loading = useGithubStore((s) => s.loading);
  const error = useGithubStore((s) => s.error);
  const selectedRepoId = useGithubStore((s) => s.selectedRepoId);
  const setSelectedRepo = useGithubStore((s) => s.setSelectedRepo);
  const fetchRepos = useGithubStore((s) => s.fetchRepos);
  const fetchSyncStatus = useGithubStore((s) => s.fetchSyncStatus);
  const fetchAll = useGithubStore((s) => s.fetchAll);
  const syncNow = useGithubStore((s) => s.syncNow);

  useEffect(() => {
    fetchRepos();
    fetchSyncStatus();
    fetchAll(selectedRepoId ?? undefined);
  }, [fetchRepos, fetchSyncStatus, fetchAll, selectedRepoId]);

  const openIssues = issues.filter((i) => i.state === 'open');
  const closedIssues = issues.filter((i) => i.state === 'closed');

  if (!syncStatus?.synced && !loading.issues) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🐙</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No GitHub data synced</div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          Ask Claude to <code style={{ fontFamily: 'var(--mono)', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>sync github data</code> to fetch issues, PRs, and commits.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Top bar: repo selector + sync status + sub-tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {repos.length > 1 && (
            <select
              value={selectedRepoId ?? ''}
              onChange={(e) => setSelectedRepo(e.target.value ? Number(e.target.value) : null)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
                padding: '5px 10px', fontSize: 11.5, color: 'var(--text)', fontFamily: 'var(--font)', cursor: 'pointer',
              }}
            >
              <option value="">All repos</option>
              {repos.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          )}
          {repos.length === 1 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{repos[0].full_name}</span>
          )}
          {/* Sub-tab switcher */}
          <div style={{ display: 'flex', gap: 2 }}>
            {SUB_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
                  background: subTab === t.key ? 'var(--surface2)' : 'transparent',
                  color: subTab === t.key ? 'var(--text)' : 'var(--text3)', cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <SyncButton
          onSync={syncNow}
          loading={loading.sync}
          lastSyncedAt={syncStatus?.syncedAt}
          label="Sync"
        />
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'issues' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Open column */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Open</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{openIssues.length}</span>
              </div>
              <div style={{ padding: 8, overflowY: 'auto' }}>
                {openIssues.map((i) => <GithubIssueCard key={i.id} issue={i} />)}
                {openIssues.length === 0 && <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>No open issues</div>}
              </div>
            </div>
            {/* Closed column */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Closed</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{closedIssues.length}</span>
              </div>
              <div style={{ padding: 8, overflowY: 'auto' }}>
                {closedIssues.map((i) => <GithubIssueCard key={i.id} issue={i} />)}
                {closedIssues.length === 0 && <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>No closed issues</div>}
              </div>
            </div>
          </div>
        )}

        {subTab === 'prs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prs.map((p) => <GithubPRCard key={p.id} pr={p} />)}
            {prs.length === 0 && <div style={{ padding: '40px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>No pull requests</div>}
          </div>
        )}

        {subTab === 'commits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {commits.map((c) => <GithubCommitItem key={c.sha} commit={c} />)}
            {commits.length === 0 && <div style={{ padding: '40px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>No commits</div>}
          </div>
        )}
      </div>
    </div>
  );
}
