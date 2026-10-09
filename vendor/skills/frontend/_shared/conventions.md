# Frontend Conventions

Canonical project conventions shared across frontend skills. When a skill needs to know "what's the path-alias prefix?" or "how do we name barrel files?", it links here.

## Rule: path-alias prefix is `@/`
**Why:** Single, short prefix avoids ambiguity (vs deep relative paths) and matches the de-facto Vite/Next/Nuxt default. Two-character prefix keeps imports compact.
**How to apply:** `@/components/atoms/Button` instead of `../../../components/atoms/Button`. Configure consistently in tsconfig, vite, vitest, playwright, and storybook (see `configure-typescript` skill, ref `path-aliases.md`).

```ts
// good
import { Button } from '@/components/atoms/Button';

// bad
import { Button } from '../../../components/atoms/Button';
```

## Rule: source root is `src/`
**Why:** Matches every modern scaffold (Vite, Next, Nuxt). Avoids debate.
**How to apply:** All app code lives under `src/`. Tests live in a top-level `tests/` tree by type (see `folder-conventions.md`). Public assets under `public/`.

## Rule: file names match exported identifier
**Why:** Easier navigation, predictable imports.
**How to apply:**
- Component file `Button.tsx` exports a `Button` (default + named both fine; pick one and stick).
- Hook file `useToggle.ts` exports `useToggle` (named only — hooks rarely warrant default exports).
- Composable file `useToggle.ts` (Vue) — same naming as React hooks; the folder differs.
- Util file `formatDate.ts` exports `formatDate` (named export).

**Anti-example:**
```ts
// bad: file Card.tsx exports an unrelated identifier
export const Tile = () => null;
```

## Rule: barrel files (`index.ts`) re-export, never define
**Why:** A file that both defines and re-exports is doing two jobs. Split.
**How to apply:**
```ts
// skills/frontend/components/atoms/index.ts — barrel
export * from './Button';
export * from './ErrorFallback';
```

**Anti-example:**
```ts
// bad: defining inline
export const Button = () => null;
export * from './ErrorFallback';
```

## Rule: one domain = one feature module once a second domain exists
**Why:** A domain (todos, billing, users) changes together — its queries, hooks, components, UI store and schemas. Spread over five root folders, one change touches five places and nobody finds the whole. A feature folder keeps the domain in one place while the inside repeats the root layout, so the "where does it go" rules don't change.
**How to apply:** `src/features/<domain>/{api,hooks|composables,components,stores,schemas}/` + `index.ts` (the public surface). Root folders keep cross-feature code only. Other code imports a feature through its `index.ts`, never its internals. A one-domain app skips `features/` until the second domain arrives. Full layout and the Nuxt/Next mapping: `../set-up-frontend-structure/folder-conventions.md`.

```ts
// good
import { TodoList, useTodos } from '@/features/todos';

// bad: reaching past the public surface
import { todoKeys } from '@/features/todos/api/todos.keys';
```

## Rule: framework-specific folder for hooks vs composables
**Why:** Mirrors framework idiom. React projects say "hook"; Vue projects say "composable". Mixing terms creates cognitive overhead.
**How to apply:**
- React → `src/hooks/`
- Vue → `src/composables/`

## Rule: `stores/` holds UI-state stores; one small store per domain
**Why:** UI state (toggles, selections, filters, theme) is separate from server state, which lives in the TanStack Query cache, not a store. A dedicated folder keeps that boundary visible. One store per domain limits re-render scope and keeps each store readable.
**How to apply:**
- React → `src/stores/use<Domain>Store.ts` (Zustand). Example: `useTodoFiltersStore.ts`.
- Vue → `src/stores/use<Domain>Store.ts` (Pinia, setup-store style).
- Domain-only UI state → `src/features/<domain>/stores/`; cross-feature (theme, locale, sidebar) → `src/stores/`.
- Server data never goes in a store. See the `set-up-state-management` skill, ref `state-boundaries.md`.

## When to deviate

- **Path alias prefix:** if the project already uses `~/` (Nuxt convention) or `app/` (legacy), keep the existing prefix. Don't churn imports.
- **Source root:** Nuxt 4 uses `app/` as its source root — treat it as `src/`. Next.js keeps `src/` with routing in `src/app/`. Skills audit the layout before assuming.
