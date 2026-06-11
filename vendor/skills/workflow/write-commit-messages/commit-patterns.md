# Commit Patterns

Reference for `write-commit-messages`. Why the body leads with Why, what separates a
concrete bullet from filler, the discipline of the subject line — and the unguided
baseline these rules exist to prevent, rewritten into shape.

## Rule: the Why leads — reviewers triage by motivation
**Why:** The What is recoverable from the diff forever; the Why exists only in the
author's head, and only at commit time. Reviewers — and whoever reads `git log` during an
incident — decide from the motivation whether a commit concerns them; bury it and every
reader pays the full read just to learn that it didn't.
**How to apply:** Open the body with the `Why:` group — the problem, gap, or requirement
in one to three bullets, stated as fact ("nothing gated copy before publish"), not as
virtue ("to improve quality and robustness").
**Anti-example:** The baseline below opens with "New landing skill:" — a What — and the
nearest thing to a motivation arrives in its final two lines, after fourteen lines of
mechanism.

## Rule: three labeled groups beat prose paragraphs
**Why:** The body serves three readers at once (`../_shared/audience.md`): the CTO skims
labels and first lines, the senior verifies bullets against the diff, the junior follows
without tribal knowledge. A prose wall serves only the reader who reads all of it — on
most days, nobody.
**How to apply:** `Why:` the motivation. `What:` the change at a glance — surface, files,
behavior. `How:` the approach and its trade-offs. Bullets under each label; a group with
nothing non-obvious to say gets one line, not padding.
**Anti-example:** The baseline body is three dense paragraphs in which What and How
interleave mid-sentence ("Template ships six categories … Every finding carries all
three parts"); no reader can skim it, so every reader must study it.

## Rule: a concrete bullet names the thing; filler gestures at it
**Why:** A senior can check "findings carry quoted copy + named rule + rewrite" against
the diff in seconds; nobody can check "improved the audit flow." A bullet that cannot
name what changed reads as if the author doesn't know.
**How to apply:** Derive every bullet from the staged diff, never from memory of what was
intended. Give each bullet an anchor — a path, a behavior, a mechanism, a number — and
gloss project jargon at first use ("any [K.O.] (knockout) finding"): the junior reading
is part of the contract.
**Anti-example:** "Lookup follows the shared rubric convention … with the run flagged
and the install offer appended" (baseline) — three pieces of tribal knowledge in one
clause, no anchor a newcomer could follow.

## Rule: the subject obeys the repo, then the ruler
**Why:** The log is a UI: GitHub's commit list truncates subjects around 72 characters,
and conventional-changelog tooling groups entries by their prefix. One commit in a
foreign convention breaks scanning for every commit around it.
**How to apply:** Match the convention the audit detected (this repo: conventional
commits, `feat(skills): …`); imperative mood — "applying this commit will <subject>"
must read as a sentence; aim ≤72 characters; one concern, so an "and" in the subject
means the split was skipped.
**Anti-example:** The shipped subject runs 85 characters — GitHub's commit list cuts it
just where the distinguishing clause begins.

## Worked example: commit 0adc6b7, rewritten

What actually shipped (`git show -s --format=%B 0adc6b7`) is the 85-character subject
plus a trailer — no body at all. What an unguided agent drafted for the same diff in
this catalogue's baseline run (abridged; its weakest lines are quoted in the rules
above):

```text
feat(skills): add audit-copy-compliance — rules-file copy gate with quoted violations

New landing skill: a cheap pre-publish gate that audits the visible
copy of a public page (headings, body, buttons, alt/meta/OG text, even
JSON-LD) against a rules file the project owns. Lookup follows the
shared rubric convention: …                        [two more paragraphs]
```

The same commit in the target shape — every line checkable against `git show 0adc6b7`.
Writing for this commit itself? Derive from the diff first, then compare — the example
is the answer key, not the source:

```text
feat(skills): add audit-copy-compliance — pre-publish copy gate

Why:
- Nothing gated page copy before publish: a prohibited claim
  ("guarantees visible results") would ship as a legal problem,
  not a style problem.
- audit-content-quality scores whether copy is good; no skill
  answered whether it is allowed.

What:
- New skill skills/landing/audit-copy-compliance: SKILL.md (the
  six-step audit) plus rules-template.md (six rule categories
  with placeholder rules a project replaces with its own).
- Audits all visible copy of a public page — headings, body,
  buttons, alt text, meta and Open Graph text, JSON-LD structured
  data — and reports each violation as quoted copy + named rule +
  compliant rewrite.

How:
- Rules lookup per the shared rubric convention: the project's
  .claude/rubrics/copy-compliance.md is the entire law when
  present; absent, the bundled template applies, the run is
  flagged, and an install offer is appended to the report.
- Any [K.O.] (knockout) finding fails the page outright; verdict
  is BLOCK or PASS, and a re-run on clean copy reports nothing.
```

## When to deviate
- **Typo-class commits: subject only.** `fix(docs): correct 0.4.0 date in CHANGELOG`
  carries its whole story; a ceremonial body would be filler. The contract scales with
  the blast radius (`../_shared/audience.md`).
- **Merges and reverts keep their generated shape.** Humans and tooling recognize
  `Merge pull request #7 …` and `Revert "…"` on sight; add one Why line under a revert
  only when the reason isn't obvious from context.
- **A hard template outranks this shape.** Where commitlint or a team template dictates
  fields, the repo wins — that is the audit rule applied; pour the Why/What/How content
  into the required fields instead of fighting them.
- **WIP commits bound for a squash.** Don't polish messages that will be rewritten; the
  Why/What/How belongs on the squashed result.
