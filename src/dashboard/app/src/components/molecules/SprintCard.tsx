import type { Sprint } from '@/types';

interface SprintCardProps {
  sprint: Sprint;
  selected: boolean;
  onClick: (id: number) => void;
}

const statusColor: Record<string, string> = {
  active: 'var(--accent)',
  closed: 'var(--text3)',
  planned: 'var(--blue)',
};

export function SprintCard({ sprint, selected, onClick }: SprintCardProps) {
  const pct =
    sprint.ticket_count > 0
      ? Math.round((sprint.done_count / sprint.ticket_count) * 100)
      : 0;

  const color = statusColor[sprint.status] ?? 'var(--text3)';

  return (
    <div
      onClick={() => onClick(sprint.id)}
      style={{
        padding: '12px 14px',
        background: selected ? 'var(--surface2)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        marginBottom: 6,
        transition: 'all .2s',
        borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {sprint.name}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          fontSize: 11,
          color: 'var(--text3)',
          marginBottom: 6,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color, fontWeight: 700, textTransform: 'uppercase' }}>
          {sprint.status}
        </span>
        <span>
          {sprint.done_count}/{sprint.ticket_count} tickets
        </span>
        <span>
          {sprint.velocity_completed ?? 0}/{sprint.velocity_committed ?? 0} pts
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 3,
          background: 'var(--border)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--accent)',
            transition: 'width .3s',
          }}
        />
      </div>
    </div>
  );
}
