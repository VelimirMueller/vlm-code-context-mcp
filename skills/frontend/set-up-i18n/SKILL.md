---
name: set-up-i18n
description: Use when internationalizing a frontend project — sets up i18next + react-i18next (React) or vue-i18n (Vue) with typed message keys, lazy-loaded per-locale catalogs, Intl-based number/date/relative formatting, and a persisted locale choice detected from the browser.
---

# Set Up i18n

## 1. Audit current state

```bash
grep -E '"(i18next|react-i18next|vue-i18n)"' package.json 2>/dev/null
ls src/locales 2>/dev/null
grep -rn ">[A-Z][a-z]\+ [a-z]" src/components 2>/dev/null | head   # hardcoded UI strings (rough)
```

**Prerequisite:** `@/` alias. The locale switcher is UI state (per `set-up-state-management`).

## 2. Decide what to do
- No i18n → full setup.
- Library present, strings still hardcoded → extract to catalogs (step 5) + type the keys (step 7).
- Set up, no lazy loading → split catalogs per locale (step 6).

## 3. Detect framework
React → **i18next** + **react-i18next**. Vue → **vue-i18n** (Composition API). Both format with the **`Intl`** APIs.

## 4. Install

### React
```bash
pnpm add i18next react-i18next
```
### Vue
```bash
pnpm add vue-i18n
```

## 5. Message catalogs

```
src/locales/
├── en/common.json
└── de/common.json
```
```json
// src/locales/en/common.json
{
  "greeting": "Hello, {{name}}",
  "todos": { "count_one": "{{count}} todo", "count_other": "{{count}} todos" }
}
```
Keys are namespaced and use interpolation + plurals — never concatenate sentence fragments.

## 6. Initialize (with the default locale only; lazy-load the rest)

```ts
// src/libs/i18n.ts (React)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en/common.json';

i18n.use(initReactI18next).init({
  resources: { en: { common: en } },
  lng: navigator.language.split('-')[0] || 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
});

export async function loadLocale(lng: string) {
  if (i18n.hasResourceBundle(lng, 'common')) return;
  const messages = await import(`@/locales/${lng}/common.json`);
  i18n.addResourceBundle(lng, 'common', messages.default);
}

export default i18n;
```
Only the default locale ships in the bundle; `loadLocale('de')` dynamic-imports `de` on demand. Vue: `createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { en } })` + dynamic `import()` + `i18n.global.setLocaleMessage` to lazy-add.

## 7. Type the keys (autocomplete + no missing-key bugs)

```ts
// src/types/i18next.d.ts (React)
import 'i18next';
import type common from '@/locales/en/common.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common };
  }
}
```
Now `t('greeting')` autocompletes and `t('typo')` is a type error. Vue: pass a message schema type param to `createI18n` / `useI18n<{ message: typeof en }>()`.

## 8. Format with `Intl`, not by hand

```ts
new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day'); // "yesterday"
```
i18next (`t('k', { val, formatParams })`) and vue-i18n (`$n`/`$d`) wrap `Intl` — use those or `Intl` directly. Never hand-roll date/number/plural logic.

## 9. Locale switch = persisted UI state

A small store holds the chosen locale; switching lazy-loads then sets it:
```ts
// on switch: await loadLocale(next); i18n.changeLanguage(next); store.setLocale(next);
```
Persist the choice (like the theme store) and default to the browser locale on first visit.

## 10. Verify
```bash
pnpm tsc --noEmit   # typed keys compile; a wrong key fails
pnpm dev            # switch locale → catalog lazy-loads, strings + formats update
```

## References
- ./i18n-patterns.md — typed keys, lazy loading, Intl formatting, locale-is-UI-state, plurals/interpolation, extraction, when to skip.
- ../_shared/glossary.md — locale choice as UI state.
- ../_shared/conventions.md — `@/` alias, `libs/` seam.
