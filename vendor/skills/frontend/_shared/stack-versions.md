# Stack Versions

Version policy for frontend projects scaffolded by these skills.

## Current lines (verified against the npm registry, 2026-10-09)

| Package | Line | Note |
|---|---|---|
| `react` / `react-dom` | 19.3 | `<ViewTransition>`, Fragment refs stable |
| `babel-plugin-react-compiler` | 1.0 | Stable; see `optimize-performance` |
| `vue` | 3.5 | 3.6 (Vapor) is a release candidate — not for production yet |
| `vite` | 8.3 | Rolldown bundler; `@vitejs/plugin-react` 6 / `@vitejs/plugin-vue` 6 |
| `vitest` | 5.0 | Node `^22.12 \|\| ^24 \|\| >=26` (engines); inline `projects` inherit the root config (`extends: true` is the default); `clearMocks` on by default; `render` of `vitest-browser-react` 2.3 and `vitest-browser-vue` 3.1 is async — always `await` it |
| `typescript` | 6.0 in Vue repos, 7.0 elsewhere | `vue-tsc` 3.3 crashes on 7.0.2 (`ERR_PACKAGE_PATH_NOT_EXPORTED`). `baseUrl` is an error in 6.0 and removed in 7.0; `strict` is on by default since 6.0 |
| `@biomejs/biome` | 2.5 | Lint + format; `rules.preset` replaces `rules.recommended` (deprecated, `biome migrate` rewrites it) |
| `tailwindcss` | 4.3 | CSS-first `@theme` |
| `@tanstack/react-query` / `@tanstack/vue-query` | 5.104 | |
| `pinia` | 4.0 | Install `@vue/devtools-api` ^8 next to it (required peer) |
| `zustand` | 5.0 | Selectors that return a new object need `useShallow` |
| `zod` | 4.6 | `z.url()` / `z.email()` replace `z.string().url()` / `.email()` (deprecated); `z.prettifyError()` / `z.flattenError()` replace `error.flatten()` (deprecated) |
| `@playwright/test` | 1.64 | |
| `msw` | 3.0 | `http`, `HttpResponse`, `setupServer` (`msw/node`), `setupWorker` (`msw/browser`) |
| `storybook` | 10.6 | `@storybook/addon-essentials` is gone after 8.x; the essentials ship in core. Vitest addon: `storybook add @storybook/addon-vitest` |
| `@sentry/react` / `@sentry/vue` | 11.6 | `@sentry/vite-plugin` 5.4 (`sourcemaps.filesToDeleteAfterUpload`, `release.name`) |
| `react-error-boundary` | 6.1 | Optional; see `set-up-error-boundaries` |
| `lefthook` | 2.2 | |
| `pnpm` | 12.10 | Do not hard-code a version in `packageManager`; write the installed one (`pnpm -v`) |
| Node | 24 (LTS, maintenance from 2026-10-20), 26 (LTS from 2026-10-28) | Schedule: `nodejs/Release` `schedule.json` |
| Frameworks (pointers only) | Next.js 16.4, Nuxt 4.6 | See `framework-idioms.md` |
| `vue-router` | 5.4.0 | Includes file-based routing, `vue-router/vite` |
| `@tanstack/react-router` | 1.170 | |
| `react-hook-form` | 7.89 | |
| `@hookform/resolvers` | 5.9 | |
| `vee-validate` | 4.15.1 | 5.0.0-beta.0 exists |
| `i18next` | 26.4 | Needs `react-i18next` 17 >= i18next 26.2 |
| `vue-i18n` | 11.4 | |
| `@openfeature/web-sdk` | 1.10 | Peer `@openfeature/core` ^1.12 |
| `@openfeature/react-sdk` | 1.4 | |
| `tailwind-merge` | 3.7 | |
| `class-variance-authority` | 0.7.1 | Last release 2024-11 |
| `motion` | 14.0 | |
| `motion-v` | 2.6 | |
| `vite-plugin-pwa` | 2.0.0 | Vite 8 ok |
| `web-vitals` | 6.2 | |
| `@unhead/*` | 3.4 | React >= 19.2.4 |
| `@plausible-analytics/tracker` | 0.4.6 | |
| `axe-core` | 4.14 | |
| `@axe-core/playwright` | 4.13 | |
| `size-limit` | 14.2 | |
| `rollup-plugin-visualizer` | 7.1 | Works with Vite 8 |
| `@rolldown/plugin-babel` | 0.2.4 | |
| `@vitejs/plugin-react` | 6.1 | |

Re-verify with `npm view <pkg> dist-tags` before a scaffold; this table is a floor, not a pin. Anything above that the registry shows differently wins.

## Stack profile

Every skill in this catalogue reads `.claude/stack-profile.md` (schema: [`../../core/_shared/stack-profile.md`](../../core/_shared/stack-profile.md)) in its audit step. Keys used here: `package_manager`, `runtime_manager`, `frontend.framework`, `frontend.meta`, `lint_format.ts`, `tests.layout`. A key that is present beats the default in the skill; a key that is absent is detected from the repo (lockfile, `package.json`, existing config).

| This catalogue writes | `npm` | `bun` | `yarn` |
|---|---|---|---|
| `pnpm add <pkg>` / `pnpm add -D <pkg>` | `npm i <pkg>` / `npm i -D <pkg>` | `bun add <pkg>` / `bun add -d <pkg>` | `yarn add <pkg>` / `yarn add -D <pkg>` |
| `pnpm add -D -E <pkg>` | `npm i -D -E <pkg>` | `bun add -d -E <pkg>` | `yarn add -D -E <pkg>` |
| `pnpm exec <bin>` / `pnpm <script>` | `npx <bin>` / `npm run <script>` | `bunx <bin>` / `bun run <script>` | `yarn <bin>` / `yarn <script>` |
| `pnpm dlx <pkg>` / `pnpm create vite` | `npx <pkg>` / `npm create vite@latest` | `bunx <pkg>` / `bun create vite` | `yarn dlx <pkg>` / `yarn create vite` |

## Rule: Node — pin an LTS major, floor it in `engines`
**Why:** An LTS line has a long support window, so CI and hosting choices stay stable. An even-numbered major is the only kind that becomes LTS; odd majors die in months. Node 24 is LTS today and moves to maintenance on 2026-10-20; Node 26 becomes LTS on 2026-10-28 ([schedule](https://github.com/nodejs/Release/blob/main/schedule.json)).
**How to apply:** `.nvmrc` holds the major (`24`; `26` once it is LTS), and `engines.node` holds the floor (`>=24`). With `runtime_manager: mise` in the profile, pin `node` in `mise.toml` instead of `.nvmrc`. Bump both when moving to the next LTS.

## Rule: pnpm by default; the profile and the lockfile override it
**Why:** pnpm's strict `node_modules` layout makes a missing dependency fail at once instead of working by accident (a "phantom dependency"), and its content-addressable store saves disk. That is a default, not a mandate: a repo that already has a lockfile for another tool should not get a second one.
**How to apply:** Order of precedence: `package_manager` in the stack profile, then the lockfile in the repo (`pnpm-lock.yaml`, `package-lock.json`, `bun.lock`, `yarn.lock`), then pnpm. Translate commands with the table above.

## Rule: caret (^) for runtime deps; pinned (~) for build/test tooling
**Why:** Runtime deps benefit from minor-version updates (security, perf). Build/test tooling churn breaks reproducibility — pin to patch only.
**How to apply:**
- `react`, `vue`, `@tanstack/react-query`, `@tanstack/vue-query`, `zustand`, `pinia`, etc. → `^X.Y.Z`
- `vite`, `vitest`, `playwright`, `typescript` → `~X.Y.Z`
- `@biomejs/biome` → exact (`-E`): a new lint rule must not fail CI unannounced

**Anti-example:**
```json
// bad: every dep pinned to exact version (over-tight; manual bumps for security patches)
"dependencies": { "react": "19.2.0" }

// bad: every dep on caret (test/build tooling can break minor)
"devDependencies": { "vite": "^8.0.0" }
```

## Rule: Vue 3.5+ only; React 19+
**Why:** Vue 2 reached EOL 2023-12-31; 3.5 brought `useTemplateRef`, `useId` and reactive props destructure, which the skills use. React 19 stabilized actions and the compiler-ready model.
**How to apply:** Scaffold skill rejects requests for Vue 2; defaults React to 19. Write Vue in `<script setup>` only — that is also the entry ticket to Vapor Mode later.

## Rule: TypeScript 6.x in Vue projects until `vue-tsc` supports 7
**Why:** TS 7.0 is the Go-native compiler; `vue-tsc` 3.3.12 requires `typescript/lib/tsc`, which 7.0.2 does not export, and fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` (reproduced 2026-10-09; its peer range `>=5.0.0` hides it from the package manager). React and plain-TS packages can use 7.0.
**How to apply:** Vue: `"typescript": "~6.0.x"` (the `create-vite` template already pins it). Revisit when TS 7.1 and a matching `vue-tsc` release land.

## Rule: Storybook latest stable major
**Why:** Storybook majors ship breaking config changes (8 to 9 removed `addon-essentials` as a separate package). The lockfile pins the major; a major bump is a deliberate task.
**How to apply:** `pnpm dlx storybook@latest init`. Do not fight an existing major.

## When to deviate

- **Older Node:** if a hosting target (e.g., legacy Lambda runtime) requires Node < 24, document the constraint in the project's README and pin accordingly. Vitest 5 needs 22.12 or newer.
- **Another package manager:** projects with an established lockfile, or `package_manager` in the profile — keep it.
- **Tilde pins on tooling:** a small app with Renovate/Dependabot grouped updates can use `^` for tooling too; the tilde rule pays when nobody reviews bumps.
