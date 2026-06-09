# Path Aliases

Reference for `configure-typescript`. The `@/*` prefix needs to be configured in *every* config that resolves modules — otherwise builds, tests, type-checks, and stories diverge.

## Rule: a single prefix, configured everywhere
**Why:** Multiple aliases (`@/`, `~/`, `@components/`) confuse readers and tooling. One prefix consistently applied is the goal.
**How to apply:** `@/*` mapping to `./src/*` everywhere. The configs that need it:

| Config | Field |
|---|---|
| `tsconfig.json` (or `tsconfig.app.json`) | `compilerOptions.paths` + `baseUrl` |
| `vite.config.ts` | `resolve.alias` |
| `vitest.config.ts` | inherited via `mergeConfig`, or duplicate `resolve.alias` |
| `.storybook/main.ts` (Vite builder) | inherited; for non-Vite builder, add `viteFinal` |
| `playwright.config.ts` | use `tsconfig-paths` `globalSetup` if specs use `@/*` |

## Snippets

### `tsconfig.json` (or `tsconfig.app.json`)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

### `vitest.config.ts` (preferred — inherit Vite config)

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup/ui.ts'],
    },
  }),
);
```

### `.storybook/main.ts` (Vite builder — inherits)

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
};
export default config;
```

### `playwright.config.ts` + `tsconfig-paths` (only if specs use `@/*`)

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/setup/global-setup.ts'),
});
```

```ts
// tests/setup/global-setup.ts
import { register } from 'tsconfig-paths';
import tsconfig from '../../tsconfig.json' with { type: 'json' };

register({
  baseUrl: '.',
  paths: tsconfig.compilerOptions.paths,
});
```

## Anti-pattern: per-folder aliases

```ts
// bad: explosion of aliases that compound over time
'@components': ...
'@hooks': ...
'@utils': ...
'@libs': ...
```

A single `@/*` covers all of these (`@/components`, `@/hooks`, etc.) without the maintenance burden.

## When to deviate

- **Existing project on `~/`:** if the project already uses `~/` (Nuxt convention) or another prefix, keep it. Don't churn imports.
- **Monorepo packages:** in a workspace, each package may have its own `@/*` mapped to its own `src/`. That's fine — the prefix is project-local.
