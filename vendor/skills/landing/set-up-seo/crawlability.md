# Crawlability

Reference for `set-up-seo`. The test, the symptom, and the remediation pointers.

## Rule: measure the output, never trust the framework
**Why:** "We use a modern framework" says nothing about what a non-JS fetch sees;
misconfigured SSR, client-only components, and consent walls all produce empty shells
from "server-rendered" stacks.
**How to apply:** the view-source test (`../_shared/page-types.md`): `curl` the URL (or
read the built file) and grep for a distinctive phrase from the main content. Repeat for
each *template* (home, article, product), not just the homepage.

## The empty-shell symptom
```html
<body><div id="root"></div><script type="module" src="/assets/index-….js"></script></body>
```
That is what a crawler without JS sees of a client-rendered SPA: nothing. Titles and meta
set by client JS (`document.title`, client-side head managers) have the same problem —
present in DevTools, absent from the response.

## Rule: Disallow is not noindex
**Why:** `robots.txt` `Disallow:` blocks *crawling*, not *indexing* — a disallowed URL
can still be indexed from external links, with no snippet. And `noindex` inside
robots.txt is unsupported (Google dropped it in 2019).
**How to apply:** to keep a page out of the index, serve
`<meta name="robots" content="noindex">` (or the `X-Robots-Tag` header) on a *crawlable*
page. Do not also `Disallow` it: a crawler that cannot fetch the page never sees the
`noindex`. Use `Disallow:` only to manage crawl budget on infinite spaces (faceted filters,
internal search).

## Rule: AI crawlers — separate the bots by purpose, then choose
**Why:** The same vendor runs different agents for different uses, and blocking the
wrong one has the opposite effect of what the owner wants (blocking a search bot removes
you from that product's answers; allowing a training bot feeds model training). A blanket
`User-agent: *` rule cannot express that.
**How to apply:** decide per purpose and write one `User-agent` group per bot. Verified
2026-10-09 from vendor docs:

| Vendor | Training | Search / index | User-triggered fetch |
|---|---|---|---|
| OpenAI | `GPTBot` | `OAI-SearchBot` | `ChatGPT-User` (user-initiated; robots.txt may not apply) |
| Anthropic | `ClaudeBot` | `Claude-SearchBot` | `Claude-User` |
| Google | `Google-Extended` (robots.txt token only: no UA string, no log line; controls Gemini training and grounding; no effect on Search ranking) | `Googlebot` | n/a |

```
# default for a landing page that wants citations but not training
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /
```

`Disallow` is a request, not enforcement; well-behaved bots honor it, others do not (use
WAF/bot rules to enforce). Whether to block training is a business call — blocking costs
nothing in Google ranking, and the effect on model visibility is unproven. List UA names
from the vendors' docs, not memory: they change.

## Rule: `llms.txt` is optional and has no proven effect
**Why:** It is a community proposal, not a standard. Google says Search ignores it, and
2026 server-log studies reported by SEO press (Ahrefs, June 2026: 97 % of files got zero
requests in May 2026 — secondary source, not re-verified) show the major AI crawlers
barely fetch it. It does help developer-docs sites, where coding assistants read it.
**How to apply:** marketing/landing pages: skip it, spend the hour on crawlable content.
Docs for developers: publish it — it costs a file.

## Remediation pointers (thin — the fix lives in your stack)
- **Vite SPA:** prerender the public routes at build time, or serve the marketing pages
  as static HTML beside the app. Client-side head management
  (`skills/frontend/set-up-document-head`) fixes tabs and a11y, not crawlability.
- **Next/Nuxt/Astro:** public pages must be SSG/ISR/SSR — audit that no
  client-only boundary wraps the main content.
- **Consent walls:** content must be in the HTML *before* consent UI; a consent-gated
  page body is an empty shell with a cookie banner.

## When to deviate
- The crawlability gate has no exception for public pages. (App surfaces behind auth are
  out of scope by the gate.)
- AI-crawler policy is the opposite: a publisher selling content licenses blocks
  everything; a docs site wants everything. Pick by business model.
