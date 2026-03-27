import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type PageType = 'dashboard' | 'code' | 'planning' | 'team' | 'retro' | 'marketing';
export type QuickFilter = 'all' | 'mine' | 'blocked' | 'qa-pending';
export type UserRole = 'developer' | 'tech-lead' | 'product-owner' | 'qa' | 'designer';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface UIStore {
  activePage: PageType;
  activeTab: string;
  activeSubTab: string | null;
  sidebarCollapsed: boolean;
  expandedFolders: Set<string>;
  searchQuery: string;
  searchFocused: boolean;

  // New navigation state
  quickFilter: QuickFilter;
  breadcrumbTrail: BreadcrumbItem[];
  userRole: UserRole;

  setPage: (page: string) => void;
  setTab: (tab: string) => void;
  setSubTab: (subTab: string) => void;
  toggleSidebar: () => void;
  toggleFolder: (path: string) => void;
  expandFolderPath: (filePath: string) => void;
  setSearch: (query: string) => void;
  setSearchFocused: (focused: boolean) => void;

  // New navigation actions
  setQuickFilter: (filter: QuickFilter) => void;
  setBreadcrumbTrail: (trail: BreadcrumbItem[]) => void;
  setUserRole: (role: UserRole) => void;
  getDefaultPageForRole: (role: UserRole) => PageType;
}

function defaultTabForPage(page: string): string {
  switch (page) {
    case 'code':      return 'files';
    case 'planning':  return 'roadmap';
    case 'dashboard': return 'board';
    case 'team':      return 'grid';
    case 'retro':     return 'insights';
    case 'marketing': return 'releases';
    default:          return 'board';
  }
}

function getDefaultPageForRole(role: UserRole): PageType {
  switch (role) {
    case 'developer':      return 'dashboard';
    case 'tech-lead':      return 'planning';
    case 'product-owner':  return 'planning';
    case 'qa':             return 'dashboard';
    case 'designer':       return 'team';
    default:               return 'dashboard';
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
    (set, get) => ({
      activePage: 'dashboard',
      activeTab: 'board',
      activeSubTab: null,
      sidebarCollapsed: false,
      expandedFolders: new Set<string>(),
      searchQuery: '',
      searchFocused: false,

      // New navigation state
      quickFilter: 'all',
      breadcrumbTrail: [
        { label: 'Dashboard' },
        { label: 'Sprint Board (Active)' },
      ],
      userRole: 'developer',

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

      // New navigation actions
      setQuickFilter: (filter) => set({ quickFilter: filter }),

      setBreadcrumbTrail: (trail) => set({ breadcrumbTrail: trail }),

      setUserRole: (role) => set({ userRole: role }),

      getDefaultPageForRole: (role) => getDefaultPageForRole(role),
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
        quickFilter: s.quickFilter,
        userRole: s.userRole,
      }),
    },
  ),
);
