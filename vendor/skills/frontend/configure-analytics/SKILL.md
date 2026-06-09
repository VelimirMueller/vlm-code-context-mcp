---
name: configure-analytics
description: Use when adding product + performance analytics to a frontend — creates one provider-agnostic analytics seam (trackEvent/trackPageView, like the captureError seam), wires Core Web Vitals as real-user monitoring, fires page views on route change, and stays privacy-first (cookieless default, consent-gated, no PII). No-ops without config.
---

# Configure Analytics

## 1. Audit current state

```bash
grep -E '"(plausible-tracker|posthog-js|@vercel/analytics|web-vitals)"' package.json 2>/dev/null
ls src/libs/analytics.ts 2>/dev/null
```

**Prerequisites:** `optimize-performance` (we forward its `web-vitals`) and `set-up-routing` (page views fire on route change).

## 2. Decide what to do
- No analytics → full setup (seam + vitals + page views).
- Analytics calls scattered in components → centralize behind the seam (step 5).

## 3. Choose a provider (privacy-first default)
- **Cookieless** (Plausible, Fathom): no banner needed in most jurisdictions, no PII, tiny script. **Default.**
- **Product analytics** (PostHog): funnels/feature-flags/session — richer, but review its privacy/consent settings.
- Avoid cookie-based GA unless you already run a consent banner.

## 4. Install
```bash
pnpm add plausible-tracker   # or posthog-js, @vercel/analytics — the seam hides the choice
```

## 5. The analytics seam (provider-agnostic, no-op without config)

One module owns analytics — swapping providers is a one-file change, exactly like `captureError`.

```ts
// src/libs/analytics.ts
import Plausible from 'plausible-tracker';

type Props = Record<string, string | number | boolean>;

let api: ReturnType<typeof Plausible> | null = null;

export function initAnalytics() {
  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN;
  if (!domain || !hasConsent()) return; // no-op locally / without consent
  api = Plausible({ domain });
  api.enableAutoPageviews?.(); // or fire manually via trackPageView
}

export function trackEvent(name: string, props?: Props) {
  api?.trackEvent(name, props ? { props } : undefined);
}

export function trackPageView(url: string) {
  api?.trackPageview({ url });
}

const REQUIRES_CONSENT = false; // Plausible/Fathom (cookieless): false. GA/PostHog (cookies): true.

function hasConsent(): boolean {
  if (!REQUIRES_CONSENT) return true; // cookieless provider — no banner needed
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return false;
  return localStorage.getItem('analytics-consent') === 'granted';
}

// call from your cookie banner: (re)inits analytics on grant; gate Sentry replay the same way
export function setConsent(granted: boolean): void {
  localStorage.setItem('analytics-consent', granted ? 'granted' : 'denied');
  if (granted) initAnalytics();
}
```

Call `initAnalytics()` once from the app entry.

## 6. Wire Core Web Vitals as real-user monitoring

Feed the `reportWebVitals` from `optimize-performance` into the seam:
```ts
// app entry, prod only
import { reportWebVitals } from '@/libs/reportWebVitals';
import { trackEvent } from '@/libs/analytics';

if (import.meta.env.PROD) {
  reportWebVitals(({ name, value }) =>
    trackEvent('web-vital', { metric: name, value: Math.round(name === 'CLS' ? value * 1000 : value) }),
  );
}
```
Now LCP/INP/CLS are measured on **real users**, not just your Lighthouse run.

## 7. Page views on route change

```ts
// React (TanStack Router)
router.subscribe('onResolved', ({ toLocation }) => trackPageView(toLocation.href));
// Vue Router
router.afterEach((to) => trackPageView(to.fullPath));
```
(Skip if you used the provider's `enableAutoPageviews`.)

## 8. Track meaningful events, not everything

Define a small taxonomy (`signup_completed`, `todo_created`, `checkout_started`) and call `trackEvent` at those moments — typically inside the mutation `onSuccess`. Never put PII (email, name, IDs that identify a person) in props.

## 9. Verify
```bash
pnpm build && pnpm preview
```
With `VITE_ANALYTICS_DOMAIN` set: navigating fires page views, a web-vital event arrives, and a sample `trackEvent` shows in the provider dashboard. Without it set: nothing loads, app unaffected.

## References
- ./analytics-patterns.md — the seam, privacy/consent, no-PII, web-vitals RUM, event taxonomy, no-op-without-config.
- ../optimize-performance/SKILL.md — the `reportWebVitals` source.
- ../configure-error-tracking/SKILL.md — the sibling seam pattern.
