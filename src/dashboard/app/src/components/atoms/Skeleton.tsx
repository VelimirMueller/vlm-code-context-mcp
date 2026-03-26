import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export function Skeleton({ width = '100%', height = 14, className = '', count = 1 }: SkeletonProps) {
  const bars = Array.from({ length: count });
  return (
    <>
      {bars.map((_, i) => (
        <div
          key={i}
          className={`skeleton skeleton-bar ${className}`}
          style={{ width, height, margin: '8px 0', borderRadius: 6 }}
        />
      ))}
    </>
  );
}
