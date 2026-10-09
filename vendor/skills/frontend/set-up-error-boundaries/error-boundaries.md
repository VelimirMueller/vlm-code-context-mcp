# Error Boundaries

Reference for `set-up-error-boundaries`. What a boundary catches, where to put it, how the fallback behaves, and how reports leave the app. The code is in `boundary-code.md`; it was compiled and run on 2026-10-09 (React 19.3, Vue 3.5).

## Why try/catch is not enough, and what a boundary does not catch

`try/catch` covers synchronous code in a handler. It does not see an error thrown while rendering, in a lifecycle hook or in a Vue watcher; a boundary does (React error boundaries, Vue `onErrorCaptured`).

A boundary does **not** catch:
- errors in event handlers (React; Vue routes handler errors to `errorCaptured` and `app.config.errorHandler`),
- errors in timers and rejected promises that nobody awaits,
- errors thrown by the boundary's own fallback.

Those need the global path: `window` `error` and `unhandledrejection` listeners, React 19's `onUncaughtError`, Vue's `app.config.errorHandler`. All of them end in `captureError`.

## Rule: place boundaries at three depths, and make the middle one a single outlet boundary
**Why:** One root boundary catches everything but replaces the whole app for any error. Finer boundaries keep the rest of the UI usable. The page depth needs one boundary around the router outlet, not one per page: the outlet is the only place every page passes through, a `key` on it resets the error on navigation, and a per-page wrapper is a convention that the next page forgets.
**How to apply:**
- **App shell** in the entry (`main.tsx` / `App.vue`), outside the data providers.
- **Page:** `<ErrorBoundary key={pathname}><Outlet /></ErrorBoundary>` in the layout.
- **Component:** third-party widgets and regions fed by untrusted data.

```tsx
// good: header and footer survive a page error
<ErrorBoundary>
  <Header />
  <ErrorBoundary key={pathname}><Outlet /></ErrorBoundary>
  <Footer />
</ErrorBoundary>
```

## Rule: React boundaries are classes (hand-rolled, 25 lines, over `react-error-boundary`)
**Why:** `getDerivedStateFromError` and `componentDidCatch` exist only on classes; React 19 has no function-component boundary. `react-error-boundary` (6.1) wraps that class and adds `resetKeys`, `useErrorBoundary` (route an async error into the nearest boundary) and `FallbackComponent`. The hand-rolled class needs no dependency and covers the default case (catch, report, reset); the library earns its place when you need `resetKeys` across many boundaries or `showBoundary` for async errors.
**How to apply:** Use the class from `boundary-code.md`. It reports in `componentDidCatch`, resets through `onReset`, and needs `override` under `noImplicitOverride`. Switching to the library later changes the molecule's internals, not its callers.

## Rule: a boundary resets what failed, not only its own state
**Why:** "Try again" that only clears the boundary re-renders the same failing query from the cached error. The retry must reset the source.
**How to apply:** Pass `onReset`. With TanStack Query suspense queries, put `QueryErrorResetBoundary` outside and hand its `reset` to the boundary:

```tsx
<QueryErrorResetBoundary>
  {({ reset }) => (
    <ErrorBoundary onReset={reset}>
      <Suspense fallback={<p>Loading…</p>}>{children}</Suspense>
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>
```

## Rule: Vue boundaries use `onErrorCaptured` and return `false`
**Why:** It is Vue's own hook for descendant errors (render, setup, hooks, watchers, handlers). Returning `false` stops propagation to ancestor hooks and to `app.config.errorHandler`; without it the same error is reported once per ancestor.
**How to apply:** The SFC in `boundary-code.md`. The boundary reports itself (`captureError`) because the error never reaches `app.config.errorHandler`.

## Rule: the boundary reports in one place, and the root options report only what it did not
**Why:** React 19 added `onCaughtError`, `onUncaughtError` and `onRecoverableError` to `createRoot`. `onCaughtError` fires for errors a boundary caught, which `componentDidCatch` already reported, so wiring both counts every caught error twice.
**How to apply:** `componentDidCatch` → `captureError`; `onUncaughtError` and `onRecoverableError` → `captureError`; `onCaughtError` stays unset (React logs it to the console).

## Rule: classify the boundary as a molecule
**Why:** It composes one atom (the fallback) with one behaviour (catch, report, reset), which is the molecule definition in `../_shared/glossary.md`. Some teams file boundaries under organisms because they wrap regions; here the boundary is small and reusable, and the wrapped content is the organism.

## Rule: the fallback is friendly and actionable
**Why:** "Something broke" with no next step frustrates users; a retry recovers many transient errors.
**How to apply:** headline, one sentence, a "Try again" button wired to the boundary's reset, and the stack only when `import.meta.env.DEV` (never in production: stacks leak internals). Use `role="alert"` so assistive technology announces it.

## Rule: one `captureError` seam, taking `unknown`
**Why:** Trackers come and go (Sentry, Datadog, Honeycomb); a seam makes the swap one file. Anything can be thrown (`throw 'x'`, a rejected `undefined`), so the seam normalises to an `Error` instead of trusting every caller to cast.
**How to apply:** `src/libs/error-reporter.ts` exports `captureError(error: unknown, context?)` and `installGlobalErrorHandlers()`. Only that file imports a tracker.

## Anti-patterns
- **A boundary that swallows:** `componentDidCatch() {}` hides production errors. Always call `captureError`.
- **A boundary to route around missing data:** "this component throws when `user` is undefined" is a data-layer bug; fix the type or the loader. Boundaries are for the unexpected.
- **A boundary inside a published component library:** the consuming app decides placement.

## When to deviate

- **Existing `react-error-boundary`:** adopt its API and add only the seam and global handlers; do not run two boundary implementations.
- **Vue app with `app.config.errorHandler` already set:** audit it before adding the molecule at the same depth; a boundary that returns `false` keeps errors from reaching it, so report in the boundary or let the error propagate.
- **No router yet:** the app-shell boundary is enough; add the page boundary with the router.
- **A small app with one screen:** a root boundary and the seam are the whole job; skip component-level boundaries until a widget fails on its own.
- **Server rendering (Next/Nuxt):** use the framework's `error.tsx` / `error.vue` for route errors and keep the seam; these client boundaries cover the client tree only.
