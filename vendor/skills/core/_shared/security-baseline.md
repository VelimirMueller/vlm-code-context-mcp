# Security Baseline

Cross-stack minimum for every project these skills touch. Stack skills add detail; they do not go below this.
Mapped to the OWASP Top 10:2025 (released November 2025; the list is final, the official write-up was still being edited when checked on 2026-10-09) and the OWASP ASVS 5.0.0 (released May 2025, 17 chapters, about 350 requirements; cite requirements with the version, for example `v5.0.0-6.2.1`).

## OWASP Top 10:2025 — the categories

| ID | Category | Baseline rule(s) below |
|---|---|---|
| A01 | Broken Access Control (includes SSRF) | 2, 3, 12 |
| A02 | Security Misconfiguration | 7, 8, 9 |
| A03 | Software Supply Chain Failures | 5, 6 |
| A04 | Cryptographic Failures | 1, 10 |
| A05 | Injection | 4 |
| A06 | Insecure Design | 3, 4, principles in [engineering-principles.md](engineering-principles.md) |
| A07 | Authentication Failures | 3, 10 |
| A08 | Software or Data Integrity Failures | 5, 6 |
| A09 | Security Logging & Alerting Failures | 11, [logging-contract.md](logging-contract.md) |
| A10 | Mishandling of Exceptional Conditions | 13 |

## ASVS 5.0 chapter map

V1 Encoding and Sanitization · V2 Validation and Business Logic · V3 Web Frontend Security · V4 API and Web Service · V5 File Handling · V6 Authentication · V7 Session Management · V8 Authorization · V9 Self-contained Tokens · V10 OAuth and OIDC · V11 Cryptography · V12 Secure Communication · V13 Configuration · V14 Data Protection · V15 Secure Coding and Architecture · V16 Security Logging and Error Handling · V17 WebRTC (V17 taken from memory, chapters V1–V16 verified against the official CSV on 2026-10-09).
Use ASVS Level 1 as the floor for every app, Level 2 for anything holding personal or payment data.

## The baseline

### 1. Secrets never live in the repo, the image or the client bundle
**Why:** Git history is forever, images are shared, bundles are public. A leaked key is rotated, not deleted. (A04, ASVS V13, V14)
**How to apply:** Secrets come from the environment or a secret manager. `.env*` is git-ignored; `.env.example` holds names only. Browser env prefixes (`VITE_`, `NUXT_PUBLIC_`, `NEXT_PUBLIC_`) mark values as **public**: never put a secret behind them. No `ARG`/`ENV` secrets in Dockerfiles: use build secrets. Run a secret scanner in pre-commit and CI (rule 6).
**When to deviate:** Never for production. Local-only dummy credentials are fine when they are unusable elsewhere.

### 2. Least privilege everywhere
**Why:** Every permission is blast radius. (A01, A02, ASVS V8, V13)
**How to apply:** Database roles per service with the minimum grants; API tokens scoped and short-lived; CI `permissions:` set to `contents: read` at workflow level and widened per job; containers run as non-root with a read-only root filesystem where possible; cloud IAM by resource, not `*`.
**When to deviate:** Break-glass admin access, logged and time-limited.

### 3. Authorization at the data boundary
**Why:** A check in the UI or a route guard is bypassed by calling the API or database directly. Broken access control is A01 for the second list in a row. (A01, A06, A07, ASVS V8)
**How to apply:** Enforce on the server, on every request, next to the data: row-level security (Postgres RLS), or a query function that takes the actor and filters by it. Deny by default. Check object ownership, not just role (IDOR). Add a test that user A cannot read user B's record for every resource type.
**Anti-example:** `if (user.isAdmin)` in a React component as the only guard.
**When to deviate:** Public data, explicitly.

### 4. Validate input at the edge, encode output at the sink
**Why:** Injection happens where untrusted data meets an interpreter. Validate once on entry; encode for the context on exit. (A05, A06, ASVS V1, V2, V4, V5)
**How to apply:** Schema-parse every request, message, file and env at the seam. Parameterized queries or a query builder only: no string-built SQL, shell, or LDAP. Use framework output encoding (React/Vue escape by default); never `dangerouslySetInnerHTML` / `v-html` with unsanitized input. Allow-list file types, sizes and names; store uploads outside the web root. Outbound requests built from user input go through an allow-list and block private ranges (SSRF).
**When to deviate:** Raw HTML is required (CMS content): sanitize with a maintained library and a strict allow-list.

### 5. Supply chain: lockfiles, review, provenance
**Why:** A dependency is code you run without having read it. (A03, A08, ASVS V15)
**How to apply:** Commit lockfiles; CI installs frozen. Review new dependencies (maintainers, age, install scripts). Disable lifecycle scripts where the package manager allows an allow-list (pnpm blocks them by default in recent lines; verify with [version-protocol.md](version-protocol.md)). Publish with provenance (npm trusted publishing/provenance, SLSA attestations) when you ship a package. Pin container images by digest. Keep an update bot on.
**When to deviate:** None for production. For prototypes, still commit the lockfile.

### 6. Scan: dependencies, secrets, workflows
**Why:** Known-bad is cheap to find. (A03, A02)
**How to apply:** Secrets: gitleaks (latest verified 2026-10-09: v8.30.1) or trufflehog (v3.99.2). Dependencies: `osv-scanner` (v2.6.0) across ecosystems, plus the native tool (`pnpm audit`, `govulncheck`, `pip-audit` / `uv`'s audit, `cargo deny` / `cargo audit`). Workflows: `zizmor` (v1.30.1) lints GitHub Actions for injection and permissions. Containers: a scanner in CI (Trivy or Grype). Fail CI on high+ severity with a fix available. Re-verify tool versions before pinning.
**When to deviate:** A finding with no fix and no reachable path: record an expiring exception in the repo with the reason.

### 7. GitHub Actions hardening
**Why:** Third-party actions run with your token and secrets; tags are movable. (A03, A02)
**How to apply:** Pin every `uses:` to a full commit SHA with the tag in a comment. Default `permissions: {}` or `contents: read`. Never `pull_request_target` with a checkout of PR code. Pass untrusted values (`github.event.*`) through `env:`, never interpolate into `run:`. Use OIDC to the cloud instead of long-lived keys. Protect the default branch; require review.
**When to deviate:** First-party `actions/*` may be pinned by tag in low-risk repos if your policy says so; SHA-pin is still the default.

### 8. Security headers and transport
**Why:** Cheap, high-leverage browser defences. (A02, ASVS V3, V12)
**How to apply:** HTTPS only with HSTS; `Content-Security-Policy` (nonce or hash based, no `unsafe-inline` scripts), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, framing via CSP `frame-ancestors`. Cookies: `HttpOnly; Secure; SameSite=Lax` (or `Strict`), `__Host-` prefix when possible. CORS: explicit origin allow-list, never `*` with credentials. See the frontend `set-up-security-headers` skill for framework wiring.
**When to deviate:** Third-party embeds that need relaxed framing or CSP entries: add the narrowest exception and comment it.

### 9. Secure configuration and defaults
**Why:** Most real incidents are a default left on. (A02, ASVS V13)
**How to apply:** Disable debug and verbose errors in production; no default credentials; admin interfaces off the public internet; infrastructure as code reviewed like code; state files (OpenTofu) encrypted and access-controlled, never committed.
**When to deviate:** Local development only.

### 10. Authentication and cryptography: use the platform
**Why:** Home-made auth and crypto fail in ways testing does not reveal. (A04, A07, ASVS V6, V7, V9, V10, V11)
**How to apply:** Use a maintained identity provider or library (Supabase Auth, an OIDC provider, framework auth). Passwords: Argon2id or scrypt via the library's default. Sessions: server-side or short-lived tokens with rotation; tokens never in `localStorage`. JWT: verify signature, `iss`, `aud`, `exp`; pin the algorithm. TLS 1.2+ (prefer 1.3). Random values from the OS CSPRNG. Never invent a cipher or a token format.
**When to deviate:** None. If the library cannot do it, change the library.

### 11. Log events without secrets or personal data
**Why:** Logs are copied to many systems and kept for long. They also need to show attacks. (A09, ASVS V16, V14)
**How to apply:** Follow [logging-contract.md](logging-contract.md): redact by default; log auth failures, access-denied and admin actions with actor and trace id; alert on spikes.
**When to deviate:** Audit logs that legally need identifiers: separate store, restricted access, retention set.

### 12. Data protection
**Why:** The cheapest breach is the data you did not keep. (A01, A04, ASVS V14)
**How to apply:** Collect the minimum; encrypt in transit and at rest (managed disk or column-level for sensitive fields); define retention and deletion; separate production data from dev/stg (no prod dumps in dev without masking); back up and test restores.
**When to deviate:** Legal retention overrides deletion: document the reason.

### 13. Handle errors on purpose
**Why:** Unhandled errors fail open, leak stack traces, or leave half-written state. (A10, ASVS V16, V15)
**How to apply:** Fail closed on auth and authorization errors. One error boundary per process and per request. Return a stable error shape with a correlation id, never internals. Transactions around multi-step writes; timeouts and retries with jitter on every network call; resource cleanup in `finally` / `defer` / `Drop`.
**When to deviate:** Idempotent best-effort work (analytics beacons) may swallow errors after logging at `warn`.

## Reporting format for audits

Severity: **Critical** (exploitable now, data or account takeover), **High** (exploitable with a precondition), **Medium** (weakens a layer), **Low** (hygiene). Every finding: `path:line` evidence, the baseline rule number, the OWASP/ASVS reference, the fix. See [audit-security](../audit-security/SKILL.md).

## When to deviate

The baseline is a floor for software that holds real users or data. A local-only prototype may skip rules 8 and 12 and must say so in its README. No project skips rules 1, 3 and 4.
