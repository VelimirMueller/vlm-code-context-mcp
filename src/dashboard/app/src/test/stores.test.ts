import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── uiStore ───────────────────────────────────────────────────────────

describe('uiStore', () => {
  let useUIStore: typeof import('@/stores/uiStore').useUIStore;

  beforeEach(async () => {
    const mod = await import('@/stores/uiStore');
    useUIStore = mod.useUIStore;
    useUIStore.setState({
      activePage: 'dashboard',
      activeTab: 'board',
      activeSubTab: null,
      sidebarCollapsed: false,
      searchQuery: '',
      quickFilter: 'all',
      userRole: 'developer',
    });
  });

  it('setPage updates page and default tab', () => {
    useUIStore.getState().setPage('code');
    expect(useUIStore.getState().activePage).toBe('code');
    expect(useUIStore.getState().activeTab).toBe('files');
  });

  it('setPage resets sub-tab', () => {
    useUIStore.setState({ activeSubTab: 'something' });
    useUIStore.getState().setPage('team');
    expect(useUIStore.getState().activeSubTab).toBeNull();
  });

  it('setTab updates tab and breadcrumb', () => {
    useUIStore.getState().setTab('overview');
    expect(useUIStore.getState().activeTab).toBe('overview');
    const trail = useUIStore.getState().breadcrumbTrail;
    expect(trail.length).toBeGreaterThanOrEqual(2);
    expect(trail[1].label).toBe('Overview');
  });

  it('toggleSidebar flips state', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('toggleFolder adds and removes paths', () => {
    useUIStore.getState().toggleFolder('src/lib');
    expect(useUIStore.getState().expandedFolders.has('src/lib')).toBe(true);
    useUIStore.getState().toggleFolder('src/lib');
    expect(useUIStore.getState().expandedFolders.has('src/lib')).toBe(false);
  });

  it('expandFolderPath expands all ancestors', () => {
    useUIStore.getState().expandFolderPath('src/lib/utils.ts');
    const folders = useUIStore.getState().expandedFolders;
    expect(folders.has('src')).toBe(true);
    expect(folders.has('src/lib')).toBe(true);
  });

  it('getDefaultPageForRole returns correct defaults', () => {
    expect(useUIStore.getState().getDefaultPageForRole('developer')).toBe('dashboard');
    expect(useUIStore.getState().getDefaultPageForRole('tech-lead')).toBe('planning');
    expect(useUIStore.getState().getDefaultPageForRole('designer')).toBe('team');
  });

  it('setQuickFilter updates filter', () => {
    useUIStore.getState().setQuickFilter('blocked');
    expect(useUIStore.getState().quickFilter).toBe('blocked');
  });
});

// ─── sprintStore selectors ─────────────────────────────────────────────

describe('sprintStore', () => {
  let useSprintStore: typeof import('@/stores/sprintStore').useSprintStore;

  beforeEach(async () => {
    const mod = await import('@/stores/sprintStore');
    useSprintStore = mod.useSprintStore;
    mockFetch.mockReset();
  });

  it('initial state has empty arrays', () => {
    expect(useSprintStore.getState().sprints).toEqual([]);
    expect(useSprintStore.getState().tickets).toEqual([]);
  });

  it('setTicketFilter updates filter', () => {
    useSprintStore.getState().setTicketFilter('blocked');
    expect(useSprintStore.getState().ticketFilter).toBe('blocked');
  });

  it('getFilteredTickets returns all when filter is all', () => {
    useSprintStore.setState({
      tickets: [
        { id: 1, ticket_ref: 'T-1', title: 'A', description: null, priority: 'P1', status: 'TODO', assigned_to: null, story_points: 3, milestone: null, qa_verified: 0, verified_by: null, acceptance_criteria: null, notes: null },
      ] as any[],
      ticketFilter: 'all',
    });
    expect(useSprintStore.getState().getFilteredTickets()).toHaveLength(1);
  });

  it('getFilteredTickets filters blocked tickets', () => {
    useSprintStore.setState({
      tickets: [
        { id: 1, status: 'BLOCKED', assigned_to: 'dev' },
        { id: 2, status: 'TODO', assigned_to: 'dev' },
      ] as any[],
      ticketFilter: 'blocked',
    });
    const filtered = useSprintStore.getState().getFilteredTickets();
    expect(filtered.every(t => t.status === 'BLOCKED')).toBe(true);
  });
});

// meStore was removed in Sprint 63 (Linear tab consolidation).
// Linear data is now managed by linearStore — see linear-kanban.test.tsx.

// ─── agentStore ────────────────────────────────────────────────────────

describe('agentStore', () => {
  let useAgentStore: typeof import('@/stores/agentStore').useAgentStore;

  beforeEach(async () => {
    const mod = await import('@/stores/agentStore');
    useAgentStore = mod.useAgentStore;
    useAgentStore.setState({ agents: [], loading: false });
    mockFetch.mockReset();
  });

  it('initial state is empty', () => {
    expect(useAgentStore.getState().agents).toEqual([]);
    expect(useAgentStore.getState().loading).toBe(false);
  });

  it('fetchAgents sets loading and populates agents', async () => {
    const agents = [{ role: 'dev', name: 'Dev', description: 'Backend', model: 'claude' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => agents });

    await useAgentStore.getState().fetchAgents();
    expect(useAgentStore.getState().agents).toEqual(agents);
    expect(useAgentStore.getState().loading).toBe(false);
  });
});

// ─── planningStore ─────────────────────────────────────────────────────

describe('planningStore', () => {
  let usePlanningStore: typeof import('@/stores/planningStore').usePlanningStore;

  beforeEach(async () => {
    const mod = await import('@/stores/planningStore');
    usePlanningStore = mod.usePlanningStore;
    usePlanningStore.setState({
      milestones: [],
      vision: null,
      ganttData: [],
      backlog: [],
      loading: { milestones: false, vision: false, gantt: false, backlog: false },
    });
    mockFetch.mockReset();
  });

  it('initial state has empty arrays', () => {
    expect(usePlanningStore.getState().milestones).toEqual([]);
    expect(usePlanningStore.getState().vision).toBeNull();
  });

  it('fetchMilestones populates milestones', async () => {
    const milestones = [{ id: 1, name: 'M1', description: 'Milestone 1', status: 'active', target_date: null, progress: 50, ticket_count: 10, done_count: 5 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => milestones });

    await usePlanningStore.getState().fetchMilestones();
    expect(usePlanningStore.getState().milestones).toEqual(milestones);
    expect(usePlanningStore.getState().loading.milestones).toBe(false);
  });

  it('fetchVision sets vision string', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ content: '# Vision\nBe great.' }) });

    await usePlanningStore.getState().fetchVision();
    expect(usePlanningStore.getState().vision).toBe('# Vision\nBe great.');
  });
});
