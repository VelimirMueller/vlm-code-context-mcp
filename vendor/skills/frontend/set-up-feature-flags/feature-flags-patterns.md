# Feature Flag Patterns

Reference for `set-up-feature-flags`. How serious teams ship behind flags without making a mess.

## Rule: vendor-agnostic via OpenFeature
**Why:** Calling a vendor SDK (`posthog.isFeatureEnabled`, `ldClient.variation`) throughout the app welds you to that vendor and makes flags unmockable in tests. OpenFeature is a standard API with a provider per vendor — the same seam pattern as `captureError`/analytics.
**How to apply:** Components call `useFlag` / `getBooleanValue`; only `featureFlags.ts` knows the provider. Switching PostHog → GrowthBook → LaunchDarkly is one `setProvider` line. Use `InMemoryProvider` in dev/test.

## Rule: every flag read has a safe default — fail closed
**Why:** When the flag service is slow, down, or the flag was deleted, the read returns the default. If the default turns a risky feature *on*, an outage ships it to everyone.
**How to apply:** The default is always the **control / safe** value (usually `false`). `useFlag('new-checkout', false)` — never default a half-built feature to `true`.

**Anti-example:**
```ts
// bad: defaults the new path on; a flag-service hiccup ships unfinished code
const useNew = client.getBooleanValue('new-checkout', true);
```

## Rule: target via evaluation context, don't hardcode
**Why:** `if (user.email.endsWith('@acme.com'))` scattered in components is unauditable and can't do percentage rollouts. The flag provider does targeting — given the user as context.
**How to apply:** `OpenFeature.setContext({ targetingKey: user.id, plan, country })` on login; configure rules (10% rollout, plan=pro, allow-list) in the provider dashboard. Components just read the resolved value.

## Rule: flags are debt — remove them after rollout
**Why:** A flag is a branch in your code and your build. Left after a feature is 100% rolled out, it rots into dead conditionals and confusion ("is this still gated?").
**How to apply:** Tag each flag with an owner + removal date. When a release flag hits 100% and sticks, delete the flag *and the losing branch*. Keep only genuinely long-lived flags (kill switches, plan gates).

## Rule: gate at the boundary for routes/features
**Why:** A flag check deep in a component still loads the route and its data before hiding it. Gating in the route guard avoids the work and the flash.
**How to apply:** Read the flag in `beforeLoad`/`beforeEach` and `notFound()`/redirect when off. In components, branch high in the tree, not per-leaf.

## When to deviate
- **Build-time toggle vs runtime flag:** if a switch never changes at runtime (e.g. enabling a dev-only panel), a `VITE_*` env var via `validate-env` is simpler — don't pay for a flag service. Use flags when you need to flip *without a deploy*, do gradual rollout, or target users.
- **Kill switches:** for an emergency "turn this off in prod now," a flag is the right tool — but make sure the default-when-unreachable is the *safe* state.
