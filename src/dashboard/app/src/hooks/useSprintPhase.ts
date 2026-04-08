import { useSprintStore } from '@/stores/sprintStore';
import type { Sprint } from '@/types';

export type SprintPhase = 'none' | 'planning' | 'implementation' | 'qa' | 'done' | 'rest';

export interface SprintPhaseInfo {
  phase: SprintPhase;
  sprint: Sprint | null;
  nextAction: string;
  canStartSprint: boolean;
  canAdvance: boolean;
}

const STATUS_TO_PHASE: Record<string, SprintPhase> = {
  preparation: 'planning',
  kickoff: 'planning',
  planning: 'planning',
  implementation: 'implementation',
  qa: 'qa',
  refactoring: 'implementation',
  retro: 'done',
  review: 'done',
  done: 'done',
  closed: 'rest',
  rest: 'rest',
};

const NEXT_ACTION: Record<SprintPhase, string> = {
  none: 'Create tickets and start a sprint',
  planning: 'Finish planning and start implementation',
  implementation: 'Complete all tickets',
  qa: 'Verify all tickets pass QA',
  done: 'Run retrospective and close sprint',
  rest: 'Start a new sprint',
};

export function useSprintPhase(): SprintPhaseInfo {
  const sprints = useSprintStore((s) => s.sprints);

  // Find the most recent non-rest sprint, or the latest sprint
  const activeSprint = sprints.find((s) => s.status !== 'rest' && s.status !== 'closed') ?? null;
  const latestSprint = sprints.length > 0 ? sprints[0] : null;
  const sprint = activeSprint ?? latestSprint;

  if (!sprint || sprint.status === 'rest' || sprint.status === 'closed') {
    return {
      phase: sprints.length === 0 ? 'none' : 'rest',
      sprint,
      nextAction: sprints.length === 0 ? NEXT_ACTION.none : NEXT_ACTION.rest,
      canStartSprint: true,
      canAdvance: false,
    };
  }

  const phase = STATUS_TO_PHASE[sprint.status] ?? 'planning';

  return {
    phase,
    sprint,
    nextAction: NEXT_ACTION[phase],
    canStartSprint: phase === 'none' || phase === 'rest',
    canAdvance: phase === 'planning' || phase === 'implementation' || phase === 'done',
  };
}
