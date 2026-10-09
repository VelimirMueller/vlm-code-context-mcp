# Scaffold Choices

Reference for `scaffold-frontend-project`. The tooling decisions behind the front door.

## Rule: Vite as the build tool
**Why:** Vite is the default for SPAs in 2026 — instant dev server (native ESM), fast HMR, first-class TS/JSX, and the surrounding ecosystem (Vitest, plugins) assumes it. Vite 8 bundles with Rolldown; the config API is unchanged. Create React App is sunset; the React docs point SPA builders to Vite.
**How to apply:** `pnpm create vite@latest <name> --no-interactive --template react-compiler-ts | vue-ts`. These skills scaffold Vite SPAs. Nuxt and Next apps are scaffolded by their own CLIs; the folder standard, state, lint and test skills still apply (`../set-up-frontend-structure/folder-conventions.md`).

## Rule: React 19 or Vue 3.5 — ask, don't assume
**Why:** This is the only skill that runs before a `package.json` exists, so there's nothing to detect from. The choice drives every later skill's framework branch.
**How to apply:** AskUserQuestion. Vue 2 is EOL (rejected); default React to 19, Vue to 3.5.

## Rule: pin the package manager and the runtime
**Why:** Two machines on different pnpm or Node majors produce different lockfiles and different bugs. The `packageManager` field is read by Corepack and by pnpm itself, so one line fixes the version for every developer and for CI. pnpm is the default (strict `node_modules` layout, shared store); the profile or an existing lockfile can pick another tool (`../_shared/stack-versions.md`).
**How to apply:** `packageManager: "pnpm@<output of pnpm -v>"` in `package.json`; `.nvmrc` + `engines.node` pin the runtime to an LTS major.

## Rule: Tailwind v4, CSS-first
**Why:** v4 (the 2026 default) dropped `tailwind.config.js` and the three `@tailwind` directives for a single `@import "tailwindcss"` plus CSS-first `@theme` tokens. The `@tailwindcss/vite` plugin needs no `postcss.config` and no `content` globs; it reads Vite's module graph.
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

## Rule: SPA, Nuxt or Next — decide by who needs the HTML
**Why:** An app behind a login gains nothing from server rendering and pays for a server. Public, crawlable pages (landing, docs, shop) need HTML on first response.
**How to apply:** Signed-in tool or dashboard → Vite SPA. Public content or a BFF that hides tokens → Nuxt 4 (Vue) or Next 16 (React). Mixed → SPA for the app, prerendered pages for the public part (`../../landing/_shared/page-types.md`).

## When to deviate
- **A tiny throwaway or a library demo:** skip the `.nvmrc`/`engines`/`packageManager` pins; they pay off when a second person or CI joins.
- **Existing non-Vite project (Next/Nuxt/CRA):** don't migrate it as part of scaffolding. Document the build tool and skip this skill; the rest (structure, TS, lint, state) mostly still apply.
- **Monorepo:** scaffold into the correct workspace package; pin pnpm once at the workspace root.
