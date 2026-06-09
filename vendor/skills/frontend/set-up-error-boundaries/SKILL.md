---
name: set-up-error-boundaries
description: Use when adding error boundaries to a frontend project — wires up an app-shell boundary, page-level boundaries, and a reusable component-level boundary with user-friendly fallback UIs and a logging-hook seam (Sentry/LogRocket-ready, but not installed).
---

# Set Up Error Boundaries

## 1. Audit current state

Search for an existing `ErrorBoundary` component:
```bash
grep -r "ErrorBoundary" src/ 2>/dev/null
```

Check whether the root component (`src/main.tsx` for React, `src/main.ts` for Vue) already wraps its tree in a boundary.

**Check prerequisites.** This skill writes into atomic-design folders and uses the `@/` import alias. If either is missing, run the relevant prerequisite skill first or fall back to a flat layout:

- `src/components/atoms/` and `src/components/molecules/` exist? If not, run `set-up-frontend-structure` first, or fall back to writing the boundary into `src/components/ErrorBoundary/` (flat) and note the deviation in the project README.
- `@/*` path alias configured? Check with `grep '"@/\*"' tsconfig.json tsconfig.app.json 2>/dev/null`. If absent, run `configure-typescript` first — the snippets below import from `@/libs/error-reporter` and `@/components/...`.

If a boundary exists and is wired at the root, the audit may still find missing page-level placements; report those.

## 2. Decide what to do

- No boundary → full setup (steps 3–7).
- Boundary present but only at root → add page-level wraps.
- Boundary present at every layer → confirm fallback UI and logging seam, exit if both fine.

## 3. Detect framework

Read `package.json`. React or Vue? Branch the boundary implementation.

## 4. Generate the molecule `ErrorBoundary`

Classified as a **molecule**: composes one atom (`ErrorFallback`) with one behavior (catch + report). Rationale and alternative classification documented in `error-boundaries.md`.

### React

```tsx
// src/components/molecules/ErrorBoundary/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '@/libs/error-reporter';
import { ErrorFallback } from '@/components/atoms/ErrorFallback';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

```ts
// src/components/molecules/ErrorBoundary/index.ts
export * from './ErrorBoundary';
```

### Vue

```vue
<!-- src/components/molecules/ErrorBoundary/ErrorBoundary.vue -->
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import { captureError } from '@/libs/error-reporter';
import ErrorFallback from '@/components/atoms/ErrorFallback/ErrorFallback.vue';

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err as Error;
  captureError(err as Error, {});
  return false; // halt propagation
});
</script>

<template>
  <ErrorFallback v-if="error" :error="error" />
  <slot v-else />
</template>
```

```ts
// src/components/molecules/ErrorBoundary/index.ts
export { default as ErrorBoundary } from './ErrorBoundary.vue';
```

## 5. Generate the atom `ErrorFallback`

### React

```tsx
// src/components/atoms/ErrorFallback/ErrorFallback.tsx
type Props = { error?: Error; onRetry?: () => void };

export function ErrorFallback({ error, onRetry }: Props) {
  return (
    <div role="alert" className="p-4 border border-red-500 rounded-md bg-red-50 text-red-900">
      <h2 className="font-semibold">Something went wrong.</h2>
      <p className="text-sm">Please try again. If the problem persists, contact support.</p>
      {import.meta.env.DEV && error && (
        <pre className="mt-2 text-xs whitespace-pre-wrap">{error.stack ?? error.message}</pre>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 px-3 py-1 bg-red-600 text-white rounded">
          Try again
        </button>
      )}
    </div>
  );
}
```

### Vue

```vue
<!-- src/components/atoms/ErrorFallback/ErrorFallback.vue -->
<script setup lang="ts">
defineProps<{ error?: Error; onRetry?: () => void }>();
</script>

<template>
  <div role="alert" class="p-4 border border-red-500 rounded-md bg-red-50 text-red-900">
    <h2 class="font-semibold">Something went wrong.</h2>
    <p class="text-sm">Please try again. If the problem persists, contact support.</p>
    <pre v-if="import.meta.env.DEV && error" class="mt-2 text-xs whitespace-pre-wrap">{{ error.stack ?? error.message }}</pre>
    <button
      v-if="onRetry"
      type="button"
      class="mt-2 px-3 py-1 bg-red-600 text-white rounded"
      @click="onRetry"
    >
      Try again
    </button>
  </div>
</template>
```

## 6. Generate the logging seam `captureError`

```ts
// src/libs/error-reporter.ts
type ErrorContext = {
  componentStack?: string;
  url?: string;
  user?: { id: string };
};

/**
 * Reports an error to the configured logging service.
 * Stub: logs to console. Replace the body when a real logger is wired in.
 */
export function captureError(error: Error, context: ErrorContext = {}): void {
  // Future logger goes here, e.g.:
  //   Sentry.captureException(error, { contexts: { app: context } });
  console.error('[captureError]', error, context);
}
```

The function exists as a single seam so swapping providers later is a one-file change. Future skill `configure-error-tracking` (Tier 2 / out of scope here) wires this to Sentry.

## 7. Wire boundaries

### React: app shell

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/molecules/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
```

For each page-level component (under `src/components/pages/`), wrap the page output in an `ErrorBoundary`. The skill scans `pages/` and adds the wrapper if missing.

### Vue: app shell

```ts
// src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import ErrorBoundary from '@/components/molecules/ErrorBoundary/ErrorBoundary.vue';
import './style.css';

const app = createApp(App);
app.component('ErrorBoundary', ErrorBoundary);
app.mount('#app');
```

Then wrap `<App />` content (or page-level components) with `<ErrorBoundary>` slots.

## 8. Generate a Playwright placeholder test

The spec calls for a test that renders a deliberately-throwing component and asserts the `ErrorFallback` is shown. That requires:
1. A `?throw=1` query handler in `App` that throws on render.
2. A spec that visits `/?throw=1` and asserts the fallback markup.

Wiring both ends up entangled with the Playwright setup (config, dev-server proxy, page wrappers) that skill `configure-test-stack` (Plan 3) installs. Until that lands, generate a placeholder spec that confirms the page renders without crashing the app-shell boundary — it does NOT yet exercise the catch path:

```ts
// tests/e2e/error-boundary.spec.ts
// PLACEHOLDER — the real catch-path test arrives with skill `configure-test-stack`.
// This stub merely confirms the page renders without crashing the app-shell boundary.
import { test, expect } from '@playwright/test';

test('home page renders without crashing the app-shell boundary', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
```

Mark the file as a placeholder with the comment block above so it's obvious to a future reader that this test is a stub.

## 9. Verify

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

```bash
pnpm test:e2e
```

(If Playwright not yet configured, this will fail; that's wired up in skill `configure-test-stack`. Skip if not configured.)

## References
- ./error-boundaries.md — full per-framework patterns, placement strategy, fallback design rules, logging-hook integration, anti-patterns.
- ../_shared/glossary.md — "molecule" vs "organism" criteria.
- ../_shared/conventions.md — `@/` import prefix convention.
