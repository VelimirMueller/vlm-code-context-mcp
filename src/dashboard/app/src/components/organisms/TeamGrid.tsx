import { useState, useMemo } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { AgentCard } from '@/components/molecules/AgentCard';
import { TeamMemberForm } from '@/components/molecules/TeamMemberForm';
import { post } from '@/lib/api';

const ROLE_GROUPS: { label: string; color: string; roles: Set<string> }[] = [
  { label: 'Development', color: '#3b82f6', roles: new Set(['architect', 'lead-developer', 'backend-developer', 'frontend-developer', 'fullstack-developer', 'data-engineer', 'devops']) },
  { label: 'Business', color: '#8b5cf6', roles: new Set(['product-owner', 'manager', 'marketing-lead', 'growth-strategist', 'ux-designer']) },
  { label: 'Quality & Process', color: '#10b981', roles: new Set(['qa', 'security-specialist', 'scrum-master']) },
];

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
      {/* Header bar with title and Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Team Members</div>
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

      {/* Grouped grid or empty state */}
      {agents.length === 0 && !showForm ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          No agents found
        </div>
      ) : (
        <GroupedAgentGrid agents={agents} />
      )}
    </div>
  );
}

function GroupedAgentGrid({ agents }: { agents: any[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const result: { label: string; color: string; agents: any[] }[] = [];
    for (const group of ROLE_GROUPS) {
      const matching = agents.filter((a) => group.roles.has(a.role));
      if (matching.length > 0) result.push({ label: group.label, color: group.color, agents: matching });
    }
    // Ungrouped agents
    const allGrouped = new Set(ROLE_GROUPS.flatMap((g) => [...g.roles]));
    const ungrouped = agents.filter((a) => !allGrouped.has(a.role));
    if (ungrouped.length > 0) result.push({ label: 'Other', color: 'var(--text3)', agents: ungrouped });
    return result;
  }, [agents]);

  const toggle = (label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 16 }}>
          <button
            onClick={() => toggle(group.label)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
              cursor: 'pointer', padding: '8px 0', width: '100%', fontFamily: 'var(--font)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: collapsed.has(group.label) ? 'none' : 'rotate(90deg)', transition: 'transform .2s', flexShrink: 0 }}>
              <path d="M4 2L8 6L4 10" stroke={group.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{group.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', background: 'var(--surface2)', padding: '1px 8px', borderRadius: 10 }}>{group.agents.length}</span>
          </button>
          {!collapsed.has(group.label) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, paddingTop: 4 }}>
              {group.agents.map((agent) => (
                <AgentCard key={agent.role} agent={agent} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
