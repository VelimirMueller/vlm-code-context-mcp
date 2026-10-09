---
name: set-up-document-head
description: Use when managing the document head of a frontend SPA — per-route title, meta, Open Graph, and canonical tags via TanStack Router's head option (React) or Unhead (@unhead/vue / @unhead/react), plus a correct html lang. Improves accessibility (titles announced on navigation) and SEO/social previews.
---

# Set Up Document Head

## 1. Audit current state

```bash
cat .claude/stack-profile.md 2>/dev/null || cat ~/.claude/stack-profile.md 2>/dev/null   # frontend.framework, frontend.meta, package_manager
grep -rn "<title>\|useHead\|head:\|HeadContent\|document.title" src/ index.html 2>/dev/null | head
grep -n "<html" index.html 2>/dev/null
```

Read `frontend.meta`: `nuxt` (`useHead` / `useSeoMeta`) and `next` (`metadata` API) own the head — stop and use theirs. Commands use pnpm; translate for `package_manager`. Check whether routes set titles, whether `<html lang>` is set, and whether OG/canonical exist. **Prerequisite:** ideally `set-up-routing` (per-route head); pairs with `set-up-i18n` (sync `lang` to the active locale).

## 2. Decide what to do
- No head management → full setup.
- Static `<title>` only → add per-route titles + meta.
- Per-route titles but no OG/canonical → add social/SEO tags (step 7).

## 3. Detect framework / router
React + TanStack Router → its built-in `head` route option (no extra dep). React without it → `@unhead/react`. Vue → `@unhead/vue`.

## 4. React + TanStack Router (built-in `head`)

Render the head, set defaults at the root, and override per route. Update the root route to render `<HeadContent />`:
```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router';

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'MyApp' }, // default; routes override
    ],
  }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
});
```

Per-route, with a **dynamic title from loaded data** (the router dedupes, preferring the deepest route):
```tsx
// src/routes/todos.$id.tsx
export const Route = createFileRoute('/todos/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: queryKeys.todos.detail(params.id),
      queryFn: () => fetcher<Todo>(`/todos/${params.id}`),
    }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.text} — MyApp` : 'Todo — MyApp' },
      { name: 'description', content: loaderData?.text ?? 'Todo details' },
    ],
  }),
});
```

## 5. React without TanStack Router → Unhead

```bash
pnpm add @unhead/react
```
Unhead 3 needs React ≥ 19.2.4 and Vite ≥ 6.4.2 (its peers). Create one head and wrap the app in `<UnheadProvider>`; `createHead` comes from the `/client` entry:
```tsx
// src/main.tsx
import { createHead, UnheadProvider } from '@unhead/react/client';

const head = createHead();
// render: <UnheadProvider value={head}><App /></UnheadProvider>
```
Then in any component:
```tsx
import { useHead } from '@unhead/react';
useHead({ title: 'Dashboard — MyApp', meta: [{ name: 'description', content: '…' }] });
```

## 6. Vue → Unhead

```bash
pnpm add @unhead/vue
```
```ts
// src/main.ts
import { createHead } from '@unhead/vue/client';
app.use(createHead());
```
```vue
<script setup lang="ts">
import { useHead } from '@unhead/vue';
useHead({ title: 'Dashboard — MyApp', meta: [{ name: 'description', content: '…' }] });
</script>
```
Reactive sources (a `ref`/`computed`) update the head automatically.

## 7. `<html lang>`, Open Graph, canonical

- **`<html lang>`** in `index.html` (`<html lang="en">`). With `set-up-i18n`, sync it to the active locale: `document.documentElement.lang = locale` on change. This is an a11y requirement (screen readers pick voice/pronunciation from it).
- **Open Graph / Twitter** for shareable pages: `og:title`, `og:description`, `og:image`, `twitter:card`. Set per route alongside the title.
- **Canonical** (`<link rel="canonical">`) on pages reachable by multiple URLs. TanStack Router: `head: () => ({ links: [{ rel: 'canonical', href: 'https://example.com/todos' }] })`. Unhead: `useHead({ link: [{ rel: 'canonical', href }] })`. Use the absolute production URL, never the preview host.

## 8. Verify
```bash
pnpm dev
```
Navigate: the tab title and `<title>` change per route (a screen reader announces the new title); view-source/inspect shows the right meta. Share a URL → the OG preview is correct.

**SPA caveat:** client-rendered head tags are applied after JS runs, so non-JS crawlers/scrapers may miss them. For SEO/social-critical pages, prerender or SSR — and use the landing catalogue, which owns discoverability: `../../landing/set-up-seo/SKILL.md` (see also `head-patterns.md`).

## References
- ./head-patterns.md — per-route titles (a11y + SEO), dynamic titles, html lang + locale, OG/canonical, dedupe, the SPA prerender caveat.
- ../set-up-routing/SKILL.md — the `head` route option / loader data.
- ../set-up-i18n/SKILL.md — syncing `lang` to the locale.
- ../../landing/set-up-seo/SKILL.md — discoverability for public pages (crawlability, structured data, sitemap); this skill only manages the in-app head.
