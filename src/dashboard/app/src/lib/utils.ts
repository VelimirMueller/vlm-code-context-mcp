export function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

export const langColors: Record<string, string> = {
  typescript: '#3178c6', javascript: '#f7df1e', css: '#264de4', json: '#292929',
  html: '#e34c26', markdown: '#083fa1', python: '#3572A5', unknown: '#666',
};

export function getMoodColor(score: number): string {
  if (score >= 60) return 'var(--accent)';
  if (score >= 40) return 'var(--orange)';
  return 'var(--red)';
}
