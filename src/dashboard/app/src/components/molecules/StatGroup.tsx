import React from 'react';
import { Stat } from '@/components/atoms/Stat';
import { fmtSize } from '@/lib/utils';
import type { Stats } from '@/types';

interface StatGroupProps {
  stats: Stats | null;
}

export function StatGroup({ stats }: StatGroupProps) {
  if (!stats) return null;

  return (
    <div
      className="stats"
      style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}
    >
      <Stat value={stats.files} label="files" />
      <Stat value={stats.exports} label="exports" />
      <Stat value={stats.dependencies} label="deps" />
      <Stat value={stats.lines.toLocaleString()} label="lines" />
      <Stat value={fmtSize(stats.size)} label="size" />
    </div>
  );
}
