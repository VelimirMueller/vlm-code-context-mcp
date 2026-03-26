import React from 'react';
import { useFileStore } from '@/stores/fileStore';
import { SearchBar } from '@/components/molecules/SearchBar';
import { StatGroup } from '@/components/molecules/StatGroup';

export function Topbar() {
  const stats = useFileStore((s) => s.stats);

  return (
    <div
      className="topbar"
      style={{ display: 'flex', alignItems: 'center', gap: 20 }}
    >
      <div className="logo" style={{ flexShrink: 0 }}>
        <div className="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="logo-text">
          Code Context <span className="logo-sub">MCP</span>
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
        className="live-dot"
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
  );
}
