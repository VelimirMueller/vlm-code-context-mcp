# Error Tracking

Reference for `configure-error-tracking`. The decisions behind a production-safe Sentry setup.

## Rule: wire the seam, don't scatter Sentry calls
**Why:** If components call `Sentry.captureException` directly, swapping providers (or disabling tracking) is a codebase-wide find-replace, and tests import Sentry everywhere. The `captureError` seam from `set-up-error-boundaries` is the single integration point.
**How to apply:** Only `src/libs/error-reporter.ts` imports Sentry. Everything else calls `captureError`. Provider change = one file.

## Rule: sample in production, full in development
**Why:** 100% tracing/replay in prod is expensive and noisy. Dev wants everything; prod wants a representative sample plus every error.
**How to apply:** `tracesSampleRate: PROD ? 0.1 : 1.0`; `replaysSessionSampleRate: 0.1` but `replaysOnErrorSampleRate: 1.0` (always replay sessions that errored). Tune to plan/volume.

## Rule: privacy by default
**Why:** Error tooling can leak PII (form values, emails, session replay video).
**How to apply:** `sendDefaultPii: false`; `replayIntegration({ maskAllText: true, blockAllMedia: true })`. Attach a user *id* only (not email/name) when you have one, via `Sentry.setUser({ id })` after login.

## Rule: upload hidden source maps; the auth token is a build secret
**Why:** Without source maps, prod stack traces point at minified gibberish. `"hidden"` generates maps and uploads them to Sentry without exposing a `//# sourceMappingURL` to the public bundle.
**How to apply:** `build.sourcemap: 'hidden'` + `@sentry/vite-plugin`. `SENTRY_AUTH_TOKEN` is **build-time only** — never `VITE_`-prefixed (that would ship it to the browser). The DSN, by contrast, is a public client key and is fine in `.env`.

## Rule: tag every event with release + environment
**Why:** "Is this error from the latest deploy?" is unanswerable without a release. Environment separates prod noise from staging.
**How to apply:** `release` = git SHA/tag (set `VITE_RELEASE` in CI); `environment: import.meta.env.MODE`. The Vite plugin creates the matching release on upload.

## Rule: no DSN → no-op
**Why:** Local dev and contributors without secrets shouldn't crash or spam Sentry.
**How to apply:** `if (!dsn) return;` in `initSentry`. The seam still works (console in dev via the boundary's own logging if you keep a fallback), the app is unaffected.

## When to deviate
- **Self-hosted / other provider** (GlitchTip, Highlight, Bugsnag): the seam makes this a one-file swap — keep the `captureError(error, context)` signature, change the body.
- **No replay budget:** drop `replayIntegration` and keep just tracing + errors.
