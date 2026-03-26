import { useSprintStore } from '@/stores/sprintStore';
import { SprintCard } from '@/components/molecules/SprintCard';

export function SprintList() {
  const sprints = useSprintStore((s) => s.sprints);
  const selectedSprintId = useSprintStore((s) => s.selectedSprintId);
  const selectSprint = useSprintStore((s) => s.selectSprint);
  const loading = useSprintStore((s) => s.loading.sprints);

  if (loading && sprints.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 72,
              background: 'var(--surface2)',
              borderRadius: 'var(--radius)',
              marginBottom: 6,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--text3)',
          fontSize: 13,
        }}
      >
        No sprints found
      </div>
    );
  }

  return (
    <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
      {sprints.map((sprint) => (
        <SprintCard
          key={sprint.id}
          sprint={sprint}
          selected={sprint.id === selectedSprintId}
          onClick={selectSprint}
        />
      ))}
    </div>
  );
}
