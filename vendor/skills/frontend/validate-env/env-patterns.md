# Env Patterns

Reference for `validate-env`. Why a 20-line file removes a class of production incidents. Verified against Zod 4.6 and Vite 8.3 on 2026-10-09.

## Rule: validate at startup, fail fast
**Why:** A missing `VITE_API_URL` otherwise becomes `''` and every request goes to the page origin; you find out from a user report. Parsing at module load turns that into an error at boot that names the field.
**How to apply:** `schema.safeParse(import.meta.env)` at the top level of `src/libs/env.ts`; throw with `z.prettifyError(error)` (Zod 4's readable form: one `✖ message → at FIELD` block per issue). Importing the module anywhere runs the check before render.

## Rule: one typed env object; import it, never read `import.meta.env` raw
**Why:** Raw reads are unvalidated and typed `any`-ish (`string | undefined`, or `any` without `vite/client`), and cannot be audited. One exported `env` is validated once, and its type is inferred from the schema, so the type and the check cannot drift.
**How to apply:** Every consumer imports `{ env }` from `@/libs/env`. After migrating, `grep -rn "import.meta.env.VITE_" src/` matches only inside `env.ts`. Do not also declare `ImportMetaEnv`: that is a second copy of the schema.

**Anti-example:**
```ts
// bad: a hand-written ImportMetaEnv that must be kept in step with the schema
interface ImportMetaEnv { readonly VITE_API_URL: string }
```

## Rule: only `VITE_`-prefixed variables reach the client
**Why:** Vite inlines only `VITE_*` into the bundle (`envPrefix`), so server secrets stay out by default. A secret *with* the prefix ships to every browser.
**How to apply:** Client config → `VITE_*` and in the schema. Build and CI secrets (`SENTRY_AUTH_TOKEN`) → no prefix, never in this schema, only in the CI environment. Never widen `envPrefix` to `''`.

## Rule: validate shape, not just presence
**Why:** A malformed URL or a typo passes a presence check and fails at use. A `javascript:` URL passes `z.string().url()`, and in Zod 4 `z.string().url()` is deprecated in favour of `z.url()` (checked in the package types).
**How to apply:** `z.url({ protocol: /^https?$/ })` for endpoints (rejects `javascript:` and `data:`), `z.enum([...])` for modes, `z.coerce.number()` for numbers (env values are always strings). Mark genuinely optional variables `.optional()` so the schema documents what is required.

## Rule: treat a blank value as unset
**Why:** `VITE_SENTRY_DSN=` in a `.env` or an empty CI variable arrives as `''`. `z.url().optional()` rejects `''`, so a harmless blank would break the boot. The failure is common and confusing.
**How to apply:** `z.preprocess(blankToUndefined, schema.optional())` on optional variables, as in the skill. Required variables stay strict: a blank `VITE_API_URL` is an error.

## Rule: tests get their own env file
**Why:** Vitest imports the seams, and `env.ts` throws when `VITE_API_URL` is unset. A committed `.env.test` gives every developer and CI the same values without a setup step.
**How to apply:** `.env.test` with `VITE_API_URL=http://api.test`. MSW handlers match any base with `*/todos` (`configure-test-stack`).

## When to deviate
- **No runtime env** (a static site with no API): skip the skill until the app reads its first `VITE_` variable.
- **Server/SSR env:** server-side secrets are validated in the server's own entry; this skill covers the client bundle's `import.meta.env`. Nuxt (`runtimeConfig`) and Next (`NEXT_PUBLIC_*`) have their own mechanisms; use them.
- **One or two variables:** a five-line `if (!import.meta.env.VITE_API_URL) throw …` is enough; Zod pays once there are a few variables with shapes.
- **Zod already pinned at v3:** use `z.string().url()` and `error.flatten()` there; upgrade Zod in its own PR.
