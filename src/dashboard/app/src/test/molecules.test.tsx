import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: { div: (p: any) => <div {...filterDom(p)} />, span: (p: any) => <span {...filterDom(p)} /> },
  useReducedMotion: () => true,
}));

function filterDom(props: Record<string, any>) {
  const skip = ['whileHover', 'layout', 'variants', 'initial', 'animate', 'exit', 'transition'];
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(props)) { if (!skip.includes(k)) clean[k] = v; }
  return clean;
}

// ─── SubTabBar ─────────────────────────────────────────────────────────

describe('SubTabBar', () => {
  const tabs = [
    { key: 'board', label: 'Board' },
    { key: 'overview', label: 'Overview' },
    { key: 'me', label: 'My Work' },
  ];

  it('renders all tab labels', async () => {
    const { SubTabBar } = await import('@/components/molecules/SubTabBar');
    render(<SubTabBar tabs={tabs} active="board" onChange={() => {}} />);
    expect(screen.getByText('Board')).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('My Work')).toBeDefined();
  });

  it('calls onChange on click', async () => {
    const { SubTabBar } = await import('@/components/molecules/SubTabBar');
    const onChange = vi.fn();
    render(<SubTabBar tabs={tabs} active="board" onChange={onChange} />);
    fireEvent.click(screen.getByText('Overview'));
    expect(onChange).toHaveBeenCalledWith('overview');
  });

  it('marks active tab with aria-selected', async () => {
    const { SubTabBar } = await import('@/components/molecules/SubTabBar');
    render(<SubTabBar tabs={tabs} active="overview" onChange={() => {}} />);
    const overviewBtn = screen.getByText('Overview');
    expect(overviewBtn.getAttribute('aria-selected')).toBe('true');
    const boardBtn = screen.getByText('Board');
    expect(boardBtn.getAttribute('aria-selected')).toBe('false');
  });

  it('has role=tablist on container', async () => {
    const { SubTabBar } = await import('@/components/molecules/SubTabBar');
    render(<SubTabBar tabs={tabs} active="board" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeDefined();
  });
});

// ─── Breadcrumb ────────────────────────────────────────────────────────

describe('Breadcrumb', () => {
  it('renders all items', async () => {
    const { Breadcrumb } = await import('@/components/molecules/Breadcrumb');
    render(<Breadcrumb items={[{ label: 'Dashboard' }, { label: 'Board' }]} />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Board')).toBeDefined();
  });

  it('renders separator between items', async () => {
    const { Breadcrumb } = await import('@/components/molecules/Breadcrumb');
    const { container } = render(<Breadcrumb items={[{ label: 'A' }, { label: 'B' }]} />);
    const separators = container.querySelectorAll('.breadcrumb-separator');
    expect(separators.length).toBe(1);
  });

  it('renders link when path provided', async () => {
    const { Breadcrumb } = await import('@/components/molecules/Breadcrumb');
    render(<Breadcrumb items={[{ label: 'Home', path: '/home' }]} />);
    const link = screen.getByText('Home');
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link.getAttribute('href')).toBe('/home');
  });

  it('renders span (not link) for items without path', async () => {
    const { Breadcrumb } = await import('@/components/molecules/Breadcrumb');
    render(<Breadcrumb items={[{ label: 'Current' }]} />);
    const span = screen.getByText('Current');
    expect(span.tagName.toLowerCase()).toBe('span');
    expect(span.getAttribute('aria-current')).toBe('page');
  });

  it('has aria-label on nav', async () => {
    const { Breadcrumb } = await import('@/components/molecules/Breadcrumb');
    render(<Breadcrumb items={[{ label: 'X' }]} />);
    expect(screen.getByLabelText('Breadcrumb navigation')).toBeDefined();
  });
});

// ─── TopNav ────────────────────────────────────────────────────────────

describe('TopNav', () => {
  it('renders all nav items', async () => {
    const { TopNav } = await import('@/components/molecules/TopNav');
    render(<TopNav activeTab="dashboard" onTabChange={() => {}} />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Code')).toBeDefined();
    expect(screen.getByText('Team')).toBeDefined();
  });

  it('calls onTabChange when clicking a tab', async () => {
    const { TopNav } = await import('@/components/molecules/TopNav');
    const onChange = vi.fn();
    render(<TopNav activeTab="dashboard" onTabChange={onChange} />);
    fireEvent.click(screen.getByText('Code'));
    expect(onChange).toHaveBeenCalledWith('code');
  });

  it('marks active tab with aria-selected', async () => {
    const { TopNav } = await import('@/components/molecules/TopNav');
    render(<TopNav activeTab="team" onTabChange={() => {}} />);
    const teamBtn = screen.getByText('Team').closest('button');
    expect(teamBtn?.getAttribute('aria-selected')).toBe('true');
  });
});
