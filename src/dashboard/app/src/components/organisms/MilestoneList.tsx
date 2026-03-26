import React, { useState } from 'react';
import type { Milestone } from '@/types';
import { usePlanningStore } from '@/stores/planningStore';

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

interface MilestoneCardProps {
  milestone: Milestone;
  onEdit: (m: Milestone) => void;
}

function MilestoneCard({ milestone, onEdit }: MilestoneCardProps) {
  const pct = milestone.ticket_count > 0
    ? Math.round((milestone.done_count / milestone.ticket_count) * 100)
    : milestone.progress ?? 0;

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

      {milestone.description && (
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>{milestone.description}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ProgressBar value={pct} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
          {pct}%
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', flexShrink: 0 }}>
          {milestone.done_count}/{milestone.ticket_count} tickets
        </span>
      </div>

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
          {busy ? 'Saving…' : submitLabel}
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
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 14 }}>Loading milestones…</div>
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
          <MilestoneCard key={m.id} milestone={m} onEdit={openEdit} />
        )
      ))}
    </div>
  );
}
