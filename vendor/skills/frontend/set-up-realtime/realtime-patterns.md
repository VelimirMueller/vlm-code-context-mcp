# Realtime Patterns

Reference for `set-up-realtime`. How to take server-pushed updates into a frontend without re-introducing the dual-source-of-truth bug the state boundary exists to prevent. The transport (WebSocket, SSE, a vendor SDK) is the easy part; *where the pushed data lands* is what teams get wrong.

## Rule: live data writes to the cache, never a store
**Why:** A realtime message carries server data — the same category TanStack Query owns. Routing it into a Zustand/Pinia store recreates exactly the two-sources-of-truth drift `state-boundaries.md` designs out: the store and the cache would both claim to hold "the todos," and they would diverge. The cache is the single source of truth whether the data arrived via fetch or via push.
**How to apply:** The bridge calls `queryClient.setQueryData` / `invalidateQueries` with factory keys. Components keep reading `useTodos()` — they never learn the data was pushed.

**Anti-example:**
```ts
// bad: pushing realtime data into a store — now the cache and the store disagree
realtime.subscribe('todos', (msg) => useTodosStore.getState().setTodos(msg.data));
```

## Rule: hybrid write — patch the entity, invalidate the lists
**Why:** A pushed entity can be written into its detail cache instantly with `setQueryData` (no refetch, no spinner). But whether that entity belongs in the currently-filtered list — and in what order — is a question only the server can answer correctly. Patching list membership by hand re-implements server query logic in the client and drifts. So patch what you know (the entity) and let the server resolve what you do not (the list).
**How to apply:**
```ts
queryClient.setQueryData(queryKeys.todos.detail(todo.id), todo);      // precise, instant
queryClient.invalidateQueries({ queryKey: queryKeys.todos.lists() }); // server re-resolves membership/order
```
For a delete: `queryClient.removeQueries({ queryKey: queryKeys.todos.detail(id) })`, then invalidate lists.

## Rule: on reconnect, invalidate broadly to recover missed events
**Why:** While the socket was down, the server kept changing. Events fired in that window never reached the client — the cache is now silently stale, and re-subscribing alone will not fix it. A broad invalidate on reconnect refetches current truth.
**How to apply:** Invalidate on the `reconnecting → open` transition only — not the first connect (initial queries are already fresh/loading):
```ts
if (status === 'open' && prev === 'reconnecting') {
  queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
}
```

## Rule: one seam, transport- and vendor-agnostic; no-op without config
**Why:** Calling `new WebSocket()` or a vendor SDK throughout the app welds you to it and makes realtime impossible to disable in dev/test. The seam is the single integration point — the same move as `fetcher` / `captureError` / the analytics client.
**How to apply:** App code calls `realtime.subscribe(topic, handler)`; only `realtime.ts` knows the transport. With `VITE_REALTIME_URL` unset, `subscribe` is a no-op — contributors and tests do not open sockets. Swapping WebSocket → Pusher / Ably / Supabase Realtime is one file.

## Rule: validate every wire payload before it touches the cache
**Why:** A pushed message is untrusted input from the network, exactly like a fetch response. An unvalidated `msg.data` cast to `Todo` puts malformed server data straight into the cache, where it surfaces as a confusing render crash far from the cause.
**How to apply:** Parse with the same Zod schema the rest of the app uses, and route a failure to the `captureError` seam instead of letting it throw inside the socket callback: `const result = TodoSchema.safeParse(msg.data); if (!result.success) { captureError(result.error); return; }` then use `result.data`.

## Rule: connection status is UI state — and the only state realtime puts in a store
**Why:** "Are we connected?" is ephemeral client state — no server owns it and you cannot fetch it. That makes it the one genuinely new piece of UI state realtime introduces, and it belongs in a small store, announced accessibly.
**How to apply:** A `useRealtimeStatusStore` holding `'connecting' | 'open' | 'reconnecting' | 'offline'`, rendered in a `role="status"` `aria-live="polite"` badge so screen-reader users learn the app went offline.

## When to deviate
- **SSE for pure server→client:** `EventSource` behind the same seam interface gives free auto-reconnect over plain HTTP/2; its limits are cookie-only auth (no custom headers) and unidirectionality. The cache bridge is unchanged.
- **Managed vendor:** for Pusher / Ably / Supabase Realtime, wrap the SDK in the seam's `subscribe` / `onStatusChange` rather than hand-rolling reconnection — keep the boundary, lose the plumbing.
- **High event volume:** if invalidate-per-event causes refetch storms, patch lists directly with `setQueryData` (accepting the membership/ordering bookkeeping) or debounce the invalidate.
- **Collaborative editing, presence, cursors:** out of scope here — these need conflict resolution (CRDT/OT) and a different architecture. Do not stretch this seam to cover them.
- **Persisted cache (PWA):** with `persistQueryClient` (see `set-up-pwa`), the reconnect-invalidate also refreshes stale data restored from disk — desirable; just expect the first post-reconnect render to refetch.
