'use client';

import { useState, useCallback } from 'react';
import { PHASE_ORDER, getPhaseStyle } from '@/lib/phases';
import { get, put } from '@/lib/api';

interface GateResult {
  canTransition: boolean;
  blockers: string[];
  warnings: string[];
}

interface PhaseGateStepperProps {
  currentPhase: string;
  sprintId: number;
  onTransition?: () => void;
}

export function PhaseGateStepper({ currentPhase, sprintId, onTransition }: PhaseGateStepperProps) {
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);
  const [gateResult, setGateResult] = useState<GateResult | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const nextPhase = currentIdx >= 0 && currentIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[currentIdx + 1] : null;

  const fetchGate = useCallback(async (phase: string) => {
    setGateLoading(true);
    try {
      const result = await get<GateResult>(`/api/sprint/${sprintId}/gate/${phase}`);
      setGateResult(result);
    } catch {
      setGateResult({ canTransition: false, blockers: ['Failed to fetch gate status'], warnings: [] });
    } finally {
      setGateLoading(false);
    }
  }, [sprintId]);

  const handleHover = useCallback((phase: string) => {
    const phaseIdx = PHASE_ORDER.indexOf(phase);
    if (phaseIdx === currentIdx + 1) {
      setHoveredPhase(phase);
      fetchGate(phase);
    }
  }, [currentIdx, fetchGate]);

  const handleLeave = useCallback(() => {
    setHoveredPhase(null);
    setGateResult(null);
  }, []);

  const handleNextPhase = useCallback(async () => {
    if (!nextPhase) return;
    setGateLoading(true);
    try {
      const result = await get<GateResult>(`/api/sprint/${sprintId}/gate/${nextPhase}`);
      setGateResult(result);
      setConfirmOpen(true);
    } catch {
      setGateResult({ canTransition: false, blockers: ['Failed to fetch gate status'], warnings: [] });
      setConfirmOpen(true);
    } finally {
      setGateLoading(false);
    }
  }, [sprintId, nextPhase]);

  const handleConfirmTransition = useCallback(async () => {
    if (!nextPhase) return;
    setTransitioning(true);
    try {
      await put(`/api/sprint/${sprintId}`, { status: nextPhase });
      setConfirmOpen(false);
      setGateResult(null);
      onTransition?.();
    } catch (err: any) {
      const msg = err?.message ?? 'Transition failed';
      setGateResult({ canTransition: false, blockers: [msg], warnings: [] });
    } finally {
      setTransitioning(false);
    }
  }, [sprintId, nextPhase, onTransition]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Stepper row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {PHASE_ORDER.map((phase, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isNext = idx === currentIdx + 1;
          const style = getPhaseStyle(phase);

          return (
            <div key={phase} style={{ display: 'flex', alignItems: 'center', flex: idx < PHASE_ORDER.length - 1 ? 1 : 0 }}>
              {/* Circle */}
              <div
                onMouseEnter={() => isNext ? handleHover(phase) : undefined}
                onMouseLeave={handleLeave}
                style={{
                  position: 'relative',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                  cursor: isNext ? 'pointer' : 'default',
                  transition: 'all .2s',
                  ...(isCompleted
                    ? { background: '#10b981', color: 'white', border: '2px solid #10b981' }
                    : isCurrent
                      ? { background: style.bg, color: 'white', border: `2px solid ${style.border}` }
                      : { background: 'transparent', color: 'var(--text3)', border: '2px solid var(--border)' }
                  ),
                }}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}

                {/* Tooltip on hover for next phase */}
                {hoveredPhase === phase && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 34,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      minWidth: 180,
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                      fontSize: 11,
                    }}
                  >
                    {gateLoading ? (
                      <div style={{ color: 'var(--text3)' }}>Checking gate...</div>
                    ) : gateResult ? (
                      <div>
                        <div style={{
                          fontWeight: 700,
                          marginBottom: 4,
                          color: gateResult.canTransition ? '#10b981' : 'var(--red)',
                        }}>
                          {gateResult.canTransition ? 'Ready to transition' : 'Blocked'}
                        </div>
                        {gateResult.blockers.map((b, i) => (
                          <div key={i} style={{ color: 'var(--red)', marginBottom: 2 }}>
                            {b}
                          </div>
                        ))}
                        {gateResult.warnings.map((w, i) => (
                          <div key={i} style={{ color: '#f59e0b', marginBottom: 2 }}>
                            {w}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Phase label below */}
              <div
                style={{
                  position: 'absolute',
                  marginTop: 38,
                  fontSize: 9,
                  fontWeight: 600,
                  color: isCurrent ? style.bg : isCompleted ? '#10b981' : 'var(--text3)',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {style.label}
              </div>

              {/* Connector line */}
              {idx < PHASE_ORDER.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: idx < currentIdx ? '#10b981' : 'var(--border)',
                    margin: '0 4px',
                    transition: 'background .2s',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase labels row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 2 }}>
        {PHASE_ORDER.map((phase, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const style = getPhaseStyle(phase);
          return (
            <div key={phase} style={{ flex: idx < PHASE_ORDER.length - 1 ? 1 : 0, textAlign: 'left' }}>
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: isCurrent ? style.bg : isCompleted ? '#10b981' : 'var(--text3)',
                textTransform: 'uppercase',
              }}>
                {style.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Next Phase button */}
      {nextPhase && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <button
            onClick={handleNextPhase}
            disabled={gateLoading || transitioning}
            style={{
              background: getPhaseStyle(nextPhase).bg,
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 700,
              cursor: gateLoading || transitioning ? 'not-allowed' : 'pointer',
              opacity: gateLoading || transitioning ? 0.6 : 1,
              fontFamily: 'var(--font)',
              transition: 'opacity .15s',
            }}
          >
            Next Phase: {getPhaseStyle(nextPhase).label} →
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmOpen && gateResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '20px 24px',
              minWidth: 320,
              maxWidth: 440,
              boxShadow: '0 8px 24px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              Transition to {nextPhase ? getPhaseStyle(nextPhase).label : ''}?
            </div>

            {gateResult.blockers.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Blockers</div>
                {gateResult.blockers.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--red)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                    {b}
                  </div>
                ))}
              </div>
            )}

            {gateResult.warnings.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>Warnings</div>
                {gateResult.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#f59e0b', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {gateResult.canTransition && gateResult.blockers.length === 0 && gateResult.warnings.length === 0 && (
              <div style={{ fontSize: 12, color: '#10b981', marginBottom: 10 }}>
                All checks passed. Ready to proceed.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 16px',
                  fontSize: 12,
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                Cancel
              </button>
              {gateResult.canTransition && (
                <button
                  onClick={handleConfirmTransition}
                  disabled={transitioning}
                  style={{
                    background: nextPhase ? getPhaseStyle(nextPhase).bg : 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: transitioning ? 'not-allowed' : 'pointer',
                    opacity: transitioning ? 0.6 : 1,
                    fontFamily: 'var(--font)',
                  }}
                >
                  {transitioning ? 'Transitioning...' : 'Confirm'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
