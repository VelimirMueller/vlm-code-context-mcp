import React, { useMemo } from 'react';
import type { Sprint } from '@/types';
import { usePlanningStore } from '@/stores/planningStore';

const statusStyle: Record<string, { bg: string; border: string; label: string }> = {
  planning: { bg: 'rgba(99,99,122,.25)', border: 'rgba(99,99,122,.4)', label: 'Planning' },
  active:   { bg: 'rgba(16,185,129,.18)', border: 'rgba(16,185,129,.35)', label: 'Active' },
  review:   { bg: 'rgba(251,191,36,.18)', border: 'rgba(251,191,36,.35)', label: 'Review' },
  closed:   { bg: 'rgba(59,130,246,.18)', border: 'rgba(59,130,246,.35)', label: 'Closed' },
};

function getStatusStyle(status: string) {
  return statusStyle[status] ?? statusStyle.planning;
}

interface GanttBarProps {
  sprint: Sprint;
  index: number;
  totalBars: number;
}

function GanttBar({ sprint, index }: GanttBarProps) {
  const s = getStatusStyle(sprint.status);
  const done = sprint.velocity_completed ?? 0;
  const committed = sprint.velocity_committed ?? 0;
  const pct = committed > 0 ? Math.min(100, Math.round((done / committed) * 100)) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        alignItems: 'center',
        gap: 14,
        padding: '8px 0',
        borderBottom: index > 0 ? '1px solid var(--border)' : 'none',
      }}
    >
      {/* Label */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sprint.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 5,
              fontSize: 10,
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '1px 7px',
              color: 'var(--text2)',
            }}
          >
            {s.label}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
            {done}/{committed}pt
          </span>
        </div>
      </div>

      {/* Bar */}
      <div style={{ position: 'relative', height: 28 }}>
        {/* Track */}
        <div
          style={{
            position: 'absolute',
            inset: '6px 0',
            background: 'var(--surface3)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: s.bg,
              border: `none`,
              borderRadius: 4,
              transition: 'width .4s ease',
              boxShadow: `inset 0 0 0 1px ${s.border}`,
            }}
          />
        </div>
        {/* Percent label */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            fontSize: 11,
            fontFamily: 'var(--mono)',
            color: 'var(--text3)',
            paddingRight: 2,
          }}
        >
          {pct}%
        </div>
      </div>
    </div>
  );
}

function VelocityLegend({ sprints }: { sprints: Sprint[] }) {
  const maxVelocity = Math.max(...sprints.map((s) => s.velocity_committed ?? 0), 1);
  const ticks = [0, 25, 50, 75, 100].map((pct) => Math.round((pct / 100) * maxVelocity));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Sprint</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
        {ticks.map((t) => <span key={t}>{t}pt</span>)}
      </div>
    </div>
  );
}

export function GanttChart() {
  const ganttData = usePlanningStore((s) => s.ganttData);
  const loading = usePlanningStore((s) => s.loading.gantt);

  const sorted = useMemo(() => [...ganttData].reverse(), [ganttData]);

  if (loading && ganttData.length === 0) {
    return (
      <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 14 }}>
        Loading Gantt data…
      </div>
    );
  }

  if (!loading && ganttData.length === 0) {
    return (
      <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 14 }}>
        No sprint data available.
      </div>
    );
  }

  const statCounts = sorted.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Sprint Timeline</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(statCounts).map(([status, count]) => {
            const s = getStatusStyle(status);
            return (
              <span
                key={status}
                style={{
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'var(--mono)',
                  padding: '2px 9px',
                  color: 'var(--text2)',
                }}
              >
                {s.label}: {count}
              </span>
            );
          })}
        </div>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
        }}
      >
        <VelocityLegend sprints={sorted} />
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {sorted.map((sprint, i) => (
            <GanttBar key={sprint.id} sprint={sprint} index={i} totalBars={sorted.length} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(['planning', 'active', 'review', 'closed'] as const).map((status) => {
          const s = getStatusStyle(status);
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}` }} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
