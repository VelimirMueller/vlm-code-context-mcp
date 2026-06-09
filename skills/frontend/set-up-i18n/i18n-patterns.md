# i18n Patterns

Reference for `set-up-i18n`. The senior choices for a maintainable, fast i18n layer.

## Rule: type the message keys
**Why:** Stringly-typed `t('some.key')` silently returns the key (or empty) when it's misspelled or removed — a bug that ships. Typed resources make a wrong key a compile error and give autocomplete.
**How to apply:** i18next `CustomTypeOptions` (declare module) typed from the catalog; vue-i18n message schema type param. The default locale's catalog is the source of truth for the key shape.

## Rule: lazy-load locales
**Why:** Bundling every language ships dead weight to every user — most see one locale. Catalogs are perfect dynamic-import boundaries.
**How to apply:** Ship only the default locale in the entry bundle; `import('@/locales/${lng}/...')` on switch and register it (`addResourceBundle` / `setLocaleMessage`). Split by namespace too if catalogs get large (load `common` eagerly, `settings` on the settings route).

## Rule: format with `Intl`, never hand-rolled
**Why:** Dates, numbers, currencies, plurals, and relative times are locale-specific and full of edge cases the platform already solved. Hand-rolled formatting is wrong in some locale you didn't test.
**How to apply:** `Intl.NumberFormat` / `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` / `Intl.PluralRules` — directly, or via the i18n lib's `Intl`-backed formatters. Pass the active locale.

```ts
// cookbook — always pass the active locale
new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(1234.5); // €1,234.50
new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day');           // "yesterday"
new Intl.ListFormat(locale, { type: 'conjunction' }).format(['a', 'b', 'c']);         // a, b, and c
```

**Anti-example:**
```ts
// bad: hand-rolled, breaks in most locales
const price = '$' + amount.toFixed(2);
const date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
```

## Rule: interpolate and pluralize — never concatenate sentences
**Why:** Word order and plural rules differ per language; `count + ' ' + t('items')` is untranslatable (Slavic languages have 3–4 plural forms; some languages put the number after the noun).
**How to apply:** Interpolation (`"Hello, {{name}}"`) and the library's plural keys (`count_one`/`count_other`, backed by `Intl.PluralRules`). One message per sentence.

## Rule: locale choice is UI state, detected then persisted
**Why:** It exists because of what the user picked in the browser — UI state. First visit should respect the browser/OS locale; the explicit choice then persists.
**How to apply:** Default from `navigator.language`; store the explicit choice (persisted store, like the theme). If the user has an account, sync via a mutation — the live switch stays client-side.

## Rule: no hardcoded UI strings
**Why:** A single hardcoded label means that screen can never be fully translated, and it's invisible until a translator notices.
**How to apply:** All user-facing text goes through `t()` / `$t`. A lint rule or an extraction tool (i18next-parser) catches stragglers and keeps catalogs in sync.

## When to deviate
- **Single-locale product with no plans to translate:** skip i18n; don't pay the indirection. Add it when a second locale becomes real, not "just in case."
- **Server-driven content:** translate CMS/content on the server and deliver per-locale; i18n here covers only the app's own UI chrome.
