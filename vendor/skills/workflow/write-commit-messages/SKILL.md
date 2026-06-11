---
name: write-commit-messages
description: Use when committing work or writing a commit message — produces a subject and body any developer from junior to CTO can read and act on.
---

# Write Commit Messages

The diff already records *what* changed; the message carries what the diff cannot — the
motivation, the shape, the approach. Subject in the repository's own convention; body in
three labeled groups — Why, What, How — every line derived from the diff.

## 1. Audit — the diff and the house convention

```bash
git diff --staged            # or: git show <commit>, for an existing message
git log --oneline -15
```

Read the actual diff: the body will be derived from it, never from memory of what was
intended. From the log, detect the subject convention — conventional commits
(`feat(scope): …`), gitmoji, or plain imperative — and match it; default to conventional
commits only when no convention is detectable. Change nothing yet.

## 2. Decide

- **The diff mixes concerns** (a feature plus an unrelated fix) → propose the split
  before writing anything: one concern per commit, one message each.
- **A commit exists and only its message is wrong** → amend rather than stack a fixup:
  `git commit --amend`. Safe only while the commit is unpushed and unshared — rewriting
  published history breaks everyone who pulled it. Already pushed → never amend; when
  the message is still wanted (a squash target, the spine of a PR description), draft
  it without touching history.
- **The message already conforms** (subject in convention, the three groups present) →
  report "already in place" and exit. A second run writes nothing.

## 3. Draft the subject

In the detected convention, imperative mood, aim ≤72 characters, the one concern named.
Test: "applying this commit will <subject>" reads as a sentence — the description after
any `type(scope):` prefix is what must parse (./commit-patterns.md for the discipline).

## 4. Draft the body — Why, What, How

Three labeled bullet groups, each grounded in the step-1 diff:

```text
Why:
- the problem or motivation — the one thing the diff cannot show

What:
- the change at a glance: surface, files, behavior

How:
- the approach taken and its trade-offs
```

Every bullet concrete — a path, a behavior, a named mechanism, a number — and project
jargon glossed on first use. What separates concrete from filler: ./commit-patterns.md.
Keep the trailers the house convention carries (`Co-Authored-By:`, `Signed-off-by:`)
after the three groups — they are part of what the step-1 audit detects.

## 5. Self-check — the audience contract

Run the three tests from `../_shared/audience.md`: a junior can follow the message
without tribal knowledge, a senior can verify each bullet against the diff, a CTO gets
outcome and risk from the labels and first lines alone. Any unexplained jargon or
unverifiable claim → revise before showing it.

## 6. Verify

Show the final message for approval before committing; after committing, confirm:

```bash
git log -1 --format=%B
```

The printed message matches what was approved: subject in the repo's convention, the
three labeled groups present.

## References
- ./commit-patterns.md — the rules with rationale, the unguided baseline as anti-example, and a worked rewrite of a real commit.
- ../_shared/audience.md — the junior-to-CTO contract step 5 checks against.
- ../write-pull-requests/SKILL.md — the same Why/What/How spine at PR scale; on squash-merge, the PR description becomes this commit's message.
