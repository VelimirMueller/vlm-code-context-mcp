# Test Layout

Reference for `configure-test-stack`. Where tests live, what goes in each folder, and how many of each to write.

## Rule: tests live in `tests/` by type, not co-located
**Why:** A `tests/` tree keeps source folders focused on shipping code, makes the test *kind* obvious from its path, and lets each kind run under the right environment/project without per-file config. (Co-location is a valid style; this project's convention is the typed `tests/` tree.)
**How to apply:**

```
tests/unit/         tests/integration/   tests/ui/            tests/e2e/
tests/mocks/        tests/setup/
```

**Anti-example:**
```
src/components/atoms/Button/Button.test.tsx   # bad (this project): test co-located with source
```

## Rule: each test type has one home and one runner
**Why:** The environment differs per kind; mixing them in one project slows everything to the heaviest setup.
**How to apply:**

| Folder | Tests | Runner / env |
|---|---|---|
| `tests/unit` | pure functions, reducers, query-key factory, store logic | Vitest, `node` |
| `tests/integration` | modules wired together — a hook/query against MSW, a store + service | Vitest, `node` |
| `tests/ui` | component rendering, interaction, focus, a11y | Vitest **browser mode** (Playwright Chromium) |
| `tests/e2e` | full user flows across routes | Playwright |

## Rule: stories stay co-located; the Storybook addon runs them as tests
**Why:** A `*.stories.tsx` is component documentation that lives best beside its component. The Storybook Vitest addon turns each story into a browser test in place, so a co-located story already *is* a `ui` test — no second file in `tests/ui` for what a story covers.
**How to apply:** Keep `Button.stories.tsx` next to `Button.tsx`. Add `tests/ui` specs only for interactions a story doesn't express.

## Rule: write to the testing trophy, not the pyramid
**Why:** For frontends, integration tests (a component + its hooks + mocked network) catch the most real bugs per unit of effort — more than isolated unit tests, and far cheaper than e2e. Favour integration; keep unit for pure logic and a thin layer of e2e for critical paths.
**How to apply:** Rough distribution — many `integration`, solid `unit` for logic, focused `ui` for component behavior, a few `e2e` for money paths (login, checkout). Don't chase 100% coverage; cover behavior that matters.

## Rule: mocks and setup are shared, under `tests/`
**Why:** One MSW handler set and one setup file per project keep mocking consistent and avoid per-test boilerplate.
**How to apply:** `tests/mocks/handlers.ts` (+ `node.ts`/`browser.ts`), `tests/setup/*.ts` referenced from each Vitest project's `setupFiles`.

## When to deviate
- **Co-located preference:** a team that prefers co-located tests can keep `*.test.tsx` beside source and point Vitest `include` at `src/**`. This project chose `tests/` by type; pick one and be consistent.
- **No Storybook:** without the addon, write `tests/ui` specs directly with `vitest-browser-react` / `vitest-browser-vue`.
