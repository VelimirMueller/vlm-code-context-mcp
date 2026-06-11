---
name: set-up-realtime
description: Use when adding realtime / live server-push updates to a frontend SPA — wires a transport-agnostic WebSocket seam (reconnect with backoff, offline-aware, no-op without config) and a hook/composable that writes pushed server data into the TanStack Query cache (patch entity + invalidate lists, re-sync on reconnect), with connection status as the only UI-state store.
---

# Set Up Realtime

Live server→client updates, written into the Query cache through the same server/UI boundary the rest of the app uses. A realtime message carries *server data*, so it lands in the cache — never a store. The one new thing realtime adds is the connection *status*, which is UI state.

Scope: server→client push (live lists, dashboards, notification badges). Collaborative editing / presence / CRDT is out of scope — see `./realtime-patterns.md`.

## 1. Audit current state

```bash
grep -rnE "new WebSocket|EventSource|socket\.io|pusher|ably|@supabase.*realtime" src/ 2>/dev/null   # existing realtime to wrap
ls src/libs/realtime.ts src/stores/useRealtimeStatusStore.ts 2>/dev/null
grep -n "lists:" src/libs/queryKeys.ts 2>/dev/null      # is the lists() factory accessor present?
grep -n "VITE_REALTIME_URL" src/libs/env.ts 2>/dev/null
```

**Prerequisites:** `set-up-state-management` (the `queryClient`, the `queryKeys` factory, the cache-as-truth boundary). Recommended: `set-up-auth` (the connection authenticates the same way the `fetcher` does) and `validate-env` (owns the `VITE_REALTIME_URL` read). Scattered `new WebSocket` / vendor calls in components are an audit finding — wrap them behind the seam (step 5).

## 2. Decide what to do
- No realtime → full setup (steps 4–10).
- Vendor SDK or raw `WebSocket` called from components → introduce the seam and route calls through it.
- Seam present but no reconnect/status handling → add the missing resilience (steps 5, 7).
- Everything present → confirm live data writes to the cache (not a store) and exit "Realtime already in place."

## 3. Detect framework
React → hook (`src/hooks/`) + Zustand status store. Vue → composable (`src/composables/`) + Pinia status store. The seam (`src/libs/realtime.ts`) is plain TS, identical for both.

## 4. Extend the env schema and the query-key factory

**Env (if `validate-env` is in place — preferred).** Add `VITE_REALTIME_URL` as **optional**, so its absence cleanly disables realtime instead of failing the boot check:
```ts
// src/libs/env.ts — add to the schema object
VITE_REALTIME_URL: z.string().url().optional(),
```
```ts
// src/types/env.d.ts — add to ImportMetaEnv
readonly VITE_REALTIME_URL?: string;
```
If `validate-env` is not present, the seam reads `import.meta.env.VITE_REALTIME_URL` directly — note the deviation in the project README and consider running `validate-env`.

**Query-key factory.** Add an intermediate `lists()` accessor so a realtime event can invalidate every list without clobbering a just-patched detail (the standard TanStack `lists()/details()` pattern), and export a `TodoSchema` so the bridge can validate pushed payloads (Zod is already present via `validate-env` / `set-up-forms`):
```ts
// src/libs/queryKeys.ts
import { z } from 'zod';

export const TodoSchema = z.object({ id: z.string(), text: z.string(), done: z.boolean() });
export type Todo = z.infer<typeof TodoSchema>;   // replaces the hand-written Todo type
export type TodoStatus = 'all' | 'active' | 'done';
export type TodoFilters = { status: TodoStatus };

export const queryKeys = {
  todos: {
    all: ['todos'] as const,
    lists: () => [...queryKeys.todos.all, 'list'] as const,                          // NEW
    list: (filters: TodoFilters) => [...queryKeys.todos.lists(), filters] as const,  // now built on lists()
    detail: (id: string) => [...queryKeys.todos.all, 'detail', id] as const,
  },
} as const;
```

## 5. Generate the seam — `src/libs/realtime.ts` (both frameworks)

A transport-agnostic seam over a single shared WebSocket: lazy-connects on first subscribe, routes `{topic,data}` messages to handlers, reconnects with backoff, pauses while offline, and no-ops without a URL.

```ts
// src/libs/realtime.ts
import { env } from '@/libs/env'; // if validate-env is absent: const REALTIME_URL = import.meta.env.VITE_REALTIME_URL;

const REALTIME_URL = env.VITE_REALTIME_URL;

export type RealtimeStatus = 'connecting' | 'open' | 'reconnecting' | 'offline';
export type RealtimeMessage = { topic: string; data: unknown };
type Handler = (msg: RealtimeMessage) => void;

const handlers = new Map<string, Set<Handler>>();
const statusListeners = new Set<(s: RealtimeStatus) => void>();
let socket: WebSocket | null = null;
let status: RealtimeStatus = 'connecting';
let attempt = 0;

function setStatus(next: RealtimeStatus) {
  status = next;
  statusListeners.forEach((cb) => cb(next));
}

function connect() {
  if (!REALTIME_URL || socket) return;
  setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
  const ws = new WebSocket(REALTIME_URL); // same-origin → the httpOnly auth cookie rides the handshake
  socket = ws;

  ws.addEventListener('open', () => {
    attempt = 0;
    setStatus('open');
    handlers.forEach((_, topic) => ws.send(JSON.stringify({ type: 'subscribe', topic }))); // re-subscribe
  });
  ws.addEventListener('message', (e) => {
    let msg: RealtimeMessage;
    try { msg = JSON.parse(e.data as string); } catch { return; }
    handlers.get(msg.topic)?.forEach((h) => h(msg));
  });
  ws.addEventListener('close', () => {
    socket = null;
    if (!REALTIME_URL) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    const delay = Math.min(1000 * 2 ** attempt, 30_000) + Math.random() * 1000; // backoff + jitter
    attempt += 1;
    setStatus('reconnecting');
    setTimeout(connect, delay);
  });
  ws.addEventListener('error', () => ws.close()); // → 'close' → reconnect
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => setStatus('offline'));
  window.addEventListener('online', () => { attempt = 0; if (!socket) connect(); });
}

export const realtime = {
  /** Subscribe to a topic; lazily opens the shared socket. Returns an unsubscribe fn. No-op without VITE_REALTIME_URL. */
  subscribe(topic: string, handler: Handler): () => void {
    if (!REALTIME_URL) return () => {};
    const existing = handlers.get(topic);
    const set = existing ?? new Set<Handler>();   // const capture → narrowed inside the closure on any TS version
    if (!existing) handlers.set(topic, set);
    set.add(handler);
    if (!socket) connect();
    else if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'subscribe', topic }));
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        handlers.delete(topic);
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'unsubscribe', topic }));
      }
    };
  },
  /** Observe status; emits the current value immediately, then on every change. */
  onStatusChange(cb: (s: RealtimeStatus) => void): () => void {
    statusListeners.add(cb);
    cb(status);
    return () => statusListeners.delete(cb);
  },
};
```

The `{topic, data}` envelope and the `subscribe` / `unsubscribe` control frames are the assumed protocol — adapt them to your backend (or a vendor SDK) in this one file. See `./realtime-patterns.md` for the SSE and vendor variants.

## 6. Generate the status store (the only store realtime touches)

### React — `src/stores/useRealtimeStatusStore.ts`
```ts
import { create } from 'zustand';
import type { RealtimeStatus } from '@/libs/realtime';

type State = { status: RealtimeStatus; setStatus: (s: RealtimeStatus) => void };
export const useRealtimeStatusStore = create<State>()((set) => ({
  status: 'connecting',
  setStatus: (status) => set({ status }),
}));
```

### Vue — `src/stores/useRealtimeStatusStore.ts`
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RealtimeStatus } from '@/libs/realtime';

export const useRealtimeStatusStore = defineStore('realtimeStatus', () => {
  const status = ref<RealtimeStatus>('connecting');
  const setStatus = (next: RealtimeStatus) => { status.value = next; };
  return { status, setStatus };
});
```

## 7. Generate the cache bridge

Subscribes topics → writes server data into the cache (patch entity + invalidate lists); mirrors status into the store; re-syncs on reconnect. Mounted **once** near the app root.

### React — `src/hooks/useRealtimeSync.ts`
```ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { realtime, type RealtimeStatus } from '@/libs/realtime';
import { useRealtimeStatusStore } from '@/stores/useRealtimeStatusStore';
import { queryKeys, TodoSchema } from '@/libs/queryKeys';
import { captureError } from '@/libs/error-reporter';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const prev = useRef<RealtimeStatus>('connecting');

  useEffect(() => {
    const unsubTodos = realtime.subscribe('todos', (msg) => {
      const result = TodoSchema.safeParse(msg.data);                        // validate wire payload
      if (!result.success) { captureError(result.error); return; }          // malformed push → report, don't crash
      const todo = result.data;
      queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);       // patch entity — instant
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() });  // server owns list membership/order
    });
    const unsubStatus = realtime.onStatusChange((status) => {
      useRealtimeStatusStore.getState().setStatus(status);
      if (status === 'open' && prev.current === 'reconnecting') {
        queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });   // recover missed events
      }
      prev.current = status;
    });
    return () => { unsubTodos(); unsubStatus(); };
  }, [queryClient]);
}
```

### Vue — `src/composables/useRealtimeSync.ts`
```ts
import { onMounted, onUnmounted } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { realtime, type RealtimeStatus } from '@/libs/realtime';
import { useRealtimeStatusStore } from '@/stores/useRealtimeStatusStore';
import { queryKeys, TodoSchema } from '@/libs/queryKeys';
import { captureError } from '@/libs/error-reporter';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const store = useRealtimeStatusStore();
  let prev: RealtimeStatus = 'connecting';
  let unsubTodos = () => {};
  let unsubStatus = () => {};

  onMounted(() => {
    unsubTodos = realtime.subscribe('todos', (msg) => {
      const result = TodoSchema.safeParse(msg.data);
      if (!result.success) { captureError(result.error); return; }
      const todo = result.data;
      queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() });
    });
    unsubStatus = realtime.onStatusChange((status) => {
      store.setStatus(status);
      if (status === 'open' && prev === 'reconnecting') {
        queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
      }
      prev = status;
    });
  });
  onUnmounted(() => { unsubTodos(); unsubStatus(); });
}
```

> `captureError` is the seam from `set-up-error-boundaries` (`src/libs/error-reporter.ts`). If that skill hasn't run yet, either run it first or substitute `console.error` in the two bridges above.

## 8. Wire it at the app root

The bridge must run inside the Query provider. Mount it once.

### React — in `src/App.tsx`
```tsx
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

export default function App() {
  useRealtimeSync(); // once, under <QueryClientProvider> (see set-up-state-management)
  // …rest of the app
}
```

### Vue — in `src/App.vue`
```vue
<script setup lang="ts">
import { useRealtimeSync } from '@/composables/useRealtimeSync';
useRealtimeSync(); // once; VueQueryPlugin + Pinia are installed in main.ts
</script>
```

## 9. Show connection status (accessibly)

A small, announced badge so offline/reconnecting is perceivable — including by screen readers.

### React — `src/components/atoms/ConnectionStatus.tsx`
```tsx
import { useRealtimeStatusStore } from '@/stores/useRealtimeStatusStore';

export function ConnectionStatus() {
  const status = useRealtimeStatusStore((s) => s.status);
  if (status === 'open') return null;
  return (
    <div role="status" aria-live="polite">
      {status === 'reconnecting' ? 'Reconnecting…' : status === 'offline' ? 'Offline' : 'Connecting…'}
    </div>
  );
}
```
Vue: read `const { status } = storeToRefs(useRealtimeStatusStore())` and render the same `role="status"` `aria-live="polite"` element.

## 10. Verify

```bash
pnpm tsc --noEmit   # seam, bridge, store, and factory additions compile
```
Manual: with `VITE_REALTIME_URL` set, run `pnpm dev`, push a `todos` event from the server (or a `wscat` / mock), and confirm the list updates with no manual refresh. Kill the connection → the badge shows "Reconnecting…" → restore it → data re-syncs (broad invalidate). Unset `VITE_REALTIME_URL` → no socket opens and the app runs normally.

Realtime e2e (a mock WS server via MSW's `ws` API) is deferred to `configure-test-stack`, matching the `set-up-state-management` / `set-up-error-boundaries` precedent. Until then, the type-check is the gate.

## References
- ./realtime-patterns.md — the cache-not-store rule, hybrid write, reconnect recovery, payload validation, and the SSE / vendor / high-volume / collaborative deviations.
- ../set-up-state-management/SKILL.md — the `queryClient` + `queryKeys` factory this writes through; the server/UI boundary.
- ../set-up-auth/SKILL.md — how the connection authenticates (cookie on the handshake; token-as-first-frame variant).
- ../validate-env/SKILL.md — the `env` seam that owns `VITE_REALTIME_URL`.
- ../set-up-error-boundaries/SKILL.md — the `captureError` seam the bridge reports malformed payloads to.
- ../_shared/conventions.md — `libs/` seam location, the `stores/` rule, hooks vs composables.
