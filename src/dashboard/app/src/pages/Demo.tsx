'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { get } from '@/lib/api';

interface SprintData {
  id: number;
  name: string;
  status: string;
  ticket_count: number;
  done_count: number;
  velocity_committed: number;
  velocity_completed: number;
  created_at: string;
}

interface Stats {
  files: number;
  exports: number;
  deps: number;
  totalLines: number;
}

interface ActivityEvent {
  id: number;
  entity_type: string;
  action: string;
  actor: string;
  created_at: string;
}

const COMPARISON_ROWS = [
  { label: 'Sprint kickoff', mcp: '~5 min guided wizard', trad: '2–3 h meetings + docs' },
  { label: 'Ticket creation', mcp: 'Auto-generated from goal', trad: 'Manual Jira/Linear entry' },
  { label: 'Context retention', mcp: 'Persisted in SQLite DB', trad: 'Lost between sessions' },
  { label: 'Discovery logging', mcp: 'Auto-captured during work', trad: 'Post-hoc, often skipped' },
  { label: 'Sprint metrics', mcp: 'Real-time from DB', trad: 'Manual tracking / EOD update' },
  { label: 'Retro findings', mcp: 'Structured + queryable', trad: 'Confluence pages / sticky notes' },
  { label: 'Token usage (est.)', mcp: '~25k tokens / feature', trad: 'N/A (human time only)' },
];

function MetricCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${accent ? 'rgba(16,185,129,.35)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--mono)', color: accent ? 'var(--accent)' : 'var(--text)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 14, background: 'var(--accent)', borderRadius: 2 }} />
      {children}
    </div>
  );
}

export function Demo() {
  const [sprints, setSprints] = useState<SprintData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    get<SprintData[]>('/api/sprints').then(setSprints).catch(() => {});
    get<Stats>('/api/stats').then(setStats).catch(() => {});
    get<ActivityEvent[]>('/api/activity').then(setActivity).catch(() => {});
  }, []);

  const activeSprint = sprints[0] ?? null;
  const totalTickets = sprints.reduce((s, sp) => s + sp.ticket_count, 0);
  const totalDone = sprints.reduce((s, sp) => s + sp.done_count, 0);
  const mcpActions = activity.filter(e => e.actor === 'mcp' || !e.actor).length;

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%', maxWidth: 960, margin: '0 auto' }}>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,.08) 0%, rgba(139,92,246,.06) 100%)',
          border: '1px solid rgba(16,185,129,.2)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 32,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 10 }}>
          ◈ Code Context MCP
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
          AI-powered sprint management — built inside the IDE
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text2)', margin: '12px 0 0', lineHeight: 1.7, maxWidth: 640 }}>
          Code Context MCP turns Claude into a full Scrum team. It runs kickoffs, tracks discoveries,
          persists every finding to a local SQLite database, and gives you a live dashboard — all
          without leaving your editor or paying for external project management tools.
        </p>
      </motion.div>

      {/* Live sprint metrics */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle>Live sprint metrics</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <MetricCard label="Sprints run" value={sprints.length} sub="total sessions" accent />
          <MetricCard label="Tickets" value={`${totalDone}/${totalTickets}`} sub="done / created" />
          <MetricCard label="MCP actions" value={mcpActions} sub="automated tool calls" />
          <MetricCard label="Files indexed" value={stats?.files ?? '—'} sub={stats ? `${(stats.totalLines / 1000).toFixed(1)}k lines` : undefined} />
          {activeSprint && (
            <MetricCard
              label="Active sprint"
              value={activeSprint.status}
              sub={`${activeSprint.done_count}/${activeSprint.ticket_count} tickets done`}
              accent
            />
          )}
        </div>
      </div>

      {/* MCP vs Traditional */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle>MCP vs traditional workflow</SectionTitle>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            padding: '10px 16px',
            background: 'var(--surface2)',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Task</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>With MCP</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Traditional</span>
          </div>
          {COMPARISON_ROWS.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                padding: '11px 16px',
                borderBottom: i < COMPARISON_ROWS.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{row.label}</span>
              <span style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                {row.mcp}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{row.trad}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Precision & reliability */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle>Precision &amp; reliability</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            {
              title: 'Zero context loss',
              body: 'Every finding, ticket, and retro note is written to SQLite immediately. Claude can resume any sprint exactly where it left off — no re-explaining the state of the project.',
              icon: '◉',
            },
            {
              title: 'Structured discovery',
              body: 'Bugs and surprises found during implementation are captured as discoveries with resolution plans. They feed directly into the next sprint\'s backlog instead of disappearing into chat history.',
              icon: '◈',
            },
            {
              title: 'QA gates enforced',
              body: 'Tickets cannot be marked DONE without qa_verified = true. The scrum process enforces this at every transition, not as a suggestion but as a hard schema constraint.',
              icon: '✓',
            },
            {
              title: 'Velocity tracking',
              body: 'Story points committed vs completed are tracked per sprint. Velocity trends inform the next planning cycle automatically — no spreadsheet needed.',
              icon: '▸',
            },
          ].map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>{card.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{card.title}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, margin: 0 }}>{card.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* This page as proof */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          background: 'rgba(16,185,129,.05)',
          border: '1px solid rgba(16,185,129,.2)',
          borderRadius: 12,
          padding: '18px 22px',
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>◈</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
            This page is its own proof
          </div>
          <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, margin: 0 }}>
            The Demo tab was proposed as T-002 during a <code style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontSize: 11 }}>/kickoff</code> session,
            ticketed automatically from a meta-ticket (T-1), linked to a discovery that fixed the Vite proxy bug
            along the way, and implemented in a single sprint. No Jira. No standup. No context switching.
            The entire feature lifecycle — from idea to shipped — lived inside Claude Code.
          </p>
        </div>
      </motion.div>

    </div>
  );
}
