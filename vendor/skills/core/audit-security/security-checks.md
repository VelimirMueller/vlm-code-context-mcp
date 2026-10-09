# Security Checks

Tool versions below were verified on 2026-10-09 (GitHub releases / registries); re-verify before use ([version-protocol.md](../_shared/version-protocol.md)). Flags change between majors: read `<tool> --help` first.

## Rule: Scan the tree and the history for secrets
**Why:** Deleting a committed secret does not remove it from history; it must be rotated. (baseline rule 1)
**How to apply:**

```bash
gitleaks dir . --no-banner --redact          # working tree (gitleaks v8.30.1: `dir` replaces `detect --no-git`; verify with --help)
gitleaks git . --no-banner --redact          # full history
```

Alternatives: `trufflehog git file://. --only-verified` (v3.99.2; `--only-verified` limits to credentials it confirms live). Also grep for client-exposed secrets: `grep -rnE "(VITE|NUXT_PUBLIC|NEXT_PUBLIC)_[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)" --include='.env*' --include='*.ts' --include='*.vue' --include='*.tsx' .`, and `git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v example`.
**Anti-example:** Reporting the secret value in the audit output. Show path, line, rule id, and a redacted prefix.

## Rule: Audit dependencies with the native tool and one cross-ecosystem tool
**Why:** Native tools know the lockfile format; a cross-ecosystem scanner catches mixed repos.
**How to apply:**

| Ecosystem | Command | Note |
|---|---|---|
| any | `osv-scanner scan source -r .` (v2.6.0; verify subcommand with `--help`) | uses OSV database; reads lockfiles |
| pnpm | `pnpm audit --prod` | add `--audit-level high` in CI |
| npm | `npm audit --omit=dev` | |
| Go | `govulncheck ./...` | reports only reachable vulns; install with `go install golang.org/x/vuln/cmd/govulncheck@latest`, pin the version in CI |
| Python (uv) | `uv audit` where available, else `pip-audit -r <(uv export --no-hashes)` | verify `uv audit` exists in your uv version |
| Rust | `cargo deny check advisories` (cargo-deny 0.20.2) or `cargo audit` | `deny.toml` also gates licences and bans |
| Containers | `trivy image <ref>` or `grype <ref>` | scan the built image in CI |

Triage: reachable and fixable → finding; unreachable or no fix → expiring exception with reason; dev-only → Low.

## Rule: Review authorization by reading, per resource
**Why:** Scanners do not understand ownership. Broken access control is OWASP A01:2025. (baseline rule 3)
**How to apply:** List every route, handler, RPC and server action, and every table. For each, answer:

- [ ] Is authentication required? Where is it enforced (middleware, handler, RLS)?
- [ ] Is the actor's right to *this object* checked (ownership/tenant), not just role?
- [ ] Is the check on the server and next to the data (RLS policy, query takes actor)?
- [ ] Do list endpoints filter by actor, or only single-object endpoints?
- [ ] Are mutations checked separately from reads?
- [ ] Is deny the default for new tables and routes?
- [ ] Does a test prove user A cannot read or change user B's record?

Postgres/Supabase: `grep -rn "enable row level security" supabase/migrations` and compare to the list of tables; any table in an exposed schema without RLS is **High** or **Critical**. Check that `service_role` keys appear only in server code. Client-side role checks are never findings of "OK".

## Rule: Check input and output boundaries
**Why:** Injection and XSS arise where data meets an interpreter. (baseline rule 4)
**How to apply:**

```bash
grep -rnE "(query|execute|raw|sql)\s*\(\s*[\`'\"].*(\\$\{|\" *\+|' *\+)" --include='*.ts' --include='*.js' --include='*.py' --include='*.go' .
grep -rnE "dangerouslySetInnerHTML|v-html|innerHTML *=|eval\(|new Function\(|child_process|exec\(|os/exec|subprocess\..*shell=True" .
```

Then read each hit: is the value user-controlled? Is there a schema parse at the edge for every route? Are uploads type- and size-limited, stored outside the web root? Are outbound fetches to user-supplied URLs allow-listed (SSRF)?

## Rule: Check headers, cookies and CORS on the running or configured app
**Why:** Cheap browser defences. (baseline rule 8)
**How to apply:**

```bash
curl -sI https://<host>/ | grep -iE "strict-transport|content-security|x-content-type|referrer-policy|permissions-policy|frame-ancestors|x-frame"
```

Without a live URL, read the config (`vercel.json`, `nuxt.config`, `next.config`, server middleware). Check: HSTS, CSP without `unsafe-inline` for scripts, `nosniff`, referrer policy, cookie flags (`HttpOnly`, `Secure`, `SameSite`), CORS allow-list (no `*` with credentials). Framework wiring: the frontend `set-up-security-headers` skill.

## Rule: Harden CI as code that holds your secrets
**Why:** Workflows run third-party code with your token. (baseline rule 7)
**How to apply:**

```bash
zizmor .github/workflows        # zizmor v1.30.1: injection, permissions, unpinned actions
grep -rnE "uses: [^#]+@(v[0-9]|main|master)" .github/workflows   # actions not pinned to a SHA
grep -rn "pull_request_target" .github/workflows
grep -rLn "permissions:" .github/workflows                        # workflows without explicit permissions
```

Findings: unpinned `uses:`, missing `permissions:`, `pull_request_target` that checks out PR code, `${{ github.event.* }}` interpolated in `run:`, long-lived cloud keys where OIDC is possible, secrets echoed in logs.

## Rule: Check configuration, IaC and containers
**Why:** Defaults left on cause most incidents. (baseline rule 9)
**How to apply:** Dockerfiles: `USER` non-root, no secrets in `ARG`/`ENV`, base image pinned by digest, no `latest`. IaC (`*.tf`): `tofu validate`, and a scanner such as `trivy config .` or `checkov -d .` (verify current); look for public buckets, `0.0.0.0/0` ingress, unencrypted storage, state files committed (`git ls-files | grep -E "\.tfstate"`). Debug flags and verbose errors off in production config.

## Rule: Check logging and error handling
**Why:** Secrets leak through logs; attacks hide without them. (baseline rules 11, 13)
**How to apply:** `grep -rnE "(console\.log|print|println|fmt\.Print)" src` for stray logs; look at logger redaction config against [logging-contract.md](../_shared/logging-contract.md); look for `catch {}` with no handling; check that auth failures and access-denied are logged; check that error responses carry a correlation id and no stack trace.

## When to deviate

- Local-only prototypes: run groups A and B only and say so.
- Repos where a scanner is blocked by policy: use the nearest equivalent and record which one.
- Pen-test-level assurance: this skill is a code review, not a penetration test. Say so in the report.
