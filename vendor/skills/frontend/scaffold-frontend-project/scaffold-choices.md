# Scaffold Choices

Reference for `scaffold-frontend-project`. The tooling decisions behind the front door.

## Rule: Vite as the build tool
**Why:** Vite is the default for SPAs in 2026 — instant dev server (native ESM), fast HMR, first-class TS/JSX, and the surrounding ecosystem (Vitest, plugins) assumes it. Its bundler is moving to Rolldown under the hood; the config API is unchanged.
**How to apply:** `pnpm create vite@latest <name> --template react-ts | vue-ts`. These skills target Vite SPAs; SSR/RSC frameworks (Next, Nuxt) are out of scope.

## Rule: React 19 or Vue 3 — ask, don't assume
**Why:** This is the only skill that runs before a `package.json` exists, so there's nothing to detect from. The choice drives every later skill's framework branch.
**How to apply:** AskUserQuestion. Vue 2 is EOL (rejected); default React to 19, Vue to 3.

## Rule: pnpm, pinned via Corepack
**Why:** pnpm's content-addressable store is fast and its strict hoisting catches phantom-dependency bugs. Pinning the package manager means every machine and CI use the same one — no "works on my npm" drift.
**How to apply:** `packageManager: "pnpm@<version>"` in `package.json` (Corepack reads it); `.nvmrc` + `engines.node` pin the runtime to the active LTS.

## Rule: Tailwind v4, CSS-first
**Why:** v4 (the 2026 default) dropped `tailwind.config.js` and the three `@tailwind` directives for a single `@import "tailwindcss"` plus CSS-first `@theme` tokens. The `@tailwindcss/vite` plugin is faster than the old PostCSS pipeline and needs no `postcss.config`.
**How to apply:** `@tailwindcss/vite` in `vite.config`; `@import "tailwindcss"` in the entry stylesheet. Tokens and theming belong to a future `set-up-design-system` skill, not here.

**Anti-example:**
```css
/* bad: Tailwind v3 directives — v4 ignores them */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Rule: scaffolding is idempotent — never clobber an existing project
**Why:** Re-running `create vite` over a real project would overwrite work. The audit gate makes the skill safe to run anywhere.
**How to apply:** If `package.json` + a Vite config exist, switch to verify-mode (check the Node pin, pnpm, and Tailwind v4 wiring) and hand off to `clean-frontend-scaffolding`.

## When to deviate
- **Existing non-Vite project (Next/Nuxt/CRA):** don't migrate it as part of scaffolding. Document the build tool and skip this skill; the rest (structure, TS, lint, state) mostly still apply.
- **Monorepo:** scaffold into the correct workspace package; pin pnpm once at the workspace root.
