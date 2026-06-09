---
name: configure-typescript
description: Use when setting up or hardening TypeScript in a frontend project — applies strict mode, additional safety flags (noUncheckedIndexedAccess, noImplicitOverride), and consistent path aliases (@/*) across tsconfig, vite, vitest, playwright, and storybook configs.
---

# Configure TypeScript

## 1. Audit current state

Inspect `tsconfig.json`:
- Is `compilerOptions.strict` set to `true`?
- Are `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` set?
- Is there a `paths` mapping for `@/*`?
- Is `baseUrl` set to `.`?

Inspect alias config in (whichever exist):
- `vite.config.ts` (`resolve.alias`)
- `vitest.config.ts` (`resolve.alias` or `test.alias`)
- `playwright.config.ts` (typically uses `tsconfig-paths` or no aliases)
- `.storybook/main.ts` or `.storybook/main.js`

If every flag is in place and every config has the matching alias, exit early.

## 2. Decide what to do

- Nothing strict → apply full strict + safety set.
- Strict on but missing safety flags → add them.
- Strict + flags but missing aliases somewhere → add aliases to those configs.

## 3. Update `tsconfig.json`

Apply or merge these `compilerOptions`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

If `tsconfig.app.json` (Vite split-config) exists, apply the `paths` and safety flags there instead of the root `tsconfig.json` (Vite scaffold places app-level options in `tsconfig.app.json`).

## 4. Update `vite.config.ts`

Add `resolve.alias`:

```ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // ... existing plugins
});
```

## 5. Update `vitest.config.ts` (if present)

If Vitest extends Vite config (typical), the alias is inherited. Confirm by:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: { /* ... */ },
}));
```

If Vitest config is standalone (no merge), duplicate the alias block from step 4 there.

## 6. Update `.storybook/main.ts` (if Storybook installed)

Storybook 8 with Vite builder inherits Vite config. Confirm:

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  // ... existing options
};
export default config;
```

If Storybook uses a non-Vite builder, add a `viteFinal` hook that injects `resolve.alias`.

## 7. Update `playwright.config.ts` (if Playwright installed)

Playwright doesn't bundle the test files like Vite — it uses native Node module resolution. To support `@/*` imports in Playwright specs, install `tsconfig-paths` and register it via `globalSetup`:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // ... existing options
});
```

```ts
// tests/setup/global-setup.ts
import { register } from 'tsconfig-paths';
import { compilerOptions } from '../../tsconfig.json';

register({
  baseUrl: '.',
  paths: compilerOptions.paths,
});
```

(Optional — many projects keep Playwright specs free of `@/*` and use plain relative imports there.)

## 8. Verify

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

Verify alias works by adding a temporary `src/__alias-check.ts`:

```ts
// src/__alias-check.ts
import App from '@/App';
console.log(App);
```

Run: `pnpm tsc --noEmit`

Expected: 0 errors.

Delete `src/__alias-check.ts` afterwards.

## References
- ./tsconfig-rules.md — every flag with rationale.
- ./path-aliases.md — alias snippets for every config file.
- ../_shared/conventions.md — `@/` prefix convention.
