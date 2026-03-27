import React from 'react';

export type TicketFilter = 'all' | 'mine' | 'blocked' | 'qaPending' | 'unassigned';

interface QuickFiltersProps {
  onFilterChange: (filter: TicketFilter) => void;
  counts: {
    all: number;
    mine: number;
    blocked: number;
    qaPending: number;
  };
  activeFilter: TicketFilter;
  currentUserName?: string;
}

interface FilterButton {
  id: TicketFilter;
  label: string;
  count: number;
}

export function QuickFilters({
  onFilterChange,
  counts,
  activeFilter,
  currentUserName = 'Me',
}: QuickFiltersProps) {
  const filters: FilterButton[] = [
    { id: 'all', label: 'All Tickets', count: counts.all },
    { id: 'mine', label: currentUserName, count: counts.mine },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginRight: 8,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Filters:
      </span>
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        const buttonStyle: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 'var(--radius)',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s ease-out',
          border: '1px solid transparent',
          background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface)',
          color: isActive ? 'var(--accent)' : 'var(--text)',
          borderColor: isActive ? 'var(--accent)' : 'var(--border)',
        };

        const countStyle: React.CSSProperties = {
          background: 'var(--surface3)',
          color: 'var(--text3)',
          fontSize: 10,
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: 10,
          minWidth: 18,
          textAlign: 'center',
        };

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            style={buttonStyle}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--surface2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--surface)';
              }
            }}
            aria-label={`Show ${filter.label.toLowerCase()}`}
            aria-pressed={isActive}
          >
            <span>{filter.label}</span>
            <span style={countStyle}>{filter.count}</span>
          </button>
        );
      })}
    </div>
  );
}
