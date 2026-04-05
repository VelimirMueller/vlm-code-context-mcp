import { create } from 'zustand';
import { get, patch, post } from '@/lib/api';
import type { NormalizedLinearIssue, LinearState, LinearSyncStatus, KanbanColumn } from '@/types';

export interface LinearStore {
  issues: NormalizedLinearIssue[];
  states: LinearState[];
  syncStatus: LinearSyncStatus | null;
  loading: { issues: boolean; states: boolean; sync: boolean; move: string | null };
  error: string | null;
  filterProject: string | null;
  filterState: KanbanColumn | null;

  fetchIssues: (project?: string | null, state?: KanbanColumn | null) => Promise<void>;
  fetchStates: () => Promise<void>;
  fetchSyncStatus: () => Promise<void>;
  syncNow: () => Promise<void>;
  moveIssue: (issueId: string, column: KanbanColumn) => Promise<void>;
  setFilterProject: (project: string | null) => void;
  setFilterState: (state: KanbanColumn | null) => void;

  // Derived
  getIssuesByColumn: () => Record<KanbanColumn, NormalizedLinearIssue[]>;
  getProjects: () => string[];
  getColumnCounts: () => Record<KanbanColumn, number>;
}

const COLUMNS: KanbanColumn[] = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'];

export const useLinearStore = create<LinearStore>((set, getState) => ({
  issues: [],
  states: [],
  syncStatus: null,
  loading: { issues: false, states: false, sync: false, move: null },
  error: null,
  filterProject: null,
  filterState: null,

  fetchIssues: async (project, state) => {
    set((s) => ({ loading: { ...s.loading, issues: true }, error: null }));
    try {
      const params = new URLSearchParams();
      if (project) params.set('project', project);
      if (state) params.set('state', state);
      const qs = params.toString();
      const res = await get<{ issues: NormalizedLinearIssue[] }>(`/api/linear/issues${qs ? `?${qs}` : ''}`);
      const issues = Array.isArray(res) ? res : res?.issues;
      set((s) => ({ issues: Array.isArray(issues) ? issues : [], loading: { ...s.loading, issues: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, issues: false } }));
    }
  },

  fetchStates: async () => {
    set((s) => ({ loading: { ...s.loading, states: true } }));
    try {
      const res = await get<{ states: LinearState[] }>('/api/linear/states');
      const states = Array.isArray(res) ? res : res?.states;
      set((s) => ({ states: Array.isArray(states) ? states : [], loading: { ...s.loading, states: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, states: false } }));
    }
  },

  fetchSyncStatus: async () => {
    set((s) => ({ loading: { ...s.loading, sync: true } }));
    try {
      const status = await get<LinearSyncStatus>('/api/linear/sync/status');
      set((s) => ({ syncStatus: status ?? null, loading: { ...s.loading, sync: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, sync: false } }));
    }
  },

  syncNow: async () => {
    set((s) => ({ loading: { ...s.loading, sync: true }, error: null }));
    try {
      const result = await post<{ ok: boolean; error?: string; bridge?: boolean; message?: string }>('/api/linear/sync/trigger', {});
      if (result?.bridge) {
        // Sync delegated to Claude via bridge — data arrives via SSE
        set((s) => ({ error: null, loading: { ...s.loading, sync: false } }));
        return;
      }
      if (result && !result.ok && result.error) {
        set((s) => ({ error: result.error!, loading: { ...s.loading, sync: false } }));
        return;
      }
      // Direct sync complete — refresh all data immediately
      const state = getState();
      await Promise.all([state.fetchSyncStatus(), state.fetchStates(), state.fetchIssues()]);
      set((s) => ({ loading: { ...s.loading, sync: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, sync: false } }));
    }
  },

  moveIssue: async (issueId, column) => {
    if (!COLUMNS.includes(column)) return;
    set((s) => ({ loading: { ...s.loading, move: issueId } }));
    try {
      await patch(`/api/linear/issue/${encodeURIComponent(issueId)}/status`, { kanbanColumn: column });
      // Optimistic update
      set((s) => ({
        issues: s.issues.map((i) => (i.id === issueId ? { ...i, kanbanColumn: column } : i)),
        loading: { ...s.loading, move: null },
      }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, move: null } }));
      // Refetch to restore correct state
      getState().fetchIssues();
    }
  },

  setFilterProject: (project) => set({ filterProject: project }),
  setFilterState: (state) => set({ filterState: state }),

  getIssuesByColumn: () => {
    const { issues, filterProject } = getState();
    const filtered = filterProject ? issues.filter((i) => i.project_name === filterProject) : issues;
    const grouped: Record<KanbanColumn, NormalizedLinearIssue[]> = { TODO: [], IN_PROGRESS: [], DONE: [], NOT_DONE: [] };
    for (const issue of filtered) {
      const col = COLUMNS.includes(issue.kanbanColumn) ? issue.kanbanColumn : 'TODO';
      grouped[col].push(issue);
    }
    return grouped;
  },

  getProjects: () => {
    const { issues } = getState();
    const projects = new Set(issues.map((i) => i.project_name).filter(Boolean) as string[]);
    return [...projects].sort();
  },

  getColumnCounts: () => {
    const grouped = getState().getIssuesByColumn();
    return { TODO: grouped.TODO.length, IN_PROGRESS: grouped.IN_PROGRESS.length, DONE: grouped.DONE.length, NOT_DONE: grouped.NOT_DONE.length };
  },
}));
