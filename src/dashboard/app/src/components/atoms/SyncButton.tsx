import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface SyncButtonProps {
  onSync: () => void;
  loading?: boolean;
  lastSyncedAt?: string | null;
  label?: string;
}

export function SyncButton({ onSync, loading = false, lastSyncedAt, label = 'Sync' }: SyncButtonProps) {
  const reduceMotion = useReducedMotion();

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <motion.button
        onClick={onSync}
        disabled={loading}
        whileTap={reduceMotion ? undefined : { scale: 0.93 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid var(--border2)',
          background: 'var(--surface3)',
          color: loading ? 'var(--text3)' : 'var(--text2)',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font)',
          fontSize: 12,
          fontWeight: 500,
          opacity: loading ? 0.7 : 1,
          transition: 'background .15s, opacity .15s',
        }}
        aria-label={label}
      >
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: loading ? 'spin 1s linear infinite' : 'none',
          }}
        >
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
        {label}
      </motion.button>
      {lastSyncedAt && (
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          Synced {formatTime(lastSyncedAt)}
        </span>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
