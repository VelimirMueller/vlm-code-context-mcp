# Analytics Patterns

Reference for `configure-analytics`. Measure what matters, respect the user.

## Rule: one analytics seam, provider-agnostic
**Why:** `trackEvent` calls importing a vendor SDK throughout the app make the provider impossible to swap and the calls impossible to stub in tests. The seam (`src/libs/analytics.ts`) is the single integration point — the same shape as `captureError`.
**How to apply:** Components/hooks call `trackEvent`/`trackPageView`; only the seam imports the SDK. Swapping Plausible → PostHog is one file.

## Rule: consent-gated by default; cookieless is a provider choice, not a consent exemption
**Why:** Two laws apply to a German or EU audience. GDPR requires a legal basis, transparency and processor terms for any personal data. § 25 TDDDG (the ePrivacy rule in German law) requires consent before storing or reading information on the user's device, whatever the tool is called. A cookieless tool may avoid § 25 and still needs the GDPR basis, and "cookieless" is a vendor claim: the npm Plausible tracker, for instance, reads a `localStorage` opt-out flag. The cost of asking is a banner; the cost of guessing wrong is a fine and a rebuild.
**How to apply:** `CONSENT_REQUIRED = true`: `initAnalytics` does nothing, and `transformRequest` drops every request, until `setConsent(true)`. `navigator.globalPrivacyControl` and `doNotTrack` always win. Withdrawal takes effect on the next request. Flip the constant to `false` only with a written legal/DPO decision for that product, and record it in the stack profile notes. Pick a cookieless provider anyway: less data, smaller breach surface.

**Anti-example:**
```ts
// bad: loads the vendor script at startup, "consent" checked later
import 'vendor-analytics'; // already sent a request
if (!consent) disable();
```

## Rule: page views carry the path, never the query string
**Why:** Query strings hold password-reset tokens, emails, search terms and order IDs. Sent to a third party they are personal data you never meant to share.
**How to apply:** `trackPageView(path)` strips `?` and `#`. Add an explicit allow-list (`utm_source`, `utm_medium`) if campaign attribution is needed; never forward the whole URL.

## Rule: never put PII in event properties
**Why:** Emails, names, or personal IDs in analytics props leak PII into a third party and turn an analytics tool into a privacy incident.
**How to apply:** Props are categorical/numeric (`plan: 'pro'`, `count: 3`), never identifying. Use the provider's pseudonymous id, not your user's email.

## Rule: feed Core Web Vitals in as real-user monitoring
**Why:** Lab metrics (Lighthouse on your machine) miss what real users on real devices/networks experience. RUM from `web-vitals` is the truth.
**How to apply:** `reportWebVitals(({ name, value }) => trackEvent('web-vital', { metric: name, value }))` in prod, through the same consent gate (field data about a person's device is analytics data). Watch the field LCP/INP/CLS distribution at the 75th percentile, not just the lab number; CLS reports from Chromium only.

## Rule: track a small, intentional event taxonomy
**Why:** Tracking everything ("button_clicked" ×500) produces noise no one analyzes and inflates cost. A handful of meaningful events answers real product questions.
**How to apply:** Name events for outcomes (`signup_completed`, `todo_created`, `checkout_started`), fire them at the moment of success (often a mutation `onSuccess`), and document the list. Add events when you have a question, not preemptively.

## Rule: no-op without configuration
**Why:** Local dev and contributors shouldn't send events or load a third-party script.
**How to apply:** `if (!import.meta.env.VITE_ANALYTICS_DOMAIN) return;` in `initAnalytics`, and `started` stays false. The `trackEvent`/`trackPageView` calls become safe no-ops.

## When to deviate
- **Product analytics needs:** if you need funnels, retention, or feature flags, PostHog (self-hostable) over a pageview-only tool — but review its consent/PII configuration; session replay in particular needs consent and masking of inputs.
- **Consent platform in place:** if the company runs a consent-management platform, call `setConsent` from its callback and keep the rest. The seam never builds its own banner.
- **Server-side measurement:** counting from server logs or an own backend endpoint involves no browser tracker; the GDPR basis still applies. Keep the seam's shape so call sites do not change.
- **Regulated/internal apps:** analytics may be disallowed entirely — keep the seam (it no-ops) so adding it later is one config change, and don't ship a tracker.
