import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Ticket, Milestone, Epic } from '@/types';
import { get, put } from '@/lib/api';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  milestones: Milestone[];
  onClose: () => void;
  onMilestoneChange: (ticketId: number, milestoneId: number | null) => Promise<void>;
  onEpicChange: (ticketId: number, epicId: number | null) => Promise<void>;
  onTicketUpdate?: (ticketId: number, updates: Partial<Ticket>) => void;
}

const priorityColor: Record<string, string> = {
  P0: 'var(--red)', P1: 'var(--orange)', P2: 'var(--blue)', P3: '#6b7280',
};

const statusColor: Record<string, string> = {
  TODO: 'var(--text3)', IN_PROGRESS: 'var(--blue)', DONE: 'var(--accent)', BLOCKED: 'var(--red)',
};

function MetaField({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: color ?? 'var(--text)', fontFamily: mono ? 'var(--mono)' : 'var(--font)' }}>{value}</div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 13,
  padding: '6px 10px',
  fontFamily: 'var(--font)',
  outline: 'none',
};

export function TicketDetailModal({ ticket, milestones, onClose, onMilestoneChange, onEpicChange, onTicketUpdate }: TicketDetailModalProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const [epics, setEpics] = useState<Epic[]>([]);
  const [epicSaving, setEpicSaving] = useState(false);
  const [epicSaved, setEpicSaved] = useState(false);
  const [epicError, setEpicError] = useState(false);

  // Inline editable fields
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [fieldSaving, setFieldSaving] = useState<string | null>(null);
  const [fieldSaved, setFieldSaved] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setEditStatus(ticket.status ?? 'TODO');
      setEditPriority(ticket.priority ?? 'P2');
      setEditAssignee(ticket.assigned_to ?? '');
      setEditPoints(String(ticket.story_points ?? ''));
      setEditNotes(ticket.notes ?? '');
      get<Epic[]>('/api/epics').then(setEpics).catch(() => setEpics([]));
    }
  }, [ticket?.id]);

  const saveField = async (field: string, value: unknown) => {
    if (!ticket) return;
    setFieldSaving(field);
    try {
      await put(`/api/ticket/${ticket.id}`, { [field]: value });
      setFieldSaved(field);
      setTimeout(() => setFieldSaved(null), 1500);
      onTicketUpdate?.(ticket.id, { [field]: value } as Partial<Ticket>);
    } catch {
      // silent
    } finally {
      setFieldSaving(null);
    }
  };

  const filteredEpics = ticket?.milestone_id
    ? epics.filter((e) => e.milestone_id === ticket.milestone_id || e.milestone_id === null)
    : epics;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!ticket) return;
    const val = e.target.value ? Number(e.target.value) : null;
    setSaving(true);
    setSaved(false);
    setError(false);
    try {
      await onMilestoneChange(ticket.id, val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleEpicChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!ticket) return;
    const val = e.target.value ? Number(e.target.value) : null;
    setEpicSaving(true);
    setEpicSaved(false);
    setEpicError(false);
    try {
      await onEpicChange(ticket.id, val);
      setEpicSaved(true);
      setTimeout(() => setEpicSaved(false), 2000);
    } catch {
      setEpicError(true);
      setTimeout(() => setEpicError(false), 3000);
    } finally {
      setEpicSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {ticket && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '24px 28px',
              width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                  {ticket.ticket_ref ?? `#${ticket.id}`}
                </span>
                <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: priorityColor[ticket.priority] ?? '#6b7280', color: 'white' }}>
                  {ticket.priority}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: `${statusColor[ticket.status] ?? 'var(--text3)'}20`,
                  color: statusColor[ticket.status] ?? 'var(--text3)',
                  border: `1px solid ${statusColor[ticket.status] ?? 'var(--text3)'}40`,
                }}>
                  {ticket.status}
                </span>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>✕</button>
            </div>

            {/* Title */}
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>{ticket.title}</h3>

            {/* Description */}
            {ticket.description && (
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--accent)', fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.5 }}>
                {ticket.description}
              </div>
            )}

            {/* Editable fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {/* Status */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4, display: 'flex', gap: 6 }}>
                  Status
                  {fieldSaved === 'status' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </div>
                <select
                  value={editStatus}
                  onChange={(e) => { setEditStatus(e.target.value); saveField('status', e.target.value); }}
                  disabled={fieldSaving === 'status'}
                  style={{ ...fieldStyle, cursor: 'pointer', color: statusColor[editStatus] ?? 'var(--text)' }}
                >
                  {['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'PARTIAL', 'NOT_DONE'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4, display: 'flex', gap: 6 }}>
                  Priority
                  {fieldSaved === 'priority' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </div>
                <select
                  value={editPriority}
                  onChange={(e) => { setEditPriority(e.target.value); saveField('priority', e.target.value); }}
                  disabled={fieldSaving === 'priority'}
                  style={{ ...fieldStyle, cursor: 'pointer' }}
                >
                  {['P0', 'P1', 'P2', 'P3'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Assigned To */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4, display: 'flex', gap: 6 }}>
                  Assigned To
                  {fieldSaved === 'assigned_to' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </div>
                <input
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  onBlur={() => saveField('assigned_to', editAssignee || null)}
                  disabled={fieldSaving === 'assigned_to'}
                  placeholder="agent role"
                  style={fieldStyle}
                />
              </div>

              {/* Story Points */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4, display: 'flex', gap: 6 }}>
                  Story Points
                  {fieldSaved === 'story_points' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </div>
                <input
                  type="number"
                  value={editPoints}
                  onChange={(e) => setEditPoints(e.target.value)}
                  onBlur={() => saveField('story_points', editPoints ? Number(editPoints) : null)}
                  disabled={fieldSaving === 'story_points'}
                  min={0}
                  style={{ ...fieldStyle, fontFamily: 'var(--mono)' }}
                />
              </div>
            </div>

            {/* QA status (read-only) */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12 }}>
              <span style={{ color: ticket.qa_verified ? 'var(--accent)' : 'var(--text3)' }}>
                {ticket.qa_verified ? '✓ QA Verified' : '✗ Not QA verified'}
              </span>
              {ticket.verified_by && <span style={{ color: 'var(--text3)' }}>by {ticket.verified_by}</span>}
            </div>

            {/* Milestone selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const }}>Milestone</div>
                {saving && (
                  <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                    Saving...
                  </div>
                )}
                {saved && (
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                    Saved
                  </div>
                )}
                {error && (
                  <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                    Failed to save
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <select
                  value={ticket.milestone_id ?? ''}
                  onChange={handleChange}
                  disabled={saving}
                  style={{
                    width: '100%', background: 'var(--bg)',
                    border: `1px solid ${saving ? 'var(--orange)' : saved ? 'var(--accent)' : error ? 'var(--red)' : 'var(--border)'}`,
                    borderRadius: 8, color: saving ? 'var(--text3)' : 'var(--text)', fontSize: 13, padding: '8px 12px',
                    fontFamily: 'var(--font)', cursor: saving ? 'wait' : 'pointer', outline: 'none',
                    opacity: saving ? 0.6 : 1, transition: 'all .2s',
                  }}
                >
                  <option value="">None</option>
                  {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            {/* Epic selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const }}>Epic</div>
                {epicSaving && (
                  <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                    Saving...
                  </div>
                )}
                {epicSaved && (
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                    Saved
                  </div>
                )}
                {epicError && (
                  <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, fontFamily: 'var(--mono)' }}>
                    Failed to save
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <select
                  value={ticket.epic_id ?? ''}
                  onChange={handleEpicChange}
                  disabled={epicSaving}
                  style={{
                    width: '100%', background: 'var(--bg)',
                    border: `1px solid ${epicSaving ? 'var(--orange)' : epicSaved ? 'var(--accent)' : epicError ? 'var(--red)' : 'var(--border)'}`,
                    borderRadius: 8, color: epicSaving ? 'var(--text3)' : 'var(--text)', fontSize: 13, padding: '8px 12px',
                    fontFamily: 'var(--font)', cursor: epicSaving ? 'wait' : 'pointer', outline: 'none',
                    opacity: epicSaving ? 0.6 : 1, transition: 'all .2s',
                  }}
                >
                  <option value="">None</option>
                  {filteredEpics.map(ep => (
                    <option key={ep.id} value={ep.id}>
                      {ep.color ? `${ep.color} ` : ''}{ep.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Acceptance criteria */}
            {ticket.acceptance_criteria && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 6 }}>Acceptance Criteria</div>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
                  {ticket.acceptance_criteria}
                </div>
              </div>
            )}

            {/* Notes (editable) */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 6, display: 'flex', gap: 6 }}>
                Notes
                {fieldSaved === 'notes' && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </div>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                onBlur={() => saveField('notes', editNotes || null)}
                disabled={fieldSaving === 'notes'}
                placeholder="Add notes for Claude's context…"
                rows={3}
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5, fontSize: 12 }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
