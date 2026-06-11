# PR Patterns

Reference for `write-pull-requests`. Why the shapes are fixed, where the evidence lives,
and one filled example from this repo's own history.

## Rule: the section list is fixed — no inventions, no omissions
**Why:** A fixed shape is a contract with the reviewer: learn once where Root cause
lives, never hunt for it again. Invented headings feel helpful and cost exactly the
sections they displace — a description with a "How to review" heading but no
Verification tells the reviewer how to check work the author never showed they checked.
And omissions read as answers: a missing Tests section says "none".
**How to apply:** Bug fix: Problem, Root cause, Fix, Tests, Verification, Notes.
Feature: Summary, Problem, Solution, Implementation, Tests, Verification, Notes. Both
close with the Before-merge checklist — Manual review, Smoke tested, Pipeline green —
posted unticked. Review hints belong under Notes; content that fits no section goes
there too, or stays out.
When a section is genuinely empty, keep the heading and say why ("Tests: none added —
Markdown-only repo; the validator is the gate") rather than deleting it.
**Anti-example:** An unguided feature-PR draft for this repo's `0adc6b7` used Summary /
Files / How to review (the PR that really shipped it, #7, merged with an empty body —
the other failure mode). No Problem — the reader cannot tell what failure the skill
prevents. No Tests, no Verification — "fix-and-re-run is idempotent" and "cheap enough
to run on every copy change" stayed claims; nothing shows either was ever run. And "Files" duplicated
`git diff --stat`, which the reviewer's diff view already renders.

## Rule: Verification is evidence, not assertion
**Why:** The reviewer cannot re-run every branch, so Verification is where trust
transfers. An assertion ("tests pass", "verified locally") costs the author one sentence
and the reviewer a full checkout — or it gets waved through, which is worse. Pasted
output is falsifiable: the reviewer can read the verdict line, spot the wrong count,
re-run the exact command. And capturing output forces the author to actually run the
thing — this section catches the unfinished branch before the reviewer does.
**How to apply:** Run the commands at description-writing time, against the branch as it
will merge. Paste the command and the observed lines that prove the point — trim the
noise, keep the verdict. Cover every claim the description makes anywhere. Declare what
was not run ("Not run: needs staging credentials") instead of implying it was; reviewers
forgive gaps far more readily than discovered fiction.
**Anti-example:** From an unguided bug-fix draft's review instructions: "confirm that
allowing a failure-enumerating body shape doesn't loosen the convention … It doesn't."
The author answers their own review question by assertion, in the spot where the
evidence — the convention's unchanged default, quoted — should sit.

## Rule: Problem and Summary answer different readers
**Why:** They blur because both introduce — but they serve opposite ends of the audience
(`../_shared/audience.md`). Summary is the CTO's complete read: what ships and why it
matters, in two or three sentences. Problem is the junior's anchor: the user-visible
symptom or unmet need, in words that predate the solution. A Problem that names classes
and flags loses the junior; a Summary that recounts symptoms hides the outcome from the
CTO.
**How to apply:** Write Problem first and keep solution vocabulary out of it: what could
the user not do, what broke, who hit it. Write Summary last, compressing the finished
description. Two tests: Problem makes sense to someone who has never opened the
codebase; Summary survives being the only part read.
**Anti-example:** The same unguided feature draft opens its Summary with "New skill:
`skills/landing/audit-copy-compliance/` — the pre-publish copy gate for the landing
catalogue…" — the solution announcing itself, followed by twenty lines of mechanics. The
need (non-compliant copy could reach production with nothing to stop it) appears nowhere
in the description.

## Rule: choose the shape by what the branch does to intended behavior
**Why:** The shapes answer different reviewer questions. Bug-fix review asks: did you
find the real cause, and can it regress? — hence Root cause, and Tests that catch the
regression. Feature review asks: is this the right approach, and what does it touch? —
hence Solution and Implementation. The wrong shape hides the question that matters: a
bug fix in feature shape buries the mechanism; a feature in bug-fix shape has no room to
defend its design.
**How to apply:** The branch **restores** intended behavior → bug-fix shape. It
**changes or extends** intended behavior → feature shape. Mixed branch: lead with the
dominant shape — the change the reviewer must judge — and list the rest under Notes
("also carries: …"). A behavior-preserving refactor takes the feature shape: Problem is
the maintenance pain, Solution the new arrangement.

## Worked example — bug-fix shape, filled

Commit `bb60f36` of this repo (`git show bb60f36`): three files, follow-up corrections
to a skill that landed the day before. The description below is built from that diff and
from commands actually run. The change itself reached main inside PR #7 — merged with
an empty body; this is the description it should have had.

Title: `fix(skills): audit-copy-compliance — legible NBSP example, K.O. semantics,
compliance body shape` — the shipped subject ran 116 characters; compressed per
`../write-commit-messages/SKILL.md`.

````markdown
## Problem

Three defects shipped with the new audit-copy-compliance skill (0adc6b7) and surfaced
on re-read:

1. The locale-formatting example in `rules-template.md` demonstrates a non-breaking
   space with a literal before/after — but rendered, both sides look identical, so the
   example cannot show its own fix. The English substantiation example also grouped
   digits European-style ("1 200 patients").
2. The verdict line in `SKILL.md` — "BLOCK (any K.O. or unresolved violation) or
   PASS" — leaves room to read non-K.O. findings as waivable.
3. The template's Rule / Check / Violation / Rewrite bodies violate
   `skills/landing/_shared/rubric-convention.md`, which requires criterion bodies to
   state what passes and what evidence to quote.

## Root cause

1. The example showed the character instead of naming it; U+00A0 is invisible in
   rendered text, so no literal demonstration can work.
2. The verdict sentence named the BLOCK triggers but not the waiver rules —
   underspecified rather than wrong.
3. The convention predates any failure-enumerating rubric; the compliance template is
   the first, and it exposed the gap.

## Fix

1. The rewrite now names the move instead of showing it — `&nbsp;` in HTML, U+00A0 in
   source — and tells the auditor to check the source, since rendered output looks
   alike. Digits: "1,200".
2. The verdict line states both halves: non-K.O. findings block until resolved; K.O.
   findings can't be waived at all.
3. The convention now permits the Rule / Check / Violation / Rewrite body shape for
   compliance-style rubrics, rather than reshaping the template into a worse format.
   Pass-stating remains the default.

Also in the template intro: which categories are knockouts is a project decision, and
imagery is out of scope — this gate reads text.

## Tests

None added — Markdown-only repo; `scripts/validate.sh` is the gate (run below).

## Verification

```
$ bash scripts/validate.sh
OK: validator passed (31 skills checked)

$ grep -n 'U+00A0' skills/landing/audit-copy-compliance/rules-template.md
52:non-breaking space (`&nbsp;` in HTML, U+00A0 in source); rendered, both look alike, so

$ grep -n "can't be waived" skills/landing/audit-copy-compliance/SKILL.md
61:findings block until resolved; K.O. findings can't be waived at all. If the bundled
```

## Notes

The one structural call is fix 3: permitting a failure-enumerating body shape could be
read as loosening the convention for the scoring rubrics. It doesn't — pass-stating
stays the default and compliance-style files are the named carve-out. Start the review
at `skills/landing/_shared/rubric-convention.md`.

## Before merge

- [ ] Manual review
- [ ] Smoke tested
- [ ] Pipeline green
````

## When to deviate

- **A repo-mandated template** (`.github/PULL_REQUEST_TEMPLATE*`) wins outright: fill
  its sections in its order. The discipline travels — evidence into whatever slot asks
  for testing, the problem stated before the solution wherever the description begins.
- **One-line dependency bumps and typo fixes:** seven sections would outweigh the diff.
  Problem and Verification still earn their keep in a line each ("CVE-2026-…" /
  `$ pnpm audit` output); skip the rest — except the Before-merge checklist: review and
  a green pipeline gate even a one-liner. Bot PRs keep the bot's body.
- **A draft PR opened only to trigger CI** may stay bare — convert it to a full
  description before requesting review.

What never deviates: wherever a Verification slot exists, it holds commands and observed
output, not adjectives.
