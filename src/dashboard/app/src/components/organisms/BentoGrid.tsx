import { useEffect, useState } from 'react';
import { useSprintStore } from '@/stores/sprintStore';
import { BentoCard } from '@/components/molecules/BentoCard';
import type { RetroFinding } from '@/types';

export function BentoGrid() {
  const sprints = useSprintStore((s) => s.sprints);
  const fetchRetro = useSprintStore((s) => s.fetchRetro);
  const [allFindings, setAllFindings] = useState<RetroFinding[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sprints.length === 0) return;

    setLoading(true);
    Promise.all(
      sprints.map((s) =>
        fetch(`/api/sprints/${s.id}/retro`)
          .then((r) => r.json())
          .catch(() => [] as RetroFinding[])
      )
    )
      .then((results) => {
        const flat = (results as RetroFinding[][]).flat();
        setAllFindings(flat);
      })
      .finally(() => setLoading(false));
  }, [sprints.length]);

  const well = allFindings.filter((f) => f.category === 'went_well');
  const wrong = allFindings.filter((f) => f.category === 'went_wrong');
  const tryNext = allFindings.filter((f) => f.category === 'try_next');

  return (
    <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          Retro Insights
        </span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {loading
            ? 'Loading…'
            : `${allFindings.length} findings across ${sprints.length} sprints`}
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
        {/* Recurring Topics — wide (spans 2 cols) */}
        <BentoCard
          icon="🔄"
          title="Recurring Topics"
          subtitle="Patterns across all sprints"
          borderColor="var(--purple)"
          iconBg="rgba(167,139,250,.15)"
          wide
          items={[
            'Subagent file writes fail silently — never trust claims without disk verification',
            'Retros skipped when sprints feel "green" — 3 consecutive skips before enforcement added',
            'Ticket ID confusion — internal DB IDs vs sequential numbers cause update errors',
            'Sprint velocity stabilized at 19pt after early over-commitment (27pt in S2)',
            'Frontend/backend capacity imbalance recurs — 8pt individual cap was the fix',
          ]}
        />

        {/* Stats card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            borderTop: '3px solid var(--text3)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            gap: 4,
          }}
        >
          {[
            { v: well.length, c: 'var(--accent)', l: 'went well' },
            { v: wrong.length, c: 'var(--red)', l: 'went wrong' },
            { v: tryNext.length, c: 'var(--purple)', l: 'try next' },
          ].map(({ v, c, l }, i) => (
            <div key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: c, lineHeight: 1.1 }}>
                {v}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Recurring Good */}
        <BentoCard
          icon="✅"
          title="Recurring Good"
          subtitle="Consistently positive"
          borderColor="var(--accent)"
          iconBg="rgba(16,185,129,.15)"
          items={[
            '19pt velocity target hit consistently — conservative planning works',
            'Zero-dependency approach — CSS-only animations, no new libs added',
            'Parallel QA agents cut verification from 4min to 60s',
            'Direct file writes + build verification prevents false completions',
            'MCP-driven sprint process enables full delivery in one session',
          ]}
        />

        {/* Recurring Bad */}
        <BentoCard
          icon="⚠️"
          title="Recurring Bad"
          subtitle="Persistent pain points"
          borderColor="var(--red)"
          iconBg="rgba(248,113,113,.15)"
          items={[
            'Subagents hallucinate file writes — report success with zero disk changes',
            'Retro process repeatedly skipped despite being flagged every time',
            'No integration tests for MCP tools — only schema tests exist',
            'Context limits from plugin injections force mid-sprint handoffs',
            'Data import idempotency issues cause CASCADE deletes',
          ]}
        />

        {/* Best Moment */}
        <BentoCard
          icon="🌟"
          title="Best Moment"
          subtitle="Highlight across all sprints"
          borderColor="var(--blue)"
          iconBg="rgba(59,130,246,.15)"
          items={[
            'Every INSTRUCTIONS.md requirement delivered — landing page, dashboard, sprint board, agent health, milestones, mobile responsive, security review, full docs. 6 sprints from zero to complete.',
            '28 MCP tools, 9 agents, full dashboard with kanban/gantt/velocity shipped by milestone close',
          ]}
        />

        {/* Worst Moment */}
        <BentoCard
          icon="💥"
          title="Worst Moment"
          subtitle="Biggest setback"
          borderColor="var(--orange)"
          iconBg="rgba(251,191,36,.15)"
          items={[
            "Sprint 2 over-committed at 27pt — only 59% delivered, caused a full cleanup sprint (S4) that shouldn't have been needed",
            'Scrum data import race condition — INSERT OR REPLACE triggered CASCADE deletes wiping ticket statuses',
          ]}
        />
      </div>
    </div>
  );
}
