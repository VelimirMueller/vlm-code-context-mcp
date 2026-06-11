# Architecture — seams, boundaries, and the data flow

How the frontendskills set fits together. The skills look independent but interlock through a few shared **seams** and **boundaries**. This map makes that wiring legible.

## Seams (single points of indirection)

| Seam | File | Created by |
|---|---|---|
| `fetcher` | `src/libs/fetcher.ts` | set-up-state-management |
| `env` | `src/libs/env.ts` | validate-env |
| `queryClient` | `src/libs/queryClient.ts` | set-up-state-management |
| `queryKeys` | `src/libs/queryKeys.ts` | set-up-state-management |
| `captureError` | `src/libs/error-reporter.ts` | set-up-error-boundaries |
| `realtime` | `src/libs/realtime.ts` | set-up-realtime |
| `analytics` | `src/libs/analytics.ts` | configure-analytics |
| `featureFlags` | `src/libs/featureFlags.ts` | set-up-feature-flags |

Swap a vendor or mock a test by changing one file.

## Boundaries (rules that make bug-classes unrepresentable)

- **Server state lives in the Query cache; never a store.** Stores hold UI state only. *(set-up-state-management)*
- **Tokens never touch `localStorage`.** httpOnly cookie or in-memory access token. *(set-up-auth)*
- **UI renders; modules decide.** Components hold no logic; it lives in utils/libs/hooks/stores. *(create-module)*
- **Config fails loud at boot, not silent at runtime.** *(validate-env)*
- **Flags fail closed.** An unreachable flag service yields the safe value. *(set-up-feature-flags)*

## The data flow — one `queryClient`, many entry points

```
route loader   ──prefetch──▶  ┌──────────────────┐
component hook ───read─────▶  │   Query cache    │  ◀──push──  realtime seam
form submit  ──invalidate──▶  │  (server state)  │
auth guard ─ensureQueryData▶  └──────────────────┘
                                       ▲
                        a UI store may feed the query KEY
                        (the active filter) — never the data
```

A route loader prefetches into the exact cache address a component's hook reads; a form mutation invalidates that address; the auth guard hydrates the user query into it; the realtime seam writes server-pushed updates into it. A UI store may feed a query *key* (the active filter), but the result always flows back into the cache, never into the store.

## How the skills compose

`scaffold → clean → configure-typescript → validate-env → configure-linting → set-up-frontend-structure → set-up-state-management → (set-up-realtime, set-up-error-boundaries) → configure-test-stack → set-up-routing → set-up-forms → set-up-auth → … → experience → polish → configure-ci → set-up-security-headers`. Every skill is audit-first, so the order is a guide, not a constraint.

## The second catalogue

`skills/landing/` covers the public-page world — landing pages, marketing and content pages — framework-agnostically (audits run on built HTML, not on a toolchain). Its cross-cutting logic lives in `skills/landing/_shared/`: `page-types.md` (the public-page gate and the priority inversion (LCP/CLS vs INP)) and `rubric-convention.md` (project-overridable audit rubrics). The two catalogues meet where an app exposes public pages: `set-up-document-head` → `landing/set-up-seo`, `set-up-forms` → `landing/set-up-lead-capture`, `optimize-performance` → `landing/build-landing-page`.
