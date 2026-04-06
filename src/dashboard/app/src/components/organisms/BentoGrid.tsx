'use client';

import { useEffect } from 'react';
import { useSprintStore } from '@/stores/sprintStore';
import { BentoCard } from '@/components/molecules/BentoCard';

export function BentoGrid() {
  const sprints = useSprintStore((s) => s.sprints);
  const allFindings = useSprintStore((s) => s.allRetroFindings);
  const fetchAllRetro = useSprintStore((s) => s.fetchAllRetro);

  // Initial fetch (SSE will keep it updated via App.tsx)
  useEffect(() => {
    fetchAllRetro();
  }, [fetchAllRetro]);

  const loading = allFindings.length === 0 && sprints.length > 0;

  const well = allFindings.filter((f) => f.category === 'went_well');
  const wrong = allFindings.filter((f) => f.category === 'went_wrong');
  const tryNext = allFindings.filter((f) => f.category === 'try_next');

  // Dynamic findings from database - most recent first
  const recentFindings = [...allFindings]
    .sort((a, b) => {
      // Sort by sprint recency (using sprint_id as proxy)
      const sprintA = sprints.find(s => s.id === a.sprint_id);
      const sprintB = sprints.find(s => s.id === b.sprint_id);
      const dateA = sprintA?.created_at || '';
      const dateB = sprintB?.created_at || '';
      return dateB.localeCompare(dateA);
    })
    .slice(0, 10);

  // Group by finding text to find "patterns" (recurring themes)
  const findingPatterns = new Map<string, number>();
  allFindings.forEach(f => {
    const words = f.finding.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    words.forEach(word => {
      findingPatterns.set(word, (findingPatterns.get(word) || 0) + 1);
    });
  });
  const topPatterns = [...findingPatterns.entries()]
    .filter(([word]) => !['finding', 'issue', 'problem', 'error', 'good', 'bad', 'better'].includes(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => `${word} (${count}x)`);

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
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9a6 6 0 0110.2-4.3M15 9a6 6 0 01-10.2 4.3" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round"/><path d="M13.5 2.5v2.5H11M4.5 15.5v-2.5H7" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          title="Recurring Topics"
          subtitle="Patterns across all sprints"
          borderColor="var(--purple)"
          iconBg="rgba(167,139,250,.15)"
          wide
          items={
            topPatterns.length > 0
              ? topPatterns
              : ['No retro findings yet. Complete sprints to see patterns emerge.']
          }
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

        {/* Recent Went Well */}
        <BentoCard
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="var(--accent)" strokeWidth="1.5"/><path d="M6 9l2 2 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          title="Recent Wins"
          subtitle="What went well"
          borderColor="var(--accent)"
          iconBg="rgba(16,185,129,.15)"
          items={
            well.slice(0, 5).map(f => f.finding)
          }
        />

        {/* Recent Issues */}
        <BentoCard
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L1.5 15.5h15L9 2z" stroke="var(--red)" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 7v3.5" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="13" r="0.75" fill="var(--red)"/></svg>}
          title="Recent Issues"
          subtitle="What went wrong"
          borderColor="var(--red)"
          iconBg="rgba(248,113,113,.15)"
          items={
            wrong.slice(0, 5).map(f => f.finding)
          }
        />

        {/* Action Items */}
        <BentoCard
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5l2.3 4.7 5.2.8-3.8 3.7.9 5.1L9 13.5l-4.6 2.3.9-5.1L1.5 7l5.2-.8L9 1.5z" stroke="var(--blue)" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
          title="Action Items"
          subtitle="Try next time"
          borderColor="var(--blue)"
          iconBg="rgba(59,130,246,.15)"
          items={
            tryNext.slice(0, 5).map(f => f.finding)
          }
        />

        {/* All Recent Findings */}
        <BentoCard
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4h10M4 9h10M4 14h10" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          title="All Findings"
          subtitle={`Last ${Math.min(recentFindings.length, 10)} findings`}
          borderColor="var(--text2)"
          iconBg="rgba(100,116,139,.15)"
          wide
          items={
            recentFindings.slice(0, 10).map(f => {
              const sprint = sprints.find(s => s.id === f.sprint_id);
              const prefix = sprint ? `[${sprint.name}] ` : '';
              return prefix + f.finding;
            })
          }
        />
      </div>
    </div>
  );
}
