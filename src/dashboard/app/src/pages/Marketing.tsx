'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSprintStore } from '@/stores/sprintStore';
import { useAgentStore } from '@/stores/agentStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useUIStore } from '@/stores/uiStore';
import { SubTabBar } from '@/components/molecules/SubTabBar';
import { HeroText } from '@/components/molecules/HeroText';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { BentoCard } from '@/components/molecules/BentoCard';
import { GoogleAdsStrategy } from '@/components/organisms/GoogleAdsStrategy';
import { tabVariants, tabTransition } from '@/lib/motion';

const TABS = [
  { key: 'releases', label: 'Release Notes' },
  { key: 'positioning', label: 'Positioning' },
  { key: 'metrics', label: 'Growth Metrics' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'google-ads', label: 'Google Ads' },
];

export function Marketing() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setTab);
  const sprints = useSprintStore((s) => s.sprints);
  const agents = useAgentStore((s) => s.agents);
  const milestones = usePlanningStore((s) => s.milestones);

  const closedSprints = sprints.filter((s) => s.status === 'closed');
  const totalTickets = closedSprints.reduce((a, s) => a + s.done_count, 0);
  const totalPoints = closedSprints.reduce((a, s) => a + s.velocity_completed, 0);
  const marketingAgents = agents.filter((a) => a.role.startsWith('marketing'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <SubTabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {activeTab === 'releases' && (
          <motion.div
            key="releases"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={tabTransition}
            style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <HeroText>
              <AnimatedNumber value={closedSprints.length} />
              {' sprints shipped — '}
              <AnimatedNumber value={totalTickets} />
              {' features delivered'}
            </HeroText>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
              <ReleaseNotes sprints={closedSprints} />
            </div>
          </motion.div>
        )}

        {activeTab === 'positioning' && (
          <motion.div
            key="positioning"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={tabTransition}
            style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <HeroText>
              {'Product positioning — '}
              <AnimatedNumber value={agents.length} />
              {' AI agents, '}
              <AnimatedNumber value={milestones.length} />
              {' milestones'}
            </HeroText>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
              <ProductPositioning totalTickets={totalTickets} totalPoints={totalPoints} sprintCount={closedSprints.length} agentCount={agents.length} />
            </div>
          </motion.div>
        )}

        {activeTab === 'metrics' && (
          <motion.div
            key="metrics"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={tabTransition}
            style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <HeroText>
              {'Growth dashboard — '}
              <AnimatedNumber value={totalPoints} />
              {'pt total velocity'}
            </HeroText>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
              <GrowthMetrics
                sprints={closedSprints}
                totalTickets={totalTickets}
                totalPoints={totalPoints}
                agentCount={agents.length}
              />
            </div>
          </motion.div>
        )}
        {activeTab === 'roadmap' && (
          <motion.div
            key="roadmap"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={tabTransition}
            style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <HeroText>
              {'v2.0.0 shipped — '}
              <AnimatedNumber value={milestones.length} />
              {' milestones complete'}
            </HeroText>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
              <Roadmap milestones={milestones} />
            </div>
          </motion.div>
        )}

        {activeTab === 'google-ads' && (
          <motion.div
            key="google-ads"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={tabTransition}
            style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
          >
            <HeroText>
              {'Google Ads AI — cheap strategies for npm packages'}
            </HeroText>
            <GoogleAdsStrategy />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Release Notes ──────────────────────────────────────────────────────────── */

function ReleaseNotes({ sprints }: { sprints: any[] }) {
  // Group sprints into phases for marketing narrative
  const phases = [
    {
      title: 'Foundation & Architecture',
      subtitle: 'Built the engine from scratch',
      sprints: sprints.filter((s) => s.name.includes('180000') || s.name.includes('190000') || s.name.includes('200000')),
      color: 'var(--blue)',
    },
    {
      title: 'Enterprise Polish',
      subtitle: 'World-class UX and animations',
      sprints: sprints.filter((s) => s.name.includes('210000') || s.name.includes('220000') || s.name.includes('sprint-10') || s.name.includes('sprint-9')),
      color: 'var(--purple)',
    },
    {
      title: 'Platform Maturity',
      subtitle: 'MCP bootstrap, branding, navigation',
      sprints: sprints.filter((s) => s.name.includes('sprint-11') || s.name.includes('sprint-12') || s.name.includes('sprint-14') || s.name.includes('sprint-15')),
      color: 'var(--accent)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Code Context MCP — Release Chronicle
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>
          From zero to a fully autonomous AI-powered virtual IT department in {sprints.length} sprints.
          Every line of code reviewed by AI agents. Every sprint closed with retrospectives.
          This is not just a tool — it is a paradigm shift in how software teams operate.
        </div>
      </div>

      {phases.map((phase) => (
        <div key={phase.title}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: phase.color }}>{phase.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{phase.subtitle}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phase.sprints.map((s: any) => (
              <div
                key={s.id}
                style={{
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${phase.color}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                    {s.done_count}/{s.ticket_count} shipped | {s.velocity_completed}pt
                  </div>
                </div>
                {s.goal && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>
                    {s.goal}
                  </div>
                )}
              </div>
            ))}
            {phase.sprints.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: 12 }}>No sprints in this phase yet</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Product Positioning ────────────────────────────────────────────────────── */

function ProductPositioning({ totalTickets, totalPoints, sprintCount, agentCount }: { totalTickets: number; totalPoints: number; sprintCount: number; agentCount: number }) {
  const valueProps = [
    {
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="var(--accent)" strokeWidth="1.5"/><path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 4l2-2M13 4l2 2" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round"/></svg>,
      title: 'AI-Native Scrum',
      description: `${agentCount} specialized AI agents running full scrum ceremonies — planning, standups, retros, QA — autonomously. No human bottleneck.`,
      stat: `${agentCount} agents`,
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="var(--blue)" strokeWidth="1.5"/><rect x="11" y="2" width="5" height="5" rx="1" stroke="var(--blue)" strokeWidth="1.5"/><rect x="2" y="11" width="5" height="5" rx="1" stroke="var(--blue)" strokeWidth="1.5"/><rect x="11" y="11" width="5" height="5" rx="1" stroke="var(--blue)" strokeWidth="1.5"/></svg>,
      title: 'Real-Time Dashboard',
      description: 'Enterprise-grade React dashboard with kanban, Gantt charts, velocity tracking, burndown, and bento grid insights. Zero-config via MCP.',
      stat: '7 views',
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v4l3 2" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="9" r="7" stroke="var(--purple)" strokeWidth="1.5"/><path d="M13 13l2 2" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round"/></svg>,
      title: 'MCP-First Architecture',
      description: 'Every action flows through Model Context Protocol. Claude, Cursor, or any MCP client becomes your entire IT department.',
      stat: '27+ tools',
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l7 4v6l-7 4-7-4V6l7-4z" stroke="var(--orange)" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 10v6M2 6l7 4 7-4" stroke="var(--orange)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      title: 'Process Guardrails',
      description: 'Mandatory retros, QA gates, burnout protection, minimum ticket rules. Process discipline enforced by the system, not by willpower.',
      stat: '7 rules',
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-5 3 3 5-7" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      title: 'Proven Track Record',
      description: `${sprintCount} sprints completed, ${totalTickets} tickets delivered, ${totalPoints} story points shipped. Built by its own scrum process.`,
      stat: `${totalPoints}pt`,
    },
    {
      icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v8l4 4" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 6l4-4 4 4" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      title: 'One Command Setup',
      description: 'npm install → MCP connect → full project management with agents, dashboard, and persistence. Bootstrap in under 60 seconds.',
      stat: '< 60s',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {valueProps.map((vp) => (
        <BentoCard
          key={vp.title}
          icon={vp.icon}
          title={vp.title}
          subtitle={vp.stat}
          borderColor="var(--border)"
          iconBg="rgba(255,255,255,.05)"
        >
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{vp.description}</div>
        </BentoCard>
      ))}
    </div>
  );
}

/* ─── Roadmap ────────────────────────────────────────────────────────────────── */

function Roadmap({ milestones }: { milestones: any[] }) {
  const completed = milestones.filter((m: any) => m.status === 'completed');
  const planned = milestones.filter((m: any) => m.status !== 'completed');

  const future = [
    { name: 'npm publish', description: 'Publish v2.0.0 to npm registry. One-command install for any project.', status: 'next' },
    { name: 'Remotion Animations', description: 'Vision-driven animated video generation from project data via MCP.', status: 'planned' },
    { name: 'Multi-project Support', description: 'Manage multiple codebases from a single dashboard instance.', status: 'planned' },
    { name: 'GitHub/GitLab Sync', description: 'Two-way sync between MCP scrum board and GitHub Issues/GitLab.', status: 'planned' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>v2.0.0 — Current Release</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          43 MCP tools, 9-agent scrum team, React dashboard with Linear integration, code splitting,
          interactive onboarding, ticket refinement lifecycle, security hardening. {completed.length} milestones delivered.
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>Completed Milestones</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {completed.map((m: any) => (
            <div key={m.id} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>SHIPPED</div>
            </div>
          ))}
        </div>
      </div>

      {planned.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--purple)', marginBottom: 12 }}>In Progress</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {planned.map((m: any) => (
              <div key={m.id} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--purple)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)', marginBottom: 12 }}>What's Next</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {future.map((f) => (
            <div key={f.name} style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${f.status === 'next' ? 'var(--orange)' : 'var(--text3)'}`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{f.name}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600, color: f.status === 'next' ? 'var(--orange)' : 'var(--text3)', textTransform: 'uppercase' }}>{f.status === 'next' ? 'UP NEXT' : 'PLANNED'}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{f.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Growth Metrics ─────────────────────────────────────────────────────────── */

function GrowthMetrics({ sprints, totalTickets, totalPoints, agentCount }: { sprints: any[]; totalTickets: number; totalPoints: number; agentCount: number }) {
  const velocities = sprints.map((s) => s.velocity_completed);
  const avgVelocity = velocities.length > 0 ? Math.round(velocities.reduce((a: number, b: number) => a + b, 0) / velocities.length) : 0;
  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0;
  const completionRates = sprints
    .filter((s) => s.ticket_count > 0)
    .map((s) => Math.round((s.done_count / s.ticket_count) * 100));
  const avgCompletion = completionRates.length > 0 ? Math.round(completionRates.reduce((a: number, b: number) => a + b, 0) / completionRates.length) : 0;

  const metrics = [
    { label: 'Total Sprints', value: sprints.length, color: 'var(--blue)' },
    { label: 'Tickets Shipped', value: totalTickets, color: 'var(--accent)' },
    { label: 'Story Points', value: totalPoints, color: 'var(--purple)' },
    { label: 'Avg Velocity', value: avgVelocity, color: 'var(--blue)' },
    { label: 'Peak Velocity', value: maxVelocity, color: 'var(--orange)' },
    { label: 'Completion Rate', value: avgCompletion, color: 'var(--accent)', suffix: '%' },
    { label: 'Team Size', value: agentCount, color: 'var(--purple)' },
    { label: 'MCP Tools', value: 43, color: 'var(--text2)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Big numbers grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              padding: '16px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700, color: m.color, lineHeight: 1 }}>
              <AnimatedNumber value={m.value} />
              {m.suffix ?? ''}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', marginTop: 6, letterSpacing: '0.05em' }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Sprint velocity timeline */}
      <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Velocity Over Time</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
          {sprints.map((s: any, i: number) => {
            const height = maxVelocity > 0 ? (s.velocity_completed / maxVelocity) * 100 : 0;
            return (
              <div
                key={s.id}
                title={`${s.name}: ${s.velocity_completed}pt`}
                style={{
                  flex: 1,
                  height: `${Math.max(4, height)}%`,
                  background: s.velocity_completed >= avgVelocity ? 'var(--accent)' : 'var(--surface3)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height .4s ease',
                  cursor: 'default',
                  minWidth: 4,
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          <span>Sprint 1</span>
          <span style={{ color: 'var(--accent)' }}>avg: {avgVelocity}pt</span>
          <span>Sprint {sprints.length}</span>
        </div>
      </div>

      {/* Marketing headline */}
      <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(16,185,129,.08), rgba(59,130,246,.08))', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          "{totalPoints} story points. {sprints.length} sprints. Zero human bottlenecks."
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          The first MCP server that manages its own development. Code Context MCP is proof that AI teams deliver.
        </div>
      </div>
    </div>
  );
}
