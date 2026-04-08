import { create } from 'zustand';
import { get } from '@/lib/api';
import type { Sprint, Ticket, RetroFinding, MilestoneSprintGroup, BurndownData, Blocker, Bug } from '@/types';

export type TicketFilter = 'all' | 'mine' | 'blocked' | 'qaPending' | 'unassigned';

export interface SprintDetail extends Sprint {
  goal: string | null;
}

export interface ActivityEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string | null;
  created_at: string;
}

export interface SprintStore {
  sprints: Sprint[];
  milestoneGroups: MilestoneSprintGroup[];
  selectedSprintId: number | null;
  sprintDetail: SprintDetail | null;
  tickets: Ticket[];
  retroFindings: RetroFinding[];
  allRetroFindings: (RetroFinding & { sprint_name?: string })[];
  selectedRetroFindings: RetroFinding[];
  burndown: BurndownData | null;
  blockers: Blocker[];
  bugs: Bug[];
  activities: ActivityEvent[];
  loading: { sprints: boolean; detail: boolean; grouped: boolean };
  error: { sprints: string | null; detail: string | null };
  ticketFilter: TicketFilter;
  currentUserName: string;

  fetchSprints: () => Promise<void>;
  fetchGroupedSprints: () => Promise<void>;
  selectSprint: (id: number) => Promise<void>;
  fetchTickets: (sprintId: number) => Promise<void>;
  fetchRetro: (sprintId: number) => Promise<void>;
  fetchAllRetro: () => Promise<void>;
  fetchBurndown: (sprintId: number) => Promise<void>;
  fetchBlockers: (sprintId: number) => Promise<void>;
  fetchBugs: (sprintId: number) => Promise<void>;
  fetchActivities: () => Promise<void>;
  clearError: () => void;
  setTicketFilter: (filter: TicketFilter) => void;
  setCurrentUserName: (name: string) => void;
  getFilteredTickets: () => Ticket[];
  getFilterCounts: () => {
    all: number;
    mine: number;
    blocked: number;
    qaPending: number;
  };
}

export const useSprintStore = create<SprintStore>((set, getState) => ({
  sprints: [],
  milestoneGroups: [],
  selectedSprintId: null,
  sprintDetail: null,
  tickets: [],
  retroFindings: [],
  allRetroFindings: [],
  selectedRetroFindings: [],
  burndown: null,
  blockers: [],
  bugs: [],
  activities: [],
  loading: { sprints: false, detail: false, grouped: false },
  error: { sprints: null, detail: null },
  ticketFilter: 'all',
  currentUserName: 'Me',

  fetchGroupedSprints: async () => {
    set((s) => ({ loading: { ...s.loading, grouped: true } }));
    try {
      const groups = await get<MilestoneSprintGroup[]>('/api/sprints/grouped');
      set({ milestoneGroups: groups ?? [] });
    } catch {
      set({ milestoneGroups: [] });
    } finally {
      set((s) => ({ loading: { ...s.loading, grouped: false } }));
    }
  },

  fetchSprints: async () => {
    set((s) => ({ loading: { ...s.loading, sprints: true }, error: { ...s.error, sprints: null } }));
    try {
      const sprints = await get<Sprint[]>('/api/sprints');
      set({ sprints: sprints ?? [] });
      // Auto-select active sprint if none selected
      const { selectedSprintId } = getState();
      if (selectedSprintId === null) {
        const active = (sprints ?? []).find((s) => s.status === 'active');
        if (active) getState().selectSprint(active.id);
      }
    } catch (e) {
      set((s) => ({ error: { ...s.error, sprints: (e as Error).message } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, sprints: false } }));
    }
  },

  selectSprint: async (id: number) => {
    set((s) => ({ selectedSprintId: id, loading: { ...s.loading, detail: true }, error: { ...s.error, detail: null } }));
    try {
      // Fetch sprint detail, tickets, and retro in parallel
      const [detail, tickets, retro] = await Promise.all([
        get<SprintDetail>(`/api/sprint/${id}`),
        get<Ticket[]>(`/api/sprint/${id}/tickets`),
        get<RetroFinding[]>(`/api/sprint/${id}/retro`).catch(() => [] as RetroFinding[]),
      ]);
      set({
        sprintDetail: detail ?? null,
        tickets: Array.isArray(tickets) ? tickets : [],
        selectedRetroFindings: Array.isArray(retro) ? retro : [],
      });
    } catch (e) {
      set((s) => ({ error: { ...s.error, detail: (e as Error).message } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, detail: false } }));
    }
  },

  fetchTickets: async (sprintId: number) => {
    try {
      const tickets = await get<Ticket[]>(`/api/sprint/${sprintId}/tickets`);
      set({ tickets: Array.isArray(tickets) ? tickets : [] });
    } catch {
      // Silently fail
    }
  },

  fetchRetro: async (sprintId: number) => {
    try {
      const retroFindings = await get<RetroFinding[]>(`/api/sprint/${sprintId}/retro`);
      set({ retroFindings: Array.isArray(retroFindings) ? retroFindings : [] });
    } catch {
      // Silently fail
    }
  },

  fetchAllRetro: async () => {
    try {
      const findings = await get<(RetroFinding & { sprint_name?: string })[]>('/api/retro/all');
      set({ allRetroFindings: Array.isArray(findings) ? findings : [] });
    } catch {
      set({ allRetroFindings: [] });
    }
  },

  fetchBurndown: async (sprintId: number) => {
    try {
      const burndown = await get<BurndownData>(`/api/sprint/${sprintId}/burndown`);
      set({ burndown: burndown ?? null });
    } catch {
      set({ burndown: null });
    }
  },

  fetchBlockers: async (sprintId: number) => {
    try {
      const blockers = await get<Blocker[]>(`/api/sprint/${sprintId}/blockers`);
      set({ blockers: Array.isArray(blockers) ? blockers : [] });
    } catch {
      set({ blockers: [] });
    }
  },

  fetchBugs: async (sprintId: number) => {
    try {
      const bugs = await get<Bug[]>(`/api/sprint/${sprintId}/bugs`);
      set({ bugs: Array.isArray(bugs) ? bugs : [] });
    } catch {
      set({ bugs: [] });
    }
  },

  fetchActivities: async () => {
    try {
      const activities = await get<ActivityEvent[]>('/api/activity');
      set({ activities: Array.isArray(activities) ? activities : [] });
    } catch {
      set({ activities: [] });
    }
  },

  clearError: () => set({ error: { sprints: null, detail: null } }),

  setTicketFilter: (filter: TicketFilter) => {
    set({ ticketFilter: filter });
  },

  setCurrentUserName: (name: string) => {
    set({ currentUserName: name });
  },

  getFilteredTickets: () => {
    const { tickets, ticketFilter, currentUserName } = getState();

    switch (ticketFilter) {
      case 'mine':
        return tickets.filter(t => t.assigned_to === currentUserName);
      case 'blocked':
        return tickets.filter(t => t.status === 'BLOCKED');
      case 'qaPending':
        return tickets.filter(t => t.qa_verified === 0 && t.status !== 'TODO');
      case 'unassigned':
        return tickets.filter(t => !t.assigned_to);
      default:
        return tickets;
    }
  },

  getFilterCounts: () => {
    const { tickets, currentUserName } = getState();

    return {
      all: tickets.length,
      mine: tickets.filter(t => t.assigned_to === currentUserName).length,
      blocked: tickets.filter(t => t.status === 'BLOCKED').length,
      qaPending: tickets.filter(t => t.qa_verified === 0 && t.status !== 'TODO').length,
    };
  },
}));
