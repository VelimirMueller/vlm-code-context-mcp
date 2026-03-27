export const PHASE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  planning: { bg: '#636474', border: '#818498', label: 'Planning' },
  implementation: { bg: '#10b981', border: '#34d399', label: 'Implementation' },
  qa: { bg: '#f59e0b', border: '#fbbf24', label: 'QA' },
  retro: { bg: '#a78bfa', border: '#c4b5fd', label: 'Retro' },
  closed: { bg: '#3b82f6', border: '#60a5fa', label: 'Closed' },
};

export const PHASE_ORDER = ['planning', 'implementation', 'qa', 'retro', 'closed'];

export function getPhaseStyle(status: string) {
  return PHASE_COLORS[status] ?? PHASE_COLORS.planning;
}
