---
name: set-up-pwa
description: Use when making a frontend installable and offline-capable — sets up vite-plugin-pwa (service worker precaching the app shell, web manifest, auto-update), and optionally persists the TanStack Query cache so cached data is available offline, keeping the SW out of API caching.
---

# Set Up PWA

## 1. Audit current state

```bash
grep -E '"(vite-plugin-pwa|@tanstack/react-query-persist-client|@tanstack/query-sync-storage-persister)"' package.json 2>/dev/null
ls public/manifest.webmanifest public/icon-*.png 2>/dev/null
```

**Prerequisites:** `scaffold-frontend-project` (Vite). For offline *data*, `set-up-state-management` (we persist its query cache, not SW-cache the API).

## 2. Decide what to do
- No PWA → full setup (installable + offline shell).
- Installable but no offline data → add query persistence (step 7) if the app should read offline.

## 3. Detect framework
`vite-plugin-pwa` is framework-agnostic. The query-persistence step differs (React `PersistQueryClientProvider`; Vue plugin).

## 4. Install
```bash
pnpm add -D vite-plugin-pwa
```

## 5. Configure the plugin

```ts
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    // ...react()/vue(), tailwindcss(), etc.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'My App',
        short_name: 'App',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], // precache the shell + static assets
      },
      devOptions: { enabled: false }, // turn on only to debug the SW in dev
    }),
  ],
});
```

## 6. Precache the shell — don't SW-cache the API

The service worker precaches the **app shell** (JS/CSS/HTML/fonts/icons) so the app boots offline. Deliberately **do not** add Workbox runtime caching for your API: TanStack Query already owns server data, and a second cache (the SW) competing with the query cache causes stale/confusing reads. Server data offline = query persistence (next step).

## 7. Offline data via TanStack Query persistence (optional)

```bash
pnpm add @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister
```
```tsx
// React: replace QueryClientProvider with the persisting variant near the root
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from '@/libs/queryClient';

const persister = createSyncStoragePersister({ storage: window.localStorage });

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }} // 24h
>
  <App />
</PersistQueryClientProvider>
```
Set the query client's `gcTime` ≥ `maxAge` (see `set-up-state-management`) so persisted entries aren't garbage-collected first. Vue: the `@tanstack/vue-query` persister plugin.

## 8. Update flow

`registerType: 'autoUpdate'` ships new versions silently on next load. To prompt instead ("New version available — reload"), use `registerType: 'prompt'` + the `virtual:pwa-register` `registerSW({ onNeedRefresh })` hook to show a toast.

## 9. Verify
```bash
pnpm build && pnpm preview
```
Lighthouse → Installable + PWA checks pass. DevTools → Network → Offline: reload still boots the shell; persisted queries render their last data.

## References
- ./pwa-patterns.md — precache-shell-not-API, autoUpdate-vs-prompt, maskable icons, query persistence + gcTime, offline testing.
- ../set-up-state-management/SKILL.md — the query cache being persisted; `gcTime`.
- ../_shared/stack-versions.md — tooling versions.
