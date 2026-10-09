# Error Tracking

Reference for `configure-error-tracking`. The decisions behind a production-safe Sentry setup. Verified against `@sentry/react` / `@sentry/vue` 11.6 and `@sentry/vite-plugin` 5.4 on 2026-10-09 (types compiled, Vite 8 build run).

## Rule: wire the seam; only two files import Sentry
**Why:** If components call `Sentry.captureException`, swapping providers or disabling tracking is a find-and-replace across the app, and tests import Sentry everywhere. The `captureError` seam from `set-up-error-boundaries` is the single integration point.
**How to apply:** `src/libs/sentry.ts` (init) and `src/libs/error-reporter.ts` (capture) import the SDK; everything else calls `captureError`.

## Rule: set `dataCollection` explicitly; the v11 default collects more than v10
**Why:** Error tooling can leak personal data (form values, session replay, headers, cookies). Sentry 11 removed `sendDefaultPii` and replaced it with `dataCollection`; leaving it unset now collects user info, cookies, headers and request/response bodies by default (the v10 default was restrictive; [MIGRATION.md, "`sendDefaultPii` is replaced by `dataCollection`"](https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md)). A config copied from a v10 tutorial with `sendDefaultPii: false` fails to type-check, and one that is cast past the compiler silently collects more.
**How to apply:** `dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] }`; `replayIntegration({ maskAllText: true, blockAllMedia: true })` (these two are also Replay's defaults; writing them down keeps the intent visible). Attach a user *id* only, via `Sentry.setUser({ id })` after login, never email or name.

## Rule: sample in production, full in development
**Why:** 100% tracing and replay in production is costly and noisy; development wants everything, production wants a representative sample plus every error.
**How to apply:** `tracesSampleRate: PROD ? 0.1 : 1.0`; `replaysSessionSampleRate: PROD ? 0.1 : 0`; `replaysOnErrorSampleRate: 1.0` (always replay a session that errored). Tune to plan and traffic. Browser tracing only propagates `sentry-trace` headers to same-origin requests by default; add `tracePropagationTargets` for an API on another origin.

## Rule: upload hidden source maps, delete them, and emit them only when uploading
**Why:** Without maps, production stacks point at minified code. `sourcemap: 'hidden'` writes `.map` files but leaves out the `sourceMappingURL` comment; the files still sit in `dist/assets/` and are fetchable at a guessable URL unless removed (reproduced: a `hidden` build wrote `index-*.js.map` into `dist/assets/`). The plugin's `sourcemaps.filesToDeleteAfterUpload` removes them after upload. When no auth token is present (local builds, forks, PR previews) nothing uploads, so emitting maps there only ships them.
**How to apply:** `build.sourcemap: uploadMaps ? 'hidden' : false`, `sentryVitePlugin({ …, sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] }, disable: !uploadMaps })` with `uploadMaps = Boolean(process.env.SENTRY_AUTH_TOKEN)`. The token is **build-time only**, never `VITE_`-prefixed (that would put it in the bundle). The DSN is a public client key and may live in `.env`.

## Rule: tag every event with release and environment, and make the two release values one value
**Why:** "Is this from the latest deploy?" cannot be answered without a release. The plugin names the release it uploads maps under (by default from the environment or git); if the SDK sends a different `release`, the event finds no maps and stays minified.
**How to apply:** one `VITE_RELEASE` (git short SHA, set by CI) feeds `Sentry.init({ release })` through the `env` seam and `sentryVitePlugin({ release: { name } })`. `environment: import.meta.env.MODE`.

## Rule: no DSN, no init; keep errors visible in development
**Why:** Contributors without secrets must not crash or spam Sentry. But `captureException` with no client drops the event silently, so a console-only stub that becomes a Sentry-only body hides errors in development.
**How to apply:** `if (!env.VITE_SENTRY_DSN) return;` in `initSentry`, and `if (import.meta.env.DEV) console.error(...)` in `captureError`.

## Rule: do not report twice
**Why:** Sentry's default integrations already capture `window` `error` and `unhandledrejection` (and `@sentry/vue`'s `init({ app })` attaches an error handler). Keeping the boundary-skill's own global handlers as well sends each such error twice.
**How to apply:** delete `installGlobalErrorHandlers()` (and, in Vue, the `app.config.errorHandler` line) in the same change. Boundary-caught errors still go through `captureError`, because a boundary stops propagation and the SDK never sees them.

## When to deviate
- **Self-hosted or another provider** (GlitchTip, Highlight, Bugsnag, SigNoz): keep `captureError(error: unknown, context)` and change the body. SigNoz and other OpenTelemetry backends follow `../../core/_shared/observability.md`.
- **No replay budget:** drop `replayIntegration`; tracing and errors stay.
- **A small app that only needs to know it broke:** `Sentry.init({ dsn })` plus the `captureError` body is enough; skip tracing, replay and source maps until a minified stack is the problem.
- **A hosting platform that uploads maps itself:** let it, and drop the Vite plugin.
