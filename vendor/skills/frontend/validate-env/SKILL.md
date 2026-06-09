---
name: validate-env
description: Use when a frontend project reads environment variables — validates import.meta.env against a Zod schema once at startup (failing fast with a clear message), exports a typed env object the seams import instead of raw import.meta.env, and augments ImportMetaEnv for autocomplete.
---

# Validate Env

## 1. Audit current state

```bash
ls src/libs/env.ts 2>/dev/null
grep -rn "import.meta.env.VITE_" src/ 2>/dev/null | head   # raw, unvalidated reads to migrate
```

A missing/blank `VITE_API_URL` today fails *silently at runtime* (the `fetcher` falls back to `''`). This skill turns that into a startup error. **Prerequisite:** `zod` (already present if `set-up-forms` ran; else install it).

## 2. Decide what to do
- No `env.ts` → create it (steps 4–6) and migrate raw reads (step 6).
- `env.ts` exists → confirm the schema covers every `VITE_*` the app reads.

## 3. Detect framework
Framework-agnostic — Vite exposes `import.meta.env` in both React and Vue.

## 4. Install (if needed)
```bash
pnpm add zod
```

## 5. Schema + parse once, at startup

```ts
// src/libs/env.ts
import { z } from 'zod';

const schema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_ANALYTICS_DOMAIN: z.string().min(1).optional(),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables — check your .env / deployment config.');
}

/** Validated, typed env. Import this — never read `import.meta.env.VITE_*` directly. */
export const env = parsed.data;
```

Importing `env.ts` anywhere (the seams do) runs the check before the app renders, so a misconfigured deploy fails loudly at boot instead of with a confusing blank-URL fetch later.

## 6. Type `import.meta.env` + migrate the seams

```ts
// src/types/env.d.ts — autocomplete + type-safety on import.meta.env itself
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_ANALYTICS_DOMAIN?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Point the seams at `env` instead of raw `import.meta.env`:
```ts
// src/libs/fetcher.ts
import { env } from '@/libs/env';
const BASE_URL = env.VITE_API_URL; // was: import.meta.env.VITE_API_URL ?? ''
```
Do the same in `sentry.ts` (`VITE_SENTRY_DSN`) and `analytics.ts` (`VITE_ANALYTICS_DOMAIN`). Now env vars are type-checked end-to-end and validated at one chokepoint.

## 7. Verify
```bash
pnpm tsc --noEmit          # ImportMetaEnv types resolve
pnpm dev                   # boots with valid env
# temporarily blank VITE_API_URL → dev should throw at startup with the field error
```

## References
- ./env-patterns.md — fail-fast rationale, one-typed-object, VITE_-prefix client exposure, validate-don't-just-read, secrets stay build-only.
- ../set-up-state-management/SKILL.md — the `fetcher` seam that should import `env`.
- ../_shared/conventions.md — `libs/` seam location.
