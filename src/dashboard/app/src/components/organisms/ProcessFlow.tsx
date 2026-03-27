import React, { useState, useEffect, useCallback } from 'react';
import { PHASE_COLORS, PHASE_ORDER, getPhaseStyle } from '@/lib/phases';
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
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_PHASES: PhaseConfig[] = [
  {
    name: 'preparation',
    criteria: ['Backlog groomed', 'Capacity confirmed'],
    actions: ['Prepare sprint backlog'],
    duration: '0.5 day',
  },
  {
    name: 'kickoff',
    criteria: ['Preparation complete'],
    actions: ['Align team on goals', 'Assign roles'],
    ceremonies: ['Sprint Kickoff'],
    duration: '0.5 day',
  },
  {
    name: 'planning',
    criteria: ['Sprint goal defined', 'Tickets assigned'],
    actions: ['Commit velocity'],
    ceremonies: ['Sprint Planning'],
    duration: '0.5 day',
  },
  {
    name: 'implementation',
    criteria: ['Sprint active'],
    actions: ['Start tickets', 'Daily standups'],
    duration: '3 days',
  },
  {
    name: 'qa',
    criteria: ['All tickets DONE'],
    actions: ['Verify acceptance criteria', 'Run tests'],
    duration: '1 day',
    mandatory: true,
  },
  {
    name: 'refactoring',
    criteria: ['QA passed'],
    actions: ['Code cleanup', 'Tech debt reduction'],
    duration: '0.5 day',
  },
  {
    name: 'retro',
    criteria: ['Refactoring complete'],
    actions: ['Auto-generate analysis', 'Collect findings'],
    ceremonies: ['Retrospective'],
    duration: '0.5 day',
  },
  {
    name: 'review',
    criteria: ['Retro complete'],
    actions: ['Stakeholder demo', 'Approve deliverables'],
    ceremonies: ['Sprint Review'],
    duration: '0.5 day',
  },
  {
    name: 'closed',
    criteria: ['Review approved'],
    actions: ['Rebuild marketing stats', 'Archive sprint'],
    duration: '\u2014',
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
    @keyframes pf-walk-vertical {
      0% { top: 0; }
      100% { top: calc(100% - 8px); }
    }
    @keyframes pf-dot-glow {
      0%, 100% { box-shadow: 0 0 4px rgba(16,185,129,.4); }
      50% { box-shadow: 0 0 10px rgba(16,185,129,.9); }
    }
    @keyframes pf-bug-pulse {
      0%, 100% { opacity: .7; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Animated horizontal connection line between two nodes */
function Connector({ status, isBugReturn }: { status: 'done' | 'current' | 'future'; isBugReturn?: boolean }) {
  const color = isBugReturn
    ? '#ef4444'
    : status === 'done'
      ? '#10b981'
      : status === 'current'
        ? '#10b981'
        : 'var(--border)';

  const lineStyle: React.CSSProperties = {
    width: 36,
    height: 2,
    alignSelf: 'center',
    flexShrink: 0,
    position: 'relative',
    backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 12px)`,
    backgroundSize: '12px 2px',
    ...(isBugReturn
      ? { animation: 'pf-bug-pulse 1.2s ease-in-out infinite' }
      : status === 'current'
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
    ...(status === 'current' && !isBugReturn
      ? { animation: 'pf-arrow-pulse 1.6s ease-in-out infinite' }
      : {}),
  };

  /* Walking dot on current connector */
  const walkingDot: React.CSSProperties | null =
    status === 'current' && !isBugReturn
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

/** Vertical connector between row 1 and row 2 */
function VerticalConnector({ status }: { status: 'done' | 'current' | 'future' }) {
  const color =
    status === 'done' ? '#10b981' : status === 'current' ? '#10b981' : 'var(--border)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 2,
          flex: 1,
          position: 'relative',
          backgroundImage: `repeating-linear-gradient(180deg, ${color} 0 6px, transparent 6px 12px)`,
          backgroundSize: '2px 12px',
          ...(status === 'current'
            ? { animation: 'pf-pulse 1.6s ease-in-out infinite' }
            : {}),
        }}
      >
        {status === 'current' && (
          <div
            style={{
              position: 'absolute',
              left: -3,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#10b981',
              animation: 'pf-walk-vertical 1.2s ease-in-out infinite alternate, pf-dot-glow 1.2s ease-in-out infinite',
            }}
          />
        )}
      </div>
      {/* Down arrow */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: `6px solid ${color}`,
        }}
      />
    </div>
  );
}

/** A single phase node card */
function PhaseNode({
  phase,
  isExpanded,
  onToggle,
  onSave,
  isQaBugState,
}: {
  phase: PhaseConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (updated: PhaseConfig) => void;
  isQaBugState?: boolean;
}) {
  const style = getPhaseStyle(phase.name);
  const colors = PHASE_COLORS[phase.name] ?? PHASE_COLORS.planning;

  const [criteria, setCriteria] = useState(phase.criteria.join('\n'));
  const [actions, setActions] = useState(phase.actions.join('\n'));
  const [duration, setDuration] = useState(phase.duration);

  // Sync local state when phase prop changes (e.g. after fetch)
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

  const isQa = phase.name === 'qa';

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
        width: 180,
        flexShrink: 0,
        background: 'var(--surface)',
        border: `1px solid ${isQa && isQaBugState ? '#ef4444' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color .2s',
        ...(isQa && isQaBugState ? { boxShadow: '0 0 8px rgba(239,68,68,.3)' } : {}),
      }}
      onClick={!isExpanded ? onToggle : undefined}
    >
      {/* Header */}
      <div
        style={{
          background: colors.bg,
          padding: '6px 10px',
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
            fontSize: 12,
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

      {/* QA unpassable badge */}
      {isQa && (
        <div
          style={{
            background: isQaBugState ? '#fef2f2' : '#fffbeb',
            padding: '3px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderBottom: `1px solid ${isQaBugState ? '#fecaca' : '#fde68a'}`,
          }}
        >
          <span style={{ fontSize: 10 }}>{isQaBugState ? '\u274c' : '\ud83d\udee1\ufe0f'}</span>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--mono)',
              fontWeight: 700,
              color: isQaBugState ? '#dc2626' : '#d97706',
              textTransform: 'uppercase',
              letterSpacing: '.04em',
            }}
          >
            {isQaBugState ? 'Returns to Implementation' : 'Unpassable Gate'}
          </span>
        </div>
      )}

      {/* Body */}
      <div style={{ background: 'var(--surface2)', padding: '6px 10px 10px' }}>
        {!isExpanded ? (
          /* ---- Collapsed view ---- */
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
          /* ---- Expanded (edit) view ---- */
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

/** Red dashed "bug return" arrow from QA back to Implementation */
function BugReturnArrow() {
  return (
    <div
      style={{
        position: 'absolute',
        top: -28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontFamily: 'var(--mono)',
          color: '#ef4444',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          whiteSpace: 'nowrap',
          animation: 'pf-bug-pulse 1.2s ease-in-out infinite',
        }}
      >
        if bugs \u2192 back to Implementation
      </span>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderBottom: '5px solid #ef4444',
        }}
      />
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

  // Fetch config
  useEffect(() => {
    get<ProcessConfig>('/api/sprint-process')
      .then((cfg) => {
        if (cfg?.phases?.length) {
          // Normalize names to lowercase to match PHASE_COLORS keys
          const normalized = cfg.phases.map((p) => ({
            ...p,
            name: p.name.toLowerCase().replace(/^\d+\.\s*/, '').trim(),
          }));
          setPhases(normalized);
        }
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  // Live sprint status — find the active (non-closed) sprint and map its status to phase index
  const sprints = useSprintStore((s) => s.sprints);
  const sprintDetail = useSprintStore((s) => s.sprintDetail);

  const activeSprintStatus = (() => {
    // Prefer the selected sprint detail, then fall back to first non-closed sprint
    if (sprintDetail && sprintDetail.status !== 'closed' && sprintDetail.status !== 'rest') {
      return sprintDetail.status;
    }
    const active = sprints.find((s) =>
      s.status !== 'closed' && s.status !== 'rest'
    );
    return active?.status ?? null;
  })();

  const currentIdx = activeSprintStatus
    ? phases.findIndex((p) => p.name === activeSprintStatus)
    : -1;

  // Row 1: phases 0-4, Row 2: phases 5-9
  const row1 = phases.slice(0, 5);
  const row2 = phases.slice(5, 10);

  const connectorStatus = (idx: number): 'done' | 'current' | 'future' => {
    if (idx < currentIdx) return 'done';
    if (idx === currentIdx) return 'current';
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
        /* silent — local state already updated */
      } finally {
        setSaving(false);
      }
    },
    [phases],
  );

  const renderRow = (rowPhases: PhaseConfig[], startIdx: number) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0,
      }}
    >
      {rowPhases.map((phase, i) => {
        const globalIdx = startIdx + i;
        return (
          <React.Fragment key={phase.name}>
            <PhaseNode
              phase={phase}
              isExpanded={expandedIdx === globalIdx}
              onToggle={() => setExpandedIdx(expandedIdx === globalIdx ? null : globalIdx)}
              onSave={(updated) => handleSave(globalIdx, updated)}
              isQaBugState={phase.name === 'qa' && currentIdx === 4}
            />
            {i < rowPhases.length - 1 && (
              <Connector status={connectorStatus(globalIdx)} />
            )}
          </React.Fragment>
        );
      })}
    </div>
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
            10-phase sprint lifecycle. Click a phase to edit entry criteria, auto-actions, and duration.
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

      {/* Flow pipeline — 2 rows of 5 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflowX: 'auto',
          padding: '8px 0 16px',
        }}
      >
        {/* Row 1: Preparation -> Kickoff -> Planning -> Implementation -> QA */}
        <div style={{ position: 'relative' }}>
          {renderRow(row1, 0)}
          {/* Bug return label positioned above the QA-Implementation connection area */}
          <BugReturnArrow />
        </div>

        {/* Vertical connector from QA (end of row 1) down to Refactoring (start of row 2) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 90 }}>
          <VerticalConnector status={connectorStatus(4)} />
        </div>

        {/* Row 2: Refactoring -> Retro -> Review -> Closed -> Rest Day */}
        {renderRow(row2, 5)}
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
          <div style={{ width: 16, height: 2, backgroundImage: 'repeating-linear-gradient(90deg, #ef4444 0 4px, transparent 4px 8px)', backgroundSize: '8px 2px' }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            Bug return (QA \u2192 Implementation)
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
