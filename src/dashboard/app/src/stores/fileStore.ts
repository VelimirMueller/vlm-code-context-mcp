import { create } from 'zustand';
import { get } from '@/lib/api';
import type { File, Directory, Stats } from '@/types';

export interface FileDetail {
  id: number;
  path: string;
  content: string;
  language: string;
  symbols: Array<{ name: string; type: string; line: number; exported: boolean }>;
  imports: string[];
  exports: string[];
  description: string | null;
  changeCount: number;
}

export interface Change {
  id: number;
  fileId: number;
  timestamp: string;
  summary: string;
  linesAdded: number;
  linesRemoved: number;
  reason: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'directory' | 'external';
  size: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'export' | 'dependency';
  weight: number;
}

export interface FileStore {
  files: File[];
  directories: Directory[];
  selectedFileId: number | null;
  fileDetail: FileDetail | null;
  fileChanges: Change[];
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  stats: Stats | null;
  loading: { files: boolean; detail: boolean; changes: boolean; graph: boolean };
  error: { files: string | null; detail: string | null };

  fetchFiles: () => Promise<void>;
  fetchDirectories: () => Promise<void>;
  selectFile: (id: number) => Promise<void>;
  fetchGraph: () => Promise<void>;
  fetchStats: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useFileStore = create<FileStore>((set, getState) => ({
  files: [],
  directories: [],
  selectedFileId: null,
  fileDetail: null,
  fileChanges: [],
  graphData: null,
  stats: null,
  loading: { files: false, detail: false, changes: false, graph: false },
  error: { files: null, detail: null },

  fetchFiles: async () => {
    set((s) => ({ loading: { ...s.loading, files: true }, error: { ...s.error, files: null } }));
    try {
      const files = await get<File[]>('/api/files');
      set({ files });
    } catch (e) {
      set((s) => ({ error: { ...s.error, files: (e as Error).message } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, files: false } }));
    }
  },

  fetchDirectories: async () => {
    const directories = await get<Directory[]>('/api/directories');
    set({ directories });
  },

  selectFile: async (id: number) => {
    set((s) => ({
      selectedFileId: id,
      loading: { ...s.loading, detail: true, changes: true },
      error: { ...s.error, detail: null },
    }));
    try {
      const [detail, changes] = await Promise.all([
        get<FileDetail>(`/api/files/${id}`),
        get<Change[]>(`/api/files/${id}/changes`),
      ]);
      set((s) => ({
        fileDetail: detail,
        fileChanges: changes,
        loading: { ...s.loading, detail: false, changes: false },
      }));
    } catch (e) {
      set((s) => ({
        error: { ...s.error, detail: (e as Error).message },
        loading: { ...s.loading, detail: false, changes: false },
      }));
    }
  },

  fetchGraph: async () => {
    set((s) => ({ loading: { ...s.loading, graph: true } }));
    try {
      const graphData = await get<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/api/graph');
      set({ graphData });
    } finally {
      set((s) => ({ loading: { ...s.loading, graph: false } }));
    }
  },

  fetchStats: async () => {
    const stats = await get<Stats>('/api/stats');
    set({ stats });
  },

  refresh: async () => {
    const { fetchFiles, fetchDirectories, fetchStats, selectedFileId, selectFile } = getState();
    await Promise.all([fetchFiles(), fetchDirectories(), fetchStats()]);
    if (selectedFileId !== null) await selectFile(selectedFileId);
  },
}));
