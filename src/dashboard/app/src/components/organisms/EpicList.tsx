import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Epic, Milestone } from '@/types';
import { get, post, put, del } from '@/lib/api';
import { usePlanningStore } from '@/stores/planningStore';
import { AlertDialog } from '@/components/molecules/AlertDialog';

const PRESET_COLORS = ['#3b82f6', '#10b981', '#a78bfa', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'];

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

interface EpicFormData {
  name: string;
  description: string;
  color: string;
  milestone_id: number | null;
  status: string;
}

const emptyForm: EpicFormData = { name: '', description: '', color: PRESET_COLORS[0], milestone_id: null, status: 'active' };

export function EpicList() {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EpicFormData>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Epic | null>(null);

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

  const [showArchive, setShowArchive] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      milestone_id: form.milestone_id,
      status: form.status,
    };

    try {
      if (editingId !== null) {
        await put(`/api/epic/${editingId}`, body);
      } else {
        await post('/api/epics', body);
      }
      setForm({ ...emptyForm });
      setEditingId(null);
      setShowForm(false);
      await fetchEpics();
    } catch {
      // Silently fail
    }
  };

  const startEdit = (epic: Epic) => {
    setForm({
      name: epic.name,
      description: epic.description ?? '',
      color: epic.color,
      milestone_id: epic.milestone_id,
      status: epic.status,
    });
    setEditingId(epic.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del(`/api/epic/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchEpics();
    } catch {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        Loading epics...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Epics
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginLeft: 8 }}>
            {epics.filter(e => e.status !== 'completed').length} active
          </span>
        </h2>
        {!showForm && (
          <button
            onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setShowForm(true); }}
            style={{
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 9,
              padding: '7px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            + New Epic
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {editingId !== null ? 'Edit Epic' : 'Create Epic'}
          </div>

          <input
            type="text"
            placeholder="Epic name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              outline: 'none',
            }}
          />

          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              outline: 'none',
              resize: 'vertical',
            }}
          />

          {/* Color picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Color:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: c,
                  border: form.color === c ? '2px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {form.color === c && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Milestone dropdown */}
          <select
            value={form.milestone_id ?? ''}
            onChange={(e) => setForm({ ...form, milestone_id: e.target.value ? Number(e.target.value) : null })}
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'var(--font)',
              outline: 'none',
            }}
          >
            <option value="">No milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Status (only shown when editing) */}
          {editingId !== null && (
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={{
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'var(--font)',
                outline: 'none',
              }}
            >
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              style={{
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '7px 18px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              {editingId !== null ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              style={{
                background: 'none',
                color: 'var(--text3)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '7px 18px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Active epics */}
      {activeGroups.length === 0 && !loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No active epics. Create one or check the archive.
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        title="Delete Epic"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {activeGroups.map((group, gi) => (
        <div key={group.milestone?.id ?? 'none'} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Group header */}
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

          {/* Epic cards */}
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
                {/* Color bar */}
                <div style={{ width: 5, flexShrink: 0, background: epic.color }} />

                {/* Content */}
                <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{epic.name}</span>
                      <StatusBadge status={epic.status} />
                      {/* Ticket count badge */}
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
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => startEdit(epic)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text3)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(epic)}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {epic.description && (
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                      {epic.description}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    {ms && (
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                        {ms.name}
                      </span>
                    )}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 4,
                          background: 'var(--surface3)',
                          overflow: 'hidden',
                        }}
                      >
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

      {/* Archive toggle */}
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
