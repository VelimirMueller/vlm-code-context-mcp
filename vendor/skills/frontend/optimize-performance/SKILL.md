---
name: optimize-performance
description: Use when tuning frontend performance — enables the React Compiler, splits code by route and lazy-loads heavy chunks, adds bundle analysis with a size budget, measures Core Web Vitals (LCP/INP/CLS) with web-vitals, and applies image/CLS best practices. Measure first, then optimize.
---

# Optimize Performance

## 1. Audit current state

```bash
grep -E '"(babel-plugin-react-compiler|rollup-plugin-visualizer|web-vitals)"' package.json 2>/dev/null
grep -rn "React.lazy\|defineAsyncComponent\|loading=\"lazy\"" src/ 2>/dev/null | head
```

**Prerequisites:** `scaffold-frontend-project` (Vite) and ideally `set-up-routing` (route-level splitting). **Rule zero: measure before optimizing** — wire the analyzer + vitals (steps 6–7) before hand-tuning anything.

## 2. Decide what to do
- Greenfield → enable Compiler + splitting + measurement (steps 4–8).
- Slow app → measure first (6–7), then attack the biggest chunk / worst vital.

## 3. Detect framework
React → React Compiler + `React.lazy`. Vue → the SFC compiler is already optimal; lazy via `defineAsyncComponent`, and `v-memo`/`v-once` for proven hotspots only.

## 4. Enable the React Compiler (React)

The compiler auto-memoizes — it removes the need for most `useMemo`/`useCallback`/`memo`. It's GA in React 19.

```bash
pnpm add -D babel-plugin-react-compiler
```
```ts
// vite.config.ts
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    // if set-up-routing ran, tanstackRouter() goes FIRST (before react)
    react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } }), // compiler = build-time transform
    // then tailwindcss()
  ],
});
```

The compiler relies on the Rules of React; add `eslint-plugin-react-hooks` (v5+, which ships the compiler rules) alongside Biome **for React rule-checking only** if you want lint-time guarantees — Biome doesn't cover those yet. After enabling, delete redundant `useMemo`/`useCallback` (keep Zustand selectors — different axis; see `set-up-state-management`).

## 5. Split code by route, lazy-load the heavy stuff

- **Routes:** already split if `set-up-routing` ran (TanStack `autoCodeSplitting` / Vue dynamic `import()`).
- **Heavy non-route components** (charts, editors, modals below the fold):
```tsx
const Chart = lazy(() => import('@/components/organisms/Chart')); // React
// Vue: const Chart = defineAsyncComponent(() => import('@/components/organisms/Chart.vue'))
```
Wrap in `<Suspense>`. Let Vite handle vendor splitting; only add `build.rollupOptions.output.manualChunks` for a *measured* win.

## 6. Bundle analysis + a budget

```bash
pnpm add -D rollup-plugin-visualizer
```
```ts
// vite.config.ts (dev-only-ish; gate behind an env flag)
import { visualizer } from 'rollup-plugin-visualizer';
// plugins: [..., visualizer({ filename: 'dist/stats.html', gzipSize: true })]
```
`pnpm build` then open `dist/stats.html`. Set a budget (e.g. initial JS < 200 KB gzipped) and enforce it with **`size-limit`** (`pnpm add -D size-limit @size-limit/preset-app`, add a `size-limit` array to `package.json`, run `pnpm size-limit` in CI) so regressions fail the build, not just the eyeball.

## 7. Measure Core Web Vitals

```bash
pnpm add web-vitals
```
```ts
// src/libs/reportWebVitals.ts
import { onCLS, onINP, onLCP } from 'web-vitals';

export function reportWebVitals(report: (m: { name: string; value: number }) => void) {
  onCLS(report);
  onINP(report); // INP replaced FID in 2024
  onLCP(report);
}
```
Call it once from the app entry; send to analytics (or the `captureError`-style seam) in prod, `console.log` in dev.

## 8. Images & layout stability
- Always set `width`/`height` (or `aspect-ratio`) so images don't shift layout (**CLS**).
- `loading="lazy"` + `decoding="async"` for below-the-fold images.
- Serve AVIF/WebP; `vite-imagetools` generates responsive `srcset` at build time.
- Preload the LCP image/font; `font-display: swap`.

## 9. Verify
```bash
pnpm build          # inspect dist/stats.html against the budget
pnpm preview        # run Lighthouse / read web-vitals in console
```
Targets: **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1** (mobile, mid-tier device).

## References
- ./performance-rules.md — measure-first, the Compiler's effect, splitting strategy, CWV targets, image/CLS rules, when manual memo still matters.
- ../_shared/conventions.md — `@/` alias, `libs/` seam.
- ../_shared/stack-versions.md — tooling versions.
- ../../landing/build-landing-page/SKILL.md — the hero LCP/CLS budget on public pages, where CWV are ranking + revenue (the priority inversion: `../../landing/_shared/page-types.md`).
