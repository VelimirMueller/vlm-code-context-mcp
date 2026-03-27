'use client';

import { useState } from 'react';
import { useSprintStore } from '@/stores/sprintStore';
import { KanbanBoard } from './KanbanBoard';
import { SprintCompletionPanel } from './SprintCompletionPanel';
import type { RetroFinding } from '@/types';

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

      {/* Planning Summary */}
      <div
        style={{
          marginTop: 16,
          padding: '14px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
          Sprint Planning
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 2 }}>Committed</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)' }}>{sprintDetail.velocity_committed}sp</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 2 }}>Completed</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{donePts}sp</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 2 }}>Team</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)' }}>
              {new Set(tickets.map(t => t.assigned_to).filter(Boolean)).size} members
            </div>
          </div>
        </div>
        {(sprintDetail.start_date || sprintDetail.end_date) && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {sprintDetail.start_date ?? '?'} → {sprintDetail.end_date ?? '?'}
          </div>
        )}
      </div>

      {/* Sprint Completion Panel */}
      <SprintCompletionPanel sprint={sprintDetail} />

      {/* Retro Findings */}
      <RetroInline />
    </div>
  );
}

function RetroInline() {
  const findings = useSprintStore((s) => s.selectedRetroFindings);
  const [expanded, setExpanded] = useState(false);

  if (findings.length === 0) return null;

  const well = findings.filter((f: RetroFinding) => f.category === 'went_well');
  const wrong = findings.filter((f: RetroFinding) => f.category === 'went_wrong');
  const tryNext = findings.filter((f: RetroFinding) => f.category === 'try_next');

  const categories = [
    { items: well, label: 'Went Well', color: 'var(--accent)', icon: '✓' },
    { items: wrong, label: 'Went Wrong', color: 'var(--red)', icon: '✗' },
    { items: tryNext, label: 'Try Next', color: 'var(--purple)', icon: '→' },
  ];

  return (
    <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', fontFamily: 'var(--font)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Retro Findings</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{findings.length} findings</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>▶</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {categories.map(({ items, label, color, icon }) => items.length > 0 && (
            <div key={label}>
              <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{icon}</span> {label} ({items.length})
              </div>
              {items.map((f: RetroFinding, i: number) => (
                <div key={f.id ?? i} style={{ padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text2)', marginBottom: 4, borderLeft: `3px solid ${color}` }}>
                  {f.finding}
                  {f.action_owner && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>— {f.action_owner}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
