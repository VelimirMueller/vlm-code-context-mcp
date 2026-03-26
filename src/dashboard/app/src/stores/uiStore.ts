import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UIStore {
  activePage: 'explorer' | 'planning' | 'sprint';
  activeTab: string;
  activeSubTab: string | null;
  sidebarCollapsed: boolean;
  expandedFolders: Set<string>;
  searchQuery: string;
  searchFocused: boolean;

  setPage: (page: string) => void;
  setTab: (tab: string) => void;
  setSubTab: (subTab: string) => void;
  toggleSidebar: () => void;
  toggleFolder: (path: string) => void;
  expandFolderPath: (filePath: string) => void;
  setSearch: (query: string) => void;
  setSearchFocused: (focused: boolean) => void;
}

function defaultTabForPage(page: string): string {
  switch (page) {
    case 'explorer': return 'files';
    case 'planning': return 'milestones';
    case 'sprint':   return 'board';
    default:         return 'files';
  }
}

// Set is not JSON-serializable; use custom storage
const setReplacer = (_: string, v: unknown) =>
  v instanceof Set ? { __type: 'Set', values: [...v] } : v;
const setReviver = (_: string, v: unknown) =>
  v && typeof v === 'object' && (v as Record<string, unknown>).__type === 'Set'
    ? new Set((v as { values: string[] }).values)
    : v;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      activePage: 'explorer',
      activeTab: 'files',
      activeSubTab: null,
      sidebarCollapsed: false,
      expandedFolders: new Set<string>(),
      searchQuery: '',
      searchFocused: false,

      setPage: (page) =>
        set({
          activePage: page as UIStore['activePage'],
          activeTab: defaultTabForPage(page),
          activeSubTab: null,
        }),

      setTab: (tab) => set({ activeTab: tab, activeSubTab: null }),

      setSubTab: (subTab) => set({ activeSubTab: subTab }),

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      toggleFolder: (path) =>
        set((s) => {
          const next = new Set(s.expandedFolders);
          next.has(path) ? next.delete(path) : next.add(path);
          return { expandedFolders: next };
        }),

      expandFolderPath: (filePath) => {
        const parts = filePath.split('/');
        const ancestors: string[] = [];
        for (let i = 1; i < parts.length; i++) {
          ancestors.push(parts.slice(0, i).join('/'));
        }
        set((s) => ({ expandedFolders: new Set([...s.expandedFolders, ...ancestors]) }));
      },

      setSearch: (query) => set({ searchQuery: query }),

      setSearchFocused: (focused) => set({ searchFocused: focused }),
    }),
    {
      name: 'mcp-ui-store',
      storage: createJSONStorage(() => localStorage, {
        replacer: setReplacer,
        reviver: setReviver,
      }),
      partialize: (s) => ({
        activePage: s.activePage,
        sidebarCollapsed: s.sidebarCollapsed,
        expandedFolders: s.expandedFolders,
      }),
    },
  ),
);
