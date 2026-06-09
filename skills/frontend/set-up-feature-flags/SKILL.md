---
name: set-up-feature-flags
description: Use when adding feature flags to a frontend — wires the vendor-agnostic OpenFeature SDK (a useFlag hook in React, a composable in Vue) with safe defaults, an evaluation context for user targeting, a dev override, and a pattern for gating routes behind flags. Swap providers (PostHog/GrowthBook/LaunchDarkly/…) in one line.
---

# Set Up Feature Flags

## 1. Audit current state

```bash
grep -E '"(@openfeature/web-sdk|@openfeature/react-sdk)"' package.json 2>/dev/null
grep -rn "import.meta.env.VITE_FEATURE_\|featureFlag\|useFlag" src/ 2>/dev/null | head
```

Look for ad-hoc env-var flags (`VITE_FEATURE_X`) — those are build-time toggles, not runtime flags; this skill replaces them where you need runtime control. **Pairs with** `set-up-auth` (targeting context = the logged-in user) and `set-up-routing` (flag-gated routes).

## 2. Decide what to do
- No flags → full setup.
- Env-var toggles only → migrate the ones that need runtime/gradual rollout to OpenFeature; leave pure build-time switches as env.
- Vendor SDK used directly in components → put it behind the OpenFeature seam (step 5).

## 3. Detect framework
React → `@openfeature/react-sdk` (provider + `useFlag`). Vue → `@openfeature/web-sdk` + a small composable.

## 4. Install
```bash
pnpm add @openfeature/web-sdk @openfeature/react-sdk   # Vue: just @openfeature/web-sdk
```

## 5. Set the provider (vendor-agnostic seam)

```ts
// src/libs/featureFlags.ts
import { OpenFeature, InMemoryProvider } from '@openfeature/web-sdk';

// Dev/test: in-memory flags. Prod: your vendor's OpenFeature provider
// (PostHog / GrowthBook / LaunchDarkly / ConfigCat / Flagsmith) — a one-line swap.
const provider = new InMemoryProvider({
  'new-dashboard': { variants: { on: true, off: false }, defaultVariant: 'off', disabled: false },
});

export function initFeatureFlags() {
  void OpenFeature.setProviderAndWait(provider);
}
```

## 6. React — `OpenFeatureProvider` + `useFlag`

```tsx
// main.tsx
import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { initFeatureFlags } from '@/libs/featureFlags';

initFeatureFlags();

<OpenFeatureProvider>
  <App />
</OpenFeatureProvider>
```
```tsx
// usage — query-style hook with a mandatory safe default
import { useFlag } from '@openfeature/react-sdk';

function Dashboard() {
  const { value: showNew } = useFlag('new-dashboard', false); // default = control
  return showNew ? <NewDashboard /> : <ClassicDashboard />;
}
```
The React SDK re-renders on flag/context change and supports Suspense while the provider initializes.

## 7. Vue — a composable

```ts
// src/composables/useFlag.ts
import { OpenFeature } from '@openfeature/web-sdk';
import { ref, onUnmounted } from 'vue';

export function useFlag(key: string, defaultValue: boolean) {
  const client = OpenFeature.getClient();
  const value = ref(client.getBooleanValue(key, defaultValue));
  const handler = () => { value.value = client.getBooleanValue(key, defaultValue); };
  client.addHandler('PROVIDER_CONFIGURATION_CHANGED', handler);
  onUnmounted(() => client.removeHandler('PROVIDER_CONFIGURATION_CHANGED', handler));
  return value;
}
```

## 8. Targeting context (who gets the flag)

Set the evaluation context from the current user — the provider targets on it (plan, % rollout, allow-list). Update it on login (`set-up-auth`):
```ts
import { OpenFeature } from '@openfeature/web-sdk';
await OpenFeature.setContext({ targetingKey: user.id, plan: user.plan, country: user.country });
```
Never hand-code `if (user.id === 'me')` — that's what targeting is for.

## 9. Gate a route behind a flag

```tsx
// React (TanStack Router): src/routes/new-dashboard.tsx
import { OpenFeature } from '@openfeature/web-sdk';

export const Route = createFileRoute('/new-dashboard')({
  beforeLoad: () => {
    if (!OpenFeature.getClient().getBooleanValue('new-dashboard', false)) throw notFound();
  },
});
```

**Dev override:** seed the `InMemoryProvider` from a local panel / `localStorage` so you can flip flags without the backend; OpenFeature also supports a multi-provider for layering overrides on top of the real provider.

## 10. Verify
```bash
pnpm tsc --noEmit
pnpm dev
```
Flip `defaultVariant` (or the dev override) → the gated UI/route appears; the safe default (control) renders when the provider is unreachable.

## References
- ./feature-flags-patterns.md — vendor-agnostic seam, fail-closed defaults, targeting-not-hardcoding, flags-are-debt cleanup, build-time-env vs runtime-flag.
- ../set-up-auth/SKILL.md — the user that feeds the targeting context.
- ../set-up-routing/SKILL.md — the route guard hook.
