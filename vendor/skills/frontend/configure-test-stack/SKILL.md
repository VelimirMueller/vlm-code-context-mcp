---
name: configure-test-stack
description: Use when setting up tests for a frontend project - Vitest (Node unit and integration, real-browser UI via Playwright), Storybook stories as tests, Playwright e2e and MSW, under tests/ or colocated per the stack profile.
---

# Configure Test Stack

## 1. Audit current state

```bash
grep -E '"(vitest|@playwright/test|msw|@storybook/addon-vitest)"' package.json 2>/dev/null
ls vitest.config.* playwright.config.* tests/ .env.test .claude/stack-profile.md 2>/dev/null
find src -name "*.test.*" -o -name "*.spec.*" 2>/dev/null   # co-located tests
```

Read `.claude/stack-profile.md` if present: `tests.layout` is `tests-dir` (default) or `colocated`; `frontend.framework` picks the render adapter; `package_manager` replaces `pnpm`. With `colocated`, or an established colocated suite, use the globs in `test-layout.md` ("Colocated variant") in step 6, create only `tests/{e2e,mocks,setup}` in step 5, and skip step 9 (no migration).

**Prerequisites:** the `@/` alias (`configure-typescript`) and `validate-env` (`.env.test`, step 5). MSW mocks the `fetcher` seam from `set-up-state-management`.

## 2. Decide what to do

- Nothing → full setup (steps 3–10).
- Partial → add only the missing layer (Vitest present but no browser `ui` project, or no e2e).
- Co-located tests found and the profile says `tests-dir` → migrate (step 9).

## 3. Detect framework

React → `vitest-browser-react`. Vue → `vitest-browser-vue`. Vitest, Playwright and MSW are framework-agnostic.

## 4. Install

```bash
pnpm add -D vitest @vitest/browser-playwright @vitest/coverage-v8 \
  vitest-browser-react @playwright/test msw      # Vue: vitest-browser-vue instead
pnpm exec playwright install chromium
```

No `@testing-library/jest-dom`: Vitest's `expect.element(...)` already has `toBeVisible`, `toBeEnabled`, … (checked: UI tests pass in both frameworks without it). With Storybook installed: `pnpm exec storybook add @storybook/addon-vitest` (not `dlx`: it must run the installed Storybook version).

## 5. Create the tree, the env file and the test tsconfig

```
tests/
├── unit/          # pure logic — Node
├── integration/   # modules + data layer (a hook/query against MSW) — Node
├── ui/            # components — real browser via Playwright
├── e2e/           # full flows — Playwright
├── mocks/         # handlers.ts · node.ts · browser.ts   (no setup code here)
├── public/        # mockServiceWorker.js (generated, served to the ui project only)
├── setup/         # msw-node.ts · ui-msw.ts
└── tsconfig.json
```

`.env.test` (Vitest runs in Vite's `test` mode and loads it; `env.ts` throws without these):
```
VITE_API_URL=http://api.test
```

`tests/tsconfig.json`: test files are outside `src/`, so no tsconfig type-checks them until this exists. It inherits the app config, including `paths`. Add it to the root references and put the config files in `tsconfig.node.json`'s `include`:
```json
{
  "extends": "../tsconfig.app.json",
  "compilerOptions": { "tsBuildInfoFile": "../node_modules/.tmp/tsconfig.tests.tsbuildinfo" },
  "include": ["./**/*.ts", "./**/*.tsx"]
}
```
```json
// tsconfig.json  → "references": [ …, { "path": "./tests" } ]
// tsconfig.node.json → "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
```
Vue: same, `vue-tsc -b` checks it through `pnpm typecheck`.

## 6. Configure Vitest (one config, several `projects`)

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: { provider: 'v8', include: ['src/**'] },
      projects: [
        {
          test: {
            name: 'unit',
            environment: 'node',
            include: ['tests/unit/**/*.{test,spec}.ts'],
            setupFiles: ['tests/setup/msw-node.ts'],
          },
        },
        {
          test: {
            name: 'integration',
            environment: 'node',
            include: ['tests/integration/**/*.{test,spec}.ts'],
            setupFiles: ['tests/setup/msw-node.ts'],
          },
        },
        {
          publicDir: 'tests/public',
          test: {
            name: 'ui',
            include: ['tests/ui/**/*.{test,spec}.{ts,tsx}'],
            setupFiles: ['tests/setup/ui-msw.ts'],
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
          },
        },
      ],
    },
  }),
);
```

- Vitest 5: inline `projects` inherit the root config (alias, plugins) because `extends: true` is the default; on Vitest 3/4 add `extends: true` to each project. The import ends in `.ts`: Vite 8 warns about extension-less config imports.
- `ui` runs in **real Chromium**, not jsdom (`test-stack.md`). Its `include` covers `.ts` and `.tsx`: Vue tests are `.ts`.
- `publicDir: 'tests/public'` serves MSW's worker to the `ui` project only, so it never lands in the production `public/` folder.
- `coverage.include: ['src/**']` keeps test helpers out of the report and shows untested source files at 0%.
- Cold cache: browser mode may print "Vite unexpectedly reloaded a test" and fail the first run after a new dependency is discovered; rerun (it passed on the second run here). Persistent flake: add the named dependency to the project's `optimizeDeps.include`.

## 7. Playwright (e2e)

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```
`webServer` starts the dev server and reuses a running one locally; `--strictPort` fails loudly instead of moving to 5174 and missing `baseURL`. Playwright reads `paths` from the tsconfig itself. One smoke spec keeps the setup honest:
```ts
// tests/e2e/smoke.spec.ts
import { expect, test } from '@playwright/test';

test('the app boots without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#root, #app')).not.toBeEmpty(); // React mounts to #root, Vue to #app
  expect(errors).toEqual([]);
});
```

## 8. MSW: mock the network, not modules

```ts
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/todos', () => HttpResponse.json([{ id: '1', text: 'Demo', done: false }])),
];
```
`*/todos` matches whatever base `VITE_API_URL` has; a relative `/todos` handler never matches in Node (`fetch` rejects relative URLs) and `http.get('/todos')` ignores `http://api.test/todos` (both reproduced).
```ts
// tests/mocks/node.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```
```ts
// tests/setup/msw-node.ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/node';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```
Browser (`ui` project), same handlers:
```ts
// tests/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```
```ts
// tests/setup/ui-msw.ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { worker } from '../mocks/browser';

beforeAll(() => worker.start({ onUnhandledRequest: 'error' }));
afterEach(() => worker.resetHandlers());
afterAll(() => worker.stop());
```
```bash
pnpm exec msw init tests/public --no-save     # writes tests/public/mockServiceWorker.js; without it the ui project fails to start the worker
```
Tests import the worker from `tests/mocks/browser.ts`, **never** from the setup file: importing `ui-msw.ts` creates a second worker whose handlers the real, started worker never sees (a `ws` test found no handler until this was fixed). Biome lints the generated worker: in `biome.json` use `"files": { "includes": ["**", "!**/mockServiceWorker.js"] }`.

## 9. Storybook stories as tests; migrate co-located tests

With Storybook installed, the addon (step 4) registers its own Vitest project; do not copy it into `vitest.config.ts`. Stories stay beside their components.

If the profile says `tests-dir` and `src/**/*.test.*` exist, move them to `tests/ui/` (component tests) or `tests/unit/` (pure logic) and switch imports to `@/`.

## 10. Verify

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest run --project ui",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```
One passing example per project proves the wiring (all three pass):
```tsx
// tests/ui/Button.test.tsx  (React; Vue: vitest-browser-vue, same shape)
import { render } from 'vitest-browser-react';
import { expect, test, vi } from 'vitest';
import { Button } from '@/components/atoms/Button';

test('calls onClick when pressed', async () => {
  const onClick = vi.fn();
  const screen = await render(<Button onClick={onClick}>Save</Button>);
  await screen.getByRole('button', { name: 'Save' }).click();
  expect(onClick).toHaveBeenCalledOnce();
});
```
```ts
// tests/integration/fetcher.test.ts
import { expect, test } from 'vitest';
import { fetcher } from '@/libs/fetcher';
import type { Todo } from '@/libs/queryKeys';

test('fetcher hits msw', async () => {
  const todos = await fetcher<Todo[]>('/todos?status=all');
  expect(todos[0]?.text).toBe('Demo');
});
```
```bash
pnpm typecheck && pnpm test && pnpm test:e2e
```
`render` of both adapters is async: without `await`, `screen.getByRole` is not a function (reproduced). CI runs `pnpm test` and `pnpm test:e2e` as separate steps; e2e is slower and starts a server.

## References
- ./test-layout.md — folders, what each type holds, the colocated variant, the trophy.
- ./test-stack.md — real browser over jsdom, stories as tests, MSW at the network, projects, e2e, coverage; deviations.
- ../_shared/stack-versions.md — Vitest, Playwright, MSW, Storybook lines.
- ../_shared/conventions.md — `@/` alias, the `typecheck` rule.
