import { useEffect, useState } from 'react';
import { useSprintStore } from '@/stores/sprintStore';
import { usePlanningStore } from '@/stores/planningStore';
import { get as apiGet, post as apiPost, patch as apiPatch } from '@/lib/api';
import { getPhaseStyle, mapLegacyPhase } from '@/lib/phases';
import type { MilestoneSprintGroup, Ticket, Milestone } from '@/types';

interface SprintTickets {
  sprintId: number;
  tickets: Ticket[];
}

export function SprintPlanningView() {
  const milestoneGroups = useSprintStore((s) => s.milestoneGroups);
  const fetchGrouped = useSprintStore((s) => s.fetchGroupedSprints);
  const loading = useSprintStore((s) => s.loading.grouped);

  const milestones = usePlanningStore((s) => s.milestones);
  const fetchMilestones = usePlanningStore((s) => s.fetchMilestones);

  const [sprintTickets, setSprintTickets] = useState<Map<number, Ticket[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [msSaving, setMsSaving] = useState<number | null>(null);

  // Sprint creation state
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', goal: '', milestone_id: '', startDate: '', endDate: '' });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      await apiPost('/api/sprints/plan', {
        name: createForm.name.trim(),
        goal: createForm.goal.trim() || undefined,
        startDate: createForm.startDate || undefined,
        endDate: createForm.endDate || undefined,
        milestone_id: createForm.milestone_id ? Number(createForm.milestone_id) : undefined,
        ticketIds: [],
      });
      setCreateForm({ name: '', goal: '', milestone_id: '', startDate: '', endDate: '' });
      setShowCreateSprint(false);
      fetchGrouped();
    } catch {
      setCreateError('Failed to create sprint.');
    } finally {
      setCreateBusy(false);
    }
  };

  useEffect(() => { fetchGrouped(); }, []);
  useEffect(() => { if (milestones.length === 0) fetchMilestones(); }, [milestones.length, fetchMilestones]);

  const handleSprintMilestoneChange = async (sprintId: number, milestoneId: number | null) => {
    setMsSaving(sprintId);
    try {
      await apiPatch(`/api/sprint/${sprintId}/milestone`, { milestone_id: milestoneId });
      fetchGrouped();
    } catch {
      // silent
    } finally {
      setMsSaving(null);
    }
  };

  // Filter to only active+planning sprints, sort active milestones first
  const statusOrder: Record<string, number> = { in_progress: 0, active: 0, planned: 1, completed: 2 };
  const filteredGroups = milestoneGroups
    .map((g) => ({
      ...g,
      sprints: g.sprints.filter((s) => { const p = mapLegacyPhase(s.status); return p === 'planning' || p === 'implementation'; }),
    }))
    .filter((g) => g.sprints.length > 0)
    .sort((a, b) => {
      const aOrder = statusOrder[a.milestone?.status ?? 'planned'] ?? 1;
      const bOrder = statusOrder[b.milestone?.status ?? 'planned'] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.milestone?.id ?? 999) - (b.milestone?.id ?? 999);
    });

  const toggleSprint = async (sprintId: number) => {
    const next = new Set(expanded);
    if (next.has(sprintId)) {
      next.delete(sprintId);
    } else {
      next.add(sprintId);
      // Fetch tickets if not already loaded
      if (!sprintTickets.has(sprintId)) {
        try {
          const tickets = await apiGet<Ticket[]>(`/api/sprint/${sprintId}/tickets`);
          setSprintTickets((prev) => new Map(prev).set(sprintId, tickets));
        } catch {
          setSprintTickets((prev) => new Map(prev).set(sprintId, []));
        }
      }
    }
    setExpanded(next);
  };

  const statusColor: Record<string, string> = {
    TODO: 'var(--text3)',
    IN_PROGRESS: 'var(--blue)',
    DONE: 'var(--accent)',
    BLOCKED: 'var(--red)',
  };

  if (loading && filteredGroups.length === 0) {
    return (
      <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 13 }}>
        Loading sprint planning...
      </div>
    );
  }

  if (filteredGroups.length === 0) {
    return (
      <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 13 }}>
        No active or planning sprints found
      </div>
    );
  }

  const createInputStyle: React.CSSProperties = {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 13,
    padding: '8px 12px',
    fontFamily: 'var(--font)',
    width: '100%',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Create Sprint button + form */}
      <div>
        {!showCreateSprint && (
          <button
            onClick={() => { setShowCreateSprint(true); setCreateError(null); }}
            style={{
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            + Create Sprint
          </button>
        )}
        {showCreateSprint && (
          <form
            onSubmit={handleCreateSprint}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <input
              style={createInputStyle}
              placeholder="Sprint name *"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required
              disabled={createBusy}
            />
            <textarea
              style={{ ...createInputStyle, resize: 'vertical', minHeight: 60 }}
              placeholder="Sprint goal (optional)"
              value={createForm.goal}
              onChange={(e) => setCreateForm((f) => ({ ...f, goal: e.target.value }))}
              disabled={createBusy}
            />
            <select
              style={createInputStyle}
              value={createForm.milestone_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, milestone_id: e.target.value }))}
              disabled={createBusy}
            >
              <option value="">No milestone</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                style={{ ...createInputStyle, flex: 1 }}
                value={createForm.startDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                disabled={createBusy}
                placeholder="Start date"
              />
              <input
                type="date"
                style={{ ...createInputStyle, flex: 1 }}
                value={createForm.endDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                disabled={createBusy}
                placeholder="End date"
              />
            </div>
            {createError && <div style={{ color: 'var(--red)', fontSize: 12 }}>{createError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={createBusy}
                style={{
                  background: createBusy ? 'var(--surface3)' : 'var(--accent)',
                  color: createBusy ? 'var(--text3)' : '#000',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: createBusy ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                {createBusy ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateSprint(false)}
                disabled={createBusy}
                style={{
                  background: 'none',
                  border: '1px solid var(--border2)',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 13,
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {filteredGroups.map((group) => {
        const ms = group.milestone;
        const msLabel = ms ? ms.name : 'Unassigned';
        const msPct = ms && ms.ticket_count > 0 ? Math.round((ms.done_count / ms.ticket_count) * 100) : 0;
        const msColor = ms?.status === 'in_progress' ? 'var(--accent)' : 'var(--purple)';

        return (
          <div key={ms ? ms.id : 'unassigned'}>
            {/* Milestone header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{msLabel}</span>
              {ms && (
                <>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
                    padding: '2px 8px', borderRadius: 5,
                    background: `${msColor}20`, color: msColor,
                    textTransform: 'uppercase',
                  }}>
                    {ms.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                    {msPct}%
                  </span>
                  <div style={{ flex: 1, height: 3, background: 'var(--surface3)', borderRadius: 2, maxWidth: 120 }}>
                    <div style={{ width: `${msPct}%`, height: '100%', background: msColor, borderRadius: 2 }} />
                  </div>
                </>
              )}
            </div>

            {/* Sprints under this milestone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.sprints.map((sprint) => {
                const isExpanded = expanded.has(sprint.id);
                const tickets = sprintTickets.get(sprint.id) ?? [];
                const velPct = sprint.velocity_committed > 0
                  ? Math.round((sprint.velocity_completed / sprint.velocity_committed) * 100) : 0;
                const sprintStatusColor = getPhaseStyle(sprint.status).bg;

                return (
                  <div
                    key={sprint.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Sprint header */}
                    <button
                      onClick={() => toggleSprint(sprint.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '12px 16px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
                        style={{ color: 'var(--text3)', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                        <path d="M6 3l5 5-5 5z" />
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sprint.name}
                      </span>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
                        padding: '2px 7px', borderRadius: 5,
                        background: `${sprintStatusColor}20`, color: sprintStatusColor,
                        textTransform: 'uppercase',
                      }}>
                        {sprint.status}
                      </span>
                      <select
                        value={ms?.id ?? ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = e.target.value ? Number(e.target.value) : null;
                          handleSprintMilestoneChange(sprint.id, val);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={msSaving === sprint.id}
                        style={{
                          background: 'var(--bg)',
                          border: `1px solid ${msSaving === sprint.id ? 'var(--orange)' : 'var(--border)'}`,
                          borderRadius: 5, color: 'var(--text)', fontSize: 10, padding: '2px 6px',
                          fontFamily: 'var(--mono)', cursor: msSaving === sprint.id ? 'wait' : 'pointer',
                          outline: 'none', opacity: msSaving === sprint.id ? 0.6 : 1,
                          maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        <option value="">No milestone</option>
                        {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                        {sprint.done_count}/{sprint.ticket_count}
                      </span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                        {sprint.velocity_completed}/{sprint.velocity_committed}pt
                      </span>
                    </button>

                    {/* Expanded ticket list */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px 12px' }}>
                        {tickets.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No tickets</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {tickets.map((t) => (
                              <div
                                key={t.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  padding: '6px 8px', borderRadius: 4,
                                  fontSize: 12,
                                }}
                              >
                                <span style={{
                                  width: 8, height: 8, borderRadius: '50%',
                                  background: statusColor[t.status] ?? 'var(--text3)',
                                  flexShrink: 0,
                                }} />
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', flexShrink: 0, width: 40 }}>
                                  {t.ticket_ref}
                                </span>
                                <span style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.title}
                                </span>
                                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', flexShrink: 0 }}>
                                  {t.story_points ?? 0}sp
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0, width: 80, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.assigned_to ?? '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
