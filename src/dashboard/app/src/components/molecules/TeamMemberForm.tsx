import { useState, useEffect } from 'react';
import type { Agent } from '@/types';

const MODEL_OPTIONS = [
  { value: 'claude-opus-4-6', label: 'Opus 4.6 \u2014 Most capable' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 \u2014 Balanced' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 \u2014 Fast' },
] as const;

interface TeamMemberFormProps {
  agent?: Agent;
  onSave: (data: { role: string; name: string; description: string; model: string }) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--surface2)',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
  marginBottom: 4,
  display: 'block',
};

export function TeamMemberForm({ agent, onSave, onCancel, busy }: TeamMemberFormProps) {
  const isEdit = Boolean(agent);
  const [role, setRole] = useState(agent?.role ?? '');
  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [model, setModel] = useState(agent?.model ?? 'claude-sonnet-4-6');

  useEffect(() => {
    if (agent) {
      setRole(agent.role);
      setName(agent.name);
      setDescription(agent.description ?? '');
      setModel(agent.model ?? 'claude-sonnet-4-6');
    }
  }, [agent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim() || !name.trim()) return;
    onSave({ role: role.trim(), name: name.trim(), description: description.trim(), model });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        {isEdit ? 'Edit Agent' : 'Add Agent'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Role</label>
          <input
            style={{ ...inputStyle, ...(isEdit ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. dev-lead"
            required
            disabled={isEdit || busy}
          />
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dev Lead"
            required
            disabled={busy}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this agent do?"
          disabled={busy}
        />
      </div>

      <div>
        <label style={labelStyle}>Model</label>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={busy}
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius)',
            color: 'var(--text2)',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !role.trim() || !name.trim()}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: '#fff',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy || !role.trim() || !name.trim() ? 0.5 : 1,
          }}
        >
          {busy ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
