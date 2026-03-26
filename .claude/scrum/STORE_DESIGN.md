# Zustand Store Design Spec

**Task:** T-054 — Zustand Store Design
**Sprint:** Sprint 9
**Status:** Draft
**Date:** 2026-03-26

---

## Overview

The dashboard uses 5 Zustand stores: 4 server-state stores (file, sprint, agent, planning) and 1 UI-state store. Server stores manage async data fetching, caching, loading/error states, and SSE-driven refresh. The UI store manages navigation, layout, and search with no async operations.

### Design Principles

1. **Request deduplication** — inflight Map prevents duplicate in-flight requests
2. **Optimistic updates** — mutations update local state before server confirmation
3. **SSE-driven refresh** — `useEventSource` triggers store refreshes on server events
4. **URL hash sync** — `useHashRouter` keeps page/tab/file selection in URL hash
5. **Slice isolation** — each store owns its slice; cross-store reads via `getState()`

---

## TypeScript Base Types

```typescript
// Shared domain types referenced by stores

interface File {
  id: number;
  path: string;
  name: string;
  language: string;
  size: number;
  lastModified: string;
  directoryId: number | null;
}

interface Directory {
  id: number;
  path: string;
  name: string;
  parentId: number | null;
  fileCount: number;
}

interface FileDetail {
  id: number;
  path: string;
  content: string;
  language: string;
  symbols: Symbol[];
  imports: string[];
  exports: string[];
  description: string | null;
  changeCount: number;
}

interface Change {
  id: number;
  fileId: number;
  timestamp: string;
  summary: string;
  linesAdded: number;
  linesRemoved: number;
  reason: string | null;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'directory' | 'external';
  size: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'export' | 'dependency';
  weight: number;
}

interface Stats {
  totalFiles: number;
  totalDirectories: number;
  totalChanges: number;
  languageBreakdown: Record<string, number>;
  mostChangedFiles: Array<{ id: number; path: string; changeCount: number }>;
  recentActivity: Change[];
}

interface Sprint {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed';
  velocity: number | null;
  targetVelocity: number;
  ticketCount: number;
  completedCount: number;
}

interface SprintDetail extends Sprint {
  goal: string | null;
  retrospective: string | null;
  tickets: Ticket[];
  blockers: Blocker[];
}

interface Ticket {
  id: number;
  key: string;
  title: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  points: number;
  assignee: string | null;
  sprintId: number | null;
  labels: string[];
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Blocker {
  id: number;
  ticketId: number;
  description: string;
  resolvedAt: string | null;
}

interface RetroFinding {
  id: number;
  sprintId: number;
  category: 'went_well' | 'improve' | 'action_item';
  content: string;
  votes: number;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  status: 'active' | 'idle' | 'offline';
}

interface Milestone {
  id: number;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  ticketCount: number;
  completedCount: number;
}

interface CreateMilestoneInput {
  title: string;
  description?: string;
  targetDate?: string;
}

interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  targetDate?: string;
  status?: 'planned' | 'in_progress' | 'completed';
}

interface PlanSprintInput {
  name: string;
  startDate: string;
  endDate: string;
  targetVelocity: number;
  ticketIds: number[];
  goal?: string;
}

interface Symbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'export';
  line: number;
  exported: boolean;
}
```

---

## Store 1: fileStore (Server State)

Manages the file explorer: directory tree, selected file detail, change history, dependency graph, and codebase stats.

```typescript
interface FileStore {
  // State
  files: File[];
  directories: Directory[];
  selectedFileId: number | null;
  fileDetail: FileDetail | null;
  fileChanges: Change[];
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  stats: Stats | null;
  loading: {
    files: boolean;
    detail: boolean;
    changes: boolean;
    graph: boolean;
  };
  error: {
    files: string | null;
    detail: string | null;
  };

  // Actions
  fetchFiles: () => Promise<void>;
  fetchDirectories: () => Promise<void>;
  selectFile: (id: number) => Promise<void>;
  fetchGraph: () => Promise<void>;
  fetchStats: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

### Implementation Notes

```typescript
import { create } from 'zustand';
import { apiClient } from '../api/client';

export const useFileStore = create<FileStore>((set, get) => ({
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
    set(s => ({ loading: { ...s.loading, files: true }, error: { ...s.error, files: null } }));
    try {
      const files = await apiClient.get<File[]>('/api/files');
      set({ files });
    } catch (e) {
      set(s => ({ error: { ...s.error, files: (e as Error).message } }));
    } finally {
      set(s => ({ loading: { ...s.loading, files: false } }));
    }
  },

  fetchDirectories: async () => {
    const directories = await apiClient.get<Directory[]>('/api/directories');
    set({ directories });
  },

  selectFile: async (id: number) => {
    set(s => ({
      selectedFileId: id,
      loading: { ...s.loading, detail: true, changes: true },
      error: { ...s.error, detail: null },
    }));
    try {
      const [detail, changes] = await Promise.all([
        apiClient.get<FileDetail>(`/api/files/${id}`),
        apiClient.get<Change[]>(`/api/files/${id}/changes`),
      ]);
      set(s => ({ fileDetail: detail, fileChanges: changes, loading: { ...s.loading, detail: false, changes: false } }));
    } catch (e) {
      set(s => ({
        error: { ...s.error, detail: (e as Error).message },
        loading: { ...s.loading, detail: false, changes: false },
      }));
    }
  },

  fetchGraph: async () => {
    set(s => ({ loading: { ...s.loading, graph: true } }));
    try {
      const graphData = await apiClient.get<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/api/graph');
      set({ graphData });
    } finally {
      set(s => ({ loading: { ...s.loading, graph: false } }));
    }
  },

  fetchStats: async () => {
    const stats = await apiClient.get<Stats>('/api/stats');
    set({ stats });
  },

  refresh: async () => {
    const { fetchFiles, fetchDirectories, fetchStats, selectedFileId, selectFile } = get();
    await Promise.all([fetchFiles(), fetchDirectories(), fetchStats()]);
    if (selectedFileId !== null) await selectFile(selectedFileId);
  },
}));
```

---

## Store 2: sprintStore (Server State)

Manages sprint list, sprint detail with tickets, and retrospective findings.

```typescript
interface SprintStore {
  // State
  sprints: Sprint[];
  selectedSprintId: number | null;
  sprintDetail: SprintDetail | null;
  tickets: Ticket[];
  retroFindings: RetroFinding[];
  loading: {
    sprints: boolean;
    detail: boolean;
  };
  error: {
    sprints: string | null;
    detail: string | null;
  };

  // Actions
  fetchSprints: () => Promise<void>;
  selectSprint: (id: number) => Promise<void>;
  fetchTickets: (sprintId: number) => Promise<void>;
  fetchRetro: (sprintId: number) => Promise<void>;
}
```

### Implementation Notes

```typescript
export const useSprintStore = create<SprintStore>((set, get) => ({
  sprints: [],
  selectedSprintId: null,
  sprintDetail: null,
  tickets: [],
  retroFindings: [],
  loading: { sprints: false, detail: false },
  error: { sprints: null, detail: null },

  fetchSprints: async () => {
    set(s => ({ loading: { ...s.loading, sprints: true } }));
    try {
      const sprints = await apiClient.get<Sprint[]>('/api/sprints');
      set({ sprints });
      // Auto-select active sprint if none selected
      const { selectedSprintId } = get();
      if (selectedSprintId === null) {
        const active = sprints.find(s => s.status === 'active');
        if (active) get().selectSprint(active.id);
      }
    } catch (e) {
      set(s => ({ error: { ...s.error, sprints: (e as Error).message } }));
    } finally {
      set(s => ({ loading: { ...s.loading, sprints: false } }));
    }
  },

  selectSprint: async (id: number) => {
    set(s => ({ selectedSprintId: id, loading: { ...s.loading, detail: true } }));
    try {
      const detail = await apiClient.get<SprintDetail>(`/api/sprints/${id}`);
      set({ sprintDetail: detail, tickets: detail.tickets });
    } catch (e) {
      set(s => ({ error: { ...s.error, detail: (e as Error).message } }));
    } finally {
      set(s => ({ loading: { ...s.loading, detail: false } }));
    }
  },

  fetchTickets: async (sprintId: number) => {
    const tickets = await apiClient.get<Ticket[]>(`/api/sprints/${sprintId}/tickets`);
    set({ tickets });
  },

  fetchRetro: async (sprintId: number) => {
    const retroFindings = await apiClient.get<RetroFinding[]>(`/api/sprints/${sprintId}/retro`);
    set({ retroFindings });
  },
}));
```

---

## Store 3: agentStore (Server State)

Manages the agent registry — a simple read-only list of all configured agents.

```typescript
interface AgentStore {
  // State
  agents: Agent[];
  loading: boolean;

  // Actions
  fetchAgents: () => Promise<void>;
}
```

### Implementation Notes

```typescript
export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await apiClient.get<Agent[]>('/api/agents');
      set({ agents });
    } finally {
      set({ loading: false });
    }
  },
}));
```

---

## Store 4: planningStore (Server State)

Manages roadmap milestones, product vision, Gantt chart data, and backlog. Includes write operations for milestone CRUD, vision update, and sprint planning.

```typescript
interface PlanningStore {
  // State
  milestones: Milestone[];
  vision: string | null;
  ganttData: Sprint[];
  backlog: Ticket[];
  loading: {
    milestones: boolean;
    vision: boolean;
    gantt: boolean;
    backlog: boolean;
  };

  // Actions
  fetchMilestones: () => Promise<void>;
  createMilestone: (data: CreateMilestoneInput) => Promise<void>;
  updateMilestone: (id: number, data: UpdateMilestoneInput) => Promise<void>;
  fetchVision: () => Promise<void>;
  updateVision: (content: string) => Promise<void>;
  fetchGantt: () => Promise<void>;
  fetchBacklog: () => Promise<void>;
  planSprint: (data: PlanSprintInput) => Promise<{ id: number }>;
}
```

### Implementation Notes

```typescript
export const usePlanningStore = create<PlanningStore>((set, get) => ({
  milestones: [],
  vision: null,
  ganttData: [],
  backlog: [],
  loading: { milestones: false, vision: false, gantt: false, backlog: false },

  fetchMilestones: async () => {
    set(s => ({ loading: { ...s.loading, milestones: true } }));
    try {
      const milestones = await apiClient.get<Milestone[]>('/api/milestones');
      set({ milestones });
    } finally {
      set(s => ({ loading: { ...s.loading, milestones: false } }));
    }
  },

  createMilestone: async (data: CreateMilestoneInput) => {
    const created = await apiClient.post<Milestone>('/api/milestones', data);
    set(s => ({ milestones: [...s.milestones, created] }));
  },

  updateMilestone: async (id: number, data: UpdateMilestoneInput) => {
    // Optimistic update
    set(s => ({
      milestones: s.milestones.map(m => (m.id === id ? { ...m, ...data } : m)),
    }));
    try {
      const updated = await apiClient.patch<Milestone>(`/api/milestones/${id}`, data);
      set(s => ({ milestones: s.milestones.map(m => (m.id === id ? updated : m)) }));
    } catch (e) {
      // Rollback on error — re-fetch authoritative state
      get().fetchMilestones();
      throw e;
    }
  },

  fetchVision: async () => {
    set(s => ({ loading: { ...s.loading, vision: true } }));
    try {
      const { content } = await apiClient.get<{ content: string }>('/api/vision');
      set({ vision: content });
    } finally {
      set(s => ({ loading: { ...s.loading, vision: false } }));
    }
  },

  updateVision: async (content: string) => {
    // Optimistic
    set({ vision: content });
    await apiClient.put('/api/vision', { content });
  },

  fetchGantt: async () => {
    set(s => ({ loading: { ...s.loading, gantt: true } }));
    try {
      const ganttData = await apiClient.get<Sprint[]>('/api/gantt');
      set({ ganttData });
    } finally {
      set(s => ({ loading: { ...s.loading, gantt: false } }));
    }
  },

  fetchBacklog: async () => {
    set(s => ({ loading: { ...s.loading, backlog: true } }));
    try {
      const backlog = await apiClient.get<Ticket[]>('/api/backlog');
      set({ backlog });
    } finally {
      set(s => ({ loading: { ...s.loading, backlog: false } }));
    }
  },

  planSprint: async (data: PlanSprintInput) => {
    const result = await apiClient.post<{ id: number }>('/api/sprints', data);
    // Refresh gantt and backlog after planning
    await Promise.all([get().fetchGantt(), get().fetchBacklog()]);
    return result;
  },
}));
```

---

## Store 5: uiStore (UI State)

Pure synchronous UI state — no async operations. Persisted to `localStorage` via Zustand `persist` middleware for panel collapse, folder expand state, and active page.

```typescript
interface UIStore {
  // State
  activePage: 'explorer' | 'planning' | 'sprint';
  activeTab: string;
  activeSubTab: string | null;
  sidebarCollapsed: boolean;
  expandedFolders: Set<string>;
  searchQuery: string;
  searchFocused: boolean;

  // Actions
  setPage: (page: string) => void;
  setTab: (tab: string) => void;
  setSubTab: (subTab: string) => void;
  toggleSidebar: () => void;
  toggleFolder: (path: string) => void;
  expandFolderPath: (filePath: string) => void;
  setSearch: (query: string) => void;
  setSearchFocused: (focused: boolean) => void;
}
```

### Implementation Notes

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Set is not JSON-serializable; use custom storage
const setReplacer = (_: string, v: unknown) =>
  v instanceof Set ? { __type: 'Set', values: [...v] } : v;
const setReviver = (_: string, v: unknown) =>
  v && typeof v === 'object' && (v as Record<string, unknown>).__type === 'Set'
    ? new Set((v as { values: string[] }).values)
    : v;

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      activePage: 'explorer',
      activeTab: 'files',
      activeSubTab: null,
      sidebarCollapsed: false,
      expandedFolders: new Set<string>(),
      searchQuery: '',
      searchFocused: false,

      setPage: (page) =>
        set({ activePage: page as UIStore['activePage'], activeTab: defaultTabForPage(page), activeSubTab: null }),

      setTab: (tab) => set({ activeTab: tab, activeSubTab: null }),

      setSubTab: (subTab) => set({ activeSubTab: subTab }),

      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      toggleFolder: (path) =>
        set(s => {
          const next = new Set(s.expandedFolders);
          next.has(path) ? next.delete(path) : next.add(path);
          return { expandedFolders: next };
        }),

      expandFolderPath: (filePath) => {
        // Expand every ancestor folder segment
        const parts = filePath.split('/');
        const ancestors: string[] = [];
        for (let i = 1; i < parts.length; i++) {
          ancestors.push(parts.slice(0, i).join('/'));
        }
        set(s => ({ expandedFolders: new Set([...s.expandedFolders, ...ancestors]) }));
      },

      setSearch: (query) => set({ searchQuery: query }),

      setSearchFocused: (focused) => set({ searchFocused: focused }),
    }),
    {
      name: 'mcp-ui-store',
      storage: createJSONStorage(() => localStorage, { replacer: setReplacer, reviver: setReviver }),
      partialize: (s) => ({
        activePage: s.activePage,
        sidebarCollapsed: s.sidebarCollapsed,
        expandedFolders: s.expandedFolders,
      }),
    }
  )
);

function defaultTabForPage(page: string): string {
  switch (page) {
    case 'explorer': return 'files';
    case 'planning': return 'milestones';
    case 'sprint':   return 'board';
    default:         return 'files';
  }
}
```

---

## API Client (Request Deduplication)

The API client uses an inflight `Map<string, Promise<T>>` to prevent duplicate concurrent requests for the same URL. A second call made while the first is still in-flight receives the same promise.

```typescript
// src/dashboard/api/client.ts

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

class ApiClient {
  private baseUrl: string;
  /** Keyed by `METHOD:url` — deduplicates concurrent identical GET requests */
  private inflight = new Map<string, Promise<unknown>>();

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    const key = `GET:${path}`;
    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<T>;
    }
    const promise = this.request<T>('GET', path);
    this.inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
```

### Deduplication Flow

```
Component A calls fetchFiles()  ──┐
                                   ├── same Promise returned
Component B calls fetchFiles()  ──┘   (no duplicate HTTP request)

                                   ↓
                           Single GET /api/files
                                   ↓
                    inflight key deleted on settlement
```

---

## useEventSource Hook (SSE Integration)

Listens to `GET /api/events` (Server-Sent Events). Auto-reconnects with exponential backoff on error. On relevant events, triggers store refreshes.

```typescript
// src/dashboard/hooks/useEventSource.ts

import { useEffect, useRef, useCallback } from 'react';

type SSEEvent = {
  type: 'file_changed' | 'sprint_updated' | 'ticket_updated' | 'agent_status' | 'ping';
  payload?: unknown;
};

interface UseEventSourceOptions {
  url?: string;
  onEvent?: (event: SSEEvent) => void;
  enabled?: boolean;
}

export function useEventSource({
  url = '/api/events',
  onEvent,
  enabled = true,
}: UseEventSourceOptions = {}) {
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000); // ms, doubles on each failure

  const connect = useCallback(() => {
    if (!enabled) return;

    esRef.current?.close();
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      retryDelay.current = 1000; // Reset backoff on successful connect
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        onEvent?.(event);
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Exponential backoff: 1s → 2s → 4s → 8s → 16s (cap at 30s)
      const delay = Math.min(retryDelay.current, 30_000);
      retryDelay.current = Math.min(delay * 2, 30_000);
      retryRef.current = setTimeout(connect, delay);
    };
  }, [url, onEvent, enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);
}

// ------------------------------------------------------------------
// Wiring useEventSource to stores in App root:
//
// function App() {
//   const refreshFiles   = useFileStore(s => s.refresh);
//   const fetchSprints   = useSprintStore(s => s.fetchSprints);
//   const fetchAgents    = useAgentStore(s => s.fetchAgents);
//
//   useEventSource({
//     onEvent: (e) => {
//       if (e.type === 'file_changed')   refreshFiles();
//       if (e.type === 'sprint_updated') fetchSprints();
//       if (e.type === 'agent_status')   fetchAgents();
//     },
//   });
//   ...
// }
```

---

## useHashRouter Hook (URL Hash Sync)

Reads and writes `window.location.hash` to encode the active page, tab, and selected file. Format: `#page/tab[/fileId]`

Examples:
- `#explorer/files/42`  — Explorer page, Files tab, file 42 selected
- `#sprint/board`       — Sprint page, Board tab
- `#planning/milestones` — Planning page, Milestones tab

```typescript
// src/dashboard/hooks/useHashRouter.ts

import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useFileStore } from '../stores/fileStore';
import { useSprintStore } from '../stores/sprintStore';

interface ParsedHash {
  page: string;
  tab: string;
  resourceId: number | null;
}

function parseHash(hash: string): ParsedHash {
  const clean = hash.replace(/^#/, '');
  const [page = 'explorer', tab = 'files', id] = clean.split('/');
  return {
    page,
    tab,
    resourceId: id ? parseInt(id, 10) : null,
  };
}

function buildHash(page: string, tab: string, resourceId?: number | null): string {
  const base = `#${page}/${tab}`;
  return resourceId != null ? `${base}/${resourceId}` : base;
}

export function useHashRouter() {
  const { activePage, activeTab, setPage, setTab } = useUIStore();
  const { selectedFileId, selectFile } = useFileStore();
  const { selectedSprintId, selectSprint } = useSprintStore();

  // Hash → state: read hash on mount and popstate
  const syncFromHash = useCallback(() => {
    const { page, tab, resourceId } = parseHash(window.location.hash);

    if (page !== activePage) setPage(page);
    if (tab !== activeTab)   setTab(tab);

    if (resourceId !== null) {
      if (page === 'explorer' && resourceId !== selectedFileId) {
        selectFile(resourceId);
      }
      if (page === 'sprint' && resourceId !== selectedSprintId) {
        selectSprint(resourceId);
      }
    }
  }, [activePage, activeTab, selectedFileId, selectedSprintId, setPage, setTab, selectFile, selectSprint]);

  useEffect(() => {
    syncFromHash();
    window.addEventListener('popstate', syncFromHash);
    return () => window.removeEventListener('popstate', syncFromHash);
  }, [syncFromHash]);

  // State → hash: write hash when state changes
  useEffect(() => {
    let resourceId: number | null = null;
    if (activePage === 'explorer') resourceId = selectedFileId;
    if (activePage === 'sprint')   resourceId = selectedSprintId;

    const newHash = buildHash(activePage, activeTab, resourceId);
    if (window.location.hash !== newHash) {
      window.history.pushState(null, '', newHash);
    }
  }, [activePage, activeTab, selectedFileId, selectedSprintId]);
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser                                         │
│                                                                              │
│  ┌─────────────────┐    ┌──────────────────────────────────────────────┐    │
│  │  URL Hash       │◄───│  useHashRouter                               │    │
│  │  #page/tab/id   │───►│  (bidirectional sync: hash ↔ store state)    │    │
│  └─────────────────┘    └────────────────────┬─────────────────────────┘    │
│                                               │                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       Zustand Stores                                 │    │
│  │                                                                       │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  ┌─────────────┐ │    │
│  │  │  fileStore  │  │ sprintStore  │  │agentStore │  │planningStore│ │    │
│  │  │  files      │  │ sprints      │  │agents     │  │milestones   │ │    │
│  │  │  fileDetail │  │ sprintDetail │  │loading    │  │vision       │ │    │
│  │  │  graphData  │  │ tickets      │  │           │  │ganttData    │ │    │
│  │  │  stats      │  │ retroFinding │  │           │  │backlog      │ │    │
│  │  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘  └──────┬──────┘ │    │
│  │         │                │                  │               │        │    │
│  │  ┌──────▼────────────────▼──────────────────▼───────────────▼──────┐ │    │
│  │  │                      API Client                                   │ │    │
│  │  │            (fetch + inflight Map deduplication)                   │ │    │
│  │  └───────────────────────────────────────────────┬──────────────────┘ │    │
│  │                                                    │                   │    │
│  │  ┌─────────────┐                                  │                   │    │
│  │  │   uiStore   │    (no API calls — pure UI state)│                   │    │
│  │  │  activePage │                                  │                   │    │
│  │  │  activeTab  │                                  │                   │    │
│  │  │  sidebar    │                                  │                   │    │
│  │  │  folders    │                                  │                   │    │
│  │  │  search     │                                  │                   │    │
│  │  └─────────────┘                                  │                   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                        │                     │
│  ┌─────────────────────────────────────────────────────▼─────────────────┐  │
│  │                           MCP Server                                   │  │
│  │                                                                         │  │
│  │   GET /api/files        GET /api/sprints       GET /api/agents         │  │
│  │   GET /api/files/:id    GET /api/sprints/:id   GET /api/milestones     │  │
│  │   GET /api/graph        GET /api/gantt         POST /api/sprints       │  │
│  │   GET /api/stats        GET /api/backlog       PATCH /api/milestones   │  │
│  │   GET /api/events (SSE) GET /api/vision        PUT /api/vision         │  │
│  │                ▲                                                        │  │
│  │                └── useEventSource (auto-reconnect, backoff)            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

SSE Event Flow:
  Server emits event  →  useEventSource.onEvent  →  targeted store.fetch*()
  file_changed        →  fileStore.refresh()
  sprint_updated      →  sprintStore.fetchSprints()
  ticket_updated      →  sprintStore.fetchTickets(currentSprintId)
  agent_status        →  agentStore.fetchAgents()

Request Deduplication Flow:
  Component A: fetchFiles() ──┐
                               ├── inflight.get('GET:/api/files') → same Promise
  Component B: fetchFiles() ──┘
                               ↓
                    Single HTTP GET /api/files
                               ↓
                    inflight.delete('GET:/api/files')
                               ↓
                    Both components receive same result
```

---

## File Structure

```
src/dashboard/
├── api/
│   └── client.ts              # ApiClient class with inflight dedup
├── hooks/
│   ├── useEventSource.ts      # SSE listener with auto-reconnect
│   └── useHashRouter.ts       # URL hash ↔ store state sync
└── stores/
    ├── fileStore.ts           # File explorer state
    ├── sprintStore.ts         # Sprint & ticket state
    ├── agentStore.ts          # Agent registry state
    ├── planningStore.ts       # Roadmap & planning state
    ├── uiStore.ts             # UI layout & navigation state
    └── index.ts               # Re-exports all stores
```

---

## Dependencies

```json
{
  "zustand": "^4.5.0",
  "zustand/middleware": "(bundled with zustand)"
}
```

No additional state management libraries required. All async logic lives inside store actions; no thunk/saga middleware needed.

---

## Sprint 9 Implementation Order

1. **Phase 1** — `uiStore` + `useHashRouter` (no API deps, unblocks navigation)
2. **Phase 2** — `apiClient` (unblocks all server stores)
3. **Phase 3** — `fileStore` + `sprintStore` (primary data views)
4. **Phase 4** — `agentStore` + `planningStore` (secondary views)
5. **Phase 5** — `useEventSource` wiring (live updates)
