'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { Sprint } from '@/types';
import { usePlanningStore } from '@/stores/planningStore';
import { useSprintStore } from '@/stores/sprintStore';

// Improved color scheme with better contrast
const statusStyle: Record<string, { bg: string; border: string; label: string }> = {
  planning: { bg: '#636474', border: '#818498', label: 'Planning' },
  active:   { bg: '#10b981', border: '#34d399', label: 'Active' },
  review:   { bg: '#f59e0b', border: '#fbbf24', label: 'Review' },
  closed:   { bg: '#3b82f6', border: '#60a5fa', label: 'Closed' },
};

function getStatusStyle(status: string) {
  return statusStyle[status] ?? statusStyle.planning;
}

interface GanttBarProps {
  sprint: Sprint;
  index: number;
  totalBars: number;
  leftPct: number;
  widthPct: number;
  dateRange: { start: Date; end: Date };
  onHover: (sprint: Sprint | null, x: number, y: number) => void;
  onMouseLeave: () => void;
}

function GanttBar({ sprint, index, totalBars, leftPct, widthPct, dateRange, onHover, onMouseLeave }: GanttBarProps) {
  const s = getStatusStyle(sprint.status);
  const done = sprint.velocity_completed ?? 0;
  const committed = sprint.velocity_committed ?? 0;
  const velocityPct = committed > 0 ? Math.min(100, Math.round((done / committed) * 100)) : 0;

  const startDate = sprint.start_date ? new Date(sprint.start_date) : null;
  const endDate = sprint.end_date ? new Date(sprint.end_date) : null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        alignItems: 'center',
        gap: 14,
        padding: '8px 0',
        borderBottom: index < totalBars - 1 ? '1px solid var(--border)' : 'none',
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
              border: 'none',
              borderRadius: 5,
              fontSize: 10,
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '2px 7px',
              color: 'white',
            }}
          >
            {s.label}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
            {done}/{committed}pt
          </span>
        </div>
      </div>

      {/* Bar - Single color, no nested overlay */}
      <div
        style={{ position: 'relative', height: 28 }}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onHover(sprint, rect.left + rect.width / 2, rect.top);
        }}
        onMouseLeave={onMouseLeave}
      >
        {/* Track background */}
        <div
          style={{
            position: 'absolute',
            inset: '6px 0',
            background: 'var(--surface3)',
            borderRadius: 4,
          }}
        />
        {/* Positioned bar - single solid color */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            background: s.bg,
            borderRadius: 4,
            border: `2px solid ${s.border}`,
            cursor: 'pointer',
            transition: 'left .4s ease, width .4s ease, transform .2s ease, box-shadow .2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scaleY(1.1)';
            e.currentTarget.style.boxShadow = `0 4px 12px ${s.bg}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scaleY(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>
    </div>
  );
}

// Date axis component showing month/week ticks
interface DateAxisProps {
  dateRange: { start: Date; end: Date };
  barWidth: number;
}

function DateAxis({ dateRange, barWidth }: DateAxisProps) {
  const weeks = useMemo(() => {
    const weeks: Date[] = [];
    const current = new Date(dateRange.start);
    current.setDate(current.getDate() - current.getDay()); // Start of week

    while (current <= dateRange.end) {
      weeks.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  }, [dateRange]);

  const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, marginBottom: 12 }}>
      <div />
      <div style={{ position: 'relative', height: 32 }}>
        {weeks.map((week, i) => {
          const dayOffset = (week.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
          const leftPct = (dayOffset / totalDays) * 100;
          const isMonthStart = week.getDate() <= 7;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {isMonthStart && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--text2)',
                  textTransform: 'uppercase',
                }}>
                  {week.toLocaleDateString('en-US', { month: 'short' })}
                </span>
              )}
              <div style={{
                width: isMonthStart ? 2 : 1,
                height: isMonthStart ? 8 : 6,
                background: isMonthStart ? 'var(--text3)' : 'var(--border)',
                borderRadius: 1,
              }} />
              {!isMonthStart && (
                <span style={{
                  fontSize: 9,
                  color: 'var(--text3)',
                  fontFamily: 'var(--mono)',
                }}>
                  {week.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tooltip component
interface GanttTooltipProps {
  sprint: Sprint | null;
  position: { x: number; y: number } | null;
}

function GanttTooltip({ sprint, position }: GanttTooltipProps) {
  if (!sprint || !position) return null;

  const startDate = sprint.start_date ? new Date(sprint.start_date) : null;
  const endDate = sprint.end_date ? new Date(sprint.end_date) : null;
  const done = sprint.velocity_completed ?? 0;
  const committed = sprint.velocity_committed ?? 0;
  const velocityPct = committed > 0 ? Math.round((done / committed) * 100) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y - 120,
        transform: 'translateX(-50%)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: 200,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        {sprint.name}
      </div>
      {startDate && endDate && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
          {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <div style={{
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          background: getStatusStyle(sprint.status).bg,
          color: 'white',
        }}>
          {sprint.status}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {done}/{committed}pt ({velocityPct}%)
        </div>
      </div>
    </div>
  );
}

// Current week indicator
interface CurrentWeekIndicatorProps {
  dateRange: { start: Date; end: Date };
}

function CurrentWeekIndicator({ dateRange }: CurrentWeekIndicatorProps) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
  const dayOffset = (startOfWeek.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
  const leftPct = (dayOffset / totalDays) * 100;

  if (leftPct < 0 || leftPct > 100) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: 0,
        bottom: 0,
        width: 2,
        background: 'var(--red)',
        opacity: 0.6,
        pointerEvents: 'none',
      }}
    >
      <div style={{
        position: 'absolute',
        top: -8,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--red)',
        whiteSpace: 'nowrap',
      }}>
        ● This Week
      </div>
    </div>
  );
}

function computeBarLayout(sprints: Sprint[]): { leftPct: number; widthPct: number; dateRange: { start: Date; end: Date } } {
  const hasDates = sprints.some((s) => s.start_date && s.end_date);

  if (hasDates) {
    const starts = sprints.map((s) => (s.start_date ? new Date(s.start_date).getTime() : null));
    const ends = sprints.map((s) => (s.end_date ? new Date(s.end_date).getTime() : null));
    const validStarts = starts.filter((t): t is number => t !== null);
    const validEnds = ends.filter((t): t is number => t !== null);
    const minTime = Math.min(...validStarts);
    const maxTime = Math.max(...validEnds);
    const range = maxTime - minTime || 1;

    return {
      leftPct: 0,
      widthPct: 100,
      dateRange: {
        start: new Date(minTime),
        end: new Date(maxTime),
      },
    };
  }

  // Fallback: equal-width bars in chronological order
  const count = sprints.length || 1;
  const barWidth = Math.min(90 / count, 30);
  const gap = count > 1 ? (100 - barWidth * count) / (count - 1) : 0;

  return {
    leftPct: 0,
    widthPct: 100,
    dateRange: {
      start: new Date(),
      end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  };
}

export function GanttChart() {
  const ganttData = usePlanningStore((s) => s.ganttData);
  const loading = usePlanningStore((s) => s.loading.gantt);
  const [hoveredSprint, setHoveredSprint] = useState<Sprint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const sorted = useMemo(
    () =>
      [...ganttData].sort((a, b) =>
        (a.created_at || '').localeCompare(b.created_at || ''),
      ),
    [ganttData],
  );

  const layoutData = useMemo(() => computeBarLayout(sorted), [sorted]);

  const barLayout = useMemo(() => {
    const hasDates = sorted.some((s) => s.start_date && s.end_date);

    if (hasDates) {
      const starts = sorted.map((s) => (s.start_date ? new Date(s.start_date).getTime() : null));
      const ends = sorted.map((s) => (s.end_date ? new Date(s.end_date).getTime() : null));
      const validStarts = starts.filter((t): t is number => t !== null);
      const validEnds = ends.filter((t): t is number => t !== null);
      const minTime = Math.min(...validStarts);
      const maxTime = Math.max(...validEnds);
      const range = maxTime - minTime || 1;

      return sorted.map((s, i) => {
        const start = starts[i] ?? minTime;
        const end = ends[i] ?? maxTime;
        const leftPct = ((start - minTime) / range) * 100;
        const widthPct = Math.max(4, ((end - start) / range) * 100);
        return { leftPct, widthPct };
      });
    }

    // Fallback: equal-width bars
    const count = sorted.length || 1;
    const barWidth = Math.min(90 / count, 30);
    const gap = count > 1 ? (100 - barWidth * count) / (count - 1) : 0;
    return sorted.map((_, i) => ({
      leftPct: i * (barWidth + gap),
      widthPct: barWidth,
    }));
  }, [sorted]);

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
      <GanttTooltip sprint={hoveredSprint} position={tooltipPos} />

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
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  padding: '4px 10px',
                  color: 'white',
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
          position: 'relative',
        }}
      >
        <DateAxis dateRange={layoutData.dateRange} barWidth={0} />

        <div style={{ position: 'relative' }}>
          <CurrentWeekIndicator dateRange={layoutData.dateRange} />

          {sorted.map((sprint, i) => (
            <GanttBar
              key={sprint.id}
              sprint={sprint}
              index={i}
              totalBars={sorted.length}
              leftPct={barLayout[i]?.leftPct ?? 0}
              widthPct={barLayout[i]?.widthPct ?? 100}
              dateRange={layoutData.dateRange}
              onHover={(sprint, x, y) => {
                setHoveredSprint(sprint);
                setTooltipPos({ x, y });
              }}
              onMouseLeave={() => {
                setHoveredSprint(null);
                setTooltipPos(null);
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(['planning', 'active', 'review', 'closed'] as const).map((status) => {
          const s = getStatusStyle(status);
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: s.bg, border: `2px solid ${s.border}` }} />
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Member Allocation Discovery */}
      <MemberAllocationView sprints={sorted} />
    </div>
  );
}

/* ─── Member Allocation View ─────────────────────────────────────────────────── */

interface MemberAllocation {
  member: string;
  sprintAssignments: Map<number, number>; // sprintId -> ticket count
}

function MemberAllocationView({ sprints }: { sprints: Sprint[] }) {
  const [allocations, setAllocations] = useState<MemberAllocation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sprints.length === 0) return;
    setLoading(true);

    // Fetch tickets for each sprint to build allocation map
    Promise.all(
      sprints.slice(-8).map((s) =>
        fetch(`/api/sprint/${s.id}/tickets`)
          .then((r) => r.json())
          .then((tickets: any[]) => ({ sprintId: s.id, sprintName: s.name, tickets }))
          .catch(() => ({ sprintId: s.id, sprintName: s.name, tickets: [] }))
      )
    ).then((results) => {
      const memberMap = new Map<string, Map<number, number>>();

      for (const { sprintId, tickets } of results) {
        for (const t of tickets) {
          const member = t.assigned_to || 'unassigned';
          if (!memberMap.has(member)) memberMap.set(member, new Map());
          const sprintMap = memberMap.get(member)!;
          sprintMap.set(sprintId, (sprintMap.get(sprintId) || 0) + 1);
        }
      }

      const allocs: MemberAllocation[] = Array.from(memberMap.entries())
        .map(([member, sprintAssignments]) => ({ member, sprintAssignments }))
        .sort((a, b) => b.sprintAssignments.size - a.sprintAssignments.size);

      setAllocations(allocs);
      setLoading(false);
    });
  }, [sprints.length]);

  const recentSprints = sprints.slice(-8);

  if (loading) {
    return (
      <div style={{ marginTop: 16, padding: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Loading member allocation...
      </div>
    );
  }

  if (allocations.length === 0) return null;

  // Identify overused (>6 sprints) and underused (1 sprint) members
  const maxAssignments = Math.max(...allocations.map((a) => a.sprintAssignments.size));

  return (
    <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Member Allocation</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Last {recentSprints.length} sprints — ensure every member has at least 1 ticket</div>
      </div>

      {/* Header row: sprint names */}
      <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${recentSprints.length}, 1fr)`, gap: 2, marginBottom: 4 }}>
        <div />
        {recentSprints.map((s) => (
          <div key={s.id} style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.name.replace('sprint-', '').slice(0, 10)}
          </div>
        ))}
      </div>

      {/* Member rows */}
      {allocations.map((alloc) => {
        const totalTickets = Array.from(alloc.sprintAssignments.values()).reduce((a, b) => a + b, 0);
        const sprintsActive = alloc.sprintAssignments.size;
        const isOverused = sprintsActive >= recentSprints.length && totalTickets > recentSprints.length * 2;
        const isUnderused = sprintsActive <= 1;
        const isIdle = sprintsActive === 0;

        return (
          <div
            key={alloc.member}
            style={{
              display: 'grid',
              gridTemplateColumns: `140px repeat(${recentSprints.length}, 1fr)`,
              gap: 2,
              padding: '4px 0',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isOverused && <span title="Overused — risk of burnout" style={{ fontSize: 10 }}>&#128293;</span>}
              {isUnderused && !isIdle && <span title="Underused — assign more" style={{ fontSize: 10 }}>&#9888;&#65039;</span>}
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: isOverused ? 'var(--red)' : isUnderused ? 'var(--orange)' : 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {alloc.member}
              </span>
            </div>
            {recentSprints.map((s) => {
              const count = alloc.sprintAssignments.get(s.id) || 0;
              return (
                <div
                  key={s.id}
                  style={{
                    height: 20,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    fontWeight: 600,
                    background: count === 0
                      ? 'var(--surface3)'
                      : count >= 3
                        ? 'rgba(239,68,68,.2)'
                        : count >= 2
                          ? 'rgba(16,185,129,.15)'
                          : 'rgba(59,130,246,.15)',
                    color: count === 0
                      ? 'var(--text3)'
                      : count >= 3
                        ? 'var(--red)'
                        : count >= 2
                          ? 'var(--accent)'
                          : 'var(--blue)',
                  }}
                >
                  {count > 0 ? count : '·'}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10, color: 'var(--text3)' }}>
        <span>&#128293; Overused (burnout risk)</span>
        <span>&#9888;&#65039; Underused (assign more)</span>
        <span style={{ color: 'var(--red)' }}>3+ tickets = heavy load</span>
        <span style={{ color: 'var(--accent)' }}>2 = balanced</span>
        <span style={{ color: 'var(--blue)' }}>1 = minimum met</span>
      </div>
    </div>
  );
}
