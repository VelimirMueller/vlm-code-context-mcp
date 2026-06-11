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
| every public page (via layout) | `Organization` + `WebSite` |
| product / offer landing | `Product` with nested `Offer` (real price, currency, availability) |
| guide / article / ratgeber | `Article` (headline, author as `Person`, `datePublished`, `dateModified`) |
| page with a real FAQ section | `FAQPage` (see the caveat below) |
| pages ≥2 levels deep | `BreadcrumbList` |
| physical / local business | `LocalBusiness` (address, hours) |

## The FAQ caveat (as of mid-2026)
Google restricted FAQ *rich results* to authoritative government and health sites in
2023, then **dropped them entirely in May 2026** — no site earns the expanded FAQ SERP
listing anymore, and the FAQ check was removed from the Rich Results Test (June 2026).
`FAQPage` remains valid schema.org, and answer engines still read clean Q&A. So: mark up
real, visible FAQs for machine readability; never add FAQ schema chasing a rich result
that no longer exists. (`HowTo` rich results were deprecated back in 2023 — don't ship
`HowTo` markup either.)

## Validation
- `https://validator.schema.org` — syntax + vocabulary.
- Google Rich Results Test — eligibility for the types that still have rich results
  (`Product`, `Article`, `BreadcrumbList`, …); FAQ and HowTo are no longer reported there.

## When to deviate
A page with nothing to mark up takes `Organization`/`WebSite` only. Don't force `Product`
onto a lead-gen page with no purchasable offer — wrong type beats no type for spam
signals, in the bad direction.
