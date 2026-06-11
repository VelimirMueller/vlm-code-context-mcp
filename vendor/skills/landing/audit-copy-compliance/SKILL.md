---
name: audit-copy-compliance
description: Use when page copy must pass brand, legal, or regulatory rules before going live — checks the visible copy of a public page against a rules file (the project's .claude/rubrics/copy-compliance.md if present, else the bundled template covering prohibited claims, required disclaimers, tone and address, terminology, locale formatting, substantiation) and reports every violation with the quoted text, the rule it breaks, and a compliant rewrite. A cheap pre-publish gate.
---

# Audit Copy Compliance

The pre-publish gate: cheap enough to run on every copy change, strict enough to catch
the violation before it goes live. The skill is jurisdiction- and brand-neutral — the law
lives in a rules file the project owns.

## 1. Gate — is this public copy?

Run the gate from `../_shared/page-types.md`. This skill audits copy that will be
published (a built page, a content file about to ship). Internal app strings are out of
scope.

## 2. Load the rules

Per `../_shared/rubric-convention.md`:

```bash
cat .claude/rubrics/copy-compliance.md 2>/dev/null
```

Present → it is the entire law: its categories, its rules, its knockouts.
Present but empty — or with no `##` criterion headings — → malformed: report it and
stop; do not fall through to the template (`../_shared/rubric-convention.md`).
Absent → use `./rules-template.md` **as a template**: its categories are real, its rules
are placeholders — flag clearly that generic defaults were applied and the project
should install and adapt its own (the install offer, end of report).

## 3. Extract the copy

```bash
curl -s "$URL" -o /tmp/page.html   # or the content/source file pre-publish
```

The audit covers all *visible* text — headings, body, buttons, captions, footer — plus
copy-bearing attributes (`alt`, `title`, meta description, OG text). Schema text counts
too: JSON-LD must not contain a claim the rules prohibit.

## 4. Check, category by category

For each category in the rules file, scan the full copy. A violation is recorded with
**all three**: the quoted offending text (exact, with enough context to find it), the
rule it breaks (named, from the file), and a suggested compliant rewrite that preserves
the marketing intent where possible. Knockout (`[K.O.]`) categories fail the page
outright.

## 5. Report

```markdown
| # | Quoted copy | Rule broken | Suggested rewrite |
|---|---|---|---|
| 1 | "garantiert schmerzfrei" | [K.O.] Prohibited claims — no outcome guarantees | "auf Wunsch mit lokaler Betäubung" |
| 2 | "ab 49€" | Locale formatting — NBSP before € | "ab 49 €" |
```

Verdict line: **BLOCK** (any K.O. or unresolved violation) or **PASS**. Non-K.O.
findings block until resolved; K.O. findings can't be waived at all. If the bundled
template was used, end with the install offer
(`.claude/rubrics/copy-compliance.md`).

## 6. Fix and re-run

Apply the rewrites (or the author's better ones), re-run the audit. PASS with zero
findings = the gate is green; a second run on clean copy reports nothing — idempotent by
construction.

## References
- ./rules-template.md — the bundled category template (installable, then make it yours).
- ../_shared/rubric-convention.md — lookup order, `[K.O.]`, the install offer.
- ../audit-content-quality/SKILL.md — quality scoring (is it *good*?) vs this gate (is it *allowed*?).
