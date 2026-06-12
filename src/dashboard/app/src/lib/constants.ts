export const MODEL_OPTIONS = [
  { value: 'claude-fable-5', label: 'Fable 5 — Most capable' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8 — Powerful' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — Balanced' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 — Fast' },
] as const;

export const PAGES = ['explorer', 'planning', 'sprint'] as const;
export type PageId = typeof PAGES[number];

export const PAGE_LABELS: Record<PageId, string> = {
  explorer: 'Code Explorer',
  planning: 'Project Management',
  sprint: 'Sprint',
};
