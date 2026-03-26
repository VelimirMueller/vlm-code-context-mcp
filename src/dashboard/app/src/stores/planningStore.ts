import { create } from 'zustand';
import { get, post, put } from '@/lib/api';
import { parseMilestoneMarkdown } from '@/lib/utils';
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
      // Try DB milestones first
      let milestones = await get<Milestone[]>('/api/milestones');

      // If empty, fall back to skill content and parse
      if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
        try {
          const skill = await get<{ content: string }>('/api/skill/MILESTONES');
          if (skill?.content) {
            milestones = parseMilestoneMarkdown(skill.content);
          }
        } catch {
          // Skill endpoint also failed — keep empty
        }
      }

      set({ milestones: Array.isArray(milestones) ? milestones : [] });
    } catch {
      // Silently fail
      set({ milestones: [] });
    } finally {
      set((s) => ({ loading: { ...s.loading, milestones: false } }));
    }
  },

  createMilestone: async (data: CreateMilestoneInput) => {
    const created = await post<Milestone>('/api/milestones', data);
    if (created) set((s) => ({ milestones: [...s.milestones, created] }));
  },

  updateMilestone: async (id: number, data: UpdateMilestoneInput) => {
    // Optimistic update
    set((s) => ({
      milestones: s.milestones.map((m) => (m.id === id ? { ...m, ...data } : m)),
    }));
    try {
      // Server uses PUT on /api/milestone/{id} (singular)
      const updated = await put<Milestone>(`/api/milestone/${id}`, data);
      if (updated) {
        set((s) => ({ milestones: s.milestones.map((m) => (m.id === id ? updated : m)) }));
      }
    } catch (e) {
      // Rollback on error -- re-fetch authoritative state
      getState().fetchMilestones();
      throw e;
    }
  },

  fetchVision: async () => {
    set((s) => ({ loading: { ...s.loading, vision: true } }));
    try {
      const skill = await get<{ content: string }>('/api/skill/PRODUCT_VISION');
      set({ vision: skill?.content ?? null });
    } catch {
      set({ vision: null });
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
    // Gantt data reuses sprint list — /api/gantt does not exist
    set((s) => ({ loading: { ...s.loading, gantt: true } }));
    try {
      const ganttData = await get<Sprint[]>('/api/sprints');
      set({ ganttData: Array.isArray(ganttData) ? ganttData : [] });
    } catch {
      // Silently fail
    } finally {
      set((s) => ({ loading: { ...s.loading, gantt: false } }));
    }
  },

  fetchBacklog: async () => {
    set((s) => ({ loading: { ...s.loading, backlog: true } }));
    try {
      const backlog = await get<Ticket[]>('/api/backlog');
      set({ backlog: Array.isArray(backlog) ? backlog : [] });
    } catch {
      // Silently fail
    } finally {
      set((s) => ({ loading: { ...s.loading, backlog: false } }));
    }
  },

  planSprint: async (data: PlanSprintInput) => {
    const result = await post<{ id: number }>('/api/sprints/plan', data);
    // Refresh gantt and backlog after planning
    await Promise.all([getState().fetchGantt(), getState().fetchBacklog()]);
    return result;
  },
}));
