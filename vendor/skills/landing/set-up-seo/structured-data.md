# Structured Data

Reference for `set-up-seo`. JSON-LD: which types, where, and the one hard rule.

## Rule: JSON-LD, one script per entity (or one @graph)
**Why:** JSON-LD is the format Google recommends and the only one that keeps markup
separable from the DOM — no microdata attributes threaded through templates.
**How to apply:** `<script type="application/ld+json">` in the page. Site-wide entities
(`Organization`, `WebSite`) once per page via the shared layout; page entities per page.
Several scripts are fine; an `@graph` array in one script is equally valid — pick one
convention per site.

## Rule: schema mirrors visible content — never invents it
**Why:** Markup describing content that isn't on the page is the textbook structured-data
spam pattern and risks a manual action; it also breaks the answer-engine use (the quoted
"answer" wouldn't exist on the page).
**How to apply:** every value in the JSON-LD (headline, dates, prices, questions) must be
findable as visible text on the page. Write the page first, mirror it second.

## Type selection

| Page | Type(s) |
|---|---|
| home page (via layout) | `Organization` (name, logo, `sameAs`) + `WebSite` — entity disambiguation, no rich result guaranteed |
| product / offer landing | `Product` with nested `Offer` (real price, currency, availability) |
| guide / article / ratgeber | `Article` (headline, author as `Person`, `datePublished`, `dateModified`) |
| page with a real FAQ section | `FAQPage` (see the caveat below) |
| pages ≥2 levels deep | `BreadcrumbList` |
| physical / local business | `LocalBusiness` (address, hours) |

## The FAQ caveat (as of 2026-10-09)
Google restricted FAQ *rich results* to authoritative government and health sites in
2023, then **stopped showing them for all sites on 2026-05-07**. Google's structured-data
gallery (last updated 2026-06-15) no longer lists FAQ or HowTo; reports of the Rich
Results Test and Search Console dropping FAQ come from secondary sources.
Google says it still uses FAQ markup to understand pages and that existing markup need
not be removed. `FAQPage` remains valid schema.org, and other engines may read it. So: mark up
real, visible FAQs for machine readability; never add FAQ schema chasing a rich result
that no longer exists. (`HowTo` rich results were deprecated back in 2023 — don't ship
`HowTo` markup either.)

## Validation
- `https://validator.schema.org` — syntax + vocabulary.
- Google Rich Results Test — eligibility for the types in Google's gallery that still
  have rich results (`Product`, `Article`, `BreadcrumbList`, `LocalBusiness`, …). Check
  the gallery (developers.google.com/search/docs/appearance/structured-data/search-gallery)
  before promising a client a rich result: the list shrinks.

## When to deviate
- A page with nothing to mark up takes no page-level schema (the home page still carries
  `Organization`/`WebSite`).
- Don't force `Product` onto a lead-gen page with no purchasable offer: markup that
  misdescribes the page is worse than none, and can trigger a manual action.
- Self-written review/rating markup on your own business (`AggregateRating` on
  `Organization`/`LocalBusiness` you operate) does not earn stars; skip it unless the
  reviews are visible, genuine, and about a `Product`.
