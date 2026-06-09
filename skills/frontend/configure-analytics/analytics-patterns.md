# Analytics Patterns

Reference for `configure-analytics`. Measure what matters, respect the user.

## Rule: one analytics seam, provider-agnostic
**Why:** `trackEvent` calls importing a vendor SDK throughout the app make the provider impossible to swap and the calls impossible to stub in tests. The seam (`src/libs/analytics.ts`) is the single integration point — the same shape as `captureError`.
**How to apply:** Components/hooks call `trackEvent`/`trackPageView`; only the seam imports the SDK. Swapping Plausible → PostHog is one file.

## Rule: privacy-first — cookieless by default, consent-gated otherwise
**Why:** Cookie-based analytics (GA) legally require a consent banner in much of the world and degrade trust. Cookieless providers (Plausible, Fathom) collect no personal data and usually need no banner.
**How to apply:** Default to a cookieless provider. If you must use a cookie-based one, gate `initAnalytics` behind explicit consent and honor `navigator.doNotTrack`. The seam's `hasConsent()` is that gate.

## Rule: never put PII in event properties
**Why:** Emails, names, or personal IDs in analytics props leak PII into a third party and turn an analytics tool into a privacy incident.
**How to apply:** Props are categorical/numeric (`plan: 'pro'`, `count: 3`), never identifying. Use the provider's pseudonymous id, not your user's email.

## Rule: feed Core Web Vitals in as real-user monitoring
**Why:** Lab metrics (Lighthouse on your machine) miss what real users on real devices/networks experience. RUM from `web-vitals` is the truth.
**How to apply:** `reportWebVitals(({ name, value }) => trackEvent('web-vital', { metric: name, value }))` in prod. Watch the field LCP/INP/CLS distribution, not just the lab number.

## Rule: track a small, intentional event taxonomy
**Why:** Tracking everything ("button_clicked" ×500) produces noise no one analyzes and inflates cost. A handful of meaningful events answers real product questions.
**How to apply:** Name events for outcomes (`signup_completed`, `todo_created`, `checkout_started`), fire them at the moment of success (often a mutation `onSuccess`), and document the list. Add events when you have a question, not preemptively.

## Rule: no-op without configuration
**Why:** Local dev and contributors shouldn't send events or load a third-party script.
**How to apply:** `if (!import.meta.env.VITE_ANALYTICS_DOMAIN) return;` in `initAnalytics`. The `trackEvent`/`trackPageView` calls become safe no-ops.

## When to deviate
- **Product analytics needs:** if you need funnels, retention, or feature flags, PostHog (self-hostable) over a pageview-only tool — but review its consent/PII configuration.
- **Regulated/internal apps:** analytics may be disallowed entirely — keep the seam (it no-ops) so adding it later is one config change, and don't ship a tracker.
