# Error boundaries — code

Reference for `set-up-error-boundaries`. The files the skill writes, compiled under the `configure-typescript` flags and run in Chromium on 2026-10-09 (React 19.3, Vue 3.5, Vitest 5.0). Why they look like this: `error-boundaries.md`.

## The molecule `ErrorBoundary`

A **molecule**: one atom (`ErrorFallback`) plus one behaviour (catch, report, reset). Placement rationale: `error-boundaries.md`.

### React

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from '@/components/atoms/ErrorFallback';
import { captureError } from '@/libs/error-reporter';

type Props = {
  children: ReactNode;
  /** Replaces the default fallback UI. */
  fallback?: ReactNode;
  /** Runs before a retry re-renders the children (reset a query, clear a form). */
  onReset?: () => void;
};
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack ?? undefined });
  }

  private readonly reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (error) return this.props.fallback ?? <ErrorFallback error={error} onRetry={this.reset} />;
    return this.props.children;
  }
}
```
```ts
// src/components/molecules/ErrorBoundary/index.ts
export * from './ErrorBoundary';
```

`override` is required by `noImplicitOverride` (`configure-typescript`). It must be a class: React has no function-component error boundary.

### Vue

```vue
<!-- src/components/molecules/ErrorBoundary/ErrorBoundary.vue -->
<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import ErrorFallback from '@/components/atoms/ErrorFallback/ErrorFallback.vue';
import { captureError } from '@/libs/error-reporter';

const emit = defineEmits<{ reset: [] }>();
const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err));
  captureError(err);
  return false; // stop propagation: this boundary owns the error
});

function reset() {
  emit('reset');
  error.value = null;
}
</script>

<template>
  <ErrorFallback v-if="error" :error="error" @retry="reset" />
  <slot v-else />
</template>
```

## The atom `ErrorFallback`

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
```ts
// src/components/atoms/ErrorFallback/index.ts
export * from './ErrorFallback';
```

### Vue

```vue
<!-- src/components/atoms/ErrorFallback/ErrorFallback.vue -->
<script setup lang="ts">
defineProps<{ error?: Error }>();
const emit = defineEmits<{ retry: [] }>();
const showDetail = import.meta.env.DEV; // `import.meta` is not available inside <template>
</script>

<template>
  <div role="alert" class="p-4 border border-red-500 rounded-md bg-red-50 text-red-900">
    <h2 class="font-semibold">Something went wrong.</h2>
    <p class="text-sm">Please try again. If the problem persists, contact support.</p>
    <pre v-if="showDetail && error" class="mt-2 text-xs whitespace-pre-wrap">{{ error.stack ?? error.message }}</pre>
    <button type="button" class="mt-2 px-3 py-1 bg-red-600 text-white rounded" @click="emit('retry')">
      Try again
    </button>
  </div>
</template>
```

The dev-only detail reads `import.meta.env.DEV` in the script: `import.meta` inside a Vue `<template>` fails the build (`Error parsing JavaScript expression: import.meta may appear only with 'sourceType: "module"'`), while `vue-tsc` accepts it.

## The seam `captureError` and the global handlers

```ts
// src/libs/error-reporter.ts
type ErrorContext = {
  componentStack?: string | undefined;
  url?: string | undefined;
  user?: { id: string } | undefined;
};

/** Anything can be thrown; the reporter always works with an `Error`. */
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Non-Error value thrown', { cause: value });
}

/**
 * The one place errors are reported. Stub: logs to the console.
 * `configure-error-tracking` replaces the body with the tracker call.
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  console.error('[captureError]', toError(error), context);
}

/** Errors no boundary sees: event handlers, timers, rejected promises. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => captureError(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => captureError(event.reason));
}
```

One seam, so a provider swap is a one-file change. `configure-error-tracking` replaces the body of `captureError`; with Sentry it also removes `installGlobalErrorHandlers`, because the SDK installs its own.

## Wire the boundaries

### React — `src/main.tsx`

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from '@/components/molecules/ErrorBoundary';
import { captureError, installGlobalErrorHandlers } from '@/libs/error-reporter';
import { queryClient } from '@/libs/queryClient';
import './index.css';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!, {
  // Caught errors are reported by the boundary itself; these two see everything else.
  onUncaughtError: (error, info) => captureError(error, { componentStack: info.componentStack }),
  onRecoverableError: (error, info) => captureError(error, { componentStack: info.componentStack }),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
```
Drop the `QueryClientProvider` lines if `set-up-state-management` has not run. Keep the boundary **outside** the providers so a provider-setup error is still caught. React 19 reports errors through the root options: `onCaughtError` fires for errors a boundary caught (the boundary already reports those, so wiring it would double-report), `onUncaughtError` and `onRecoverableError` see the rest.

### Vue — `src/main.ts` and `src/App.vue`

```ts
// src/main.ts (excerpt)
import { captureError, installGlobalErrorHandlers } from '@/libs/error-reporter';

installGlobalErrorHandlers();

const app = createApp(App);
app.config.errorHandler = (error) => captureError(error); // errors no boundary caught
// app.use(createPinia()).use(VueQueryPlugin, …) as set up by set-up-state-management
app.mount('#app');
```
```vue
<!-- src/App.vue: the app-shell boundary wraps the whole tree -->
<script setup lang="ts">
import { useRoute } from 'vue-router'; // once set-up-routing has run
import ErrorBoundary from '@/components/molecules/ErrorBoundary/ErrorBoundary.vue';

const route = useRoute();
</script>

<template>
  <ErrorBoundary>
    <!-- header, navigation … -->
    <ErrorBoundary :key="route.fullPath">
      <RouterView />
    </ErrorBoundary>
  </ErrorBoundary>
</template>
```

### Page level: one boundary around the router outlet

Wrap the router outlet once, in the layout, and `key` it by the route (`:key="route.fullPath"`; React: `<ErrorBoundary key={pathname}>`). A failing page then shows the fallback while header and navigation keep working, and navigating away clears the error. Do not edit every page to add its own wrapper.

### Component level

Wrap only what can fail on its own data or a third party: a chart widget, an embedded editor, a card fed by an untrusted payload.


## Test — React

```tsx
// tests/ui/ErrorBoundary.test.tsx
import { render } from 'vitest-browser-react';
import { expect, test, vi } from 'vitest';
import { ErrorBoundary } from '@/components/molecules/ErrorBoundary';
import { captureError } from '@/libs/error-reporter';

vi.mock('@/libs/error-reporter');

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('boom');
  return <p>recovered</p>;
}

test('shows the fallback, reports once, and recovers on retry', async () => {
  const screen = await render(
    <ErrorBoundary>
      <Flaky />
    </ErrorBoundary>,
  );
  await expect.element(screen.getByRole('alert')).toBeVisible();
  expect(captureError).toHaveBeenCalledTimes(1);

  shouldThrow = false;
  await screen.getByRole('button', { name: 'Try again' }).click();
  await expect.element(screen.getByText('recovered')).toBeVisible();
});
```

## Test — Vue

```ts
// tests/ui/ErrorBoundary.test.ts
import { render } from 'vitest-browser-vue';
import { expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import ErrorBoundary from '@/components/molecules/ErrorBoundary/ErrorBoundary.vue';
import { captureError } from '@/libs/error-reporter';

vi.mock('@/libs/error-reporter');

let shouldThrow = true;
const Flaky = defineComponent(() => () => {
  if (shouldThrow) throw new Error('boom');
  return h('p', 'recovered');
});

test('shows the fallback, reports once, and recovers on retry', async () => {
  const screen = await render(ErrorBoundary, { slots: { default: () => h(Flaky) } });
  await expect.element(screen.getByRole('alert')).toBeVisible();
  expect(captureError).toHaveBeenCalledTimes(1);

  shouldThrow = false;
  await screen.getByRole('button', { name: 'Try again' }).click();
  await expect.element(screen.getByText('recovered')).toBeVisible();
});
```

`render` of both adapters is async; `vi.mock` of the seam is hoisted, so the boundary calls the mock.

## When to deviate

- **`react-error-boundary` already in the project:** keep it and its API (`resetKeys`, `useErrorBoundary`); add only the seam and the global handlers.
- **No router yet:** the app-shell boundary is enough; add the page boundary with the router.
- **A different tracker or none:** the seam stays; only `captureError`'s body changes.
