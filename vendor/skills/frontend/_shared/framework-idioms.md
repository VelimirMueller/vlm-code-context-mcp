# Framework Idioms — Vue 3.5 and React 19

The current idioms, side by side. Skills write code in this shape; audits flag the old shape. Versions: `stack-versions.md`.

## Rule: thin components on both sides
**Why:** The same lego-block split in both frameworks — the component renders and wires events, a hook/composable owns view logic, `api/` owns server state, a store owns UI state — means a developer reads a Vue and a React repo the same way.
**How to apply:** See `create-module` for the classification table; the idioms below are the *how* inside each block.

## Vue 3.5

### Rule: `useTemplateRef`, not a same-named `ref(null)`
**Why:** `useTemplateRef('input')` binds by string key, is typed, and works when the ref is set from a composable. The old pattern silently breaks when the variable is renamed.
```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue';
const input = useTemplateRef<HTMLInputElement>('input');
</script>
<template><input ref="input" /></template>
```
**Anti-example:** `const input = ref<HTMLInputElement | null>(null)` + `ref="input"`.

### Rule: `defineModel` for `v-model`
**Why:** One line replaces a `modelValue` prop, an `update:modelValue` emit and a computed getter/setter.
```ts
const open = defineModel<boolean>('open', { default: false });
```

### Rule: reactive props destructure with plain defaults
**Why:** 3.5 keeps destructured props reactive; JS defaults replace `withDefaults`.
**How to apply:** `const { size = 'md', items } = defineProps<{ size?: Size; items: Item[] }>()`. Pass a getter, not the value, into a composable or `watch`: `useFilter(() => items)`. Biome's `noVueSetupPropsReactivityLoss` catches the mistake.

### Rule: `useId()` for label/input and ARIA links
**Why:** Stable across SSR and client, unique per app instance — no hand-made counters.
```vue
<script setup lang="ts">
import { useId } from 'vue';
const id = useId();
</script>
<template><label :for="id">Name</label><input :id="id" /></template>
```

### Rule: composables take refs or getters, return refs and functions
**Why:** `toValue()` accepts a value, a ref or a getter, so callers pass whatever they hold. Returning a plain object of refs keeps destructuring reactive.
**How to apply:** `export function useTodos(filters: MaybeRefOrGetter<TodoFilters>)` → `computed(() => queryKeys.todos.list(toValue(filters)))`. Cancel stale async work with `onWatcherCleanup()` inside `watch`.

### Rule: `<script setup>` only — get Vapor-ready for free
**Why:** Vapor Mode (Vue 3.6, still a release candidate) compiles `<script setup>` SFCs without the virtual DOM; the Options API and `getCurrentInstance()` block it.
**How to apply:** No Options API (Biome `noVueOptionsApi`). Don't opt into `<script setup vapor>` in production until 3.6 is stable; then try it per component on measured hot paths.

## React 19

### Rule: the React Compiler memoizes; you don't
**Why:** Compiler 1.0 is stable and memoizes more precisely than hand-written `useMemo`/`useCallback`/`memo`, including after early returns.
**How to apply:** New code: no manual memo unless it is a deliberate escape hatch (a value used as an effect dependency). Existing code: leave manual memo in place — removing it changes the compiled output. Store selectors stay (`set-up-state-management/ui-state.md`). Setup: `optimize-performance`.

### Rule: actions for simple forms, a form library for complex ones
**Why:** `<form action={fn}>` + `useActionState` + `useFormStatus` give pending state, errors and progressive enhancement without a library. They don't give field-level validation, dirty tracking or arrays of fields.
**How to apply:** One or two fields, or a Next.js Server Action → React actions. Real forms → React Hook Form + Zod (`set-up-forms`). Either way the submit calls a TanStack mutation or a Server Action, never `fetch` inline.

### Rule: `useOptimistic` belongs to actions; TanStack has its own optimism
**Why:** `useOptimistic` shows a value while an action is pending and reverts when it settles. A TanStack mutation already exposes `variables` and `isPending` for the same job.
**How to apply:** Server Actions / form actions → `useOptimistic`. TanStack mutations → the patterns in `set-up-state-management/server-state.md`. Never both on the same data.

### Rule: `use()` reads a promise you were handed — it doesn't fetch
**Why:** `use(promise)` suspends on a promise created elsewhere (a Server Component, a cache). Creating the promise in render refetches on every render.
**How to apply:** Client fetching → `useQuery` / `useSuspenseQuery`. `use(Context)` replaces `useContext` where a conditional read helps.

### Rule: transitions for non-urgent updates and view transitions
**Why:** 19.3 made `<ViewTransition>` stable; it animates only updates inside `startTransition`, Suspense reveals or `useDeferredValue`. The same transition keeps old data on screen while a Suspense query refetches.
**How to apply:** Wrap filter/page changes in `startTransition`. Motion details: `set-up-motion`.

### Rule: `ref` is a prop; no `forwardRef` in new code
**Why:** React 19 passes `ref` to function components as a normal prop; `forwardRef` is legacy. `<Context>` renders as a provider directly.
```tsx
export function Input({ ref, ...rest }: ComponentProps<'input'>) {
  return <input ref={ref} {...rest} />;
}
```

## Meta-frameworks (Nuxt 4, Next 16)

The skills target Vite SPAs; the same folder standard maps onto both meta-frameworks (`../set-up-frontend-structure/folder-conventions.md`, "Nuxt and Next"). The idioms above apply unchanged. Two extra rules:

- **Nuxt:** auto-import framework APIs, import project code explicitly — `imports: { scan: false }`, `components: { dirs: [] }`. Grep and "find usages" then work the same as in the SPA.
- **Next:** Server Components fetch and prefetch; client components read through TanStack hooks hydrated via `HydrationBoundary`. Mark server-only modules with `import 'server-only'`.

## When to deviate
- **An existing codebase on older idioms:** migrate when you touch the file, not in a sweep — except `forwardRef`/`withDefaults`, which codemods convert safely.
- **Vapor on a hot path** once 3.6 is stable: opt in per component behind a measurement.
