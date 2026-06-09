# Error Boundaries

Reference for `set-up-error-boundaries`. Why try/catch isn't enough, framework-specific implementations, placement strategy, fallback UI design, and the logging seam.

## Why try/catch isn't enough

`try/catch` works for synchronous code in event handlers and effects. It does **not** catch:
- Errors thrown during the render phase.
- Errors in lifecycle hooks (`useEffect`, `componentDidMount`).
- Async errors that don't bubble back to the original `try` (Promise rejections, microtasks).

Error boundaries (React) and `errorCaptured` (Vue) bridge that gap by intercepting render-phase errors at the framework level.

## Rule: place boundaries at three depths
**Why:** A single root-level boundary catches everything but loses isolation — the whole app reverts to a fallback for any error. Multiple boundaries at strategic depths preserve as much working UI as possible.
**How to apply:**
- **App-shell boundary:** at the root (`main.tsx` / `main.ts`). Last line of defense.
- **Page-level boundary:** inside each page-template. A failing page doesn't blank the rest of the app.
- **Component-level boundary:** wrap third-party widgets, data-driven cards, or other risky regions.

```tsx
// good: nested boundaries preserve outer UI
<ErrorBoundary> {/* app-shell */}
  <Header />
  <ErrorBoundary> {/* page-level */}
    <ProductPage />
  </ErrorBoundary>
  <Footer />
</ErrorBoundary>

// bad: only an app-shell boundary — a ProductPage error blanks Header + Footer
<ErrorBoundary>
  <Header /><ProductPage /><Footer />
</ErrorBoundary>
```

## Rule: React boundaries must be class components
**Why:** `getDerivedStateFromError` and `componentDidCatch` are class lifecycle methods. As of React 19, function-component error boundaries do not exist (despite hooks elsewhere).
**How to apply:** Use a class. Wrap with a function component if needed for prop conveniences.

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { /* report */ }
  render() { return this.state.hasError ? <Fallback /> : this.props.children; }
}
```

## Rule: Vue boundaries use `errorCaptured` and `return false`
**Why:** `errorCaptured` is the official Vue 3 hook. Returning `false` halts propagation up the parent chain — without it, the same error fires for every ancestor with a hook.
**How to apply:**
```vue
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const error = ref<Error | null>(null);
onErrorCaptured((err) => {
  error.value = err as Error;
  return false; // halt propagation
});
</script>
```

## Rule: vanilla JS uses a render wrapper with safe DOM mutation
**Why:** No framework hooks, but you can still isolate render with `try/catch` around the render call. Do not write `innerHTML` with arbitrary strings — use safe DOM APIs (`textContent`, `createElement`, `replaceChildren`) so error messages can never inject markup.
**How to apply:**
```js
function renderWithErrorBoundary(renderFn) {
  try {
    renderFn();
  } catch (err) {
    console.error(err);
    document.body.replaceChildren();
    const heading = document.createElement('h1');
    heading.textContent = 'Something went wrong.';
    document.body.append(heading);
  }
}
```

(The plugin's frontend skills target React/Vue, so this is for completeness only.)

## Rule: classify boundary as molecule (with documented exception)
**Why:** A boundary composes one atom (the fallback UI) with one behavior (catch + report). That's a molecule by the methodology in `../../_shared/glossary.md`.
**Alternative classification:** some teams place boundaries at the organism layer because they wrap whole regions. Both are defensible. This plugin's convention is *molecule* because the boundary itself is small and reusable; the *organism* is the wrapped content, not the boundary.

## Rule: fallback UI is friendly + actionable
**Why:** "Something broke" with no recovery path frustrates users. A retry button (or a clear next action) recovers many transient errors.
**How to apply:**
- Friendly headline ("Something went wrong.")
- Brief explanation ("Please try again.")
- Action ("Try again" button calling a retry callback or `window.location.reload()`)
- Dev-only error detail (gated by `import.meta.env.DEV`) — never shown to users in prod.

## Rule: logging seam, not direct logging
**Why:** Logging providers come and go (Sentry, LogRocket, Datadog, Honeycomb). A `captureError` indirection means swapping providers is a one-file change, not a codebase-wide find-replace.
**How to apply:** Boundary calls `captureError(error, info)`. The function lives in `src/libs/error-reporter.ts` and currently logs to console. Future tracking-install skill (Tier 2) replaces the implementation.

## Anti-pattern: one mega-boundary at the root only

Already covered above. The user experience cost is real: a single error in a footer widget blanks the whole app instead of just the footer.

## Anti-pattern: boundaries that swallow without logging

```tsx
componentDidCatch() { /* do nothing — error vanishes */ }
```

Production errors that never reach a logger are invisible. Always call `captureError`.

## Anti-pattern: catching `null`/`undefined` access by adding boundaries

If you find yourself adding a boundary because "this component throws on missing data," fix the data layer instead. Boundaries are for unexpected errors, not for routing around missing-data branches.

## Testing the boundary itself

A boundary that's never been exercised is a boundary you can't trust. Test with a deliberately-throwing component:

```tsx
// in a Vitest test
function Bomb(): never { throw new Error('boom'); }

test('ErrorBoundary catches render-phase errors', () => {
  // expect the fallback to render and captureError to be called
});
```

## Logging integration roadmap

When the project adopts Sentry/LogRocket, replace `captureError`'s body:

```ts
import * as Sentry from '@sentry/react';

export function captureError(error: Error, context: ErrorContext = {}): void {
  Sentry.captureException(error, { contexts: { app: context } });
}
```

The boundaries don't change.

## When to deviate

- **Existing boundary library:** if the project already uses `react-error-boundary` (or a similar wrapper), adopt its API — the strategy is the same, the syntax differs. Don't introduce a parallel implementation.
- **Vue with an app-level error handler:** projects that registered `app.config.errorHandler` already have an app-shell-equivalent. Audit the handler before adding the molecule wrapper at the same depth; layered wraps fire twice unless the inner one returns `false`.
- **No page templates yet:** if the app has no `src/components/pages/` or templates yet, skip the page-level placement and revisit when structure is in place. The app-shell boundary alone is enough until then.
- **Library code (not an app):** boundaries belong in the consuming app, not in a published component library. Library code should let the consumer decide placement.
