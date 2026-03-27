import React, { useState, useEffect, useCallback } from 'react';
import { PHASE_COLORS, PHASE_ORDER, getPhaseStyle } from '@/lib/phases';
import { get, put } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PhaseConfig {
  name: string;
  criteria: string[];
  actions: string[];
  duration: string;
}

interface ProcessConfig {
  phases: PhaseConfig[];
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_PHASES: PhaseConfig[] = [
  {
    name: 'planning',
    criteria: ['Sprint goal defined', 'Tickets assigned'],
    actions: ['Commit velocity'],
    duration: '1 day',
  },
  {
    name: 'implementation',
    criteria: ['Sprint active'],
    actions: ['Start tickets'],
    duration: '3 days',
  },
  {
    name: 'qa',
    criteria: ['All tickets DONE'],
    actions: ['Verify acceptance criteria', 'Run tests'],
    duration: '1 day',
  },
  {
    name: 'retro',
    criteria: ['QA complete'],
    actions: ['Auto-generate analysis', 'Collect findings'],
    duration: '0.5 day',
  },
  {
    name: 'closed',
    criteria: ['Retro complete'],
    actions: ['Rebuild marketing stats', 'Archive sprint'],
    duration: '\u2014',
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
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Animated connection line between two nodes */
function Connector({ status }: { status: 'done' | 'current' | 'future' }) {
  const color =
    status === 'done' ? '#10b981' : status === 'current' ? '#10b981' : 'var(--border)';

  const lineStyle: React.CSSProperties = {
    width: 48,
    height: 2,
    alignSelf: 'center',
    flexShrink: 0,
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
    borderTop: '5px solid transparent',
    borderBottom: '5px solid transparent',
    borderLeft: `7px solid ${color}`,
    flexShrink: 0,
    ...(status === 'current' ? { animation: 'pf-arrow-pulse 1.6s ease-in-out infinite' } : {}),
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <div style={lineStyle} />
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
    fontSize: 12,
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
    fontSize: 11.5,
    padding: '6px 8px',
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        width: 210,
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
            fontSize: 11,
          }}
        >
          {phase.duration}
        </span>
      </div>

      {/* Body */}
      <div style={{ background: 'var(--surface2)', padding: '8px 12px 12px' }}>
        {!isExpanded ? (
          /* ---- Collapsed view ---- */
          <>
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
                  padding: '6px 0',
                  fontSize: 12,
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
                  padding: '6px 0',
                  fontSize: 12,
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

  // Fetch config
  useEffect(() => {
    get<ProcessConfig>('/api/sprint-process')
      .then((cfg) => {
        if (cfg?.phases?.length) setPhases(cfg.phases);
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  // Determine "current" phase index — for demo, treat index 1 (implementation) as current
  // In a real scenario this would come from the active sprint status
  const currentIdx = 1;

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
            Click a phase to edit entry criteria, auto-actions, and duration.
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

      {/* Flow pipeline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          overflowX: 'auto',
          padding: '8px 0 16px',
          gap: 0,
        }}
      >
        {phases.map((phase, idx) => (
          <React.Fragment key={phase.name}>
            <PhaseNode
              phase={phase}
              isExpanded={expandedIdx === idx}
              onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              onSave={(updated) => handleSave(idx, updated)}
            />
            {idx < phases.length - 1 && <Connector status={connectorStatus(idx)} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
