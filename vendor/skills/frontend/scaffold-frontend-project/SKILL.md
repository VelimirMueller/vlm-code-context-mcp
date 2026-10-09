---
name: scaffold-frontend-project
description: Use when starting a new frontend app from an empty directory - scaffolds a Vite 8 + TypeScript SPA (React 19 or Vue 3.5), pins the Node LTS and package manager, and wires Tailwind v4, leaving a running base.
---

# Scaffold Frontend Project

## 1. Audit current state

```bash
ls package.json vite.config.* .claude/stack-profile.md 2>/dev/null
```

Read `.claude/stack-profile.md` if it exists (schema: `../../core/_shared/stack-profile.md`; command translation: `../_shared/stack-versions.md`, "Stack profile"):
- `package_manager` replaces `pnpm` in every command below.
- `frontend.framework` (`react` | `vue`) answers the framework question in step 3.
- `frontend.meta` of `nuxt` or `next` means this is the wrong skill: those apps come from their own CLIs (`scaffold-choices.md`). Say so and stop.
- `runtime_manager: mise` pins Node in `mise.toml` instead of `.nvmrc` (step 5).

- **`package.json` + a Vite config already exist?** The project is scaffolded. Don't re-create it — verify the base (steps 5–6: Node pin, pnpm, Tailwind v4) and hand off to `clean-frontend-scaffolding`.
- **Empty dir** (only VCS/editor files)? Full scaffold (steps 3–7).

This is the only skill that runs before a `package.json` exists, so without a profile it **asks** the framework instead of detecting it.

## 2. Decide what to do

- Empty → scaffold (steps 3–7).
- Existing project → verify base deps + config, then exit to `clean-frontend-scaffolding`.

## 3. Choose framework + name

Skip any question the profile already answers. Otherwise ask the user (AskUserQuestion):
- **Framework:** React 19 or Vue 3.5 (this plugin supports both; Vue 2 is EOL and rejected — see `../_shared/stack-versions.md`).
- **Project name:** kebab-case (becomes the directory and `package.json` name).

## 4. Scaffold the Vite + TypeScript app

```bash
# React (React Compiler pre-wired — see optimize-performance)
pnpm create vite@latest <name> --no-interactive --template react-compiler-ts

# Vue
pnpm create vite@latest <name> --no-interactive --template vue-ts
```

`--no-interactive` stops the CLI from waiting on prompts (it would hang a non-TTY session). Then `cd <name>` and `pnpm install`. The Vite 8 templates ship React 19 / Vue 3.5 with TypeScript 6.0. Keep TS on `~6.0` in Vue projects (`vue-tsc` 3.3 crashes on TS 7: `ERR_PACKAGE_PATH_NOT_EXPORTED` for `typescript/lib/tsc`). The React template ships `oxlint` (`.oxlintrc.json`, a `lint` script) — `configure-linting` replaces it with Biome.

## 5. Pin the toolchain

`.nvmrc`:
```
24
```

`package.json` (merge; `<pnpm-version>` is the output of `pnpm -v`):
```json
{
  "packageManager": "pnpm@<pnpm-version>",
  "engines": { "node": ">=24" }
}
```

`pnpm pkg set packageManager=pnpm@$(pnpm -v)` writes the field. `24` is an LTS major; Node 26 becomes LTS on 2026-10-28 (see `../_shared/stack-versions.md`). Do not copy a pnpm version from a doc — pnpm is on 12.x and the number goes stale.

## 6. Install + wire Tailwind v4

```bash
pnpm add tailwindcss @tailwindcss/vite
```

**Add** `tailwindcss()` to the `plugins` array that is already in `vite.config.ts`; do not replace the array. The `react-compiler-ts` template has a second plugin there (`babel({ presets: [reactCompilerPreset()] })`) that a rewrite would delete.
```ts
import tailwindcss from '@tailwindcss/vite';
// ...
export default defineConfig({
  plugins: [react(), /* existing plugins stay */ tailwindcss()],
});
```

Replace the entry stylesheet (`src/index.css` for React, `src/style.css` for Vue) with the v4 import, and make sure the app entry imports it once:
```css
@import "tailwindcss";
```

Tailwind v4 is CSS-first — no `tailwind.config.js` by default; design tokens live in `@theme` (a future `set-up-design-system` skill owns those).

## 7. Verify

```bash
pnpm dev      # dev server starts, app renders with no console errors
pnpm build    # production build succeeds
```

Stop the dev server. Confirm a Tailwind utility applies (e.g. `class="text-3xl font-bold"` renders large + bold).

## 8. Hand off

The base is running. Continue down the skill chain — each is audit-first and idempotent:
1. `clean-frontend-scaffolding` — strip the Vite demo boilerplate.
2. `configure-typescript` — strict mode + `@/` alias.
3. `configure-linting` — Biome (lint + format) + lefthook.
4. `set-up-frontend-structure` — the shared folder layout (atomic components, seams, stores, feature modules later).
5. `set-up-state-management`, `set-up-error-boundaries`, `configure-test-stack` — as the app needs them.

## References
- ./scaffold-choices.md — why Vite, React 19 / Vue 3.5, pnpm + Corepack, Tailwind v4 CSS-first, Vite SPA vs Nuxt/Next, and the don't-clobber audit guard.
- ../_shared/stack-versions.md — Node LTS, pnpm, dependency version policy.
- ../_shared/conventions.md — `src/` root and `@/` alias conventions.
