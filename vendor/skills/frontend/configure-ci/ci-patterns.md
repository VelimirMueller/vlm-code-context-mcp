# CI Patterns

Reference for `configure-ci`.

## Rule: CI is the real gate; the pre-commit hook is a convenience
**Why:** A lefthook pre-commit hook can be skipped with `--no-verify`. Only a required CI check actually blocks a merge.
**How to apply:** Run lint, types, audit, test, build, and e2e in CI; mark them required in branch protection. The hook just gives faster local feedback.

## Rule: install with `--frozen-lockfile`
**Why:** CI must build exactly what the lockfile pins, never silently resolve newer versions.
**How to apply:** `pnpm install --frozen-lockfile` (npm `ci`, yarn `--immutable`, bun `--frozen-lockfile`). It fails if the lockfile is stale — which is the signal you want.

## Rule: pin every action to a full commit SHA; bump with Dependabot
**Why:** A tag is a movable pointer. A compromised or force-moved tag runs attacker code in your CI with your token. GitHub's secure-use guide calls a full-length commit SHA "the only way to use an action as an immutable release". Readable `# v7.0.1` comments keep the pin reviewable.
**How to apply:** `uses: owner/action@<40-hex> # vX.Y.Z`. Resolve a SHA with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha` (this dereferences annotated tags; the `git/ref/tags` endpoint can return the tag object instead). Dependabot's `github-actions` ecosystem updates SHA and comment together. The server-deploy pipeline in `../../infra/set-up-delivery-pipeline/` follows the same rule and can enforce it org-wide.

**Anti-example:**
```yaml
- uses: actions/checkout@v7      # movable tag
- uses: some-org/action@main     # a branch is worse
```

## Rule: least-privilege token, no persisted credentials
**Why:** The default `GITHUB_TOKEN` can carry write scopes, and `actions/checkout` stores it in `.git/config` for later steps. A compromised dependency in the build then holds a write token.
**How to apply:** Top-level `permissions: contents: read`; grant more per job only where a step needs it. `persist-credentials: false` on checkout. Never use `pull_request_target` to run PR code: it exposes secrets to forks.

## Rule: cancel superseded runs, cap every job
**Why:** A new push makes the old run's result irrelevant, and a hung browser or install otherwise burns the 6-hour default.
**How to apply:** `concurrency` with `cancel-in-progress` on PR refs only (a `main` run must finish: it may be the deploy source), and `timeout-minutes` per job.

## Rule: cache the package store, not the Playwright browsers
**Why:** The dependency download is the bulk of CI time and the package-manager cache is cheap and safe. Playwright's own CI guide advises against caching browser binaries: restoring the cache takes about as long as downloading them, and Linux system dependencies cannot be cached at all.
**How to apply:** `actions/setup-node` with `cache: pnpm` (after `pnpm/action-setup`); `playwright install --with-deps chromium` every run, chromium only unless the suite needs more.

## Rule: fail the build on a bundle-budget regression
**Why:** Performance rots one innocent dependency at a time; a budget makes the regression a red check, not a production surprise.
**How to apply:** run `size-limit` in the build job (the budget from `optimize-performance`).

## Rule: a preview deploy per PR where the host offers one, built by the host
**Why:** Green checks prove it builds; a preview proves it *works*. Reviewers should click the real thing. Building a second time in the workflow doubles minutes and can diverge from what the host builds.
**How to apply:** Netlify deploy previews and Vercel preview deployments come from their Git integrations. CI gates the merge; the host deploys. Self-hosted has no native preview — see the host branch in `SKILL.md`. Previews of private apps stay behind the host's access protection.

## Rule: keep the generated route tree in git, or generate it before typecheck
**Why:** `pnpm typecheck` runs before any dev server or build, so a gitignored `routeTree.gen.ts` makes the typecheck fail on a clean checkout. TanStack's own examples commit it, and the diff shows route changes in review.
**How to apply:** Commit `src/routeTree.gen.ts` and exclude it from Biome (`set-up-routing`). If a project insists on ignoring it, add a generate step before `pnpm typecheck`.

## When to deviate
- **Monorepo:** run affected-only (Turborepo/Nx) instead of the whole graph.
- **Node matrix:** a library tests across Node versions; an app pins the one in its `.nvmrc`.
- **Other hosts:** Cloudflare Pages has an equivalent preview-deploy integration; add a branch to `SKILL.md` step 4.
- **Tags instead of SHAs:** acceptable only for actions your own org publishes and controls; never for third-party actions.
- **`pnpm/setup`:** pnpm's successor action installs pnpm 11+ and Node in one step; switch when the repo is on pnpm ≥ 11 and wants one action fewer.
