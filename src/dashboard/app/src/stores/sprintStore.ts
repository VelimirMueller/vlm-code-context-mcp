import { create } from 'zustand';
import { get } from '@/lib/api';
import type { Sprint, Ticket, RetroFinding } from '@/types';

export interface SprintDetail extends Sprint {
  goal: string | null;
  retrospective: string | null;
  tickets: Ticket[];
  blockers: Array<{ id: number; ticketId: number; description: string; resolvedAt: string | null }>;
}

export interface SprintStore {
  sprints: Sprint[];
  selectedSprintId: number | null;
  sprintDetail: SprintDetail | null;
  tickets: Ticket[];
  retroFindings: RetroFinding[];
  loading: { sprints: boolean; detail: boolean };
  error: { sprints: string | null; detail: string | null };

  fetchSprints: () => Promise<void>;
  selectSprint: (id: number) => Promise<void>;
  fetchTickets: (sprintId: number) => Promise<void>;
  fetchRetro: (sprintId: number) => Promise<void>;
}

export const useSprintStore = create<SprintStore>((set, getState) => ({
  sprints: [],
  selectedSprintId: null,
  sprintDetail: null,
  tickets: [],
  retroFindings: [],
  loading: { sprints: false, detail: false },
  error: { sprints: null, detail: null },

  fetchSprints: async () => {
    set((s) => ({ loading: { ...s.loading, sprints: true }, error: { ...s.error, sprints: null } }));
    try {
      const sprints = await get<Sprint[]>('/api/sprints');
      set({ sprints });
      // Auto-select active sprint if none selected
      const { selectedSprintId } = getState();
      if (selectedSprintId === null) {
        const active = sprints.find((s) => s.status === 'active');
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
      const detail = await get<SprintDetail>(`/api/sprints/${id}`);
      set({ sprintDetail: detail, tickets: detail.tickets });
    } catch (e) {
      set((s) => ({ error: { ...s.error, detail: (e as Error).message } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, detail: false } }));
    }
  },

  fetchTickets: async (sprintId: number) => {
    const tickets = await get<Ticket[]>(`/api/sprints/${sprintId}/tickets`);
    set({ tickets });
  },

  fetchRetro: async (sprintId: number) => {
    const retroFindings = await get<RetroFinding[]>(`/api/sprints/${sprintId}/retro`);
    set({ retroFindings });
  },
}));
