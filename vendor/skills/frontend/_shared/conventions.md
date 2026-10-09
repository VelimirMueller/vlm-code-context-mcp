# Frontend Conventions

Canonical project conventions shared across frontend skills. When a skill needs to know "what's the path-alias prefix?" or "how do we name barrel files?", it links here.

## Rule: path-alias prefix is `@/`
**Why:** One short prefix removes `../../..` chains, which break when a file moves. `@/` is what `create-next-app` generates, and Nuxt accepts it next to its own `~/`; Vite has no default, so the prefix is a choice made once and kept.
**How to apply:** `@/components/atoms/Button` instead of `../../../components/atoms/Button`. Configure consistently in tsconfig, vite, vitest, playwright, and storybook (see `configure-typescript` skill, ref `path-aliases.md`).

```ts
// good
import { Button } from '@/components/atoms/Button';

// bad
import { Button } from '../../../components/atoms/Button';
```

## Rule: source root is `src/`
**Why:** Vite, Next and Nuxt scaffolds already put code there, so `include: ['src']` in tsconfig, Biome and Vitest globs work without per-tool configuration.
**How to apply:** All app code lives under `src/`. Tests live in a top-level `tests/` tree by type (see `folder-conventions.md`). Public assets under `public/`.

## Rule: file names match exported identifier
**Why:** Easier navigation, predictable imports.
**How to apply:**
- Component file `Button.tsx` exports a `Button` as a **named** export (a rename then shows up in grep and in the editor's rename; default exports are renamed freely at the import site). Vue SFCs are default-imported by the toolchain; that is fine.
- Hook file `useToggle.ts` exports `useToggle` (named only — hooks rarely warrant default exports).
- Composable file `useToggle.ts` (Vue) — same naming as React hooks; the folder differs.
- Util file `formatDate.ts` exports `formatDate` (named export).

**Anti-example:**
```ts
// bad: file Card.tsx exports an unrelated identifier
export const Tile = () => null;
```

## Rule: barrels re-export, never define — and only where they encapsulate
**Why:** A barrel is useful at one place: the public surface of a unit that has private internals (a feature, a component folder). A barrel over a whole layer (`components/atoms/index.ts`, `utils/index.ts`) buys nothing and costs: importing one atom makes Vite fetch and transform every file the barrel re-exports, and run their side effects ([Vite performance guide, "Avoid Barrel Files"](https://vite.dev/guide/performance#avoid-barrel-files)). A file that both defines and re-exports does two jobs; split it.
**How to apply:** Keep `components/<layer>/<Name>/index.ts` (one line, one file) and `features/<domain>/index.ts`. Do not create layer-level barrels; import `@/utils/formatDate`, `@/hooks/useTodos`, `@/components/atoms/Button`.
```ts
// src/components/atoms/Button/index.ts
export * from './Button';
```

**Anti-example:**
```ts
// bad: a layer barrel — one import pulls the whole layer into the module graph
// src/components/atoms/index.ts
export * from './Button';
export * from './ErrorFallback';
// bad: defining inline in a barrel
export const Button = () => null;
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

## Rule: one `typecheck` script, and it is `tsc -b`
**Why:** The Vite 8 templates keep a root `tsconfig.json` of `{ "files": [], "references": [...] }`. `pnpm tsc --noEmit` against it checks zero files and exits 0 even when `src/` has a type error (reproduced with React and Vue templates, 2026-10-09). A verify step that cannot fail verifies nothing.
**How to apply:** `configure-typescript` adds `"typecheck": "tsc -b"` (Vue: `vue-tsc -b`). Skills verify with `pnpm typecheck`; before that script exists, run `pnpm tsc -b` / `pnpm vue-tsc -b` directly.

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
- **Test location:** the default is a top-level `tests/` tree. `tests.layout: colocated` in the stack profile (or an established colocated suite) switches to `*.test.*` beside the source; see `../configure-test-stack/test-layout.md`.
- **Layer barrels:** a project with a bundler that tree-shakes barrels well (Next/Turbopack with `optimizePackageImports`, or a library build) can keep them; the cost above is Vite's dev server.
- **Source root:** Nuxt 4 uses `app/` as its source root — treat it as `src/`. Next.js keeps `src/` with routing in `src/app/`. Skills audit the layout before assuming.
