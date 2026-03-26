import React, { useEffect, useState } from 'react';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { usePlanningStore } from '@/stores/planningStore';
import { BentoCard } from '@/components/molecules/BentoCard';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import type { RetroFinding } from '@/types';

// ─── Mini progress bar ───────────────────────────────────────────────────────

function MiniBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ background: 'var(--surface3)', borderRadius: 3, height: 4, overflow: 'hidden', flex: 1 }}>
      <div
        style={{
          width: `${pct}%`,
          background: color,
          height: '100%',
          borderRadius: 3,
          transition: 'width .4s ease',
        }}
      />
    </div>
  );
}

// ─── Stat row used inside cards ───────────────────────────────────────────────

function StatRow({
  label,
  value,
  mono = false,
  color,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--text2)',
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontFamily: mono ? 'var(--mono)' : undefined,
          color: color ?? 'var(--text)',
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── PlanningInsights ─────────────────────────────────────────────────────────

export function PlanningInsights() {
  const sprints = useSprintStore((s) => s.sprints);
  const agents = useAgentStore((s) => s.agents);
  const milestones = usePlanningStore((s) => s.milestones);

  const [allFindings, setAllFindings] = useState<RetroFinding[]>([]);
  const [retroLoading, setRetroLoading] = useState(false);

  // Fetch retro findings for all sprints
  useEffect(() => {
    if (sprints.length === 0) return;
    setRetroLoading(true);
    Promise.all(
      sprints.map((s) =>
        fetch(`/api/sprint/${s.id}/retro`)
          .then((r) => r.json())
          .catch(() => [] as RetroFinding[])
      )
    )
      .then((results) => {
        setAllFindings((results as RetroFinding[][]).flat());
      })
      .finally(() => setRetroLoading(false));
  }, [sprints.length]);

  // ── Velocity card data ────────────────────────────────────────────────────
  const closedSprints = sprints.filter((s) => s.status === 'closed');
  const velocities = closedSprints.map((s) => s.velocity_completed);
  const avgVelocity =
    velocities.length > 0
      ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
      : 0;
  const minVelocity = velocities.length > 0 ? Math.min(...velocities) : 0;
  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0;

  const trend: 'improving' | 'stable' | 'declining' = (() => {
    if (velocities.length < 3) return 'stable';
    const last3 = velocities.slice(-3);
    if (last3[2] > last3[0]) return 'improving';
    if (last3[2] < last3[0]) return 'declining';
    return 'stable';
  })();

  const trendColor =
    trend === 'improving' ? 'var(--accent)' : trend === 'declining' ? 'var(--red)' : 'var(--text3)';

  // ── Sprint health ─────────────────────────────────────────────────────────
  const activeSprints = sprints.filter((s) => s.status === 'active').length;
  const planningSprints = sprints.filter((s) => s.status === 'planning').length;
  const completionRates = closedSprints
    .filter((s) => s.ticket_count > 0)
    .map((s) => (s.done_count / s.ticket_count) * 100);
  const avgCompletion =
    completionRates.length > 0
      ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length)
      : 0;
  const healthColor =
    avgCompletion >= 80 ? 'var(--accent)' : avgCompletion >= 60 ? 'var(--orange)' : 'var(--red)';

  // ── Team capacity ─────────────────────────────────────────────────────────
  const avgMood =
    agents.length > 0
      ? (agents.reduce((a, b) => a + b.mood, 0) / agents.length).toFixed(1)
      : '—';
  const busiestAgent =
    agents.length > 0
      ? agents.reduce((a, b) => (b.done_tickets > a.done_tickets ? b : a))
      : null;

  // ── Delivery stats ────────────────────────────────────────────────────────
  const totalTicketsDelivered = closedSprints.reduce((a, s) => a + s.done_count, 0);
  const totalPointsDelivered = closedSprints.reduce((a, s) => a + s.velocity_completed, 0);
  const avgPointsPerSprint =
    closedSprints.length > 0 ? Math.round(totalPointsDelivered / closedSprints.length) : 0;

  // ── Process health ────────────────────────────────────────────────────────
  const sprintsWithRetros = new Set(allFindings.map((f) => f.id)).size;
  const wentWell = allFindings.filter((f) => f.category === 'went_well').length;
  const wentWrong = allFindings.filter((f) => f.category === 'went_wrong').length;

  // Milestone status colors
  const msStatusColor: Record<string, string> = {
    planned: 'var(--purple)',
    in_progress: 'var(--accent)',
    completed: 'var(--blue)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Planning Insights</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {sprints.length} sprints · {agents.length} agents · {milestones.length} milestones
        </span>
      </div>

      {/* Bento grid: 3 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        {/* Card 1: Velocity Trend — wide (spans 2 cols) */}
        <BentoCard
          icon="📈"
          title="Velocity Trend"
          subtitle={`${closedSprints.length} closed sprints`}
          borderColor="var(--blue)"
          iconBg="rgba(59,130,246,.15)"
          wide
        >
          {/* Mini bar chart */}
          {closedSprints.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {closedSprints.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: 'var(--text3)',
                      width: 72,
                      flexShrink: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </span>
                  <MiniBar
                    value={maxVelocity > 0 ? (s.velocity_completed / maxVelocity) * 100 : 0}
                    color="var(--blue)"
                  />
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: 'var(--text2)',
                      width: 28,
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {s.velocity_completed}
                  </span>
                </div>
              ))}
              {/* Summary row */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginTop: 4,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>avg</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--blue)' }}>
                    <AnimatedNumber value={avgVelocity} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>min</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--text2)' }}>
                    {minVelocity}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>max</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--text2)' }}>
                    {maxVelocity}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>trend</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: trendColor }}>
                    {trend}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
              No closed sprints yet
            </div>
          )}
        </BentoCard>

        {/* Card 2: Sprint Health */}
        <BentoCard
          icon="🏥"
          title="Sprint Health"
          subtitle="Completion rates"
          borderColor="var(--accent)"
          iconBg="rgba(16,185,129,.15)"
        >
          {/* Big completion number */}
          <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 700, color: healthColor, lineHeight: 1 }}>
              <AnimatedNumber value={avgCompletion} />
              <span style={{ fontSize: 20 }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>avg completion</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StatRow label="Total sprints" value={sprints.length} mono />
            <StatRow label="Active" value={activeSprints} mono color="var(--accent)" />
            <StatRow label="Closed" value={closedSprints.length} mono color="var(--blue)" />
            <StatRow label="Planning" value={planningSprints} mono color="var(--purple)" />
          </div>
        </BentoCard>

        {/* Card 3: Team Capacity */}
        <BentoCard
          icon="👥"
          title="Team Capacity"
          subtitle="Agent performance"
          borderColor="var(--purple)"
          iconBg="rgba(167,139,250,.15)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StatRow label="Total agents" value={agents.length} mono />
            <StatRow label="Avg mood" value={avgMood} mono color="var(--accent)" />
            {busiestAgent && (
              <>
                <StatRow
                  label="Busiest agent"
                  value={busiestAgent.name}
                  color="var(--purple)"
                />
                <StatRow
                  label="Done tickets"
                  value={busiestAgent.done_tickets}
                  mono
                  color="var(--text2)"
                />
              </>
            )}
            {/* Mood distribution */}
            {agents.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Mood distribution</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {agents.map((a) => (
                    <span
                      key={a.role}
                      title={`${a.name}: ${a.mood_label}`}
                      style={{ fontSize: 16, cursor: 'default' }}
                    >
                      {a.mood_emoji}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </BentoCard>

        {/* Card 4: Delivery Stats */}
        <BentoCard
          icon="🚀"
          title="Delivery Stats"
          subtitle="Total output delivered"
          borderColor="var(--accent)"
          iconBg="rgba(16,185,129,.12)"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>tickets delivered</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>
                  <AnimatedNumber value={totalTicketsDelivered} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>story points</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 700, color: 'var(--blue)', lineHeight: 1.1 }}>
                  <AnimatedNumber value={totalPointsDelivered} />
                </div>
              </div>
            </div>
            <StatRow label="Avg pts / sprint" value={avgPointsPerSprint} mono color="var(--text2)" />
            <StatRow label="Closed sprints" value={closedSprints.length} mono />
          </div>
        </BentoCard>

        {/* Card 5: Milestone Progress — wide */}
        <BentoCard
          icon="🏁"
          title="Milestone Progress"
          subtitle={`${milestones.length} milestones`}
          borderColor="var(--orange)"
          iconBg="rgba(251,191,36,.12)"
          wide
        >
          {milestones.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestones.map((m) => {
                const pct =
                  m.ticket_count > 0
                    ? Math.round((m.done_count / m.ticket_count) * 100)
                    : m.progress ?? 0;
                const barColor = msStatusColor[m.status] ?? 'var(--text3)';
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {m.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--mono)',
                          color: barColor,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {m.status.replace('_', ' ')}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          color: 'var(--text2)',
                          flexShrink: 0,
                          width: 36,
                          textAlign: 'right',
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <MiniBar value={pct} color={barColor} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
              No milestones configured
            </div>
          )}
        </BentoCard>

        {/* Card 6: Process Health */}
        <BentoCard
          icon="🔍"
          title="Process Health"
          subtitle="Retrospective analysis"
          borderColor="var(--text3)"
          iconBg="rgba(255,255,255,.06)"
        >
          {retroLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
              Loading retros…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                    <AnimatedNumber value={wentWell} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>went well</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--red)', lineHeight: 1 }}>
                    <AnimatedNumber value={wentWrong} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>went wrong</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--purple)', lineHeight: 1 }}>
                    <AnimatedNumber value={allFindings.length} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>total findings</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <StatRow
                  label="Retros conducted"
                  value={`${sprintsWithRetros} / ${sprints.length} sprints`}
                  mono
                />
                {wentWell + wentWrong > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>
                      Positive ratio
                    </div>
                    <MiniBar
                      value={Math.round((wentWell / (wentWell + wentWrong)) * 100)}
                      color="var(--accent)"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </BentoCard>
      </div>
    </div>
  );
}
