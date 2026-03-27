'use client';

import React from 'react';

interface TopNavProps {
  activeTab: 'me' | 'dashboard' | 'code' | 'planning' | 'team' | 'retro' | 'marketing';
  onTabChange: (tab: string) => void;
  badgeCounts?: {
    myTickets?: number;
    blockers?: number;
    qaPending?: number;
  };
}

interface NavItem {
  id: 'me' | 'dashboard' | 'code' | 'planning' | 'team' | 'retro' | 'marketing';
  label: string;
  icon: React.ReactNode;
}

// Clean SVG icons — no emoji rendering inconsistencies
const navItems: NavItem[] = [
  { id: 'me', label: 'Me', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2.5 14.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { id: 'dashboard', label: 'Dashboard', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id: 'code', label: 'Code', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: 'planning', label: 'Planning', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r=".75" fill="currentColor"/></svg> },
  { id: 'team', label: 'Team', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="11.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M12.5 14c0-1.5-.8-2.8-2-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
  { id: 'retro', label: 'Retro', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.5 5A6 6 0 1 1 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M3.5 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: 'marketing', label: 'Marketing', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 2L5 6H2.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5H5l8 4V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M5 6v4" stroke="currentColor" strokeWidth="1.5"/></svg> },
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
