# Lint & Format — Biome only

Reference for `configure-linting`. Why one tool, what it covers, and where its edges are.

## Rule: Biome lints, formats, and sorts imports and classes — nothing else does
**Why:** Two formatters fight over the same bytes; two linters report the same problem twice and disagree on fixes. Biome does all four jobs in one Rust pass with one config, so the editor, the hook and CI produce the same output. The one feature that once justified Prettier — Tailwind class sorting — now ships as Biome's `useSortedClasses`.
**How to apply:** `formatter.enabled: true`, `assist.actions.source.organizeImports: "on"`, `nursery.useSortedClasses` with `"fix": "safe"`. No `.prettierrc`, no `eslint.config.*`.

**Anti-example:**
```jsonc
// bad: Biome formats while Prettier is still installed and on save in the editor
{ "formatter": { "enabled": true } } // + .prettierrc + prettier-plugin-tailwindcss
```

## Rule: keep the old output shape — map the Prettier options, don't restyle
**Why:** A formatter switch should not produce a diff on every line. Biome's defaults differ from Prettier's in one place that matters (tabs vs spaces).
**How to apply:** `biome migrate prettier --write` ports an existing `.prettierrc`. By hand: `formatter.indentStyle: "space"`, `javascript.formatter.quoteStyle: "single"`; line width 80 and 2-space indent are already the defaults. Land the reformat as its own commit (`style: format with biome`) so `git blame --ignore-rev` can skip it.

## Rule: `useImportType` mirrors `verbatimModuleSyntax`
**Why:** `configure-typescript` sets `verbatimModuleSyntax: true`, which *requires* `import type` for type-only imports. Biome's `style/useImportType` autofixes imports into that shape, so the linter and the compiler never disagree.
**How to apply:** Keep `style.useImportType: "error"` in `biome.json`.

## Rule: pre-commit autofixes, CI verifies — never trust the hook alone
**Why:** A pre-commit hook can be skipped (`git commit --no-verify`) and only sees staged files. CI is the gate that can't be bypassed.
**How to apply:** The hook runs `biome check --write` on staged files with `stage_fixed: true`; CI runs `biome ci` over the whole tree.

## Rule: lefthook over husky
**Why:** lefthook is one Go binary driven by one `lefthook.yml`; it filters by glob, passes `{staged_files}` and re-stages fixes (`stage_fixed`) without extra tooling. husky is a thin hook runner: you add `lint-staged` for the staged-file part and a `.husky/` shell file per hook. Both work; lefthook is fewer moving parts (verified: a nested `src/deep/a.ts` was fixed and re-staged on commit with the config in the skill).
**How to apply:** `pnpm add -D lefthook`, write `lefthook.yml`, add `"prepare": "lefthook install"` so every clone gets the hooks (pnpm skips dependency install scripts, and the lefthook package relies on one).

## Vue: full SFC support, with a safety net
With `html.experimentalFullSupportEnabled: true`, Biome parses the whole SFC: the `vue` domain rules (`useVueVForKey`, `noVueVIfWithVFor`, `noVueSetupPropsReactivityLoss`, `useVueDefineMacrosOrder`, …), the a11y rules on the template, and the formatter. Without it, Biome sees only `<script>` and reports template-used variables as unused.

The support is labelled **experimental**, and the `vue` domain covers the essential/valid-* core of `eslint-plugin-vue`, not the full `eslint-plugin-vue` rule set. The safety net is `vue-tsc -b` (template type check, via `pnpm typecheck`) plus `tests/ui` with axe. Don't add ESLint back for `eslint-plugin-vue` unless a concrete bug class slips through both.

`useVueMultiWordComponentNames` is off on purpose: atoms are named `Button`, `Card`, `Input` in both frameworks, and PascalCase tags in an SFC never collide with native elements.

## Tailwind class sorting
`useSortedClasses` (nursery) sorts `class`/`className` and strings passed to the listed `functions`. Limits: it knows only the default Tailwind utilities (custom `@utility` and plugin variants are left unsorted), screen-variant order is not sorted, and whitespace inside the attribute collapses to single spaces. `"fix": "safe"` makes `--write` apply it; it stays at `warn` so a nursery change can't fail CI (`biome ci` exits non-zero on errors only, unless you pass `--error-on-warnings`).

## Migrating off ESLint
`biome migrate eslint --write` reads flat and legacy configs, `extends` and `.eslintignore`, and ports the rules Biome supports (`--include-inspired` also ports near-equivalents). It does **not** translate `vue/*` rules — the `vue` domain replaces them. Review the diff, then delete the ESLint config + deps.

## When to deviate
- **Type-aware rules** (`no-floating-promises`, `no-misused-promises`): Biome has `nursery/noFloatingPromises` and `nursery/noMisusedPromises` (type-inferred, not full type-checked) — try them first. If a codebase genuinely needs the full `typescript-eslint` typed set, add ESLint narrowly for those rules only and accept the second tool's cost.
- **React Compiler lint rules** live in `eslint-plugin-react-hooks` (`recommended`), not in Biome. The compiler skips a component that breaks the Rules of React instead of miscompiling it, so the default is to do without; add the plugin alone if you want the warnings at lint time.
- **A solo or tiny repo:** skip lefthook; `biome ci` in CI is the gate and the editor formats on save. The hook pays once several people commit.
- **An org-wide Prettier/ESLint setup** (a work repo with its own guidelines): follow the repo. These skills are a preference, not a mandate.
