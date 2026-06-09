# State Boundaries

Reference for `set-up-state-management`. The rules that keep server state and UI state from bleeding into each other. This is the most important file in the skill — the libraries are easy; the boundary is what teams get wrong.

## The decision

| Question | Goes to |
|---|---|
| Fetched over the network / owned by a server? | TanStack Query |
| Derived from server data? | Derive in render or via `select` — store nothing |
| Pure client UI (toggles, selections, filters, theme, wizard step)? | Zustand / Pinia |

## Rule: server data never lives in a store
**Why:** TanStack Query already caches, deduplicates, refetches, and invalidates server data. Copy that data into Zustand/Pinia and you re-own all of it by hand — the exact problem the query cache exists to remove. The two systems then fight over which copy is current.
**How to apply:** Components read server data only through a query hook (`useTodos()`), never from a store. Stores hold UI state only.

**Anti-example:**
```ts
// bad: mirroring a query result into a store
// (imagine a `useTodosStore` you built to "cache" the list — don't)
const { data } = useTodos(filters);
useEffect(() => {
  useTodosStore.getState().setTodos(data ?? []); // now two sources of truth
}, [data]);
```

## Rule: derive from server data, never duplicate it
**Why:** Derived values (counts, filtered subsets, sums) recompute for free from the cached source. Storing them creates a second value that drifts.
**How to apply:** Compute in render, or pass `select` to the `useQuery` inside the hook to keep the derivation memoized in the cache.

```ts
// good: derive in render from the cached source — no second copy
const { data: todos = [] } = useTodos(filters);
const doneCount = todos.filter((t) => t.done).length;
```

**Anti-example:**
```ts
// bad: a stored count that must be kept in sync forever
useUiStore.setState({ doneCount: todos.filter((t) => t.done).length });
```

## Rule: UI state may feed a query key; the result stays in the cache
**Why:** This is how the two layers cooperate without crossing. The active filter is UI state (a store); the data for that filter is server state (the cache). The filter flows *into* the key; the data never flows *back* into the store.
**How to apply:**
```ts
// React
const status = useTodoFiltersStore((s) => s.status); // UI state
const todos = useTodos({ status });                  // keyed by it; result cached
```
```ts
// Vue
const { status } = storeToRefs(useTodoFiltersStore());              // UI state
const todos = useTodos(computed(() => ({ status: status.value }))); // keyed by it; result cached
```

**Anti-example:**
```ts
// bad: copying the keyed result back into the store
const { data } = useTodos({ status });
useEffect(() => {
  useTodoFiltersStore.setState({ todos: data ?? [] }); // store now holds server data
}, [data]);
```

## When to deviate

- **Form state:** in-progress form fields are UI state, but a form library (React Hook Form, VeeValidate) usually serves better than a store. Use a store only for cross-component form state, such as a multi-step wizard.
- **Static server data** fetched once at boot (feature flags, config) can stay in the query cache with `staleTime: Infinity` rather than a store — still no copying.
