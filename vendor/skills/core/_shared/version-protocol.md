# Version Protocol

Training data is stale the day it ships. Every version, flag, config key and API in a skill or in generated code is verified live before it is written. Memory is a hint for *where to look*, never a source.

## Rule: Ask the registry, not memory
**Why:** Major versions change defaults and remove APIs (TypeScript 7 native, Vite 8 on Rolldown, Zod 4, Vitest 5). A config copied from memory is wrong exactly when it looks most familiar.
**How to apply:** Before writing any version number or option, run the matching query below and write down the output. Record the result with its date in the catalogue's `_shared/stack-versions.md` (table: tool | line | verified-from | note). If you cannot verify, write `unverified` in the table; never guess.
**Anti-example:** "Vite is on 5 or 6, so `plugin-react@4`." — one `npm view` shows the real line.

## Live lookups per ecosystem

| Ecosystem | Latest stable | Dist-tags / pre-releases | Changelog |
|---|---|---|---|
| npm | `npm view <pkg> version` | `npm view <pkg> dist-tags --json` | package `CHANGELOG.md`, GitHub releases |
| Node.js | `curl -s https://nodejs.org/dist/index.json` and take the first entry with `"lts"` set | same file | nodejs.org/en/about/previous-releases |
| Go toolchain | `curl -s 'https://go.dev/dl/?mode=json'` | same | go.dev/doc/devel/release |
| Go module | `go list -m -versions <module>` or pkg.go.dev | `go list -m -u all` | module repo |
| Rust crate | `curl -s -H 'User-Agent: skills' https://crates.io/api/v1/crates/<name>` → `max_stable_version` | `versions[]` | docs.rs, repo |
| Rust toolchain | `rustc --version`; GitHub `rust-lang/rust` releases | | blog.rust-lang.org |
| PyPI | `curl -s https://pypi.org/pypi/<pkg>/json` → `info.version`, `info.classifiers` (Development Status) | `releases` keys | project docs |
| GitHub-released tools (gitleaks, just, zizmor, OpenTofu, mise …) | `gh api repos/<owner>/<repo>/releases/latest --jq .tag_name` | `gh release list` | the release notes |
| GitHub Actions | `gh api repos/<owner>/<repo>/releases/latest --jq .tag_name`, then resolve the tag to a SHA (`gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`) | | |
| Container images | registry tags; pin the digest | | |

Cross-checks:

- A pre-release in `dist-tags` (`next`, `rc`, `beta`) is not "latest". Say so in the table.
- Peer ranges decide the line: `npm view <pkg>@<ver> peerDependencies`. Example: the Vue toolchain may force a TypeScript line a version behind the newest.
- "Announced" is not "released". Use the registry date (`npm view <pkg> time.modified`) before calling anything stable.
- For behaviour, read the official docs page or release notes for that exact version; a blog post or a Stack Overflow answer is a lead, not proof.

## Rule: Pin policy per ecosystem
**Why:** Floating ranges turn a Tuesday dependency release into a Tuesday outage. Exact pins turn security patches into manual chores. The lockfile is the pin; the manifest range states intent.
**How to apply:**

| Ecosystem | Manifest | Lockfile | Policy |
|---|---|---|---|
| JS/TS | `^` for runtime deps, `~` for build/test tooling, exact for tools whose minors break (formatter or linter that rewrites code: pin exact, bump deliberately) | commit it, install with `--frozen-lockfile` / `npm ci` in CI | Renovate or Dependabot opens PRs; one bump per PR for majors |
| Python | `>=X.Y,<X+1` compatible-release (`~=`) in `pyproject.toml` | commit `uv.lock`; CI runs `uv sync --locked` | |
| Go | `go.mod` minimum-version selection; the versions in `go.mod` are the floor | `go.sum` committed; `go mod verify` in CI | bump with `go get -u ./...` in a dedicated PR |
| Rust | caret by default (`"1.2"`); applications commit `Cargo.lock`, libraries may | `cargo build --locked` in CI | `cargo update` in a dedicated PR |
| GitHub Actions | pin to full commit SHA with the version in a trailing comment | | see [security-baseline.md](security-baseline.md) |
| Docker | pin by digest (`image@sha256:…`) with a version tag comment | | |
| Runtimes (Node, Go, Python, Rust) | one source: `mise.toml` (or the profile's `runtime_manager`) | | CI reads the same file; no second copy |

**When to deviate:** A library that must be consumed by many apps keeps wide ranges and tests against the edges of them; an app should not.

## Rule: Floors, not pins, in skill docs
**Why:** A table in a skill is a snapshot. Readers treat a snapshot as a pin and ship stale software.
**How to apply:** Every `stack-versions.md` says "re-verify before scaffolding; this is a floor, not a pin" and carries the verification date. Skills tell the agent to run the lookup, not to copy the number.

## Rule: Distinguish the four statuses
**Why:** "New" hides risk. Four labels carry the risk in a word: **stable** (latest dist-tag, GA announcement), **rc/beta** (published under a pre-release tag), **announced** (promised, not shipped), **unverified** (could not check).
**How to apply:** Use exactly these words in tables and radar entries. Anything not **stable** is Assess at best, unless the owner opted in.

## Verification record (template)

```
tool: <name>
checked: 2026-10-09
command: <exact command>
result: <output line>
source: <URL of the doc or release note>
```

## When to deviate

- Offline or air-gapped work: use the lockfile as truth and say so in the PR.
- A user-pinned version (the profile or the repo says so): honour it, note a newer line exists, do not upgrade unasked.
