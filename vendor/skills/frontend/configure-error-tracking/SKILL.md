---
name: configure-error-tracking
description: Use when wiring production error tracking — points the existing captureError seam at Sentry (init with tracing + masked session replay, sampled in prod), uploads hidden source maps via @sentry/vite-plugin, and tags release + environment. No-ops without a DSN so local dev is unaffected.
---

# Configure Error Tracking

## 1. Audit current state

```bash
grep -E '"(@sentry/react|@sentry/vue|@sentry/vite-plugin)"' package.json 2>/dev/null
ls src/libs/error-reporter.ts 2>/dev/null   # the captureError seam from set-up-error-boundaries
grep -rn "VITE_SENTRY_DSN" . 2>/dev/null | head
```

**Prerequisite:** `set-up-error-boundaries` created `src/libs/error-reporter.ts` exporting `captureError`. This skill swaps that function's body from a console stub to Sentry — a **one-file change**, exactly what the seam was for. If the seam doesn't exist, run that skill first.

## 2. Decide what to do
- No Sentry → full setup (steps 4–8).
- Sentry present but `captureError` still logs to console → wire the seam (step 6).
- Wired but no source-map upload → add the Vite plugin (step 7).

## 3. Detect framework
React → `@sentry/react`. Vue → `@sentry/vue` (init takes the `app` instance).

## 4. Install
```bash
pnpm add @sentry/react          # Vue: @sentry/vue
pnpm add -D @sentry/vite-plugin
```

## 5. Initialize Sentry (no-op without a DSN)

```ts
// src/libs/sentry.ts (React)
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // local/dev without a DSN — do nothing

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE, // set in CI to the git SHA / tag
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  });
}
```

Call it **before** rendering, in the entry:
```ts
// src/main.tsx — first line of the entry
import { initSentry } from '@/libs/sentry';
initSentry();
```
Vue: `Sentry.init({ app, dsn, integrations: [...] })` — pass the `createApp(App)` instance, then `app.mount('#app')`.

## 6. Wire the `captureError` seam

Replace the stub body — the boundaries and any other caller stay unchanged:
```ts
// src/libs/error-reporter.ts
import * as Sentry from '@sentry/react';

type ErrorContext = { componentStack?: string; url?: string; user?: { id: string } };

export function captureError(error: Error, context: ErrorContext = {}): void {
  Sentry.captureException(error, { contexts: { app: context } });
}
```

(Vue: identical body — only change the import to `import * as Sentry from '@sentry/vue'`.)

## 7. Upload source maps (so stack traces are readable)

```ts
// vite.config.ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: { sourcemap: 'hidden' }, // generate maps, don't reference them in the bundle
  plugins: [
    // ...react(), tailwindcss(), etc.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN, // build-time secret — NEVER VITE_-prefixed
    }),
  ],
});
```

## 8. Environment

```bash
# .env (committed-safe): the DSN is a public client key
VITE_SENTRY_DSN=https://...@o0.ingest.sentry.io/0
# CI secrets (never client-exposed, no VITE_ prefix):
SENTRY_ORG=... SENTRY_PROJECT=... SENTRY_AUTH_TOKEN=...
```

## 9. Verify
```bash
pnpm build   # the Vite plugin uploads source maps + creates a release
```
Trigger a test error (an ErrorBoundary catch) in a DSN-configured build and confirm it lands in Sentry, de-minified, tagged with the release + environment.

## References
- ./error-tracking.md — sampling, privacy/PII, source-map secrecy, release tagging, no-op-without-DSN, provider-swap via the seam.
- ../set-up-error-boundaries/SKILL.md — the `captureError` seam this wires.
- ../_shared/conventions.md — `libs/` seam location.
