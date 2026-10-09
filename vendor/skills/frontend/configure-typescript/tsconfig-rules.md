# TSConfig Rules

Reference for `configure-typescript`. Each compiler option, why it is on, and what it costs. Verified against TypeScript 6.0.3 and 7.0.2 on 2026-10-09.

## Rule: `strict: true`
**Why:** It is the umbrella for the strict family (`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, …). Since TS 6.0 it is on by default (a tsconfig without it still reports implicit `any` and `null` errors on 6.0.3 and 7.0.2, reproduced), but the React template does not write it, and a TS 5 repo needs it.
**How to apply:** Write `"strict": true` anyway: it states the intent, survives a downgrade, and costs one line.

```ts
function greet(name: string) { return `Hi ${name}`; }
greet(undefined); // error: 'undefined' is not assignable to 'string'
```

## Rule: `noUncheckedIndexedAccess: true`
**Why:** TypeScript types `arr[0]` as `T`, but an empty array returns `undefined` at runtime. The flag adds `| undefined` to every index access, so the missing case must be handled. It is not part of `strict`, so it is a separate decision; it pays because index-out-of-range is a real, common runtime bug.
**How to apply:** On for new projects. On an existing codebase, enable it in its own PR.

```ts
const arr: string[] = [];
const first = arr[0]; // string | undefined, with the flag
```

## Rule: `noImplicitOverride: true`
**Why:** When a base class renames a method, a subclass method that was an override silently becomes a new method. `override` makes the intent checkable.
**How to apply:** On. Every intentional override carries `override`. Class-based React error boundaries need it on `state`, `componentDidCatch` and `render` (`set-up-error-boundaries`).

## Rule: `noUnusedLocals` / `noUnusedParameters`
**Why:** Dead variables hide logic that was meant to run. The Vite templates already turn both on.
**How to apply:** Prefix a parameter that exists only for an interface with `_` (`_event`).

## Rule: `verbatimModuleSyntax: true`
**Why:** The emitted JS contains exactly the imports you wrote, so nothing is elided behind your back and `import type` marks what disappears. It replaces `importsNotUsedAsValues` / `preserveValueImports`. Vite's esbuild/Oxc transpile one file at a time and cannot see types, which is why this flag is the safe setting for Vite.
**How to apply:** On (templates set it). Use `import type { X }` or `import { y, type X }`. Biome's `useImportType` fixes the shape (`configure-linting`).

## Rule: no `baseUrl`; `paths` alone
**Why:** TS 6.0 reports `baseUrl` as an error (TS5101, "will stop functioning in TypeScript 7.0") and TS 7.0 rejects it (TS5102, "has been removed"). Since TS 4.1 `paths` works without it; entries resolve relative to the tsconfig that declares them. Both messages reproduced on 2026-10-09.
**How to apply:** `"paths": { "@/*": ["./src/*"] }` and no `baseUrl`. Do not add `"ignoreDeprecations": "6.0"`; it only postpones the removal.

**Anti-example:**
```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```

## Rule: type-check with `tsc -b`, never `tsc --noEmit`
**Why:** The Vite 8 templates keep a root `tsconfig.json` of `{ "files": [], "references": [...] }`. `tsc --noEmit` against it type-checks zero files and exits 0, even with a type error in `src/` (reproduced). `tsc -b` follows the references.
**How to apply:** `"typecheck": "tsc -b"` (Vue: `vue-tsc -b`). CI runs the same script.

## Rule: TypeScript 6 for Vue, 7 elsewhere
**Why:** `vue-tsc` 3.3 resolves `typescript/lib/tsc`, which TS 7.0.2 does not export; the run fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` (reproduced), although `vue-tsc` declares `typescript >=5.0.0`, so the package manager does not warn. React and plain-TS packages run fine on 7.0 (the Go-native compiler).
**How to apply:** Vue: `"typescript": "~6.0.x"` (the template pins it). Re-check when `vue-tsc` documents TS 7 support.

## Opt-in tier: `exactOptionalPropertyTypes`
**Why it is not default:** It separates `{ x?: number }` (key absent) from `{ x: number | undefined }`. That precision is rarely worth the friction: every wrapper that forwards an optional prop (`error={this.state.error}`, `{ componentStack: info.componentStack ?? undefined }`) now fails to compile and needs `| undefined` written out, and library types written without the flag leak into your code. Two of the five type errors in the original `ErrorBoundary` snippet were this flag. It is not part of `strict`.
**When to turn it on:** A codebase that serializes to an API where "absent" and "null/undefined" differ (PATCH bodies, JSON merge patch), and that has few component wrappers. Add it then, in its own PR.

```ts
type User = { name: string; nickname?: string };
const u: User = { name: 'V', nickname: undefined }; // error only with the flag
```

## Recommended `compilerOptions` (Vite 8 template, React)

The React template already has every line except `strict` (a default on TS 6+, written out for clarity), `noUncheckedIndexedAccess`, `noImplicitOverride` and `paths`:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "erasableSyntaxOnly": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

For Vue, keep `extends: "@vue/tsconfig/tsconfig.dom.json"` as the template has it (it sets `strict`) and add the other three lines. `erasableSyntaxOnly` bans enums and parameter properties, which keeps the code erasable by Node's type stripping and by any per-file transpiler; keep it.

## When to deviate

- **Migrating an existing codebase:** enabling all flags at once gives hundreds of errors. Order: `strict`, then `noUncheckedIndexedAccess`, then `noImplicitOverride`. One flag per PR.
- **Library code for older TS users:** keep `strict`; hold back flags that change the published `.d.ts` behaviour for consumers.
- **Enums or parameter properties are needed:** drop `erasableSyntaxOnly` for that project and say why in the README; prefer `as const` objects over enums.
