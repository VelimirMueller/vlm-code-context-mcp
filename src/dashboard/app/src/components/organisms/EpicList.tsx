'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Epic, Milestone } from '@/types';
import { get } from '@/lib/api';
import { usePlanningStore } from '@/stores/planningStore';

const statusColors: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active: {
    bg: 'rgba(16,185,129,.10)',
    color: 'var(--green)',
    border: 'rgba(16,185,129,.20)',
    label: 'Active',
  },
  planned: {
    bg: 'rgba(167,139,250,.10)',
    color: 'var(--purple)',
    border: 'rgba(167,139,250,.20)',
    label: 'Planned',
  },
  completed: {
    bg: 'rgba(59,130,246,.10)',
    color: 'var(--blue)',
    border: 'rgba(59,130,246,.20)',
    label: 'Completed',
  },
  archived: {
    bg: 'rgba(107,114,128,.10)',
    color: 'var(--text3)',
    border: 'rgba(107,114,128,.20)',
    label: 'Archived',
  },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status] ?? statusColors.planned;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: 6,
        padding: '2px 9px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--mono)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {s.label}
    </span>
  );
}

export function EpicList() {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);

  const milestones = usePlanningStore((s) => s.milestones);
  const fetchMilestones = usePlanningStore((s) => s.fetchMilestones);

  const fetchEpics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await get<Epic[]>('/api/epics');
      setEpics(Array.isArray(data) ? data : []);
    } catch {
      setEpics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEpics();
    if (milestones.length === 0) fetchMilestones();
  }, [fetchEpics, milestones.length, fetchMilestones]);

  const milestoneLookup = useMemo(() => {
    const map = new Map<number, Milestone>();
    milestones.forEach((m) => map.set(m.id, m));
    return map;
  }, [milestones]);

  const { activeGroups, archivedGroups } = useMemo(() => {
    const active: { milestone: Milestone | null; epics: Epic[] }[] = [];
    const archived: { milestone: Milestone | null; epics: Epic[] }[] = [];
    const byMilestone = new Map<number | null, Epic[]>();

    for (const epic of epics) {
      const key = epic.milestone_id;
      if (!byMilestone.has(key)) byMilestone.set(key, []);
      byMilestone.get(key)!.push(epic);
    }

    const activeMilestones = milestones.filter((m) => m.status !== 'completed');
    const completedMilestones = milestones.filter((m) => m.status === 'completed');

    for (const m of activeMilestones) {
      const epicGroup = byMilestone.get(m.id);
      if (epicGroup) {
        active.push({ milestone: m, epics: epicGroup });
        byMilestone.delete(m.id);
      }
    }

    for (const m of completedMilestones) {
      const epicGroup = byMilestone.get(m.id);
      if (epicGroup) {
        archived.push({ milestone: m, epics: epicGroup });
        byMilestone.delete(m.id);
      }
    }

    const noMilestone = byMilestone.get(null);
    if (noMilestone) {
      const hasActive = noMilestone.some((e) => e.status !== 'completed');
      if (hasActive) active.push({ milestone: null, epics: noMilestone.filter((e) => e.status !== 'completed') });
      const completedOrphans = noMilestone.filter((e) => e.status === 'completed');
      if (completedOrphans.length) archived.push({ milestone: null, epics: completedOrphans });
    }

    return { activeGroups: active, archivedGroups: archived };
  }, [epics, milestones]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Loading epics...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
        Epics
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginLeft: 8 }}>
          {epics.filter(e => e.status !== 'completed').length} active
        </span>
      </h2>

      {activeGroups.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No active epics. Run <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>/kickoff</code> to create epics.
        </div>
      )}

      {activeGroups.map((group, gi) => (
        <div key={group.milestone?.id ?? 'none'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text2)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 6,
              marginTop: gi > 0 ? 8 : 0,
            }}
          >
            {group.milestone ? group.milestone.name : 'No Milestone'}
          </div>

          {group.epics.map((epic) => {
            const progress = epic.ticket_count > 0 ? Math.round((epic.done_count / epic.ticket_count) * 100) : 0;
            const ms = epic.milestone_id ? milestoneLookup.get(epic.milestone_id) : null;

            return (
              <div
                key={epic.id}
                style={{
                  display: 'flex',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: 5, flexShrink: 0, background: epic.color }} />
                <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{epic.name}</span>
                    <StatusBadge status={epic.status} />
                    <span style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '1px 9px',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--mono)',
                      color: 'var(--text3)',
                    }}>
                      {epic.done_count}/{epic.ticket_count} tickets
                    </span>
                  </div>

                  {epic.description && (
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                      {epic.description}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    {ms && (
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                        {ms.name}
                      </span>
                    )}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--surface3)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            borderRadius: 4,
                            background: epic.color,
                            transition: 'width .3s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)', fontWeight: 600, flexShrink: 0 }}>
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {archivedGroups.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowArchive(!showArchive)}
            style={{
              width: '100%', background: 'none', border: '1px solid var(--border2)',
              borderRadius: 8, color: 'var(--text3)', fontSize: 13, padding: '8px 16px',
              cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 500, textAlign: 'center',
            }}
          >
            {showArchive ? 'Hide' : 'Show'} Archive ({archivedGroups.reduce((a, g) => a + g.epics.length, 0)} completed epics)
          </button>
          {showArchive && (
            <div style={{ marginTop: 12, opacity: 0.7 }}>
              {archivedGroups.map((group, gi) => (
                <div key={group.milestone?.id ?? 'none'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginTop: gi > 0 ? 8 : 0 }}>
                    {group.milestone ? group.milestone.name : 'No Milestone'}
                  </div>
                  {group.epics.map((epic) => {
                    const progress = epic.ticket_count > 0 ? Math.round((epic.done_count / epic.ticket_count) * 100) : 0;
                    return (
                      <div key={epic.id} style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div style={{ width: 5, flexShrink: 0, background: epic.color }} />
                        <div style={{ flex: 1, padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)' }}>{epic.name}</span>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,.10)', color: 'var(--blue)', fontWeight: 600 }}>Completed</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{epic.done_count}/{epic.ticket_count} tickets</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--blue)', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{progress}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
