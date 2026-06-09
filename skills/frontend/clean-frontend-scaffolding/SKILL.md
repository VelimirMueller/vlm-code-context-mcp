---
name: clean-frontend-scaffolding
description: Use when cleaning up a freshly scaffolded frontend project — purges default boilerplate (demo components, default styles, placeholder routes, sample assets) before laying down real structure.
---

# Clean Frontend Scaffolding

## 1. Audit current state

Detect framework from `package.json`:
- `react` in dependencies → React project.
- `vue` in dependencies → Vue project.

For each item below, check if it still has Vite scaffold default content (heuristic: file size + scaffolded import patterns):
- `src/App.tsx` (React) or `src/App.vue` (Vue)
- `src/main.tsx` / `src/main.ts`
- `src/App.css` / `src/style.css` / `src/index.css` (default Vite content)
- `public/vite.svg`, `src/assets/react.svg`, `src/assets/vue.svg`
- `index.html` (default `<title>Vite + React</title>` etc.)

If every checked file is already custom, exit early with: "Scaffold cleanup not needed — files appear customized."

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

3. Replace `src/App.css` content with a single comment: `/* Project styles (Tailwind handles most layout). */`
4. Replace `src/index.css` content with the Tailwind v4 import (v4 dropped the three `@tailwind` directives for a single `@import`):

   ```css
   @import "tailwindcss";
   ```

5. Delete `src/assets/react.svg` and `public/vite.svg`.
6. Update `index.html` `<title>` to the project name (ask via AskUserQuestion if unknown).

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

3. Replace `src/style.css` with the Tailwind directives only (see React step 4).
4. Delete `src/assets/vue.svg`, `public/vite.svg`, `src/components/HelloWorld.vue` (if present).
5. Update `index.html` `<title>` to the project name.

## 4. Verify

```bash
pnpm dev
```

Expected: dev server starts; visiting the app shows the empty shell with no console errors. Stop the server.

## References
- ./boilerplate-removal.md — exact files and patterns per framework, with examples and anti-patterns.
- ../_shared/conventions.md — path alias and source-root conventions.
