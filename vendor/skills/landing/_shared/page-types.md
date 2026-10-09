# Page Types — the gate every landing skill runs first

The landing catalogue applies to **public pages**, and "public page" is a property of a
*page*, not of a project or a framework. Real repos are hybrids: an app has a public
pricing page; a marketing site has a login portal. Classify the page in front of you.

## The gate question

**Must this page be findable and readable without JS execution?**

- **Yes** → public page. Landing rules apply.
- **No** → app surface. Stop; the `skills/frontend/` catalogue owns it.
- **Unclear** → ask the user one question ("Is this page meant to be found by search/
  answer engines and shared publicly?") rather than guess.

## The view-source test (empirical, stack-agnostic)

```bash
# served page:
curl -s "$URL" | grep -ci "<a distinctive phrase from the page's main content>"
# local build output:
grep -rli "<distinctive phrase>" dist/ build/ .output/ out/ 2>/dev/null
```

`0` matches → the content is not in the HTML. Googlebot renders JS, but in a delayed second
pass; most AI crawlers are reported not to execute JS at all (Vercel/MERJ crawler study,
2024 — re-check, this moves), and scrapers and link-preview bots never do. On a public page
that is always **finding #1**, because every fix after it assumes a reader that can see the
content. Never infer crawlability from the framework — measure the output.
(The local-build form lists matching files — no output means zero matches.)

## Classification signals (when the owner isn't sure)

| Signal | Public page | App surface |
|---|---|---|
| Reachable logged-out | yes | no (auth wall) |
| Goal | conversion: sign up, buy, book, subscribe, read | task completion on personal data |
| Wants to rank / be shared | yes | irrelevant |

## The priority inversion

The same metrics carry opposite stakes on the two page types. State this before
optimizing anything:

| Property | Public page | App surface |
|---|---|---|
| Crawlability | load-bearing — ranking + answer-engine visibility | irrelevant |
| LCP / CLS | **revenue and ranking** (hero image, font swap, layout shift) | UX polish |
| INP (≤ 200 ms) | secondary (a public page should carry little JS) — but it still counts toward the CWV pass | the metric that matters |
| JS budget | near zero by default; every script earns its place | whatever the task needs |
| Metadata / schema | load-bearing | only for its few public routes |

## The refusal rule

A landing skill whose gate fails **says so and redirects** — "this is an authenticated
app surface; see `skills/frontend/`" — and stops. It never half-applies public-page rules
to an app screen, and never silently skips the gate.

## When to deviate
- **Hybrid pages** (marketing page with an embedded live calculator or configurator): the
  shell is public and passes the gate; the widget is an app surface. Gate each part.
- **Noindex public pages** (campaign pages shared by link only): skip the ranking rows;
  keep the no-JS readability test, since link previews and scrapers still need the HTML.
