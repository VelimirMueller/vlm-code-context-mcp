import { useSprintStore } from '@/stores/sprintStore';
import { KanbanBoard } from './KanbanBoard';

export function SprintDetail() {
  const sprintDetail = useSprintStore((s) => s.sprintDetail);
  const tickets = useSprintStore((s) => s.tickets);
  const loading = useSprintStore((s) => s.loading.detail);
  const selectedSprintId = useSprintStore((s) => s.selectedSprintId);

  if (!selectedSprintId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text3)',
          fontSize: 14,
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 32 }}>☰</div>
        Select a sprint from the list
      </div>
    );
  }

  if (loading && !sprintDetail) {
    return (
      <div style={{ flex: 1, padding: 20 }}>
        <div
          style={{
            height: 24,
            width: '50%',
            background: 'var(--surface2)',
            borderRadius: 6,
            marginBottom: 12,
          }}
        />
        <div
          style={{
            height: 16,
            width: '80%',
            background: 'var(--surface2)',
            borderRadius: 6,
          }}
        />
      </div>
    );
  }

  if (!sprintDetail) return null;

  const totalPts = tickets.reduce((s, t) => s + (t.story_points ?? 0), 0);
  const donePts = tickets
    .filter((t) => t.status === 'DONE')
    .reduce((s, t) => s + (t.story_points ?? 0), 0);
  const velPct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;

  const countByStatus = (status: string) => tickets.filter((t) => t.status === status).length;
  const doneRatio =
    tickets.length > 0
      ? tickets.filter((t) => t.status === 'DONE').length / tickets.length
      : 0;

  const statusColor =
    sprintDetail.status === 'active'
      ? 'var(--accent)'
      : sprintDetail.status === 'closed'
        ? '#6b7280'
        : 'var(--blue)';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
      {/* Sprint header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          {sprintDetail.name}
        </div>
        <div
          style={{
            padding: '3px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            background: statusColor,
            color: 'white',
          }}
        >
          {sprintDetail.status}
        </div>
      </div>

      {/* Sprint goal */}
      {sprintDetail.goal && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg)',
            borderRadius: 8,
            borderLeft: '3px solid var(--accent)',
            fontSize: 13,
            color: 'var(--text2)',
            marginBottom: 16,
          }}
        >
          {sprintDetail.goal}
        </div>
      )}

      {/* Metrics row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* Velocity */}
        <div
          style={{
            padding: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--text3)',
              fontWeight: 600,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Velocity
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {donePts}/{totalPts}
          </div>
          <div
            style={{
              height: 4,
              background: 'var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
              marginTop: 6,
            }}
          >
            <div
              style={{ height: '100%', width: `${velPct}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* Status counts */}
        {(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const).map((status) => {
          const labels: Record<string, string> = {
            TODO: 'TODO',
            IN_PROGRESS: 'PROGRESS',
            DONE: 'DONE',
            BLOCKED: 'BLOCKED',
          };
          const colors: Record<string, string> = {
            TODO: 'var(--text3)',
            IN_PROGRESS: 'var(--blue)',
            DONE: 'var(--accent)',
            BLOCKED: 'var(--red)',
          };
          return (
            <div
              key={status}
              style={{
                padding: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: colors[status],
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {labels[status]}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{countByStatus(status)}</div>
            </div>
          );
        })}
      </div>

      {/* Burndown bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
          padding: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--text3)',
            fontWeight: 600,
            width: 80,
            flexShrink: 0,
          }}
        >
          Burndown
        </div>
        <div
          style={{
            flex: 1,
            height: 6,
            background: 'var(--border)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.round(doneRatio * 100)}%`,
              background: 'var(--accent)',
              transition: 'width .3s',
            }}
          />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
          {Math.round(doneRatio * 100)}%
        </div>
      </div>

      {/* Kanban board */}
      <KanbanBoard tickets={tickets} />
    </div>
  );
}
