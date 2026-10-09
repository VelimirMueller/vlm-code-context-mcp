---
name: configure-accessibility
description: Use when making a frontend accessible — turns on a11y linting (Biome a11y rules for React/JSX and, with full SFC support, for Vue templates), establishes semantic-HTML/focus/reduced-motion conventions, and adds axe checks to the test stack so accessibility regressions fail CI.
---

# Configure Accessibility

## 1. Audit current state

```bash
cat .claude/stack-profile.md 2>/dev/null || cat ~/.claude/stack-profile.md 2>/dev/null   # frontend.framework, tests.layout, package_manager
grep -E '"(eslint-plugin-vuejs-accessibility|vitest-axe|@axe-core/playwright|axe-core)"' package.json 2>/dev/null
grep -rn "skip.*main\|role=\"main\"\|<main" src/ 2>/dev/null | head
```

Read `tests.layout` (`tests-dir` → `tests/ui`, `tests/e2e`; `colocated` → `*.test.ts` beside the component, `e2e/` at the root) and `frontend.framework`. Commands use pnpm; translate for `package_manager`. Detect a11y lint, axe in tests, and whether a skip link / landmarks exist. **Prerequisites:** `configure-linting` (Biome) and `configure-test-stack` (axe plugs into Vitest/Playwright).

## 2. Decide what to do
- Nothing → full setup (lint + conventions + axe tests).
- Lint on but no axe tests → add axe (step 6).
- Both present → confirm the conventions in `a11y-rules.md` and the keyboard pass.

## 3. Detect framework
React/JSX → Biome's a11y rules cover it. Vue → the same rules run on `<template>` once `html.experimentalFullSupportEnabled` is on (`configure-linting`); check it is.

## 4. Lint for accessibility

Biome's `recommended` set (from `configure-linting`) already enables the core a11y rules — keep them at `error`, don't downgrade:
- `useAltText`, `useButtonType`, `useKeyWithClickEvents`, `useValidAnchor`, `noSvgWithoutTitle`, `useAriaPropsForRole`, `noAutofocus`, `noLabelWithoutControl`, … (all checked as recommended in Biome 2.5)

### Vue templates
```bash
grep -n '"experimentalFullSupportEnabled": true' biome.json   # must match
```
With full support, Biome reports `useAltText`, `useButtonType`, `useKeyWithClickEvents`, … inside `.vue` templates (verified on Biome 2.5.15). It does not port the long tail of `eslint-plugin-vuejs-accessibility` (e.g. `form-control-has-label`, `no-redundant-roles`) — axe in step 6 catches those at runtime. Add the ESLint plugin back only if a missed rule class shows up in review. See `a11y-rules.md`.

## 5. App conventions (the part lint can't check)

Apply the rules in `a11y-rules.md`:
- **Landmarks + one `<h1>`:** `<header>`/`<nav>`/`<main>`/`<footer>`; logical heading order.
- **Skip link:** first focusable element jumps to `#main`.
- **Focus-visible:** never strip the outline without a `focus-visible:ring` replacement (your design-system primitives already include one).
- **Focus management:** move focus to the heading on route change; trap focus in modals/dialogs via a headless lib (Radix/Ark/Headless UI), never hand-rolled.
- **Reduced motion:** gate non-essential animation behind `motion-safe:` / `prefers-reduced-motion`.
- **WCAG 2.2 AA additions** (`a11y-rules.md`): interactive targets at least 24×24 CSS px, focus never hidden behind a sticky header, a non-drag alternative for drag gestures, no cognitive test or paste-blocking at login.

```tsx
// skip link (render first inside <body>)
<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2">Skip to content</a>
...
<main id="main">…</main>
```

## 6. Test with axe (fail CI on regressions)

Component-level (`tests/ui`; jsdom): `pnpm add -D axe-core`, then one helper every test calls:
```ts
// tests/setup/axe.ts
import axe from 'axe-core';
import { expect } from 'vitest';

/** Fail with axe's own messages. jsdom has no layout, so colour contrast is left to the Playwright run. */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}
// in a test: await expectNoA11yViolations(container);
```
Why `axe-core` directly: `vitest-axe` (last release 2025-01) works on Vitest 5 at runtime via `vitest-axe/matchers`, but its `toHaveNoViolations` type augmentation does not compile there. The helper is eight typed lines on the maintained engine.

End-to-end (any framework, `tests/e2e`):
```bash
pnpm add -D @axe-core/playwright
```
```ts
// tests/e2e/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('home page has no detectable a11y violations', async ({ page }) => {
  await page.goto('/');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze(); // colour contrast is enabled here: axe's default rules include it, so the jsdom-disabled check runs in this real-browser layer
  expect(violations).toEqual([]);
});
```

axe finds a large share but not all: Deque's own 2021 study of ~300,000 issues counts 57% by volume, and a much smaller share of WCAG criteria. Pair it with a **manual keyboard pass** (Tab through every interactive element; nothing is reachable only by mouse).

## 7. Verify
```bash
pnpm biome check          # a11y lint rules pass
pnpm test:e2e             # axe spec passes
```
Plus a keyboard-only walk of the main flow.

## References
- ./a11y-rules.md — semantic HTML, focus, reduced motion, contrast, the lint-vs-axe-vs-manual split, Vue template linting via Biome full support.
- ../_shared/conventions.md — atoms (primitives carry focus rings), `@/` alias.
