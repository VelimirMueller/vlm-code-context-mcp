---
name: configure-typescript
description: Use when setting up or hardening TypeScript in a frontend project - strict flags, noUncheckedIndexedAccess, TS 6/7-safe paths, and one @/ alias kept in sync across tsconfig, Vite, Vitest, Storybook and Playwright.
---

# Configure TypeScript

## 1. Audit current state

Read `.claude/stack-profile.md` if present: `package_manager` replaces `pnpm` below (`../_shared/stack-versions.md`, "Stack profile"); `frontend.framework` decides the type-check binary (`tsc` for React, `vue-tsc` for Vue).

Inspect the tsconfig that holds the app options. The Vite 8 templates split them: root `tsconfig.json` is only `{ "files": [], "references": [...] }`, and the options live in `tsconfig.app.json`.
- Is `compilerOptions.strict` `true`? Are `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` set?
- Is there a `paths` mapping for `@/*`? Is `baseUrl` set? **Remove `baseUrl`**: TS 6.0 errors on it (TS5101) and TS 7.0 deletes it (TS5102). `paths` entries are relative to the tsconfig that declares them, so `"./src/*"` works without it.
- Does a `typecheck` script exist? (step 3)

Inspect alias config in whichever exist: `vite.config.ts` (`resolve.alias`), `vitest.config.ts`, `.storybook/main.ts`, `playwright.config.ts`.

If every flag is in place and every config has the matching alias, exit early.

## 2. Decide what to do

- Nothing strict → apply the full set below.
- Strict on but flags missing → add them.
- Flags in place but alias missing somewhere → add it to those configs.
- A flag that produces hundreds of errors on an existing codebase → enable it in its own PR (`tsconfig-rules.md`, "When to deviate").

## 3. Update the app tsconfig

Merge into `tsconfig.app.json` (or `tsconfig.json` when there is no split):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

The Vite templates already set `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` and `erasableSyntaxOnly`; keep them. Do not add `esModuleInterop`, `allowSyntheticDefaultImports` or `useDefineForClassFields`: `tsc --showConfig` on TS 6.0 reports them already on for `module: esnext` and `target: es2023`. `isolatedModules` is not needed either; the Vite templates omit it. `exactOptionalPropertyTypes` is **opt-in**, not in the default set: see `tsconfig-rules.md`.

Add a `typecheck` script. `tsc --noEmit` at the root checks **nothing** in the Vite template (`files: []`, exit 0 on a real error), so the script must build the references:

```json
{ "scripts": { "typecheck": "tsc -b" } }
```
Vue: `"typecheck": "vue-tsc -b"`. Every other skill in this catalogue verifies with `pnpm typecheck`.

## 4. Update `vite.config.ts`

```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // ... existing plugins stay
});
```

Vite 8 can read `paths` itself with `resolve.tsconfigPaths: true`, one source of truth instead of two. It is off here because the Vite docs flag a performance cost and it follows `include`, so an alias in a CSS or `.vue` file needs matching `include` entries ([docs](https://vite.dev/config/shared-options#resolve-tsconfigpaths)). The explicit alias costs one line.

## 5. Vitest (if present)

Vitest 5 inline `projects` inherit the root config, so a `mergeConfig(viteConfig, ...)` setup (see `path-aliases.md`) carries the alias into every project. A standalone `vitest.config.ts` with no merge needs the alias block from step 4. `tests/` needs its own tsconfig so test files are type-checked; `configure-test-stack` creates it.

## 6. Storybook (if installed)

Storybook 10's Vite builders (`@storybook/react-vite`, `@storybook/vue3-vite`) load the project's `vite.config.ts`, so the alias is inherited. Add nothing. For another builder, inject the alias in `viteFinal`.

## 7. Playwright (if installed)

Playwright resolves `paths` from the nearest tsconfig itself (verified with 1.64, including through `references`). Add nothing. Do not add `tsconfig-paths` or a `globalSetup` to register aliases: it is dead weight, and the usual snippet (`globalSetup: require.resolve(...)`) crashes in an ESM project (`"type": "module"`, which the Vite templates set). e2e specs rarely need to import app code; if one does, use a relative import.

## 8. Verify

```bash
pnpm typecheck
```

Expected: exit 0, no output. Prove the alias with a throwaway file:

```ts
// src/__alias-check.ts
import { env } from '@/libs/env'; // any existing module under src/
export const check = env;
```

Run `pnpm typecheck` again: still 0 errors. Change the import to `@/does-not-exist` and confirm it now fails, so you know the check can fail. Delete `src/__alias-check.ts`.

## References
- ./tsconfig-rules.md — every flag with rationale, TS 6/7 notes, the opt-in tier.
- ./path-aliases.md — alias snippets for every config file.
- ../_shared/conventions.md — `@/` prefix and the type-check rule.
