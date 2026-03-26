import type { Milestone } from '@/types';

/**
 * Parse the MILESTONES skill markdown into structured Milestone objects.
 *
 * Expected format per section:
 *   ## Milestone N: Name — STATUS
 *   **Status:** ... (Sprints ...)
 *   **Goal:** description text
 */
export function parseMilestoneMarkdown(content: string): Milestone[] {
  const milestones: Milestone[] = [];
  // Split on "## Milestone" headers
  const sections = content.split(/(?=^## Milestone \d)/m);

  for (const section of sections) {
    const headerMatch = section.match(
      /^## Milestone (\d+):\s*(.+?)(?:\s*[—–-]\s*(.+?))?\s*$/m,
    );
    if (!headerMatch) continue;

    const id = parseInt(headerMatch[1], 10);
    const name = headerMatch[2].trim();
    const statusHint = (headerMatch[3] || '').trim().toUpperCase();

    // Extract goal / description
    const goalMatch = section.match(/\*\*Goal:\*\*\s*(.+)/i);
    const description = goalMatch ? goalMatch[1].trim() : null;

    // Map status
    let status: string = 'planned';
    if (/COMPLETE|DONE/.test(statusHint)) {
      status = 'completed';
    } else if (/IN\s*PROGRESS|ACTIVE/.test(statusHint)) {
      status = 'in_progress';
    }

    const progress = status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0;

    milestones.push({
      id,
      name: `Milestone ${id}: ${name}`,
      description,
      status,
      target_date: null,
      progress,
      ticket_count: 0,
      done_count: 0,
    });
  }

  return milestones;
}

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
