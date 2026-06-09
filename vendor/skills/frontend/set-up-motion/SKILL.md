---
name: set-up-motion
description: Use when adding animation and transitions to a frontend — uses the native View Transitions API for navigation/layout changes and the Motion library (motion/react, formerly Framer Motion) for component enter/exit/gesture animation, with every animation gated behind prefers-reduced-motion.
---

# Set Up Motion

## 1. Audit current state

```bash
grep -E '"(motion|framer-motion|@vueuse/motion)"' package.json 2>/dev/null
grep -rn "startViewTransition\|view-transition-name\|prefers-reduced-motion\|useReducedMotion" src/ 2>/dev/null | head
```

**Prerequisites:** `@/` alias; pairs with `set-up-routing` (route view-transitions) and `configure-accessibility` (reduced-motion is an a11y requirement, not a nicety).

## 2. Decide what to do
- No motion → full setup.
- Animations present but always-on (ignore reduce-motion) → gate them (step 7) — that's an accessibility bug.

## 3. Detect framework
React → **Motion** (`motion/react`). Vue → **`@vueuse/motion`**. The View Transitions API is native (no dependency) and works in both.

## 4. Install
```bash
pnpm add motion          # React (the package was renamed from framer-motion)
# Vue: pnpm add @vueuse/motion
```

## 5. View Transitions for navigation + layout changes

Native, GPU-accelerated, near-zero JS. Wrap any DOM change you want animated:
```ts
// src/utils/withViewTransition.ts
export function withViewTransition(update: () => void) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !document.startViewTransition) {
    update();
    return;
  }
  document.startViewTransition(update);
}
```

For routing, let the router drive it: TanStack Router exposes a `viewTransition` option on `<Link>`/navigation; Vue Router pairs with `startViewTransition` in an `afterEach`/`<RouterView>` wrapper. Name shared elements so they morph between routes:
```css
/* the element that persists across routes */
.hero { view-transition-name: hero; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

## 6. Component animation with Motion (React)

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

export function Toast({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```
`AnimatePresence` is the reason to reach for Motion — it animates **exit**, which CSS can't do on unmount. Vue: `@vueuse/motion`'s `v-motion` directive, or Vue's built-in `<Transition>`/`<TransitionGroup>` for simple enter/exit.

## 7. Gate everything behind reduced motion

Three layers, all required:
- **Motion:** `useReducedMotion()` → skip or simplify (above).
- **Tailwind:** author transitions as `motion-safe:transition` / disable with `motion-reduce:transition-none`.
- **View Transitions:** the `@media (prefers-reduced-motion: reduce)` block (step 5) kills them.

Essential feedback (a spinner) may remain; decorative motion (parallax, large slides) must not.

## 8. Verify
```bash
pnpm dev
```
Animations play normally; with OS "Reduce motion" on, transitions are removed/instant and nothing janks. Check the Performance panel: animated properties stay on the compositor (transform/opacity), no layout thrash.

## References
- ./motion-patterns.md — View-Transitions-vs-Motion, animate-transform-not-layout, reduced-motion, motion-is-feedback, performance budget.
- ../configure-accessibility/SKILL.md — reduced motion as an a11y requirement.
- ../_shared/conventions.md — `@/` alias, `utils/` for the pure `withViewTransition` helper.
