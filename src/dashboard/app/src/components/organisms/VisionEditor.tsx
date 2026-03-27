import React, { useState } from 'react';
import { usePlanningStore } from '@/stores/planningStore';
import { MarkdownRenderer } from '@/components/molecules/MarkdownRenderer';

export function VisionEditor() {
  const vision = usePlanningStore((s) => s.vision);
  const loading = usePlanningStore((s) => s.loading.vision);
  const updateVision = usePlanningStore((s) => s.updateVision);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(vision ?? '');
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateVision(draft);
      setEditing(false);
    } catch {
      setError('Failed to save vision. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft('');
    setError(null);
  };

  if (loading && vision === null) {
    return (
      <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 40, fontSize: 14 }}>
        Loading vision…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Product Vision</h2>
        {!editing && (
          <button
            onClick={startEdit}
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 8,
              color: 'var(--text2)',
              fontSize: 13,
              padding: '7px 16px',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              fontWeight: 500,
            }}
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Left: textarea */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                placeholder="Write your product vision in Markdown…"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '12px 14px',
                  fontFamily: 'var(--mono)',
                  resize: 'vertical',
                  minHeight: 320,
                  lineHeight: 1.7,
                  outline: 'none',
                  width: '100%',
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', textAlign: 'right' }}>
                {draft.length} characters
              </div>
            </div>
            {/* Right: live preview */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 14px',
                minHeight: 320,
                overflowY: 'auto',
              }}
            >
              {draft ? (
                <MarkdownRenderer content={draft} />
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
                  Preview will appear here...
                </div>
              )}
            </div>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
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
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
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
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px 24px',
            minHeight: 120,
          }}
        >
          {vision ? (
            <MarkdownRenderer content={vision} />
          ) : (
            <div style={{ color: 'var(--text3)', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
              No product vision defined yet. Click Edit to add one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
