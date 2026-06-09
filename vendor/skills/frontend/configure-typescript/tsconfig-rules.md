# TSConfig Rules

Reference for `configure-typescript`. Each compiler option enabled, with rationale and edge cases.

## Rule: `strict: true`
**Why:** Umbrella for all strict-family flags. The single biggest improvement to type safety in any TS project.
**How to apply:** Always on. Catches `null`/`undefined` mistakes, implicit `any`, contravariant function types, and more.

```ts
// strict catches:
function greet(name: string) { return `Hi ${name}`; }
greet(undefined); // error: Argument of type 'undefined' is not assignable to parameter of type 'string'.
```

## Rule: `noUncheckedIndexedAccess: true`
**Why:** TypeScript's default treats `arr[0]` as `T`, but the index might be out of bounds — runtime `undefined`. This flag adds `| undefined` to every indexed access, forcing the developer to handle the missing case.
**How to apply:** Always on for new projects. Existing projects may need a migration pass; do it anyway.

```ts
// without flag:
const arr: string[] = [];
const first: string = arr[0]; // compiles, runtime is undefined

// with flag:
const first: string | undefined = arr[0]; // forced to handle the maybe-undefined
```

## Rule: `noImplicitOverride: true`
**Why:** Catches subclass methods that look like overrides but don't actually override (e.g., parent renamed the method). Without the flag, the subclass silently keeps a no-longer-overriding method.
**How to apply:** Always on. Requires `override` keyword on intentional overrides.

## Rule: `noUnusedLocals: true` and `noUnusedParameters: true`
**Why:** Dead variables and parameters drift away from intent. Force their removal or `_`-prefix to keep code intentional.
**How to apply:** Use `_param` prefix for parameters that exist for interface compliance but aren't used.

```ts
// good
function callback(_e: Event, data: Data) { /* uses data */ }

// bad: silently retained, no signal of intent
function callback(e: Event, data: Data) { /* uses data only */ }
```

## Rule: `exactOptionalPropertyTypes: true`
**Why:** Distinguishes `{ x?: number }` (key may be absent) from `{ x: number | undefined }` (key always present, value may be undefined). Without the flag, both behave identically — losing precision at API boundaries.
**How to apply:** Default on. May need adjustments at REST API serialization layers.

```ts
type User = { name: string; nickname?: string };
// with flag, this is an error (assigning explicit undefined to a maybe-absent key):
const u: User = { name: 'V', nickname: undefined };
// instead, omit the key:
const u: User = { name: 'V' };
```

## Rule: `verbatimModuleSyntax: true`
**Why:** Forces explicit `import type` / `export type` for type-only imports, so the emitted JS contains exactly the imports you wrote — no surprise elision, clean tree-shaking, and correct ESM behavior under bundlers like Vite. Replaces the deprecated `importsNotUsedAsValues` / `preserveValueImports`.
**How to apply:** Always on for Vite/ESM projects. Use inline `import { foo, type Bar }` or a separate `import type { Bar }`.

```ts
// good
import { useState, type ReactNode } from 'react';
import type { User } from '@/models/user';
```

## Rule: `baseUrl: "."` + `paths`
**Why:** Foundation for path aliases. Without `baseUrl`, `paths` doesn't resolve.
**How to apply:** Always set both together. See `path-aliases.md`.

## When to deviate

- **Migrating an existing codebase:** turning on all flags at once produces hundreds of errors. Migration order: `strict` first, then `noUncheckedIndexedAccess`, then `exactOptionalPropertyTypes`. Tackle one flag per PR.
- **Library code targeting older TS users:** keep `strict` but consider holding off on `exactOptionalPropertyTypes` until users have upgraded compilers.

## Recommended `compilerOptions` block

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "useDefineForClassFields": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

(For Vue projects, replace `"jsx": "react-jsx"` with what `vue-tsc` expects, typically just omit it.)
