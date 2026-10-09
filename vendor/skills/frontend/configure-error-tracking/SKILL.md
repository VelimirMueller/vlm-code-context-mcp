---
name: configure-error-tracking
description: Use when wiring production error tracking - points the captureError seam at Sentry (tracing, masked replay, explicit data collection), uploads hidden source maps with the Vite plugin, tags release and environment; no-op without a DSN.
---

# Configure Error Tracking

## 1. Audit current state

```bash
grep -E '"(@sentry/react|@sentry/vue|@sentry/vite-plugin)"' package.json 2>/dev/null
ls src/libs/error-reporter.ts src/libs/sentry.ts .claude/stack-profile.md 2>/dev/null
grep -rn "VITE_SENTRY_DSN\|VITE_RELEASE" src/ .env* 2>/dev/null | head
```

Read `.claude/stack-profile.md` if present: `observability.backend` other than `sentry` (e.g. `signoz`, `grafana-lgtm`) means this skill does not apply; keep the console stub and follow `../../core/_shared/observability.md`. `frontend.framework` picks the SDK; `package_manager` replaces `pnpm`.

**Prerequisite:** `set-up-error-boundaries` created `src/libs/error-reporter.ts` with `captureError`. This skill swaps that function's body from a console stub to Sentry: a **one-file change**, which is what the seam is for. No seam, no Sentry: run that skill first.

## 2. Decide what to do
- No Sentry → full setup (steps 4–8).
- Sentry present but `captureError` still logs to the console → wire the seam (step 6).
- Wired but no source-map upload → add the Vite plugin (step 7).
- Sentry on v10 config (`sendDefaultPii`) after an upgrade to 11 → replace it with `dataCollection` (step 5): v11 collects more by default.

## 3. Detect framework
React → `@sentry/react`. Vue → `@sentry/vue` (init takes the `app` instance).

## 4. Install
```bash
pnpm add @sentry/react          # Vue: @sentry/vue
pnpm add -D @sentry/vite-plugin
```
Both 11.x / 5.x as of 2026-10-09 (`../_shared/stack-versions.md`).

## 5. Initialize Sentry (no-op without a DSN)

Add two optional keys to the `validate-env` schema (`VITE_SENTRY_DSN` is already there; add `VITE_RELEASE: z.preprocess(blankToUndefined, z.string().min(1).optional())`).

```ts
// src/libs/sentry.ts (React)
import * as Sentry from '@sentry/react';
import { env } from '@/libs/env';

export function initSentry(): void {
  if (!env.VITE_SENTRY_DSN) return; // no DSN: do nothing (local dev, forks, tests)

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: env.VITE_RELEASE, // the same value the Vite plugin uploads maps under
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    // v11 collects cookies, headers, bodies and user info unless told not to; opt out explicitly.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
  });
}
```

Call it **before** rendering, first thing in the entry (`src/main.tsx`): `import { initSentry } from '@/libs/sentry'; initSentry();`, and **delete** `installGlobalErrorHandlers()`: the SDK installs its own `window` handlers by default, and keeping both reports twice.

Vue: the same file with `import * as Sentry from '@sentry/vue'`, `import type { App } from 'vue'`, `export function initSentry(app: App)` and `app,` as the first `Sentry.init` option. In `main.ts`: `const app = createApp(App); initSentry(app);`, and **delete** the `app.config.errorHandler` line and `installGlobalErrorHandlers()`: `init({ app })` attaches Sentry's own error handler.

`dataCollection` matters: Sentry 11 replaced `sendDefaultPii` (a type error now) with `dataCollection`, and its defaults collect user info, cookies, headers and request/response bodies. The line above restores the restrictive v10 behaviour for a browser SPA (`error-tracking.md`).

## 6. Wire the `captureError` seam

Replace the stub body; the boundaries and every other caller stay unchanged:
```ts
// src/libs/error-reporter.ts
import * as Sentry from '@sentry/react'; // Vue: '@sentry/vue'

export type ErrorContext = {
  componentStack?: string | undefined;
  url?: string | undefined;
  user?: { id: string } | undefined;
};

export function captureError(error: unknown, context: ErrorContext = {}): void {
  // Without a DSN Sentry drops the event silently; keep the error visible in development.
  if (import.meta.env.DEV) console.error('[captureError]', error, context);
  Sentry.captureException(error, { contexts: { app: context } });
}
```
Remove `installGlobalErrorHandlers` from the file once its call is gone (step 5).

## 7. Upload source maps

```ts
// vite.config.ts
import { sentryVitePlugin } from '@sentry/vite-plugin';

const uploadMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig({
  // Hidden maps are written but not referenced by the bundle; without an upload they would
  // sit in dist/ and ship, so emit them only when the plugin will upload and delete them.
  build: { sourcemap: uploadMaps ? 'hidden' : false },
  plugins: [
    // ...react(), tailwindcss(), etc.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN, // build-time secret: never VITE_-prefixed
      release: { name: process.env.VITE_RELEASE }, // must equal the SDK's `release`
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      disable: !uploadMaps,
    }),
  ],
});
```

## 8. Environment

```bash
# .env (the DSN is a public client key, safe to commit): VITE_SENTRY_DSN=https://<key>@o0.ingest.sentry.io/0
# CI only, no VITE_ prefix:  SENTRY_ORG  SENTRY_PROJECT  SENTRY_AUTH_TOKEN
# CI build step:             VITE_RELEASE=$(git rev-parse --short HEAD) pnpm build
```

## 9. Verify
```bash
pnpm typecheck
VITE_RELEASE=test pnpm build          # no token: builds, no .map files in dist/, plugin disabled
SENTRY_AUTH_TOKEN=… VITE_RELEASE=… pnpm build   # in CI: uploads, then dist/ holds no .map files
find dist -name '*.map' | wc -l       # expect 0 in both cases
```
Trigger a test error (a throw inside an `ErrorBoundary`) in a DSN-configured build and confirm it lands in Sentry de-minified, with the release and environment tags and no cookies or request headers on the event.

## References
- ./error-tracking.md — data collection, sampling, source-map handling, release tagging, no-op without a DSN, provider swap.
- ../set-up-error-boundaries/SKILL.md — the `captureError` seam this wires.
- ../_shared/stack-versions.md — Sentry SDK and plugin lines.
- ../_shared/conventions.md — `libs/` seam location.
