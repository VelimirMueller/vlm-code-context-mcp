# Performance Rules

Reference for `optimize-performance`. The 2026 levers, in priority order.

## Rule: measure before you optimize
**Why:** Hand-tuning without numbers optimizes the wrong thing and adds complexity for no gain. The bundle visualizer and web-vitals tell you the actual biggest chunk and worst metric.
**How to apply:** Wire `rollup-plugin-visualizer` + `web-vitals` first. Set a budget (initial JS gzipped, LCP, INP, CLS) and fail CI on regressions. Optimize the top item, re-measure, repeat.

## Rule: let the React Compiler do the memoization
**Why:** The compiler auto-inserts fine-grained memoization at build time, eliminating ~all manual `useMemo`/`useCallback`/`React.memo`. Hand-memoization is now mostly noise that can even be wrong.
**How to apply:** Enable `babel-plugin-react-compiler`; remove redundant manual memo. **Exception:** Zustand/Pinia selectors are *subscriptions*, not render memoization — keep them (see `set-up-state-management`). Vue's compiler already does this; reserve `v-memo`/`v-once` for measured hotspots.

## Rule: split by route first, then lazy-load heavy islands
**Why:** Route-splitting is the highest-leverage win — users download only the route they're on. Heavy, rarely-seen components (rich editors, charts, maps) shouldn't sit in the initial bundle.
**How to apply:** Route-level splitting via the router (`autoCodeSplitting` / dynamic `import()`). `React.lazy` / `defineAsyncComponent` + `<Suspense>` for heavy below-the-fold components. Trust Vite's automatic vendor splitting; only `manualChunks` for a measured improvement.

**Anti-example:**
```ts
// bad: premature manualChunks that fragments caching with no measurement
manualChunks: { vendor: ['react', 'react-dom', 'everything', 'else'] }
```

## Rule: hit the Core Web Vitals targets
**Why:** LCP, INP, and CLS are what users feel (and what ranking uses). INP replaced FID in 2024 — it measures real interaction latency, so heavy event handlers and long tasks now count.
**How to apply:** Targets on a mid-tier mobile device — **LCP < 2.5s, INP < 200ms, CLS < 0.1.** LCP: preload the hero image/font, server-near hosting, small critical JS. INP: keep handlers light, defer non-urgent work (`startTransition`, web workers). CLS: size media, reserve space for async content.

## Rule: images are usually the heaviest thing — treat them as such
**Why:** Unsized, unoptimized images blow up LCP and CLS at once.
**How to apply:** Width/height or `aspect-ratio` on every image; `loading="lazy"` + `decoding="async"` below the fold; AVIF/WebP via `vite-imagetools` responsive `srcset`; preload the LCP image only.

## When to deviate
- **Manual memo still matters** for a measured expensive computation the compiler can't see across a boundary, or a referentially-stable value passed to a non-compiled third-party component. Rare — confirm with the profiler.
- **SSR/streaming** changes the LCP calculus entirely; out of scope for this Vite-SPA plugin (TanStack Start / Nuxt territory).
