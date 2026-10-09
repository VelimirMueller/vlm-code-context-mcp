# Test Stack

Reference for `configure-test-stack`. The 2026 tool choices and why each is the senior default.

## Rule: UI tests run in a real browser, not jsdom
**Why:** jsdom/happy-dom are JS reimplementations of the DOM — they don't lay out, don't paint, and fake focus, scrolling, pointer events, and `getBoundingClientRect`. Tests pass against the simulation and break in Chrome. Vitest **browser mode** drives a real Playwright Chromium, so a passing `ui` test reflects a real browser.
**How to apply:** The `ui` Vitest project sets `browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] }`. Render with `vitest-browser-react` / `vitest-browser-vue` and assert via Vitest's locators.

```tsx
// tests/ui/Button.test.tsx
import { render } from 'vitest-browser-react';
import { expect, test, vi } from 'vitest';
import { Button } from '@/components/atoms/Button';

test('calls onClick when pressed', async () => {
  const onClick = vi.fn();
  const screen = await render(<Button onClick={onClick}>Save</Button>); // render is async
  await screen.getByRole('button', { name: 'Save' }).click();
  expect(onClick).toHaveBeenCalledOnce();
});
```

## Rule: stories are tests (Storybook Vitest addon)
**Why:** A story already describes a component in a state. The Storybook Vitest addon (`@storybook/addon-vitest`) runs each story as a browser test — render + `play()` interactions become assertions. You write the story once and get a test for free, in the same real-browser engine as `tests/ui`.
**How to apply:** `pnpm exec storybook add @storybook/addon-vitest` (Storybook 10.6 docs; requires Vitest 3 or newer and MSW 2 or newer); keep stories co-located. Reserve `tests/ui` for behavior a story doesn't express.

## Rule: mock the network, not the module
**Why:** `vi.mock('@/libs/fetcher')` couples tests to the implementation — refactor the fetch layer and every test breaks, and you never exercise the real request/parse path. MSW intercepts at the network boundary, so tests hit the actual `fetcher` → URL → response path with controllable data.
**How to apply:** Define handlers once in `tests/mocks/handlers.ts`; `setupServer` for Node projects, a worker for browser. `onUnhandledRequest: 'error'` surfaces requests you forgot to mock.

**Anti-example:**
```ts
// bad: mocks the module — tests the mock, not the request path
vi.mock('@/libs/fetcher', () => ({ fetcher: () => Promise.resolve([]) }));
```

For browser-mode (`ui`) mocking, MSW uses a service worker: `tests/mocks/browser.ts` exports `setupWorker(...handlers)`, `tests/setup/ui-msw.ts` starts and resets it, and `msw init tests/public --no-save` writes the worker script (`SKILL.md` step 8). Export the worker from the mocks file, not the setup file: a test that imports the setup file creates a second worker.

## Rule: one Vitest config with `projects`, not one config per kind
**Why:** `test.projects` runs unit (Node), integration (Node), and ui (browser) from a single `vitest.config.ts` and a single `vitest run` — shared coverage, shared alias, no duplicated Vite setup.
**How to apply:** See `SKILL.md` step 6. The Storybook addon registers its own project; let it.

## Rule: Playwright owns e2e, with `webServer`
**Why:** e2e validates the built app across routes. Playwright's `webServer` boots the dev server for the run and reuses a local one, so `pnpm test:e2e` is one command.
**How to apply:** `testDir: './tests/e2e'`, `webServer.command: 'pnpm dev'`. Use `trace: 'on-first-retry'` for debuggable CI failures.

## Rule: coverage via v8, on behavior not lines
**Why:** `@vitest/coverage-v8` uses the engine's native coverage — fast, no instrumentation. Chase meaningful paths, not a 100% number that rewards testing getters.
**How to apply:** `coverage: { provider: 'v8', include: ['src/**'] }` (without `include`, helpers under `tests/` are counted); gate CI on a realistic threshold for changed code, not a global vanity target.

## When to deviate
- **A small app:** start with one Node `unit` project and the `ui` project; add `integration` when the first hook-against-MSW test exists, and e2e when there is a flow worth a browser. The `integration` project differs from `unit` only by folder.
- **Speed over fidelity:** a huge unit suite that never touches layout can use `environment: 'jsdom'` for a `ui-fast` project; keep the real-browser project for interaction/a11y tests.
- **No Storybook:** write `tests/ui` specs directly with `vitest-browser-*`; skip step 9.
- **CI browsers:** install only `chromium` for PR runs; add `firefox`/`webkit` instances for a nightly cross-browser job.
