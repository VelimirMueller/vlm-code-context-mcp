# Rubric Convention — bundled default, project override

The audit skills (`audit-content-quality`, `audit-copy-compliance`) are generic
**procedures** that consume **rules**. The procedure is the stable interface; the rubric
file is the swappable implementation — the same seam philosophy as `fetcher` or
`captureError`, applied to knowledge.

## Lookup order

1. **Project rubric:** `.claude/rubrics/<topic>.md` in the target project. If present,
   it is the *entire* law for the audit.
2. **Bundled default:** the skill's own reference file. Used only when no project rubric
   exists.

No merging — two half-rubrics would leave ambiguous which law applies. Override is total
replacement.

Present but empty — or containing no `##` criterion headings — is a **malformed rubric**:
report it and stop. Do not fall through to the bundled default (that would silently
re-merge two laws), and never pass an audit because its law was unreadable.

## Registered topics

| Topic | Project path | Bundled default |
|---|---|---|
| `content-quality` | `.claude/rubrics/content-quality.md` | `skills/landing/audit-content-quality/default-rubric.md` |
| `copy-compliance` | `.claude/rubrics/copy-compliance.md` | `skills/landing/audit-copy-compliance/rules-template.md` |

## The install offer

When an audit runs on the bundled default, end the report with an offer: *"copy the
default rubric to `.claude/rubrics/<topic>.md` so the project can adapt it?"* A team with
its own scorecard (a points system with knockout criteria, a regulated-industry rules
set, a house style) drops it in once and every future audit enforces *their* law.

## Rubric file format

Markdown, one criterion per `##` heading. A criterion marked `[K.O.]` in its heading is a
knockout: failing it fails the page outright, regardless of the rest. The body states
**what passes** and **what evidence to quote**. Anything the file says beyond that
(weights, points, severity tiers) is the project's business — the audit follows the file.

Compliance-style rubrics may shape the body as **Rule / Check / Violation / Rewrite**
instead — failure-enumerating rather than pass-stating; the procedure follows whatever
the file's criteria define.
