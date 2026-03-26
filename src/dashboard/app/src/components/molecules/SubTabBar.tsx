interface Tab {
  key: string;
  label: string;
}

interface SubTabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function SubTabBar({ tabs, active, onChange }: SubTabBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '12px 20px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent)' : 'var(--text3)',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              fontFamily: 'var(--font)',
              transition: 'all .2s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
