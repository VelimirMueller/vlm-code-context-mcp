# Skill Template and Checklist

## Rule: A skill is a triggered procedure, not an essay
**Why:** Every description is always in Claude's context. It is a budget. The body loads only when matched, and reference files load only when needed.
**How to apply:** Put the trigger in `description`, the steps in `SKILL.md`, the rationale in the reference file.
**Anti-example:** A 600-line SKILL.md that explains Docker.

## Template: SKILL.md

````markdown
---
name: <verb>-<thing>
description: Use when <situation that triggers it> — <what it does in one breath>.
---

# <Title>

<One sentence: what this produces.> Rules and rationale: [<thing>-patterns.md](<thing>-patterns.md).

## 1. Audit (change nothing)

```bash
cat .claude/stack-profile.md 2>/dev/null
<ls / grep commands that show whether the work is already done>
```

Branch on the profile keys this skill reads: `<key>`, `<key>`. Absent profile: detect from `<lockfiles / manifests>`.
Ask one question only if detection is ambiguous and the answer changes the output; then suggest `set-up-stack-profile`.

## 2. Decide
- Nothing in place → full run.
- Partly in place → only the missing parts.
- Complete → print "already in place" and stop.

## 3. Detect track
<Branch per language or framework from the profile, one line each.>

## 4. Install only what is missing
```bash
<exact command, with the version verified per ../../core/_shared/version-protocol.md>
```

## 5. Generate the seam
```<lang>
<one canonical, compiling snippet>
```

## 6. Wire
<Where the seam is imported; what is deleted or replaced.>

## 7. Verify
```bash
<command>
```
Expected: <exact result>.
````

## Template: reference file

````markdown
# <Topic> Patterns

## Rule: <rule stated plainly>
**Why:** <cost of getting it wrong; "X over Y, for Z">
**How to apply:** <the concrete move, with code>
**Anti-example:** <the tempting wrong version>

## When to deviate
- <condition> → <what to do instead>
````

## Checklist (mirrors `scripts/validate.sh`, plus house style)

Structure and validator checks:

- [ ] Path is `<skills root>/<name>/SKILL.md`; the file starts with `---` on line 1.
- [ ] Frontmatter has `name:` and `description:`.
- [ ] `name` equals the folder name; kebab-case; verb-first.
- [ ] `description` begins with `Use when`.
- [ ] `description` is at most 300 characters.
- [ ] No `when_to_use` field.
- [ ] Every relative `.md` link resolves (shared contracts, sibling reference files).
- [ ] When contributing upstream: the catalogue directory is listed in the `skills` array of exactly one plugin entry in `.claude-plugin/marketplace.json` (there is no root `plugin.json`).

House style checks:

- [ ] Step 1 is an audit that changes nothing and reads `.claude/stack-profile.md`.
- [ ] A second run is a no-op ("already in place" exit exists).
- [ ] Each tool and version has a verified source and date; unverified items are labelled.
- [ ] Each rule has Why and When to deviate; no unjustified opinion.
- [ ] One seam per vendor or I/O boundary.
- [ ] Security by default; secrets never in client code ([security-baseline.md](../_shared/security-baseline.md)).
- [ ] SKILL.md at most about 180 lines.
- [ ] Prose has none of: simply, just, seamless, robust, leverage.
- [ ] Snippets compile against the current API.

Shell check (run from the skills root; it covers the three validator checks):

```bash
for f in $(find . -name SKILL.md); do
  d=$(awk '/^---$/{c++; if(c==2) exit; next} c==1' "$f")
  n=$(echo "$d" | sed -n 's/^name:[[:space:]]*//p')
  [ "$n" = "$(basename "$(dirname "$f")")" ] || echo "NAME MISMATCH: $f"
  desc=$(echo "$d" | sed -n 's/^description:[[:space:]]*//p')
  case "$desc" in "Use when"*) ;; *) echo "DESCRIPTION START: $f";; esac
  [ "${#desc}" -le 300 ] || echo "DESCRIPTION > 300 (${#desc}): $f"
  wc -l < "$f" | awk -v f="$f" '$1>190{print "LONG: " f}'
done
```

Expected: no output.

## When to deviate

- A skill for a one-off migration: skip the idempotent "already in place" exit, keep the audit and the verify step.
- Project-local skills may drop the `_shared` links when the repo has no shared folder; keep the rule rationale inline then.
