---
name: set-up-auth
description: Use when adding authentication to a frontend SPA — treats the current user as server state (TanStack Query), keeps tokens out of localStorage (httpOnly cookies or in-memory access + refresh), wires login/logout mutations, a transparent 401→refresh retry in the fetcher, and route guards that read the user query.
---

# Set Up Auth

## 1. Audit current state

```bash
grep -rn "localStorage.*token\|sessionStorage.*token" src/ 2>/dev/null   # red flag — see step 4
grep -rn "auth/me\|currentUser\|useAuth" src/ 2>/dev/null | head
```

**Prerequisites:** `set-up-state-management` (the `fetcher` seam + query-key factory) and `set-up-routing` (guards live in `beforeLoad`/`beforeEach`). Finding tokens in `localStorage` is itself an audit finding — fix it (step 4).

## 2. Decide what to do
- No auth → full setup.
- Tokens in `localStorage` → migrate to cookies / in-memory (step 4) — that's an XSS hole.
- Auth present, no route guards → wire the guard (step 7).

## 3. Detect framework
React → hooks + TanStack Router guard. Vue → composables + Vue Router guard. The token strategy and "user is server state" rule are framework-agnostic.

## 4. Token strategy — never `localStorage`

| Strategy | Where the token lives | Use when |
|---|---|---|
| **httpOnly cookie** (preferred) | server-set cookie, JS can't read it | you control the API/domain — XSS-safe by construction |
| **In-memory access + httpOnly refresh** | access token in a JS variable; refresh token in an httpOnly cookie | cross-domain token API; access token never touches storage |

**Never** `localStorage`/`sessionStorage` for tokens — any XSS reads them. With cookies, the `fetcher` sends credentials automatically; add CSRF protection (SameSite=Lax + a CSRF token on unsafe methods).

```ts
// augment src/libs/fetcher.ts: send the auth cookie
const res = await fetch(`${BASE_URL}${path}`, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', ...init?.headers },
  ...init,
});
```

## 5. The current user is server state

Define shared query options (usable by both the hook and the route guard). First extend the query-key factory with an `auth` group:

```ts
// src/libs/queryKeys.ts — add alongside the existing `todos` group
export const queryKeys = {
  todos: { /* …existing… */ },
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
  },
} as const;
```

```ts
// src/libs/auth.ts
import { queryOptions } from '@tanstack/react-query';
import { fetcher } from '@/libs/fetcher';
import { queryKeys } from '@/libs/queryKeys';

export type User = { id: string; name: string };

export const currentUserQueryOptions = queryOptions({
  queryKey: queryKeys.auth.me(),
  queryFn: () => fetcher<User | null>('/auth/me'),
  retry: false,
  staleTime: Infinity, // session rarely changes; invalidate on login/logout
});
```
```ts
// src/hooks/useCurrentUser.ts
import { useQuery } from '@tanstack/react-query';
import { currentUserQueryOptions } from '@/libs/auth';

export function useCurrentUser() {
  const query = useQuery(currentUserQueryOptions);
  return { ...query, isAuthenticated: !!query.data };
}
```

## 6. Login / logout as mutations

```ts
// src/hooks/useLogin.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/libs/fetcher';
import { queryKeys } from '@/libs/queryKeys';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      fetcher('/auth/login', { method: 'POST', body: JSON.stringify(creds) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
  });
}
// useLogout: POST /auth/logout, then queryClient.clear() (drop all cached user data)
```

## 7. Guard routes via the user query

```tsx
// React (TanStack Router): src/routes/dashboard.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { currentUserQueryOptions } from '@/libs/auth';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions);
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } });
  },
  component: () => <h1>Dashboard</h1>,
});
```
Vue: in `router.beforeEach`, `await queryClient.ensureQueryData(currentUserQueryOptions)` (or read a Pinia auth store hydrated from it) and redirect if absent.

## 8. Transparent refresh (in-memory token strategy)

On a 401, the `fetcher` calls `/auth/refresh` once, retries the original request, and on failure redirects to login. Keep it in the fetcher so call sites never handle expiry — see `auth-patterns.md`.

```ts
// src/libs/fetcher.ts — single-flight refresh, retry once
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  // concurrent 401s share one in-flight refresh instead of stampeding
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function fetcher<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (res.status === 401 && !retried && (await refreshSession())) {
    return fetcher<T>(path, init, true); // retry once after a successful refresh
  }
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
```

## 9. Verify
```bash
pnpm tsc --noEmit
```
Log in → protected route loads and `/auth/me` is cached; log out → `queryClient.clear()` empties it and the guard bounces to `/login`. Confirm no token is in `localStorage`/`sessionStorage` (DevTools → Application).

## References
- ./auth-patterns.md — token storage threat model, user-is-server-state, guard-at-the-boundary, 401 refresh, CSRF, third-party providers.
- ../set-up-state-management/SKILL.md — the `fetcher` seam + query-key factory this extends.
- ../set-up-routing/SKILL.md — the guard hook points.
