---
name: set-up-frontend-structure
description: Use when laying down folder structure for a frontend project — creates the shared layout every repo uses (atomic-design components, hooks-or-composables, libs, utils, stores, styles, locales, and feature modules from the second domain on), with index.ts barrels and one example component (with a story) per atomic layer to document the pattern.
---

# Set Up Frontend Structure

## 1. Audit current state

For each folder below, check if it already exists and is non-empty:
- `src/components/atoms`
- `src/components/molecules`
- `src/components/organisms`
- `src/components/templates`
- `src/components/pages`
- `src/hooks` (React) **or** `src/composables` (Vue)
- `src/libs`
- `src/utils`
- `src/stores`
- `src/styles`
- `src/features` (only if the app already has two or more domains)

(The test tree lives at a top-level `tests/`, created by `configure-test-stack` — not here.)

Detect framework from `package.json` (`react` vs `vue`). The hook-vs-composable folder is framework-specific — see `../_shared/conventions.md`.

If every folder exists and is non-empty, exit: "Structure already in place."

## 2. Decide what to do

- Nothing in place → full setup (steps 3–5).
- Partial → create only missing folders; do not overwrite existing files.
- Already structured → exit.

## 3. Create folder tree

Create:

```
src/
├── components/
│   ├── atoms/
│   ├── molecules/
│   ├── organisms/
│   ├── templates/
│   └── pages/
├── hooks/        (React) OR composables/ (Vue)
├── libs/
├── utils/
├── stores/
└── styles/
```

`src/features/<domain>/` is created by `create-module` when the second domain arrives; `src/locales/` by `set-up-i18n`. The full map, the findability table and the Nuxt/Next mapping: `folder-conventions.md`.

(Tests are **not** under `src/`. `configure-test-stack` creates a top-level `tests/{unit,ui,integration,e2e}` tree.)

Drop a `.gitkeep` in each empty folder so git tracks them.

## 4. Add barrel files

Create one `index.ts` per atomic layer (5 files) and one for hooks/composables, libs, utils. Each starts empty (just a header comment) and gets re-exports added as components/utilities are introduced.

```ts
// src/components/atoms/index.ts
// Barrel: re-exports every atom in this folder.
```

Repeat for molecules, organisms, templates, pages, hooks (or composables), libs, utils, stores.

## 5. Generate one example per atomic layer

To document the convention, generate a single example component at each layer with a matching `*.stories.ts` sibling. Tests are **not** co-located — they live in a top-level `tests/` tree created by `configure-test-stack` (ref `test-layout.md`); stories sit beside their component, where the Storybook Vitest addon runs them as tests in place.

### React example tree

```
src/components/atoms/Button/
├── Button.tsx
├── Button.stories.ts
└── index.ts

src/components/molecules/SearchInput/
├── SearchInput.tsx
├── SearchInput.stories.ts
└── index.ts

src/components/organisms/Header/
├── Header.tsx
├── Header.stories.ts
└── index.ts

src/components/templates/AuthLayout/
├── AuthLayout.tsx
├── AuthLayout.stories.ts
└── index.ts

src/components/pages/HomePage/
├── HomePage.tsx
├── HomePage.stories.ts
└── index.ts
```

### Example file content (React `Button` atom)

```tsx
// src/components/atoms/Button/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function Button({ children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}
```

```ts
// src/components/atoms/Button/index.ts
export * from './Button';
```

```ts
// src/components/atoms/Button/Button.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
};
export default meta;

export const Default: StoryObj<typeof Button> = {
  args: { children: 'Click me' },
};
```

For Vue projects, mirror this structure with `.vue` SFCs and `.stories.ts` siblings (no co-located tests). Write them in the Vue 3.5 shape — `<script setup>`, destructured props with defaults, `useTemplateRef`, `defineModel` — see `../_shared/framework-idioms.md`.

After generating one example per layer, also update each barrel:

```ts
// src/components/atoms/index.ts
export * from './Button';
```

## 6. Verify

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. The example components and their stories compile.

If stories fail to resolve `@storybook/*`, the deps weren't installed — run `scaffold-frontend-project` first. The test stack (Vitest browser mode, Playwright, MSW, and the top-level `tests/` tree) is set up separately by `configure-test-stack`.

## References
- ./atomic-design.md — methodology, criteria for each layer, anti-patterns.
- ./folder-conventions.md — the shared layout, the findability table, the Nuxt/Next mapping, naming, barrels, hooks vs composables.
- ../_shared/framework-idioms.md — Vue 3.5 / React 19 idioms for the generated examples.
- ../_shared/glossary.md — atomic terms (atom / molecule / organism / template / page) with the "test" question for each.
