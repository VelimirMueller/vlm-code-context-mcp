/**
 * ProcessFlow utility types, step configs, and status detection.
 * Extracted from ProcessFlow.tsx for separation of concerns.
 */

export type StepStatus = 'completed' | 'active' | 'pending' | 'blocked';

export interface FlowStep {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: StepStatus;
}

export interface ProcessFlowStepConfig {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const STEP_CONFIGS: ProcessFlowStepConfig[] = [
  { id: 'vision', label: 'Vision', description: 'Define the product vision, goals, and strategic direction for the team.', icon: 'vision' },
  { id: 'discovery', label: 'Discovery', description: 'Explore architecture, UX, performance, and integration findings before committing work.', icon: 'discovery' },
  { id: 'milestone', label: 'Milestone', description: 'Set milestones with target dates to structure delivery checkpoints.', icon: 'milestone' },
  { id: 'epics', label: 'Epics', description: 'Break milestones into epic-level workstreams spanning multiple sprints.', icon: 'epics' },
  { id: 'tickets', label: 'Tickets', description: 'Create sprint-sized tickets from epics — each one completable in a day.', icon: 'tickets' },
  { id: 'sprint', label: 'Sprint', description: 'Launch a sprint with a measurable goal, velocity target, and assigned tickets.', icon: 'sprint' },
  { id: 'implementation', label: 'Build', description: 'Develop, review, and verify — move tickets from TODO to DONE.', icon: 'implementation' },
  { id: 'retro', label: 'Retro', description: 'Reflect on what went well, what went wrong, and what to try next.', icon: 'retro' },
  { id: 'archive', label: 'Archive', description: 'Close the sprint, archive discoveries, update milestones, and rest.', icon: 'archive' },
];

export function deriveStepStatus(
  stepId: string,
  hasVision: boolean,
  hasDiscoveries: boolean,
  hasMilestones: boolean,
  hasEpics: boolean,
  hasBacklogTickets: boolean,
  hasActiveSprint: boolean,
  sprintStatus: string | null,
  sprintHasBlockers: boolean,
): StepStatus {
  const activeSprintPhase = sprintStatus?.toLowerCase() ?? '';

  const completedUpTo = (() => {
    if (!hasVision) return -1;
    if (!hasDiscoveries) return 0;
    if (!hasMilestones) return 1;
    if (!hasEpics) return 2;
    if (!hasBacklogTickets) return 3;
    if (!hasActiveSprint) return 4;
    if (activeSprintPhase === 'preparation' || activeSprintPhase === 'kickoff' || activeSprintPhase === 'planning') return 5;
    if (activeSprintPhase === 'implementation' || activeSprintPhase === 'qa' || activeSprintPhase === 'refactoring') return 6;
    if (activeSprintPhase === 'retro' || activeSprintPhase === 'review') return 7;
    if (activeSprintPhase === 'closed' || activeSprintPhase === 'done' || activeSprintPhase === 'rest') return 8;
    return 4;
  })();

  const stepIndex = STEP_CONFIGS.findIndex((s) => s.id === stepId);

  if (stepIndex < completedUpTo) return 'completed';
  if (stepIndex === completedUpTo) {
    if (stepId === 'implementation' && sprintHasBlockers) return 'blocked';
    return 'active';
  }
  return 'pending';
}

export const STATUS_COLORS: Record<StepStatus, string> = {
  completed: '#10b981',
  active: '#3b82f6',
  blocked: '#f87171',
  pending: 'var(--text3)',
};
