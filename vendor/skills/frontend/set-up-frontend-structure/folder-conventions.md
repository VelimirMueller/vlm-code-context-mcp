# Folder Conventions

Reference for `set-up-frontend-structure`. The one layout every repo shares, naming, barrel patterns, and the React-vs-Vue split for hooks/composables.

## Rule: same concept, same folder — in every repo
**Why:** A developer who knows one repo should find things in any other without searching. The layout below maps 1:1 between Vue and React; only the framework idiom changes (`composables/` vs `hooks/`, `router/` vs `routes/`).
**How to apply:**
```
src/
├── main.ts | main.tsx         # bootstrap + providers only
├── App.vue | App.tsx          # app shell
├── router/ (Vue) | routes/ (React)   # thin: params, prefetch, render a page
├── components/                # shared UI, no domain knowledge
│   ├── atoms/ molecules/ organisms/
│   ├── templates/             # layouts
│   └── pages/                 # page components, compose features
├── features/<domain>/         # once a second domain exists
│   ├── api/                   # <domain>.keys.ts · <domain>.queries.ts · <domain>.api.ts
│   ├── composables/ | hooks/
│   ├── components/            # domain UI
│   ├── stores/                # domain UI state only
│   ├── schemas/               # Zod schemas + inferred types
│   └── index.ts               # the public surface
├── composables/ | hooks/      # cross-feature view logic
├── stores/                    # cross-feature UI state (theme, locale, sidebar)
├── libs/                      # seams: fetcher, env, queryClient, queryKeys, i18n
├── utils/                     # pure helpers
├── locales/{de,en}/
├── styles/                    # tokens.css (themes) + main.css
└── types/                     # ambient types only
tests/{unit,integration,ui,e2e,mocks,setup}/
```

### Findability — "I look for X → it is in Y"

| I look for … | Vue | React |
|---|---|---|
| URL → screen mapping | `src/router/index.ts` | `src/routes/` |
| A page's UI | `src/components/pages/` | `src/components/pages/` |
| Everything about one domain | `src/features/<d>/` | `src/features/<d>/` |
| A query key | `features/<d>/api/<d>.keys.ts` (registry `libs/queryKeys.ts`) | same |
| The HTTP call for an entity | `features/<d>/api/<d>.api.ts` | same |
| Query / mutation hooks | `features/<d>/composables/` | `features/<d>/hooks/` |
| UI state | `features/<d>/stores/` or `stores/` | same |
| Base URL, auth headers, env | `libs/fetcher.ts`, `libs/env.ts` | same |
| Design tokens and themes | `styles/tokens.css` | same |
| Translations | `locales/{de,en}/` | same |
| A test | `tests/<type>/` | same |

## Rule: Nuxt and Next use the same names inside their own roots
**Why:** The meta-frameworks fix the routing folder and the source root; everything else is free. Filling the free part with the same names keeps the findability table valid.
**How to apply:**

| Standard (Vite SPA) | Nuxt 4 | Next.js 16 |
|---|---|---|
| `src/` | `app/` (Nuxt's `srcDir`) | `src/` |
| `router/` / `routes/` | `app/pages/` (thin) + `app/middleware/` (guards) | `src/app/` — routing files only, route groups `(marketing)` / `(app)` |
| `components/templates/` | `app/layouts/` | `layout.tsx` per segment |
| `features/<d>/` | `app/features/<d>/` | `src/features/<d>/` (+ `actions.ts` for Server Actions) |
| `libs/`, `utils/`, `stores/`, `locales/` | same under `app/` | same under `src/` |
| — | `server/` (Nitro BFF), `shared/` (code for app + server) | `src/server/` (`import 'server-only'`), `src/app/api/**/route.ts` |
| `tests/` | `tests/` (map the `nuxt` Vitest project to `tests/ui` + `tests/integration`) | `tests/` |

- **Nuxt auto-imports:** keep them for framework APIs (`ref`, `useRoute`, `useFetch`); import project code explicitly — `imports: { scan: false }`, `components: { dirs: [] }`. Grep and "find usages" then behave like the SPA, and a feature moves between SPA and Nuxt unchanged.
- **Nuxt layers:** a feature becomes a layer (`layers/<name>/`) only when two apps ship it.
- **Next colocation:** Next allows project files inside `app/` (`_components`); the standard keeps `app/` for routing files so routes stay thin in every framework.

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
- **Test location:** this project's default is the typed top-level `tests/` tree (Nuxt's own docs also keep tests in a top-level `test/`; Next and the Vitest examples colocate). A team that prefers co-located `*.test.*` can keep them in `src/` — follow what's there; don't churn an established choice.
- **Small app, one domain:** skip `features/`; promote the root `hooks|composables/` + `stores/` content into `features/<d>/` when the second domain arrives, in its own commit.

## Empty-folder placeholders

Each empty folder gets a `.gitkeep` file (zero bytes). Once real content arrives, the `.gitkeep` should be deleted in the same commit that adds the first real file.
