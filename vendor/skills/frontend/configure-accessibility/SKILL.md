---
name: configure-accessibility
description: Use when making a frontend accessible — turns on a11y linting (Biome a11y rules for React/JSX, eslint-plugin-vuejs-accessibility for Vue templates), establishes semantic-HTML/focus/reduced-motion conventions, and adds axe checks to the test stack so accessibility regressions fail CI.
---

# Configure Accessibility

## 1. Audit current state

```bash
grep -E '"(eslint-plugin-vuejs-accessibility|vitest-axe|@axe-core/playwright|axe-core)"' package.json 2>/dev/null
grep -rn "skip.*main\|role=\"main\"\|<main" src/ 2>/dev/null | head
```

Detect a11y lint, axe in tests, and whether a skip link / landmarks exist. **Prerequisites:** `configure-linting` (Biome) and `configure-test-stack` (axe plugs into Vitest/Playwright).

## 2. Decide what to do
- Nothing → full setup (lint + conventions + axe tests).
- Lint on but no axe tests → add axe (step 6).
- Both present → confirm the conventions in `a11y-rules.md` and the keyboard pass.

## 3. Detect framework
React/JSX → Biome's a11y rules cover it. Vue → Biome lints `<script>` only, so add `eslint-plugin-vuejs-accessibility` for templates (the same Biome-doesn't-do-Vue-templates gap as `configure-linting`).

## 4. Lint for accessibility

Biome's `recommended` set (from `configure-linting`) already enables the core a11y rules — keep them at `error`, don't downgrade:
- `useAltText`, `useButtonType`, `useKeyWithClickEvents`, `useValidAnchor`, `noSvgWithoutTitle`, `useAriaPropsForRole`, `noAutofocus`, …

### Vue templates (Biome gap)
```bash
pnpm add -D eslint eslint-plugin-vuejs-accessibility
```
Run it over `.vue` files only (templates); let Biome keep `<script>`/TS. See `a11y-rules.md`.

## 5. App conventions (the part lint can't check)

Apply the rules in `a11y-rules.md`:
- **Landmarks + one `<h1>`:** `<header>`/`<nav>`/`<main>`/`<footer>`; logical heading order.
- **Skip link:** first focusable element jumps to `#main`.
- **Focus-visible:** never strip the outline without a `focus-visible:ring` replacement (your design-system primitives already include one).
- **Focus management:** move focus to the heading on route change; trap focus in modals/dialogs via a headless lib (Radix/Ark/Headless UI), never hand-rolled.
- **Reduced motion:** gate non-essential animation behind `motion-safe:` / `prefers-reduced-motion`.

```tsx
// skip link (render first inside <body>)
<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2">Skip to content</a>
...
<main id="main">…</main>
```

## 6. Test with axe (fail CI on regressions)

Component-level (React, `tests/ui`): `pnpm add -D vitest-axe`, register the matcher once in a setup file, then assert:
```ts
// tests/setup/axe.ts (add to the ui project's setupFiles)
import { expect } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe';
expect.extend(toHaveNoViolations);
// in a test: expect(await axe(container)).toHaveNoViolations();
```

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
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});
```

axe catches ~a third of issues automatically — pair it with a **manual keyboard pass** (Tab through every interactive element; nothing is reachable only by mouse).

## 7. Verify
```bash
pnpm biome check          # a11y lint rules pass
pnpm test:e2e             # axe spec passes
```
Plus a keyboard-only walk of the main flow.

## References
- ./a11y-rules.md — semantic HTML, focus, reduced motion, contrast, the lint-vs-axe-vs-manual split, Vue template linting.
- ../_shared/conventions.md — atoms (primitives carry focus rings), `@/` alias.
