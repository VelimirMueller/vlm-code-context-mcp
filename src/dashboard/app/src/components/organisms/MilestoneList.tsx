import React, { useState, useEffect, useMemo } from 'react';
import type { Milestone, Sprint } from '@/types';
import { usePlanningStore } from '@/stores/planningStore';
import { useSprintStore } from '@/stores/sprintStore';
import { getMilestoneSprintIds } from '@/lib/utils';

const statusColors: Record<string, { bg: string; color: string; border: string; label: string }> = {
  planned: {
    bg: 'rgba(167,139,250,.10)',
    color: 'var(--purple)',
    border: 'rgba(167,139,250,.20)',
    label: 'Planned',
  },
  in_progress: {
    bg: 'rgba(16,185,129,.10)',
    color: 'var(--green)',
    border: 'rgba(16,185,129,.20)',
    label: 'Active',
  },
  completed: {
    bg: 'rgba(59,130,246,.10)',
    color: 'var(--blue)',
    border: 'rgba(59,130,246,.20)',
    label: 'Completed',
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

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 100 ? 'var(--blue)' : pct > 50 ? 'var(--accent)' : 'var(--orange)';
  return (
    <div style={{ background: 'var(--surface3)', borderRadius: 4, height: 5, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width .3s' }} />
    </div>
  );
}

function SprintPill({ sprint }: { sprint: Sprint }) {
  const isDone = sprint.status === 'closed' || sprint.status === 'completed';
  const isActive = sprint.status === 'active';
  return (
    <span
      style={{
        display: 'inline-block',
        background: isDone ? 'rgba(59,130,246,.10)' : isActive ? 'rgba(16,185,129,.10)' : 'var(--surface3)',
        color: isDone ? 'var(--blue)' : isActive ? 'var(--green)' : 'var(--text3)',
        border: `1px solid ${isDone ? 'rgba(59,130,246,.20)' : isActive ? 'rgba(16,185,129,.20)' : 'var(--border2)'}`,
        borderRadius: 10,
        padding: '1px 8px',
        fontSize: 11,
        fontFamily: 'var(--mono)',
        whiteSpace: 'nowrap',
      }}
    >
      {sprint.name}
    </span>
  );
}

interface MilestoneStats {
  linkedSprints: Sprint[];
  totalTickets: number;
  doneTickets: number;
  totalPoints: number;
  donePoints: number;
  progress: number;
}

function computeMilestoneStats(milestone: Milestone, sprints: Sprint[]): MilestoneStats {
  const linkedIds = new Set(getMilestoneSprintIds(milestone.name, sprints));
  const linkedSprints = sprints.filter(s => linkedIds.has(s.id));

  let totalTickets = 0;
  let doneTickets = 0;
  let totalPoints = 0;
  let donePoints = 0;

  for (const s of linkedSprints) {
    totalTickets += s.ticket_count || 0;
    doneTickets += s.done_count || 0;
    totalPoints += s.velocity_committed || 0;
    donePoints += s.velocity_completed || 0;
  }

  const progress = totalTickets > 0 ? Math.round((doneTickets / totalTickets) * 100) : (milestone.progress ?? 0);

  return { linkedSprints, totalTickets, doneTickets, totalPoints, donePoints, progress };
}

interface MilestoneCardProps {
  milestone: Milestone;
  stats: MilestoneStats;
  onEdit: (m: Milestone) => void;
}

function MilestoneCard({ milestone, stats, onEdit }: MilestoneCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { linkedSprints, totalTickets, doneTickets, totalPoints, donePoints, progress } = stats;
  const hasSprintData = linkedSprints.length > 0;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {milestone.name}
          </span>
          <StatusBadge status={milestone.status} />
        </div>
        <button
          onClick={() => onEdit(milestone)}
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: 8,
            color: 'var(--text2)',
            fontSize: 12,
            padding: '4px 12px',
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: 'var(--font)',
          }}
        >
          Edit
        </button>
      </div>

      {/* Description */}
      {milestone.description && (
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>{milestone.description}</p>
      )}

      {/* Progress bar + percentage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ProgressBar value={progress} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
          {progress}%
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
          {doneTickets}/{totalTickets} tickets
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
          {donePoints}/{totalPoints}sp
        </span>
        {linkedSprints.length > 0 && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
            {linkedSprints.length} sprint{linkedSprints.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Sprint pills */}
      {hasSprintData && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {linkedSprints.map(s => (
            <SprintPill key={s.id} sprint={s} />
          ))}
        </div>
      )}

      {/* Expandable sprint breakdown */}
      {hasSprintData && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font)',
            }}
          >
            {expanded ? 'Hide' : 'Show'} sprint breakdown
          </button>
          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {linkedSprints.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    background: 'var(--surface2)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', flexShrink: 0 }}>
                    {s.done_count}/{s.ticket_count} tickets
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', flexShrink: 0 }}>
                    {s.velocity_completed}/{s.velocity_committed}sp
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: s.status === 'active' ? 'var(--green)' : s.status === 'closed' || s.status === 'completed' ? 'var(--blue)' : 'var(--text3)',
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Target date */}
      {milestone.target_date && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Target: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{milestone.target_date}</span>
        </div>
      )}
    </div>
  );
}

const emptyForm = { name: '', description: '', targetDate: '' };

export function MilestoneList() {
  const milestones = usePlanningStore((s) => s.milestones);
  const loading = usePlanningStore((s) => s.loading.milestones);
  const createMilestone = usePlanningStore((s) => s.createMilestone);
  const updateMilestone = usePlanningStore((s) => s.updateMilestone);

  const sprints = useSprintStore((s) => s.sprints);
  const fetchSprints = useSprintStore((s) => s.fetchSprints);

  useEffect(() => {
    if (sprints.length === 0) fetchSprints();
  }, [sprints.length, fetchSprints]);

  const milestoneStats = useMemo(() => {
    const map = new Map<number, MilestoneStats>();
    for (const m of milestones) {
      map.set(m.id, computeMilestoneStats(m, sprints));
    }
    return map;
  }, [milestones, sprints]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<Milestone | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      await createMilestone({
        title: createForm.name.trim(),
        description: createForm.description || undefined,
        targetDate: createForm.targetDate || undefined,
      });
      setCreateForm(emptyForm);
      setShowCreate(false);
    } catch {
      setCreateError('Failed to create milestone.');
    } finally {
      setCreateBusy(false);
    }
  };

  const openEdit = (m: Milestone) => {
    setEditTarget(m);
    setEditForm({ name: m.name, description: m.description ?? '', targetDate: m.target_date ?? '' });
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await updateMilestone(editTarget.id, {
        title: editForm.name.trim() || undefined,
        description: editForm.description || undefined,
        targetDate: editForm.targetDate || undefined,
      });
      setEditTarget(null);
    } catch {
      setEditError('Failed to update milestone.');
    } finally {
      setEditBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
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

  const inlineForm = (
    form: typeof emptyForm,
    setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>,
    onSubmit: (e: React.FormEvent) => void,
    onCancel: () => void,
    busy: boolean,
    error: string | null,
    submitLabel: string
  ) => (
    <form
      onSubmit={onSubmit}
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
        style={inputStyle}
        placeholder="Milestone name *"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
        disabled={busy}
      />
      <textarea
        style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        disabled={busy}
      />
      <input
        type="date"
        style={inputStyle}
        value={form.targetDate}
        onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
        disabled={busy}
      />
      {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            background: busy ? 'var(--surface3)' : 'var(--accent)',
            color: busy ? 'var(--text3)' : '#000',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          {busy ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
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
  );

  const defaultStats: MilestoneStats = { linkedSprints: [], totalTickets: 0, doneTickets: 0, totalPoints: 0, donePoints: 0, progress: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          Milestones
          {milestones.length > 0 && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
              ({milestones.length})
            </span>
          )}
        </h2>
        {!showCreate && (
          <button
            onClick={() => { setShowCreate(true); setCreateForm(emptyForm); setCreateError(null); }}
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
            + Create Milestone
          </button>
        )}
      </div>

      {showCreate && inlineForm(createForm, setCreateForm, handleCreate, () => setShowCreate(false), createBusy, createError, 'Create')}

      {loading && milestones.length === 0 && (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 14 }}>Loading milestones...</div>
      )}

      {!loading && milestones.length === 0 && (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 14 }}>No milestones yet. Create one to get started.</div>
      )}

      {editTarget && inlineForm(
        editForm,
        setEditForm,
        handleUpdate,
        () => setEditTarget(null),
        editBusy,
        editError,
        'Save Changes'
      )}

      {milestones.map((m) => (
        editTarget?.id === m.id ? null : (
          <MilestoneCard
            key={m.id}
            milestone={m}
            stats={milestoneStats.get(m.id) ?? defaultStats}
            onEdit={openEdit}
          />
        )
      ))}
    </div>
  );
}
