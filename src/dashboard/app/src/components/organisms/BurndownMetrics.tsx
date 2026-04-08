'use client';

import { useState, useEffect, useMemo } from 'react';
import { get } from '@/lib/api';
import { Skeleton } from '@/components/atoms/Skeleton';
import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';

interface BurndownMetric {
  date: string;
  remaining_points: number;
  completed_points: number;
  added_points: number;
  removed_points: number;
}

interface BurndownData {
  sprint_name: string;
  committed: number;
  start_date: string | null;
  end_date: string | null;
  current: { remaining: number; completed: number; total: number };
  metrics: BurndownMetric[];
}

interface DailyChange {
  date: string;
  completed: number;
  added: number;
  removed: number;
  netChange: number;
}

interface Prediction {
  idealVelocity: number;
  currentVelocity: number;
  projectedCompletion: string | null;
  onTrack: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

interface SprintBurndownProps {
  sprintId?: number;
}

export function BurndownMetrics({ sprintId }: SprintBurndownProps) {
  const [data, setData] = useState<BurndownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    if (!sprintId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    get<BurndownData>(`/api/sprint/${sprintId}/burndown`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sprintId]);

  const analysis = useMemo(() => {
    if (!data || data.metrics.length === 0) return null;

    const { committed, current, metrics } = data;
    const total = committed || current.total;

    // Calculate daily changes
    const dailyChanges: DailyChange[] = metrics.map((m, i) => {
      const prev = i > 0 ? metrics[i - 1] : null;
      const completed = m.completed_points - (prev?.completed_points || 0);
      const added = m.added_points - (prev?.added_points || 0);
      const removed = m.removed_points - (prev?.removed_points || 0);
      return {
        date: m.date,
        completed: Math.max(0, completed),
        added: Math.max(0, added),
        removed: Math.max(0, removed),
        netChange: added - removed - completed
      };
    });

    // Calculate velocity and predictions
    const completedPerDay = dailyChanges.filter(d => d.completed > 0);
    const avgVelocity = completedPerDay.length > 0
      ? completedPerDay.reduce((sum, d) => sum + d.completed, 0) / completedPerDay.length
      : 0;

    const idealVelocity = total > 0 && data.end_date && data.start_date
      ? total / Math.max(1, getDaysBetween(data.start_date, data.end_date))
      : 0;

    const remaining = current.remaining;
    const daysUntilEnd = data.end_date ? getDaysUntil(data.end_date) : null;
    const projectedDays = avgVelocity > 0 ? Math.ceil(remaining / avgVelocity) : null;

    const projectedCompletion = projectedDays !== null && data.start_date
      ? addDays(data.start_date, projectedDays)
      : null;

    const isOnTrack = avgVelocity >= idealVelocity * 0.8;
    const riskLevel: 'low' | 'medium' | 'high' = avgVelocity >= idealVelocity ? 'low' : avgVelocity >= idealVelocity * 0.6 ? 'medium' : 'high';

    // Scope changes
    const totalAdded = metrics.reduce((sum, m) => sum + m.added_points, 0);
    const totalRemoved = metrics.reduce((sum, m) => sum + m.removed_points, 0);
    const scopeChange = totalAdded - totalRemoved;

    // Burn rate
    const burnRate = total > 0 ? (current.completed / total) * 100 : 0;
    const daysElapsed = data.start_date ? getDaysUntil(new Date().toISOString().split('T')[0]) - getDaysUntil(data.start_date) : 0;
    const expectedBurnRate = data.end_date && data.start_date
      ? (daysElapsed / Math.max(1, getDaysBetween(data.start_date, data.end_date))) * 100
      : 0;

    return {
      dailyChanges,
      prediction: {
        idealVelocity,
        currentVelocity: avgVelocity,
        projectedCompletion,
        onTrack: isOnTrack,
        riskLevel
      },
      scopeChanges: {
        added: totalAdded,
        removed: totalRemoved,
        net: scopeChange
      },
      progressMetrics: {
        burnRate: Math.round(burnRate),
        expectedBurnRate: Math.round(expectedBurnRate),
        completionRate: burnRate - expectedBurnRate
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton width="100%" height={200} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        color: 'var(--text3)',
        fontSize: 13,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)'
      }}>
        No burndown data available for this sprint
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header with risk indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Burndown Metrics
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>
            {data.sprint_name} — {data.current.completed}/{data.committed || data.current.total} points completed
          </p>
        </div>
        {analysis && (
          <RiskBadge level={analysis.prediction.riskLevel} onTrack={analysis.prediction.onTrack} />
        )}
      </div>

      {/* Key Metrics Grid */}
      {analysis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MetricCard
            label="Current Velocity"
            value={`${analysis.prediction.currentVelocity.toFixed(1)} pts/day`}
            subtitle={`Ideal: ${analysis.prediction.idealVelocity.toFixed(1)} pts/day`}
            color={analysis.prediction.currentVelocity >= analysis.prediction.idealVelocity ? 'var(--accent)' : 'var(--orange)'}
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>}
          />
          <MetricCard
            label="Completion Rate"
            value={`${analysis.progressMetrics.burnRate}%`}
            subtitle={analysis.progressMetrics.completionRate >= 0 ? 'Ahead of schedule' : 'Behind schedule'}
            color={analysis.progressMetrics.completionRate >= 0 ? 'var(--accent)' : 'var(--red)'}
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2}/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth={2}/></svg>}
          />
          <MetricCard
            label="Scope Change"
            value={`${analysis.scopeChanges.net > 0 ? '+' : ''}${analysis.scopeChanges.net} pts`}
            subtitle={`${analysis.scopeChanges.added} added, ${analysis.scopeChanges.removed} removed`}
            color={analysis.scopeChanges.net === 0 ? 'var(--blue)' : analysis.scopeChanges.net > 0 ? 'var(--orange)' : 'var(--accent)'}
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2}/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth={2}/></svg>}
          />
          <MetricCard
            label="Projected"
            value={analysis.prediction.projectedCompletion || 'TBD'}
            subtitle={analysis.prediction.onTrack ? 'On track' : 'Needs attention'}
            color={analysis.prediction.onTrack ? 'var(--accent)' : 'var(--red)'}
            icon={<svg width={16} height={16} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth={2}/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth={2}/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth={2}/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth={2}/></svg>}
          />
        </div>
      )}

      {/* Expandable Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Daily Activity */}
        <ExpandableSection
          title="Daily Activity"
          expanded={expandedSection === 'daily'}
          onToggle={() => setExpandedSection(expandedSection === 'daily' ? null : 'daily')}
        >
          {analysis && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text3)', fontWeight: 600 }}>Date</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text3)', fontWeight: 600 }}>Completed</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text3)', fontWeight: 600 }}>Added</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text3)', fontWeight: 600 }}>Removed</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text3)', fontWeight: 600 }}>Net Change</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.dailyChanges.slice().reverse().slice(0, 7).map((change, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', color: 'var(--text)' }}>{change.date}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                        +{change.completed}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--orange)', fontFamily: 'var(--mono)' }}>
                        +{change.added}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--blue)', fontFamily: 'var(--mono)' }}>
                        -{change.removed}
                      </td>
                      <td style={{
                        padding: '8px',
                        textAlign: 'right',
                        fontFamily: 'var(--mono)',
                        color: change.netChange > 0 ? 'var(--red)' : change.netChange < 0 ? 'var(--accent)' : 'var(--text3)'
                      }}>
                        {change.netChange > 0 ? '+' : ''}{change.netChange}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ExpandableSection>

        {/* Velocity Trend */}
        <ExpandableSection
          title="Velocity Trend"
          expanded={expandedSection === 'velocity'}
          onToggle={() => setExpandedSection(expandedSection === 'velocity' ? null : 'velocity')}
        >
          {analysis && (
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Current vs Ideal Velocity</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                    {Math.round((analysis.prediction.currentVelocity / Math.max(0.1, analysis.prediction.idealVelocity)) * 100)}%
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--surface3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (analysis.prediction.currentVelocity / Math.max(0.1, analysis.prediction.idealVelocity)) * 100)}%`,
                      height: '100%',
                      background: analysis.prediction.currentVelocity >= analysis.prediction.idealVelocity ? 'var(--accent)' : 'var(--orange)',
                      borderRadius: 4,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <StatItem label="Ideal Velocity" value={`${analysis.prediction.idealVelocity.toFixed(1)} pts/day`} />
                <StatItem label="Actual Velocity" value={`${analysis.prediction.currentVelocity.toFixed(1)} pts/day`} />
                <StatItem label="Remaining Points" value={`${data.current.remaining} pts`} />
                <StatItem
                  label="Est. Days Left"
                  value={analysis.prediction.currentVelocity > 0 ? Math.ceil(data.current.remaining / analysis.prediction.currentVelocity) : '∞'}
                />
              </div>
            </div>
          )}
        </ExpandableSection>

        {/* Scope Analysis */}
        <ExpandableSection
          title="Scope Analysis"
          expanded={expandedSection === 'scope'}
          onToggle={() => setExpandedSection(expandedSection === 'scope' ? null : 'scope')}
        >
          {analysis && (
            <div style={{ padding: '16px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <ScopeChangeItem label="Added" value={analysis.scopeChanges.added} type="added" />
                <ScopeChangeItem label="Removed" value={analysis.scopeChanges.removed} type="removed" />
                <ScopeChangeItem label="Net" value={analysis.scopeChanges.net} type="net" />
              </div>

              <div style={{
                padding: 12,
                background: analysis.scopeChanges.net > 0 ? 'var(--orange)10' : 'var(--accent)10',
                border: `1px solid ${analysis.scopeChanges.net > 0 ? 'var(--orange)30' : 'var(--accent)30'}`,
                borderRadius: 8
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  {analysis.scopeChanges.net > 0 ? 'Scope Warning' : 'Scope Healthy'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {analysis.scopeChanges.net > 0
                    ? `Sprint has grown by ${analysis.scopeChanges.net} points. Consider moving lower priority items to backlog.`
                    : 'Scope is well managed. Scope changes are balanced or negative.'}
                </div>
              </div>
            </div>
          )}
        </ExpandableSection>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
}

function MetricCard({ label, value, subtitle, color, icon }: MetricCardProps) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      borderTop: `3px solid ${color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1.2 }}>
            {value}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

interface ExpandableSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ExpandableSection({ title, expanded, onToggle, children }: ExpandableSectionProps) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden'
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font)'
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text3)"
          strokeWidth={2}
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0 16px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high';
  onTrack: boolean;
}

function RiskBadge({ level, onTrack }: RiskBadgeProps) {
  const config = {
    low: { bg: 'var(--accent)15', border: 'var(--accent)40', text: 'var(--accent)', label: 'Low Risk' },
    medium: { bg: 'var(--orange)15', border: 'var(--orange)40', text: 'var(--orange)', label: 'Medium Risk' },
    high: { bg: 'var(--red)15', border: 'var(--red)40', text: 'var(--red)', label: 'High Risk' }
  }[level];

  return (
    <div style={{
      padding: '6px 14px',
      borderRadius: 16,
      background: config.bg,
      border: `1px solid ${config.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: config.text,
        animation: onTrack ? 'none' : 'pulse 1.5s infinite'
      }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: config.text }}>
        {config.label}
      </span>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
        {value}
      </div>
    </div>
  );
}

function ScopeChangeItem({ label, value, type }: { label: string; value: number; type: 'added' | 'removed' | 'net' }) {
  const colors = {
    added: 'var(--orange)',
    removed: 'var(--accent)',
    net: value > 0 ? 'var(--red)' : value < 0 ? 'var(--accent)' : 'var(--text3)'
  };

  return (
    <div style={{
      padding: 12,
      background: 'var(--bg)',
      borderRadius: 8,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        color: colors[type],
        fontFamily: 'var(--mono)'
      }}>
        {value > 0 ? '+' : ''}{value}
      </div>
    </div>
  );
}

// Helper functions
function getDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
}

function getDaysUntil(dateStr: string): number {
  return Math.max(0, Math.round((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
