---
name: scaffold-frontend-project
description: Use when starting a brand-new frontend project from an empty directory — scaffolds a Vite + TypeScript app (React 19 or Vue 3), pins pnpm and the active Node LTS, and installs + wires Tailwind v4, leaving a running base for the other frontend skills to build on.
---

# Scaffold Frontend Project

## 1. Audit current state

```bash
ls package.json vite.config.* 2>/dev/null
```

- **`package.json` + a Vite config already exist?** The project is scaffolded. Don't re-create it — verify the base (steps 5–6: Node pin, pnpm, Tailwind v4) and hand off to `clean-frontend-scaffolding`.
- **Empty dir** (only VCS/editor files)? Full scaffold (steps 3–7).

This is the only skill that runs before a `package.json` exists, so it **asks** the framework instead of detecting it.

## 2. Decide what to do

- Empty → scaffold (steps 3–7).
- Existing project → verify base deps + config, then exit to `clean-frontend-scaffolding`.

## 3. Choose framework + name

Ask the user (AskUserQuestion):
- **Framework:** React 19 or Vue 3 (this plugin supports both; Vue 2 is EOL and rejected — see `../_shared/stack-versions.md`).
- **Project name:** kebab-case (becomes the directory and `package.json` name).

## 4. Scaffold the Vite + TypeScript app

```bash
# React
pnpm create vite@latest <name> --template react-ts

# Vue
pnpm create vite@latest <name> --template vue-ts
```

Then `cd <name>` and `pnpm install`. Vite's `*-ts` templates ship React 19 / Vue 3 with TypeScript.

## 5. Pin the toolchain

`.nvmrc`:
```
24
```

`package.json` (merge):
```json
{
  "packageManager": "pnpm@10.0.0",
  "engines": { "node": ">=24" }
}
```

`24` is the active Node LTS — track the LTS line (see `../_shared/stack-versions.md`). Set `packageManager` to your installed pnpm version so Corepack pins it for everyone and CI.

## 6. Install + wire Tailwind v4

```bash
pnpm add tailwindcss @tailwindcss/vite
```

Add the Tailwind plugin to `vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Vue: import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
3. `configure-linting` — Biome + Prettier + lefthook.
4. `set-up-frontend-structure` — atomic-design folders.
5. `set-up-state-management`, `set-up-error-boundaries`, `configure-test-stack` — as the app needs them.

## References
- ./scaffold-choices.md — why Vite, React 19 / Vue 3, pnpm + Corepack, Tailwind v4 CSS-first, and the don't-clobber audit guard.
- ../_shared/stack-versions.md — Node LTS, pnpm, dependency version policy.
- ../_shared/conventions.md — `src/` root and `@/` alias conventions.
