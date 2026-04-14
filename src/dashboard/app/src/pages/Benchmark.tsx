'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useComparisonStore, type PerCallAvg, type TaskProjection } from '@/stores/comparisonStore';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { HeroText } from '@/components/molecules/HeroText';
import { pageVariants, pageTransition } from '@/lib/motion';

const OLD_COLOR = '#f59e0b';
const NEW_COLOR = '#10b981';

function TokenBar({ label, old, nw, unit }: { label: string; old: number; nw: number; unit?: string }) {
  const max = Math.max(old, nw) || 1;
  const oldPct = (old / max) * 100;
  const newPct = (nw / max) * 100;
  const saved = old - nw;
  const pct = old > 0 ? Math.round((saved / old) * 100) : 0;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 42, fontSize: 10, color: OLD_COLOR, fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'right' }}>OLD</span>
          <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${oldPct}%` }} transition={{ duration: 0.6 }}
              style={{ height: '100%', background: OLD_COLOR, borderRadius: 4, opacity: 0.5 }} />
          </div>
          <span style={{ width: 64, fontSize: 11, fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--text2)' }}>
            {old.toLocaleString()}{unit ? ` ${unit}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 42, fontSize: 10, color: NEW_COLOR, fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'right' }}>NEW</span>
          <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${newPct}%` }} transition={{ duration: 0.6 }}
              style={{ height: '100%', background: NEW_COLOR, borderRadius: 4 }} />
          </div>
          <span style={{ width: 64, fontSize: 11, fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--text2)' }}>
            {nw.toLocaleString()}{unit ? ` ${unit}` : ''}
          </span>
        </div>
      </div>
      {saved > 0 && (
        <div style={{ fontSize: 10, color: NEW_COLOR, fontFamily: 'var(--mono)', marginTop: 2, textAlign: 'right' }}>
          {saved.toLocaleString()} saved ({pct}%)
        </div>
      )}
    </div>
  );
}

function PerCallTable({ averages }: { averages: PerCallAvg[] }) {
  return (
    <div style={{ background: 'var(--surface1)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 12 }}>Per-Call Token Averages (measured)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--mono)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 600 }}>Tool</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: OLD_COLOR, fontWeight: 600 }}>OLD</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: NEW_COLOR, fontWeight: 600 }}>NEW</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 600 }}>Saved</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 600 }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {averages.map((a) => (
            <tr key={a.tool} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '6px 8px', color: 'var(--text1)' }}>{a.tool}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text2)' }}>{a.old_tokens}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text2)' }}>{a.new_tokens}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: a.saved > 0 ? NEW_COLOR : a.saved < 0 ? OLD_COLOR : 'var(--text3)' }}>
                {a.saved > 0 ? `-${a.saved}` : a.saved < 0 ? `+${Math.abs(a.saved)}` : '0'} ({a.saved_pct}%)
              </td>
              <td style={{ padding: '6px 8px', color: 'var(--text3)', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.change}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskCard({ task }: { task: TaskProjection }) {
  return (
    <div style={{ background: 'var(--surface1)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>[{task.id}] {task.label}</h3>
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: NEW_COLOR, fontWeight: 700 }}>
          -{task.saved_pct}%
        </span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>{task.description}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text1)', fontFamily: 'var(--mono)' }}>
            <AnimatedNumber value={task.total_calls} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase' }}>Tool calls</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: OLD_COLOR, fontFamily: 'var(--mono)' }}>
            <AnimatedNumber value={task.old.total_tokens} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase' }}>Old tokens</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: NEW_COLOR, fontFamily: 'var(--mono)' }}>
            <AnimatedNumber value={task.new.total_tokens} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase' }}>New tokens</div>
        </div>
      </div>
      <TokenBar label="Output tokens" old={task.old.total_tokens} nw={task.new.total_tokens} unit="tok" />
    </div>
  );
}

export function Benchmark() {
  const { data, loading, error, fetchComparison } = useComparisonStore();

  useEffect(() => { fetchComparison(); }, [fetchComparison]);

  if (loading) return <div style={{ padding: 32, color: 'var(--text3)' }}>Loading benchmark data...</div>;
  if (error) return <div style={{ padding: 32, color: '#ef4444' }}>Error: {error}</div>;
  if (!data?.benchmark) return <div style={{ padding: 32, color: 'var(--text3)' }}>No benchmark data. Place comparison.json next to context.db.</div>;

  const { benchmark, tasks, grand_total, meta } = data;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}
      style={{ padding: '0 24px 24px', maxWidth: 1100, margin: '0 auto' }}>

      <HeroText
        title="Token Benchmark"
        subtitle={meta.sprint}
        stats={[
          { label: 'Saved', value: `${grand_total.saved_pct}%`, color: NEW_COLOR },
          { label: 'Old tokens', value: grand_total.old_tokens.toLocaleString() },
          { label: 'New tokens', value: grand_total.new_tokens.toLocaleString() },
          { label: 'Tool calls', value: grand_total.total_calls.toLocaleString() },
        ]}
      />

      {/* Grand total bar */}
      <div style={{ background: 'var(--surface1)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginBottom: 16 }}>
        <TokenBar label="Total output tokens across all tasks" old={grand_total.old_tokens} nw={grand_total.new_tokens} unit="tok" />
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{grand_total.quality}</div>
      </div>

      {/* Task cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 16 }}>
        {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
      </div>

      {/* Per-call averages table */}
      <PerCallTable averages={benchmark.per_call_averages} />

      {/* Audit notes */}
      <div style={{ background: 'var(--surface1)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginTop: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 }}>Audit Notes</h3>
        <div style={{ display: 'grid', gap: 6 }}>
          {Object.entries(benchmark.audit_notes).map(([key, value]) => (
            <div key={key} style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{key}:</span> {value}
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
        {meta.measurement_note}
      </div>
    </motion.div>
  );
}
