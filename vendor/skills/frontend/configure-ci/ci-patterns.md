# CI Patterns

Reference for `configure-ci`.

## Rule: CI is the real gate; the pre-commit hook is a convenience
**Why:** A lefthook pre-commit hook can be skipped with `--no-verify`. Only a required CI check actually blocks a merge.
**How to apply:** Run lint, types, test, build, and e2e in CI; mark them required in branch protection. The hook just gives faster local feedback.

## Rule: install with `--frozen-lockfile`
**Why:** CI must build exactly what the lockfile pins, never silently resolve newer versions.
**How to apply:** `pnpm install --frozen-lockfile`. It fails if the lockfile is stale — which is the signal you want.

## Rule: cache the pnpm store and Playwright browsers
**Why:** Re-downloading dependencies and browsers on every run is the bulk of CI time.
**How to apply:** `actions/setup-node` with `cache: pnpm` (after `pnpm/action-setup`); install Playwright browsers with `--with-deps`.

## Rule: fail the build on a bundle-budget regression
**Why:** Performance rots one innocent dependency at a time; a budget makes the regression a red check, not a production surprise.
**How to apply:** run `size-limit` in the build job (the budget from `optimize-performance`).

## Rule: a preview deploy per PR
**Why:** Green checks prove it builds; a preview proves it *works*. Reviewers should click the real thing.
**How to apply:** Netlify deploy previews via native Git integration. CI gates the merge; Netlify deploys.

## When to deviate
- **Monorepo:** run affected-only (Turborepo/Nx) instead of the whole graph.
- **Node matrix:** a library tests across Node versions; an app pins the one in its `.nvmrc`.
- **Other hosts:** Vercel and Cloudflare Pages have equivalent preview-deploy integrations.
