# Accessibility Rules

Reference for `configure-accessibility`. What to enforce and how the three layers (lint, axe, manual) divide the work.

## Rule: semantic HTML + landmarks before ARIA
**Why:** A real `<button>`, `<a href>`, `<nav>`, `<main>` come with focus, keyboard, and role behavior for free. ARIA only *describes* — it doesn't add behavior, and wrong ARIA is worse than none. "No ARIA is better than bad ARIA."
**How to apply:** One `<h1>` per page, logical heading order, landmark elements, lists for lists. Reach for ARIA only when no native element fits.

**Anti-example:**
```tsx
// bad: a div pretending to be a button — no focus, no Enter/Space, no role
<div onClick={submit}>Submit</div>
// good:
<button type="button" onClick={submit}>Submit</button>
```

## Rule: every interactive element is keyboard-operable, with a visible focus ring
**Why:** Keyboard and screen-reader users navigate by focus. A removed outline with no replacement makes the app unusable for them.
**How to apply:** Use native interactive elements; if you must make a custom one, add `tabindex`, key handlers, and role. Keep a `focus-visible:ring` (your design-system primitives include it). Provide a skip link to `#main`.

## Rule: manage focus on route change and in overlays
**Why:** SPA navigation doesn't move focus the way a full page load does, so screen-reader users are left where they were. Modals that don't trap focus let users tab into the page behind them.
**How to apply:** On route change, move focus to the new page's `<h1>` (or a visually-hidden live region). For dialogs/menus/comboboxes, use a headless library (Radix, Ark, Headless UI) that traps focus and restores it on close — never hand-roll the trap.

## Rule: respect `prefers-reduced-motion`
**Why:** Vestibular disorders make large motion painful or nauseating. Animation must be opt-out-able by the OS setting.
**How to apply:** Gate non-essential transitions behind `motion-safe:` utilities (or a `@media (prefers-reduced-motion: reduce)` block that disables them). Essential feedback may remain but should be subtle.

## Rule: color contrast meets WCAG AA (4.5:1 text, 3:1 large/UI)
**Why:** Low contrast excludes low-vision users and anyone in sunlight. It must hold in *both* themes.
**How to apply:** Choose `@theme` token pairs that pass in light and dark; verify with axe / browser devtools. `oklch` lightness makes contrast-aware palettes easier to reason about.

## Rule: forms are labeled and errors are announced
**Why:** An unlabeled field is unusable with a screen reader; an error a sighted user sees but a screen reader doesn't is a silent failure.
**How to apply:** `<label htmlFor>`, `aria-invalid`, `aria-describedby` → error with `role="alert"`. (Set up by `set-up-forms`; this skill lints and tests it.)

## Rule: three layers, none sufficient alone
**Why:** Lint catches static markup mistakes; axe catches ~30–40% of issues at runtime; only a human catches focus order, meaningful labels, and "does this actually make sense by keyboard". Skipping the manual pass ships inaccessible-but-green UIs.
**How to apply:** Biome a11y rules (JSX) + eslint-plugin-vuejs-accessibility (Vue templates) in CI → axe in `tests/ui` + `tests/e2e` → a keyboard-only walkthrough of each critical flow.

## When to deviate
- **Design-system-only repo:** ship a11y-correct primitives and document usage; the consuming app still owns landmarks, skip links, and flow-level focus.
- **Canvas/WebGL surfaces:** axe can't see them — provide an accessible alternative (data table, text description) and test that instead.
