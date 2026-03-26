export const PAGES = ['explorer', 'planning', 'sprint'] as const;
export type PageId = typeof PAGES[number];

export const PAGE_LABELS: Record<PageId, string> = {
  explorer: 'Code Explorer',
  planning: 'Project Management',
  sprint: 'Sprint',
};
