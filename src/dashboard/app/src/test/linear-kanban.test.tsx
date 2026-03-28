import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLinearStore } from '@/stores/linearStore';
import type { NormalizedLinearIssue, KanbanColumn } from '@/types';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...filterDomProps(props)}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Filter non-DOM props from framer-motion
function filterDomProps(props: Record<string, any>) {
  const blocked = ['whileHover', 'layout', 'variants', 'initial', 'animate', 'exit', 'transition'];
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!blocked.includes(k)) clean[k] = v;
  }
  return clean;
}

// Mock fetch for store tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeIssue(overrides: Partial<NormalizedLinearIssue> = {}): NormalizedLinearIssue {
  return {
    id: 'i1',
    identifier: 'ENG-1',
    title: 'Test issue',
    description: null,
    state_id: 's1',
    priority: 2,
    priority_label: 'High',
    assignee_id: 'u1',
    assignee_name: 'Alice',
    project_name: 'Frontend',
    cycle_name: null,
    labels: ['bug', 'p0'],
    url: 'https://linear.app/issue/ENG-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
    state_name: 'In Progress',
    state_type: 'started',
    state_color: '#3b82f6',
    kanbanColumn: 'IN_PROGRESS',
    ...overrides,
  };
}

describe('LinearKanbanCard', () => {
  let LinearKanbanCard: typeof import('@/components/molecules/LinearKanbanCard').LinearKanbanCard;

  beforeEach(async () => {
    const mod = await import('@/components/molecules/LinearKanbanCard');
    LinearKanbanCard = mod.LinearKanbanCard;
  });

  it('renders issue identifier and title', () => {
    render(<LinearKanbanCard issue={makeIssue()} />);
    expect(screen.getByText('ENG-1')).toBeDefined();
    expect(screen.getByText('Test issue')).toBeDefined();
  });

  it('renders assignee name', () => {
    render(<LinearKanbanCard issue={makeIssue()} />);
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('renders dash when no assignee', () => {
    render(<LinearKanbanCard issue={makeIssue({ assignee_name: null })} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('renders labels (max 3 shown)', () => {
    render(<LinearKanbanCard issue={makeIssue({ labels: ['a', 'b', 'c', 'd'] })} />);
    expect(screen.getByText('a')).toBeDefined();
    expect(screen.getByText('b')).toBeDefined();
    expect(screen.getByText('c')).toBeDefined();
    expect(screen.getByText('+1')).toBeDefined();
  });

  it('renders project name when present', () => {
    render(<LinearKanbanCard issue={makeIssue({ project_name: 'Backend' })} />);
    expect(screen.getByText('Backend')).toBeDefined();
  });

  it('does not render project when null', () => {
    render(<LinearKanbanCard issue={makeIssue({ project_name: null })} />);
    expect(screen.queryByText('Frontend')).toBeNull();
  });

  it('renders priority badge', () => {
    render(<LinearKanbanCard issue={makeIssue({ priority_label: 'Urgent' })} />);
    expect(screen.getByText('Urgent')).toBeDefined();
  });
});

describe('linearStore', () => {
  beforeEach(() => {
    // Reset store state
    useLinearStore.setState({
      issues: [],
      states: [],
      syncStatus: null,
      loading: { issues: false, states: false, sync: false, move: null },
      error: null,
      filterProject: null,
      filterState: null,
    });
    mockFetch.mockReset();
  });

  it('getIssuesByColumn groups issues correctly', () => {
    useLinearStore.setState({
      issues: [
        makeIssue({ id: '1', kanbanColumn: 'TODO' }),
        makeIssue({ id: '2', kanbanColumn: 'IN_PROGRESS' }),
        makeIssue({ id: '3', kanbanColumn: 'IN_PROGRESS' }),
        makeIssue({ id: '4', kanbanColumn: 'DONE' }),
      ],
    });
    const grouped = useLinearStore.getState().getIssuesByColumn();
    expect(grouped.TODO).toHaveLength(1);
    expect(grouped.IN_PROGRESS).toHaveLength(2);
    expect(grouped.DONE).toHaveLength(1);
    expect(grouped.NOT_DONE).toHaveLength(0);
  });

  it('getIssuesByColumn respects project filter', () => {
    useLinearStore.setState({
      issues: [
        makeIssue({ id: '1', project_name: 'FE', kanbanColumn: 'TODO' }),
        makeIssue({ id: '2', project_name: 'BE', kanbanColumn: 'TODO' }),
      ],
      filterProject: 'FE',
    });
    const grouped = useLinearStore.getState().getIssuesByColumn();
    expect(grouped.TODO).toHaveLength(1);
    expect(grouped.TODO[0].id).toBe('1');
  });

  it('getProjects extracts unique project names', () => {
    useLinearStore.setState({
      issues: [
        makeIssue({ id: '1', project_name: 'Alpha' }),
        makeIssue({ id: '2', project_name: 'Beta' }),
        makeIssue({ id: '3', project_name: 'Alpha' }),
        makeIssue({ id: '4', project_name: null }),
      ],
    });
    const projects = useLinearStore.getState().getProjects();
    expect(projects).toEqual(['Alpha', 'Beta']);
  });

  it('getColumnCounts returns correct counts', () => {
    useLinearStore.setState({
      issues: [
        makeIssue({ id: '1', kanbanColumn: 'TODO' }),
        makeIssue({ id: '2', kanbanColumn: 'DONE' }),
        makeIssue({ id: '3', kanbanColumn: 'DONE' }),
      ],
    });
    const counts = useLinearStore.getState().getColumnCounts();
    expect(counts).toEqual({ TODO: 1, IN_PROGRESS: 0, DONE: 2, NOT_DONE: 0 });
  });

  it('moveIssue optimistically updates kanbanColumn', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    useLinearStore.setState({
      issues: [makeIssue({ id: 'i1', kanbanColumn: 'TODO' })],
    });

    await useLinearStore.getState().moveIssue('i1', 'IN_PROGRESS');

    const issues = useLinearStore.getState().issues;
    expect(issues[0].kanbanColumn).toBe('IN_PROGRESS');
  });

  it('setFilterProject updates filter', () => {
    useLinearStore.getState().setFilterProject('Core');
    expect(useLinearStore.getState().filterProject).toBe('Core');
    useLinearStore.getState().setFilterProject(null);
    expect(useLinearStore.getState().filterProject).toBeNull();
  });

  it('handles unknown kanbanColumn by defaulting to TODO', () => {
    useLinearStore.setState({
      issues: [makeIssue({ id: '1', kanbanColumn: 'UNKNOWN' as KanbanColumn })],
    });
    const grouped = useLinearStore.getState().getIssuesByColumn();
    expect(grouped.TODO).toHaveLength(1);
  });
});
