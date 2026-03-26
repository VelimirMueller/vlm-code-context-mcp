import type { Agent } from '@/types';

interface AgentCardProps {
  agent: Agent;
}

function healthStatus(agent: Agent): 'active' | 'idle' | 'blocked' {
  if (agent.blocked_tickets > 0) return 'blocked';
  if (agent.active_tickets > 0 || agent.done_tickets > 0) return 'active';
  return 'idle';
}

const healthColor: Record<string, string> = {
  active: 'var(--accent)',
  idle: 'var(--orange)',
  blocked: 'var(--red)',
};

export function AgentCard({ agent }: AgentCardProps) {
  const health = healthStatus(agent);
  const moodScore = agent.mood ?? 50;
  const moodColor =
    moodScore >= 60 ? 'var(--accent)' : moodScore >= 40 ? 'var(--orange)' : 'var(--red)';

  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      {/* Header: role + health dot + mood emoji */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {agent.name || agent.role}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Health dot */}
          <div
            title={health}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: healthColor[health],
              boxShadow: `0 0 6px ${healthColor[health]}`,
            }}
          />
          <span style={{ fontSize: 16 }}>{agent.mood_emoji || '😐'}</span>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--text2)',
          marginBottom: 8,
          lineHeight: 1.5,
        }}
      >
        {agent.description || 'No description'}
      </div>

      {/* Model + mood label */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
            background: 'var(--surface2)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {agent.model || 'default'}
        </span>
        <span style={{ fontSize: 11, color: moodColor, fontWeight: 600 }}>
          {agent.mood_label || 'neutral'} ({moodScore})
        </span>
      </div>

      {/* Mood progress bar */}
      <div
        style={{
          height: 3,
          background: 'var(--border)',
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${moodScore}%`,
            background: moodColor,
            transition: 'width .3s',
          }}
        />
      </div>

      {/* Ticket counts */}
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
        Done: {agent.done_tickets ?? 0} | Active: {agent.active_tickets ?? 0} | Blocked:{' '}
        {agent.blocked_tickets ?? 0}
      </div>
    </div>
  );
}
