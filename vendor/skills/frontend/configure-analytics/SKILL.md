---
name: configure-analytics
description: Use when adding analytics to a frontend — one provider-agnostic seam (trackEvent/trackPageView), Core Web Vitals as real-user data, consent-gated by default (GDPR/TDDDG), path-only page views, no PII, no-op without config.
---

# Configure Analytics

## 1. Audit current state

```bash
cat .claude/stack-profile.md 2>/dev/null || cat ~/.claude/stack-profile.md 2>/dev/null   # frontend.framework, frontend.meta, observability, package_manager
grep -E '"(@plausible-analytics/tracker|plausible-tracker|posthog-js|@vercel/analytics|web-vitals)"' package.json 2>/dev/null
ls src/libs/analytics.ts 2>/dev/null
```

Read `frontend.framework` (router hook in step 7) and `package_manager` (commands use pnpm); `observability.backend` is for errors and traces, not product analytics — keep them separate. **Prerequisites:** `optimize-performance` (we forward its `web-vitals`) and `set-up-routing` (page views fire on route change).

## 2. Decide what to do
- No analytics → full setup (seam + vitals + page views).
- Analytics calls scattered in components → centralize behind the seam (step 5).

## 3. Choose a provider, and decide consent first
- **Consent decides the code, not the provider.** The seam sends nothing until the user opts in (`CONSENT_REQUIRED = true`). This is the default for any EU/German audience: GDPR needs a legal basis and transparency, and § 25 TDDDG requires consent for any read or write on the user's device. A cookieless tool can fall outside § 25 and still needs a documented basis; the npm Plausible tracker, for one, reads `localStorage.plausible_ignore`. Set `CONSENT_REQUIRED = false` only with a written legal/DPO decision for that product.
- **Cookieless** (Plausible, Fathom): no cookies, no personal profile, tiny script. **Default provider.**
- **Product analytics** (PostHog): funnels and session replay are richer and need consent plus a data-processing agreement; review its privacy settings.
- Avoid cookie-based GA unless a consent banner already exists.
Why: `analytics-patterns.md`.

## 4. Install
```bash
pnpm add @plausible-analytics/tracker   # or posthog-js, @vercel/analytics — the seam hides the choice
```
(`plausible-tracker`, the older package, was last released in 2022 and its API differs; use the `@plausible-analytics/tracker` package.)

## 5. The analytics seam (provider-agnostic, no-op without config or consent)

One module owns analytics — swapping providers is a one-file change, exactly like `captureError`. Checked against `@plausible-analytics/tracker` 0.4 (`init` runs once; `track(name, { props })` takes string props).

```ts
// src/libs/analytics.ts
import { init, track } from '@plausible-analytics/tracker';

type Props = Record<string, string | number | boolean>;

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean; // not in lib.dom yet
  }
}

/** true = nothing is sent before an explicit opt-in. Flip only with a written legal/DPO decision. */
const CONSENT_REQUIRED = true;
const CONSENT_KEY = 'analytics-consent';
let started = false;

function consentGranted(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false; // storage blocked: treat as no consent
  }
}

/** Evaluated on every request, so withdrawing consent stops sending at once. */
function mayTrack(): boolean {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return false;
  return !CONSENT_REQUIRED || consentGranted();
}

export function initAnalytics(): void {
  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN;
  if (!domain || started || !mayTrack()) return; // no config, already running, or no consent: no-op
  init({
    domain,
    autoCapturePageviews: false, // page views come from the router (step 7), the same for any provider
    transformRequest: (payload) => (mayTrack() ? payload : null),
  });
  started = true;
}

export function trackEvent(name: string, props?: Props): void {
  if (!started || !mayTrack()) return; // mayTrack here too: after withdrawal the seam stops preparing payloads, not just the request
  // Plausible custom properties are strings.
  const stringProps = props && Object.fromEntries(Object.entries(props).map(([k, v]) => [k, String(v)]));
  track(name, stringProps ? { props: stringProps } : {});
}

export function trackPageView(path: string): void {
  // Path only: query strings carry tokens, emails and search terms. The full URL keeps the origin — in a
  // local/preview run that is localhost:PORT, so do not set VITE_ANALYTICS_DOMAIN with consent granted there.
  if (started && mayTrack()) track('pageview', { url: `${location.origin}${path.split(/[?#]/)[0]}` });
}

/** Call from the consent banner (the banner itself is outside this skill). */
export function setConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
  if (granted) {
    const wasStarted = started;
    initAnalytics();
    // The router hook (step 7) fires on the first load too; only fire here when consent is what started the seam.
    if (!wasStarted) trackPageView(location.pathname);
  }
}
```

Call `initAnalytics()` once from the app entry. Gate any other third-party script the same way (Sentry replay, chat widgets): call it from `setConsent`, never at load. Add `VITE_ANALYTICS_DOMAIN` and the tracker's endpoint to the CSP `connect-src` (`set-up-security-headers`); proxy the endpoint through your own domain if ad blockers matter.

## 6. Wire Core Web Vitals as real-user monitoring

Feed the `reportWebVitals` from `optimize-performance` into the seam:
```ts
// app entry, prod only
import { reportWebVitals } from '@/libs/reportWebVitals';
import { trackEvent } from '@/libs/analytics';

if (import.meta.env.PROD) {
  reportWebVitals(({ name, value }) =>
    trackEvent('web-vital', { metric: name, value: Math.round(name === 'CLS' ? value * 1000 : value) }), // CLS ×1000: rounding a 0.0x score to an integer would erase it
  );
}
```
Now LCP/INP/CLS are measured on **real users**, not just your Lighthouse run. They go through the same seam, so they obey the same consent gate: no consent, no field data. (CLS reports only from Chromium.)

## 7. Page views on route change

```ts
// React (TanStack Router) — fires on the first load too
router.subscribe('onResolved', ({ toLocation }) => trackPageView(toLocation.pathname));
// Vue Router
router.afterEach((to) => trackPageView(to.path));
```
The seam passes the path only, so the router hook never leaks a query string. (A tracker's own SPA auto-capture would double count; step 5 turns it off.)

## 8. Track meaningful events, not everything

Define a small taxonomy (`signup_completed`, `todo_created`, `checkout_started`) and call `trackEvent` at those moments — typically inside the mutation `onSuccess`. Never put PII (email, name, IDs that identify a person) in props.

## 9. Verify
```bash
pnpm build && pnpm preview
```
With `VITE_ANALYTICS_DOMAIN` set **and consent granted**: navigating fires page views, a web-vital event arrives, and a sample `trackEvent` shows in the provider dashboard. Network tab before consent: no request to the provider. After `setConsent(false)`: no further requests. Without the env var: nothing loads, app unaffected.

## References
- ./analytics-patterns.md — the seam, consent (GDPR/TDDDG), no-PII, web-vitals RUM, event taxonomy, no-op-without-config.
- ../optimize-performance/SKILL.md — the `reportWebVitals` source.
- ../configure-error-tracking/SKILL.md — the sibling seam pattern.
