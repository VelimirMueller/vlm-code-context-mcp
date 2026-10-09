---
name: set-up-feature-flags
description: Use when adding feature flags to a frontend — vendor-agnostic OpenFeature SDK (useFlag hook/composable) with fail-closed defaults, user-targeting context, a dev override, and flag-gated routes. Provider swap (PostHog, GrowthBook, LaunchDarkly) is one line.
---

# Set Up Feature Flags

## 1. Audit current state

```bash
cat .claude/stack-profile.md 2>/dev/null || cat ~/.claude/stack-profile.md 2>/dev/null   # frontend.framework, package_manager
grep -E '"(@openfeature/web-sdk|@openfeature/react-sdk)"' package.json 2>/dev/null
grep -rn "import.meta.env.VITE_FEATURE_\|featureFlag\|useFlag" src/ 2>/dev/null | head
```

Look for ad-hoc env-var flags (`VITE_FEATURE_X`) — those are build-time toggles, not runtime flags; this skill replaces them where you need runtime control. **Pairs with** `set-up-auth` (targeting context = the logged-in user) and `set-up-routing` (flag-gated routes).

## 2. Decide what to do
- No flags → full setup.
- Env-var toggles only → migrate the ones that need runtime/gradual rollout to OpenFeature; leave pure build-time switches as env.
- Vendor SDK used directly in components → put it behind the OpenFeature seam (step 5).

## 3. Detect framework
Read `frontend.framework` from the profile (commands use pnpm; translate for `package_manager`).
React → `@openfeature/react-sdk` (provider + `useFlag`). Vue → `@openfeature/web-sdk` + a small composable.

## 4. Install
```bash
pnpm add @openfeature/web-sdk @openfeature/core @openfeature/react-sdk   # Vue: drop react-sdk
```
`@openfeature/core` is a peer of the web SDK; list it explicitly so the version is yours, not whatever the resolver picks. Why OpenFeature at all: `feature-flags-patterns.md`.

## 5. Set the provider (vendor-agnostic seam)

```ts
// src/libs/featureFlags.ts
import { OpenFeature, InMemoryProvider } from '@openfeature/web-sdk';

// Dev/test: in-memory flags. Prod: your vendor's OpenFeature provider
// (PostHog / GrowthBook / LaunchDarkly / ConfigCat / Flagsmith) — a one-line swap.
const provider = new InMemoryProvider({
  'new-dashboard': { variants: { on: true, off: false }, defaultVariant: 'off', disabled: false },
});

export async function initFeatureFlags(): Promise<void> {
  try {
    await OpenFeature.setProviderAndWait(provider);
  } catch {
    // Provider failed to start: every read now returns its safe default (fail closed).
  }
}
```
Await it **before the first render** (below). A flag read before the provider is ready returns the default, so a route guard on a cold deep link would 404 a user who has the flag.

## 6. React — `OpenFeatureProvider` + `useFlag`

```tsx
// main.tsx
import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { initFeatureFlags } from '@/libs/featureFlags';

await initFeatureFlags(); // top-level await: Vite builds ES modules; keep it before createRoot

createRoot(document.getElementById('root')!).render(
  <OpenFeatureProvider>
    <App />
  </OpenFeatureProvider>,
);
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
import { OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
import { onScopeDispose, ref } from 'vue';

export function useFlag(key: string, defaultValue: boolean) {
  const client = OpenFeature.getClient();
  const value = ref(client.getBooleanValue(key, defaultValue));
  const refresh = () => {
    value.value = client.getBooleanValue(key, defaultValue);
  };
  // Re-read when the provider becomes ready, its rules change, or the context changes.
  client.addHandler(ProviderEvents.Ready, refresh);
  client.addHandler(ProviderEvents.ConfigurationChanged, refresh);
  client.addHandler(ProviderEvents.ContextChanged, refresh);
  onScopeDispose(() => {
    client.removeHandler(ProviderEvents.Ready, refresh);
    client.removeHandler(ProviderEvents.ConfigurationChanged, refresh);
    client.removeHandler(ProviderEvents.ContextChanged, refresh);
  });
  return value;
}
```
Handler event names are the `ProviderEvents` enum: the string literal `'PROVIDER_CONFIGURATION_CHANGED'` does not type-check. Call `await initFeatureFlags()` before `app.mount()` in `main.ts`.

## 8. Targeting context (who gets the flag)

Set the evaluation context from the current user — the provider targets on it (plan, % rollout, allow-list). Update it on login (`set-up-auth`):
```ts
import { OpenFeature } from '@openfeature/web-sdk';
await OpenFeature.setContext({ targetingKey: user.id, plan: user.plan, country: user.country });
await OpenFeature.setContext({}); // on logout: drop the previous user's targeting
```
Never hand-code `if (user.id === 'me')` — that's what targeting is for. The context is sent to the flag vendor: use a pseudonymous id as `targetingKey`, never an email or name (GDPR: the vendor becomes a processor of whatever you put here).

## 9. Gate a route behind a flag

```tsx
// React (TanStack Router): src/routes/new-dashboard.tsx
import { createFileRoute, notFound } from '@tanstack/react-router';
import { OpenFeature } from '@openfeature/web-sdk';

export const Route = createFileRoute('/new-dashboard')({
  beforeLoad: () => {
    if (!OpenFeature.getClient().getBooleanValue('new-dashboard', false)) throw notFound();
  },
});
```

**Dev override:** seed the `InMemoryProvider` from a local panel / `localStorage` so you can flip flags without the backend; To layer overrides over the real provider, OpenFeature's web multi-provider (`@openfeature/multi-provider-web`, pre-1.0 at 0.0.x) is an option; a plain wrapper provider is the safer choice until it stabilizes.

## 10. Verify
```bash
pnpm typecheck
pnpm dev
```
Flip `defaultVariant` (or the dev override) → the gated UI/route appears; the safe default (control) renders when the provider is unreachable. Open the gated route as a cold deep link: it must load, not 404. A flag hides UI only — the API must enforce who may use the feature.

## References
- ./feature-flags-patterns.md — vendor-agnostic seam, fail-closed defaults, targeting-not-hardcoding, flags-are-debt cleanup, build-time-env vs runtime-flag.
- ../set-up-auth/SKILL.md — the user that feeds the targeting context.
- ../set-up-routing/SKILL.md — the route guard hook.
