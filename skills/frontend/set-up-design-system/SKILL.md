---
name: set-up-design-system
description: Use when establishing a design system for a frontend project — defines Tailwind v4 @theme tokens (colors/spacing/radius/fonts), class-based dark mode driven by a persisted theme store, a cn() class merger, and variant-driven primitives via class-variance-authority, with shadcn/ui as the optional component registry.
---

# Set Up Design System

## 1. Audit current state

```bash
grep -E '"(class-variance-authority|clsx|tailwind-merge|tailwindcss|tailwind-variants)"' package.json 2>/dev/null
grep -n "@theme\|@custom-variant" src/index.css src/style.css 2>/dev/null
ls components.json 2>/dev/null   # shadcn/ui marker
```

Detect existing tokens, a variant lib, and dark-mode wiring. **Prerequisites:** Tailwind v4 installed (`scaffold-frontend-project`), `@/` alias, and `set-up-state-management` (the theme toggle is a UI-state store).

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
(Optional, React: `pnpm dlx shadcn@latest init` — generates owned, cva-based primitives into your tree. Then skip hand-writing step 7.)

## 5. Define tokens in `@theme` (CSS-first)

Tailwind v4 reads tokens from CSS and generates the matching utilities (`bg-brand-600`, `rounded-card`, …). Use semantic names and `oklch` for perceptually-even colors.

```css
/* src/index.css (or src/style.css) */
@import "tailwindcss";

/* class-based dark mode: `dark:` applies under .dark on <html> */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-brand-50: oklch(0.97 0.02 255);
  --color-brand-500: oklch(0.62 0.19 255);
  --color-brand-600: oklch(0.54 0.20 255);
  --radius-card: 0.75rem;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

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
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        solid: 'bg-brand-600 text-white hover:bg-brand-500',
        outline: 'border border-brand-600 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10',
        ghost: 'text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10',
      },
      size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4', lg: 'h-12 px-6 text-lg' },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
```

For Vue, mirror with an SFC: define the same `button` cva map, then `:class="cn(button({ variant, size }), $attrs.class)"`.

## 8. Dark mode = persisted UI state, applied before first paint (no FOUC)

The theme is UI state — a small persisted store — but it must reach `<html>` **before the bundle paints**, or dark-mode users get a flash of light. Two parts:

**1. Pre-paint, inline in `index.html`** (runs before the JS bundle loads):
```html
<script>
  (() => {
    let t = 'system';
    try { t = JSON.parse(localStorage.getItem('theme') ?? '{}')?.state?.theme ?? 'system'; } catch {}
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  })();
</script>
```
(It parses Zustand's persisted shape stored under the `theme` key — keep that key in sync with the store.)

**2. The store** — `'light' | 'dark' | 'system'`, defaulting to `system`:
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
Vue: the same store as a Pinia setup-store + a `watchEffect` + the same `matchMedia` listener; the inline script's `theme` key must match the store's `persist` name.

## 9. Verify
```bash
pnpm tsc --noEmit
pnpm dev
```
`<Button variant="outline" size="lg">` renders with tokens; toggling the theme store flips `.dark` on `<html>` and `dark:` utilities apply. Reload preserves the choice (persisted).

## References
- ./design-tokens.md — token naming, cva + cn rationale, dark-mode strategy, theme-is-UI-state, shadcn/ui, when to deviate.
- ../_shared/glossary.md — theme as UI state.
- ../_shared/conventions.md — `@/` alias, atoms layer, `stores/`.
