'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useVelocityStore, type VelocitySprint } from '@/stores/velocityStore';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { HeroText } from '@/components/molecules/HeroText';
import { pageVariants, pageTransition } from '@/lib/motion';

const GREEN = '#10b981';
const BLUE = '#3b82f6';
const ORANGE = '#f59e0b';
const RED = '#ef4444';

function statusColor(status: string): string {
  switch (status) {
    case 'rest': case 'closed': case 'done': return GREEN;
    case 'implementation': case 'active': return BLUE;
    case 'planning': return ORANGE;
    default: return 'var(--text3)';
  }
}

function SummaryCards({ data }: { data: NonNullable<ReturnType<typeof useVelocityStore.getState>['data']> }) {
  const s = data.summary;
  if (!s) return null;

  const cards = [
    { label: 'Sprints', value: `${s.completed_sprints}/${s.total_sprints}`, color: 'var(--text)' },
    { label: 'Avg Committed', value: `${s.avg_committed}pt`, color: BLUE },
    { label: 'Avg Completed', value: `${s.avg_completed}pt`, color: GREEN },
    { label: 'Completion Rate', value: `${s.avg_completion_rate}%`, color: s.avg_completion_rate >= 80 ? GREEN : ORANGE },
    { label: 'Bugs Found/Fixed', value: `${s.total_bugs_found}/${s.total_bugs_fixed}`, color: s.total_bugs_found === s.total_bugs_fixed ? GREEN : RED },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
      {cards.map((c) => (
        <div key={c.label} style={{
          padding: 14, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function VelocityBar({ sprint, maxPts }: { sprint: VelocitySprint; maxPts: number }) {
  const committedPct = maxPts > 0 ? (sprint.committed / maxPts) * 100 : 0;
  const completedPct = maxPts > 0 ? (sprint.completed / maxPts) * 100 : 0;
  const isFinished = sprint.status === 'rest' || sprint.status === 'closed' || sprint.status === 'done';

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ width: 160, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sprint.sprint_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '1px 6px', borderRadius: 10, fontSize: 9, fontWeight: 600,
            background: `${statusColor(sprint.status)}18`, color: statusColor(sprint.status),
            fontFamily: 'var(--mono)',
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: statusColor(sprint.status) }} />
            {sprint.status}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            {sprint.tickets_done}/{sprint.tickets_total} tickets
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 55, fontSize: 10, color: BLUE, fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'right' }}>Commit</span>
          <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${committedPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ height: '100%', background: BLUE, borderRadius: 4, opacity: 0.7 }}
            />
          </div>
          <span style={{ width: 40, fontSize: 11, color: BLUE, fontFamily: 'var(--mono)', fontWeight: 600 }}>
            {sprint.committed}pt
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 55, fontSize: 10, color: GREEN, fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'right' }}>Done</span>
          <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completedPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              style={{ height: '100%', background: GREEN, borderRadius: 4 }}
            />
          </div>
          <span style={{ width: 40, fontSize: 11, color: GREEN, fontFamily: 'var(--mono)', fontWeight: 700 }}>
            {sprint.completed}pt
          </span>
        </div>
      </div>

      <div style={{ width: 60, textAlign: 'center', flexShrink: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)',
          color: isFinished
            ? sprint.completion_rate >= 90 ? GREEN : sprint.completion_rate >= 70 ? ORANGE : RED
            : 'var(--text3)',
        }}>
          {sprint.completion_rate}%
        </div>
        <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>rate</div>
      </div>
    </div>
  );
}

export function Velocity() {
  const data = useVelocityStore((s) => s.data);
  const loading = useVelocityStore((s) => s.loading);
  const error = useVelocityStore((s) => s.error);
  const fetchVelocity = useVelocityStore((s) => s.fetchVelocity);

  useEffect(() => {
    fetchVelocity();
  }, [fetchVelocity]);

  const sprints = data?.sprints ?? [];
  const maxPts = Math.max(...sprints.map(s => Math.max(s.committed, s.completed)), 1);
  const completedSprints = sprints.filter(s => s.status === 'rest' || s.status === 'closed' || s.status === 'done');

  if (loading && !data) {
    return (
      <div style={{ padding: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 72, background: 'var(--surface2)', borderRadius: 10, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--red, #ef4444)', fontSize: 13 }}>
        Failed to load velocity data: {error}
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={pageTransition}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <HeroText>
        Velocity Trends — <AnimatedNumber value={completedSprints.length} /> sprints completed,{' '}
        <AnimatedNumber value={data?.summary?.avg_completed ?? 0} />pt avg
      </HeroText>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {data && <SummaryCards data={data} />}

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Sprint-by-Sprint Velocity
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sprints.map((sprint) => (
            <VelocityBar key={sprint.sprint_id} sprint={sprint} maxPts={maxPts} />
          ))}
        </div>

        {sprints.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No sprint data yet. Complete a sprint to see velocity trends.
          </div>
        )}
      </div>
    </motion.div>
  );
}
