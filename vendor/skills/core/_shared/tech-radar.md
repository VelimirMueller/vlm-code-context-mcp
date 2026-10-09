# Tech Radar — 2026-10-09

What to reach for, what to try, what to watch, what to leave. Each version was checked on 2026-10-09 against the npm registry, PyPI JSON, crates.io, go.dev or GitHub releases (see [version-protocol.md](version-protocol.md)); announcements and release status were checked with web search that day. Ring meanings:

- **Adopt** — default choice. Stable, widely used, we would start a new project on it.
- **Trial** — stable enough for one project with a person who owns it. Use when the benefit is clear.
- **Assess** — worth reading and a spike. Not for production unless the owner opts in.
- **Hold** — do not start new work on it. Migrate when you touch it.

**Status words** (exactly these): *stable*, *rc/beta*, *announced*, *unverified*. Anticipated-but-not-stable items are marked **ANTICIPATED** and sit in Assess at best.
"Latest" below is the registry's `latest` dist-tag on 2026-10-09; it is a floor, not a pin.

## JS/TS toolchain

| Item | Ring | Latest (checked) | Why |
|---|---|---|---|
| Vite 8 (Rolldown bundler) | **Adopt** | vite 8.3.4, rolldown 1.2.13 (stable) | One Rust bundler for dev and build; same team as Oxc. Check plugin compatibility (`@vitejs/plugin-*` majors). |
| Oxc / oxlint | **Trial** | oxlint 1.87.0 | Very fast linter, type-aware rules via `oxlint-tsgolint`; fewer rules than ESLint. Use alone if rule coverage is enough, or beside Biome. oxfmt (0.72.0) is 0.x: **Assess**. |
| Biome | **Adopt** | 2.5.15 | One tool for lint and format, one config, fast. House default for TS in personal repos (see profile `lint_format.ts: biome`). Verify rule coverage for framework-specific needs (Vue templates are partial). |
| ESLint + Prettier | **Hold** (new projects) | — | Two tools, two configs, slow. Keep when plugins you rely on have no Biome/Oxc equivalent. |
| TypeScript 7 (native, Go port, `tsgo`) | **Trial** | typescript 7.0.2 on `latest` (stable); `@typescript/native-preview` is the old preview channel | Large speedups. Limits: the compiler API is not available yet in the old shape, so tools that embed `tsc` (for example `vue-tsc`) may need TypeScript 6 until they port. Check peer ranges. TypeScript 6.0 is the bridge line. |
| Node.js LTS | **Adopt** | Node 24 "Krypton" (24.21.0) is the active LTS; 26.x is Current, not LTS | Track the active LTS; pin in `mise.toml`/`.nvmrc`. |
| Bun | **Trial** | 1.4.2 | Fast runtime, package manager and test runner. Node-compat gaps still appear in edge cases; fine for tools and scripts, check before using it as a server runtime. |
| Deno | **Assess** | 2.9.6 | Strong security model and built-in tooling; ecosystem fit varies. Good for scripts and edge. |
| pnpm | **Adopt** | 12.10.1 | Strict, fast, content-addressed store; sound defaults on install scripts. Verify the current major's config keys before copying old `.npmrc`. |
| mise | **Adopt** | v2026.10.5 | One file for tool versions, env and tasks across languages. Replaces nvm/asdf. |
| just | **Adopt** | 1.58.0 | Plain task runner, language-agnostic; use it for polyglot repos, `package.json` scripts for pure JS. |
| Vitest | **Adopt** | 5.0.3 (5.0.0-rc and beta tags still exist; `latest` is 5.0.3) | Shares Vite config, fast, browser mode. Needs a recent Node (see its engines). |
| Playwright | **Adopt** | 1.64.0 | The default for end-to-end and component-in-browser tests; traces make failures debuggable. |
| Zod 4 / Standard Schema | **Adopt** | zod 4.6.5 | Schema at every edge. Standard Schema lets libraries accept Zod, Valibot or ArkType without a hard dependency. |
| Effect | **Assess** | effect 4.0.2 | Powerful typed errors, services and concurrency; a whole-program style with a learning cost. Trial in a service where error modelling pays. |

## Frameworks

| Item | Ring | Latest (checked) | Why |
|---|---|---|---|
| React 19 | **Adopt** | 19.3.0 | Stable; `<ViewTransition>` and Fragment refs shipped. |
| React Compiler | **Adopt** | `babel-plugin-react-compiler` 1.0 stable (see frontend `stack-versions.md`) | Automatic memoization; opt-in per framework; remove hand-written `useMemo`/`memo` only after measuring. |
| Vue 3.5 | **Adopt** | 3.5.43 (`latest`) | Stable. |
| Vue Vapor (3.6) | **Assess** — **ANTICIPATED** | 3.6.0-rc.10 on the `rc` tag; `latest` is still 3.5 | Feature-complete per its RC notes, opt-in per component, not stable. Do not ship in production without an owner opting in. |
| Next.js 16 | **Adopt** | 16.4.0 | Turbopack default, Cache Components, `proxy.ts`. Choose when you want Vercel-native React with server components. |
| Nuxt 4 | **Adopt** | 4.6.0 | The Vue meta-framework default. |
| TanStack Start | **Trial** | `@tanstack/react-start` 1.168.60 on `latest` | Type-safe routing on Vite. Third-party sources disagree on whether the 1.0 label was declared; the registry `latest` is a 1.x line. Verify the official release status before a production commit. |
| Astro | **Adopt** (content sites) | 7.3.8 | Islands, minimal JS; default for content and landing pages. |
| Tailwind CSS 4 | **Adopt** | 4.3.3 | CSS-first config, fast Oxide engine. |

## Backend and data

| Item | Ring | Latest (checked) | Why |
|---|---|---|---|
| Hono | **Adopt** | 4.13.13 | Small, typed, Web-standard API; runs on Node, Bun, Deno, edge. |
| Drizzle ORM | **Adopt** (0.x line), v1 **Assess** — **ANTICIPATED** | `latest` 0.45.4; `1.0.0-beta.22` on beta | SQL-first, typed. The 1.0 line is beta: do not ship it without an owner opting in. |
| sqlc (Go) | **Adopt** | v1.31.1 | SQL in, typed Go out; no runtime reflection. |
| Supabase | **Adopt** | — (platform) | Postgres + auth + storage with RLS; the Postgres is the portable part. Keep RLS on every table. |
| Vercel | **Adopt** | — (platform) | Best fit for Next/Nuxt/Astro frontends; keep infra as code (`vercel.json`/provider). |
| Hetzner, IONOS | **Adopt** (EU cost/sovereignty needs) | — | Plain VMs and managed services; pair with OpenTofu. |
| MCP (Model Context Protocol) | **Adopt** | spec 2026-07-28, `@modelcontextprotocol/server` 2.3.1 | The standard for giving AI clients tools. Use the v2 SDK: `@modelcontextprotocol/sdk` still installs v1 because its `latest` tag never moved. Spec revisions are frequent; see `build-mcp-server`. |

## Observability and infrastructure

| Item | Ring | Latest (checked) | Why |
|---|---|---|---|
| OpenTelemetry | **Adopt** | `@opentelemetry/api` 1.9.1; semconv v1.44.0; Collector v0.162.0 | One vendor-neutral seam; traces and metrics stable, JS logs SDK still Development. See [observability.md](observability.md). |
| SigNoz / grafana otel-lgtm / Sentry | **Adopt** as exporters | — | See [observability.md](observability.md). |
| OpenTofu | **Adopt** | v1.13.1 | Open-source Terraform fork under the Linux Foundation; state encryption built in. |
| Terraform (BUSL) | **Hold** | — | Licence change; use OpenTofu unless a vendor requires it. |
| zizmor | **Adopt** | v1.30.1 | Static analysis for GitHub Actions; see [security-baseline.md](security-baseline.md). |
| gitleaks | **Adopt** | v8.30.1 | Secret scanning in pre-commit and CI. |

## Python

| Item | Ring | Latest (checked) | Why |
|---|---|---|---|
| uv | **Adopt** | 0.12.24 | One tool for Python versions, env, lock and run. |
| ruff | **Adopt** | 0.16.10 | Lint and format; replaces flake8/isort/black. |
| ty | **Assess** — **ANTICIPATED (1.0)** | 0.0.85, PyPI classifier "Beta" | Fast type checker from Astral; pre-1.0. Run it beside mypy or pyright, do not gate CI on it alone yet. |
| structlog | **Adopt** | 26.1.0 | Structured logging; see [logging-contract.md](logging-contract.md). |
| FastAPI | **Adopt** | — (not re-verified here) | Typed APIs; unverified in this pass. |

## Go

| Item | Ring | Latest (checked) | Why |
|---|---|---|---|
| Go toolchain | **Adopt** | go1.27.2 | Boring on purpose; `log/slog` in stdlib; `govulncheck`. |
| golangci-lint | **Adopt** | v2.14.0 | One linter runner; v2 config format differs from v1, so migrate with its `migrate` command. |

## Rust

| Item | Ring | Latest (checked) | Why |
|---|---|---|---|
| Rust toolchain | **Adopt** | 1.99.0 (GitHub release) | clippy + rustfmt in CI; edition per project. |
| tracing | **Adopt** | crates.io max stable 0.1.44 | Spans plus events; bridges to OTel. |
| cargo-deny | **Adopt** | 0.20.2 | Licences, advisories, duplicate crates. |
| cargo-audit | **Trial** | not re-verified | Advisory scan; overlaps cargo-deny. Use one. |

## How to use this file

- Skills that scaffold read the Adopt row for the profile's language.
- [audit-toolchain](../audit-toolchain/SKILL.md) compares a repo against it.
- Update it with every verification pass, with the date at the top. An entry older than 90 days is `unverified` until rechecked.

## Unverified in this pass

FastAPI latest, cargo-audit latest, Deno/Bun production behaviour claims, Effect production maturity claims, TanStack Start 1.0 declaration status. Marked in the tables; recheck before relying on them.

## When to deviate

The radar ranks defaults, not truths. A team that already runs ESLint with a rich custom plugin set should not migrate for the radar's sake. Cost, skills and deadlines outweigh a ring.
