# Capture Patterns

Reference for `set-up-lead-capture`.

## Rule: one destination — the seam
**Why:** When every form posts straight to a vendor SDK, swapping the CRM is a
find-and-replace across pages; when one endpoint/handler owns the destination, it's a
one-place change — the landing twin of the app catalogue's `fetcher`.
**How to apply:** all forms post to a single endpoint you control (or one provider URL,
configured in one place). The handler forwards to the CRM/list/webhook. Page markup never
names the vendor.

## Destination shapes

| Shape | When | Trade-off |
|---|---|---|
| Form service (Formspree, Basin, …) | static site, no backend | fastest; vendor UI owns the data; still keep the endpoint in one config |
| Serverless function | any host with functions | full control of validation/spam/consent; you glue to the CRM |
| Own API | backend exists | most control; you own rate-limiting, storage, deliverability |

## Rule: spam defenses escalate; invisible first
**Why:** CAPTCHAs cost real conversions; honeypots and time-traps cost nothing and stop
the dumb majority of bots.
**How to apply:** start with honeypot + time-trap (skill, step 5). Escalate to Cloudflare
Turnstile (or similar) only when measured spam pressure demands; managed/invisible mode
before interactive challenges.

## Rule: Turnstile — verify server-side, once, and know what it loads
**Why:** The widget only produces a token; a token nobody verifies blocks nothing. Tokens
expire after 300 s and are single-use, so replay and stale tokens must fail closed.
**How to apply (API verified 2026-10-09, developers.cloudflare.com/turnstile):**

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<!-- inside the <form>; adds the hidden field cf-turnstile-response -->
<div class="cf-turnstile" data-sitekey="SITE_KEY"></div>
```

Load the script from that exact URL — do not proxy or self-host it. Server:

```ts
// POST https://challenges.cloudflare.com/turnstile/v0/siteverify
async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET!, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success: boolean; hostname?: string };
  return data.success && data.hostname === 'example.com'; // your own hostname
}
```

Fail closed on a network error (return false, show "try again"); `timeout-or-duplicate`
means expired or replayed — reset the widget (`turnstile.reset()`). The secret lives in
env, never in page code.
**Privacy (EU/Germany):** the page now calls a third party, which receives the visitor's
IP and browser signals. Name Cloudflare in the privacy policy, have a data-processing
agreement, and settle the legal basis (typically Art. 6(1)(f) GDPR, security of the
form). Whether Turnstile's browser storage falls under the "strictly necessary" exception
of §25 TDDDG, or needs consent, is not settled by regulators — I found no authoritative
ruling (2026-10-09). Have the data-protection officer decide, or avoid the question with
a self-hosted check (e.g. a proof-of-work captcha such as Altcha — unverified here).
The honeypot and the signed time-trap are first-party form fields; they read and store
nothing on the device, so §25 TDDDG does not touch them.

## Rule: the handler rejects silently and politely
**Why:** Telling a bot why it was rejected teaches it; failing loudly on false positives
burns a human.
**How to apply:** honeypot filled or time-trap tripped → return the normal success
response, drop the record. Real validation errors (bad email syntax) → honest inline
error, the human can fix those.

## Rule: consent is captured with the lead, not implied
**Why:** The sender carries the burden of proof for consent (GDPR Art. 7(1)); in
Germany, marketing email also needs prior express consent (UWG §7(2) no. 3). A record you
can't produce is a consent you don't have. This file is engineering guidance, not legal
advice.
**How to apply:** unticked checkbox (pre-ticked is invalid consent), explicit text,
policy link. Store with the lead: consent boolean, timestamp, the policy/text version
shown. Double opt-in — store as unconfirmed, email a confirmation link, use the address
only after the click — is the accepted way to *prove* it in Germany. It is not a legal requirement and not
bulletproof: courts have doubted its evidentiary value (BGH I ZR 164/09, 2011, was a
telephone case; email courts split — verify current case law), so log the full trail:
form text shown, submit time, confirmation mail sent, click time.

## Rule: collect the minimum, leak nothing
**Why:** every extra field drops conversion and widens the PII surface.
**How to apply:** fields you will demonstrably act on (often just email). No third-party
scripts on the form page that can observe input (session replay off here). Success
redirects/analytics events carry no PII in URLs. Don't log raw submissions client-side.

## When to deviate
- **Single-field waitlists:** the checkbox can be replaced by unambiguous copy at the
  button ("Enter your email to join the launch list — one email at launch, no
  marketing") where the action itself is the consent for exactly that purpose. Keep
  double opt-in and the record anyway; the launch mail is the only mail you may send.
- **Existing customers:** UWG §7(3) allows email advertising for similar products to
  customers without consent, if you told them at collection and in every mail that they
  can object. That is a different flow from this skill; ask counsel before using it.
- **No third-party scripts allowed (strict privacy stance):** skip Turnstile; use the
  honeypot, signed time-trap, and rate limit, and accept some spam.
- **B2B with sales follow-up:** a different legal basis may apply (jurisdiction- and
  counsel-dependent); the engineering stays the same — record what was asked and when.
