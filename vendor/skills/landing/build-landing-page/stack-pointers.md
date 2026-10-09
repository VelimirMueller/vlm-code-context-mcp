# Stack Pointers

Reference for `build-landing-page`. The skill is framework-agnostic — these are the thin
"where does this live in your stack" notes, nothing more. Deep stack guidance belongs to
stack-specific plugins.

Only the Next.js 16.4 line below was verified (2026-10-09); the other frameworks' lines are
unverified — check the framework's current docs before copying an API name.

- **Next.js 16 (App Router):** title/meta via the Metadata API; hero via `next/image` on the one LCP image.
  `priority` is deprecated since Next 16; the docs now say prefer `fetchPriority="high"`
  or `loading="eager"` and use `preload` only when the image must be preloaded from
  `<head>` before the body is parsed (nextjs.org/docs, v16.4, verified 2026-10-09); pages are server-rendered → crawlable by default. New 16.4 apps have Cache
  Components on: mark static marketing pages `'use cache'` so the shell prerenders. Put
  public pages in a `(marketing)` route group with their own layout. JSON-LD: a
  `<script type="application/ld+json">` in the page component.
- **Astro:** static-first → crawlable by default; hero via `<Image />`; content
  collections for content-driven pages.
- **Nuxt 4:** pages live in `app/pages/`; `useSeoMeta()` for metadata; `<NuxtImg>` for
  the hero; prerender public routes via Nitro (`routeRules: { '/': { prerender: true } }`).
  Section components belong in `app/components/organisms/` or a feature folder, the same
  layout as the SPA (`skills/frontend/set-up-frontend-structure/folder-conventions.md`).
- **Vite SPA:** the served HTML is an empty shell — the gate fails. Public pages need
  prerendering or a static host page; see `../set-up-seo/crawlability.md`. In-app head
  management is `skills/frontend/set-up-document-head`.
- **Plain HTML:** already crawlable; apply the grammar and budget directly.

## When to deviate
Pointers rot faster than the rules. If a line here contradicts the framework's current
docs, the docs win — and fix the line.
