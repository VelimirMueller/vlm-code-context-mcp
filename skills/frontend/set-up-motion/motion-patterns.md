# Motion Patterns

Reference for `set-up-motion`. When to use which tool, and how to keep animation fast and accessible.

## Rule: View Transitions for navigation/layout, Motion for component life-cycle
**Why:** They solve different problems. The View Transitions API snapshots the old and new DOM and cross-fades/morphs between them — perfect for route changes, list reordering, and shared-element transitions, with almost no JS. Motion (`motion/react`) owns per-component enter/exit/gesture/spring animation — especially **exit** animation, which CSS can't do on unmount.
**How to apply:** Reach for `startViewTransition` (or the router's `viewTransition`) for "the page/layout changed"; reach for `motion` + `AnimatePresence` for "this component appeared/left/was dragged."

## Rule: animate transform and opacity, never layout
**Why:** `transform` and `opacity` are composited on the GPU — they don't trigger layout or paint, so they hit 60fps. Animating `width`/`height`/`top`/`margin` forces layout on every frame (jank) and can cause CLS.
**How to apply:** Move with `transform: translate/scale`, fade with `opacity`. For size changes use Motion's `layout` prop (it converts to a transform under the hood) rather than animating `width`.

**Anti-example:**
```tsx
// bad: animating layout properties — janky, can shift surrounding content
<motion.div animate={{ width: 320, marginTop: 40 }} />
// good: transform/opacity, or the `layout` prop
<motion.div layout animate={{ opacity: 1 }} />
```

## Rule: every animation respects `prefers-reduced-motion`
**Why:** Motion can trigger nausea, dizziness, and migraines for users with vestibular disorders. Honoring the OS setting is a WCAG requirement, not a preference.
**How to apply:** `useReducedMotion()` to branch in JS; `motion-safe:`/`motion-reduce:` in Tailwind; a `@media (prefers-reduced-motion: reduce)` block that disables `::view-transition-*`. Keep essential feedback (loading), drop decoration (parallax, big slides).

## Rule: motion is feedback, not decoration — subtle, fast, purposeful
**Why:** Animation should explain a change (where did this come from, where did it go), not show off. Slow or gratuitous motion makes an app feel sluggish.
**How to apply:** Keep UI transitions ~150–250ms with an ease-out curve; reserve springs for direct manipulation (drag). Every animation should answer "what changed?" If it doesn't, cut it.

## Rule: keep Motion out of the critical path
**Why:** The animation library is dead weight on first paint if the landing view isn't animated.
**How to apply:** Code-split heavy animated sections (`React.lazy`); Motion supports a `LazyMotion` + feature-import pattern to ship a smaller core. Don't animate above-the-fold content that competes with LCP.

## When to deviate
- **CSS-only is enough:** a hover/focus transition or a simple enter is just `transition`/`@keyframes` — no library needed. Reach for Motion when you need exit animation, gestures, springs, or orchestration.
- **Cross-document (MPA) transitions:** for a multi-page app, the CSS-only `@view-transition { navigation: auto; }` handles full-page navigations without any JS. (This plugin targets SPAs, where the JS API applies.)
