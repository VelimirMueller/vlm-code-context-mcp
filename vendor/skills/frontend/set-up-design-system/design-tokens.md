# Design Tokens & Primitives

Reference for `set-up-design-system`. How tokens, variants, and theming hang together.

## Rule: tokens live in `@theme`, named by meaning
**Why:** Hard-coded hex values scattered through markup can't be re-themed and drift out of sync. Tailwind v4's `@theme` makes CSS the single source of design tokens and auto-generates the matching utilities, so `--color-brand-600` *is* `bg-brand-600`. Semantic names (`brand`, `surface`, `danger`) survive a palette change; literal names (`blue-600`) don't.
**How to apply:** Define colors/spacing/radius/fonts in `@theme`; use `oklch()` for perceptually-uniform colors and easy dark-mode derivation. No `tailwind.config.js` in v4.

## Rule: variants via cva + `cn()`, never string concatenation
**Why:** `className={`btn ${isPrimary ? 'bg-blue-600' : ''} ${size}`}` is unreadable and produces conflicting utilities. `class-variance-authority` declares variants as data (typed via `VariantProps`); `cn()` (clsx + tailwind-merge) merges them so a later `bg-*` reliably overrides an earlier one.
**How to apply:** One `cva` map per primitive; expose `variant`/`size` props; merge a caller's `className` last with `cn()`.

**Anti-example:**
```tsx
// bad: conditional string soup + later class may not win without tailwind-merge
<button className={`px-4 ${primary ? 'bg-brand-600' : 'bg-gray-200'} ${className}`} />
```

## Rule: dark mode is a class variant driven by persisted UI state
**Why:** A class strategy (`<html class="dark">`) lets users override the OS preference and lets you toggle instantly without a reload. The choice is UI state — it must persist across reloads.
**How to apply:** `@custom-variant dark (&:where(.dark, .dark *))` in CSS; a persisted `useThemeStore` (Zustand/Pinia) holds `'light' | 'dark' | 'system'`, default `system`; a single root effect toggles `documentElement.classList`; `color-scheme` follows the class so native controls match. A pre-paint script applies the class before first paint (next rule).

## Rule: the pre-paint theme script is a file, not an inline script
**Why:** Without it, dark-mode users get a flash of light while the bundle loads. An inline `<script>` is the usual fix, but it conflicts with the CSP the project ships (`script-src 'self'`, no `'unsafe-inline'`): production blocks it and the flash returns. Allowing it with a hash is possible but breaks silently whenever someone edits the script.
**How to apply:** `public/theme-init.js` loaded by a classic `<script src>` in `<head>` (see `SKILL.md` step 8). One tiny same-origin file costs one request and no CSP exception.

## Rule: token pairs are chosen for contrast, not taste
**Why:** A hover state that looks fine can fail WCAG AA: white on `brand-500` is 3.7:1 against the 4.5:1 minimum for normal text. Dark mode flips the problem: a mid-tone brand color on a near-black surface drops under 4.5:1 too. Contrast failures are the most common axe finding.
**How to apply:** Compute contrast for every text/background token pair per theme and mode when tokens change (axe or devtools; `configure-accessibility`). Keep a darker step (`-700`) for hover on filled buttons and a lighter step (`-500`) for text on dark surfaces.

## Rule: themes swap token values, never utilities
**Why:** If a theme changes class names (`bg-zinc-900` → `bg-cyan-950`), every component must know every theme. Swapping the *values* behind semantic tokens keeps components theme-blind: `bg-surface` is right in every theme and mode.
**How to apply:** `@theme inline { --color-surface: var(--surface); … }`; one CSS block per `[data-theme]` × `.dark` redefines the variables. Brand palettes (and decorative extras such as gradients or glows) are variables too. Shared design tokens across repos ship as one package that exports this CSS.

## Rule: the theme toggle is UI state, not server state
**Why:** It exists because of what the user chose in the browser — textbook UI state (see `../_shared/glossary.md`). It never belongs in the query cache.
**How to apply:** `useThemeStore` with `persist`. If the user has an account, sync the preference via a mutation on login — but the live toggle stays in the store.

## Rule: primitives are atoms; compose upward
**Why:** A design system is a small set of well-made primitives (Button, Input, Card, Badge) that everything else composes from. Keep them unopinionated about layout.
**How to apply:** Primitives in `components/atoms/`; each owns its `cva` map and forwards `className` + native props. Build molecules/organisms from them.

## Rule: `outline-hidden`, not `outline-none`, for custom focus rings
**Why:** In Tailwind 4 `outline-none` sets `outline-style: none`, which removes the focus indicator in forced-colors (high-contrast) mode too. `outline-hidden` (the old v3 `outline-none`) hides it visually but keeps a transparent outline that forced-colors mode still draws.
**How to apply:** Pair `focus-visible:outline-hidden` with a `focus-visible:ring-*` replacement. Never ship a component with no replacement.

## shadcn/ui
shadcn/ui isn't a dependency — `shadcn init` copies cva-based components into your tree, so you *own* and can edit them. It uses exactly this stack (`cn`, cva, Tailwind, Radix primitives for behavior/a11y). Adopt it to skip hand-writing primitives; keep your `@theme` tokens as the styling source.

## When to deviate
- **tailwind-variants (`tv`)** is an alternative to cva with slots and responsive variants — pick it over cva for multi-part components (e.g. a Card with header/body/footer slots).
- **Headless behavior:** for menus, dialogs, comboboxes, use a headless lib (Radix, Ark, Headless UI) for keyboard/focus/ARIA, then style with your tokens. Don't hand-roll accessible interactive widgets.
