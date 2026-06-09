# Document Head Patterns

Reference for `set-up-document-head`. The head is accessibility and SEO, not an afterthought.

## Rule: every route sets a title
**Why:** The `<title>` is the tab name, the bookmark name, the search-result heading — and, crucially, **screen readers announce it on navigation**. An SPA that never updates `document.title` leaves assistive-tech users with no signal that the page changed. This is an a11y bug, not just an SEO one.
**How to apply:** Set a default title at the root and override per route (`head` option in TanStack Router; `useHead` elsewhere). Format consistently: `Page — App`.

## Rule: derive dynamic titles from loaded data
**Why:** "Todo — MyApp" is useless across 100 todos; "Buy milk — MyApp" is a real, bookmarkable title.
**How to apply:** Read the route's loader data in `head: ({ loaderData }) => ...` (TanStack Router) or from the query cache via `useHead(() => ...)`. Guard the loading state with a sensible fallback title.

## Rule: set `<html lang>` and keep it truthful
**Why:** Screen readers choose pronunciation and voice from `lang`; the wrong (or missing) value makes content unintelligible. Search engines use it for language targeting.
**How to apply:** `<html lang="en">` in `index.html`. With i18n, update `document.documentElement.lang` whenever the locale changes (a one-liner in the locale switch).

## Rule: add Open Graph + canonical for shareable pages
**Why:** Without OG tags a shared link renders as a bare URL in Slack/social — looks broken, kills click-through. Duplicate URLs without a canonical split SEO signals.
**How to apply:** Per shareable route, set `og:title`/`og:description`/`og:image` (+ `twitter:card`) and `<link rel="canonical">`. Keep an OG image per major section.

## Rule: let the manager dedupe — don't clear tags by hand
**Why:** Manually removing/resetting head tags on navigation races with the framework and double-sets or drops tags.
**How to apply:** TanStack Router and Unhead both dedupe (deepest/last wins). Declare what each route needs and let them merge; never `document.head` surgery.

**Anti-example:**
```ts
// bad: imperative head surgery fights the manager and leaks tags between routes
document.querySelectorAll('meta[name="description"]').forEach((m) => m.remove());
document.title = title;
```

## Rule: know the SPA limit — JS-rendered head isn't crawled by everyone
**Why:** Head tags set by client JS appear only after the bundle runs. Googlebot renders JS, but many social scrapers and smaller crawlers don't — so OG previews and some indexing can miss client-only meta.
**How to apply:** For genuinely SEO/social-critical pages, prerender them (a build-time prerender plugin) or move to SSR/SSG. For an authenticated app behind a login, this rarely matters — client head is fine.

## When to deviate
- **App behind auth** (no public SEO): titles for a11y + tabs are what matter; skip OG/canonical and prerendering.
- **Marketing/content pages need SEO:** they likely want SSG/SSR (TanStack Start, Nuxt, Astro) rather than this SPA approach — head management alone won't make a client-rendered page reliably indexable.
