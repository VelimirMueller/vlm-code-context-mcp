# Motion Patterns

Reference for `set-up-motion`. When to use which tool, and how to keep animation fast and accessible.

## Rule: Motion (`motion/react`, `motion-v`) over CSS-in-JS animation libraries; one package per framework
**Why:** Motion hybridises: it runs transform/opacity/clip animations on the compositor via the Web Animations API and uses JS only for springs and gestures, so common animations stay off the main thread. It owns exit animation (`AnimatePresence`), and its Vue build `motion-v` shares the API, so patterns and reduced-motion handling carry over. `@vueuse/motion` last released in March 2025 and does not track Motion's API.
**How to apply:** React → `motion`. Vue → `motion-v`. Import from `motion/react` (not the old `framer-motion` name). Native CSS or View Transitions first; Motion where the next rule says so.

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
**Why:** Motion can trigger nausea, dizziness, and migraines for users with vestibular disorders. The OS setting is the user's own control. WCAG ties to it indirectly — 2.3.3 Animation from Interactions is level AAA, and 2.2.2 Pause, Stop, Hide (A) covers auto-moving content over 5 s — so honoring it is the practical way to meet both, and a stated requirement of this catalogue.
**How to apply:** `<MotionConfig reducedMotion="user">` once at the root (it removes transform and layout animation, keeps opacity and colour); `useReducedMotion()` for custom branches; `motion-safe:`/`motion-reduce:` in Tailwind; a `@media (prefers-reduced-motion: reduce)` block that disables `::view-transition-*`. Keep essential feedback (loading), drop decoration (parallax, big slides).

## Rule: motion is feedback, not decoration — subtle, fast, purposeful
**Why:** Animation should explain a change (where did this come from, where did it go), not show off. Slow or gratuitous motion makes an app feel sluggish.
**How to apply:** Keep UI transitions ~150–250ms with an ease-out curve; reserve springs for direct manipulation (drag). Every animation should answer "what changed?" If it doesn't, cut it.

## Rule: keep Motion out of the critical path
**Why:** The animation library is dead weight on first paint if the landing view isn't animated.
**How to apply:** Code-split heavy animated sections (`React.lazy`); use `LazyMotion` with the `m` component (`motion/react-m`) and load features on demand to ship a smaller core. Don't animate above-the-fold content that competes with LCP.

## When to deviate
- **CSS-only is enough:** a hover/focus transition or a simple enter is just `transition`/`@keyframes` — no library needed. Reach for Motion when you need exit animation, gestures, springs, or orchestration.
- **Cross-document (MPA) transitions:** for a multi-page app, the CSS-only `@view-transition { navigation: auto; }` handles full-page navigations without any JS. (This plugin targets SPAs, where the JS API applies.)
