import React, { useState, useEffect, useCallback } from 'react';
import { PHASE_COLORS, PHASE_ORDER, getPhaseStyle, mapLegacyPhase } from '@/lib/phases';
import { get, put } from '@/lib/api';
import { useSprintStore } from '@/stores/sprintStore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PhaseConfig {
  name: string;
  criteria: string[];
  actions: string[];
  ceremonies?: string[];
  duration: string;
  mandatory?: boolean;
}

interface ProcessConfig {
  phases: PhaseConfig[];
}

/* ------------------------------------------------------------------ */
/*  Defaults — 4-phase model                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_PHASES: PhaseConfig[] = [
  {
    name: 'planning',
    criteria: ['Backlog groomed', 'Capacity confirmed', 'Sprint goal defined'],
    actions: ['Prepare sprint backlog', 'Align team on goals', 'Commit velocity'],
    ceremonies: ['Sprint Planning', 'Sprint Kickoff'],
    duration: '1 day',
  },
  {
    name: 'implementation',
    criteria: ['Sprint active', 'Tickets assigned'],
    actions: ['Start tickets', 'Daily standups', 'QA verification', 'Code cleanup'],
    duration: '3 days',
    mandatory: true,
  },
  {
    name: 'done',
    criteria: ['All tickets DONE', 'QA passed'],
    actions: ['Retrospective', 'Sprint Review', 'Archive sprint'],
    ceremonies: ['Retrospective', 'Sprint Review'],
    duration: '1 day',
  },
  {
    name: 'rest',
    criteria: ['Sprint closed'],
    actions: ['Team recovery', 'Knowledge sharing'],
    duration: '1 day',
  },
];

/* ------------------------------------------------------------------ */
/*  Keyframes (injected once)                                          */
/* ------------------------------------------------------------------ */

const STYLE_ID = 'process-flow-keyframes';

function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pf-dash {
      to { background-position: 24px 0; }
    }
    @keyframes pf-pulse {
      0%, 100% { opacity: .6; }
      50% { opacity: 1; }
    }
    @keyframes pf-arrow-pulse {
      0%, 100% { border-left-color: rgba(16,185,129,.5); }
      50% { border-left-color: rgba(16,185,129,1); }
    }
    @keyframes pf-walk {
      0% { left: 0; }
      100% { left: calc(100% - 8px); }
    }
    @keyframes pf-dot-glow {
      0%, 100% { box-shadow: 0 0 4px rgba(16,185,129,.4); }
      50% { box-shadow: 0 0 10px rgba(16,185,129,.9); }
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Animated horizontal connection line between two nodes */
function Connector({ status }: { status: 'done' | 'current' | 'future' }) {
  const color =
    status === 'done'
      ? '#10b981'
      : status === 'current'
        ? '#10b981'
        : 'var(--border)';

  const lineStyle: React.CSSProperties = {
    width: 48,
    height: 2,
    alignSelf: 'center',
    flexShrink: 0,
    position: 'relative',
    backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 12px)`,
    backgroundSize: '12px 2px',
    ...(status === 'current'
      ? { animation: 'pf-dash .8s linear infinite, pf-pulse 1.6s ease-in-out infinite' }
      : {}),
  };

  const arrowStyle: React.CSSProperties = {
    width: 0,
    height: 0,
    alignSelf: 'center',
    borderTop: '4px solid transparent',
    borderBottom: '4px solid transparent',
    borderLeft: `6px solid ${color}`,
    flexShrink: 0,
    ...(status === 'current'
      ? { animation: 'pf-arrow-pulse 1.6s ease-in-out infinite' }
      : {}),
  };

  const walkingDot: React.CSSProperties | null =
    status === 'current'
      ? {
          position: 'absolute',
          top: -3,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#10b981',
          animation: 'pf-walk 1.2s ease-in-out infinite alternate, pf-dot-glow 1.2s ease-in-out infinite',
        }
      : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <div style={lineStyle}>
        {walkingDot && <div style={walkingDot} />}
      </div>
      <div style={arrowStyle} />
    </div>
  );
}

/** A single phase node card */
function PhaseNode({
  phase,
  isExpanded,
  onToggle,
  onSave,
}: {
  phase: PhaseConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (updated: PhaseConfig) => void;
}) {
  const style = getPhaseStyle(phase.name);
  const colors = PHASE_COLORS[phase.name] ?? PHASE_COLORS.planning;

  const [criteria, setCriteria] = useState(phase.criteria.join('\n'));
  const [actions, setActions] = useState(phase.actions.join('\n'));
  const [duration, setDuration] = useState(phase.duration);

  useEffect(() => {
    setCriteria(phase.criteria.join('\n'));
    setActions(phase.actions.join('\n'));
    setDuration(phase.duration);
  }, [phase]);

  const handleSave = () => {
    onSave({
      ...phase,
      criteria: criteria
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      actions: actions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      duration,
    });
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    color: 'var(--text3)',
    fontFamily: 'var(--font)',
    marginBottom: 4,
    marginTop: 10,
  };

  const listStyle: React.CSSProperties = {
    margin: 0,
    padding: '0 0 0 14px',
    fontSize: 11,
    color: 'var(--text2)',
    fontFamily: 'var(--mono)',
    lineHeight: 1.6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    padding: '5px 7px',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color .2s',
      }}
      onClick={!isExpanded ? onToggle : undefined}
    >
      {/* Header */}
      <div
        style={{
          background: colors.bg,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontFamily: 'var(--font)',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '-0.01em',
          }}
        >
          {style.label}
        </span>
        <span
          style={{
            color: 'rgba(255,255,255,.65)',
            fontFamily: 'var(--mono)',
            fontSize: 10,
          }}
        >
          {phase.duration}
        </span>
      </div>

      {/* Body */}
      <div style={{ background: 'var(--surface2)', padding: '6px 10px 10px' }}>
        {!isExpanded ? (
          <>
            {phase.ceremonies && phase.ceremonies.length > 0 && (
              <>
                <div style={{ ...labelStyle, color: 'var(--accent)' }}>Ceremonies</div>
                <ul style={listStyle}>
                  {phase.ceremonies.map((c, i) => (
                    <li key={i} style={{ color: 'var(--text)' }}>{c}</li>
                  ))}
                </ul>
              </>
            )}
            <div style={labelStyle}>Entry Criteria</div>
            <ul style={listStyle}>
              {phase.criteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <div style={labelStyle}>Auto Actions</div>
            <ul style={listStyle}>
              {phase.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            {phase.mandatory && (
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--orange)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mandatory
              </div>
            )}
          </>
        ) : (
          <>
            <div style={labelStyle}>Entry Criteria (one per line)</div>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={3}
              style={inputStyle}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={labelStyle}>Auto Actions (one per line)</div>
            <textarea
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              rows={3}
              style={inputStyle}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={labelStyle}>Duration</div>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ ...inputStyle, resize: 'none' }}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                style={{
                  flex: 1,
                  background: colors.bg,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  padding: '5px 0',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                Save
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                style={{
                  flex: 1,
                  background: 'var(--surface)',
                  color: 'var(--text3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '5px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ProcessFlow() {
  const [phases, setPhases] = useState<PhaseConfig[]>(DEFAULT_PHASES);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ensureKeyframes();
  }, []);

  // Fetch config — normalize legacy 10-phase configs down to 4
  useEffect(() => {
    get<ProcessConfig>('/api/sprint-process')
      .then((cfg) => {
        if (cfg?.phases?.length) {
          const normalized = cfg.phases.map((p) => ({
            ...p,
            name: mapLegacyPhase(p.name.toLowerCase().replace(/^\d+\.\s*/, '').trim()),
          }));
          // Deduplicate by canonical phase name (keep first occurrence)
          const seen = new Set<string>();
          const deduped = normalized.filter((p) => {
            if (seen.has(p.name)) return false;
            seen.add(p.name);
            return true;
          });
          // Ensure all 4 phases are present
          const finalPhases = PHASE_ORDER.map(
            (name) => deduped.find((p) => p.name === name) ?? DEFAULT_PHASES.find((d) => d.name === name)!,
          );
          setPhases(finalPhases);
        }
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  // Live sprint status
  const sprints = useSprintStore((s) => s.sprints);
  const sprintDetail = useSprintStore((s) => s.sprintDetail);

  const activeSprintStatus = (() => {
    if (sprintDetail && sprintDetail.status !== 'closed' && sprintDetail.status !== 'rest' && sprintDetail.status !== 'done') {
      return mapLegacyPhase(sprintDetail.status);
    }
    const active = sprints.find((s) =>
      s.status !== 'closed' && s.status !== 'rest' && s.status !== 'done'
    );
    return active ? mapLegacyPhase(active.status) : null;
  })();

  const currentIdx = activeSprintStatus
    ? phases.findIndex((p) => p.name === activeSprintStatus)
    : -1;

  const connectorStatus = (idx: number): 'done' | 'current' | 'future' => {
    if (idx + 1 < currentIdx) return 'done';
    if (idx + 1 === currentIdx || idx === currentIdx) return 'current';
    return 'future';
  };

  const handleSave = useCallback(
    async (idx: number, updated: PhaseConfig) => {
      const next = [...phases];
      next[idx] = updated;
      setPhases(next);
      setExpandedIdx(null);
      setSaving(true);
      try {
        await put('/api/sprint-process', { phases: next });
      } catch {
        /* silent */
      } finally {
        setSaving(false);
      }
    },
    [phases],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}
          >
            Sprint Process Flow
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--font)',
              fontSize: 13,
              color: 'var(--text3)',
            }}
          >
            4-phase sprint lifecycle. Click a phase to edit entry criteria, auto-actions, and duration.
          </p>
        </div>
        {saving && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text3)',
            }}
          >
            Saving...
          </span>
        )}
      </div>

      {/* Flow pipeline — single row of 4 phases */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0,
          overflowX: 'auto',
          padding: '8px 0 16px',
        }}
      >
        {phases.map((phase, i) => (
          <React.Fragment key={phase.name}>
            <PhaseNode
              phase={phase}
              isExpanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
              onSave={(updated) => handleSave(i, updated)}
            />
            {i < phases.length - 1 && (
              <Connector status={connectorStatus(i)} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          padding: '8px 0',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            Completed / Active
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            Upcoming
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px rgba(16,185,129,.7)',
            }}
          />
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            Walking arrow (active transition)
          </span>
        </div>
      </div>
    </div>
  );
}
