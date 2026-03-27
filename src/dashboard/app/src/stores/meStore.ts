import { create } from 'zustand';
import { get } from '@/lib/api';
import type { LinearUser, LinearIssue, LinearCycle, LinearProject } from '@/types';

export interface MeStore {
  configured: boolean;
  user: LinearUser | null;
  issues: LinearIssue[];
  cycles: LinearCycle[];
  projects: LinearProject[];
  loading: { user: boolean; issues: boolean; cycles: boolean; projects: boolean };
  error: { user: string | null; issues: string | null; cycles: string | null; projects: string | null };
  collapsedGroups: Set<string>;

  fetchAll: () => Promise<void>;
  fetchConfigured: () => Promise<void>;
  toggleGroup: (status: string) => void;
}

export const useMeStore = create<MeStore>((set) => ({
  configured: false,
  user: null,
  issues: [],
  cycles: [],
  projects: [],
  loading: { user: false, issues: false, cycles: false, projects: false },
  error: { user: null, issues: null, cycles: null, projects: null },
  collapsedGroups: new Set<string>(),

  fetchConfigured: async () => {
    try {
      const res = await get<{ configured: boolean }>('/api/me/configured');
      set({ configured: res?.configured ?? false });
    } catch {
      set({ configured: false });
    }
  },

  fetchAll: async () => {
    set((s) => ({
      loading: { user: true, issues: true, cycles: true, projects: true },
      error: { user: null, issues: null, cycles: null, projects: null },
    }));

    const fetchUser = async () => {
      try {
        const user = await get<LinearUser>('/api/me/user');
        set((s) => ({ user: user ?? null, loading: { ...s.loading, user: false } }));
      } catch (e) {
        set((s) => ({
          error: { ...s.error, user: (e as Error).message },
          loading: { ...s.loading, user: false },
        }));
      }
    };

    const fetchIssues = async () => {
      try {
        const issues = await get<LinearIssue[]>('/api/me/issues');
        set((s) => ({ issues: Array.isArray(issues) ? issues : [], loading: { ...s.loading, issues: false } }));
      } catch (e) {
        set((s) => ({
          error: { ...s.error, issues: (e as Error).message },
          loading: { ...s.loading, issues: false },
        }));
      }
    };

    const fetchCycles = async () => {
      try {
        const cycles = await get<LinearCycle[]>('/api/me/cycles');
        set((s) => ({ cycles: Array.isArray(cycles) ? cycles : [], loading: { ...s.loading, cycles: false } }));
      } catch (e) {
        set((s) => ({
          error: { ...s.error, cycles: (e as Error).message },
          loading: { ...s.loading, cycles: false },
        }));
      }
    };

    const fetchProjects = async () => {
      try {
        const projects = await get<LinearProject[]>('/api/me/projects');
        set((s) => ({ projects: Array.isArray(projects) ? projects : [], loading: { ...s.loading, projects: false } }));
      } catch (e) {
        set((s) => ({
          error: { ...s.error, projects: (e as Error).message },
          loading: { ...s.loading, projects: false },
        }));
      }
    };

    await Promise.all([fetchUser(), fetchIssues(), fetchCycles(), fetchProjects()]);
  },

  toggleGroup: (status: string) =>
    set((s) => {
      const next = new Set(s.collapsedGroups);
      next.has(status) ? next.delete(status) : next.add(status);
      return { collapsedGroups: next };
    }),
}));
