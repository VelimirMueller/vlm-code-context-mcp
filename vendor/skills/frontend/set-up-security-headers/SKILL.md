---
name: set-up-security-headers
description: Use when hardening a frontend SPA's delivery — one strict Content-Security-Policy and header set (no unsafe-inline scripts), rendered for the project's host (Netlify, Vercel, or self-hosted Caddy/nginx/Traefik), plus Dependabot hygiene and an honest note on the XSS surface.
---

# Set Up Security Headers

Security headers are delivered by the host, not the bundle. The policy is the same on every host; only the file that carries it changes. This skill writes the policy once (step 3), renders it for the project's host (step 4), and wires `connect-src` to the origins the app actually calls.

## 1. Audit current state
```bash
cat .claude/stack-profile.md 2>/dev/null || cat ~/.claude/stack-profile.md 2>/dev/null   # hosting, ci
ls netlify.toml public/_headers vercel.json vercel.ts Caddyfile nginx.conf compose*.y*ml .github/dependabot.yml 2>/dev/null
grep -in "content-security-policy\|strict-transport" netlify.toml public/_headers vercel.json vercel.ts Caddyfile nginx.conf 2>/dev/null
grep -n "VITE_API_URL\|VITE_REALTIME_URL" src/libs/env.ts 2>/dev/null   # origins for connect-src
grep -n "<script>" index.html 2>/dev/null                                 # inline scripts break script-src 'self'
```
Pick the host branch from the profile's `hosting` list. If there is no profile, detect it from the files above.

| Profile `hosting` / evidence | Branch |
|---|---|
| `netlify`, or `netlify.toml` | Netlify (4a) |
| `vercel`, or `vercel.json` / `vercel.ts` | Vercel (4b) |
| `hetzner`, `ionos`, or a Caddyfile / nginx conf / Traefik labels | Self-hosted (4c) |
| `supabase`, `none`, or unknown | Ask one question: where is the SPA served from? Do not guess. |

**Prerequisites:** a deployed host (see `configure-ci`). Recommended: `validate-env` (the CSP reads `VITE_API_URL` / `VITE_REALTIME_URL`).

## 2. Decide
- No headers → full setup. Partial → add the missing headers/directives. Present → confirm `connect-src` covers current API + realtime origins.
- An inline `<script>` in `index.html` (theme init, analytics snippet) → move it to a same-origin file in `public/` first. The policy below blocks inline scripts on purpose.

## 3. The policy — one definition, every host
| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.com wss://realtime.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (add `; preload` only after the HSTS-preload decision in `security-patterns.md`) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Replace `https://api.example.com` / `wss://realtime.example.com` with the **origins** of `VITE_API_URL` / `VITE_REALTIME_URL` (scheme + host, no path). Drop the `wss:` origin if realtime isn't set up. Cache rule for every host: `index.html` and the service worker (`sw.js`) must not be cached long-term (`Cache-Control: no-cache`); hashed `/assets/*` can be `immutable`. The SPA fallback (all unknown paths → `/index.html`) is host config too; each block below includes it.

## 4. Render it for the host (a project uses exactly one block)

### 4a. Netlify
`netlify.toml` — the `[[headers]]` block (`configure-ci` owns `[build]`; merge, don't overwrite):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.com wss://realtime.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

### 4b. Vercel
`vercel.json` (use `vercel.ts` with `routes.header()` from `@vercel/config/v1` only if the project already has one — a project may hold one config file, not both):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.com wss://realtime.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] }
  ]
}
```
Preview deploys and project setup: [`../../infra/deploy-to-vercel/SKILL.md`](../../infra/deploy-to-vercel/SKILL.md). Vercel serves files from the filesystem before it applies the rewrite, so `/assets/*` still resolves.

### 4c. Self-hosted (Hetzner / IONOS)
Caddy serves the built `dist/` and carries the headers (a Caddy container behind or instead of Traefik):
```caddyfile
example.com {
	root * /srv
	encode zstd gzip
	header {
		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.example.com wss://realtime.example.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
	}
	@shell path /index.html /sw.js
	header @shell Cache-Control "no-cache"
	try_files {path} /index.html
	file_server
}
```
nginx: the same values as `add_header <name> "<value>" always;` in the `server` block. An `add_header` inside a `location` block **replaces** every inherited one — repeat the full set there or use an `include`. Traefik in front of a plain file server: use the `headers` middleware (`stsSeconds=31536000`, `stsIncludeSubdomains=true`, `contentTypeNosniff=true`, `referrerPolicy`, `contentSecurityPolicy`, `customResponseHeaders.Permissions-Policy`) and attach it to the router. Server, deploy and TLS: [`../../infra/deploy-to-hetzner/SKILL.md`](../../infra/deploy-to-hetzner/SKILL.md).

## 5. CSP notes for a Vite SPA
- Vite emits **external** scripts in prod, so `script-src 'self'` needs no `'unsafe-inline'`. The dev server is looser; the policy applies to the deployed build.
- `style-src 'unsafe-inline'` is a pragmatic default, not a requirement: the Tailwind build is an external CSS file, and React/Vue set `style` through the CSSOM, which CSP allows. Libraries that inject `<style>` tags at runtime need it. Test `style-src 'self'` in Report-Only first (`security-patterns.md`).
- `connect-src` breaks silently: omit your API or `wss://` origin and those requests fail with a console CSP error. That's why it reads from the env seam.
- Trusted Types (`require-trusted-types-for 'script'`) is the next layer. Roll it out in Report-Only (`security-patterns.md`).

## 6. Dependency hygiene
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
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
```
`configure-ci` runs `pnpm audit`. Automation proposes; a human approves each bump.

## 7. The XSS surface (the honest note)
React and Vue escape interpolated values by default. The real hole is **`dangerouslySetInnerHTML` (React) / `v-html` (Vue)** — they bypass escaping. Avoid them; if unavoidable, sanitize with DOMPurify first. A strict CSP is defense-in-depth, not a substitute. Baseline: [`security-baseline.md`](../../core/_shared/security-baseline.md).

## 8. Verify
```bash
curl -sI https://<deploy-url>/ | grep -i "content-security-policy\|strict-transport\|x-content-type"
curl -sI https://<deploy-url>/sw.js | grep -i cache-control      # if the PWA is on
curl -s -o /dev/null -w "%{http_code}\n" https://<deploy-url>/some/deep/route   # 200 = SPA fallback works
```
Load the app: the console shows **no** CSP violations (every API / realtime / font / image origin is allowed). Grade it at securityheaders.com.

## References
- ./security-patterns.md — edge-vs-meta delivery, the `connect-src`-from-env rule, strict-CSP rollout (Report-Only, Trusted Types), the HSTS-preload decision, supply chain, the XSS surface.
- ../validate-env/SKILL.md — the `env` seam supplying the `connect-src` origins.
- ../configure-ci/SKILL.md — owns the Netlify `[build]` block and the `pnpm audit` step.
- ../../core/_shared/security-baseline.md — the cross-stack header and cookie rules this skill implements.
