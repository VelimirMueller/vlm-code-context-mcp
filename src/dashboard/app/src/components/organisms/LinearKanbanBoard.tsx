import { useEffect, useCallback, useState, useRef } from 'react';
import { useLinearStore } from '@/stores/linearStore';
import { LinearKanbanCard } from '@/components/molecules/LinearKanbanCard';
import type { KanbanColumn, NormalizedLinearIssue } from '@/types';

interface ColConfig {
  label: string;
  color: string;
}

const COLUMNS: Record<KanbanColumn, ColConfig> = {
  TODO: { label: 'To Do', color: '#6b7280' },
  IN_PROGRESS: { label: 'In Progress', color: 'var(--blue)' },
  DONE: { label: 'Done', color: 'var(--accent)' },
  NOT_DONE: { label: 'Not Done', color: 'var(--red)' },
};

const COLUMN_ORDER: KanbanColumn[] = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'];

export function LinearKanbanBoard() {
  const fetchIssues = useLinearStore((s) => s.fetchIssues);
  const fetchStates = useLinearStore((s) => s.fetchStates);
  const fetchSyncStatus = useLinearStore((s) => s.fetchSyncStatus);
  const moveIssue = useLinearStore((s) => s.moveIssue);
  const syncStatus = useLinearStore((s) => s.syncStatus);
  const loading = useLinearStore((s) => s.loading);
  const error = useLinearStore((s) => s.error);
  const getIssuesByColumn = useLinearStore((s) => s.getIssuesByColumn);
  const getProjects = useLinearStore((s) => s.getProjects);
  const getColumnCounts = useLinearStore((s) => s.getColumnCounts);
  const filterProject = useLinearStore((s) => s.filterProject);
  const setFilterProject = useLinearStore((s) => s.setFilterProject);

  const [dragIssueId, setDragIssueId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanColumn | null>(null);
  const issuesByColumn = getIssuesByColumn();
  const projects = getProjects();
  const counts = getColumnCounts();

  useEffect(() => {
    fetchSyncStatus();
    fetchStates();
    fetchIssues();
  }, [fetchIssues, fetchStates, fetchSyncStatus]);

  // ─── Drag & drop ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((issueId: string) => (e: React.DragEvent) => {
    setDragIssueId(issueId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', issueId);
  }, []);

  const handleDragOver = useCallback((col: KanbanColumn) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(col);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((col: KanbanColumn) => (e: React.DragEvent) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    setDragIssueId(null);
    if (issueId) moveIssue(issueId, col);
  }, [moveIssue]);

  const totalIssues = Object.values(counts).reduce((s, n) => s + n, 0);

  if (!syncStatus?.synced && !loading.issues) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No Linear data synced</div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          Ask Claude to <code style={{ fontFamily: 'var(--mono)', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>sync linear</code> to fetch issues from your Linear workspace.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Sync bar + filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Project filter */}
          {projects.length > 0 && (
            <select
              value={filterProject ?? ''}
              onChange={(e) => setFilterProject(e.target.value || null)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '5px 10px',
                fontSize: 11.5,
                color: 'var(--text)',
                fontFamily: 'var(--font)',
                cursor: 'pointer',
              }}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}

          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sync status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)' }}>
          {loading.issues && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', animation: 'pulse 1s ease-in-out infinite' }} />
              Loading…
            </span>
          )}
          {syncStatus?.syncedAt && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
              Synced {new Date(syncStatus.syncedAt + 'Z').toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, fontSize: 12, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.8fr', gap: 12, flex: 1, minHeight: 0 }}>
        {COLUMN_ORDER.map((col) => {
          const cfg = COLUMNS[col];
          const colIssues = issuesByColumn[col];
          const isTarget = dropTarget === col;

          return (
            <div
              key={col}
              onDragOver={handleDragOver(col)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(col)}
              style={{
                background: isTarget ? 'rgba(16,185,129,.06)' : 'var(--bg)',
                border: `1px solid ${isTarget ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 200,
                transition: 'border-color .15s, background .15s',
              }}
            >
              {/* Column header */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{cfg.label}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                  {colIssues.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ padding: 8, overflowY: 'auto', flex: 1 }}>
                {colIssues.map((issue) => (
                  <LinearKanbanCard
                    key={issue.id}
                    issue={issue}
                    onDragStart={handleDragStart(issue.id)}
                    onClick={issue.url ? () => window.open(issue.url!, '_blank') : undefined}
                  />
                ))}
                {colIssues.length === 0 && (
                  <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
