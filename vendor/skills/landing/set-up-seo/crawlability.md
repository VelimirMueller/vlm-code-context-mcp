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
page. Use `Disallow:` only to manage crawl budget on infinite spaces (faceted filters,
internal search).

## Remediation pointers (thin — the fix lives in your stack)
- **Vite SPA:** prerender the public routes at build time, or serve the marketing pages
  as static HTML beside the app. Client-side head management
  (`skills/frontend/set-up-document-head`) fixes tabs and a11y, not crawlability.
- **Next/Nuxt/Astro:** public pages must be SSG/ISR/SSR — audit that no
  client-only boundary wraps the main content.
- **Consent walls:** content must be in the HTML *before* consent UI; a consent-gated
  page body is an empty shell with a cookie banner.

## When to deviate
None for public pages — crawlability is the load-bearing property. (App surfaces behind
auth are out of scope by the gate.)
