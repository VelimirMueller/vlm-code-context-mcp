# Security Patterns

Reference for `set-up-security-headers`.

## Rule: deliver headers at the edge, not in a meta tag
**Why:** `Strict-Transport-Security`, `frame-ancestors`, and others are ignored as `<meta>` — they must be real response headers, set before the document parses.
**How to apply:** Set them on the host (Netlify `[[headers]]`). Keep the policy in one place.

## Rule: CSP `connect-src` lists your API and realtime origins
**Why:** A strict `connect-src` silently blocks any origin it doesn't name — your API fetches and `wss://` realtime socket included — surfacing as console CSP errors, not obvious failures.
**How to apply:** Read the origins from `VITE_API_URL` / `VITE_REALTIME_URL` (the `validate-env` seam); list scheme + host only. Add an origin whenever you call a new one (fonts, images, a third-party API).

## Rule: no inline scripts; handle inline styles deliberately
**Why:** `script-src 'self'` with no `'unsafe-inline'` is the high-value CSP win, and a Vite build needs no inline scripts. Inline *styles* are the awkward case — Tailwind/runtime CSS inject them.
**How to apply:** Keep `script-src 'self'`. For styles, start with `'unsafe-inline'`; to remove it, emit a per-response nonce and add `'nonce-…'` to `style-src` (host-dependent).

## Rule: dependency hygiene is automated proposals + human review
**Why:** Unpatched transitive deps are a top supply-chain risk; manual tracking doesn't happen.
**How to apply:** Dependabot opens grouped weekly PRs; CI runs `pnpm audit`; a human reviews each bump. Renovate is the more configurable alternative.

## Rule: the real XSS surface is `dangerouslySetInnerHTML` / `v-html`
**Why:** React and Vue escape interpolated values by default; these two opt out of escaping and are where injection lands.
**How to apply:** Avoid them. If unavoidable, sanitize with DOMPurify first. CSP is defense-in-depth, not a substitute for not injecting HTML.

## When to deviate
- **Other hosts:** Vercel → `vercel.json` `headers`; nginx → `add_header`; Cloudflare → `_headers` or a Worker. Same policy, different delivery.
- **Rollout:** ship `Content-Security-Policy-Report-Only` first with a `report-to` pointing at Sentry, watch for violations, then enforce.
