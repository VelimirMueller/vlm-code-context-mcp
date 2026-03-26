import { create } from 'zustand';
import { get, post, put, patch } from '@/lib/api';
import type { Sprint, Ticket, Milestone } from '@/types';

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  targetDate?: string;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  targetDate?: string;
  status?: 'planned' | 'in_progress' | 'completed';
}

export interface PlanSprintInput {
  name: string;
  startDate: string;
  endDate: string;
  targetVelocity: number;
  ticketIds: number[];
  goal?: string;
}

export interface PlanningStore {
  milestones: Milestone[];
  vision: string | null;
  ganttData: Sprint[];
  backlog: Ticket[];
  loading: { milestones: boolean; vision: boolean; gantt: boolean; backlog: boolean };

  fetchMilestones: () => Promise<void>;
  createMilestone: (data: CreateMilestoneInput) => Promise<void>;
  updateMilestone: (id: number, data: UpdateMilestoneInput) => Promise<void>;
  fetchVision: () => Promise<void>;
  updateVision: (content: string) => Promise<void>;
  fetchGantt: () => Promise<void>;
  fetchBacklog: () => Promise<void>;
  planSprint: (data: PlanSprintInput) => Promise<{ id: number }>;
}

export const usePlanningStore = create<PlanningStore>((set, getState) => ({
  milestones: [],
  vision: null,
  ganttData: [],
  backlog: [],
  loading: { milestones: false, vision: false, gantt: false, backlog: false },

  fetchMilestones: async () => {
    set((s) => ({ loading: { ...s.loading, milestones: true } }));
    try {
      const milestones = await get<Milestone[]>('/api/milestones');
      set({ milestones });
    } finally {
      set((s) => ({ loading: { ...s.loading, milestones: false } }));
    }
  },

  createMilestone: async (data: CreateMilestoneInput) => {
    const created = await post<Milestone>('/api/milestones', data);
    set((s) => ({ milestones: [...s.milestones, created] }));
  },

  updateMilestone: async (id: number, data: UpdateMilestoneInput) => {
    // Optimistic update
    set((s) => ({
      milestones: s.milestones.map((m) => (m.id === id ? { ...m, ...data } : m)),
    }));
    try {
      const updated = await patch<Milestone>(`/api/milestones/${id}`, data);
      set((s) => ({ milestones: s.milestones.map((m) => (m.id === id ? updated : m)) }));
    } catch (e) {
      // Rollback on error -- re-fetch authoritative state
      getState().fetchMilestones();
      throw e;
    }
  },

  fetchVision: async () => {
    set((s) => ({ loading: { ...s.loading, vision: true } }));
    try {
      const { content } = await get<{ content: string }>('/api/vision');
      set({ vision: content });
    } finally {
      set((s) => ({ loading: { ...s.loading, vision: false } }));
    }
  },

  updateVision: async (content: string) => {
    // Optimistic
    set({ vision: content });
    await put('/api/vision', { content });
  },

  fetchGantt: async () => {
    set((s) => ({ loading: { ...s.loading, gantt: true } }));
    try {
      const ganttData = await get<Sprint[]>('/api/gantt');
      set({ ganttData });
    } finally {
      set((s) => ({ loading: { ...s.loading, gantt: false } }));
    }
  },

  fetchBacklog: async () => {
    set((s) => ({ loading: { ...s.loading, backlog: true } }));
    try {
      const backlog = await get<Ticket[]>('/api/backlog');
      set({ backlog });
    } finally {
      set((s) => ({ loading: { ...s.loading, backlog: false } }));
    }
  },

  planSprint: async (data: PlanSprintInput) => {
    const result = await post<{ id: number }>('/api/sprints', data);
    // Refresh gantt and backlog after planning
    await Promise.all([getState().fetchGantt(), getState().fetchBacklog()]);
    return result;
  },
}));
