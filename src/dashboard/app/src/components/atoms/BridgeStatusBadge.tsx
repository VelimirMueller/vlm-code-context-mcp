import { useEffect } from 'react';
import { useBridgeStore } from '@/stores/bridgeStore';

export function BridgeStatusBadge() {
  const status = useBridgeStore((s) => s.status);
  const fetchStatus = useBridgeStore((s) => s.fetchStatus);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status) return null;

  const hasPending = status.pending > 0;
  const hasClaimed = status.claimed > 0;

  const dotColor = hasClaimed ? 'var(--blue)' : hasPending ? 'var(--yellow, #eab308)' : 'var(--green, #22c55e)';
  const label = hasClaimed
    ? `${status.claimed} action${status.claimed > 1 ? 's' : ''} running`
    : hasPending
    ? `${status.pending} action${status.pending > 1 ? 's' : ''} queued`
    : 'Bridge idle';

  return (
    <div
      title={`Bridge: ${status.pending} pending, ${status.claimed} claimed, ${status.completed} completed, ${status.failed} failed`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        color: 'var(--text3)',
        fontFamily: 'var(--mono)',
        padding: '3px 8px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        cursor: 'default',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          animation: hasClaimed ? 'pulse 1s ease-in-out infinite' : undefined,
        }}
      />
      {label}
    </div>
  );
}
