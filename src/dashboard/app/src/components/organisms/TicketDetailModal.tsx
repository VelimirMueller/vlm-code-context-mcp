import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Ticket, Milestone } from '@/types';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  milestones: Milestone[];
  onClose: () => void;
  onMilestoneChange: (ticketId: number, milestoneId: number | null) => Promise<void>;
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

export function TicketDetailModal({ ticket, milestones, onClose, onMilestoneChange }: TicketDetailModalProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

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

            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <MetaField label="Assigned To" value={ticket.assigned_to ?? '—'} />
              <MetaField label="Story Points" value={`${ticket.story_points ?? 0}sp`} mono />
              <MetaField label="QA Verified" value={ticket.qa_verified ? '✓ Verified' : '✗ Not verified'} color={ticket.qa_verified ? 'var(--accent)' : 'var(--text3)'} />
              {ticket.verified_by && <MetaField label="Verified By" value={ticket.verified_by} />}
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

            {/* Acceptance criteria */}
            {ticket.acceptance_criteria && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 6 }}>Acceptance Criteria</div>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
                  {ticket.acceptance_criteria}
                </div>
              </div>
            )}

            {/* Notes */}
            {ticket.notes && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 6 }}>Notes</div>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
                  {ticket.notes}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
