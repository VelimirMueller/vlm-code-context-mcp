# Sprint 9: React Rewrite --- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **MCP Integration:** All ticket status updates must go through MCP tools. Before starting a task: update_ticket status=IN_PROGRESS. After completing: update_ticket status=DONE, qa_verified=true. Sprint ID: 177.

**Goal:** Replace monolithic dashboard.html with Vite+React+TypeScript+Zustand app

**Architecture:** Vite dev server proxies /api/* to MCP dashboard server. Atomic design components. Zustand for server+UI state. All existing features preserved + interactive workflows added.

**Tech Stack:** Vite, React 18, TypeScript, Zustand, Tailwind CSS

---

## Task 1: T-056 --- Vite + React + TS Scaffold (5pt)

**Objective:** Bootstrap a Vite+React+TypeScript project inside `src/dashboard/app/`, configure dev proxy to the existing MCP dashboard server on port 3333, set up Tailwind CSS with ported design tokens, and wire build output into the existing `npm run build` pipeline.

### Files to Create

| Action | Path |
|--------|------|
| Create | `src/dashboard/app/package.json` |
| Create | `src/dashboard/app/vite.config.ts` |
| Create | `src/dashboard/app/tsconfig.json` |
| Create | `src/dashboard/app/tsconfig.node.json` |
| Create | `src/dashboard/app/tailwind.config.ts` |
| Create | `src/dashboard/app/postcss.config.js` |
| Create | `src/dashboard/app/.eslintrc.cjs` |
| Create | `src/dashboard/app/.prettierrc` |
| Create | `src/dashboard/app/index.html` |
| Create | `src/dashboard/app/src/main.tsx` |
| Create | `src/dashboard/app/src/App.tsx` |
| Create | `src/dashboard/app/src/index.css` |
| Create | `src/dashboard/app/src/vite-env.d.ts` |
| Modify | `package.json` (root) |
| Modify | `src/dashboard/dashboard.ts` |

### Steps

- [ ] **1.1** Create directory structure:
  ```bash
  mkdir -p src/dashboard/app/src
  ```

- [ ] **1.2** Create `src/dashboard/app/package.json`:
  ```json
  {
    "name": "mcp-dashboard",
    "private": true,
    "version": "0.0.1",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc -b && vite build",
      "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
      "preview": "vite preview",
      "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
    },
    "dependencies": {
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "zustand": "^4.5.5"
    },
    "devDependencies": {
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
      "@vitejs/plugin-react": "^4.3.4",
      "autoprefixer": "^10.4.20",
      "eslint": "^9.15.0",
      "eslint-plugin-react-hooks": "^5.0.0",
      "eslint-plugin-react-refresh": "^0.4.14",
      "postcss": "^8.4.49",
      "prettier": "^3.4.2",
      "tailwindcss": "^3.4.17",
      "typescript": "^5.6.3",
      "vite": "^6.0.5"
    }
  }
  ```

- [ ] **1.3** Create `src/dashboard/app/vite.config.ts`:
  ```typescript
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/events': {
          target: 'http://localhost:3333',
          changeOrigin: true,
          // SSE requires no buffering
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['connection'] = 'keep-alive';
            });
          },
        },
        '/api': {
          target: 'http://localhost:3333',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: '../../../dist/dashboard',
      emptyOutDir: true,
      sourcemap: false,
    },
  });
  ```

- [ ] **1.4** Create `src/dashboard/app/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,

      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "isolatedModules": true,
      "moduleDetection": "force",
      "noEmit": true,
      "jsx": "react-jsx",

      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "noFallthroughCasesInSwitch": true,
      "noUncheckedIndexedAccess": true,

      "baseUrl": ".",
      "paths": {
        "@/*": ["./src/*"]
      }
    },
    "include": ["src"],
    "references": [{ "path": "./tsconfig.node.json" }]
  }
  ```

- [ ] **1.5** Create `src/dashboard/app/tsconfig.node.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2023"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "isolatedModules": true,
      "moduleDetection": "force",
      "noEmit": true,
      "strict": true
    },
    "include": ["vite.config.ts"]
  }
  ```

- [ ] **1.6** Create `src/dashboard/app/tailwind.config.ts`:
  ```typescript
  import type { Config } from 'tailwindcss';

  export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        colors: {
          bg: '#0c0c10',
          surface: { DEFAULT: '#131318', '2': '#18181f', '3': '#1e1e28' },
          border: { DEFAULT: '#1c1c28', '2': '#282838' },
          text: { DEFAULT: '#e4e4e7', '2': '#a1a1aa', '3': '#63637a' },
          accent: { DEFAULT: '#10b981', '2': '#34d399', glow: 'rgba(16,185,129,.10)' },
          green: { DEFAULT: '#10b981', glow: 'rgba(16,185,129,.10)' },
          orange: '#fbbf24',
          pink: '#f472b6',
          purple: '#a78bfa',
          red: '#f87171',
          blue: { DEFAULT: '#3b82f6', glow: 'rgba(59,130,246,.10)' },
        },
        borderRadius: {
          card: '14px',
          'card-lg': '18px',
        },
        fontFamily: {
          sans: [
            'Geist Sans',
            'Geist',
            '-apple-system',
            'system-ui',
            'sans-serif',
          ],
          mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
        },
        boxShadow: {
          card: '0 1px 3px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.2)',
          glow: '0 0 24px rgba(16,185,129,.06)',
        },
      },
    },
    plugins: [],
  } satisfies Config;
  ```

- [ ] **1.7** Create `src/dashboard/app/postcss.config.js`:
  ```javascript
  export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  };
  ```

- [ ] **1.8** Create `src/dashboard/app/.eslintrc.cjs`:
  ```javascript
  module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh'],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  };
  ```

- [ ] **1.9** Create `src/dashboard/app/.prettierrc`:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2
  }
  ```

- [ ] **1.10** Create `src/dashboard/app/index.html`:
  ```html
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Code Context Explorer</title>
      <link
        href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-sans/style.min.css"
        rel="stylesheet"
      />
      <link
        href="https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/geist-mono/style.min.css"
        rel="stylesheet"
      />
    </head>
    <body class="bg-bg text-text antialiased">
      <div id="root"></div>
      <script type="module" src="/src/main.tsx"></script>
    </body>
  </html>
  ```

- [ ] **1.11** Create `src/dashboard/app/src/vite-env.d.ts`:
  ```typescript
  /// <reference types="vite/client" />
  ```

- [ ] **1.12** Create `src/dashboard/app/src/index.css`:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: theme('colors.border.2'); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: theme('colors.text.3'); }

  /* ── Animations ── */
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .animate-pulse-dot { animation: pulse-dot 2s infinite; }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
  .animate-skeleton { animation: skeleton-pulse 1.5s ease-in-out infinite; }

  /* ── Body baseline ── */
  body {
    font-size: 13.5px;
    line-height: 1.6;
    overflow: hidden;
  }
  ```

- [ ] **1.13** Create `src/dashboard/app/src/main.tsx`:
  ```tsx
  import { StrictMode } from 'react';
  import { createRoot } from 'react-dom/client';
  import App from './App';
  import './index.css';

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  ```

- [ ] **1.14** Create `src/dashboard/app/src/App.tsx` (skeleton):
  ```tsx
  export default function App() {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="flex items-center gap-5 px-7 border-b border-border bg-surface h-16 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-accent to-green-300 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,.2)]">
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              Code Context <span className="text-text-3 font-normal">Explorer</span>
            </span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center text-text-3">
          Dashboard loading... (React scaffold working)
        </main>
      </div>
    );
  }
  ```

- [ ] **1.15** Modify root `package.json` -- add dashboard scripts:
  ```jsonc
  // Add to "scripts":
  "dashboard:dev": "cd src/dashboard/app && npm run dev",
  "dashboard:build": "cd src/dashboard/app && npm run build",
  // Modify "build" to include dashboard:
  "build": "tsc && cd src/dashboard/app && npm run build"
  ```
  Remove the old `cp src/dashboard/dashboard.html dist/dashboard/` from the build script since Vite now outputs to `dist/dashboard/`.

- [ ] **1.16** Modify `src/dashboard/dashboard.ts` -- serve Vite build output instead of `dashboard.html`:
  Replace the static file serving block (which currently reads `dashboard.html`) with:
  ```typescript
  // Serve Vite build output (index.html + assets)
  const distDir = path.resolve(__dirname);
  // ... serve index.html for non-API routes
  // ... serve static assets from dist/dashboard/assets/
  ```
  The server must:
  - Serve `dist/dashboard/index.html` for `/` and any non-API, non-asset route (SPA fallback)
  - Serve `dist/dashboard/assets/*` with correct MIME types for `.js`, `.css`, `.svg`, `.png`
  - Keep all existing `/api/*` routes unchanged

- [ ] **1.17** Install dependencies:
  ```bash
  cd src/dashboard/app && npm install
  ```

- [ ] **1.18** Verify dev server starts and proxies API:
  ```bash
  # Terminal 1: start MCP server
  npm run dashboard -- ./context.db 3333 .
  # Terminal 2: start Vite dev
  npm run dashboard:dev
  # Terminal 3: verify proxy
  curl http://localhost:5173/api/stats
  ```
  **Expected:** JSON response with `{ files, exports, deps, totalLines, ... }`

- [ ] **1.19** Verify production build:
  ```bash
  npm run dashboard:build
  ls dist/dashboard/
  ```
  **Expected:** `index.html`, `assets/` directory with `.js` and `.css` bundles

**Git commit:**
```
feat(dashboard): scaffold Vite+React+TS app with Tailwind and dev proxy

T-056: Initialize src/dashboard/app/ with Vite 6, React 18, TypeScript strict,
Zustand, Tailwind CSS using existing design tokens. Dev server proxies /api/*
and /api/events (SSE) to port 3333. Build output replaces old dashboard.html.
```

---

## Task 2: T-057 --- Zustand Stores + API Hooks (5pt)

**Objective:** Implement all 5 Zustand stores (fileStore, sprintStore, agentStore, planningStore, uiStore), the typed API client with request deduplication, all shared TypeScript interfaces, utility functions, constants, and all custom hooks.

### Files to Create

| Action | Path |
|--------|------|
| Create | `src/dashboard/app/src/types/index.ts` |
| Create | `src/dashboard/app/src/lib/api.ts` |
| Create | `src/dashboard/app/src/lib/utils.ts` |
| Create | `src/dashboard/app/src/lib/constants.ts` |
| Create | `src/dashboard/app/src/stores/fileStore.ts` |
| Create | `src/dashboard/app/src/stores/sprintStore.ts` |
| Create | `src/dashboard/app/src/stores/agentStore.ts` |
| Create | `src/dashboard/app/src/stores/planningStore.ts` |
| Create | `src/dashboard/app/src/stores/uiStore.ts` |
| Create | `src/dashboard/app/src/stores/index.ts` |
| Create | `src/dashboard/app/src/hooks/useFiles.ts` |
| Create | `src/dashboard/app/src/hooks/useSprints.ts` |
| Create | `src/dashboard/app/src/hooks/useAgents.ts` |
| Create | `src/dashboard/app/src/hooks/usePlanning.ts` |
| Create | `src/dashboard/app/src/hooks/useSearch.ts` |
| Create | `src/dashboard/app/src/hooks/useEventSource.ts` |
| Create | `src/dashboard/app/src/hooks/useHashRouter.ts` |
| Create | `src/dashboard/app/src/hooks/useKeyboard.ts` |
| Create | `src/dashboard/app/src/hooks/index.ts` |

### Steps

- [ ] **2.1** Create `src/dashboard/app/src/types/index.ts` -- all shared domain interfaces:
  ```typescript
  // ── Code Explorer types ──
  export interface FileRecord {
    id: number;
    path: string;
    language: string;
    extension: string;
    size_bytes: number;
    line_count: number;
    summary: string | null;
    external_imports: string | null;
    created_at: string;
    modified_at: string;
    indexed_at: string;
    export_count: number;
    imports_count: number;
    imported_by_count: number;
  }

  export interface DirectoryRecord {
    id: number;
    path: string;
    name: string;
    parent_path: string | null;
    file_count: number;
  }

  export interface FileDetail {
    id: number;
    path: string;
    language: string;
    extension: string;
    size_bytes: number;
    line_count: number;
    summary: string | null;
    external_imports: string | null;
    exports: ExportSymbol[];
    imports: ImportRecord[];
    importedBy: ImportRecord[];
  }

  export interface ExportSymbol {
    name: string;
    kind: string;
    description: string | null;
  }

  export interface ImportRecord {
    id: number;
    path: string;
    summary: string | null;
    symbols: string | null;
  }

  export interface Change {
    id: number;
    file_path: string;
    event: 'add' | 'change' | 'delete';
    timestamp: string;
    old_summary: string | null;
    new_summary: string | null;
    old_line_count: number | null;
    new_line_count: number | null;
    old_size_bytes: number | null;
    new_size_bytes: number | null;
    old_exports: string | null;
    new_exports: string | null;
    diff_text: string | null;
    reason: string | null;
  }

  export interface GraphData {
    nodes: Array<{ id: number; label: string }>;
    edges: Array<{ source: number; target: number; symbols: string | null }>;
  }

  export interface Stats {
    files: number;
    exports: number;
    deps: number;
    totalLines: number;
    totalSize: number;
    languages: Array<{ language: string; c: number }>;
    extensions: Array<{ extension: string; c: number }>;
  }

  // ── Sprint / Scrum types ──
  export interface Sprint {
    id: number;
    name: string;
    goal: string | null;
    status: string;
    velocity_committed: number;
    velocity_achieved: number | null;
    created_at: string;
    started_at: string | null;
    ended_at: string | null;
    ticket_count: number;
    done_count: number;
    qa_count: number;
    retro_count: number;
    open_blockers: number;
  }

  export interface Ticket {
    id: number;
    ticket_ref: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    assigned_to: string | null;
    story_points: number;
    milestone: string | null;
    milestone_id: number | null;
    qa_verified: number;
    verified_by: string | null;
    acceptance_criteria: string | null;
    notes: string | null;
  }

  export interface RetroFinding {
    id: number;
    role: string;
    category: 'went_well' | 'went_wrong' | 'try_next';
    finding: string;
    action_owner: string | null;
    action_applied: number;
  }

  // ── Agent types ──
  export interface Agent {
    role: string;
    name: string;
    description: string;
    model: string;
    done_tickets: number;
    active_tickets: number;
    blocked_tickets: number;
    active_points: number;
    mood: number;
    mood_emoji: string;
    mood_label: string;
  }

  // ── Planning types ──
  export interface Milestone {
    id: number;
    name: string;
    description: string | null;
    target_date: string | null;
    status: string;
    progress: number | null;
    created_at: string;
    updated_at: string;
    ticket_count: number;
    done_count: number;
  }

  export interface CreateMilestoneInput {
    name: string;
    description?: string;
    target_date?: string;
    status?: string;
  }

  export interface UpdateMilestoneInput {
    status?: string;
    description?: string;
    progress?: number;
    target_date?: string;
  }

  export interface PlanSprintInput {
    name: string;
    goal?: string;
    ticket_ids: number[];
    velocity_committed?: number;
  }

  export interface SkillRecord {
    name: string;
    content: string;
    owner_role: string | null;
    updated_at: string | null;
  }

  // ── UI types ──
  export type PageId = 'explorer' | 'sprint' | 'planning';
  export type ExplorerTab = 'detail' | 'changes' | 'graph';
  export type SprintSubTab = 'board' | 'team' | 'insights';
  export type PlanningSubTab = 'milestones' | 'vision' | 'gantt';
  ```

- [ ] **2.2** Create `src/dashboard/app/src/lib/api.ts` -- typed fetch wrapper with request deduplication:
  ```typescript
  type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  class ApiClient {
    private inflight = new Map<string, Promise<unknown>>();

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
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
      }
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    }
  }

  export const api = new ApiClient();
  ```

- [ ] **2.3** Create `src/dashboard/app/src/lib/utils.ts`:
  ```typescript
  /** Format byte count as human-readable string */
  export function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Format ISO timestamp as relative or short date */
  export function fmtDate(iso: string): string {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /** Language -> dot color mapping */
  export const langColors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3776ab',
    Rust: '#dea584',
    Go: '#00add8',
    JSON: '#a1a1aa',
    Markdown: '#63637a',
    CSS: '#264de4',
    HTML: '#e34c26',
    YAML: '#cb171e',
    Shell: '#89e051',
    SQL: '#e38c00',
  };

  /** Agent mood score -> Tailwind color class */
  export function getMoodColor(mood: number): string {
    if (mood >= 80) return 'text-accent';
    if (mood >= 60) return 'text-green-400';
    if (mood >= 40) return 'text-orange';
    if (mood >= 20) return 'text-red';
    return 'text-red';
  }

  /** Group tickets by status for kanban columns */
  export function groupByStatus<T extends { status: string }>(
    items: T[],
  ): Record<string, T[]> {
    const groups: Record<string, T[]> = {};
    for (const item of items) {
      (groups[item.status] ??= []).push(item);
    }
    return groups;
  }

  /** Escape HTML entities */
  export function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Debounce a function call */
  export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    ms: number,
  ): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }
  ```

- [ ] **2.4** Create `src/dashboard/app/src/lib/constants.ts`:
  ```typescript
  import type { PageId, ExplorerTab, SprintSubTab, PlanningSubTab } from '@/types';

  export const PAGE_LABELS: Record<PageId, string> = {
    explorer: 'Code Explorer',
    sprint: 'Sprint',
    planning: 'Project Management',
  };

  export const EXPLORER_TABS: { id: ExplorerTab; label: string }[] = [
    { id: 'detail', label: 'Detail' },
    { id: 'changes', label: 'Changes' },
    { id: 'graph', label: 'Graph' },
  ];

  export const SPRINT_SUB_TABS: { id: SprintSubTab; label: string }[] = [
    { id: 'board', label: 'Board' },
    { id: 'team', label: 'Team' },
    { id: 'insights', label: 'Retro Insights' },
  ];

  export const PLANNING_SUB_TABS: { id: PlanningSubTab; label: string }[] = [
    { id: 'milestones', label: 'Milestones' },
    { id: 'vision', label: 'Product Vision' },
    { id: 'gantt', label: 'Gantt Chart' },
  ];

  export const KANBAN_COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;

  export const KANBAN_COLUMN_LABELS: Record<string, string> = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    DONE: 'Done',
    BLOCKED: 'Blocked',
  };

  export const PRIORITY_COLORS: Record<string, string> = {
    P0: 'bg-red/10 text-red border-red/20',
    P1: 'bg-orange/10 text-orange border-orange/20',
    P2: 'bg-blue/10 text-blue border-blue/20',
    P3: 'bg-text-3/10 text-text-3 border-text-3/20',
  };

  export const STATUS_COLORS: Record<string, string> = {
    active: 'bg-accent',
    planning: 'bg-blue',
    closed: 'bg-text-3',
    completed: 'bg-accent',
    planned: 'bg-purple',
    in_progress: 'bg-blue',
  };
  ```

- [ ] **2.5** Create `src/dashboard/app/src/stores/fileStore.ts`:
  ```typescript
  import { create } from 'zustand';
  import { api } from '@/lib/api';
  import type { FileRecord, DirectoryRecord, FileDetail, Change, GraphData, Stats } from '@/types';

  interface FileStore {
    files: FileRecord[];
    directories: DirectoryRecord[];
    selectedFileId: number | null;
    fileDetail: FileDetail | null;
    fileChanges: Change[];
    graphData: GraphData | null;
    stats: Stats | null;
    loading: { files: boolean; detail: boolean; changes: boolean; graph: boolean };
    error: { files: string | null; detail: string | null };

    fetchFiles: () => Promise<void>;
    fetchDirectories: () => Promise<void>;
    selectFile: (id: number) => Promise<void>;
    clearSelection: () => void;
    fetchGraph: () => Promise<void>;
    fetchStats: () => Promise<void>;
    refresh: () => Promise<void>;
  }

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
      set((s) => ({ loading: { ...s.loading, files: true }, error: { ...s.error, files: null } }));
      try {
        const files = await api.get<FileRecord[]>('/api/files');
        set({ files });
      } catch (e) {
        set((s) => ({ error: { ...s.error, files: (e as Error).message } }));
      } finally {
        set((s) => ({ loading: { ...s.loading, files: false } }));
      }
    },

    fetchDirectories: async () => {
      const directories = await api.get<DirectoryRecord[]>('/api/directories');
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
          api.get<FileDetail>(`/api/file/${id}`),
          api.get<Change[]>(`/api/file/${id}/changes`),
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

    clearSelection: () =>
      set({ selectedFileId: null, fileDetail: null, fileChanges: [] }),

    fetchGraph: async () => {
      set((s) => ({ loading: { ...s.loading, graph: true } }));
      try {
        const graphData = await api.get<GraphData>('/api/graph');
        set({ graphData });
      } finally {
        set((s) => ({ loading: { ...s.loading, graph: false } }));
      }
    },

    fetchStats: async () => {
      const stats = await api.get<Stats>('/api/stats');
      set({ stats });
    },

    refresh: async () => {
      const { fetchFiles, fetchDirectories, fetchStats, selectedFileId, selectFile } = get();
      await Promise.all([fetchFiles(), fetchDirectories(), fetchStats()]);
      if (selectedFileId !== null) await selectFile(selectedFileId);
    },
  }));
  ```

- [ ] **2.6** Create `src/dashboard/app/src/stores/sprintStore.ts`:
  ```typescript
  import { create } from 'zustand';
  import { api } from '@/lib/api';
  import type { Sprint, Ticket, RetroFinding } from '@/types';

  interface SprintStore {
    sprints: Sprint[];
    selectedSprintId: number | null;
    sprintDetail: Sprint | null;
    tickets: Ticket[];
    retroFindings: RetroFinding[];
    loading: { sprints: boolean; detail: boolean };
    error: { sprints: string | null; detail: string | null };

    fetchSprints: () => Promise<void>;
    selectSprint: (id: number) => Promise<void>;
    fetchRetro: (sprintId: number) => Promise<void>;
  }

  export const useSprintStore = create<SprintStore>((set, get) => ({
    sprints: [],
    selectedSprintId: null,
    sprintDetail: null,
    tickets: [],
    retroFindings: [],
    loading: { sprints: false, detail: false },
    error: { sprints: null, detail: null },

    fetchSprints: async () => {
      set((s) => ({ loading: { ...s.loading, sprints: true } }));
      try {
        const sprints = await api.get<Sprint[]>('/api/sprints');
        set({ sprints });
        // Auto-select active sprint if none selected
        const { selectedSprintId } = get();
        if (selectedSprintId === null) {
          const active = sprints.find((s) => s.status === 'active');
          if (active) get().selectSprint(active.id);
        }
      } catch (e) {
        set((s) => ({ error: { ...s.error, sprints: (e as Error).message } }));
      } finally {
        set((s) => ({ loading: { ...s.loading, sprints: false } }));
      }
    },

    selectSprint: async (id: number) => {
      set((s) => ({ selectedSprintId: id, loading: { ...s.loading, detail: true } }));
      try {
        const [detail, tickets, retro] = await Promise.all([
          api.get<Sprint>(`/api/sprint/${id}`),
          api.get<Ticket[]>(`/api/sprint/${id}/tickets`),
          api.get<RetroFinding[]>(`/api/sprint/${id}/retro`),
        ]);
        set({ sprintDetail: detail, tickets, retroFindings: retro });
      } catch (e) {
        set((s) => ({ error: { ...s.error, detail: (e as Error).message } }));
      } finally {
        set((s) => ({ loading: { ...s.loading, detail: false } }));
      }
    },

    fetchRetro: async (sprintId: number) => {
      const retroFindings = await api.get<RetroFinding[]>(`/api/sprint/${sprintId}/retro`);
      set({ retroFindings });
    },
  }));
  ```

- [ ] **2.7** Create `src/dashboard/app/src/stores/agentStore.ts`:
  ```typescript
  import { create } from 'zustand';
  import { api } from '@/lib/api';
  import type { Agent } from '@/types';

  interface AgentStore {
    agents: Agent[];
    loading: boolean;
    fetchAgents: () => Promise<void>;
  }

  export const useAgentStore = create<AgentStore>((set) => ({
    agents: [],
    loading: false,

    fetchAgents: async () => {
      set({ loading: true });
      try {
        const agents = await api.get<Agent[]>('/api/agents');
        set({ agents });
      } finally {
        set({ loading: false });
      }
    },
  }));
  ```

- [ ] **2.8** Create `src/dashboard/app/src/stores/planningStore.ts`:
  ```typescript
  import { create } from 'zustand';
  import { api } from '@/lib/api';
  import type {
    Milestone, Sprint, Ticket, SkillRecord,
    CreateMilestoneInput, UpdateMilestoneInput, PlanSprintInput,
  } from '@/types';

  interface PlanningStore {
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

  export const usePlanningStore = create<PlanningStore>((set, get) => ({
    milestones: [],
    vision: null,
    ganttData: [],
    backlog: [],
    loading: { milestones: false, vision: false, gantt: false, backlog: false },

    fetchMilestones: async () => {
      set((s) => ({ loading: { ...s.loading, milestones: true } }));
      try {
        const milestones = await api.get<Milestone[]>('/api/milestones');
        set({ milestones });
      } finally {
        set((s) => ({ loading: { ...s.loading, milestones: false } }));
      }
    },

    createMilestone: async (data: CreateMilestoneInput) => {
      const created = await api.post<Milestone>('/api/milestones', data);
      set((s) => ({ milestones: [...s.milestones, created] }));
    },

    updateMilestone: async (id: number, data: UpdateMilestoneInput) => {
      // Optimistic update
      set((s) => ({
        milestones: s.milestones.map((m) => (m.id === id ? { ...m, ...data } : m)),
      }));
      try {
        await api.put(`/api/milestone/${id}`, data);
      } catch (e) {
        // Rollback on error
        get().fetchMilestones();
        throw e;
      }
    },

    fetchVision: async () => {
      set((s) => ({ loading: { ...s.loading, vision: true } }));
      try {
        const skill = await api.get<SkillRecord>('/api/skill/PRODUCT_VISION');
        set({ vision: skill?.content ?? null });
      } finally {
        set((s) => ({ loading: { ...s.loading, vision: false } }));
      }
    },

    updateVision: async (content: string) => {
      set({ vision: content }); // Optimistic
      await api.put('/api/vision', { content });
    },

    fetchGantt: async () => {
      set((s) => ({ loading: { ...s.loading, gantt: true } }));
      try {
        const ganttData = await api.get<Sprint[]>('/api/sprints');
        set({ ganttData });
      } finally {
        set((s) => ({ loading: { ...s.loading, gantt: false } }));
      }
    },

    fetchBacklog: async () => {
      set((s) => ({ loading: { ...s.loading, backlog: true } }));
      try {
        const backlog = await api.get<Ticket[]>('/api/backlog');
        set({ backlog });
      } finally {
        set((s) => ({ loading: { ...s.loading, backlog: false } }));
      }
    },

    planSprint: async (data: PlanSprintInput) => {
      const result = await api.post<{ id: number }>('/api/sprints/plan', data);
      await Promise.all([get().fetchGantt(), get().fetchBacklog()]);
      return result;
    },
  }));
  ```

- [ ] **2.9** Create `src/dashboard/app/src/stores/uiStore.ts`:
  ```typescript
  import { create } from 'zustand';
  import { persist, createJSONStorage } from 'zustand/middleware';
  import type { PageId } from '@/types';

  interface UIStore {
    activePage: PageId;
    activeTab: string;
    activeSubTab: string | null;
    sidebarCollapsed: boolean;
    expandedFolders: Set<string>;
    searchQuery: string;
    searchFocused: boolean;

    setPage: (page: PageId) => void;
    setTab: (tab: string) => void;
    setSubTab: (subTab: string | null) => void;
    toggleSidebar: () => void;
    toggleFolder: (path: string) => void;
    expandFolderPath: (filePath: string) => void;
    setSearch: (query: string) => void;
    setSearchFocused: (focused: boolean) => void;
  }

  function defaultTabForPage(page: PageId): string {
    switch (page) {
      case 'explorer': return 'detail';
      case 'sprint':   return 'board';
      case 'planning': return 'milestones';
    }
  }

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
        activeTab: 'detail',
        activeSubTab: null,
        sidebarCollapsed: false,
        expandedFolders: new Set<string>(),
        searchQuery: '',
        searchFocused: false,

        setPage: (page) =>
          set({ activePage: page, activeTab: defaultTabForPage(page), activeSubTab: null }),

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
  ```

- [ ] **2.10** Create `src/dashboard/app/src/stores/index.ts`:
  ```typescript
  export { useFileStore } from './fileStore';
  export { useSprintStore } from './sprintStore';
  export { useAgentStore } from './agentStore';
  export { usePlanningStore } from './planningStore';
  export { useUIStore } from './uiStore';
  ```

- [ ] **2.11** Create `src/dashboard/app/src/hooks/useEventSource.ts`:
  ```typescript
  import { useEffect, useRef, useCallback } from 'react';
  import { useFileStore } from '@/stores/fileStore';
  import { useSprintStore } from '@/stores/sprintStore';
  import { useAgentStore } from '@/stores/agentStore';

  export function useEventSource(url = '/api/events') {
    const esRef = useRef<EventSource | null>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryDelay = useRef(1000);

    const refreshFiles = useFileStore((s) => s.refresh);
    const fetchSprints = useSprintStore((s) => s.fetchSprints);
    const fetchAgents = useAgentStore((s) => s.fetchAgents);

    const connect = useCallback(() => {
      esRef.current?.close();
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        retryDelay.current = 1000;
      };

      es.onmessage = () => {
        // The current server sends "updated" on any file change
        // Refresh all stores to stay in sync
        refreshFiles();
        fetchSprints();
        fetchAgents();
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        const delay = Math.min(retryDelay.current, 30_000);
        retryDelay.current = Math.min(delay * 2, 30_000);
        retryRef.current = setTimeout(connect, delay);
      };
    }, [url, refreshFiles, fetchSprints, fetchAgents]);

    useEffect(() => {
      connect();
      return () => {
        esRef.current?.close();
        if (retryRef.current) clearTimeout(retryRef.current);
      };
    }, [connect]);
  }
  ```

- [ ] **2.12** Create `src/dashboard/app/src/hooks/useHashRouter.ts`:
  ```typescript
  import { useEffect } from 'react';
  import { useUIStore } from '@/stores/uiStore';
  import { useFileStore } from '@/stores/fileStore';
  import { useSprintStore } from '@/stores/sprintStore';
  import type { PageId } from '@/types';

  function parseHash(hash: string) {
    const clean = hash.replace(/^#/, '');
    const [page = 'explorer', tab = 'detail', id] = clean.split('/');
    return { page: page as PageId, tab, resourceId: id ? parseInt(id, 10) : null };
  }

  function buildHash(page: string, tab: string, resourceId?: number | null): string {
    const base = `#${page}/${tab}`;
    return resourceId != null ? `${base}/${resourceId}` : base;
  }

  export function useHashRouter() {
    const { activePage, activeTab, setPage, setTab } = useUIStore();
    const { selectedFileId, selectFile } = useFileStore();
    const { selectedSprintId, selectSprint } = useSprintStore();

    // Hash -> state
    useEffect(() => {
      function syncFromHash() {
        const { page, tab, resourceId } = parseHash(window.location.hash);
        const currentPage = useUIStore.getState().activePage;
        const currentTab = useUIStore.getState().activeTab;

        if (page !== currentPage) setPage(page);
        if (tab !== currentTab) setTab(tab);

        if (resourceId !== null) {
          if (page === 'explorer' && resourceId !== useFileStore.getState().selectedFileId) {
            selectFile(resourceId);
          }
          if (page === 'sprint' && resourceId !== useSprintStore.getState().selectedSprintId) {
            selectSprint(resourceId);
          }
        }
      }

      syncFromHash();
      window.addEventListener('hashchange', syncFromHash);
      return () => window.removeEventListener('hashchange', syncFromHash);
    }, [setPage, setTab, selectFile, selectSprint]);

    // State -> hash
    useEffect(() => {
      let resourceId: number | null = null;
      if (activePage === 'explorer') resourceId = selectedFileId;
      if (activePage === 'sprint') resourceId = selectedSprintId;

      const newHash = buildHash(activePage, activeTab, resourceId);
      if (window.location.hash !== newHash) {
        window.history.pushState(null, '', newHash);
      }
    }, [activePage, activeTab, selectedFileId, selectedSprintId]);
  }
  ```

- [ ] **2.13** Create `src/dashboard/app/src/hooks/useKeyboard.ts`:
  ```typescript
  import { useEffect } from 'react';
  import { useUIStore } from '@/stores/uiStore';

  export function useKeyboard() {
    const setSearchFocused = useUIStore((s) => s.setSearchFocused);

    useEffect(() => {
      function handler(e: KeyboardEvent) {
        // Cmd+K or Ctrl+K -> focus search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          setSearchFocused(true);
        }
        // Esc -> dismiss search
        if (e.key === 'Escape') {
          setSearchFocused(false);
        }
      }
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [setSearchFocused]);
  }
  ```

- [ ] **2.14** Create `src/dashboard/app/src/hooks/useSearch.ts`:
  ```typescript
  import { useMemo } from 'react';
  import { useUIStore } from '@/stores/uiStore';
  import { useFileStore } from '@/stores/fileStore';
  import type { FileRecord } from '@/types';

  export function useSearch(): FileRecord[] {
    const query = useUIStore((s) => s.searchQuery);
    const files = useFileStore((s) => s.files);

    return useMemo(() => {
      if (!query.trim()) return files;
      const lower = query.toLowerCase();
      return files.filter(
        (f) =>
          f.path.toLowerCase().includes(lower) ||
          (f.language && f.language.toLowerCase().includes(lower)),
      );
    }, [query, files]);
  }
  ```

- [ ] **2.15** Create `src/dashboard/app/src/hooks/useFiles.ts`:
  ```typescript
  import { useEffect } from 'react';
  import { useFileStore } from '@/stores/fileStore';

  /** Fetch files and directories on mount */
  export function useFiles() {
    const fetchFiles = useFileStore((s) => s.fetchFiles);
    const fetchDirectories = useFileStore((s) => s.fetchDirectories);
    const fetchStats = useFileStore((s) => s.fetchStats);
    const fetchGraph = useFileStore((s) => s.fetchGraph);

    useEffect(() => {
      fetchFiles();
      fetchDirectories();
      fetchStats();
      fetchGraph();
    }, [fetchFiles, fetchDirectories, fetchStats, fetchGraph]);
  }
  ```

- [ ] **2.16** Create `src/dashboard/app/src/hooks/useSprints.ts`:
  ```typescript
  import { useEffect } from 'react';
  import { useSprintStore } from '@/stores/sprintStore';

  /** Fetch sprint list on mount */
  export function useSprints() {
    const fetchSprints = useSprintStore((s) => s.fetchSprints);

    useEffect(() => {
      fetchSprints();
    }, [fetchSprints]);
  }
  ```

- [ ] **2.17** Create `src/dashboard/app/src/hooks/useAgents.ts`:
  ```typescript
  import { useEffect } from 'react';
  import { useAgentStore } from '@/stores/agentStore';

  /** Fetch agents on mount */
  export function useAgents() {
    const fetchAgents = useAgentStore((s) => s.fetchAgents);

    useEffect(() => {
      fetchAgents();
    }, [fetchAgents]);
  }
  ```

- [ ] **2.18** Create `src/dashboard/app/src/hooks/usePlanning.ts`:
  ```typescript
  import { useEffect } from 'react';
  import { usePlanningStore } from '@/stores/planningStore';

  /** Fetch milestones, vision, gantt on mount */
  export function usePlanning() {
    const fetchMilestones = usePlanningStore((s) => s.fetchMilestones);
    const fetchVision = usePlanningStore((s) => s.fetchVision);
    const fetchGantt = usePlanningStore((s) => s.fetchGantt);

    useEffect(() => {
      fetchMilestones();
      fetchVision();
      fetchGantt();
    }, [fetchMilestones, fetchVision, fetchGantt]);
  }
  ```

- [ ] **2.19** Create `src/dashboard/app/src/hooks/index.ts`:
  ```typescript
  export { useFiles } from './useFiles';
  export { useSprints } from './useSprints';
  export { useAgents } from './useAgents';
  export { usePlanning } from './usePlanning';
  export { useSearch } from './useSearch';
  export { useEventSource } from './useEventSource';
  export { useHashRouter } from './useHashRouter';
  export { useKeyboard } from './useKeyboard';
  ```

- [ ] **2.20** Verify TypeScript compiles with no errors:
  ```bash
  cd src/dashboard/app && npx tsc --noEmit
  ```
  **Expected:** Exit code 0, no type errors.

- [ ] **2.21** Verify stores integrate with App.tsx -- update App.tsx to wire in hooks:
  ```tsx
  // In App.tsx, add:
  import { useEventSource, useHashRouter, useKeyboard } from '@/hooks';

  export default function App() {
    useEventSource();
    useHashRouter();
    useKeyboard();
    // ... rest of component
  }
  ```
  Start dev server and confirm no console errors, SSE connects.

**Git commit:**
```
feat(dashboard): implement Zustand stores, API client, and React hooks

T-057: Add 5 Zustand stores (file, sprint, agent, planning, ui) with typed
interfaces. Implement API client with request deduplication. Add hooks for
data fetching, SSE, hash routing, keyboard shortcuts, and search.
```

---

## Task 3: T-058 --- Code Explorer Page (3pt)

**Objective:** Build the Code Explorer page with sidebar file tree, detail tab, changes tab, graph tab, search bar, top stats bar, and keyboard shortcuts. Full feature parity with the current monolithic dashboard.

### Files to Create

| Action | Path |
|--------|------|
| Create | `src/dashboard/app/src/components/atoms/Badge.tsx` |
| Create | `src/dashboard/app/src/components/atoms/Button.tsx` |
| Create | `src/dashboard/app/src/components/atoms/Dot.tsx` |
| Create | `src/dashboard/app/src/components/atoms/Skeleton.tsx` |
| Create | `src/dashboard/app/src/components/atoms/Stat.tsx` |
| Create | `src/dashboard/app/src/components/atoms/Input.tsx` |
| Create | `src/dashboard/app/src/components/molecules/FileItem.tsx` |
| Create | `src/dashboard/app/src/components/molecules/FolderItem.tsx` |
| Create | `src/dashboard/app/src/components/molecules/SearchBar.tsx` |
| Create | `src/dashboard/app/src/components/molecules/StatGroup.tsx` |
| Create | `src/dashboard/app/src/components/molecules/TabBar.tsx` |
| Create | `src/dashboard/app/src/components/molecules/MarkdownRenderer.tsx` |
| Create | `src/dashboard/app/src/components/organisms/FileTree.tsx` |
| Create | `src/dashboard/app/src/components/organisms/DependencyGraph.tsx` |
| Create | `src/dashboard/app/src/components/organisms/Topbar.tsx` |
| Create | `src/dashboard/app/src/components/templates/ExplorerLayout.tsx` |
| Create | `src/dashboard/app/src/pages/CodeExplorer.tsx` |
| Modify | `src/dashboard/app/src/App.tsx` |

### Steps

- [ ] **3.1** Create atom components:

  **Badge.tsx** -- renders status/priority badges with color variants:
  ```typescript
  // Props: variant (fn|type|const|class|interface|pkg), children
  // Renders: <span> with appropriate bg/text/border Tailwind classes
  // Maps variant to color: fn->blue, type->purple, const->green, class->orange, interface->pink, pkg->surface
  ```

  **Button.tsx** -- action button with primary/ghost/danger variants:
  ```typescript
  // Props: variant (primary|ghost|danger), size (sm|md), onClick, disabled, children
  // Primary: accent bg, white text
  // Ghost: transparent bg, text-2 color, border on hover
  // Danger: red bg/text
  ```

  **Dot.tsx** -- colored circle for language/status indicators:
  ```typescript
  // Props: color (CSS color string), size (number, default 8)
  // Renders: <span> with inline backgroundColor and rounded-full
  ```

  **Skeleton.tsx** -- shimmer loading placeholder:
  ```typescript
  // Props: className (for width/height)
  // Renders: <div> with bg-surface-2 rounded animate-skeleton
  ```

  **Stat.tsx** -- single stat with number and label:
  ```typescript
  // Props: value (string|number), label (string)
  // Renders: stacked value (font-mono text-[17px] font-bold) + label (text-[9px] uppercase)
  // Container: bg-surface-2 border border-border rounded-xl px-[18px] py-2
  ```

  **Input.tsx** -- text input with optional left icon:
  ```typescript
  // Props: value, onChange, placeholder, icon (ReactNode), className, onFocus, onBlur, ref
  // Renders: relative wrapper with positioned icon + input element
  // Focus state: border-accent, ring-accent/10, bg-surface-2
  ```

- [ ] **3.2** Create molecule components:

  **FileItem.tsx**:
  ```typescript
  // Props: file (FileRecord), isActive (boolean), onClick
  // Renders: flex row with Dot (langColors[file.language]), file name (last segment of path), fmtSize(size_bytes)
  // Active state: bg-accent-glow, border-accent/25, left green bar, name in accent-2 color
  ```

  **FolderItem.tsx**:
  ```typescript
  // Props: name (string), fileCount (number), isOpen (boolean), depth (number), onClick
  // Renders: flex row with chevron SVG (rotated when open), folder emoji, folder name, count pill
  // Indented by depth * 14px via paddingLeft
  ```

  **SearchBar.tsx**:
  ```typescript
  // Props: value, onChange, onFocus, inputRef
  // Renders: Input with search SVG icon, placeholder "Search files... Cmd+K", width 280px
  // Uses useUIStore.searchFocused to auto-focus via ref
  ```

  **StatGroup.tsx**:
  ```typescript
  // Props: stats ({ value, label }[])
  // Renders: flex row of Stat atoms with gap-2
  ```

  **TabBar.tsx**:
  ```typescript
  // Props: tabs ({ id, label }[]), activeId (string), onChange (id) => void
  // Renders: flex row of tab buttons with underline style
  // Active tab: text-text, border-b-2 border-accent
  ```

- [ ] **3.3** Create FileTree organism:
  ```typescript
  // Smart component -- manages expandedDirs, auto-expand on search/select
  // Props: files (FileRecord[]), directories (DirectoryRecord[]), selectedFileId, onSelectFile
  // Reads expandedFolders and toggleFolder from uiStore
  // Builds recursive tree: group files by directory, render FolderItem + children
  // All folders collapsed by default
  // When selectedFileId changes, call uiStore.expandFolderPath(selectedFile.path)
  // Filtered by useSearch() results
  ```

- [ ] **3.4** Create DependencyGraph organism:
  ```typescript
  // Smart component -- canvas-based force-directed graph
  // Props: graphData (GraphData | null), loading (boolean)
  // Uses useRef<HTMLCanvasElement> for canvas element
  // Implements force simulation:
  //   - Nodes positioned with simple force layout (repulsion + spring edges)
  //   - requestAnimationFrame loop for animation
  //   - Mouse pan (drag background) and zoom (wheel)
  //   - Draw nodes as circles with labels, edges as lines
  //   - Node color based on file language (langColors)
  // Shows Skeleton while loading
  // Cleanup: cancel animationFrame on unmount
  ```

- [ ] **3.5** Create Topbar organism:
  ```typescript
  // Props: none (reads from stores)
  // Reads stats from fileStore, searchQuery from uiStore
  // Renders: logo + SearchBar + StatGroup (files, lines, size, langs) + live dot
  // Includes page nav tabs (Code Explorer, Sprint, Project Management)
  // Calls uiStore.setPage on tab click
  ```

- [ ] **3.6** Create ExplorerLayout template:
  ```typescript
  // Props: sidebar (ReactNode), main (ReactNode)
  // Renders: flex row with 300px sidebar (border-right) + flex-1 main panel
  // Sidebar collapsible via uiStore.sidebarCollapsed
  ```

- [ ] **3.7** Create CodeExplorer page:
  ```typescript
  // Smart component -- orchestrates Code Explorer page
  // Uses useFiles() hook on mount
  // Renders ExplorerLayout with:
  //   Sidebar: FileTree
  //   Main: TabBar (Detail | Changes | Graph) + active tab content
  //
  // Detail tab content:
  //   - File path, language badge, size, line count
  //   - Exports table (name, kind badge, description)
  //   - Imports list (clickable paths with symbols)
  //   - Imported-by list (clickable paths with symbols)
  //   - Click on import/imported-by -> selectFile(id)
  //
  // Changes tab content:
  //   - Time-grouped list of Change cards
  //   - Each card: event badge (add/change/delete), timestamp, diff summary
  //   - Expandable diff block with colored +/- lines
  //
  // Graph tab content:
  //   - DependencyGraph organism (full size)
  //
  // Empty state: "Select a file to view details" when no file selected
  // Loading state: Skeleton placeholders in detail and changes tabs
  // Error state: error-msg with retry button
  ```

- [ ] **3.8** Update App.tsx to render pages:
  ```tsx
  // Import pages and Topbar
  // Render: <Topbar /> + conditional page render based on uiStore.activePage
  // activePage === 'explorer' -> <CodeExplorer />
  // activePage === 'sprint' -> <Sprint /> (placeholder for now)
  // activePage === 'planning' -> <ProjectManagement /> (placeholder for now)
  ```

- [ ] **3.9** Test Code Explorer manually:
  ```bash
  # Start MCP server with test data
  npm run dashboard -- ./context.db 3333 .
  # Start Vite dev server
  npm run dashboard:dev
  # Open http://localhost:5173
  ```
  **Expected behavior:**
  - File tree loads in sidebar with folders collapsed
  - Search filters file tree on keyup
  - Clicking a file loads detail tab with exports, imports, imported-by
  - Changes tab shows file modification history
  - Graph tab shows force-directed dependency visualization
  - Cmd+K focuses search, Esc dismisses
  - URL hash updates on navigation (`#explorer/detail/42`)
  - Stats in topbar show file/line/size counts
  - Live dot pulses, SSE reconnects on disconnect

- [ ] **3.10** Verify feature parity against AUDIT.md Code Explorer section:
  - [ ] Search bar with debounced filtering
  - [ ] File tree with hierarchical folders
  - [ ] Detail tab: path, language, size, lines, exports, imports, imported-by
  - [ ] Changes tab: time-grouped feed with expandable diffs
  - [ ] Graph tab: canvas force-directed visualization
  - [ ] Cmd+K, arrow keys, Esc keyboard shortcuts
  - [ ] Hash routing: `#explorer/detail/{id}`, `#explorer/graph`, `#explorer/changes`

**Git commit:**
```
feat(dashboard): implement Code Explorer page with file tree, detail, changes, and graph

T-058: Build Code Explorer with atomic design components -- FileTree sidebar,
detail/changes/graph tabs, SearchBar with Cmd+K, DependencyGraph canvas,
keyboard shortcuts, and hash routing. Full feature parity with dashboard.html.
```

---

## Task 4: T-059 --- Sprint Page (3pt)

**Objective:** Build the Sprint page with 3 sub-tabs: Board (sprint list + kanban), Team (agent grid), and Retro Insights (bento grid). Full feature parity with the current dashboard.

### Files to Create

| Action | Path |
|--------|------|
| Create | `src/dashboard/app/src/components/molecules/SprintCard.tsx` |
| Create | `src/dashboard/app/src/components/molecules/TicketCard.tsx` |
| Create | `src/dashboard/app/src/components/molecules/AgentCard.tsx` |
| Create | `src/dashboard/app/src/components/molecules/BentoCard.tsx` |
| Create | `src/dashboard/app/src/components/molecules/SubTabBar.tsx` |
| Create | `src/dashboard/app/src/components/organisms/SprintList.tsx` |
| Create | `src/dashboard/app/src/components/organisms/SprintDetail.tsx` |
| Create | `src/dashboard/app/src/components/organisms/KanbanBoard.tsx` |
| Create | `src/dashboard/app/src/components/organisms/TeamGrid.tsx` |
| Create | `src/dashboard/app/src/components/organisms/BentoGrid.tsx` |
| Create | `src/dashboard/app/src/components/templates/SprintLayout.tsx` |
| Create | `src/dashboard/app/src/pages/Sprint.tsx` |

### Steps

- [ ] **4.1** Create molecule components:

  **SprintCard.tsx**:
  ```typescript
  // Props: sprint (Sprint), isActive (boolean), onClick
  // Renders: card with sprint name, status badge, ticket count text (done/total)
  // Velocity progress bar: filled width = (done_count / ticket_count) * 100%
  // Active state: border-accent, bg-accent-glow
  // Meta row: status pill, "{qa_count} QA'd", "{open_blockers} blockers" if > 0
  ```

  **TicketCard.tsx**:
  ```typescript
  // Props: ticket (Ticket)
  // Renders: card with ticket_ref (mono, text-3), title, assignee, priority badge, story_points
  // Priority badge uses PRIORITY_COLORS from constants
  // QA verified: small green check icon if qa_verified === 1
  ```

  **AgentCard.tsx**:
  ```typescript
  // Props: agent (Agent)
  // Renders: card with role name (header), description, model (mono text-3)
  // Health dot: active=green, idle=orange, blocked=red (based on blocked_tickets > 0, active_tickets > 0)
  // Mood: emoji + score + progress bar (width = mood%, color from getMoodColor)
  // Mood label shown below progress bar
  ```

  **BentoCard.tsx**:
  ```typescript
  // Props: title, subtitle, icon (emoji), variant (recurring|good|bad|best|worst|stats), wide (boolean), children
  // Renders: card with top color bar (3px, color from variant), icon + title header, children content
  // Wide variant: grid-column span 2
  // Color mapping: recurring=purple, good=green, bad=red, best=blue, worst=orange, stats=accent
  ```

  **SubTabBar.tsx**:
  ```typescript
  // Props: tabs ({ id, label }[]), activeId (string), onChange (id) => void
  // Renders: pill-style tab switcher (rounded-full, bg-accent when active)
  // Inactive: bg-surface, border, text-3
  ```

- [ ] **4.2** Create SprintList organism:
  ```typescript
  // Props: sprints (Sprint[]), selectedId (number | null), onSelect (id) => void
  // Renders: scrollable list (300px width) of SprintCard components
  // Header: "Sprints" + count badge
  // Loading: 3 Skeleton cards
  ```

- [ ] **4.3** Create KanbanBoard organism:
  ```typescript
  // Props: tickets (Ticket[])
  // Groups tickets by status using groupByStatus utility
  // Renders 4-column grid: TODO, IN_PROGRESS, DONE, BLOCKED
  // Each column: header (label + count badge) + list of TicketCard
  // Column header border-bottom-2 colored by status
  // Empty column: subtle "No tickets" placeholder
  ```

- [ ] **4.4** Create SprintDetail organism:
  ```typescript
  // Props: sprint (Sprint | null), tickets (Ticket[]), retro (RetroFinding[])
  // Renders: sprint overview stats (velocity bar, ticket counts, blockers) + KanbanBoard
  // Overview section: sprint name, goal, date range, velocity committed vs achieved
  // Retro section: findings grouped by category (went_well, went_wrong, try_next)
  //   Each finding: bullet text with role attribution
  // Loading state: Skeleton when sprint is null
  ```

- [ ] **4.5** Create TeamGrid organism:
  ```typescript
  // Props: agents (Agent[]), loading (boolean)
  // Renders: CSS grid (auto-fill, minmax 280px) of AgentCard components
  // Loading: 6 Skeleton cards
  ```

- [ ] **4.6** Create BentoGrid organism:
  ```typescript
  // Props: sprints (Sprint[]), retroFindings (RetroFinding[])
  // Synthesizes insights from all retro findings across all sprints:
  //   - Recurring Topics (wide): most common findings across sprints
  //   - Stats: total sprints, total findings, avg velocity, completion rate
  //   - Recurring Good: most common went_well findings
  //   - Recurring Bad: most common went_wrong findings
  //   - Best Moment: highest-voted went_well finding
  //   - Worst Moment: highest-impact went_wrong finding
  // Renders 3-column grid with BentoCard components
  // Each card has appropriate variant, icon, and content
  ```

- [ ] **4.7** Create SprintLayout template:
  ```typescript
  // Props: subTab (string), children (ReactNode mapped by sub-tab)
  // Renders: SubTabBar (Board | Team | Retro Insights) + active sub-tab content
  ```

- [ ] **4.8** Create Sprint page:
  ```typescript
  // Smart component -- orchestrates Sprint page
  // Uses useSprints() and useAgents() hooks
  // Reads activeSubTab from uiStore
  // Board sub-tab: SprintList (left) + SprintDetail (right) in flex row
  // Team sub-tab: TeamGrid
  // Insights sub-tab: BentoGrid
  // Fetches retro for all sprints to build insights data
  ```

- [ ] **4.9** Update App.tsx to render Sprint page.

- [ ] **4.10** Test Sprint page manually:
  ```bash
  npm run dashboard -- ./context.db 3333 .
  npm run dashboard:dev
  # Navigate to Sprint tab
  ```
  **Expected behavior:**
  - Sprint list loads with cards showing name, status, velocity bar
  - Clicking a sprint loads kanban board with tickets in 4 columns
  - Retro findings show below kanban grouped by category
  - Team sub-tab shows agent grid with mood indicators
  - Retro Insights sub-tab shows bento grid with synthesized analysis
  - Sub-tab switching works via pill tabs

- [ ] **4.11** Verify feature parity against AUDIT.md Sprint section:
  - [ ] Sprint list cards with status badge, ticket counts, velocity bar
  - [ ] Sprint detail with overview stats + kanban board
  - [ ] Ticket cards: ref, title, assignee, priority badge, points
  - [ ] Retro findings grouped by category
  - [ ] Agent grid with mood, health dot, model
  - [ ] Bento grid with 6 insight cards
  - [ ] Sub-tab switching (Board, Team, Retro Insights)

**Git commit:**
```
feat(dashboard): implement Sprint page with kanban board, team grid, and retro insights

T-059: Build Sprint page with 3 sub-tabs -- Board (SprintList + KanbanBoard),
Team (AgentCard grid with mood/health), Retro Insights (BentoGrid with
synthesized analysis). Full feature parity with existing sprint views.
```

---

## Task 5: T-060 --- Project Management + Interactive Workflows (3pt)

**Objective:** Build the Project Management page with 3 sub-tabs (Milestones, Product Vision, Gantt Chart) and add interactive write workflows: milestone create/edit forms, vision markdown editor with preview, and sprint planning modal flow.

### Files to Create

| Action | Path |
|--------|------|
| Create | `src/dashboard/app/src/components/atoms/Tooltip.tsx` |
| Create | `src/dashboard/app/src/components/organisms/MilestoneList.tsx` |
| Create | `src/dashboard/app/src/components/organisms/VisionEditor.tsx` |
| Create | `src/dashboard/app/src/components/organisms/GanttChart.tsx` |
| Create | `src/dashboard/app/src/components/organisms/SprintPlanner.tsx` |
| Create | `src/dashboard/app/src/components/templates/PlanningLayout.tsx` |
| Create | `src/dashboard/app/src/pages/ProjectManagement.tsx` |

### Steps

- [ ] **5.1** Create Tooltip atom:
  ```typescript
  // Props: content (string), children (ReactNode), position ('top'|'bottom'|'left'|'right')
  // Renders: relative wrapper with absolute-positioned tooltip on hover
  // Tooltip: bg-surface-3, border, rounded-lg, text-xs, shadow-card
  // Show/hide with CSS group-hover or local hover state
  ```

- [ ] **5.2** Create MilestoneList organism (smart component):
  ```typescript
  // Reads milestones from planningStore, loading state
  // Renders: list of milestone cards + "Create Milestone" button
  //
  // Each milestone card:
  //   - Name (h3), description, target date, status badge
  //   - Progress bar: done_count / ticket_count * 100%
  //   - Edit button (pencil icon) -> opens inline edit form
  //
  // Create form (shown when "Create" button clicked):
  //   - Input: name (required)
  //   - Input: description (textarea)
  //   - Input: target_date (date picker)
  //   - Buttons: Save (primary) + Cancel (ghost)
  //   - On save: call planningStore.createMilestone(data)
  //   - On success: close form, milestone appears in list (optimistic from store)
  //   - On error: show error-msg inline
  //
  // Edit form (inline, replaces card content):
  //   - Pre-filled inputs: status (select), description, target_date
  //   - Buttons: Save + Cancel
  //   - On save: call planningStore.updateMilestone(id, data)
  //   - Uses optimistic update from store
  //
  // Loading state: Skeleton cards
  // Empty state: "No milestones yet" with create button
  ```

- [ ] **5.3** Create VisionEditor organism (smart component):
  ```typescript
  // Reads vision from planningStore
  // Two modes: view (default) and edit
  //
  // View mode:
  //   - MarkdownRenderer showing vision content
  //   - "Edit" button (top right) to switch to edit mode
  //
  // Edit mode:
  //   - Split panel: textarea (left) + live preview MarkdownRenderer (right)
  //   - Textarea: font-mono, bg-bg, full-height, auto-resize
  //   - Buttons: Save (primary, calls planningStore.updateVision) + Cancel (ghost, reverts)
  //   - On save: optimistic update, switch back to view mode
  //   - Unsaved changes warning if navigating away
  //
  // Loading state: Skeleton block
  // Error handling: toast/inline error on failed save
  ```

- [ ] **5.4** Create GanttChart organism:
  ```typescript
  // Props: sprints (Sprint[])
  // Renders: horizontal timeline visualization of sprints
  //
  // Layout:
  //   - Y-axis: sprint names (left labels, 300px)
  //   - X-axis: date range (auto-calculated from earliest start to latest end)
  //   - Bars: colored by status (active=accent, completed=green, planned=purple)
  //   - Bar width proportional to sprint duration
  //   - Bar position: offset from timeline start
  //
  // Date calculations:
  //   - Parse started_at/ended_at or created_at for positioning
  //   - Default sprint length: 14 days if no end date
  //   - Timeline range: min(start dates) - 7d to max(end dates) + 7d
  //
  // Hover: tooltip with sprint name, date range, velocity
  // Responsive: vertical layout on mobile (media query)
  // Status color: active=accent, closed/completed=green-400, planning=purple
  ```

- [ ] **5.5** Create SprintPlanner organism (smart component):
  ```typescript
  // Modal flow for planning a new sprint
  // Triggered by "Plan Sprint" button on Sprint page or Gantt sub-tab
  //
  // Step 1 - Name & Goal:
  //   - Input: sprint name (required)
  //   - Textarea: sprint goal (optional)
  //   - Input: velocity target (number, default 19)
  //   - "Next" button
  //
  // Step 2 - Select Backlog Tickets:
  //   - Fetches backlog from planningStore.fetchBacklog()
  //   - Shows scrollable list of backlog tickets with checkboxes
  //   - Each ticket: ref, title, priority badge, story points
  //   - Running total of selected story points shown at bottom
  //   - Warning if total exceeds velocity target
  //   - "Back" and "Confirm" buttons
  //
  // Step 3 - Confirmation:
  //   - Summary: sprint name, goal, selected ticket count, total points
  //   - "Create Sprint" button (primary) + "Back" button
  //   - On create: call planningStore.planSprint(data)
  //   - On success: close modal, refresh sprint list
  //   - On error: inline error message
  //
  // Modal overlay: fixed inset-0, bg-black/60, centered card
  // Card: bg-surface, border, rounded-card-lg, max-w-lg, max-h-[80vh], overflow-y-auto
  // Step indicator: 3 dots at top (filled = current/completed, outline = upcoming)
  ```

- [ ] **5.6** Create PlanningLayout template:
  ```typescript
  // Props: subTab (string), children (ReactNode mapped by sub-tab)
  // Renders: SubTabBar (Milestones | Product Vision | Gantt Chart) + active sub-tab content
  // Same pattern as SprintLayout
  ```

- [ ] **5.7** Create ProjectManagement page:
  ```typescript
  // Smart component -- orchestrates Project Management page
  // Uses usePlanning() hook on mount
  // Reads activeSubTab from uiStore
  //
  // Milestones sub-tab: MilestoneList
  // Vision sub-tab: VisionEditor
  // Gantt sub-tab: GanttChart + "Plan Sprint" button (opens SprintPlanner modal)
  //
  // SprintPlanner modal: rendered conditionally based on local isPlanning state
  ```

- [ ] **5.8** Update App.tsx to render ProjectManagement page and remove placeholders.

- [ ] **5.9** Test interactive workflows:
  ```bash
  npm run dashboard -- ./context.db 3333 .
  npm run dashboard:dev
  ```

  **Test: Create Milestone**
  ```
  1. Navigate to Project Management > Milestones
  2. Click "Create Milestone"
  3. Fill in: name="v3.0 Release", description="React dashboard", target_date="2026-04-15"
  4. Click Save
  Expected: Milestone appears in list, POST /api/milestones returns 200
  ```

  **Test: Edit Milestone**
  ```
  1. Click edit (pencil) on a milestone
  2. Change status to "in_progress"
  3. Click Save
  Expected: Status badge updates immediately (optimistic), PUT /api/milestone/{id} returns 200
  ```

  **Test: Edit Product Vision**
  ```
  1. Navigate to Project Management > Product Vision
  2. Click "Edit"
  3. Modify markdown content
  4. See live preview update on right panel
  5. Click Save
  Expected: Vision updates, PUT /api/vision returns 200
  ```

  **Test: Plan Sprint**
  ```
  1. Navigate to Project Management > Gantt Chart
  2. Click "Plan Sprint"
  3. Step 1: Enter name="Sprint 10", goal="Performance sprint", velocity=19
  4. Step 2: Select 3 backlog tickets, verify points total shown
  5. Step 3: Review summary, click "Create Sprint"
  Expected: Sprint created, POST /api/sprints/plan returns 200, Gantt chart refreshes
  ```

- [ ] **5.10** Verify feature parity + new workflows against AUDIT.md:
  - [ ] Milestones: read-only display (parity) + create/edit forms (new)
  - [ ] Product Vision: markdown display (parity) + editor with preview (new)
  - [ ] Gantt Chart: timeline bar visualization (parity)
  - [ ] Sprint Planner: 3-step modal flow (new)
  - [ ] All write operations use Sprint 8 API endpoints
  - [ ] Optimistic updates with error rollback
  - [ ] Sub-tab switching (Milestones, Vision, Gantt)

- [ ] **5.11** Final integration test -- full production build:
  ```bash
  npm run dashboard:build
  npm run dashboard -- ./context.db 3333 .
  # Open http://localhost:3333
  ```
  **Expected:** Full React app served from dist/dashboard/, all 3 pages functional, all API calls working, SSE connected, hash routing working.

**Git commit:**
```
feat(dashboard): implement Project Management page with interactive workflows

T-060: Build Project Management with 3 sub-tabs -- MilestoneList (create/edit
forms), VisionEditor (markdown editor + live preview), GanttChart (timeline
bars). Add SprintPlanner modal with 3-step flow for sprint creation. All
writes use Sprint 8 API endpoints with optimistic updates.
```

---

## Summary

| Task | Ticket | Points | Files | Key Deliverable |
|------|--------|--------|-------|-----------------|
| 1 | T-056 | 5 | 15 | Vite+React+TS scaffold, Tailwind, dev proxy, build pipeline |
| 2 | T-057 | 5 | 19 | 5 Zustand stores, API client with dedup, 8 hooks, types |
| 3 | T-058 | 3 | 18 | Code Explorer page: file tree, detail, changes, graph |
| 4 | T-059 | 3 | 12 | Sprint page: kanban board, team grid, retro insights |
| 5 | T-060 | 3 | 7 | Project Management: milestones, vision editor, Gantt, sprint planner |
| **Total** | | **19** | **71** | |

### Dependency Order

```
T-056 (scaffold) --> T-057 (stores/hooks) --> T-058 (explorer) --\
                                          --> T-059 (sprint)  ----> integration test
                                          --> T-060 (planning) --/
```

Tasks T-058, T-059, and T-060 can be parallelized after T-057 completes since they build independent pages that share the same store/hook infrastructure. The final integration test in T-060 step 5.11 validates all pages together.
