# Migration Map

## Rule: Estimate cost on a fixed scale
**Why:** An unscaled "easy" or "hard" cannot be ranked. A fixed scale lets the owner compare items and plan.
**How to apply:**

| Cost | Meaning | Typical |
|---|---|---|
| **S** | under half a day, one config file, no code changes | add `mise.toml`; pin Actions by SHA; add `.nvmrc` |
| **M** | one to three days; config plus mechanical code changes; CI changes | ESLint+Prettier → Biome; Node LTS bump; Jest → Vitest on a small suite |
| **L** | more than three days, or many files, or data/infra involved | JS → TypeScript; Terraform → OpenTofu with state migration; framework major |

Raise one step when there is no test coverage, when the change touches production data, or when the repo has many contributors in flight.
**When to deviate:** Spikes with a measured result beat the table; note the measurement.

## Rule: Name the skill that does the work
**Why:** A finding without an action path is a complaint. The catalogue has skills for most migrations; point at them.
**How to apply:** Use the map. A skill not installed is named with its plugin. No match → "no skill", offer `extend-skillset`.

| Gap | Likely skill | Plugin |
|---|---|---|
| Lint/format tool | `configure-linting` | frontendskills |
| TypeScript config / TS 7 | `configure-typescript` | frontendskills |
| Test runner | `configure-test-stack` | frontendskills |
| CI pins, caching, promotion | `configure-ci` (SPA) / `set-up-delivery-pipeline` (services) | frontendskills / infraskills |
| Env validation | `validate-env` | frontendskills |
| Security headers | `set-up-security-headers` | frontendskills |
| Logging seam, tracing, metrics | `set-up-observability` | backendskills |
| Collector, export pipeline | `deploy-otel-collector` | infraskills |
| IaC (Terraform → OpenTofu) | `set-up-opentofu` | infraskills |
| Container images | `containerize-service` | infraskills |
| Secrets handling | `manage-secrets` | infraskills |
| Runtime manager, task runner, git hooks | `set-up-dev-toolchain` | cliskills |
| Security posture | `audit-security` | devcore |
| Commit/PR hygiene | `write-commit-messages`, `write-pull-requests` | devcore |

Check that a skill exists (`/plugin` lists enabled plugins' skills) before naming one.

## Common migrations (what to check)

- **ESLint+Prettier → Biome**: `biome migrate eslint --write` and `biome migrate prettier --write` exist; verify against the current Biome docs. Check for plugin rules without equivalents; keep ESLint for those only, scoped.
- **Node bump**: change `mise.toml`/`.nvmrc`, `engines`, CI matrix, Docker base image together; read the release notes of the new line.
- **npm/yarn → pnpm**: delete the old lockfile in the same PR; check phantom dependencies on first `pnpm install`.
- **TypeScript 6 → 7**: check each tool's peer range for `typescript` (`npm view <pkg> peerDependencies`) before bumping; tools that use the compiler API may lag.
- **Terraform → OpenTofu**: state is compatible within version limits; verify the OpenTofu migration guide for your version; run `tofu plan` and expect no diff.

Each: one PR, a rollback line, a verify command.

## When to deviate

A Hold item with no pain, no security issue and no upcoming change stays. List it under "Leave alone" with the trigger that would change that.
