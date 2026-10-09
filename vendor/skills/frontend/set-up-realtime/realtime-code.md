# Realtime — code

Reference for `set-up-realtime`. The files the skill writes, compiled and tested on 2026-10-09 (React 19.3, Vue 3.5, TanStack Query 5.104, Zustand 5.0, Pinia 4.0, Zod 4.6, MSW 3.0, Vitest 5.0 in Chromium). The rules behind them: `realtime-patterns.md`.

## Generate the seam — `src/libs/realtime.ts` (both frameworks)

A transport-agnostic seam over one shared WebSocket: it connects when the first topic is subscribed, routes `{ topic, data }` messages to handlers, reconnects with backoff and jitter, waits while offline, closes when the last listener leaves, and does nothing without a URL.

```ts
import { env } from '@/libs/env';

const REALTIME_URL = env.VITE_REALTIME_URL;

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline';
export type RealtimeMessage = { topic: string; data: unknown };
type Handler = (msg: RealtimeMessage) => void;

const handlers = new Map<string, Set<Handler>>();
const statusListeners = new Set<(s: RealtimeStatus) => void>();
let socket: WebSocket | null = null;
let status: RealtimeStatus = 'idle';
let attempt = 0;

function setStatus(next: RealtimeStatus) {
  status = next;
  for (const listener of statusListeners) listener(next);
}

/** The wire is untrusted: accept only `{ topic: string, data?: unknown }`. */
function parseMessage(raw: unknown): RealtimeMessage | null {
  if (typeof raw !== 'string') return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'object' && value !== null && 'topic' in value && typeof value.topic === 'string') {
      return { topic: value.topic, data: 'data' in value ? value.data : undefined };
    }
  } catch {
    // not JSON: ignore
  }
  return null;
}

function send(frame: { type: 'subscribe' | 'unsubscribe'; topic: string }) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
}

function connect() {
  if (handlers.size === 0) {
    setStatus('idle'); // a pending reconnect timer or the 'online' event may fire after the last unsubscribe: reset, don't stay stuck at 'reconnecting'/'offline'
    return;
  }
  if (!REALTIME_URL || socket) return;
  setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
  const ws = new WebSocket(REALTIME_URL); // same-site cookies ride the handshake; the server must check Origin
  socket = ws;

  ws.addEventListener('open', () => {
    attempt = 0;
    setStatus('open');
    for (const topic of handlers.keys()) send({ type: 'subscribe', topic }); // re-subscribe
  });
  ws.addEventListener('message', (e) => {
    const msg = parseMessage(e.data);
    if (msg) for (const handler of handlers.get(msg.topic) ?? []) handler(msg);
  });
  ws.addEventListener('close', () => {
    socket = null;
    if (handlers.size === 0) {
      attempt = 0;
      setStatus('idle');
      return;
    }
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    const delay = Math.min(1000 * 2 ** attempt, 30_000) + Math.random() * 1000; // backoff + jitter
    attempt += 1;
    setStatus('reconnecting');
    setTimeout(connect, delay);
  });
  ws.addEventListener('error', () => ws.close()); // 'close' follows and reconnects
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => setStatus('offline'));
  window.addEventListener('online', () => {
    attempt = 0;
    connect();
  });
}

export const realtime = {
  /** Subscribe to a topic; lazily opens the shared socket. Returns an unsubscribe function. No-op without VITE_REALTIME_URL. */
  subscribe(topic: string, handler: Handler): () => void {
    if (!REALTIME_URL) return () => {};
    const existing = handlers.get(topic);
    const set = existing ?? new Set<Handler>();
    if (!existing) {
      handlers.set(topic, set);
      send({ type: 'subscribe', topic });
    }
    set.add(handler);
    connect();
    return () => {
      set.delete(handler);
      if (set.size > 0) return;
      handlers.delete(topic);
      send({ type: 'unsubscribe', topic });
      if (handlers.size > 0) return;
      attempt = 0;
      if (socket) socket.close(); // 'close' sets 'idle'
      else setStatus('idle'); // a reconnect timer may be pending; connect() now returns early
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

The `{ topic, data }` envelope and the `subscribe` / `unsubscribe` frames are an assumed protocol: change them in this one file to match your backend or a vendor SDK (`./realtime-patterns.md` covers SSE and vendors). The server must check the `Origin` header on the handshake: a browser sends same-site cookies on a WebSocket upgrade, so an unchecked endpoint is open to cross-site hijacking (`../../core/_shared/security-baseline.md`).

## Generate the status store (the only store realtime touches)

### React — `src/stores/useRealtimeStatusStore.ts`
```ts
import { create } from 'zustand';
import type { RealtimeStatus } from '@/libs/realtime';

type State = { status: RealtimeStatus; setStatus: (s: RealtimeStatus) => void };
export const useRealtimeStatusStore = create<State>()((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));
```

### Vue — `src/stores/useRealtimeStatusStore.ts`
```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RealtimeStatus } from '@/libs/realtime';

export const useRealtimeStatusStore = defineStore('realtimeStatus', () => {
  const status = ref<RealtimeStatus>('idle');
  const setStatus = (next: RealtimeStatus) => {
    status.value = next;
  };
  return { status, setStatus };
});
```

## Generate the cache bridge

Subscribes the topics, writes server data into the cache (patch the entity, invalidate the lists), mirrors status into the store, and refetches after every re-connect. Mount it **once**, near the app root.

### React — `src/hooks/useRealtimeSync.ts`
```ts
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { captureError } from '@/libs/error-reporter';
import { queryKeys, TodoSchema } from '@/libs/queryKeys';
import { realtime } from '@/libs/realtime';
import { useRealtimeStatusStore } from '@/stores/useRealtimeStatusStore';

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubTodos = realtime.subscribe('todos', (msg) => {
      const result = TodoSchema.safeParse(msg.data); // validate the wire payload
      if (!result.success) {
        captureError(result.error); // malformed push: report, do not crash
        return;
      }
      const todo = result.data;
      queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo); // patch the entity: instant
      queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() }); // the server owns list membership and order
    });

    let hasBeenOpen = false;
    const unsubStatus = realtime.onStatusChange((status) => {
      useRealtimeStatusStore.getState().setStatus(status);
      if (status !== 'open') return;
      // Every open after the first follows a gap (drop, offline): events were missed.
      if (hasBeenOpen) queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
      hasBeenOpen = true;
    });

    return () => {
      unsubTodos();
      unsubStatus();
    };
  }, [queryClient]);
}
```

### Vue — `src/composables/useRealtimeSync.ts`
```ts
import { useQueryClient } from '@tanstack/vue-query';
import { onScopeDispose } from 'vue';
import { captureError } from '@/libs/error-reporter';
import { queryKeys, TodoSchema } from '@/libs/queryKeys';
import { realtime } from '@/libs/realtime';
import { useRealtimeStatusStore } from '@/stores/useRealtimeStatusStore';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const store = useRealtimeStatusStore();

  const unsubTodos = realtime.subscribe('todos', (msg) => {
    const result = TodoSchema.safeParse(msg.data);
    if (!result.success) {
      captureError(result.error);
      return;
    }
    const todo = result.data;
    queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);
    queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() });
  });

  let hasBeenOpen = false;
  const unsubStatus = realtime.onStatusChange((status) => {
    store.setStatus(status);
    if (status !== 'open') return;
    if (hasBeenOpen) queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
    hasBeenOpen = true;
  });

  onScopeDispose(() => {
    unsubTodos();
    unsubStatus();
  });
}
```

> `captureError` is the seam from `set-up-error-boundaries` (`src/libs/error-reporter.ts`). If that skill has not run, run it first, or use `console.error` in the two bridges.


## Show connection status (accessibly)

A small announced badge, so offline and reconnecting are perceivable, including by screen readers.

### React — `src/components/atoms/ConnectionStatus/ConnectionStatus.tsx`
```tsx
import { useRealtimeStatusStore } from '@/stores/useRealtimeStatusStore';

const LABELS = { connecting: 'Connecting…', reconnecting: 'Reconnecting…', offline: 'Offline' } as const;

export function ConnectionStatus() {
  const status = useRealtimeStatusStore((s) => s.status);
  if (status === 'open' || status === 'idle') return null;
  return (
    <div role="status" aria-live="polite">
      {LABELS[status]}
    </div>
  );
}
```
Vue: read `const { status } = storeToRefs(useRealtimeStatusStore())` and render the same `role="status"` / `aria-live="polite"` element for the three non-quiet states.


## Test — the seam against a mocked socket

Real browser, mocked socket (MSW's `ws` API). Needs `configure-test-stack`, with the worker exported from `tests/mocks/browser.ts`, and `VITE_REALTIME_URL=ws://rt.test/socket` in `.env.test`:
```ts
// tests/ui/realtime.test.ts
import { ws } from 'msw';
import { expect, test, vi } from 'vitest';
import { worker } from '../mocks/browser';
import { realtime, type RealtimeMessage } from '@/libs/realtime';

const socket = ws.link('ws://rt.test/socket');

test('routes valid frames, ignores malformed ones, re-subscribes after a drop', async () => {
  const subscribed: string[] = [];
  let clients = 0;
  worker.use(
    socket.addEventListener('connection', ({ client }) => {
      clients += 1;
      client.addEventListener('message', (e) => {
        const frame = JSON.parse(String(e.data));
        if (frame.type === 'subscribe') subscribed.push(frame.topic);
      });
      if (clients === 1) {
        setTimeout(() => {
          client.send('null');
          client.send('not json');
          client.send(JSON.stringify({ topic: 'todos', data: { id: '1' } }));
        }, 50);
        setTimeout(() => client.close(), 150);
      }
    }),
  );

  const received: RealtimeMessage[] = [];
  const unsubscribe = realtime.subscribe('todos', (m) => received.push(m));
  await vi.waitFor(() => expect(received).toHaveLength(1));
  expect(received[0]?.data).toEqual({ id: '1' });
  await vi.waitFor(() => expect(clients).toBe(2), { timeout: 5000 });
  await vi.waitFor(() => expect(subscribed).toEqual(['todos', 'todos']));
  unsubscribe();
});
```

## When to deviate

- **Another protocol** (SSE, Socket.IO, a vendor SDK): keep `subscribe` / `onStatusChange` and the bridge; change the transport inside `realtime.ts` (`realtime-patterns.md`).
- **Several topics with different cache shapes:** one `subscribe` per topic in the same bridge, each with its own schema; do not widen `TodoSchema`.
