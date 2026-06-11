# Stack Pointers

Reference for `build-landing-page`. The skill is framework-agnostic — these are the thin
"where does this live in your stack" notes, nothing more. Deep stack guidance belongs to
stack-specific plugins.

- **Next.js (App Router):** title/meta via the Metadata API; hero via `next/image` with
  the `preload` prop on the one LCP image (replaces the deprecated `priority` prop in
  Next 16); pages are server-rendered/ISR → crawlable by default. JSON-LD: a
  `<script type="application/ld+json">` in the page component.
- **Astro:** static-first → crawlable by default; hero via `<Image />`; content
  collections for content-driven pages.
- **Nuxt:** `useSeoMeta()` for metadata; `<NuxtImg>` for the hero; prerender public
  routes via Nitro (`routeRules: { '/': { prerender: true } }`).
- **Vite SPA:** the served HTML is an empty shell — the gate fails. Public pages need
  prerendering or a static host page; see `../set-up-seo/crawlability.md`. In-app head
  management is `skills/frontend/set-up-document-head`.
- **Plain HTML:** already crawlable; apply the grammar and budget directly.
