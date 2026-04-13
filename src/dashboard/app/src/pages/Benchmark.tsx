'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useComparisonStore, type ComparisonTask, type TaskMetrics } from '@/stores/comparisonStore';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { HeroText } from '@/components/molecules/HeroText';
import { pageVariants, pageTransition } from '@/lib/motion';

const MCP_COLOR = '#10b981';
const VANILLA_COLOR = '#f59e0b';

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    done: { bg: 'rgba(16,185,129,.12)', color: '#10b981', label: 'Done' },
    in_progress: { bg: 'rgba(59,130,246,.12)', color: '#3b82f6', label: 'In Progress' },
    pending: { bg: 'rgba(113,113,122,.12)', color: '#71717a', label: 'Pending' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
      background: s.bg, color: s.color, fontFamily: 'var(--mono)',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

function MetricBar({ label, mcp, vanilla, unit, lowerIsBetter }: {
  label: string;
  mcp: number | null;
  vanilla: number | null;
  unit?: string;
  lowerIsBetter?: boolean;
}) {
  if (mcp == null && vanilla == null) return null;
  const max = Math.max(mcp ?? 0, vanilla ?? 0) || 1;
  const mcpPct = ((mcp ?? 0) / max) * 100;
  const vanillaPct = ((vanilla ?? 0) / max) * 100;

  const mcpWins = lowerIsBetter ? (mcp ?? Infinity) < (vanilla ?? Infinity) : (mcp ?? 0) > (vanilla ?? 0);
  const vanillaWins = !mcpWins && mcp !== vanilla;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 42, fontSize: 10, color: MCP_COLOR, fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'right' }}>MCP</span>
          <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${mcpPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ height: '100%', background: MCP_COLOR, borderRadius: 4, opacity: mcpWins ? 1 : 0.5 }}
            />
          </div>
          <span style={{ width: 60, fontSize: 11, color: mcpWins ? MCP_COLOR : 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: mcpWins ? 700 : 400 }}>
            {mcp != null ? `${mcp.toLocaleString()}${unit ?? ''}` : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 42, fontSize: 10, color: VANILLA_COLOR, fontFamily: 'var(--mono)', fontWeight: 600, textAlign: 'right' }}>VAN</span>
          <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${vanillaPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              style={{ height: '100%', background: VANILLA_COLOR, borderRadius: 4, opacity: vanillaWins ? 1 : 0.5 }}
            />
          </div>
          <span style={{ width: 60, fontSize: 11, color: vanillaWins ? VANILLA_COLOR : 'var(--text3)', fontFamily: 'var(--mono)', fontWeight: vanillaWins ? 700 : 400 }}>
            {vanilla != null ? `${vanilla.toLocaleString()}${unit ?? ''}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function savingsPct(mcp: number | null, vanilla: number | null): string {
  if (mcp == null || vanilla == null || vanilla === 0) return '—';
  const pct = Math.round(((vanilla - mcp) / vanilla) * 100);
  return pct > 0 ? `${pct}% less` : pct < 0 ? `${Math.abs(pct)}% more` : 'same';
}

function TaskCard({ task }: { task: ComparisonTask }) {
  const done = task.mcp.status === 'done' && task.vanilla.status === 'done';

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 20, flex: 1, minWidth: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{task.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{task.description}</div>
        </div>
        <span style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '4px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text2)',
        }}>
          {task.points}pt
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: MCP_COLOR }} /> MCP {statusBadge(task.mcp.status)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: VANILLA_COLOR }} /> Vanilla {statusBadge(task.vanilla.status)}
        </div>
      </div>

      <MetricBar label="Duration" mcp={task.mcp.duration_min} vanilla={task.vanilla.duration_min} unit="m" lowerIsBetter />
      <MetricBar label="Tokens" mcp={task.mcp.tokens_used} vanilla={task.vanilla.tokens_used} lowerIsBetter />
      <MetricBar label="Tool Calls" mcp={task.mcp.tool_calls} vanilla={task.vanilla.tool_calls} lowerIsBetter />
      <MetricBar label="Lines Changed" mcp={task.mcp.lines_changed} vanilla={task.vanilla.lines_changed} lowerIsBetter />
      <MetricBar label="Context Lookups" mcp={task.mcp.context_lookups} vanilla={task.vanilla.context_lookups} />

      {done && (
        <div style={{
          marginTop: 12, padding: '8px 12px', background: 'rgba(16,185,129,.06)',
          border: '1px solid rgba(16,185,129,.15)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            MCP Savings
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Time', val: savingsPct(task.mcp.duration_min, task.vanilla.duration_min) },
              { label: 'Tokens', val: savingsPct(task.mcp.tokens_used, task.vanilla.tokens_used) },
              { label: 'Tool Calls', val: savingsPct(task.mcp.tool_calls, task.vanilla.tool_calls) },
            ].map(({ label, val }) => (
              <span key={label} style={{ fontSize: 11, color: MCP_COLOR, fontFamily: 'var(--mono)' }}>
                {label}: <strong>{val}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {task.reasoning && (
        <div style={{
          marginTop: 12, padding: '10px 14px', background: 'var(--surface2)',
          border: '1px solid var(--border)', borderRadius: 8,
          borderLeft: `3px solid ${MCP_COLOR}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Why MCP Won
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            {task.reasoning}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ tasks }: { tasks: ComparisonTask[] }) {
  const completed = tasks.filter(t => t.mcp.status === 'done' && t.vanilla.status === 'done');
  const totalMcpTime = completed.reduce((s, t) => s + (t.mcp.duration_min ?? 0), 0);
  const totalVanillaTime = completed.reduce((s, t) => s + (t.vanilla.duration_min ?? 0), 0);
  const totalMcpTokens = completed.reduce((s, t) => s + (t.mcp.tokens_used ?? 0), 0);
  const totalVanillaTokens = completed.reduce((s, t) => s + (t.vanilla.tokens_used ?? 0), 0);
  const timeSaved = totalVanillaTime > 0 ? Math.round(((totalVanillaTime - totalMcpTime) / totalVanillaTime) * 100) : 0;
  const tokensSaved = totalVanillaTokens > 0 ? Math.round(((totalVanillaTokens - totalMcpTokens) / totalVanillaTokens) * 100) : 0;

  const cards = [
    { label: 'Tasks Benchmarked', value: `${completed.length}/${tasks.length}`, color: 'var(--text)' },
    { label: 'MCP Time', value: `${totalMcpTime}m`, color: MCP_COLOR },
    { label: 'Vanilla Time', value: `${totalVanillaTime}m`, color: VANILLA_COLOR },
    { label: 'Time Saved', value: `${timeSaved}%`, color: timeSaved > 0 ? MCP_COLOR : 'var(--text3)' },
    { label: 'Token Saved', value: `${tokensSaved}%`, color: tokensSaved > 0 ? MCP_COLOR : 'var(--text3)' },
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

export function Benchmark() {
  const data = useComparisonStore((s) => s.data);
  const loading = useComparisonStore((s) => s.loading);
  const error = useComparisonStore((s) => s.error);
  const fetchComparison = useComparisonStore((s) => s.fetchComparison);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const tasks = data?.tasks ?? [];
  const completedCount = tasks.filter(t => t.mcp.status === 'done' && t.vanilla.status === 'done').length;

  if (loading && !data) {
    return (
      <div style={{ padding: 20 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 200, background: 'var(--surface2)', borderRadius: 12, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--red, #ef4444)', fontSize: 13 }}>
        Failed to load benchmark data: {error}
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
        MCP vs Vanilla — <AnimatedNumber value={completedCount} /> of <AnimatedNumber value={tasks.length} /> tasks benchmarked
      </HeroText>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {data?.meta && (
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
            {data.meta.sprint} &middot; Updated {new Date(data.meta.updated_at).toLocaleDateString()}
          </div>
        )}

        <SummaryCards tasks={tasks} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        {tasks.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No benchmark data yet. comparison.json will be populated as tasks complete.
          </div>
        )}
      </div>
    </motion.div>
  );
}
