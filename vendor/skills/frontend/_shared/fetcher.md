# The `fetcher` seam — one canonical definition

Every server request in the app flows through `src/libs/fetcher.ts`. This file is the single
source for that code: `set-up-state-management` writes the base version, `set-up-auth` upgrades
it to the auth version, `validate-env` swaps the base-URL read. Link here instead of restating
the function — a snippet copied into three skills drifts, and a bug in it spreads three times.

## Audit an existing fetcher

```bash
# The fixed fetcher builds one Headers object from the caller's headers. No match = upgrade.
grep -n 'new Headers(init?.headers)' src/libs/fetcher.ts 2>/dev/null
# Where `init` is spread: it must sit BEFORE `headers:`, and `...init?.headers` must not appear.
grep -nE '\.\.\.init(\?\.headers)?\b' src/libs/fetcher.ts 2>/dev/null
```

First grep finds nothing → replace the file's request-building code with the version below.
Leave the file alone only when it builds headers with `new Headers(init?.headers)` and spreads
`...init` *before* `headers:` in the `fetch` call.

## Rule: build headers last, from every `HeadersInit` shape

**Why:** `fetch(url, { headers: {...}, ...init })` lets `init.headers` replace the whole merged
object, so a caller that passes `{ headers: { 'X-Trace': id } }` silently loses `Content-Type`
and any CSRF or auth header the seam added. And `...init?.headers` only understands plain
objects: a `Headers` instance spreads to `{}` and a tuple array spreads to `{ 0: …, 1: … }`.
**How to apply:** spread `init` first, then set `headers` to one `Headers` object built from
`new Headers(init?.headers)`. Seam defaults are added with `if (!headers.has(…))`, so an
explicit caller header still wins.
**Anti-example:**
```ts
fetch(url, { headers: { 'Content-Type': 'application/json', ...init?.headers }, ...init }); // init.headers wins outright
```

## Rule: default to JSON only for string bodies

**Why:** forcing `Content-Type: application/json` on a `FormData` upload strips the multipart
boundary the browser would set, and the server cannot parse the body.
**How to apply:** set the JSON content type only when `typeof init.body === 'string'`.

## Rule: throw a typed error; tolerate empty bodies

**Why:** callers (the auth guard, retry logic, error boundaries) need the status code, not a
message to parse. A `204 No Content` (logout, delete) has no body, so `res.json()` throws.
**How to apply:** throw `HttpError` with `status`; return `undefined` for 204.

## Base version — `set-up-state-management`

```ts
// src/libs/fetcher.ts
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// A plain field, not a `constructor(readonly status…)` parameter property: Vite's tsconfig
// enables `erasableSyntaxOnly`, which rejects parameter properties.
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, statusText: string) {
    super(`Request failed: ${status} ${statusText}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

function buildHeaders(init?: RequestInit): Headers {
  // Accepts every HeadersInit shape: plain object, Headers instance, [key, value][] array.
  const headers = new Headers(init?.headers);
  // FormData/Blob bodies set their own Content-Type (with the multipart boundary).
  if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

export async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  // init first, merged headers last — a caller's headers can no longer erase the seam's.
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: buildHeaders(init) });
  if (!res.ok) throw new HttpError(res.status, res.statusText);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

## Auth version — `set-up-auth`

Adds three things to the base version: the auth cookie (`credentials: 'include'`), the
double-submit CSRF header on unsafe methods, and the single-flight 401 refresh. The rationale
for each lives in `../set-up-auth/auth-patterns.md`.

```ts
// src/libs/fetcher.ts
const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// A plain field, not a `constructor(readonly status…)` parameter property: Vite's tsconfig
// enables `erasableSyntaxOnly`, which rejects parameter properties.
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, statusText: string) {
    super(`Request failed: ${status} ${statusText}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

// double-submit: echo the readable csrf cookie back in a header
function csrfToken(): string | undefined {
  const token = document.cookie.match(/(?:^|; )csrf=([^;]+)/)?.[1];
  return token ? decodeURIComponent(token) : undefined;
}

function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (init?.method ?? 'GET').toUpperCase();
  const csrf = UNSAFE_METHODS.has(method) ? csrfToken() : undefined;
  if (csrf && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrf);
  return headers;
}

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  // concurrent 401s share one in-flight refresh instead of stampeding
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders({ method: 'POST' }),
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function fetcher<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  // seam default first, caller's init next (may override credentials), merged headers last
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: buildHeaders(init),
  });
  if (res.status === 401 && !retried && (await refreshSession())) {
    return fetcher<T>(path, init, true); // retry once after a successful refresh
  }
  if (!res.ok) throw new HttpError(res.status, res.statusText);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

Cookie-only sessions without a refresh endpoint: drop `refreshing`, `refreshSession` and the
401 branch; keep the rest.

## When to deviate

- **A typed client already exists** (generated OpenAPI client, `ky`, `ofetch`): wrap it behind
  the same `fetcher` signature instead of replacing it; keep the header and error rules.
- **Non-JSON responses** (CSV, blobs): add a sibling `fetchBlob` in the same file rather than
  branching on content type inside `fetcher` — the typed `T` return stays honest.
- **Server-side rendering**: `document.cookie` does not exist on the server; read the CSRF token
  from the request context there.
