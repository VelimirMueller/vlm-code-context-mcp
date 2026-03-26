import { useState } from 'react';

const pages = ['explorer', 'planning', 'sprint'] as const;
type Page = typeof pages[number];

const pageLabels: Record<Page, string> = {
  explorer: 'Code Explorer',
  planning: 'Project Management',
  sprint: 'Sprint',
};

export function App() {
  const [activePage, setActivePage] = useState<Page>('explorer');

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <span className="logo-text">Code Context <span className="logo-sub">Explorer</span></span>
        </div>
      </header>
      <nav className="page-nav">
        {pages.map(p => (
          <button
            key={p}
            className={`page-nav-item ${activePage === p ? 'active' : ''}`}
            onClick={() => setActivePage(p)}
          >
            {pageLabels[p]}
          </button>
        ))}
      </nav>
      <main className="page-content">
        <div style={{ padding: 40, color: 'var(--text2)', fontSize: 16 }}>
          {pageLabels[activePage]} — React scaffold ready
        </div>
      </main>
    </div>
  );
}
