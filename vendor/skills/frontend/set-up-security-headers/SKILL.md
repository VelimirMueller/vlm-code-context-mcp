---
name: set-up-security-headers
description: Use when hardening a frontend SPA's delivery — defines a Content-Security-Policy and standard security headers delivered at the edge via Netlify, dependency hygiene via Dependabot, and an honest note on the XSS surface.
---

# Set Up Security Headers

Security headers are delivered by the host, not the bundle. This skill writes a strict, SPA-appropriate header set for Netlify and wires the CSP's `connect-src` to the origins the app actually calls.

## 1. Audit current state
```bash
ls netlify.toml public/_headers .github/dependabot.yml 2>/dev/null
grep -in "content-security-policy\|strict-transport" netlify.toml public/_headers 2>/dev/null
grep -n "VITE_API_URL\|VITE_REALTIME_URL" src/libs/env.ts 2>/dev/null   # origins for connect-src
```
**Prerequisites:** a Netlify deploy (see `configure-ci`). Recommended: `validate-env` (the CSP reads `VITE_API_URL` / `VITE_REALTIME_URL`).

## 2. Decide
- No headers → full setup. Partial → add the missing headers/directives. Present → confirm `connect-src` covers current API + realtime origins.

## 3. The header block (Netlify)
Add to `netlify.toml` (create if absent — this is the `[[headers]]` block; `configure-ci` owns the `[build]` block, so merge, don't overwrite):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.com wss://realtime.example.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```
Replace `https://api.example.com` / `wss://realtime.example.com` with the **origins** of `VITE_API_URL` / `VITE_REALTIME_URL` (scheme + host, no path). Drop the `wss:` origin if realtime isn't set up.

## 4. CSP notes for a Vite SPA
- Vite emits **external** scripts in prod, so `script-src 'self'` needs no `'unsafe-inline'`. (These headers apply to the deployed build; the dev server is looser.)
- `style-src` keeps `'unsafe-inline'` because Tailwind/runtime styles inject inline `<style>`. To drop it, adopt a nonce/hash — see `security-patterns.md`.
- `connect-src` breaks silently: omit your API or `wss://` origin and those requests fail with a console CSP error. That's why it reads from the env seam.

## 5. Dependency hygiene
`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    groups:
      minor-and-patch:
        update-types: [minor, patch]
```
Pair with a `pnpm audit` step in CI (`configure-ci`). Automation proposes; a human approves each bump.

## 6. The XSS surface (the honest note)
React and Vue escape interpolated values by default. The real hole is **`dangerouslySetInnerHTML` (React) / `v-html` (Vue)** — they bypass escaping. Avoid them; if unavoidable, sanitize with DOMPurify first. A strict CSP is defense-in-depth, not a substitute.

## 7. Verify
```bash
# after a deploy preview is live:
curl -sI https://<deploy-preview-url>/ | grep -i "content-security-policy\|strict-transport"
```
Load the app: the console shows **no** CSP violations (every API / realtime / font / image origin is allowed). Grade it at securityheaders.com.

## References
- ./security-patterns.md — edge-vs-meta delivery, the `connect-src`-from-env rule, the inline-style nonce path, dependency hygiene, the XSS surface, and other hosts.
- ../validate-env/SKILL.md — the `env` seam supplying the `connect-src` origins.
- ../configure-ci/SKILL.md — owns the `netlify.toml` `[build]` block and the `pnpm audit` step.
