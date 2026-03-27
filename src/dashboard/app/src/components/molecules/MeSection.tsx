import React from 'react';
import { Skeleton } from '@/components/atoms/Skeleton';

interface MeSectionProps {
  title: string;
  count?: number;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  children: React.ReactNode;
  onRetry?: () => void;
}

export function MeSection({
  title,
  count,
  loading,
  error,
  emptyMessage,
  children,
  onRetry,
}: MeSectionProps) {
  const hasChildren = React.Children.count(children) > 0;

  return (
    <section style={{ marginBottom: 16 }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </span>
        {count != null && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              background: 'var(--surface2)',
              color: 'var(--text2)',
              fontFamily: 'var(--mono)',
            }}
          >
            {count}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && <Skeleton count={3} height={14} />}

      {/* Error state */}
      {!loading && error && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--red)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'none',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                padding: '2px 8px',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasChildren && emptyMessage && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>
          {emptyMessage}
        </div>
      )}

      {/* Content */}
      {!loading && !error && hasChildren && children}
    </section>
  );
}
