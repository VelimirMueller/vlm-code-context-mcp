# Default Content-Quality Rubric

The bundled rubric for `audit-content-quality` — used when the project has no
`.claude/rubrics/content-quality.md`. Offer to install a copy there for the project to
adapt (own criteria, points, knockouts). Format rules: `../_shared/rubric-convention.md`.

## [K.O.] Content is in the served HTML
Passes when the main content survives the view-source test (`../_shared/page-types.md`).
Evidence: the curl/grep result. Fails → the page fails; fix via `../set-up-seo/SKILL.md`
before scoring anything else.

## [K.O.] One h1 that matches the page's intent
Passes when exactly one `<h1>` exists and states the question/outcome the page serves.
Evidence: quote the h1.

## [K.O.] The page keeps its promise
Passes when the `<title>`'s promise is actually answered/delivered on the page — no
bait-and-switch. Evidence: quote title + the passage delivering it.

## Direct answer up front
Passes when the core question is answered in the first paragraph after the h1 (≤ ~80
words), elaboration after. Evidence: quote the opening paragraph.

## Heading hierarchy carries the argument
Passes when h2/h3 are logical (no skipped levels) and subtopics are phrased as the
questions users ask. Evidence: the heading outline.

## Visible trust signals (E-E-A-T)
Passes when author is named and published/updated dates are visible; health, finance, and
legal topics also name a qualified reviewer. Evidence: quote byline/dates.

## Schema mirrors the page
Passes when JSON-LD exists and every value is findable as visible text
(`../set-up-seo/structured-data.md`); run `validator.schema.org` where available — a
validation failure is a finding, not a silent pass. Evidence: the types present + one
mirrored value.

## Internal links in context
Passes when ≥2 contextual links connect the page to related pages on the site (hub ↔
spoke), with descriptive anchor text. Evidence: quote the anchors.

## Media earns its place
Passes when meaningful images have descriptive `alt`, decorative ones `alt=""`, and
every image has dimensions (CLS). Evidence: the offending/conforming `<img>` tags.

## Scannability
Passes when paragraphs stay ≤ ~4 sentences and enumerable facts are lists or tables.
Evidence: the worst block, quoted.

## Freshness where it matters
Passes when time-sensitive topics show an update within ~12 months (and `dateModified`
mirrors it). Evergreen content passes by default. Evidence: the visible date.

## One next step
Passes when the page ends with a clear related action — the next article, the signup,
the contact — not a dead stop. Evidence: quote the closing CTA/link.
