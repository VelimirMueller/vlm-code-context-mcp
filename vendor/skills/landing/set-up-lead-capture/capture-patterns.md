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

## Rule: the handler rejects silently and politely
**Why:** Telling a bot why it was rejected teaches it; failing loudly on false positives
burns a human.
**How to apply:** honeypot filled or time-trap tripped → return the normal success
response, drop the record. Real validation errors (bad email syntax) → honest inline
error, the human can fix those.

## Rule: consent is captured with the lead, not implied
**Why:** A marketing-consent record you can't prove is one you don't have (GDPR-land
practice; this file is engineering guidance, not legal advice).
**How to apply:** unticked checkbox (pre-ticked is invalid consent), explicit text,
policy link. Store with the lead: consent boolean, timestamp, the policy/text version
shown. Double opt-in — store as unconfirmed, email a confirmation link, use the address
only after the click — is the established way to *prove* it, and standard practice in
the EU.

## Rule: collect the minimum, leak nothing
**Why:** every extra field drops conversion and widens the PII surface.
**How to apply:** fields you will demonstrably act on (often just email). No third-party
scripts on the form page that can observe input (session replay off here). Success
redirects/analytics events carry no PII in URLs. Don't log raw submissions client-side.

## When to deviate
- **Single-field waitlists:** the consent checkbox can be replaced by unambiguous copy at
  the button ("Enter your email to join the launch list — one email at launch, no
  marketing") where the action itself is the consent for exactly that purpose.
- **B2B with sales follow-up:** a different legal basis may apply (jurisdiction- and
  counsel-dependent); the engineering stays the same — record what was asked and when.
