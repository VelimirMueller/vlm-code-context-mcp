---
name: configure-test-stack
description: Use when wiring up the test stack for a frontend project — sets up Vitest (unit + integration in Node, UI in real-browser mode via Playwright), Storybook stories-as-tests, Playwright e2e, and MSW network mocking, with tests under tests/{unit,ui,integration,e2e} rather than co-located.
---

# Configure Test Stack

## 1. Audit current state

```bash
grep -E '"(vitest|@playwright/test|msw|@storybook/addon-vitest)"' package.json 2>/dev/null
ls vitest.config.* playwright.config.* tests/ 2>/dev/null
find src -name "*.test.*" -o -name "*.spec.*" 2>/dev/null   # co-located tests to migrate
```

Detect existing Vitest/Playwright/Storybook/MSW, a `tests/` tree, and any co-located `*.test.*` under `src/` (this skill moves them out — step 10).

**Prerequisites:** `@/` alias (`configure-typescript`) and `src/` structure (`set-up-frontend-structure`). MSW mocks the `fetcher` seam from `set-up-state-management`; if that skill hasn't run, the handlers are still scaffolded but match nothing yet.

## 2. Decide what to do

- Nothing → full setup (steps 3–11).
- Partial → add only the missing layer (e.g. Vitest present but no browser `ui` project, or no e2e).
- Co-located tests found → migrate to `tests/` (step 10).

## 3. Detect framework

React → `vitest-browser-react` + `@testing-library/jest-dom`. Vue → `vitest-browser-vue`. Vitest core, Playwright, and MSW are framework-agnostic.

## 4. Install

### React
```bash
pnpm add -D vitest @vitest/browser-playwright @vitest/coverage-v8 \
  vitest-browser-react @testing-library/jest-dom \
  @playwright/test msw
pnpm exec playwright install chromium
```

### Vue
```bash
pnpm add -D vitest @vitest/browser-playwright @vitest/coverage-v8 \
  vitest-browser-vue \
  @playwright/test msw
pnpm exec playwright install chromium
```

If Storybook is installed: `pnpm dlx storybook add @storybook/addon-vitest`.

## 5. Create the `tests/` tree

```
tests/
├── unit/          # pure logic — Node env
├── integration/   # modules + data layer (e.g. a hook/query against MSW) — Node env
├── ui/            # component rendering — real browser via Playwright
├── e2e/           # full user flows — Playwright
├── mocks/         # MSW handlers + server
│   ├── handlers.ts
│   └── node.ts
└── setup/         # per-project setup files
    ├── msw-node.ts
    └── ui.ts
```

Tests are **not** co-located with source (see `test-layout.md`). Storybook `*.stories.*` stay beside their components — the Storybook addon runs them as tests in place.

## 6. Configure Vitest (one config, several `projects`)

Merge with `vite.config` so the `@/` alias and framework plugin are inherited.

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      coverage: { provider: 'v8', reportsDirectory: 'coverage' },
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
          test: {
            name: 'ui',
            include: ['tests/ui/**/*.{test,spec}.tsx'],
            setupFiles: ['tests/setup/ui.ts'],
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

`ui` runs in a **real browser** (Playwright-driven Chromium), not jsdom — see `test-stack.md` for why that matters.

## 7. Configure Playwright (e2e)

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

`webServer` auto-starts the dev server for e2e and reuses a running one locally.

## 8. MSW — mock the network, not modules

```ts
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/todos', () => HttpResponse.json([{ id: '1', text: 'Demo', done: false }])),
];
```
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
```ts
// tests/setup/ui.ts
import '@testing-library/jest-dom/vitest';
```

Handlers target the same paths the `fetcher` seam calls. For browser-mode (`ui`) network mocking, MSW uses a worker fixture — see `test-stack.md`.

## 9. Storybook stories-as-tests (only if Storybook is installed)

`pnpm dlx storybook add @storybook/addon-vitest` wires a Vitest project that runs every story as a browser component test. It creates `.storybook/vitest.setup.ts` applying your `preview` annotations. Don't hand-duplicate that project in `vitest.config.ts` — the addon owns it.

## 10. Migrate co-located tests + stop co-locating

Move any `src/**/*.test.*` into `tests/ui/` (component/render tests) or `tests/unit/` (pure logic), fixing imports to use `@/`. New scaffolds must not co-locate: this skill's companion edit updates `set-up-frontend-structure` and `../_shared/conventions.md` so the example components no longer emit `*.test.*` siblings. Stories (`*.stories.*`) stay beside components.

## 11. Verify

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

```bash
pnpm test            # unit + integration (Node) + ui (real browser)
pnpm test:e2e        # e2e (auto-starts dev server)
pnpm test:coverage
```

Expected: projects run green. In CI, run `pnpm test` and `pnpm test:e2e` as separate steps (e2e is slower and starts a server).

## References
- ./test-layout.md — the `tests/` structure, what belongs in each type, the testing-trophy distribution, and the no-co-location rule.
- ./test-stack.md — why UI tests run in a real browser, stories-as-tests, MSW-mocks-the-network, Vitest projects, Playwright, coverage; senior choices + deviations.
- ../_shared/conventions.md — `@/` alias, file naming, `stores/` rule.
- ../_shared/stack-versions.md — tooling version policy.
