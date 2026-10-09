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

The compiler auto-memoizes — new code needs no `useMemo`/`useCallback`/`memo`. Compiler 1.0 is stable; React 19 needs no runtime shim.

A new project can start from `pnpm create vite@latest <name> --template react-compiler-ts`. Existing project, `@vitejs/plugin-react` ≥ 6 (Vite 8):
```bash
pnpm add -D -E babel-plugin-react-compiler
pnpm add -D @rolldown/plugin-babel
```
```ts
// vite.config.ts
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    // if set-up-routing ran, tanstackRouter() goes FIRST
    react(),
    babel({ presets: [reactCompilerPreset()] }), // order as in the React docs; the preset runs on source
    // then tailwindcss()
  ],
});
```
plugin-react 6 removed the inline `react({ babel: … })` option — a config using it fails silently on the compiler. Next.js 16: `reactCompiler: true` in `next.config.ts` (plus the same Babel plugin).

Pin the compiler exact (`-E`): its output can change between versions. In existing code, **leave** manual memoization in place — removing it can change what the compiler emits; new code just doesn't add it. Keep Zustand selectors (a subscription, not memoization; see `set-up-state-management`). The compiler's lint rules live in `eslint-plugin-react-hooks`, not Biome — see `configure-linting/lint-and-format.md` for when to add it.

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
