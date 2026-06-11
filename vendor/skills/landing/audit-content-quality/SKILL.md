---
name: audit-content-quality
description: Use when reviewing a content page, article, guide, or landing page for quality before publishing or republishing — scores the page against a rubric (the project's .claude/rubrics/content-quality.md if present, else the bundled default covering intent match, direct answers, E-E-A-T trust signals, schema, internal linking, freshness) and fixes only the failed criteria. Audit-first and idempotent; supports knockout criteria.
---

# Audit Content Quality

Score first, then fix *only the gaps* — never rewrite what already passes. The procedure
is generic; the law comes from a rubric file, so a team's own scorecard (points,
knockouts, house rules) plugs in without changing the skill.

## 1. Gate — is this a public page?

Run the gate from `../_shared/page-types.md`. Content quality scoring is for pages meant
to be found and read; app surfaces are out of scope.

## 2. Load the rubric

Per `../_shared/rubric-convention.md`:

```bash
cat .claude/rubrics/content-quality.md 2>/dev/null   # project law, if present
```

Present → it is the entire rubric (criteria, knockouts, any points/weights it defines).
Present but empty — or with no `##` criterion headings — → malformed: report it and
stop; do not fall through to the default (`../_shared/rubric-convention.md`).
Absent → use `./default-rubric.md`, and offer the install at the end of the report.

## 3. Gather the page

```bash
curl -s "$URL" -o /tmp/page.html    # or the built file
```

Read the rendered text top to bottom — the audit quotes evidence, so skimming isn't
enough. Identify the page's target question/intent first (from title + h1); several
criteria score against it.

## 4. Score

Walk the rubric criterion by criterion:

- **Knockouts (`[K.O.]`) first.** Any knockout failure fails the page outright — report
  it, fix it, re-run before scoring the rest in detail.
- Each criterion gets a verdict (pass/fail, or the rubric's own scale) **and quoted
  evidence** from the page. No verdict without a quote — evidence is what makes the
  audit repeatable.

## 5. Report

```markdown
| Criterion | Verdict | Evidence |
|---|---|---|
| [K.O.] Content in served HTML | PASS | view-source: h1 + body text present |
| Direct answer up front | FAIL | opening paragraph is a 140-word anecdote; answer arrives in §3 |
| ... | ... | ... |
```

Close with: the failures in fix order (knockouts → cheapest wins → rest), and — if the
bundled default was used — the offer to install it to `.claude/rubrics/content-quality.md`.

## 6. Fix only the failures

Apply the smallest edit that turns each failed criterion green: move the answer
paragraph up, add the byline/date block, add the two internal links. Touch nothing that
passed. Re-run the audit; the page now passes, and a second run changes nothing —
idempotence is the proof the audit is honest.

## References
- ./default-rubric.md — the bundled scorecard (installable as the project's starting point).
- ../_shared/rubric-convention.md — lookup order, the `[K.O.]` format, the install offer.
- ../set-up-seo/SKILL.md — the technical baseline (crawlability, metadata, schema) this audit assumes.
