---
name: set-up-state-management
description: Use when adding state management to a frontend project - TanStack Query for server state, Zustand (React) or Pinia (Vue) for UI state, a hard boundary between them, a typed query-key factory and a fetch seam.
---

# Set Up State Management

## 1. Audit current state

Detect what already exists before changing anything. Read `.claude/stack-profile.md` if present: `frontend.framework` decides the branch in step 3 (`frontend.meta` of `nuxt` or `next`: keep the boundary, read `../_shared/framework-idioms.md` "Meta-frameworks" for prefetch and hydration, and skip `queryClient.ts`/provider wiring the framework docs replace); `package_manager` replaces `pnpm`.

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
pnpm add @tanstack/vue-query pinia @vue/devtools-api
pnpm add -D @tanstack/vue-query-devtools
```
Pinia 4 lists `@vue/devtools-api` (v8) as a required peer — install it explicitly.

## 5. Generate the seams

### `src/libs/fetcher.ts` (both frameworks)

A typed `fetch` wrapper that throws a typed `HttpError` on non-2xx so TanStack Query treats failures as errors. Single seam for base URL and auth headers later.

Write the **base version** from [`../_shared/fetcher.md`](../_shared/fetcher.md) — the one canonical definition, shared with `set-up-auth` and `validate-env`. If `src/libs/fetcher.ts` already exists, run that file's audit greps first: a fetcher that spreads `...init` after its headers drops caller headers and must be upgraded.

### `src/libs/queryKeys.ts` (both frameworks)

The hand-rolled, typed query-key factory — the one registry of cache addresses. Also the home of the example domain types, so the store, the hooks, and the cache key all import from one place. In a multi-domain app each feature owns `features/<d>/api/<d>.keys.ts` and this file composes them (`export const queryKeys = { todos: todoKeys }`), so prefix invalidation still works app-wide.

```ts
// src/libs/queryKeys.ts
export type TodoStatus = 'all' | 'active' | 'done';
export type TodoFilters = { status: TodoStatus };
export type Todo = { id: string; text: string; done: boolean };

export const queryKeys = {
  todos: {
    all: ['todos'] as const,
    lists: () => [...queryKeys.todos.all, 'list'] as const,
    list: (filters: TodoFilters) => [...queryKeys.todos.lists(), filters] as const,
    details: () => [...queryKeys.todos.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.todos.details(), id] as const,
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
import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetcher } from '@/libs/fetcher';
import { queryKeys, type Todo, type TodoFilters } from '@/libs/queryKeys';

// One object for the hook, the route loader, prefetch and setQueryData.
export const todosQueryOptions = (filters: TodoFilters) =>
  queryOptions({
    queryKey: queryKeys.todos.list(filters),
    queryFn: () => fetcher<Todo[]>(`/todos?status=${filters.status}`),
  });

export function useTodos(filters: TodoFilters) {
  return useQuery(todosQueryOptions(filters));
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() }),
  });
}
```

A create adds to lists and touches no detail, so it invalidates `lists()`. The full rule set (update, delete, logout, realtime) and optimistic updates: `./server-state.md`.

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
import { queryOptions, useQuery } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { fetcher } from '@/libs/fetcher';
import { queryKeys, type Todo, type TodoFilters } from '@/libs/queryKeys';

const fetchTodos = (filters: TodoFilters) =>
  fetcher<Todo[]>(`/todos?status=${filters.status}`);

// Plain-value options for router guards, prefetch and setQueryData.
export const todosQueryOptions = (filters: TodoFilters) =>
  queryOptions({ queryKey: queryKeys.todos.list(filters), queryFn: () => fetchTodos(filters) });

// The composable accepts a value, a ref or a getter and keeps the key reactive.
export function useTodos(filters: MaybeRefOrGetter<TodoFilters>) {
  return useQuery({
    queryKey: computed(() => queryKeys.todos.list(toValue(filters))),
    queryFn: () => fetchTodos(toValue(filters)),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() }),
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
pnpm typecheck
```

Expected: exit 0 (seams, hooks, and store compile). Snippets here were compiled against `@tanstack/react-query` and `@tanstack/vue-query` 5.104, Zustand 5.0 and Pinia 4.0 under the `configure-typescript` flags.

Run `pnpm dev` and confirm the TanStack Query devtools render in dev: `ReactQueryDevtools` (wired in step 7), or for Vue add `<VueQueryDevtools />` (from `@tanstack/vue-query-devtools`) to `App.vue`.

Component and e2e tests come with `configure-test-stack`; until then `pnpm typecheck` is the gate.

## References
- ./state-boundaries.md — which state goes where; the decision table; anti-patterns. The most important file.
- ./server-state.md — TanStack Query patterns (React + Vue): hooks-only rule, query-key factory, `queryOptions`, the invalidation table, optimistic updates, client defaults, the Suspense upgrade.
- ./ui-state.md — Zustand + Pinia patterns: small stores, inline selectors (React Compiler note), slices, persistence.
- ../_shared/conventions.md — `@/` alias, file naming, and the `stores/` rule.
- ../_shared/stack-versions.md — runtime-dep versioning.
- ../_shared/glossary.md — "Server state" vs "Client / UI state".
