export const PHASE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  preparation: { bg: '#6366f1', border: '#818cf8', label: 'Preparation' },
  kickoff: { bg: '#8b5cf6', border: '#a78bfa', label: 'Kickoff' },
  planning: { bg: '#636474', border: '#818498', label: 'Planning' },
  implementation: { bg: '#10b981', border: '#34d399', label: 'Implementation' },
  qa: { bg: '#f59e0b', border: '#fbbf24', label: 'QA' },
  refactoring: { bg: '#06b6d4', border: '#22d3ee', label: 'Refactoring' },
  retro: { bg: '#a78bfa', border: '#c4b5fd', label: 'Retro' },
  review: { bg: '#ec4899', border: '#f472b6', label: 'Review' },
  closed: { bg: '#3b82f6', border: '#60a5fa', label: 'Closed' },
  rest: { bg: '#84cc16', border: '#a3e635', label: 'Rest Day' },
};

export const PHASE_ORDER = ['preparation', 'kickoff', 'planning', 'implementation', 'qa', 'refactoring', 'retro', 'review', 'closed', 'rest'];

export function getPhaseStyle(status: string) {
  return PHASE_COLORS[status] ?? PHASE_COLORS.planning;
}
