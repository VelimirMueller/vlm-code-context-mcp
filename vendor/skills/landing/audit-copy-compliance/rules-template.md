# Copy-Compliance Rules Template

The bundled template for `audit-copy-compliance` — used when the project has no
`.claude/rubrics/copy-compliance.md`, and the starting point to install there. The
categories are generic; the *rules inside them* are placeholders a project replaces with
its own law (brand voice, legal counsel's requirements, regulator's rules). Format:
`../_shared/rubric-convention.md`.

Which categories are knockouts is a project decision — in many jurisdictions required
legal links (imprint, privacy) are hard blocks too; mark them `[K.O.]` accordingly.
Imagery compliance is out of scope: this gate reads text.

## Starting points for German-market copy (not legal advice)

The placeholder rules below are generic. For a German-law site, the usual statutory
sources behind them, so a project can write real rules with counsel:

| Topic | Source | What it means for copy |
|---|---|---|
| Misleading claims, unsubstantiated superlatives | UWG §5 | "Nr. 1", "bester" need a true, clear, lasting lead over comparable competitors; the advertiser should hold the proof (BGH I ZR 202/10) |
| Health outcome promises | HWG §3 | no certainty of cure or success, no efficacy claims beyond sound science — applies to medical, dental, wellness copy |
| Marketing email / phone | UWG §7 | prior express consent (see `../set-up-lead-capture/SKILL.md`) |
| Imprint | DDG §5 (replaced TMG §5 on 2024-05-14) | provider identity, address, contact reachable in two clicks |
| Prices to consumers | PAngV | price shown is the total including VAT; "ab" prices need the base case stated |
| Environmental claims ("klimaneutral") | Directive (EU) 2024/825 (applies from 2026-09-27; verify the German transposition in UWG) | generic green claims restricted; offset-based neutrality claims banned |

Statutes move; re-verify the section numbers before encoding them as `[K.O.]`. This table is illustrative only (last verified 2026-10-09) — a copied citation can be read as current law when it is not. Replace it with counsel-reviewed rules before any real use; never ship it as the project's compliance gate.

## [K.O.] Prohibited claims
**Rule (replace with yours):** no outcome guarantees — no "guaranteed", "risk-free",
"cures", "always works"; regulated industries (health, finance, legal) typically prohibit
promising results at all.
**Check:** scan copy for guarantee/cure/promise verbs and absolute outcome statements.
**Violation:** "Our method guarantees visible results in 14 days."
**Rewrite:** "Many clients report visible changes within weeks — results vary."

## Required elements
**Rule (replace with yours):** required disclaimers appear adjacent to the claims that
trigger them; imprint and privacy policy are linked from every page footer.
**Check:** for each claim category in this file, is its disclaimer within the same
section? Footer links present and resolving?
**Violation:** a results claim with the disclaimer only on a separate legal page.
**Rewrite:** add the one-line disclaimer directly under the claim.

## Address & tone
**Rule (replace with yours):** formal address (German: Sie, capitalized), consistently;
no mixing; reading level aimed at a general audience.
**Check:** scan for the informal form and for inconsistent switches.
**Violation:** "Buch dir jetzt deinen Termin" on a Sie-convention site.
**Rewrite:** "Buchen Sie jetzt Ihren Termin."

## Terminology
**Rule (replace with yours):** never-say list (competitor names, internal codenames,
deprecated product names); must-say list (full legal product name on first mention,
required credit lines such as a named medical reviewer).
**Check:** grep the copy for each never-term; verify each must-term appears where
required.
**Violation:** internal project codename visible in public copy.
**Rewrite:** the public product name.

## Locale formatting
**Rule (replace with yours):** German convention — non-breaking space between number and
unit/currency ("49 €", never "49€"), decimal comma, DD.MM.YYYY dates.
**Check:** regex for digit+currency without NBSP, wrong decimal separators, wrong date
order.
**Violation:** "ab 49€ monatlich"
**Rewrite:** "ab 49 € monatlich" — replace the plain space between number and € with a
non-breaking space (`&nbsp;` in HTML, U+00A0 in source); rendered, both look alike, so
check the source.

## Substantiation
**Rule (replace with yours):** numbers cite a source or a date; superlatives
("the best", "#1") are substantiated or removed. (Germany: UWG §5 — see the table above.)
**Check:** every statistic and superlative — where is its support, on-page or linked?
**Violation:** "The most effective treatment on the market."
**Rewrite:** "Rated 4.9/5 by 1,200 patients (2025 survey)." — or drop the superlative.

## When to deviate
- A non-regulated brand site can cut this to prohibited claims, substantiation, and
  terminology; formality rules are taste, not law.
- Where counsel supplies a rule set, it replaces this file entirely
  (`../_shared/rubric-convention.md`) — do not merge.
- Treat a PASS as "no violations of the rules in this file", never as legal clearance.
