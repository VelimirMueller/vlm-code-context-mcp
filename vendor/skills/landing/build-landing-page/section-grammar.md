# Section Grammar

Reference for `build-landing-page`. What each section is for, what it must contain, and
when to leave it out.

## Rule: the hero answers "what do I get and what do I do" in one screen
**Why:** Most visitors decide to stay or bounce on the hero alone; clarity beats
cleverness at that moment.
**How to apply:** `h1` states the *outcome* the visitor gets, not the product name
("Ship invoices that pay themselves" — not "InvoiceMax Pro"). One primary CTA above the
fold. A subline may add the mechanism. The hero visual is the LCP element and follows the
budget in the skill.

**Anti-example:** an `h1` that says the company name (it's already in the logo), three
equal-weight buttons, a stock photo carousel.

## Rule: social proof is real or absent
**Why:** Fake or vague proof ("trusted by thousands") reads as exactly that and poisons
the genuine claims around it.
**How to apply:** Real logos with permission, named testimonials with role/company,
specific numbers ("4 200 teams", "98 % on-time"). Nothing real yet? Omit the section —
an absent section is neutral; a hollow one is negative.

## Rule: problem/solution mirrors the pain before the turn
**Why:** A visitor who feels understood keeps reading; a solution pitched before the
problem reads as noise.
**How to apply:** State the problem in the visitor's own words (the phrasing they'd type
into a search box), then make the turn to your approach in one move. One problem, one
turn — a list of every pain you could solve dilutes all of them.

**Anti-example:** opening with the product's architecture ("our AI-powered platform
leverages…") before naming what hurts.

## Rule: features are written as benefits
**Why:** Visitors buy outcomes, not capabilities.
**How to apply:** Each item leads with what the visitor gets, then names the mechanism:
"Never chase a payment again — automatic reminders on your schedule." Three to six items;
more belongs on a separate page.

## Rule: pricing removes the price question or the section lies
**Why:** A pricing section that ends in "Contact us" for every tier answers nothing and
burns the scroll.
**How to apply:** Real numbers, or an honest "from X €/month". Mark one tier as
recommended. Pure sales-touch products skip the section and let the CTA be the contact.

## Rule: FAQ answers the objections the page created
**Why:** Every page raises unasked questions (lock-in? cancellation? data?); unanswered,
they exit. Bonus: real questions phrased as users ask them feed `FAQPage` schema and are
exactly what answer engines quote.
**How to apply:** 4–8 real questions in the user's words, each with a direct answer in
the first sentence. Real `<details>` or visible text — never content that only exists in
schema.

## Rule: the final CTA repeats the one action, adds nothing new
**Why:** A convinced visitor at the bottom of the page should not have to scroll back up,
and a new link there is an exit ramp.
**How to apply:** Restate the value in one line + the same primary CTA. No nav, no
alternative offers.

## When to deviate
- **Single-screen waitlist pages:** hero + capture form is the whole grammar; forcing
  more sections dilutes one job.
- **Long-form sales pages:** may repeat proof → objection → CTA cycles several times;
  the grammar still orders each cycle.
- **Section order:** problem-aware audiences can take problem/solution before proof;
  product-aware audiences may want pricing higher. The grammar is the default, not law.
