---
name: set-up-design-system
description: Use when establishing a design system — Tailwind v4 @theme tokens, class-based dark mode from a persisted theme store (CSP-safe pre-paint script), a cn() merger, and cva variant primitives; shadcn/ui is the optional component registry.
---

# Set Up Design System

## 1. Audit current state

```bash
cat .claude/stack-profile.md 2>/dev/null || cat ~/.claude/stack-profile.md 2>/dev/null   # frontend.framework, package_manager
grep -E '"(class-variance-authority|clsx|tailwind-merge|tailwindcss|tailwind-variants)"' package.json 2>/dev/null
grep -n "@theme\|@custom-variant" src/index.css src/style.css 2>/dev/null
ls components.json 2>/dev/null   # shadcn/ui marker
```

Read `frontend.framework` (React store = Zustand, Vue = Pinia) and `package_manager` (commands use pnpm). Detect existing tokens, a variant lib, and dark-mode wiring. **Prerequisites:** Tailwind v4 installed (`scaffold-frontend-project`), `@/` alias, and `set-up-state-management` (the theme toggle is a UI-state store).

## 2. Decide what to do
- No tokens/primitives → full setup.
- Tokens present but ad-hoc class strings → add `cn()` + cva variants.
- shadcn/ui already initialized → adopt its `cn`/cva; just add the token layer + theme store.

## 3. Detect framework
React → primitives as `.tsx` with cva. Vue → primitives as SFCs using the same cva class strings. `cn()` and `@theme` are framework-agnostic.

## 4. Install
```bash
pnpm add class-variance-authority clsx tailwind-merge
```
`tailwind-merge` must be v3 or newer for Tailwind 4 class names. Why cva + `cn()`: `design-tokens.md`.
(Optional, React: `pnpm dlx shadcn@latest init` — generates owned, cva-based primitives into your tree. Then skip hand-writing step 7.)

## 5. Define tokens in `@theme` (CSS-first)

Tailwind v4 reads tokens from CSS and generates the matching utilities (`bg-brand-600`, `rounded-card`, …). Use semantic names and `oklch` for perceptually-even colors.

```css
/* src/index.css (or src/style.css) */
@import "tailwindcss";

/* class-based dark mode: `dark:` applies under .dark on <html> */
@custom-variant dark (&:where(.dark, .dark *));

/* native form controls and scrollbars follow the theme */
:root { color-scheme: light; }
.dark { color-scheme: dark; }

@theme {
  --color-brand-50: oklch(0.97 0.02 255);
  --color-brand-500: oklch(0.62 0.19 255);
  --color-brand-600: oklch(0.54 0.20 255);
  --color-brand-700: oklch(0.47 0.19 255);
  --radius-card: 0.75rem;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

**More than one theme (brand × light/dark)?** Keep utilities fixed and swap token *values*. Semantic tokens point at CSS variables via `@theme inline`; each theme redefines the variables:
```css
/* src/styles/tokens.css */
@theme inline {
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --color-accent: var(--accent);
  --color-ring: var(--ring);
}
:root, [data-theme="default"]            { --bg: #fafafa; --fg: #09090b; --accent: #18181b; --ring: #18181b; }
.dark, [data-theme="default"].dark       { --bg: #09090b; --fg: #f4f4f5; --accent: #fafafa; --ring: #e4e4e7; }
[data-theme="neon"].dark                 { --bg: #05040d; --fg: #e6f1ff; --accent: #00fff7; --ring: #00fff7; }
```
Every theme defines both modes (`[data-theme="neon"]` for light is omitted here for brevity); a missing block silently falls back to `:root`. Components use `bg-bg text-fg ring-ring` only — a new theme is one CSS block, no component change. Check every fg/bg pair for 4.5:1 per theme and mode (`configure-accessibility`).

## 6. The `cn()` class merger

```ts
// src/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class lists, with later Tailwind utilities winning over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## 7. A variant-driven primitive (atom)

### React
```tsx
// src/components/atoms/Button/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

const button = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        solid: 'bg-brand-600 text-white hover:bg-brand-700',
        outline: 'border border-brand-600 text-brand-600 hover:bg-brand-50 dark:border-brand-500 dark:text-brand-500 dark:hover:bg-brand-500/10',
        ghost: 'text-brand-600 hover:bg-brand-50 dark:text-brand-500 dark:hover:bg-brand-500/10',
      },
      size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4', lg: 'h-12 px-6 text-lg' },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button type="button" className={cn(button({ variant, size }), className)} {...props} />; // type before the spread: a form's submit button says type="submit" itself
}
```

Contrast is part of the token choice: white on `brand-600` is 5.1:1, but white on `brand-500` is only 3.7:1 (fails AA 4.5:1), so hover darkens to `brand-700`; `brand-600` text on a near-black surface is about 4:1, so dark mode uses `brand-500`. Tailwind 4 renamed the old `outline-none` to `outline-hidden` (it keeps a transparent outline visible in forced-colors mode); the new `outline-none` removes it entirely. Recheck contrast whenever a token changes (`configure-accessibility`).

For Vue, mirror with an SFC: define the same `button` cva map, then `:class="cn(button({ variant, size }), $attrs.class)"`.

## 8. Dark mode = persisted UI state, applied before first paint (no FOUC)

The theme is UI state — a small persisted store — but it must reach `<html>` **before the bundle paints**, or dark-mode users get a flash of light. Two parts:

**1. Pre-paint, as a same-origin file** — `public/theme-init.js`, loaded from `<head>` before the bundle:
```html
<!-- index.html <head>: classic blocking script on purpose; a module or defer script runs after first paint -->
<script src="/theme-init.js"></script>
```
```js
// public/theme-init.js
(() => {
  let t = 'system';
  try { t = JSON.parse(localStorage.getItem('theme') ?? '{}')?.state?.theme ?? 'system'; } catch {}
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
```
It is a file, not an inline `<script>`, because `set-up-security-headers` ships `script-src 'self'` without `'unsafe-inline'`; an inline theme script would be blocked in production and dark-mode users would see a flash of light. (It parses Zustand's persisted shape stored under the `theme` key — keep that key in sync with the store.)

**2. The store** — `'light' | 'dark' | 'system'`, defaulting to `system` (a named theme, if any, is a second field applied as `data-theme` on `<html>` by the same `theme-init.js`):
```ts
// src/stores/useThemeStore.ts (React — Zustand)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type ThemeState = { theme: Theme; setTheme: (t: Theme) => void };

export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ theme: 'system', setTheme: (theme) => set({ theme }) }), { name: 'theme' }),
);

export const resolveTheme = (t: Theme): 'light' | 'dark' =>
  t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
```
```tsx
// apply on change, and react to OS changes while on 'system'
useEffect(() => {
  const apply = () =>
    document.documentElement.classList.toggle('dark', resolveTheme(useThemeStore.getState().theme) === 'dark');
  apply();
  const unsub = useThemeStore.subscribe(apply);
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', apply);
  return () => { unsub(); mq.removeEventListener('change', apply); };
}, []);
```
Vue: the same store as a Pinia setup-store + a `watchEffect` + the same `matchMedia` listener; `theme-init.js` reads the `theme` key, so a Pinia persistence plugin must write the same key and shape (`{"state":{"theme":"dark"}}`) or `theme-init.js` must be adapted to it.

## 9. Verify
```bash
pnpm typecheck
pnpm dev
```
`<Button variant="outline" size="lg">` renders with tokens; toggling the theme store flips `.dark` on `<html>` and `dark:` utilities apply. Reload preserves the choice (persisted).

## References
- ./design-tokens.md — token naming, cva + cn rationale, dark-mode strategy, theme-is-UI-state, shadcn/ui, when to deviate.
- ../_shared/glossary.md — theme as UI state.
- ../_shared/conventions.md — `@/` alias, atoms layer, `stores/`.
