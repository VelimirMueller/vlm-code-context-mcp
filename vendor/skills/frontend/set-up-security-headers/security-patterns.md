# Security Patterns

Reference for `set-up-security-headers`. The policy is host-agnostic; the host only changes where the header lines live.

## Rule: deliver headers at the edge, not in a meta tag
**Why:** `Strict-Transport-Security`, `frame-ancestors`, `report-to` and `Content-Security-Policy-Report-Only` are ignored in a `<meta>` tag, and the tag only protects what parses after it. Real response headers apply before the document parses.
**How to apply:** Set them on the host (Netlify `[[headers]]`, Vercel `headers`, Caddy `header`, nginx `add_header ... always`). Keep the policy in one place per project, in one host file.

## Rule: one policy, rendered per host
**Why:** A header set copied by hand into three syntaxes drifts: the Netlify copy gets the new API origin, the Caddy copy does not. A single definition (the table in `SKILL.md` step 3) keeps the *rules* in one place; only the delivery syntax differs.
**How to apply:** Choose the branch from the profile's `hosting`. Change the policy in the table first, then in the one host file the project uses. Moving host later changes one file, not the policy.

## Rule: CSP `connect-src` lists your API and realtime origins
**Why:** A strict `connect-src` silently blocks any origin it doesn't name — your API fetches and `wss://` realtime socket included — surfacing as console CSP errors, not obvious failures.
**How to apply:** Read the origins from `VITE_API_URL` / `VITE_REALTIME_URL` (the `validate-env` seam); list scheme + host only. Add an origin whenever you call a new one (fonts, images, a third-party API, analytics endpoint).

## Rule: no inline scripts, ever; inline styles are a measured exception
**Why:** `script-src 'self'` with no `'unsafe-inline'` is the high-value CSP win: injected markup cannot run, and a Vite build needs no inline scripts. Styles are lower risk (style injection cannot execute code), so the cost of strictness is weighed against breakage.
**How to apply:** Keep `script-src 'self'`. A pre-paint theme script or any snippet goes into a same-origin file under `public/` (see `set-up-design-system`), never inline. For styles, ship `'unsafe-inline'`, then try `style-src 'self'` in Report-Only: the Tailwind build output is an external file and React/Vue write `style` through the CSSOM, which CSP does not block. Libraries that inject `<style>` tags need a nonce (per-response, so host-dependent) or the exception. If a nonce or hash is present in a directive, browsers ignore `'unsafe-inline'` there.

**Anti-example:**
```
script-src 'self' 'unsafe-inline'    # one XSS now runs; the CSP protects nothing
```

## Rule: roll a stricter policy out in Report-Only first
**Why:** An enforced policy that is too tight breaks production silently; Report-Only shows every violation without blocking. Both headers can be sent together: the enforced one blocks, the Report-Only one reports.
**How to apply:** Send `Content-Security-Policy-Report-Only` with the candidate policy plus `Reporting-Endpoints: csp="<url>"` and `report-to csp` in the policy (`report-uri` is deprecated; add it only for older browsers). Point the endpoint at the error tracker. Fix violations, then promote the policy to `Content-Security-Policy`. Report-Only cannot be set in a `<meta>` tag.

## Rule: Trusted Types is the next layer after a strict script-src
**Why:** `script-src 'self'` stops injected `<script>` tags, not DOM sinks such as `innerHTML` with attacker data. `require-trusted-types-for 'script'` makes those sinks throw unless the value went through a named policy. MDN lists the API as Baseline 2026 (newly available), so it works in current browsers of all engines.
**How to apply:** Start in Report-Only: `require-trusted-types-for 'script'; trusted-types <policy-names>`, listing only the policy names your code creates (DOMPurify can return Trusted Types with `RETURN_TRUSTED_TYPE: true`; read its docs for the policy name). Remove or wrap each sink the reports show. Do not enforce while a third-party dependency still writes strings to sinks.

## Rule: HSTS `preload` is a one-way door — opt in on purpose
**Why:** The preload list ships inside browsers. Removal takes months, and `includeSubDomains` + `preload` forces HTTPS on every present and future subdomain, including an internal host that has no certificate.
**How to apply:** Default `max-age=31536000; includeSubDomains`. Add `preload` only when every subdomain serves HTTPS for good and the domain owner agrees; then submit at hstspreload.org.

## Rule: dependency hygiene is automated proposals + human review
**Why:** Unpatched transitive deps are a top supply-chain risk; manual tracking doesn't happen. Workflow actions are dependencies too: a moved tag changes your CI without a commit.
**How to apply:** Dependabot opens grouped weekly PRs for `npm` and `github-actions`; CI runs `pnpm audit`; a human reviews each bump. Renovate is the more configurable alternative.

## Rule: the real XSS surface is `dangerouslySetInnerHTML` / `v-html`
**Why:** React and Vue escape interpolated values by default; these two opt out of escaping and are where injection lands.
**How to apply:** Avoid them. If unavoidable, sanitize with DOMPurify first. CSP is defense-in-depth, not a substitute for not injecting HTML.

## When to deviate
- **Cloudflare Pages / other hosts:** `public/_headers` (Cloudflare, also read by Netlify) or a Worker carries the same policy. Add a branch to `SKILL.md` step 4 when a project uses one; the policy table does not change.
- **Auth popups and cross-origin isolation:** `Cross-Origin-Opener-Policy: same-origin` blocks the `window.opener` link that OAuth popup flows rely on. Add it only for apps that need isolation (`SharedArrayBuffer`) and use redirect-based login.
- **Third-party embeds (maps, payment iframes, video):** add the narrowest origin to `frame-src` / `script-src` / `connect-src` and comment why. A host allow-list for scripts is weaker than a nonce or hash; if the embed needs scripts, prefer its documented nonce flow.
- **SSR frameworks (Next, Nuxt):** a per-request nonce becomes possible and then `style-src` can drop `'unsafe-inline'` too. Use the framework's CSP support instead of static host headers.
