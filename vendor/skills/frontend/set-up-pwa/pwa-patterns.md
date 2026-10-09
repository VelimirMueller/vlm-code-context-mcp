# PWA Patterns

Reference for `set-up-pwa`. Where the service worker's job ends and the query cache's begins.

## Rule: the SW precaches the shell; TanStack Query owns data
**Why:** Two caches for the same server data (Workbox runtime caching *and* the query cache) drift apart — the SW serves a stale response the query layer thinks is fresh, or vice versa. The clean split: the SW guarantees the *app* loads offline (shell), and the query cache (persisted) guarantees the *data* is there.
**How to apply:** Workbox `globPatterns` precaches JS/CSS/HTML/fonts/icons. Do **not** add `runtimeCaching` for your API. For offline data reads, persist the query client (below).

**Anti-example:**
```ts
// bad: SW runtime-caches the API, competing with the query cache
workbox: { runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkFirst' }] }
```

## Rule: persist to IndexedDB, and only an allow-list of queries
**Why:** `localStorage` is synchronous (it blocks the main thread on every write), capped near 5 MB, and readable by any script on the page, so persisting the whole cache there copies every private response — `/auth/me` included — into the store the auth rules forbid for tokens. IndexedDB is asynchronous and larger, and TanStack's docs name it faster and bigger than Web Storage. An allow-list means a new private query is not persisted by accident.
**How to apply:** `createAsyncStoragePersister` over `idb-keyval`; `shouldDehydrateQuery` returns true only for `meta.persist === true`; `buster` per release; `removeClient()` on logout. Storage is still same-origin script-readable, so public or low-sensitivity data only.

## Rule: persist the query cache for offline/instant reads, with gcTime ≥ maxAge
**Why:** Persisting the TanStack Query cache to storage means a reload (or offline launch) shows the last-known data immediately, then revalidates. But if `gcTime` < the persister's `maxAge`, entries are garbage-collected before they're restored — you persist nothing useful.
**How to apply:** `PersistQueryClientProvider` + the persister above; set `maxAge` to your offline window and the query client's `gcTime` to ≥ that.

## Rule: choose the update UX deliberately
**Why:** A silently-updating SW can swap code mid-session; a never-prompting one leaves users on a stale version. Neither is automatically right.
**How to apply:** `autoUpdate` for low-stakes apps (new version on next load). `prompt` + a "Reload to update" toast (`registerSW({ onNeedRefresh })`) for apps where a mid-session swap would lose work.

## Rule: serve `sw.js` uncached
**Why:** The browser checks the worker script on navigation, but an HTTP-cached `sw.js` makes that check read the stale copy; users run old code until the cache expires.
**How to apply:** `Cache-Control: no-cache` (or `max-age=0, must-revalidate`) on `/sw.js` and `index.html`; hashed assets stay `immutable`. Host syntax in `set-up-security-headers`.

## Rule: ship installable essentials — manifest + maskable icons
**Why:** Without a complete manifest and a maskable icon, the install prompt won't fire and the home-screen icon looks broken on Android.
**How to apply:** `name`/`short_name`/`theme_color`/`background_color`/`display: 'standalone'` + 192 and 512 icons, plus one `purpose: 'maskable'` icon.

## Rule: test offline for real
**Why:** "It has a service worker" ≠ "it works offline." Only an actual offline reload proves the shell precached and the data persisted.
**How to apply:** `pnpm preview`, Lighthouse PWA audit, then DevTools → Offline → reload. Confirm the shell boots and persisted queries render.

## When to deviate
- **Installable but not offline:** if offline reads aren't a real user need, ship the manifest + shell precache and skip query persistence — don't store user data in localStorage without reason.
- **Sensitive data:** don't persist authenticated/PII query results anywhere in the browser. The allow-list above is the default; skip persistence entirely for apps whose data is all private.
- **Tiny caches:** a few KB of public data can use `createSyncStoragePersister` over `localStorage`; keep the allow-list.
- **No PWA at all:** a tool used only online on desktop may not need any of this. Add it when "installable" or "works on the train" is a real requirement.
