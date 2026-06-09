---
name: configure-linting
description: Use when setting up linting and formatting in a frontend project — installs Biome (lint + import sorting) and Prettier (formatting with Tailwind class sorting) with Biome's formatter disabled so they don't fight, plus a lefthook pre-commit hook and a CI check.
---

# Configure Linting

## 1. Audit current state

Detect what's already present:
```bash
ls biome.json biome.jsonc .prettierrc* prettier.config.* lefthook.yml .husky 2>/dev/null
grep -E '"(@biomejs/biome|prettier|prettier-plugin-tailwindcss|lefthook|eslint)"' package.json 2>/dev/null
```

- **ESLint present?** This skill uses Biome for linting. If `eslint` plus a tuned custom ruleset exist, migrate deliberately (`biome migrate eslint`) — don't silently delete a config someone tuned. See `lint-and-format.md`.
- **Prettier already configured?** Keep it; just enforce the Tailwind plugin and the Biome-formatter-off split below.

## 2. Decide what to do

- Nothing → full setup (steps 3–7).
- Biome and Prettier both present but both formatting → apply the division of labor (step 4): Biome lints, Prettier formats, Biome's formatter off.
- Already split correctly → confirm lefthook + CI script, then exit "Linting already in place."

## 3. Install (only what's missing)

```bash
pnpm add -D -E @biomejs/biome
pnpm add -D prettier prettier-plugin-tailwindcss lefthook
```

`-E` pins Biome to an exact version: a linter minor bump can add rules that fail CI, so reproducibility beats auto-upgrade here.

## 4. Division of labor — the one rule that matters

**Biome lints + sorts imports. Prettier formats. Biome's formatter is OFF.** Two formatters rewrite each other's output; disabling Biome's keeps Prettier (and `prettier-plugin-tailwindcss` class sorting) the single source of truth for layout.

### `biome.json`
```json
{
  "$schema": "https://biomejs.dev/schemas/2.2.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true },
  "formatter": { "enabled": false },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "useImportType": "error" }
    },
    "domains": { "react": "recommended" }
  },
  "assist": {
    "enabled": true,
    "actions": { "source": { "organizeImports": "on" } }
  }
}
```

`style.useImportType` mirrors the `verbatimModuleSyntax` flag from `configure-typescript` — linter and compiler agree on `import type`. **Vue projects:** drop the `react` domain; Biome lints the `<script>`/TS in `.vue` files but not template semantics (see `lint-and-format.md`). Match the `$schema` version to the Biome you installed.

### `.prettierrc.json`
```json
{
  "singleQuote": true,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### `.prettierignore`
```
dist
coverage
pnpm-lock.yaml
```
(Prettier does not read `.gitignore` automatically.)

## 5. package.json scripts

```json
{
  "scripts": {
    "lint": "biome check",
    "lint:fix": "biome check --write",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "biome ci && prettier --check ."
  }
}
```

Local + pre-commit use `--write` (autofix); CI uses `biome ci` + `prettier --check` (report, never fix).

## 6. Pre-commit with lefthook

lefthook (a single Go binary, no npm post-install) over husky. Keep the hook fast — fix staged files only.

### `lefthook.yml`
```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{js,jsx,ts,tsx,json,jsonc}"
      run: pnpm biome check --write --no-errors-on-unmatched {staged_files}
      stage_fixed: true
    prettier:
      glob: "*.{js,jsx,ts,tsx,css,md,json,yaml,yml,html}"
      run: pnpm prettier --write {staged_files}
      stage_fixed: true
```

Install the git hooks once:
```bash
pnpm lefthook install
```

## 7. Verify

```bash
pnpm biome check && pnpm prettier --check .
```

Expected: both pass (or report fixable issues — run `pnpm lint:fix` / `pnpm format`, then re-check). `pnpm lefthook run pre-commit` exercises the hook. The same `check` runs in CI, so the hook is a convenience, not the gate.

## References
- ./lint-and-format.md — Biome-vs-Prettier division of labor, rule rationale, the `useImportType` ↔ `verbatimModuleSyntax` link, the Vue-template caveat, ESLint migration, CI wiring.
- ../_shared/stack-versions.md — Biome / Prettier / tooling version policy.
- ../_shared/conventions.md — `@/` alias, file naming, `stores/` rule.
