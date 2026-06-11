# Audience — the contract every workflow skill writes to

A commit message or a pull-request description has three readers, and they read it
differently. The junior reads it to act; the senior reads it to verify; the CTO reads it
to decide. The contract of this catalogue is that **one text serves all three at once** —
not three documents stitched together, and not a text only its author can decode. A
message that needs its author standing next to it is a note to self, and these skills do
not write notes to self.

## The three tests

Run the finished text against each reader. It passes the contract only when all three pass.

**The junior test — can they follow it without tribal knowledge?**
Every term is plain or expanded at first use; every step the text asks for is explicit.
No "fix it the usual way," no "as discussed." A developer in week one, given the repo and
this text alone, can act on it.

**The senior test — can they verify it quickly?**
Every claim sits next to its evidence — the command and its output, the behavior before
and after, the test or measurement it rests on. The reviewer never takes the author's
word, and never scrolls away from the claim to check it.

**The CTO test — can they skim it?**
Outcome and risk live in the first lines, and the headings alone carry the story. Reading
only the subject and the headings still tells them what changed, why, and what could break.

## The rules

- **Plain words over jargon.** "Retries the request once" — not "implements resilient
  invocation semantics."
- **Evidence before assertion.** "Fixed" is a claim; the failing test that now passes is
  a fact. Show the fact.
- **No filler bullets.** "Improved code quality" and "minor cleanups" say nothing — name
  the change or cut the line.
- **Expand an acronym at first use.** "TTI (time to interactive)" once, "TTI" after. The
  junior keeps reading; the senior is not slowed down.

## One rewrite

Fails all three readings:

> fix race condition in auth stuff, refactored some things, should be ok now

Passes them:

> fix(auth): refresh the token once per 401 burst, not once per request
>
> Concurrent 401s each triggered their own token refresh; the late refreshes
> invalidated the early ones and logged users out. Refresh is now single-flight:
> the first 401 refreshes, the rest wait for the result. Reproduced with 20
> parallel requests in tests/integration/auth.spec.ts — failed before, passes now.

The junior can act on it (the mechanism and the test are named), the senior can verify it
(the spec file and the before/after sit in the text), and the CTO has the outcome — users
stay logged in — from the subject line.

## When to deviate

- **Trivial diffs.** A one-line typo fix needs a subject line, not a three-reader essay.
  The contract scales with the blast radius of the change.
- **A convention that already carries the context.** When the tracker template or the
  team's PR form holds the evidence, link it rather than restate it. The three tests
  still apply — every reader must still get through.
