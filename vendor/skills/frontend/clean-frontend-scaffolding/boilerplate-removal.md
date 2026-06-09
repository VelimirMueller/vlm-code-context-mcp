# Boilerplate Removal

Reference for `clean-frontend-scaffolding`. Enumerates every file the Vite scaffold creates with default content and what to do with each.

## Rule: leave file structure intact when possible
**Why:** Other skills (`set-up-frontend-structure`, `configure-typescript`, etc.) assume canonical file paths (`src/main.tsx`, `src/App.tsx`). Renaming or deleting these breaks downstream skills.
**How to apply:** Reduce file *content* to a minimal shell rather than deleting the file entirely.

## Rule: keep `src/index.css` (or `src/style.css`) as the Tailwind entry
**Why:** The `@tailwindcss/vite` plugin consumes one canonical entry stylesheet. Removing it means Tailwind never loads.
**How to apply:** Replace the file *content* with the Tailwind v4 import. v4 (the 2026 default) replaced the three `@tailwind` directives with one `@import`, and moved config to CSS-first `@theme` (a future design-system skill owns tokens). Don't delete the file. If the project is pinned to Tailwind v3, keep the three `@tailwind` directives instead — audit the installed major first.

```css
@import "tailwindcss";
```

**Anti-example:**
```bash
# bad: deletes the entry stylesheet — Tailwind generates nothing
rm src/index.css
```

## Rule: scrub the `index.html` `<title>` and meta
**Why:** `Vite + React` is a giveaway that the project is unfinished. Page title is also indexed by search engines and shown in browser tabs.
**How to apply:** Set `<title>` to the project name. Add `<meta name="description">` placeholder if absent.

## Rule: delete demo SVG assets
**Why:** `vite.svg`, `react.svg`, `vue.svg` are unused after the scaffold and silently bloat the bundle if anything references them.
**How to apply:**
```bash
rm -f public/vite.svg src/assets/react.svg src/assets/vue.svg
```

## Rule: don't carry the demo component
**Why:** Vue scaffold ships `src/components/HelloWorld.vue`; React 19 templates sometimes ship a `Counter` example. These leak into atomic-design folders later if not removed first.
**How to apply:** Delete the demo components before running `set-up-frontend-structure`.

## When to deviate

- **Project README / docs:** if the project keeps `vite.svg` as part of branding/docs (rare), document it inline and skip that step.
- **Test setup:** if `App.tsx` is referenced by an existing test, keep the export shape (`default export App`) when reducing it.

## Files referenced

| File | Action |
|---|---|
| `src/App.tsx` (React) | Reduce to minimal `App shell` component |
| `src/App.vue` (Vue) | Reduce to minimal template |
| `src/main.tsx` / `src/main.ts` | Reduce to clean root render |
| `src/App.css` | Replace with single comment |
| `src/index.css` / `src/style.css` | Replace with Tailwind directives |
| `src/assets/react.svg` | Delete |
| `src/assets/vue.svg` | Delete |
| `public/vite.svg` | Delete |
| `src/components/HelloWorld.vue` | Delete (Vue scaffold) |
| `index.html` | Update `<title>`, add `<meta name="description">` |
