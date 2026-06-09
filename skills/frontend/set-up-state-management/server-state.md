# Server State — TanStack Query

Reference for `set-up-state-management`. Patterns for the server-state half, React and Vue. The React adapter is `@tanstack/react-query`; the Vue adapter is `@tanstack/vue-query`. The query cache is the single source of truth for anything owned by a server.

## Rule: every TanStack call lives inside a hook (React) or composable (Vue)
**Why:** Keeps `useQuery`/`useMutation` out of components, templates, and pages, so call sites read as plain data access and each query's config has one home. Extends the atomic-design rule "templates should not fetch".
**How to apply:** `useTodos()` wraps `useQuery`; components call `useTodos()`.

**Anti-example:**
```tsx
// bad: useQuery inline in a component
function TodoList() {
  const { data } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos }); // move to a hook
}
```

## Rule: query keys come from the factory, never inline arrays
**Why:** A typed factory makes every key consistent and every invalidation precise. Inline arrays drift (`['todos']` here, `['todo']` there) and silently miss cache entries on invalidation.
**How to apply:** Import `queryKeys` from `@/libs/queryKeys`. Build hierarchical keys: `queryKeys.todos.all` → `queryKeys.todos.list(filters)`.

**Anti-example:**
```ts
// bad: inline key that won't match the factory's invalidations
useQuery({ queryKey: ['todos', status], queryFn });
```

## Rule: mutations invalidate via the broadest matching factory key
**Why:** `invalidateQueries({ queryKey: queryKeys.todos.all })` refetches every todo query — all filters and details — in one call, because TanStack matches keys by prefix. A narrow key leaves stale sibling caches.
**How to apply:**
```ts
onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos.all }),
```

## Rule: set sensible client defaults; tune the freshness-vs-requests dial
**Why:** `staleTime` controls how long data stays fresh (no refetch); `gcTime` controls how long unused cache is retained. Higher `staleTime` means fewer requests and staler data. The library default `staleTime: 0` refetches aggressively.
**How to apply:** Start at `staleTime: 60_000`, `gcTime: 5 * 60_000`, `retry: 2`. Raise `staleTime` for rarely-changing data. Set `refetchOnWindowFocus: false` to favour fewer requests over focus-freshness.

## The Suspense upgrade (documented; not the scaffolded default)

The example hooks use classic `useQuery` with `isPending`/`isError`, which works everywhere. To integrate with `set-up-error-boundaries`, swap to `useSuspenseQuery`: the component suspends while loading and throws errors to the nearest `ErrorBoundary`.

```tsx
// upgrade: no isPending/isError branches; needs <Suspense> + <ErrorBoundary> above
const { data } = useSuspenseQuery({
  queryKey: queryKeys.todos.list(filters),
  queryFn: () => fetcher<Todo[]>(`/todos?status=${filters.status}`),
});
```

**Caveat — pagination/filter flash:** changing the key while a Suspense query is mounted re-triggers the fallback. Wrap the update in `startTransition` to keep the old data visible during the fetch.

React 19's `use()` hook covers conditional/loop/RSC-promise cases only; for standard client fetching, `useSuspenseQuery` is idiomatic.

## Vue specifics: reactive query keys
**Why:** Vue queries re-run when reactive inputs change. A plain key won't track a `ref`; wrap it in `computed`.
**How to apply:**
```ts
useQuery({
  queryKey: computed(() => queryKeys.todos.list(filters.value)),
  queryFn: () => fetcher<Todo[]>(`/todos?status=${filters.value.status}`),
});
```

## When to deviate

- **Persisted cache** (offline, instant reloads): add `persistQueryClient` and set `gcTime` ≥ the persister's `maxAge`.
- **Pinia Colada** is a Vue-native alternative to the Query Vue adapter. Valid, but this plugin standardises on TanStack Query both sides for one mental model.
