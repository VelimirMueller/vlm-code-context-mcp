import { useUIStore } from '@/stores/uiStore';
import { useFileStore } from '@/stores/fileStore';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { useEventSource } from '@/hooks/useEventSource';
import { useHashRouter } from '@/hooks/useHashRouter';
import { useKeyboard } from '@/hooks/useKeyboard';
import { CodeExplorer } from '@/pages/CodeExplorer';
import { Sprint } from '@/pages/Sprint';
import { ProjectManagement } from '@/pages/ProjectManagement';

const pages = ['explorer', 'planning', 'sprint'] as const;
type Page = (typeof pages)[number];

const pageLabels: Record<Page, string> = {
  explorer: 'Code Explorer',
  planning: 'Project Management',
  sprint: 'Sprint',
};

export function App() {
  const activePage = useUIStore((s) => s.activePage);
  const setPage = useUIStore((s) => s.setPage);

  // SSE: refresh stores on server events
  const refreshFiles = useFileStore((s) => s.refresh);
  const fetchSprints = useSprintStore((s) => s.fetchSprints);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  useEventSource({
    onEvent: (e) => {
      if (e.type === 'file_changed') refreshFiles();
      if (e.type === 'sprint_updated' || e.type === 'ticket_updated') fetchSprints();
      if (e.type === 'agent_status') fetchAgents();
    },
  });

  // URL hash sync
  useHashRouter();

  // Keyboard shortcuts
  useKeyboard();

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
          <span className="logo-text">
            Code Context <span className="logo-sub">Explorer</span>
          </span>
        </div>
      </header>
      <nav className="page-nav">
        {pages.map((p) => (
          <button
            key={p}
            className={`page-nav-item ${activePage === p ? 'active' : ''}`}
            onClick={() => setPage(p)}
          >
            {pageLabels[p]}
          </button>
        ))}
      </nav>
      <main className="page-content">
        {activePage === 'explorer' && <CodeExplorer />}
        {activePage === 'planning' && <ProjectManagement />}
        {activePage === 'sprint' && <Sprint />}
      </main>
    </div>
  );
}
