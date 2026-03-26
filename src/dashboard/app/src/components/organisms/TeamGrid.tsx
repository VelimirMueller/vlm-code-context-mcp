import { useAgentStore } from '@/stores/agentStore';
import { AgentCard } from '@/components/molecules/AgentCard';

export function TeamGrid() {
  const agents = useAgentStore((s) => s.agents);
  const loading = useAgentStore((s) => s.loading);

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

  if (agents.length === 0) {
    return (
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
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
        padding: 20,
        overflowY: 'auto',
        flex: 1,
      }}
    >
      {agents.map((agent) => (
        <AgentCard key={agent.role} agent={agent} />
      ))}
    </div>
  );
}
