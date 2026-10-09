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

## Rule: key + fetch function travel together as `queryOptions`
**Why:** The hook, the route loader, `prefetchQuery`, `ensureQueryData` and `setQueryData` must all hit the same cache address with the same fetcher. A `queryOptions()` object carries both, and its `queryKey` is typed with the data it holds, so `getQueryData(opts.queryKey)` returns `Todo[]`, not `unknown`.
**How to apply:** Export `todosQueryOptions(filters)` next to the hook (one-domain app) or from `features/<d>/api/<d>.queries.ts`. React hooks call `useQuery(todosQueryOptions(filters))`. Vue composables keep the key reactive (`computed` + `toValue`) and reuse the same key factory and fetch function; the plain `todosQueryOptions` serves guards and prefetch.

## Rule: invalidate exactly what the event changed — the invalidation table
**Why:** TanStack matches keys by prefix, so the factory's hierarchy (`all → lists() → list(f)`, `all → details() → detail(id)`) makes every invalidation a one-liner. Too broad refetches every detail on screen; too narrow leaves stale lists.
**How to apply:**

| Event | Cache action |
|---|---|
| Create | `invalidateQueries({ queryKey: keys.lists() })` |
| Update | `setQueryData(keys.detail(id), serverResult)`, then invalidate `keys.lists()` |
| Delete | `removeQueries({ queryKey: keys.detail(id) })`, then invalidate `keys.lists()` |
| Bulk / unknown impact | invalidate `keys.all` |
| Realtime push | patch `detail(id)`, invalidate `lists()` (`set-up-realtime`) |
| Logout, tenant switch | `queryClient.clear()` |

Invalidate in `onSettled` (success **and** error resync). Return the promise (`onSettled: () => queryClient.invalidateQueries(...)`) when the caller must wait for fresh data, e.g. before navigating away.

```ts
onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() }),
```

## Rule: optimistic updates — UI first, cache when several screens care
**Why:** Most optimism is one list on one screen; rendering the pending input is enough and has nothing to roll back. Writing into the cache is right only when other mounted queries must show the change too — and then it needs cancel, snapshot and rollback, or a late response overwrites it.
**How to apply — via the UI (default):**
```tsx
// React — the pending row comes from the mutation, not the cache
const create = useCreateTodo();
{create.isPending && <li className="opacity-50">{create.variables.text}</li>}
```
```vue
<!-- Vue -->
<li v-if="create.isPending.value" class="opacity-50">{{ create.variables.value?.text }}</li>
```
**How to apply — via the cache (shared data):**
```ts
useMutation({
  mutationFn: updateTodo,
  onMutate: async (next: Todo) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.todos.detail(next.id) });
    const previous = queryClient.getQueryData<Todo>(queryKeys.todos.detail(next.id));
    queryClient.setQueryData(queryKeys.todos.detail(next.id), next);
    return { previous };
  },
  onError: (_err, next, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(queryKeys.todos.detail(next.id), ctx.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos.all }), // detail + lists
});
```
React 19's `useOptimistic` is for form actions / Server Actions; on TanStack data use one of the two patterns above, never both (`../_shared/framework-idioms.md`).

## Rule: set sensible client defaults; tune the freshness-vs-requests dial
**Why:** `staleTime` controls how long data stays fresh (no refetch); `gcTime` controls how long unused cache is retained. Higher `staleTime` means fewer requests and staler data. The library default `staleTime: 0` refetches aggressively.
**How to apply:** Start at `staleTime: 60_000`, `gcTime: 5 * 60_000`, `retry: 2`. Raise `staleTime` for rarely-changing data. Set `refetchOnWindowFocus: false` to favour fewer requests over focus-freshness.

## The Suspense upgrade (documented; not the scaffolded default)

The example hooks use classic `useQuery` with `isPending`/`isError`, which works everywhere. To integrate with `set-up-error-boundaries`, swap to `useSuspenseQuery`: the component suspends while loading and throws errors to the nearest `ErrorBoundary`.

```tsx
// upgrade: no isPending/isError branches; needs <Suspense> + <ErrorBoundary> above
const { data } = useSuspenseQuery(todosQueryOptions(filters)); // same options object as useQuery
```

**Caveat — pagination/filter flash:** changing the key while a Suspense query is mounted re-triggers the fallback. Wrap the update in `startTransition` to keep the old data visible during the fetch.

React 19's `use()` hook covers conditional/loop/RSC-promise cases only; for standard client fetching, `useSuspenseQuery` is idiomatic.

## Vue specifics: reactive query keys
**Why:** Vue queries re-run when reactive inputs change. A plain key won't track a `ref`; wrap it in `computed`. Accepting `MaybeRefOrGetter` lets callers pass a value, a ref, a store ref or a getter (`() => props.id` — the 3.5 props-destructure idiom).
**How to apply:**
```ts
export function useTodos(filters: MaybeRefOrGetter<TodoFilters>) {
  return useQuery({
    queryKey: computed(() => queryKeys.todos.list(toValue(filters))),
    queryFn: () => fetchTodos(toValue(filters)),
  });
}
```

## When to deviate

- **One screen, one or two queries:** inline `queryOptions` in the hook and skip `queryKeys.ts`; add the factory when a mutation has to invalidate a key it does not own.
- **Persisted cache** (offline, instant reloads): add `persistQueryClient` and set `gcTime` ≥ the persister's `maxAge`.
- **Pinia Colada** is a Vue-native alternative to the Query Vue adapter. Valid in a Vue-only app, but this plugin standardises on TanStack Query both sides for one mental model and one key factory shared with React code.
- **Nuxt `useFetch` / `useAsyncData`:** fine for page-local SSR data no other component reads; anything shared, mutated or invalidated goes through TanStack Query. **Next.js:** Server Components prefetch into a `QueryClient` and pass `dehydrate(queryClient)` to `<HydrationBoundary>`; client components read through the same hooks.
