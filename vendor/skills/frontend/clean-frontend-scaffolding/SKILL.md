---
name: clean-frontend-scaffolding
description: Use when a freshly scaffolded Vite app still has the demo App, default styles, sample assets and placeholder title; reduces them to a minimal shell before real structure is added.
---

# Clean Frontend Scaffolding

## 1. Audit current state

Read `.claude/stack-profile.md` if present: `frontend.framework` (`react` | `vue`) decides the branch; otherwise detect it from `package.json` (`react` or `vue` in dependencies). `frontend.meta` of `nuxt` or `next` → exit; those scaffolds have their own layout.

Look for the markers of the create-vite templates (Vite 8):
```bash
grep -l "assets/hero.png\|assets/react.svg\|assets/vue.svg\|HelloWorld\|Get started" src/App.* src/components/*.vue 2>/dev/null
grep -l "Vite + " index.html 2>/dev/null          # <title>Vite + React + TS</title>
ls src/assets src/App.css public 2>/dev/null       # hero.png, react.svg, vue.svg, vite.svg, favicon.svg, icons.svg
```

If none of these exist or match, exit early with: "Scaffold cleanup not needed — files appear customized."

## 2. Decide what to do

- All scaffold defaults present → full clean (proceed to step 3).
- Partially customized → remove only the default items still present.
- Already customized → exit.

## 3. Purge boilerplate

### React

1. Reduce `src/App.tsx` to:

   ```tsx
   export default function App() {
     return <div>App shell</div>;
   }
   ```

2. Reduce `src/main.tsx` to a clean root render:

   ```tsx
   import { StrictMode } from 'react';
   import { createRoot } from 'react-dom/client';
   import App from './App';
   import './index.css';

   createRoot(document.getElementById('root')!).render(
     <StrictMode>
       <App />
     </StrictMode>,
   );
   ```

3. Delete `src/App.css`; the reduced `App.tsx` no longer imports it, and nothing else does.
4. Replace `src/index.css` content with the Tailwind v4 import (v4 dropped the three `@tailwind` directives for a single `@import`):

   ```css
   @import "tailwindcss";
   ```

5. Delete `src/assets/` (`hero.png`, `react.svg`, `vite.svg`) and `public/icons.svg` (the demo's social-icon sprite). Keep `public/favicon.svg` until the project has its own icon; it is the Vite logo.
6. Update `index.html` `<title>` (`Vite + React + TS`) to the project name (ask via AskUserQuestion if unknown).

### Vue

1. Reduce `src/App.vue` to:

   ```vue
   <script setup lang="ts"></script>
   <template>
     <div>App shell</div>
   </template>
   ```

2. Reduce `src/main.ts` to:

   ```ts
   import { createApp } from 'vue';
   import App from './App.vue';
   import './style.css';

   createApp(App).mount('#app');
   ```

3. Replace `src/style.css` with the Tailwind v4 import only (see React step 4).
4. Delete `src/assets/` (`hero.png`, `vite.svg`, `vue.svg`), `public/icons.svg` and `src/components/HelloWorld.vue`. Keep `public/favicon.svg` until the project has its own icon.
5. Update `index.html` `<title>` (`Vite + Vue + TS`) to the project name.

## 4. Verify

```bash
pnpm dev
```

Expected: dev server starts; visiting the app shows the empty shell with no console errors. Stop the server. `pnpm build` must also pass: it runs `tsc -b`/`vue-tsc -b`, which catches an import of a deleted asset.

## References
- ./boilerplate-removal.md — exact files and patterns per framework, with examples and anti-patterns.
- ../_shared/conventions.md — path alias and source-root conventions.
