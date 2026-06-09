---
name: set-up-state-management
description: Use when adding state management to a frontend project — wires server-state (TanStack Query) and UI-state (Zustand for React / Pinia for Vue) with a hard boundary between them, a typed query-key factory, a fetch seam, and example query/mutation hooks plus a small UI store.
---

# Set Up State Management

## 1. Audit current state

Detect what already exists before changing anything.

Dependencies (read `package.json`):
```bash
grep -E '"@tanstack/(react|vue)-query"|"zustand"|"pinia"' package.json 2>/dev/null
```

Provider wiring:
```bash
grep -rE "QueryClientProvider|VueQueryPlugin|createPinia" src/ 2>/dev/null
```

Existing seams and stores:
```bash
ls src/libs/queryClient.ts src/libs/fetcher.ts src/libs/queryKeys.ts 2>/dev/null
ls src/stores/ 2>/dev/null
```

**Check prerequisites.** This skill writes into `src/libs/`, `src/hooks/` (React) or `src/composables/` (Vue), and `src/stores/`, and imports through the `@/` alias.

- `@/*` path alias configured? Check: `grep '"@/\*"' tsconfig.json tsconfig.app.json 2>/dev/null`. If absent, run `configure-typescript` first.
- `src/libs/` and `src/hooks/` (or `src/composables/`) exist? If not, run `set-up-frontend-structure` first, or create them flat and note the deviation in the project README.

## 2. Decide what to do

- No deps, no wiring → full setup (steps 3–8).
- Library installed but seams/examples missing → add only the missing pieces.
- Everything present → confirm `staleTime`/devtools defaults and that `state-boundaries.md` is followed; exit "State management already in place."

## 3. Detect framework

Read `package.json`. React or Vue? Branch every step below. React uses TanStack Query's React adapter + Zustand; Vue uses the Vue adapter + Pinia.

## 4. Install dependencies (only what is missing)

Versioning per `../_shared/stack-versions.md` (caret for runtime deps).

### React
```bash
pnpm add @tanstack/react-query zustand
pnpm add -D @tanstack/react-query-devtools
```

### Vue
```bash
pnpm add @tanstack/vue-query pinia
pnpm add -D @tanstack/vue-query-devtools
```

## 5. Generate the seams

### `src/libs/fetcher.ts` (both frameworks)

A typed `fetch` wrapper that throws on non-2xx so TanStack Query treats failures as errors. Single seam for base URL and auth headers later.

```ts
// src/libs/fetcher.ts
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
```

### `src/libs/queryKeys.ts` (both frameworks)

The hand-rolled, typed query-key factory. Also the home of the example domain types, so the store, the hooks, and the cache key all import from one place.

```ts
// src/libs/queryKeys.ts
export type TodoStatus = 'all' | 'active' | 'done';
export type TodoFilters = { status: TodoStatus };
export type Todo = { id: string; text: string; done: boolean };

export const queryKeys = {
  todos: {
    all: ['todos'] as const,
    list: (filters: TodoFilters) => [...queryKeys.todos.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.todos.all, 'detail', id] as const,
  },
} as const;
```

### `src/libs/queryClient.ts` (React only)

```ts
// src/libs/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

// Freshness-vs-requests dial — tune per project.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // fresh for 1 min; no refetch within window
      gcTime: 5 * 60_000, // unused cache retained 5 min
      retry: 2,
    },
  },
});
```

Vue configures the client through `VueQueryPlugin` options in step 7 — no separate file.

## 6. Generate the example hooks and store

The example is a pair that cooperates across the boundary without crossing it: the filter is UI state (the store); the filtered list is server state (the cache).

### React

```ts
// src/hooks/useTodos.ts
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/libs/fetcher';
import { queryKeys, type Todo, type TodoFilters } from '@/libs/queryKeys';

export function useTodos(filters: TodoFilters) {
  return useQuery({
    queryKey: queryKeys.todos.list(filters),
    queryFn: () => fetcher<Todo[]>(`/todos?status=${filters.status}`),
  });
}
```

```ts
// src/hooks/useCreateTodo.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/libs/fetcher';
import { queryKeys, type Todo } from '@/libs/queryKeys';

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string }) =>
      fetcher<Todo>('/todos', { method: 'POST', body: JSON.stringify(input) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos.all }),
  });
}
```

```ts
// src/stores/useTodoFiltersStore.ts — UI state only (which filter is active)
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TodoStatus } from '@/libs/queryKeys';

type TodoFiltersState = {
  status: TodoStatus;
  setStatus: (status: TodoStatus) => void;
  reset: () => void;
};

export const useTodoFiltersStore = create<TodoFiltersState>()(
  devtools(
    (set) => ({
      status: 'all',
      setStatus: (status) => set({ status }, false, 'setStatus'),
      reset: () => set({ status: 'all' }, false, 'reset'),
    }),
    { name: 'todo-filters' },
  ),
);
```

Consume with inline selectors: `const status = useTodoFiltersStore((s) => s.status);`. See `./ui-state.md` for `useShallow` and the React Compiler note.

### Vue

```ts
// src/composables/useTodos.ts — Vue keys must be reactive (computed)
import { useQuery } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { fetcher } from '@/libs/fetcher';
import { queryKeys, type Todo, type TodoFilters } from '@/libs/queryKeys';

export function useTodos(filters: Ref<TodoFilters>) {
  return useQuery({
    queryKey: computed(() => queryKeys.todos.list(filters.value)),
    queryFn: () => fetcher<Todo[]>(`/todos?status=${filters.value.status}`),
  });
}
```

```ts
// src/composables/useCreateTodo.ts
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { fetcher } from '@/libs/fetcher';
import { queryKeys, type Todo } from '@/libs/queryKeys';

export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string }) =>
      fetcher<Todo>('/todos', { method: 'POST', body: JSON.stringify(input) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos.all }),
  });
}
```

```ts
// src/stores/useTodoFiltersStore.ts — Pinia setup-store
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { TodoStatus } from '@/libs/queryKeys';

export const useTodoFiltersStore = defineStore('todoFilters', () => {
  const status = ref<TodoStatus>('all');
  function setStatus(next: TodoStatus) {
    status.value = next;
  }
  function reset() {
    status.value = 'all';
  }
  return { status, setStatus, reset };
});
```

Consume with `storeToRefs` — see `./ui-state.md`.

## 7. Wire providers

### React (`src/main.tsx`)

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { queryClient } from '@/libs/queryClient';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  </StrictMode>,
);
```

If `set-up-error-boundaries` is in place, keep the `ErrorBoundary` outermost (above `QueryClientProvider`) so provider-setup errors are still caught.

### Vue (`src/main.ts`)

```ts
import { createApp } from 'vue';
import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

const vueQueryOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: { queries: { staleTime: 60_000, gcTime: 5 * 60_000, retry: 2 } },
  },
};

createApp(App).use(createPinia()).use(VueQueryPlugin, vueQueryOptions).mount('#app');
```

## 8. Verify

```bash
pnpm tsc --noEmit
```

Expected: 0 errors (seams, hooks, and store compile).

Run `pnpm dev` and confirm the TanStack Query devtools render in dev — `ReactQueryDevtools` (React), or mount `VueQueryDevtools` from `@tanstack/vue-query-devtools` (Vue).

Playwright e2e is deferred to skill `configure-test-stack`, matching the `set-up-error-boundaries` precedent. Until then, the type-check is the gate.

## References
- ./state-boundaries.md — which state goes where; the decision table; anti-patterns. The most important file.
- ./server-state.md — TanStack Query patterns (React + Vue): hooks-only rule, query-key factory, invalidation, client defaults, the Suspense upgrade.
- ./ui-state.md — Zustand + Pinia patterns: small stores, inline selectors (React Compiler note), slices, persistence.
- ../_shared/conventions.md — `@/` alias, file naming, and the `stores/` rule.
- ../_shared/stack-versions.md — runtime-dep versioning.
- ../_shared/glossary.md — "Server state" vs "Client / UI state".
