'use client';

interface TopNavProps {
  activeTab: 'dashboard' | 'code' | 'planning' | 'team' | 'retro';
  onTabChange: (tab: string) => void;
  badgeCounts?: {
    myTickets?: number;
    blockers?: number;
    qaPending?: number;
  };
}

interface NavItem {
  id: 'dashboard' | 'code' | 'planning' | 'team' | 'retro';
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'code', label: 'Code', icon: '📁' },
  { id: 'planning', label: 'Planning', icon: '🎯' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'retro', label: 'Retro', icon: '⚡' },
];

export function TopNav({ activeTab, onTabChange, badgeCounts }: TopNavProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, tab: string) => {
    const currentIndex = navItems.findIndex((item) => item.id === activeTab);
    let newIndex = currentIndex;

    if (e.key === 'ArrowLeft') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : navItems.length - 1;
    } else if (e.key === 'ArrowRight') {
      newIndex = currentIndex < navItems.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = navItems.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    onTabChange(navItems[newIndex].id);
  };

  return (
    <nav
      className="top-nav"
      role="tablist"
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`top-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, item.id)}
            role="tab"
            aria-selected={isActive}
            aria-label={`${item.label} ${isActive ? '(current page)' : ''}`}
            tabIndex={isActive ? 0 : -1}
          >
            <span className="top-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="top-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
