import React, { useState } from 'react';
import { useFiles } from '@/hooks/useFiles';
import { useFileStore } from '@/stores/fileStore';
import { useUIStore } from '@/stores/uiStore';
import { FileTree } from '@/components/organisms/FileTree';
import { DependencyGraph } from '@/components/organisms/DependencyGraph';
import { SearchBar } from '@/components/molecules/SearchBar';
import { TabBar } from '@/components/molecules/TabBar';
import { StatGroup } from '@/components/molecules/StatGroup';
import { Badge } from '@/components/atoms/Badge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { fmtSize, langColors } from '@/lib/utils';

// ─── Tab definitions ──────────────────────────────────────────────────────────
const EXPLORER_TABS = [
  { id: 'detail', label: 'Detail' },
  { id: 'changes', label: 'Changes' },
  { id: 'graph', label: 'Graph' },
];

// ─── Badge variant mapping ────────────────────────────────────────────────────
function symbolVariant(kind: string): 'fn' | 'type' | 'const' | 'class' | 'interface' | 'pkg' | 'default' {
  const map: Record<string, 'fn' | 'type' | 'const' | 'class' | 'interface' | 'pkg'> = {
    function: 'fn',
    type: 'type',
    enum: 'type',
    const: 'const',
    class: 'class',
    interface: 'interface',
  };
  return map[kind] ?? 'pkg';
}

// ─── Detail tab ───────────────────────────────────────────────────────────────
function DetailTab() {
  const fileDetail = useFileStore((s) => s.fileDetail);
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const selectFile = useFileStore((s) => s.selectFile);
  const loadingDetail = useFileStore((s) => s.loading.detail);

  if (!selectedFileId && !fileDetail) {
    return (
      <div className="empty" style={{ padding: '64px 40px', textAlign: 'center', color: 'var(--text3)' }}>
        <div className="empty-icon" style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>📄</div>
        <div>Select a file to view details</div>
      </div>
    );
  }

  if (loadingDetail) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" />
        <Skeleton count={3} />
      </div>
    );
  }

  if (!fileDetail) return null;

  const d = fileDetail;
  const exportedSymbols = d.symbols.filter((s) => s.exported);
  const allSymbols = d.symbols;

  return (
    <div>
      {/* Title / meta */}
      <div className="detail-section">
        <div className="detail-title">{d.path}</div>
        <div className="detail-meta" style={{ marginTop: 8 }}>
          <span>{d.language}</span>
          {' · '}
          <span>{d.symbols.length} symbols</span>
          {' · '}
          <span style={{ fontFamily: 'var(--mono)' }}>{fmtSize(0)}</span>
        </div>
        {d.description && (
          <div className="detail-desc">{d.description}</div>
        )}
      </div>

      {/* Exports */}
      {exportedSymbols.length > 0 && (
        <div className="detail-section">
          <h3>Exports ({exportedSymbols.length})</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {exportedSymbols.map((sym, i) => (
              <Badge key={i} text={sym.name} variant={symbolVariant(sym.type)} />
            ))}
          </div>
        </div>
      )}

      {/* All symbols */}
      {allSymbols.length > 0 && exportedSymbols.length !== allSymbols.length && (
        <div className="detail-section">
          <h3>Symbols ({allSymbols.length})</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {allSymbols.map((sym, i) => (
              <Badge key={i} text={sym.name} variant={symbolVariant(sym.type)} />
            ))}
          </div>
        </div>
      )}

      {/* Imports */}
      {d.imports.length > 0 && (
        <div className="detail-section">
          <h3>Imports ({d.imports.length})</h3>
          {d.imports.map((imp, i) => {
            const short = imp.split('/').slice(-2).join('/');
            return (
              <div key={i} className="dep-item">
                <div className="dep-path">{short}</div>
                <div className="dep-symbols">{imp}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exports as string list (file-level) */}
      {d.exports.length > 0 && (
        <div className="detail-section">
          <h3>Re-exports ({d.exports.length})</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {d.exports.map((exp, i) => (
              <Badge key={i} text={exp} variant="pkg" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Changes tab ──────────────────────────────────────────────────────────────
function ChangesTab() {
  const fileChanges = useFileStore((s) => s.fileChanges);
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const loadingChanges = useFileStore((s) => s.loading.changes);

  if (!selectedFileId) {
    return (
      <div className="empty" style={{ padding: '64px 40px', textAlign: 'center', color: 'var(--text3)' }}>
        <div className="empty-icon" style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>🕐</div>
        <div>Select a file to view its change history</div>
      </div>
    );
  }

  if (loadingChanges) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <Skeleton count={4} />
      </div>
    );
  }

  if (!fileChanges.length) {
    return (
      <div className="empty" style={{ padding: '48px 40px', textAlign: 'center', color: 'var(--text3)' }}>
        <div className="empty-icon" style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>📋</div>
        <div>No changes recorded</div>
      </div>
    );
  }

  return (
    <div>
      {fileChanges.map((change) => {
        const date = new Date(change.timestamp);
        const dateStr = isNaN(date.getTime())
          ? change.timestamp
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = isNaN(date.getTime())
          ? ''
          : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return (
          <div key={change.id} className="change-item">
            <div className="change-header">
              <span
                className="change-event change"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: 'var(--blue-glow)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,.15)',
                }}
              >
                change
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                {dateStr} {timeStr}
              </span>
              {(change.linesAdded > 0 || change.linesRemoved > 0) && (
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: 11, fontFamily: 'var(--mono)' }}>
                  {change.linesAdded > 0 && (
                    <span style={{ color: 'var(--green)' }}>+{change.linesAdded}</span>
                  )}
                  {change.linesRemoved > 0 && (
                    <span style={{ color: 'var(--red)' }}>-{change.linesRemoved}</span>
                  )}
                </span>
              )}
            </div>
            {change.summary && (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                {change.summary}
              </div>
            )}
            {change.reason && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                {change.reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function CodeExplorer() {
  useFiles();

  const stats = useFileStore((s) => s.stats);
  const files = useFileStore((s) => s.files);
  const fetchStats = useFileStore((s) => s.fetchStats);

  // Fetch stats once files load
  React.useEffect(() => {
    if (files.length > 0 && !stats) fetchStats();
  }, [files.length, stats, fetchStats]);

  const activeTab = useUIStore((s) => s.activeTab);
  const setTab = useUIStore((s) => s.setTab);

  // Default to 'detail' tab on explorer page
  const explorerTab = ['detail', 'changes', 'graph'].includes(activeTab) ? activeTab : 'detail';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar with stats + search */}
      <div
        className="topbar"
        style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}
      >
        <div className="logo" style={{ flexShrink: 0 }}>
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="logo-text">
            Code Context <span className="logo-sub">Explorer</span>
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '0 12px',
            height: 36,
            maxWidth: 360,
          }}
        >
          <SearchBar />
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <StatGroup stats={stats} />
        </div>

        <span
          title="Live"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 6px var(--accent)',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Body: sidebar + main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar */}
        <div
          className="sidebar"
          style={{
            width: 300,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            overflow: 'hidden',
          }}
        >
          <div className="sidebar-head" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Files</span>
            <span
              className="count"
              style={{
                fontSize: 10,
                color: 'var(--text3)',
                background: 'var(--surface3)',
                padding: '2px 7px',
                borderRadius: 6,
                fontFamily: 'var(--mono)',
                fontWeight: 500,
              }}
            >
              {files.length}
            </span>
          </div>
          <div className="sidebar-body" style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', minHeight: 0 }}>
            <FileTree />
          </div>
        </div>

        {/* Main panel */}
        <div
          className="main"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg)',
            minWidth: 0,
          }}
        >
          <TabBar
            tabs={EXPLORER_TABS}
            activeTab={explorerTab}
            onTabChange={setTab}
          />

          <div style={{ flex: 1, overflowY: explorerTab === 'graph' ? 'hidden' : 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {explorerTab === 'detail' && <DetailTab />}
            {explorerTab === 'changes' && <ChangesTab />}
            {explorerTab === 'graph' && <DependencyGraph />}
          </div>
        </div>
      </div>
    </div>
  );
}
