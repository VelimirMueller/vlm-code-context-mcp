# Auth Patterns

Reference for `set-up-auth`. The security-sensitive decisions, made the senior way.

## Rule: tokens never go in `localStorage` / `sessionStorage`
**Why:** Both are readable by any JavaScript on the page — one XSS (or a compromised dependency) exfiltrates every user's token. This is the single most common SPA auth mistake.
**How to apply:** Prefer **httpOnly cookies** the server sets — JS literally cannot read them, so XSS can't steal them. If you must use bearer tokens (cross-domain API), keep the **access token in a module variable (memory)** and the **refresh token in an httpOnly cookie**. Memory is wiped on reload; you re-acquire via refresh.

**Anti-example:**
```ts
// bad: an XSS reads this instantly
localStorage.setItem('access_token', token);
```

## Rule: the current user is server state, not a store
**Why:** "Who is logged in" is owned by the server and can change without the UI (token expiry, revocation, another tab logging out). Caching it in TanStack Query gives you refetch, invalidation, and a single source of truth; a Zustand mirror would drift (the bug `set-up-state-management` warns about).
**How to apply:** `currentUserQueryOptions` (a `/auth/me` query) is the source of truth. Derive `isAuthenticated` from it. Login/logout *invalidate* it; logout `queryClient.clear()`s everything. A store may hold only transient auth UI (e.g. "redirect after login" target).

## Rule: guard at the route boundary, using the user query
**Why:** A component-level check renders the protected component (and fires its data hooks) before redirecting — a flash and wasted/sensitive fetches. The router knows before the route loads.
**How to apply:** `beforeLoad`/`beforeEach` calls `ensureQueryData(currentUserQueryOptions)` and redirects if absent. Because it goes through the query cache, the check is deduped with the component's own `useCurrentUser`.

## Rule: refresh transparently in the fetcher, once
**Why:** Every call site handling 401-and-refresh is duplication and races (parallel requests each refreshing). Centralizing it in the `fetcher` seam means call sites never see expiry.
**How to apply:** On 401, the fetcher calls `/auth/refresh` **once** (de-duped — share a single in-flight refresh promise so concurrent 401s wait on it), retries the original request, and on refresh failure clears the user query and redirects to `/login`. Never loop.

## Rule: cookie auth needs CSRF protection
**Why:** httpOnly cookies are sent automatically — including on forged cross-site requests. That's the CSRF trade-off for the XSS safety.
**How to apply:** `SameSite=Lax` (or `Strict`) on the auth cookie blocks most CSRF; for state-changing requests add a CSRF token (double-submit cookie or header) that the server validates.

```ts
// double-submit: echo the readable csrf cookie back in a header on unsafe methods
function csrfHeader(): Record<string, string> {
  const token = document.cookie.match(/(?:^|; )csrf=([^;]+)/)?.[1];
  return token ? { 'X-CSRF-Token': decodeURIComponent(token) } : {};
}
// in the fetcher, for POST/PUT/PATCH/DELETE: headers: { ...csrfHeader(), ...init?.headers }
```

## When to deviate
- **Third-party auth (Auth0, Clerk, Supabase, Cognito):** use their SDK for the token lifecycle — it already does refresh + secure storage. Keep the rest of these rules: current user as server state, guard at the boundary, no tokens in `localStorage`. The SDK becomes the `fetcher`'s token source.
- **SSR/BFF:** a backend-for-frontend holding the session in an httpOnly cookie and proxying API calls is the most secure option — the browser never holds a token at all. Out of scope for this Vite-SPA plugin, but note it for sensitive apps.
