---
name: set-up-error-boundaries
description: Use when adding error handling to a frontend app - app-shell, page and component error boundaries with a retryable fallback, a captureError seam, and global handlers, ready for an error tracker.
---

# Set Up Error Boundaries

## 1. Audit current state

```bash
grep -rnE "ErrorBoundary|errorCaptured|onErrorCaptured|errorHandler|react-error-boundary|onUncaughtError" src/ package.json 2>/dev/null
ls src/libs/error-reporter.ts .claude/stack-profile.md 2>/dev/null
```

Read `.claude/stack-profile.md` if present: `frontend.framework` replaces the detection in step 3; `package_manager` replaces `pnpm`; `observability.backend: sentry` means run `configure-error-tracking` right after this skill.

Check the root (`src/main.tsx` / `src/main.ts`): is the tree wrapped in a boundary, and are errors outside any boundary reported?

**Prerequisites:** `src/components/atoms/` and `molecules/` (`set-up-frontend-structure`; otherwise write the boundary into a flat `src/components/ErrorBoundary/` and note the deviation) and the `@/` alias (`configure-typescript`).

If a boundary exists at the root, the audit may still find missing page-level placement or missing global handlers; report those. A project that already uses `react-error-boundary` keeps it: add only the `captureError` seam and the global handlers (`error-boundaries.md`, "When to deviate").

## 2. Decide what to do

- No boundary → full setup (steps 4–6).
- Boundary at the root only → add the page boundary (step 5).
- Boundaries present, but no `captureError` seam or global handlers → add steps 4 (seam) and 5 only.
- Everything present → exit "Error boundaries already in place."

## 3. Detect framework

React or Vue, from the profile or `package.json`. The seam and the fallback copy are the same; the boundary differs.

## 4. Write the boundary, the fallback and the seam

Copy the files from [`./boundary-code.md`](./boundary-code.md), framework branch as detected:
- `src/components/molecules/ErrorBoundary/` — a **molecule**: one atom (`ErrorFallback`) plus one behaviour (catch, report, reset). React: a class (React has no function-component boundary; `override` is required by `noImplicitOverride`). Vue: `onErrorCaptured` returning `false`. Both take a reset hook and clear their state on retry.
- `src/components/atoms/ErrorFallback/` — friendly copy, a "Try again" button, stack detail in development only. The Vue version reads `import.meta.env.DEV` in `<script>`: `import.meta` inside a `<template>` fails the build, while `vue-tsc` accepts it.
- `src/libs/error-reporter.ts` — `captureError(error: unknown, context?)` and `installGlobalErrorHandlers()`. One seam, so a provider swap is a one-file change; `configure-error-tracking` replaces the body (and removes the global handlers, because Sentry installs its own).

## 5. Wire the boundaries

Three depths (`error-boundaries.md`), wired once each:
- **App shell:** wrap the whole tree in `main.tsx` (React) or `App.vue` (Vue), *outside* the Query/Pinia providers so a provider-setup error is still caught.
- **Page:** one boundary around the router outlet in the layout, `key`ed by the route (`key={pathname}` / `:key="route.fullPath"`). A failing page shows the fallback while header and navigation keep working, and navigating away clears the error. Do not edit every page.
- **Component:** only what can fail on its own data or a third party (chart, embedded editor, a card fed by an untrusted payload).

Errors no boundary sees go to the seam as well:
- React 19: `createRoot(el, { onUncaughtError, onRecoverableError })` call `captureError`. Leave `onCaughtError` unset: the boundary already reports what it catches, and wiring both double-reports.
- Vue: `app.config.errorHandler = (error) => captureError(error)`.
- Both: `installGlobalErrorHandlers()` once in the entry (event-handler errors in React, timers, rejected promises).

The entry-file code is in `./boundary-code.md`, "Wire the boundaries".

## 6. Verify

```bash
pnpm typecheck
```
Expected: exit 0. Add the component test from `./boundary-code.md` ("Test") once `configure-test-stack` has run:
```bash
pnpm vitest run --project ui tests/ui/ErrorBoundary.test.tsx   # Vue: ErrorBoundary.test.ts
```
It asserts the fallback appears, `captureError` is called once, and "Try again" recovers.

Manual: throw in a page component, confirm the fallback replaces only the page, remove the throw, press "Try again", and check the console shows one `[captureError]` line.

## References
- ./boundary-code.md — every file this skill writes, plus the React and Vue tests.
- ./error-boundaries.md — why try/catch is not enough, the three depths, fallback design, the seam and global handlers, the Vue test, anti-patterns.
- ../_shared/glossary.md — "molecule" vs "organism".
- ../_shared/conventions.md — `@/` prefix, the `typecheck` rule.
