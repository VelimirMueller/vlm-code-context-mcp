# Env Patterns

Reference for `validate-env`. Why a 40-line file removes a class of production incidents.

## Rule: validate at startup, fail fast
**Why:** Env misconfiguration is the classic "works locally, breaks in prod" bug — a missing `VITE_API_URL` silently becomes `''`, every request hits the wrong origin, and you debug it from a user report instead of a build log. Parsing at startup turns a silent runtime failure into a loud boot-time error with the exact field that's wrong.
**How to apply:** `schema.safeParse(import.meta.env)` at module top-level in `src/libs/env.ts`; throw on failure with `error.flatten().fieldErrors`. Importing the module anywhere runs the check before render.

## Rule: one typed env object — import it, never read `import.meta.env` raw
**Why:** Scattered `import.meta.env.VITE_FOO` reads are unvalidated, untyped (everything is `string | undefined`), and impossible to audit. A single exported `env` is validated once and correctly typed (URLs are strings, optionals are optional).
**How to apply:** Every consumer imports `{ env }` from `@/libs/env`. Grep for `import.meta.env.VITE_` after migrating — the only remaining hit should be inside `env.ts`.

## Rule: only `VITE_`-prefixed vars reach the client
**Why:** Vite exposes **only** `VITE_`-prefixed vars to client code — by design, so server secrets don't leak into the bundle. A secret without the prefix is invisible to the app (correct); a secret *with* the prefix ships to every browser (a leak).
**How to apply:** Client config → `VITE_*` and in the schema. Build/CI secrets (e.g. `SENTRY_AUTH_TOKEN`) → no `VITE_` prefix, never in this schema, only in CI env.

## Rule: validate shape, not just presence
**Why:** "It exists" isn't "it's valid." A malformed URL or a typo'd enum passes a presence check and fails at use.
**How to apply:** `z.string().url()` for endpoints, `z.enum([...])` for modes/flags, `z.coerce.number()` for numeric vars (env values are always strings). Mark genuinely-optional vars `.optional()` so the schema documents what's required.

## When to deviate
- **No runtime env** (a fully static site with no API): the schema may be empty or unnecessary — skip the skill until the app reads its first `VITE_` var.
- **Server/SSR env:** server-side secrets are validated in the server's own entry, not here; this skill covers the *client* bundle's `import.meta.env`.
