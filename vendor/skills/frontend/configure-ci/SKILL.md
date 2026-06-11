---
name: configure-ci
description: Use when setting up CI/CD for a frontend project — a GitHub Actions pipeline (install → lint → typecheck → test → build → e2e + bundle budget) that gates merges, plus Netlify preview deploys per pull request.
---

# Configure CI

The pipeline that makes "CI is the real gate" true: every PR must pass lint, types, tests, build, and e2e before merge, and gets a Netlify preview to click through.

## 1. Audit current state
```bash
ls .github/workflows/ netlify.toml .nvmrc 2>/dev/null
grep -E '"(lint|format|test|build|e2e|size)"' package.json 2>/dev/null   # the scripts CI will call
```
**Prerequisites:** `configure-linting` (Biome/Prettier), `configure-test-stack` (Vitest + Playwright), and a Node version in `.nvmrc` (`scaffold-frontend-project`). The bundle-budget step expects `size-limit` from `optimize-performance`.

## 2. Decide
- No workflow → full setup. Partial → add missing jobs. Present → confirm jobs cover lint, types, test, build, e2e.

## 3. The pipeline — `.github/workflows/ci.yml`
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec biome ci .
      - run: pnpm exec prettier --check .
      - run: pnpm exec tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test
      - run: pnpm exec playwright test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm exec size-limit
```
Match the script/binary names to your `package.json` (`pnpm test` = Vitest; `size-limit` only if `optimize-performance` wired it — else drop that step). `pnpm/action-setup@v4` reads the pnpm version from `package.json`'s `packageManager` field (set by `scaffold-frontend-project` via Corepack); if that field is absent, pin it with `with: { version: <n> }`.

## 4. Netlify preview deploys
Enable in the Netlify UI (Site → Build & deploy → Deploy previews) — Netlify builds a preview per PR automatically, no workflow code. Add the build config to `netlify.toml` (create if absent; `set-up-security-headers` owns the `[[headers]]` block, so merge):
```toml
[build]
  command = "pnpm build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
CI gates the merge; Netlify deploys the preview. Don't duplicate the build inside a workflow.

## 5. Make it the gate
Branch protection lives in GitHub settings, not the repo: Settings → Branches → protect `main` → require the `quality`, `test`, and `build` checks. Without this, CI is only advisory. (Document it — it can't be set from a committed file.)

## 6. Verify
Open a PR: the three jobs run and must pass, and Netlify posts a "Deploy Preview" link. Push a lint error → `quality` fails → merge is blocked.

## References
- ./ci-patterns.md — CI-as-the-gate, `--frozen-lockfile`, caching, the bundle budget, preview-per-PR, and when to deviate.
- ../configure-linting/SKILL.md — the lint/format the pipeline runs.
- ../configure-test-stack/SKILL.md — Vitest + Playwright.
- ../set-up-security-headers/SKILL.md — shares `netlify.toml` (owns the `[[headers]]` block).
