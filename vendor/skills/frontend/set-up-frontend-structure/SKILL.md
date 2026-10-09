---
name: set-up-frontend-structure
description: Use when laying down the folder layout of a frontend project - atomic-design components, hooks or composables, libs, utils, stores, styles, and feature modules from the second domain on, with one example component.
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

Read `.claude/stack-profile.md` if present: `frontend.framework` (`react` | `vue`) replaces the `package.json` detection; `frontend.meta` of `nuxt` or `next` switches to the mapping table in `folder-conventions.md` ("Nuxt and Next use the same names inside their own roots"): the source root is `app/` for Nuxt, routing folders belong to the framework, and `pages/` is not created twice. Otherwise detect from `package.json`. The hook-vs-composable folder is framework-specific — see `../_shared/conventions.md`.

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

(By default tests are **not** under `src/`: `configure-test-stack` creates a top-level `tests/{unit,ui,integration,e2e}` tree. With `tests.layout: colocated` in the profile, tests sit beside the code and no `tests/` tree is needed except for `e2e/`.)

Drop a `.gitkeep` in each empty folder so git tracks them; delete it in the commit that adds the first real file.

## 4. Barrels: component folders and features only

Do **not** create layer-level barrels (`components/atoms/index.ts`, `utils/index.ts`, …): importing one atom would make Vite load every file in the layer (`../_shared/conventions.md`, "barrels re-export, never define"). Each component folder gets a one-line `index.ts` (step 5); each feature gets `features/<domain>/index.ts` when `create-module` adds it. Import utilities by path: `@/utils/formatDate`.

## 5. Generate one example component

One example is enough to show the convention; the other layers are described in `atomic-design.md`, and a component written to "fill the layer" is a component someone deletes. Generate the `Button` atom. Add the `*.stories.ts` sibling **only if Storybook is installed** (`grep storybook package.json`); the scaffold does not install it. Tests are **not** co-located by default — they live in a top-level `tests/` tree created by `configure-test-stack` (ref `test-layout.md`; `tests.layout: colocated` in the profile reverses that); stories sit beside their component, where the Storybook Vitest addon runs them as tests in place.

```
src/components/atoms/Button/
├── Button.tsx
├── Button.stories.ts     # only with Storybook
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
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Atoms/Button',
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Click me' },
};
```

Import `Meta`/`StoryObj` from the **framework** package (`@storybook/react-vite`, Vue: `@storybook/vue3-vite`), not `@storybook/react`: the framework package re-exports them, and under pnpm's strict layout the renderer package is not a direct dependency, so importing it fails to resolve.

For Vue projects, write `Button.vue` (+ `Button.stories.ts`) in the Vue 3.5 shape — `<script setup>`, destructured props with defaults, `useTemplateRef`, `defineModel` — see `../_shared/framework-idioms.md`.

## 6. Verify

```bash
pnpm typecheck
```

Expected: exit 0. The example component (and its story, if Storybook is installed) compile.

A story that cannot resolve `@storybook/*` means Storybook is not installed: delete the story or install Storybook (`pnpm dlx storybook@latest init`). The test stack (Vitest browser mode, Playwright, MSW, and the top-level `tests/` tree) is set up separately by `configure-test-stack`.

## References
- ./atomic-design.md — methodology, criteria for each layer, anti-patterns.
- ./folder-conventions.md — the shared layout, the findability table, the Nuxt/Next mapping, naming, barrels, hooks vs composables.
- ../_shared/framework-idioms.md — Vue 3.5 / React 19 idioms for the generated examples.
- ../_shared/glossary.md — atomic terms (atom / molecule / organism / template / page) with the "test" question for each.
