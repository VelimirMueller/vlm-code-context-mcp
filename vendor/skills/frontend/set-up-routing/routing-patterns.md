# Routing Patterns

Reference for `set-up-routing`. The senior 2026 routing choices, React and Vue.

## Rule: routes are typed — no stringly-typed paths
**Why:** `navigate('/todos/' + id)` is a runtime bug waiting to happen — a typo or a renamed route fails silently. TanStack Router infers params, search, and route IDs from the route tree, so a wrong `to` is a compile error. Vue gains the same with `unplugin-vue-router` (typed `RouterLink`/`router.push`).
**How to apply:** React → TanStack Router file-based + the `Register` declaration. Vue → `unplugin-vue-router` for typed routes, or named routes (`{ name: 'todo', params: { id } }`) as the typed-enough baseline.

## Rule: every route lazy-loads its component
**Why:** Shipping the whole app in the entry bundle blocks first paint. Per-route splitting means a user downloads only the route they visit.
**How to apply:** TanStack Router `autoCodeSplitting: true` (the plugin splits each route file). Vue Router `component: () => import('...')` (dynamic import per route).

## Rule: a route prefetches its data in a loader (loader ↔ Query)
**Why:** Fetching inside the component waterfalls — render, then fetch, then re-render. A loader runs the fetch *during* navigation, in parallel with code loading, and `ensureQueryData` warms the exact TanStack Query cache the component's hook reads, so the component renders with data already present.
**How to apply:** Pass `queryClient` via router context; `loader: ({ context }) => context.queryClient.ensureQueryData({ queryKey, queryFn })`. Extract a shared `todosQueryOptions(filters)` returning `{ queryKey, queryFn }` and use it in both the loader and the hook — one definition, no drift.

**Anti-example:**
```tsx
// bad: component-level fetch — navigation shows a blank/spinner, then data
function Todos() { const { data } = useTodos(filters); /* waterfall */ }
// (fine on its own; but with a router, prefetch in the loader so nav is instant)
```

## Rule: guards live in `beforeLoad` / `beforeEach`, not components
**Why:** A component-level redirect renders the protected component (and fires its hooks) before bouncing — a flash and wasted work, sometimes a security smell. Route-level guards run *before* the route loads.
**How to apply:** TanStack `beforeLoad: ({ context }) => { if (!context.auth) throw redirect({ to: '/login' }) }`. Vue `router.beforeEach`. The auth source comes from `set-up-auth`.

## Rule: each route owns its error + pending UI
**Why:** A route that can fail should show a scoped fallback, not blank the app. This is the routing-layer twin of the `set-up-error-boundaries` boundaries.
**How to apply:** TanStack `errorComponent` / `pendingComponent` per route — reuse the `ErrorFallback` atom. Vue: wrap `<RouterView>` in `<Suspense>` + an `ErrorBoundary`.

## Rule: the routes/ layer owns routing; reconcile with atomic `pages/`
**Why:** File-based routers make `src/routes/` the source of truth for navigation. The atomic-design `pages/` layer then duplicates that. Pick one.
**How to apply:** With TanStack file-based routing, route files in `src/routes/` *are* the pages — keep page-level composition there and drop the atomic `pages/` folder (or keep `pages/` as presentational templates the route files render). Don't maintain both as route owners. (Noted in `../_shared/conventions.md`.)

## When to deviate
- **react-router shops:** react-router v7 (framework/data mode) is a fine choice with loaders/actions of its own. Migrate deliberately; don't run two routers. The patterns above (typed-ish, lazy, loader prefetch, guards, per-route error) still apply.
- **SSR/SSG:** out of scope here (Vite SPA). TanStack Start / Nuxt own that.
