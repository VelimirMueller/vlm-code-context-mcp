# Claude Skills Plugin — Bundling & Sync Design Spec

**Date:** 2026-06-09
**Status:** Approved design — pending implementation plan
**Source plugin:** https://github.com/VelimirMueller/claude_development_skills (`main`, v0.2.0, 22 frontend skills)
**Tickets:** created during /kickoff planning for this milestone

---

## Goal

Ship the frontend skills from the `claude_development_skills` plugin repo inside the `vlm-code-context-mcp` npm package, and keep that bundled copy current as the plugin repo grows (backend, infra, and further domains). A developer who installs the MCP server and runs `setup` gets the skills in their project with no extra steps. A scheduled GitHub Action refreshes the bundled copy and opens a pull request whenever the plugin repo's `main` changes.

The plugin repo stays the single source of truth. This package vendors a snapshot of it.

---

## Decisions

| Decision | Choice |
|----------|--------|
| Source of truth | The `claude_development_skills` repo. This package vendors a snapshot. |
| Delivery | Bundled snapshot inside the npm package; `setup` copies it into the project. |
| Sync trigger | Scheduled GitHub Action tracks the plugin repo's `main` and opens a PR on any change. |
| Consumer install | `setup` copies `skills/**` into the project's `.claude/skills/`, mirroring how `.claude/commands` already ship. |
| Versioning | Track `main`. No release-tag pinning. |
| Scope bundled | The whole `skills/` tree, so new domains flow in automatically. |

### Naming-clash guard

Two unrelated things share the word "skill":

- **Plugin skills** — the `SKILL.md` files Claude Code loads. This spec bundles these.
- **DB skills** — rows in the `skills` table (`PRODUCT_VISION` and scrum-process text), seeded by `setup.ts`.

The top-level `skills/` directory holds plugin skills only. The `skills` table is untouched. The two never interact.

---

## Repo layout

New and changed paths in `vlm-code-context-mcp`:

```
skills/                              NEW — vendored snapshot, mirrors the plugin repo's skills/
  frontend/
    _shared/{conventions,stack-versions,glossary}.md
    <skill>/SKILL.md  (+ reference .md files)   × 22
  .source.json                       NEW — provenance manifest
scripts/
  sync-skills.mjs                    NEW — re-vendor engine
src/server/setup.ts                  CHANGED — add a "[7] Installing Claude skills" step
.github/workflows/
  sync-skills.yml                    NEW — scheduled + manual; runs sync, opens PR
package.json                         CHANGED — files[] += "skills"; scripts += "sync:skills"
```

---

## Components

Each unit has one job and is testable on its own.

| Unit | Responsibility |
|------|----------------|
| `scripts/sync-skills.mjs` | Fetch the plugin repo at a ref, replace the vendored `skills/` tree, write the manifest. Idempotent. |
| `skills/.source.json` | The single record of what is vendored. |
| `setup.ts` step `[7]` | Copy the package's `skills/**` into the project's `.claude/skills/`, recursively and non-destructively. |
| `.github/workflows/sync-skills.yml` | Run the sync script on a schedule (and on demand) and open a PR when the tree changes. |

### `skills/.source.json`

```json
{
  "source": "https://github.com/VelimirMueller/claude_development_skills",
  "ref": "main",
  "commit": "9f3a1c2e8b7d4f60a1b2c3d4e5f60718293a4b5c",
  "syncedAt": "2026-06-09T06:00:00Z",
  "skillCount": 22
}
```

### `scripts/sync-skills.mjs`

Command-line interface:

```
node scripts/sync-skills.mjs [--repo <git-url>] [--ref <ref>]
  --repo   default https://github.com/VelimirMueller/claude_development_skills
  --ref    default main
```

Steps:

1. Shallow-clone `<repo>` at `<ref>` into a temporary directory.
2. Confirm `<tmp>/skills/` exists. Abort with a non-zero exit if it does not.
3. Read the upstream commit: `git -C <tmp> rev-parse HEAD`.
4. Build the new tree under `skills.tmp/`. Only once it is complete, replace `skills/` with it as the final step. A failure during fetch or build therefore leaves the existing tree intact.
5. Count `SKILL.md` files and write `skills/.source.json`.
6. Delete the temporary directory.

Re-running with no upstream change produces no diff.

### `setup.ts` step `[7]`

Mirrors step `[6]` (commands), but recurses into subdirectories.

```ts
// 7. Copy bundled skills into the project's .claude/skills
console.log("[7/7] Installing Claude skills...");
const pkgSkillsDir = path.resolve(__dirname, "../../skills");
const targetSkillsDir = path.resolve(TARGET_DIR, ".claude/skills");
if (fs.existsSync(pkgSkillsDir)) {
  const copied = copyDirNonDestructive(pkgSkillsDir, targetSkillsDir, {
    exclude: [".source.json"],
  });
  console.log(`  Installed ${copied} skill file(s) to ${targetSkillsDir}`);
} else {
  console.log("  No skills directory found in package, skipping.");
}
```

`copyDirNonDestructive` walks the source tree, creates directories as needed, copies each file only when the destination is absent, and returns the count copied. A developer's edited skill survives a re-run.

This step also normalizes the existing step labels (`[1/4]`…`[6/6]` are currently inconsistent) to a single `[n/7]` sequence.

### `.github/workflows/sync-skills.yml`

```yaml
name: Sync skills
on:
  schedule:
    - cron: "0 6 * * *"   # daily, 06:00 UTC
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/sync-skills.mjs
      - uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/sync-skills
          add-paths: skills/
          commit-message: "chore(skills): sync vendored skills from upstream main"
          title: "chore(skills): sync from claude_development_skills"
          body: |
            Automated sync of the vendored `skills/` tree from the plugin repo's `main`.
            See `skills/.source.json` for the source commit. Review the diff before merging.
```

`create-pull-request` opens or updates the PR only when the working tree changed, so "no change → no PR" needs no extra guard. A human reviews and merges; the existing release flow publishes to npm.

The job needs `permissions: { contents: write, pull-requests: write }`, and the repo setting **Allow GitHub Actions to create and approve pull requests** must be on. Without both, the PR step fails.

---

## Data flow

### Sync (maintainer side)

```
cron / manual dispatch
  -> node scripts/sync-skills.mjs --ref main
       -> shallow-fetch plugin@main into temp
       -> build skills.tmp/ then swap to skills/   (atomic)
       -> write skills/.source.json (commit, syncedAt, skillCount)
  -> create-pull-request
       changed?  no  -> exit, no PR
                 yes -> open/update PR "chore(skills): sync from ...@<short-sha>"
  -> human reviews -> merge -> release flow publishes to npm
```

### Install (consumer side)

```
npm i vlm-code-context-mcp          (files[] now includes skills/)
npx code-context-mcp setup          step [7] copies skills/** -> <project>/.claude/skills/
Claude Code discovers               .claude/skills/**/SKILL.md
```

---

## Error handling

- **Sync script.** Fail fast and exit non-zero on a clone or copy failure. Build into a temporary tree and swap, so a failure leaves the existing `skills/` and `.source.json` intact. A failed run goes red in CI and opens no PR.
- **Setup copy.** Wrap the step in try/catch, as step `[6]` does. When the package carries no `skills/`, log `No skills directory found, skipping` and continue. Never overwrite a file that already exists in the project — skip it and log, so local edits survive.
- **Idempotency.** Re-running the sync or `setup` with no upstream change copies nothing and produces no diff.

---

## Open implementation detail — project-level skill discovery

The plugin nests skills under a domain directory: `skills/frontend/<skill>/SKILL.md`, and skills reference shared files at `../_shared/*.md`. Marketplace discovery reads `skills/**` and handles this. Project-level `.claude/skills/` discovery may or may not recurse into a `frontend/` subdirectory; this spec does not assume it does.

- **Plan A (preferred).** Copy the tree verbatim and verify Claude Code loads the nested `frontend/<skill>/SKILL.md`.
- **Plan B (fallback).** If nesting breaks discovery, flatten to `.claude/skills/<skill>/` and co-locate `_shared` so the relative references still resolve.

The implementation resolves this empirically: write the discovery assertion first, then choose A or B from the result.

---

## Testing

| Target | Test |
|--------|------|
| `sync-skills.mjs` | Given a fixture upstream directory, the script vendors the tree and writes a correct manifest. A second run with no change produces no diff. (Temp-directory test, like the existing temp-DB tests.) |
| `setup` step `[7]` | Given a package `skills/` fixture, `setup` copies it into a temp project's `.claude/skills/`, preserves the structure, and skips files that already exist. Extends `test/fixtures/sample-project` and the e2e setup tests. |
| `sync-skills.yml` | Lint the YAML. Validate the first real run through `workflow_dispatch`. |

All tests run under the project's existing Vitest setup.

---

## Files changed

| File | Change |
|------|--------|
| `skills/**` | New — vendored snapshot of the plugin repo's `skills/` tree. |
| `skills/.source.json` | New — provenance manifest. |
| `scripts/sync-skills.mjs` | New — re-vendor engine. |
| `src/server/setup.ts` | Add step `[7]` to copy skills into `.claude/skills/`; normalize step labels. |
| `.github/workflows/sync-skills.yml` | New — scheduled and manual sync that opens a PR. |
| `package.json` | `files[] += "skills"`; add `"sync:skills": "node scripts/sync-skills.mjs"`. |

---

## Out of scope

- **Marketplace / `plugin.json`** — turning this repo into a Claude Code marketplace that installs everything through `/plugin`. A clean future milestone, not this one.
- **Auto-merge and auto-publish** — the sync stops at an open PR. A human merges and publishes.
- **Curated subsets** — the whole tree ships, so backend and infra skills flow in automatically.
- **MCP-served skills** — exposing skills as MCP resources instead of files.
- **Release-tag pinning** — sync tracks `main`.
