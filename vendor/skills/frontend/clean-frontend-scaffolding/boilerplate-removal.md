# Boilerplate Removal

Reference for `clean-frontend-scaffolding`. Enumerates every file the Vite scaffold creates with default content and what to do with each.

## Rule: keep the files other skills name; delete the ones nothing imports
**Why:** Later skills assume `src/main.tsx`, `src/App.tsx` (or `.vue`) and one entry stylesheet, so those stay and shrink. A file that only the demo imports (`App.css`, the sample assets) has no such caller; keeping it as an empty shell is clutter.
**How to apply:** Reduce `main`, `App` and the entry stylesheet to a minimal shell. Delete `App.css`, `src/assets/*`, `public/icons.svg`, `HelloWorld.vue`. The "entry stylesheet" is `src/index.css` (or `src/style.css`), not `App.css`: `App.css` is deleted outright because nothing imports it once the demo `App` is reduced.

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

## Rule: delete the demo assets
**Why:** The Vite 8 templates ship `src/assets/{hero.png,react.svg|vue.svg,vite.svg}` and `public/{favicon.svg,icons.svg}`. After the demo `App` is reduced, nothing references them, and every asset that is imported gets bundled. (Older templates had `public/vite.svg`; the current ones do not.)
**How to apply:**
```bash
rm -rf src/assets public/icons.svg src/App.css            # React
rm -rf src/assets public/icons.svg src/components/HelloWorld.vue   # Vue
```
Keep `public/favicon.svg` (it is the Vite logo) until a real icon exists; `index.html` links it.

## Rule: don't carry the demo component
**Why:** The Vue scaffold ships `src/components/HelloWorld.vue`; the React template puts the counter inside `App.tsx`. A demo component that survives gets moved into an atomic-design folder by the next skill and stays.
**How to apply:** Delete the demo components before running `set-up-frontend-structure`.

## When to deviate

- **Project README / docs:** if the project keeps a Vite asset as part of branding/docs (rare), document it inline and skip that step.
- **Prototype you will throw away:** skip the skill; a demo page you never ship costs nothing to keep.
- **Test setup:** if `App.tsx` is referenced by an existing test, keep the export shape (`default export App`) when reducing it.

## Files referenced

| File | Action |
|---|---|
| `src/App.tsx` (React) | Reduce to minimal `App shell` component |
| `src/App.vue` (Vue) | Reduce to minimal template |
| `src/main.tsx` / `src/main.ts` | Reduce to clean root render |
| `src/App.css` (React) | Delete |
| `src/index.css` / `src/style.css` | Replace with the Tailwind v4 import |
| `src/assets/*` (`hero.png`, `react.svg`/`vue.svg`, `vite.svg`) | Delete |
| `public/icons.svg` | Delete |
| `public/favicon.svg` | Keep until a real icon exists |
| `src/components/HelloWorld.vue` | Delete (Vue scaffold) |
| `index.html` | Update `<title>`, add `<meta name="description">` |
