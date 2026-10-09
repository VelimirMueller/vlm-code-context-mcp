# Path Aliases

Reference for `configure-typescript`. The `@/*` prefix must resolve in every tool that reads imports, or builds, tests, type-checks and stories diverge.

## Rule: one prefix, declared once in tsconfig, mirrored in Vite
**Why:** Several prefixes (`@/`, `~/`, `@components/`) force a reader to learn a map before reading code; one prefix needs none. `paths` is what the editor and `tsc` read, and Vite does not read it by default, so Vite needs the same mapping. Everything downstream (Vitest, Storybook, Playwright) inherits from one of those two.
**How to apply:**

| Tool | How it gets `@/` |
|---|---|
| `tsc`, editor | `compilerOptions.paths` in `tsconfig.app.json` (no `baseUrl`; removed in TS 7) |
| Vite | `resolve.alias` in `vite.config.ts` |
| Vitest 5 | inherited: inline `projects` extend the root config; use `mergeConfig(viteConfig, …)` |
| Storybook 10 (`*-vite` framework) | inherited from `vite.config.ts` |
| Playwright 1.64 | reads `paths` from the nearest tsconfig itself; nothing to add |
| `tests/` type-check | `tests/tsconfig.json` extends the app config and inherits `paths` |

### `tsconfig.app.json`
```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### `vite.config.ts`
```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

### `vitest.config.ts` (inherit the Vite config)
```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: { projects: [/* see configure-test-stack */] },
  }),
);
```
Import `./vite.config.ts` with the extension: Vite 8 warns about extension-less config imports (`configLoader: 'native'` becomes the default in a later major). A single-project suite can set `test.environment`, `setupFiles` and so on directly instead of `projects`.

### `.storybook/main.ts` (Vite framework: inherits)
```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [],
};
export default config;
```
`addons` stays empty until you add some: `@storybook/addon-essentials` no longer exists past Storybook 8 (its features are in core), and `storybook init` writes the addon list that matches the installed major. Vue: `@storybook/vue3-vite`, `*.stories.ts`.

## Alternative: `resolve.tsconfigPaths`
Vite 8 reads `paths` itself with `resolve.tsconfigPaths: true`, so `vite.config.ts` needs no alias. Choose it when `tsconfig.json` is the only place you want the mapping. The Vite docs state a performance cost and that `paths` only applies to files matched by a tsconfig `include`/`files`, so an `@/` import inside a `.css` or `.vue` file needs those extensions listed ([docs](https://vite.dev/config/shared-options#resolve-tsconfigpaths)).

## Anti-pattern: per-folder aliases
```ts
// bad: '@components', '@hooks', '@utils', '@libs' — one entry per folder, in every config
```
`@/*` already reaches `@/components`, `@/hooks`, `@/utils`. Each extra alias must be added to tsconfig, Vite and every tool that does not inherit.

## When to deviate

- **Existing project on `~/`** (Nuxt convention) **or another prefix:** keep it; do not churn imports.
- **Monorepo packages:** each package may map its own `@/*` to its own `src/`; the prefix is package-local.
- **Playwright specs that import app code across the alias** while a tsconfig does not match them: add `tests/tsconfig.json` (it inherits `paths`) instead of a registration hook.
