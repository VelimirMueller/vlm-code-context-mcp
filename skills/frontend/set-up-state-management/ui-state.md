# UI State — Zustand (React) / Pinia (Vue)

Reference for `set-up-state-management`. Patterns for the UI-state half. UI state is client-only: toggles, selections, filters, theme, wizard steps. It never holds server data (see `state-boundaries.md`).

## Rule: one small store per domain; no mega-store
**Why:** Small stores are easier to read, test, and tree-shake, and they limit the blast radius of a change. A single global store becomes a dumping ground and a re-render hotspot.
**How to apply:** `useTodoFiltersStore`, `useThemeStore`, `useSidebarStore` — each owns one concern, each in its own file under `src/stores/`, named `use<Domain>Store`.

## Rule (React): select with inline functions; never codegen selectors
**Why:** Inline selectors (`useStore((s) => s.x)`) subscribe the component to just that slice, so it re-renders only when `x` changes. The auto-generated `useStore.use.x()` helper **breaks under React Compiler** and is not recommended.
**How to apply:**
```ts
import { useShallow } from 'zustand/react/shallow';

const status = useTodoFiltersStore((s) => s.status);          // one value
const { status, setStatus } = useTodoFiltersStore(            // many values
  useShallow((s) => ({ status: s.status, setStatus: s.setStatus })),
);
```

**Anti-example:**
```ts
// bad: subscribes to the whole store; re-renders on every change
const store = useTodoFiltersStore();
// bad: codegen selector — breaks with React Compiler
const status = useTodoFiltersStore.use.status();
```

> **React Compiler note:** the compiler auto-memoizes rendering, so drop manual `useMemo`/`useCallback`. It does *not* replace selectors — those control store *subscription*, a different axis — so inline selectors stay required.

## Rule (Vue): setup-store style + storeToRefs
**Why:** Setup stores (`defineStore('x', () => { ... })`) read like the Composition API and map 1:1 onto Zustand's functional store. `storeToRefs` keeps destructured state reactive; actions can be destructured directly.
**How to apply:**
```ts
const store = useTodoFiltersStore();
const { status } = storeToRefs(store); // reactive state
const { setStatus, reset } = store;    // actions: plain destructure
```

## Growing a store: the slices pattern (React)
When one store legitimately needs several cohesive parts, compose typed slices rather than splitting into coupled stores.
```ts
import { create, type StateCreator } from 'zustand';
import type { TodoStatus } from '@/libs/queryKeys';

type FiltersSlice = { status: TodoStatus; setStatus: (s: TodoStatus) => void };
type SortSlice = { sort: 'newest' | 'oldest'; setSort: (s: SortSlice['sort']) => void };

const createFiltersSlice: StateCreator<FiltersSlice & SortSlice, [], [], FiltersSlice> = (set) => ({
  status: 'all',
  setStatus: (status) => set({ status }),
});
const createSortSlice: StateCreator<FiltersSlice & SortSlice, [], [], SortSlice> = (set) => ({
  sort: 'newest',
  setSort: (sort) => set({ sort }),
});

export const useTodoViewStore = create<FiltersSlice & SortSlice>()((...a) => ({
  ...createFiltersSlice(...a),
  ...createSortSlice(...a),
}));
```

## Durability: persist (documented; not the default)
- **React:** wrap with `persist`, keeping `devtools` outermost — `devtools(persist(fn, { name }))`. Use `partialize` to persist only chosen keys.
- **Vue:** add `pinia-plugin-persistedstate`.

Persist UI preferences (theme, collapsed panels), never server data.

## When to deviate

- **A single boolean** shared by a parent and one child rarely needs a store — lift state or use context. Reach for a store when the value is read across unrelated parts of the tree.
- **Server-derived UI state** (for example "is this row selected", keyed by server id): the selection set is UI state (store); the rows are server state (cache). Keep them separate per `state-boundaries.md`.
