import { create } from 'zustand';
import { get, post } from '@/lib/api';
import type { GithubRepo, GithubIssue, GithubPullRequest, GithubCommit, GithubSyncStatus } from '@/types';

export interface GithubStore {
  repos: GithubRepo[];
  issues: GithubIssue[];
  prs: GithubPullRequest[];
  commits: GithubCommit[];
  syncStatus: GithubSyncStatus | null;
  loading: { repos: boolean; issues: boolean; prs: boolean; commits: boolean; sync: boolean };
  error: string | null;
  selectedRepoId: number | null;

  fetchRepos: () => Promise<void>;
  fetchIssues: (repoId?: number) => Promise<void>;
  fetchPRs: (repoId?: number) => Promise<void>;
  fetchCommits: (repoId?: number) => Promise<void>;
  fetchSyncStatus: () => Promise<void>;
  fetchAll: (repoId?: number) => Promise<void>;
  syncNow: (owner: string, repo: string) => Promise<void>;
  setSelectedRepo: (id: number | null) => void;
}

export const useGithubStore = create<GithubStore>((set, getState) => ({
  repos: [],
  issues: [],
  prs: [],
  commits: [],
  syncStatus: null,
  loading: { repos: false, issues: false, prs: false, commits: false, sync: false },
  error: null,
  selectedRepoId: null,

  fetchRepos: async () => {
    set((s) => ({ loading: { ...s.loading, repos: true }, error: null }));
    try {
      const repos = await get<GithubRepo[]>('/api/github/repos');
      set((s) => ({ repos: Array.isArray(repos) ? repos : [], loading: { ...s.loading, repos: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, repos: false } }));
    }
  },

  fetchIssues: async (repoId) => {
    set((s) => ({ loading: { ...s.loading, issues: true }, error: null }));
    try {
      const qs = repoId != null ? `?repo_id=${repoId}` : '';
      const issues = await get<GithubIssue[]>(`/api/github/issues${qs}`);
      set((s) => ({ issues: Array.isArray(issues) ? issues : [], loading: { ...s.loading, issues: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, issues: false } }));
    }
  },

  fetchPRs: async (repoId) => {
    set((s) => ({ loading: { ...s.loading, prs: true }, error: null }));
    try {
      const qs = repoId != null ? `?repo_id=${repoId}` : '';
      const prs = await get<GithubPullRequest[]>(`/api/github/prs${qs}`);
      set((s) => ({ prs: Array.isArray(prs) ? prs : [], loading: { ...s.loading, prs: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, prs: false } }));
    }
  },

  fetchCommits: async (repoId) => {
    set((s) => ({ loading: { ...s.loading, commits: true }, error: null }));
    try {
      const qs = repoId != null ? `?repo_id=${repoId}` : '';
      const commits = await get<GithubCommit[]>(`/api/github/commits${qs}`);
      set((s) => ({ commits: Array.isArray(commits) ? commits : [], loading: { ...s.loading, commits: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, commits: false } }));
    }
  },

  fetchSyncStatus: async () => {
    set((s) => ({ loading: { ...s.loading, sync: true } }));
    try {
      const status = await get<GithubSyncStatus>('/api/github/sync/status');
      set((s) => ({ syncStatus: status ?? null, loading: { ...s.loading, sync: false } }));
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, sync: false } }));
    }
  },

  fetchAll: async (repoId) => {
    const s = getState();
    await Promise.all([s.fetchIssues(repoId), s.fetchPRs(repoId), s.fetchCommits(repoId)]);
  },

  syncNow: async (owner, repo) => {
    set((s) => ({ loading: { ...s.loading, sync: true }, error: null }));
    try {
      await post('/api/github/sync', { owner, repo });
      const state = getState();
      await Promise.all([state.fetchRepos(), state.fetchSyncStatus(), state.fetchAll(state.selectedRepoId ?? undefined)]);
    } catch (e) {
      set((s) => ({ error: (e as Error).message, loading: { ...s.loading, sync: false } }));
    }
  },

  setSelectedRepo: (id) => {
    set({ selectedRepoId: id });
    const state = getState();
    state.fetchAll(id ?? undefined);
  },
}));
