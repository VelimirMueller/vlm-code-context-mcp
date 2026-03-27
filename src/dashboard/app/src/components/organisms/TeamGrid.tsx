import { useState } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { AgentCard } from '@/components/molecules/AgentCard';
import { TeamMemberForm } from '@/components/molecules/TeamMemberForm';
import { post } from '@/lib/api';

export function TeamGrid() {
  const agents = useAgentStore((s) => s.agents);
  const loading = useAgentStore((s) => s.loading);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCreate(data: { role: string; name: string; description: string; model: string }) {
    setBusy(true);
    try {
      await post('/api/agents', data);
      await fetchAgents();
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }

  if (loading && agents.length === 0) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
          padding: 20,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              height: 140,
              background: 'var(--surface2)',
              borderRadius: 'var(--radius)',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      {/* Top bar with Add button */}
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add Member
          </button>
        )}
      </div>

      {/* Inline create form */}
      {showForm && (
        <div style={{ padding: '12px 20px 0' }}>
          <TeamMemberForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            busy={busy}
          />
        </div>
      )}

      {/* Grid or empty state */}
      {agents.length === 0 && !showForm ? (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            color: 'var(--text3)',
            fontSize: 14,
          }}
        >
          No agents found
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
            padding: 20,
            flex: 1,
          }}
        >
          {agents.map((agent) => (
            <AgentCard key={agent.role} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
