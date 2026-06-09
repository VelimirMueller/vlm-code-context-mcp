# Folder Conventions

Reference for `set-up-frontend-structure`. Naming, barrel patterns, and the React-vs-Vue split for hooks/composables.

## Rule: hooks (React) vs composables (Vue)
**Why:** Each framework's idiom. Mixing terms creates cognitive overhead.
**How to apply:**
- React → `src/hooks/`
- Vue → `src/composables/`

The skill `set-up-frontend-structure` detects framework and picks the right folder.

## Rule: each component lives in its own folder
**Why:** A component, its story, and its barrel together — co-located, navigable. (Tests live in the top-level `tests/` tree, not here — see the tests rule below.)
**How to apply:**
```
src/components/atoms/Button/
├── Button.tsx           # component
├── Button.stories.ts    # Storybook (runs as a test via the Storybook Vitest addon)
└── index.ts             # barrel: export * from './Button'
```

**Anti-example:**
```
src/components/atoms/
├── Button.tsx           # everything flat
├── Card.tsx             # quickly becomes 50 files in one folder
```

## Rule: tests live in `tests/` by type; stories stay co-located
**Why:** A typed top-level `tests/` tree (`unit`, `integration`, `ui`, `e2e`) keeps source folders focused on shipping code and lets each kind run under the right environment. Stories are component documentation, so they sit beside the component — the Storybook Vitest addon runs them as tests in place.
**How to apply:**
- Tests → `tests/{unit,integration,ui,e2e}/` (see the `configure-test-stack` skill, ref `test-layout.md`).
- Stories → `Button.stories.ts` next to `Button.tsx`.

## Rule: `libs/` is for "third-party adapter or wrapper"; `utils/` is for "pure helpers"
**Why:** Different lifetimes and dependencies. A wrapper around `tanstack/query` belongs to libs because it depends on a third-party. A `formatDate` belongs to utils because it has no external deps.
**How to apply:**
- `libs/queryClient.ts` (wraps TanStack Query) → `libs/`
- `libs/fetcher.ts` (wraps `fetch`) → `libs/`
- `utils/formatDate.ts` (pure date formatter) → `utils/`
- `utils/clsx.ts` (pure class-string utility) → `utils/`

## Rule: barrel `index.ts` re-exports only; never defines inline
**Why:** A file that defines AND re-exports does two jobs. Splits concerns.
**How to apply:**
```ts
// src/components/atoms/index.ts
export * from './Button';
export * from './Input';
export * from './ErrorFallback';
```

## Rule: file names match the primary export's PascalCase identifier
**Why:** Predictable imports.
**How to apply:** `Button.tsx` exports `Button`. `useToggle.ts` exports `useToggle`. `formatDate.ts` exports `formatDate`.

## When to deviate

- **`pages/` for route components:** if using a file-based router (Next.js, Nuxt, TanStack Router), the routing layer dictates a `pages/` or `routes/` folder. In that case, the atomic-design `pages/` layer redundantly mirrors that — pick one. The skill audits and asks.
- **Test location:** this project's default is the typed top-level `tests/` tree. A team that prefers co-located `*.test.*` can keep them in `src/` — follow what's there; don't churn an established choice.

## Empty-folder placeholders

Each empty folder gets a `.gitkeep` file (zero bytes). Once real content arrives, the `.gitkeep` should be deleted in the same commit that adds the first real file.
