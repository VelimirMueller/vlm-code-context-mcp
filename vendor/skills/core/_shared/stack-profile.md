# Stack Profile

The one file that tells every skill what this project uses, so no skill asks what the repo already answers.
Written by [`set-up-stack-profile`](../set-up-stack-profile/SKILL.md). Read by step 1 ("Audit") of every skill in every plugin.

## Where it lives and which one wins

Precedence, highest first:

1. Project `.claude/stack-profile.md` — this repo's truth.
2. User `~/.claude/stack-profile.md` — your personal defaults for new repos.
3. Repo detection — lockfiles, manifests, config files (table below).
4. The skill's own default.

**Why:** the project knows its deviations; the user file only encodes taste; detection is a fact but cannot see intent (a `package.json` does not say you *want* Biome); a skill default is a guess.
Merge is per key, not per file: a project that sets only `backend` still inherits `lint_format` from the user file.
A key set to `none` is an answer, not a gap — do not fall through on `none`.

## File shape

YAML frontmatter, then free-text notes (deviations and why). The frontmatter is binding; the notes are for humans and for the next audit.

```yaml
---
profile_version: 1
languages: [typescript, go, python, rust]
package_manager: pnpm
runtime_manager: mise
frontend: { framework: vue, meta: nuxt }
backend: { track: hono }
database: { engine: postgres, orm: drizzle, host: supabase }
hosting: [vercel]
iac: opentofu
ci: github-actions
observability: { otel: true, backend: signoz }
lint_format: { ts: biome, go: golangci-lint, python: ruff, rust: clippy+rustfmt }
tests: { layout: tests-dir }
task_runner: mise
ai: { provider: anthropic, rag_store: pgvector }
---
Free-text notes: deviations and why.
```

## Keys

| Key | Allowed values | Default when unset and undetectable | Read by |
|---|---|---|---|
| `profile_version` | `1` | `1` | `set-up-stack-profile` (migration on bump) |
| `languages` | list of `typescript`, `javascript`, `go`, `python`, `rust`, `other:<name>` | detect; else ask | every skill (track selection), `audit-toolchain` |
| `package_manager` | `pnpm`, `npm`, `bun`, `yarn`, `uv`, `go`, `cargo` | `pnpm` for JS/TS, `uv` for Python, `go`, `cargo` | scaffold, CI, install steps in every skill |
| `runtime_manager` | `mise`, `nvm`, `asdf`, `none` | `mise` for new repos; detected value for existing ones | scaffold, CI (`jdx/mise-action`), `audit-toolchain` |
| `frontend.framework` | `react`, `vue`, `none` | ask (the choice changes all output) | all frontend skills |
| `frontend.meta` | `vite`, `nuxt`, `next`, `none` | `vite` for SPAs | routing, head, SSR, env, deploy skills |
| `backend.track` | `hono`, `nextjs`, `supabase`, `go`, `fastapi`, `none` | `none` | all backend skills |
| `database.engine` | `postgres`, `sqlite`, `mysql`, `none` | `postgres` | backend DB skills, `audit-security` |
| `database.orm` | `drizzle`, `sqlc`, `sqlalchemy`, `none` | by language: TS `drizzle`, Go `sqlc`, Python `sqlalchemy` | schema, migration, query skills |
| `database.host` | `supabase`, `neon`, `self-hosted`, `none`, `other:<name>` | `none` | connection, RLS, backup skills |
| `hosting` | list of `vercel`, `netlify`, `hetzner`, `ionos`, `supabase`, `none` | `none` | deploy, infra, headers, env skills |
| `iac` | `opentofu`, `none` | `none` | infra skills, `audit-security` (state, secrets) |
| `ci` | `github-actions`, `gitlab-ci`, `none` | `github-actions` if `.github/` exists | CI skills, `audit-security` (supply chain) |
| `observability.otel` | `true`, `false` | `true` for services, `false` for static sites | logging, tracing, `observability.md` consumers |
| `observability.backend` | `signoz`, `grafana-lgtm`, `sentry`, `none` | `none` (OTLP exporter env left to the deploy) | exporter config only |
| `lint_format.<lang>` | ts: `biome`, `eslint+prettier`, `oxlint+oxfmt`; go: `golangci-lint`; python: `ruff`; rust: `clippy+rustfmt` | per `tech-radar.md` Adopt row | lint skills, CI, `audit-toolchain` |
| `tests.layout` | `tests-dir`, `colocated` | `tests-dir` | test skills |
| `task_runner` | `just`, `mise`, `package-scripts`, `make` | `package-scripts` for pure JS/TS; `mise` for polyglot (mise already pins the runtimes, so one tool and one file); `just` only when the repo already has a `justfile` | CI, docs, every "run this" instruction |
| `ai.provider` | `anthropic`, `openai`, `google`, `local`, `none` | `none` | `aiskills` |
| `ai.rag_store` | `pgvector`, `sqlite-vec`, `qdrant`, `none` | `none` | `aiskills` RAG skills |

Notes for readers:

- Unknown keys are kept and ignored. Unknown values are treated as `other:<value>`: do not silently coerce them.
- A skill that needs a key the profile lacks detects first. It asks **one** question only when detection is ambiguous *and* the answer changes its output; then it suggests running `set-up-stack-profile`.
- Skills never write the profile. Only `set-up-stack-profile` does. A skill that learns a new fact reports it and suggests a re-run.

## Detection heuristics

| Evidence | Profile value |
|---|---|
| `pnpm-lock.yaml` / `package-lock.json` / `bun.lock` or `bun.lockb` / `yarn.lock` | `package_manager: pnpm` / `npm` / `bun` / `yarn` |
| `uv.lock` or `[tool.uv]` in `pyproject.toml` | `package_manager: uv`, `languages += python` |
| `go.mod` / `Cargo.toml` | `languages += go` / `rust`; `package_manager: go` / `cargo` |
| `tsconfig.json` or `typescript` in `package.json` | `languages += typescript` |
| `mise.toml` or `.mise.toml` / `.tool-versions` / `.nvmrc` | `runtime_manager: mise` / `asdf` / `nvm` |
| `react` or `vue` in `dependencies` | `frontend.framework` |
| `nuxt.config.*` / `next.config.*` / `vite.config.*` | `frontend.meta: nuxt` / `next` / `vite` |
| `hono` in deps | `backend.track: hono` |
| `supabase/config.toml` | `backend.track: supabase`, `database.host: supabase` |
| `main.go` or `cmd/` with a `net/http` or router import | `backend.track: go` |
| `fastapi` in `pyproject.toml` | `backend.track: fastapi` |
| `drizzle.config.*` / `sqlc.yaml` / `sqlalchemy` in deps | `database.orm` |
| `docker-compose*.yml` with `postgres` image, `postgres`/`pg`/`postgresql` driver in deps | `database.engine: postgres` |
| `vercel.json`, `vercel.ts` or `.vercel/` | `hosting += vercel` |
| `netlify.toml` | `hosting += netlify` |
| `*.tf` with `provider "hcloud"` / `provider "ionoscloud"` | `hosting += hetzner` / `ionos` |
| `*.tf` files and `.terraform.lock.hcl` | `iac: opentofu` (check for `tofu` in CI or `mise.toml` before assuming; Terraform is a Hold item) |
| `.github/workflows/` / `.gitlab-ci.yml` | `ci: github-actions` / `gitlab-ci` |
| `@opentelemetry/*`, `go.opentelemetry.io`, `opentelemetry-*` (Python), `tracing-opentelemetry` | `observability.otel: true` |
| `@sentry/*` / `sentry-sdk` / `sentry` crate | `observability.backend: sentry` |
| `biome.json(c)` / `eslint.config.*` / `.oxlintrc.json` / `.golangci.y*ml` / `[tool.ruff]` / `rustfmt.toml` | `lint_format.<lang>` |
| `tests/` dir at root vs `*.test.ts` beside sources | `tests.layout: tests-dir` / `colocated` |
| `justfile` / `[tasks]` in `mise.toml` / `Makefile` / only `scripts` in `package.json` | `task_runner` |
| `@anthropic-ai/sdk` / `anthropic` / `openai` / `@google/genai` | `ai.provider` |
| `pgvector` extension in migrations, `sqlite-vec`, `@qdrant/*` | `ai.rag_store` |

Detection reports a *finding*, not an instruction: "found `pnpm-lock.yaml`" is evidence; whether that is the *wanted* manager is for the wizard to confirm when it matters.

## Gaps are normal

A profile may omit keys. Omitted means "not decided": the skill falls through the precedence chain. `none` means "decided: not used".

## Versioning the schema

`profile_version` bumps only when a key is renamed or its meaning changes. Adding a key or a value does not bump it. On a bump, the wizard migrates the file and shows the diff.

## When to deviate

- A repo with two distinct stacks (a monorepo with a Go service and a Nuxt app): write one profile per package directory (`apps/web/.claude/stack-profile.md`); the nearest profile wins.
- A one-off script or spike: skip the profile; detection is enough.
