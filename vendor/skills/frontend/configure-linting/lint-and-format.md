# Lint & Format — Biome + Prettier

Reference for `configure-linting`. Why two tools, who owns what, and how to keep them from fighting.

## Rule: Biome lints + sorts imports; Prettier formats; Biome's formatter is off
**Why:** Biome's linter is Rust-fast and its import-sorting is deterministic; Prettier has the mature formatting ecosystem — notably `prettier-plugin-tailwindcss`, which sorts Tailwind classes into the canonical order. Two formatters fight over the same bytes. Disabling Biome's formatter makes Prettier the single source of truth for layout and Biome the single source for lint + import order.
**How to apply:** `biome.json` sets `formatter.enabled: false` and `assist.actions.source.organizeImports: "on"`; Prettier owns `.prettierrc`. Run Biome first (lint-fix + organize imports), then Prettier (format).

**Anti-example:**
```jsonc
// bad: both formatters enabled — they rewrite each other on every save
{ "formatter": { "enabled": true } } // in biome.json, while Prettier is also active
```

## Rule: `useImportType` mirrors `verbatimModuleSyntax`
**Why:** `configure-typescript` sets `verbatimModuleSyntax: true`, which *requires* `import type` for type-only imports. Biome's `style/useImportType` autofixes imports into that shape, so the linter and the compiler never disagree.
**How to apply:** Keep `style.useImportType: "error"` in `biome.json`.

## Rule: pre-commit autofixes, CI verifies — never trust the hook alone
**Why:** A pre-commit hook can be skipped (`git commit --no-verify`) and only sees staged files. CI is the gate that can't be bypassed.
**How to apply:** The hook runs `biome check --write` + `prettier --write` on staged files with `stage_fixed: true`; CI runs `biome ci` + `prettier --check .` over the whole tree.

## Rule: lefthook over husky
**Why:** lefthook is a single Go binary driven by one `lefthook.yml` — no `prepare` lifecycle script, no per-hook shell file, parallel execution by default. husky works but adds npm lifecycle scripts and a `.husky/` file per hook.
**How to apply:** `pnpm add -D lefthook`, write `lefthook.yml`, run `pnpm lefthook install` once.

## The Vue caveat
Biome lints the `<script>`/TypeScript inside `.vue` SFCs, but **not** Vue-template semantics (`v-for` keys, unused components, template a11y). If a Vue project needs deep template linting, add `eslint` + `eslint-plugin-vue` **for templates only** and let Biome keep JS/TS — never run two linters over the same `.ts`. Knowing this boundary is the point; don't pretend Biome fully replaces `eslint-plugin-vue` yet.

## Migrating off ESLint
`biome migrate eslint` reads an existing `.eslintrc` / `eslint.config.js` and ports the rules it supports. Run it, review the diff, then delete the ESLint config + deps. Keep ESLint only for things Biome can't do yet: **type-aware rules** (Biome's linter is not type-aware — e.g. `no-floating-promises`) or a plugin with no Biome equivalent.

## When to deviate
- **Biome-only (drop Prettier):** if you don't need `prettier-plugin-tailwindcss` (or you accept Biome's `useSortedClasses` nursery rule for Tailwind), enable Biome's formatter and remove Prettier — one tool, faster. This plugin keeps Prettier specifically for mature Tailwind class sorting.
- **Type-aware lint:** rules needing type information still require `typescript-eslint`. Add it narrowly alongside Biome if you genuinely need them; accept the second linter's cost.
