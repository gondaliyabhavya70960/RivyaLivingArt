---
doc: BUSINESS_RULES
status: CURRENT
owning_phase: 01
last_reviewed: 2026-09-07
owner_verification: NOT_REQUIRED
---

# BUSINESS RULES — what the business forbids

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Companion documents: `docs/project/PRD.md` (what the product is for),
> `docs/architecture/DATA_MODEL.md` (the tables and columns named here),
> `docs/architecture/ARCHITECTURE.md` (where each rule is enforced in the runtime),
> `docs/ops/SECURITY.md` (the security half of the same boundaries),
> `docs/content/CONTENT_GUIDE.md` (how copy is written within these rules).
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (*FEAT §n*) and
> `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (*SEED §n*).

**Implementation status.** No application code exists yet. Every "Enforced by" cell below names the
mechanism that must exist when the owning phase ships; until then the rule binds the design, and the
missing mechanism is a defect in that phase, not an option.

---

## 0. How to read this document

Every rule has an ID (`BR-<group><n>`), a statement written so it can fail, the mechanism that
enforces it, and the test that proves the mechanism works. A rule with no test is not a rule; it is
a preference.

| Layer | What it can enforce | Where it lives |
|---|---|---|
| **Schema** | The strongest: a forbidden state cannot be represented | `supabase/migrations/**` — constraints, triggers, absent tables |
| **RLS** | Role-level reachability, always on | `supabase/migrations/**` policies |
| **Type** | A bypass does not compile | `lib/**` signatures and discriminated unions |
| **Server guard** | Per-action permission and validation | `lib/auth/require.ts`, Zod schemas |
| **Build guard** | A forbidden pattern fails CI | `scripts/**` checks in `npm run check` |
| **Test** | Behaviour under real conditions | `tests/**` |
| **Review** | Human judgement, last resort | PR review against this document |

Prefer the highest layer that can hold the rule. A rule enforced only by review is recorded as such
and treated as a known weakness.

**Precedence.** These rules override every reference specification, every phase document and every
component library convention. Where a specification suggests something this document forbids, this
document wins and the divergence is recorded, not implemented.

---

## A. Commerce prohibitions — the three absolutes

These three cannot be relaxed by a pull request. They change only by a dated amendment to
`CANONICAL-DECISIONS.md`.

### BR-A1 — No online checkout

**Rule.** The site never takes an order. No cart, no basket, no checkout session, no order object,
no "buy now" affordance, no quantity that accumulates across pages, and no per-visitor persistence
of a selection.

| | |
|---|---|
| Enforced by | **Schema (by absence):** `carts`, `cart_items`, `checkout_sessions`, `orders`, `order_items` may not exist. **Build guard:** a check rejects those identifiers in `supabase/migrations/**` and `lib/**`. **Review:** no cookie or `localStorage` key may hold a selection |
| Test | `tests/integration/forbidden-tables.test.ts` asserts none of the five relations exists in `information_schema.tables`; `tests/e2e/no-commerce.spec.ts` asserts no public route sets a cart-shaped cookie or storage key |
| Note | `Place Order` is a **label** (SEED §31). It resolves to the inquiry flow. A label is not a transaction |

### BR-A2 — No payment gateway

**Rule.** No payment provider is integrated, referenced, configured or prepared for. No price is
ever collected, authorised or captured on any Rivya surface.

| | |
|---|---|
| Enforced by | **Schema (by absence):** `payments`, `transactions`, `refunds`. **Environment:** D8 contains no provider key; adding one requires an amendment. **Dependency:** no payment SDK in `package.json`. **Header:** `Permissions-Policy: payment=()` shipped permanently |
| Test | `tests/integration/forbidden-tables.test.ts`; `scripts/security/check-licenses.mjs` sibling check on dependency names; `tests/e2e/security-headers.spec.ts` asserts the `payment=()` directive |

### BR-A3 — No customer accounts

**Rule.** Supabase Auth exists for **staff only**. There is no self-registration path anywhere in
the application, no customer profile, no wishlist, no saved item, no order history, and no way for a
member of the public to read anything they submitted.

| | |
|---|---|
| Enforced by | **Platform:** public sign-up disabled in the Supabase project (a deploy checklist item). **Schema (by absence):** `customers`, `customer_profiles`, `addresses`, `wishlists`, `saved_items`, `saved_carts`. **RLS:** `inquiries` has *no* `select` policy for `anon` — insert only |
| Test | A sign-up attempt against the production project is rejected (deploy checklist step); `tests/unit/rls/inquiries.test.ts` asserts an `anon` client cannot `select` any inquiry, including one it just inserted |
| Note | A customer identity, if it ever existed, would be a separate Supabase role with its own policy family — never a new value in `user_role` |

---

## B. Conversion rules

### BR-B1 — An inquiry must persist before any WhatsApp redirect

**Rule.** The WhatsApp handoff is offered **only after** the `inquiries` row is committed. If the
write fails, the visitor stays on the page, sees the SEED §49 save-error copy, and no `wa.me` URL is
built, returned, rendered or navigated to.

| | |
|---|---|
| Enforced by | **Type:** `buildHandoffUrl({ inquiryId, … })` takes a required, non-optional `inquiryId`, so the bypass does not type-check. **Type:** `submitInquiry` returns `{ ok: true, referenceCode, whatsappUrl, attachments } \| { ok: false, code, fields? }`, which the caller must narrow. **Schema:** the row and its `inquiry_events(CREATED)` are written in one transaction by trigger; the attachments follow through `attach_inquiry_references()`, and a failure in them leaves the enquiry saved rather than rolling it back — losing a brief because an image could not be linked is the worse outcome |
| Test | **Built in Phase 20.** `tests/unit/inquiry-persistence.test.ts` forces the insert to throw and asserts the returned object has no `whatsappUrl` PROPERTY — not a null one, no such key — and that nothing downstream ran. `tests/e2e/inquiry-flow.spec.ts` (the phase document's name; the doc's earlier `inquiry-conversion.spec.ts` was never written) aborts the action's POST and asserts the browser never requests `wa.me` and never leaves the page |
| Severity | This is the single most important behavioural rule in the product. A regression here is a release blocker, not a bug ticket |

### BR-B2 — The handoff message contains only allowlisted tokens

**Rule.** The WhatsApp message is rendered from a `global_content` row in the `WHATSAPP_TEMPLATE`
group through a fixed token allowlist (SEED §36, §37). An unknown token throws. `ip_hash`,
`user_agent`, `utm`, `referrer`, `assigned_to`, internal notes and any staff-only field are
structurally unable to enter the message.

| | |
|---|---|
| Enforced by | **Type/Server guard:** the renderer accepts a typed value map, not the inquiry row; unknown keys throw. **Schema:** the template is data, editable at `Studio → System → Site Settings → WhatsApp` |
| Test | **Built in Phase 20.** `tests/unit/whatsapp-template.test.ts` (Phase 10) holds the allowlist in both directions: an unknown token in the TEMPLATE throws, and an unknown key in the VALUES throws — which is what makes `ip_hash` structurally unable to reach a message. `tests/unit/whatsapp-shorten.test.ts` exercises the five rungs one at a time, each by making the message too long in exactly one way, and asserts the reference code survives every one |

### BR-B3 — The public may write exactly one thing, and read none of it

**Rule.** `anon` may `insert` into `inquiries` and `inquiry_attachments` and may `select` nothing
from either. The insert policy pins `pipeline_status = 'NEW'`, `assigned_to is null` and
`updated_by is null`, so a crafted payload cannot open a triaged inquiry or assign itself to a staff
member.

| | |
|---|---|
| Enforced by | **RLS:** the RLS-INQUIRY profile |
| Test | `tests/unit/rls/inquiries.test.ts`: insert succeeds; `select` returns permission denied; an insert carrying `pipeline_status = 'WON'` or a non-null `assigned_to` is rejected by the `with check` |

### BR-B4 — Minimal collection, no tracking

**Rule.** The conversion path stores only what the enquirer typed plus a salted `ip_hash`. No raw
IP, no fingerprint, no third-party captcha, no cookie beyond the session, no cross-site identifier.

| | |
|---|---|
| Enforced by | **Schema:** `inquiries.ip_hash` is a hash column; there is no `ip` column. **Build guard:** `check-third-party.mjs` fails on any request to an origin outside `{self, res.cloudinary.com, *.supabase.co}` |
| Test | `tests/e2e/perf-no-third-party.spec.ts` asserts no third-party request and no cookie beyond the session on any public route |

### BR-B5 — Spam control is first-party and non-blocking

**Rule.** Abuse control is a honeypot field, a three-second minimum time-to-submit, and a per-IP cap
(5 submissions per 10 minutes). A rate-limited request returns 429 with `Retry-After` and renders
seeded copy — never a raw status page.

| | |
|---|---|
| Enforced by | **Server guard:** `lib/security/rate-limit.ts`† over `rate_limit_buckets`, called from inside `app/(site)/_actions/submit-inquiry.ts` **before** the Zod parse. Inquiry submission is a server action, not a route handler, so there is no `/api/inquiries` path for `proxy.ts` to match and the limiter returns a typed result the action turns into the SEED §49 form error |
| Test | Six submissions in ten minutes: the first five persist, the sixth returns 429 with `Retry-After` and writes a `SECURITY` system log |

† `lib/security/` is **not** one of the ten `lib/` domains D2 fixes, and it is not among the eight
`ARCHITECTURE.md` records as a pending amendment either — see §M open question 6. The rule binds
regardless of where the module finally lives; only the path is provisional.

---

## C. Price rules

### BR-C1 — Four price states, and each is only valid with its own data

**Rule.** A product's price display is one of four states. The columns that may accompany each are
fixed, and an incoherent combination cannot be stored.

| State | When it is allowed | Required columns | Forbidden columns | Public label vocabulary (SEED §30) |
|---|---|---|---|---|
| `FIXED` | The owner has entered a real, current, complete price for a specific piece | `price_minor > 0`, `currency` | `price_from_minor` | `Price` |
| `STARTING_FROM` | A configurable or made-to-order piece whose entry price the owner has confirmed | `price_from_minor > 0`, `currency` | `price_minor` | `From`, `Starting from` |
| `REQUEST_QUOTE` | The piece is quoted per project | — | `price_minor`, `price_from_minor`, `currency` | `Request a Quote` |
| `PRICE_ON_REQUEST` | The owner chooses not to display a price | — | `price_minor`, `price_from_minor`, `currency` | `Price on Request` |

**Enforced by — Schema.** `products_price_state_coherent`, verbatim in `DATA_MODEL.md` §products.
A quote-only product can never carry a number; a priced one must carry a currency.

**Test.** `tests/unit/rls/phase14.test.ts` attempts the invalid combinations against a real
PostgreSQL, as a merchandiser through RLS, and asserts the constraint rejects each;
`tests/unit/price-presenter.test.ts` covers every branch of `lib/catalog/price.ts`.

*(Phase 14 built these where the phase's own deliverable table put them. The paths this row
originally named — `tests/integration/publish-gates.test.ts`, `tests/unit/price-state.test.ts`,
`lib/catalog/price-state.ts` — were written before the phase and never existed; §M open question 6
about a pending `lib/catalog` domain is answered by `lib/catalog/{query,price,validation,labels,
rail,listing}.ts`.)*

### BR-C2 — Zero is never a price

**Rule.** A quote-only product is never represented as `0`, `null` rendered as free, `—` implying
free, or an empty price element. It renders its label from `global_content`.

| | |
|---|---|
| Enforced by | **Schema:** `price_minor > 0` and `price_from_minor > 0` in the coherence constraint; a quote-only row has both null. **Data quality:** FEAT §21 flags "quote-only represented as zero" as a validation error |
| Test | `tests/unit/price-presenter.test.ts` asserts the presenter for each state — including the case where a number has somehow reached a quote-only row, which returns no amount rather than passing it through. `tests/e2e/collection.spec.ts` asserts on the rendered page that a quote-only card contains not one digit |

### BR-C3 — Bespoke pricing is never calculated

**Rule.** No configurator, form field, option, step or bulk action may compute, estimate, multiply,
surcharge or display a derived price (FEAT §15). The output of a configuration is a *brief*, not a
quote.

| | |
|---|---|
| Enforced by | **Schema (by absence):** no price, cost, multiplier, surcharge, rate or fee column may exist on `customization_forms`, `customization_form_steps` or `customization_form_fields`. **Build guard/test:** `tests/unit/no-pricing.test.ts` greps that schema for price-shaped identifiers and fails on a hit |
| Test | `tests/unit/no-pricing.test.ts`; a review check that no configurator component imports a pricing helper |

### BR-C4 — Currency is explicit or absent

**Rule.** `currency` is ISO-4217 and is present exactly when a number is present. No default
currency is inferred from a locale, an IP, or a browser setting.

| | |
|---|---|
| Enforced by | **Schema:** the coherence constraint. **Review:** no geolocation of any kind exists in the product |
| Test | Covered by BR-C1's constraint test |

### BR-C5 — There is no price sort, and its absence is a decision

**Rule.** The catalogue listing offers three orderings — `curated`, `newest`, `title` — and will not
offer a fourth by price. `?sort=price` is dropped as unparseable and does not appear in the page's
canonical URL.

**Why.** Three of the four price states carry no number at all. An ordering across them would have
to invent a position for "Request a Quote" — before the cheapest piece, after the dearest, or
somewhere in the middle — and whatever it invented, a visitor would read as a statement about what
that piece costs. There is no honest answer, so there is no control. This is not a feature waiting
for a later phase: adding one requires a documented reversal of this rule, not a ticket.

**A related consequence, recorded so it is not rediscovered as a bug.** The facet counts beside each
filter are computed from the SAME query as the rows, with every active filter applied. A count is
therefore literally "how many of the products you are looking at are this", and an option that would
return nothing does not render at all. The rail narrows as filters are applied; the trade is that
swapping one value inside a dimension means clearing it first, and every ACTIVE value always renders
so clearing is always possible. The alternative — counting each dimension with its own filter
excluded — keeps every option visible at the cost of counts that do not describe the page they sit
beside, which is the kind of small dishonesty this document exists to refuse.

| | |
|---|---|
| Enforced by | **Code:** `lib/catalog/query.ts` parses `sort` against a closed union of three; an unknown value falls back to the default and is omitted from the canonical URL. **Content:** `content/seed/catalog-ui.ts` seeds three sort labels and no fourth |
| Test | `tests/unit/catalog-query.test.ts` asserts `?sort=price` is dropped from both the parsed query and the canonical URL; `tests/e2e/collection.spec.ts` asserts the same on the rendered page with JavaScript disabled |

---

## D. Content integrity

The governing rule is D10 / FEAT §38 / SEED §32 / SEED §55. It is expanded into rules that can each
fail on their own.

### BR-D1 — Never fabricate a business fact

**Rule.** The following may never be invented, seeded, generated, inferred, or written as
placeholder content — in the database, in a component, in a test fixture that could escape, in an
SEO description, in structured data, or in an alt text:

```
product names presented as inventory · prices · dimensions · materials · manufacturing methods
lead times · availability · delivered projects · named customers · testimonials · sales figures
years of experience · production capabilities · awards · certifications · durability claims
material performance claims · preservation-longevity claims · client logos · review counts
```

| | |
|---|---|
| Enforced by | **Schema:** `products`, `product_specs`, `portfolio_projects` and `testimonials` are **never seeded** — zero rows, always (SEED §32). **Schema:** `fact_classification` marks every content field; marketing language may not be stored as `PRODUCT_FACT` or `VERIFIED_BUSINESS_FACT`. **Review:** the release checklist reads every public page against SEED §55 |
| Test | `tests/integration/seed-idempotency.test.ts` asserts the seed run creates zero rows in `products`, `product_specs`, `portfolio_projects` and `testimonials`; `scripts/test/check-fixture-isolation.mjs` fails if a fixture product id, slug or title appears outside `tests/**` |

### BR-D2 — Anything asserting business capability is `OWNER_VERIFICATION_REQUIRED`

**Rule.** Brand and editorial copy may be written. A sentence that asserts what Rivya *can do*,
*has done*, or *will do* is seeded `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` and cannot
reach `status = 'PUBLISHED'` until the owner changes it to `VERIFIED`.

| | |
|---|---|
| Enforced by | **Schema:** every Tier-B content table carries `owner_verification`; a trigger makes `status = 'PUBLISHED'` unreachable while the value is `OWNER_VERIFICATION_REQUIRED`. **Server guard:** the publish action reports *why* it is blocked, naming the field |
| Test | `tests/integration/publish-gates.test.ts`: publishing a row with `OWNER_VERIFICATION_REQUIRED` is rejected by the database, not only by the UI |
| Backlog | The standing list is `PRD.md` §11; `scripts/ops/preflight.ts` prints every blocking row at release time |

### BR-D3 — Empty states, never invented content

**Rule.** When there is nothing to show, the surface shows the seeded empty state (SEED §27, §28,
§29). It never shows fabricated projects, placeholder products, sample testimonials, lorem ipsum, or
"Coming Soon" on a primary page.

| | |
|---|---|
| Enforced by | **Schema:** `merchandising_slots.fallback_mode` (`EDITORIAL_BLOCK · HIDE_SECTION · SHOW_EMPTY_STATE`) decides what an under-filled slot renders. **Content:** empty-state copy is seeded in `global_content` under `EMPTY_STATE` |
| Test | `tests/e2e/cms-workflow.spec.ts`: with zero published products, `/collection/[category]` and homepage Selected Works render the seeded empty state and **no** product card; a grep test asserts no "lorem ipsum" or "Coming Soon" string exists in `content/**` |

### BR-D4 — No marketing copy in JSX

**Rule.** A component never contains a headline, a paragraph, a label, a CTA or any sentence a
visitor reads. It renders `section.heading`, `section.body`, a `global_content` value or an entity
column (SEED §1, D2). Changing normal website copy must never require a code change.

| | |
|---|---|
| Enforced by | **Build guard:** the design-system check rejects prose literals in `components/**`; **Review:** a literal headline in a PR is a rejection, not a comment |
| Test | `tests/e2e/cms-workflow.spec.ts` edits a heading in the Studio and asserts the public route reflects it after revalidation, with no deploy |

### BR-D5 — A named person is never published without consent

**Rule.** A portfolio project, testimonial or case study that names a client, a person or a private
address may be published only when that person's consent is recorded as `GRANTED`, with a reference
saying where the consent is held.

**Withdrawal is immediate and is not a request.** Moving consent to `WITHDRAWN` archives the row on
the same statement — it does not raise, it does not wait for someone to unpublish, and it does not
depend on a deploy or a cache expiry. A person who asks not to be named stops being named.

**The two tables carry the rule through different columns**, and that is why it is enforced by two
functions rather than one: `portfolio_projects.client_display_name` / `client_consent` and
`testimonials.attributed_to` / `consent`. A shared plpgsql function referencing both compiles and
then fails at runtime with `record "new" has no field …` on the first write to whichever table it
was not written for — see `DATA_MODEL.md` §8.12.

**The consent state and the display name must agree even in draft.**
`portfolio_projects_consent_coherent` refuses to STORE a client name beside
`client_consent = 'NOT_APPLICABLE'`: that combination is a contradiction rather than a draft.

| | |
|---|---|
| Enforced by | **Schema:** `client_consent_state` enum on `portfolio_projects.client_consent` and `testimonials.consent`; the publish gates `enforce_project_evidence_gate()` and `enforce_testimonial_evidence_gate()` (`0150`), both BEFORE triggers so the withdrawal branch can rewrite `status`; the `portfolio_projects_consent_coherent` check constraint. **Server guard:** setting either consent to `GRANTED` requires `content.verify` (owner or admin) AND a non-empty consent reference; a publish attempt that fails a gate writes a `DENIED` audit row. **Type:** `lib/portfolio/gates.ts` names the unmet gate in the Studio before Publish is pressed |
| Test | `tests/unit/rls/phase17.test.ts` — an agreement test: for every combination of verification, name and consent it asks `lib/portfolio/gates.ts` whether the row may publish, asks the DATABASE to publish the same row, and requires the two answers to match; separately it asserts that withdrawing consent on a PUBLISHED, consented project archives it rather than being refused |

### BR-D6 — Content seeding is idempotent and never overwrites an owner

**Rule.** `content_seed_version = 'rivya-v1'`. The seed runner may insert a missing row and may
update a row it last wrote itself; it may **never** overwrite an owner-edited row, delete a row, or
change `status` on an existing row.

| | |
|---|---|
| Enforced by | **Data:** `seed_key`, `seed_content_hash`, `seed_last_applied_at`, `owner_edited`; the `set_owner_edited` trigger sets `owner_edited` whenever `updated_by` is non-null. **Runner:** the six-step algorithm in `DATA_MODEL.md` §1.6 |
| Test | `tests/integration/seed-idempotency.test.ts`: run → run again → zero changed rows; edit one row as a human → run → that row is reported `skipped_owner_edited` and is byte-identical afterwards |

### BR-D7 — Alt text is real text

**Rule.** Every bound media asset has meaningful alt text describing the visible image, or is
explicitly marked decorative. `image 1`, `hero`, `photo` and truncated prompt text are not alt text
(SEED §43).

| | |
|---|---|
| Enforced by | **Schema:** `check (is_decorative or (alt_text is not null and length(btrim(alt_text)) > 0))` |
| Test | `tests/unit/alt-text-coverage.test.ts`: every asset bound to a published surface has non-empty alt text or `is_decorative = true`; a database test asserts the constraint rejects an empty string |
| Note | The manifest's `alt_text_draft` values are truncated prompt text ending in an ellipsis. They satisfy the constraint but not the rule; rewriting them is Phase 43 work and is tracked as such |

### BR-D8 — No inference: nothing is computed, converted or estimated

**Rule.** A measurement, a material, a lead time or any other product fact is displayed exactly as
the owner entered it. Nothing on the site computes, converts, rounds, infers or defaults one. A
millimetre value is displayed in millimetres; there is no centimetre toggle, no inch conversion, no
derived volume, no computed seating capacity, no "approximately", no "typically".

**A null value produces no row.** Not an em dash, not `N/A`, not `TBD`, not "Contact us for
details" — each of those tells a visitor that a value exists and is being withheld, which is a claim
about the object nobody made. Zero rows means the whole specification block is ABSENT from the DOM,
not rendered empty with a heading over nothing.

**And nobody is pushed into inventing one to publish.** The Phase 15 readiness checklist makes
Specifications a required item, which would be an incentive to estimate a number if a spec row were
the only way to satisfy it. It is not: `products.specifications_omitted` records the owner's
deliberate decision that a piece publishes no specifications, and satisfies the item with no
measurement at all. **What is required is the decision, never the value.**

| | |
|---|---|
| Enforced by | **Schema:** `products_dimensions_shape` (DATA_MODEL §8.5) refuses any key outside the seven declared measurements, so `{"length_inches": 90}` cannot be stored and no renderer ever meets a unit it would have to convert. The unit is part of the key, and `product_specs.unit` is whatever the owner typed. **Code:** `ProductSpecifications` has no placeholder branch and no arithmetic in it at all — there is no prop to change and no fallback expression to edit. **Studio:** the Specifications tab offers no "not applicable" option, no converter and no estimate control; its helper string is "Leave a field blank to omit the row" |
| Test | `tests/unit/spec-rendering.test.tsx`: a null dimension key produces no row, an empty dimensions object means the block is absent rather than empty, 1800 mm never renders as 180 cm or 70.87 in, and no rendered value is `—`, `-`, `N/A` or `TBD`. `tests/unit/rls/phase15.test.ts` asserts the database refuses `{"length_inches": 90}`, a zero and a negative. `tests/e2e/product-detail.spec.ts` asserts no placeholder wording reaches the page |
| Note | The hyphen is checked per rendered VALUE rather than across the page, because it occurs legitimately inside ordinary copy — "Hand-rubbed oil" is a finish, not a placeholder |

---

### BR-D9 — A delivered project is not published until somebody says it happened

**Rule.** `portfolio_projects` and `testimonials` default to
`owner_verification = 'OWNER_VERIFICATION_REQUIRED'` — the INVERSE of every other content table,
which defaults to `NOT_REQUIRED` and flags the rows that make claims. A portfolio project IS a
claim, that Rivya delivered this; a testimonial IS a claim, that a named person said this. So the
safe default is that nobody has confirmed it, and the owner clears it per row.

**This is a separate gate from consent, and both apply.** Owner verification asks *did this
happen*; consent asks *may we say whose it was*. A project can be entirely real and still not
publishable under someone's name, and a consented quote from a real client is still not publishable
until somebody confirms they said it. Two columns, two refusals, two sentences in the Studio.

**Nothing seeds either table.** Neither is a member of the seed runner's `SeedableTable` union, so
a seed record targeting one does not compile. The archive is empty because no verified project
exists, which is the correct state of a studio that has not entered one — not a gap awaiting
content.

| | |
|---|---|
| Enforced by | **Schema:** the inverted `owner_verification` default on both tables; the same two gate functions as BR-D5. **Type:** `portfolio_projects` and `testimonials` are absent from `SeedableTable`. **Server guard:** `content.verify` — owner and admin only — is required to set `VERIFIED` |
| Test | `tests/unit/rls/phase17.test.ts` (the agreement test above covers verification as one of its axes); `tests/unit/portfolio-empty.test.ts` asserts that nothing seeds a project, a project photograph or a testimonial, and that the `/portfolio` empty state carries SEED §28's two lines verbatim with no "Coming Soon" anywhere |

### BR-D10 — What appears where is curated, never inferred, and an empty slot never fabricates

**Rule.** Which products, collections and articles appear on the homepage and in the store, in
what order, and when, is a decision a person makes in Studio → Merchandising — a slot with a
schedule — or nobody makes. When a slot resolves to fewer than its minimum, the surface shows its
fallback (editorial tiles, nothing, or the seeded empty-state sentence) and never a placeholder
card. No ordering is behavioural, popular, trending or inferred, because no analytics data exists
and manufacturing one would be an invented business fact (FEAT §28). No product slug is written in
code.

**Enforcement.** The five-step ladder in `lib/cms/merchandising.ts`, implemented once and returning
provenance (`CURATED` · `RULE_FILLED` · `FALLBACK`); `merchandising_slots_rule_named`, which refuses
`auto_fill` without a rule written in words, and the resolver's one rule, recency;
`guard_merchandising_entry()`, which refuses an entry of a type the slot does not admit, an entity
that does not exist, and a collection still in concept; `EditorialTile`, which has no field for a
price, a product link, a SKU or a dimension; the `/product/<slug>` literal rule in
`npm run cms:check-copy`; `tests/unit/merchandising-resolve.test.ts` (the ladder, and a fallback
with no product route and no price label), `tests/unit/merchandising-register.test.ts` (the eleven
slots level with migration `0200`; no behavioural word in the resolver) and
`tests/unit/rls/phase22.test.ts`.

**Provenance.** SEED §10-04 ("Do NOT hardcode products"), SEED §32, FEAT §17, FEAT §28, PHASE-16-22
§Phase 22, amendment A22.

### BR-D11 — No relation is invented, and no search result is

**Rule.** A relationship between two pieces of content exists because a person made it. Software may
PROPOSE a relationship where a reliable, stated rule exists (FEAT §11) — and there are exactly four
such rules — but nothing is written until an editor accepts, a dismissed proposal never returns, and
every persisted edge records whether a person made it (`origin = 'EDITOR'`) or agreed to it
(`origin = 'RULE_ACCEPTED'` with the `rule_key` that proposed it).

The same rule applies to search. A query that matches nothing renders the seeded SEED §26 sentence
and no suggestion of its own: a "did you mean" the software generated would be a product name nobody
at Rivya wrote. Results found by spelling similarity rather than by an exact match are grouped under
their own heading, so a near match is never presented as an exact one.

**Explicitly not rules**, each for a stated reason: view-count affinity (there is no view counter,
and FEAT §28 forbids manufacturing one); price-band affinity (most pieces carry no price at all, so
the band is absent for exactly the pieces it would matter for); title similarity (two names sharing
a word share nothing else); image similarity (Phase 33, and research-only even then); and anything
phrased "customers also viewed", which is false before the arithmetic starts because there are no
customer accounts (BR-A3).

| | |
|---|---|
| Enforced by | **Schema:** `origin relation_origin` with `*_rule_key_matches_origin`, which ties the key and the origin in both directions, so neither can exist without the other; `relation_suppressions` with a unique key on the (source, target, rule) triple. **Code:** `lib/relations/rules.ts` takes a client it only ever reads with, and writing lives in a different file behind a different permission. **Content:** the four rule reasons and the zero-result copy are seeded `global_content` rows, not sentences in the software |
| Test | `tests/unit/relation-rules.test.ts` asserts the module exports no function whose name suggests a mutation and that its source (comments stripped) contains no `.insert(`, `.update(`, `.upsert(`, `.delete(` or `.rpc(`; `tests/unit/relation-reciprocity.test.ts` covers the inverse mapping; `tests/e2e/search-public.spec.ts` asserts the seeded empty state renders with zero result cards beside it |

**Provenance.** FEAT §11, FEAT §19, SEED §26, D10, PHASE-23-30 §Phase 23.

## E. Media and asset rules

### BR-E1 — The asset-priority ladder is the default, not a suggestion

**Rule.** When a surface needs media, sources are considered in this order (D6, FEAT §33):

```
1. Verified real Rivya product media
2. Existing approved user-provided asset
3. Existing approved Higgsfield asset  ← the 250 in data/higgsfield/asset-manifest.json
4. Existing suitable Rivya project or render
5. A new Higgsfield generation
6. A temporary technical fallback, only if unavoidable
```

| | |
|---|---|
| Enforced by | **Data:** `media_assets.source` is the ladder as an enum (`REAL · USER_UPLOAD · HIGGSFIELD · RENDER · FALLBACK`). **Process:** a new generation requires a recorded gap — an asset request that steps 1–4 could not satisfy |
| Test | Review plus `HIGGSFIELD_ASSET_STATUS.md`: every new generation is listed with the gap it filled |

### BR-E2 — Nothing in the manifest is ever regenerated

**Rule.** An asset already listed in `data/higgsfield/asset-manifest.json` may not be regenerated,
re-prompted or replaced by a new generation. Regeneration is a defect, not a shortcut.

| | |
|---|---|
| Enforced by | **Schema:** `unique (higgsfield_generation_id) where higgsfield_generation_id is not null` makes a duplicate import detectable. **Build guard:** `manifest:verify` must remain byte-identical across a phase that does not deliberately extend the manifest |
| Test | `manifest:verify` in CI; a diff on `data/higgsfield/asset-manifest.json` requires a matching change to `docs/media/HIGGSFIELD_ASSET_STATUS.md` under the documentation contract |

### BR-E3 — Concept media is never presented as delivered work

**Rule.** All 250 manifest assets carry `is_ai_generated = true` and `is_concept = true`. Concept
media may illustrate material, mood, process and category — it may never be captioned, titled,
placed or implied as a photograph of a completed, delivered Rivya piece, and it may never be
attached to a product as product photography.

| | |
|---|---|
| Enforced by | **Schema:** both columns are `not null` on every row; a trigger blocks attaching a `is_concept = true` asset to a `products` media slot. **Studio:** the media drawer shows the concept badge and the seeded helper copy (SEED §40) |
| Test | `tests/unit/rls/phase14.test.ts` attempts to attach a concept asset to a product — by INSERT and by UPDATE — and asserts `product_media_reject_concept` refuses both, naming the asset; `tests/unit/catalog-validation.test.ts` asserts the same refusal at the application boundary, so an editor gets a sentence rather than an exception. Phase 14 also removed the concept flag from the Studio hero picker: the option is never offered, which is why the refusal should never be reached from the interface. The release checklist confirms no page presents concept media as delivered work |

### BR-E4 — Asset IDs come from two allocators and must not collide

**Rule.** `scripts/media/build-higgsfield-manifest.py` mints `<FAMILY>-<NNN>` for assets that exist.
Planned (GAP) assets use `<PAGE>-<SECTION>[-<KIND>]-<NNN>` and may **never** reuse a manifest family
prefix (D6, amendment A1).

| | |
|---|---|
| Enforced by | **Build guard:** `scripts/media/check-asset-ids.py`, run in CI and before any media migration |
| Test | The script's own fixture includes the three historical collisions and fails on them |

### BR-E5 — Desktop and mobile media are separate slots

**Rule.** `page_sections.media_desktop_id` and `media_mobile_id` are independent. A mobile crop is
never derived by CSS from a 21:9 desktop asset. Permitted ratios are exactly the eight in D6.

| | |
|---|---|
| Enforced by | **Schema:** two columns; `media_crops.aspect_ratio` check constraint holds the eight values |
| Test | Visual QA matrix at 430/390/360 asserts the mobile slot is used |

### BR-E6 — Deletion is blocked while an asset is in use

**Rule.** A media asset referenced by any `media_usages` row cannot be deleted, by anyone, including
`owner`.

| | |
|---|---|
| Enforced by | **Schema:** trigger on delete; **Permission:** `media.delete` is `owner`/`admin` only |
| Test | `tests/integration/rls-policies.test.ts` attempts a delete of a used asset and asserts refusal with the usage count |

---

### BR-E7 — A 3D model is supplied, never generated, and shows nothing it did not come with

**Rule.** A `MODEL_3D` asset arrives only by upload from the owner's side; no phase generates,
sources or approximates one, because a model has a form and dimensions and those are product
specifications (BR-D1). The viewer shows what the file carries and what the owner entered — and
nothing derived: dimension indicators render `products.dimensions` only, never a bounding box; a
finish label is words matched to the file's `KHR_materials_variants` key, and the material it may
name reaches a visitor only once the owner has marked the label `VERIFIED`; a concept model
carries the concept notice in the viewer chrome. A model may not be shown on any page without a
poster, and the poster is a photograph chosen from the library, never a frame captured from the
viewer (BR-E3).

**Enforcement.** Schema: `media_assets_model_poster_before_association`,
`model_variant_labels_material_needs_verification`, `guard_model_still_references()`,
`enforce_verification_authority()` on `model_variant_labels` (migration `0194`). Code:
`publicVariantLabels()` strips the material below `VERIFIED`; `DimensionOverlay` can only receive
values the server parsed from `products.dimensions` and imports no engine — asserted on the source
by `tests/unit/model-policy.test.ts`. Content: the manifest holds no model and `assert-no-regen`
guards the manifest. Process: the inspector writes format, size, triangles and textures from the
file; nothing lets a person type them.

**Tested by.** `tests/unit/model-policy.test.ts`, `tests/unit/model-inspect.test.ts`,
`tests/unit/rls/phase21.test.ts`, `tests/e2e/model-viewer.spec.ts`.

---

## F. Research (scraped) data rules

The research subsystem exists to inform decisions. Its output is evidence, never inventory.
`SCRAPER.md` owns the mechanics; these are the rules that bound it.

### BR-F1 — Research data is never published

**Rule.** No `research_*` row, field, image URL, title, description, price or snapshot may appear on
any public route, in any public API response, in any sitemap, in any structured data, or in any
public search result.

| | |
|---|---|
| Enforced by | **RLS:** every `research_*` table is RLS-RESEARCH — *no `anon` policy, ever*. **Build guard:** `check-research-isolation.mjs` fails the build if an `anon` policy is added; `check-data-layer.mjs` fails if anything under `app/(site)/**` references a `research_` identifier |
| Test | `tests/unit/rls/research.test.ts`: an `anon` client selecting any `research_*` table returns permission denied; a build with a deliberately added public policy fails |

### BR-F2 — Research data is never auto-imported

**Rule.** No change, no score, no similarity match and no schedule may create, update or publish a
Rivya `products` row. The only path from research to catalogue is a human confirmation
(`research.confirm`), after which a person enters the product.

| | |
|---|---|
| Enforced by | **Schema:** `research_confirmations.created_product_id` is an opaque uuid with **no foreign key**, so the graph cannot be walked. Every foreign key from a `research_*` table into `public` is allowlisted **by constraint name** in `scripts/research/check-research-isolation.mjs`, and the allowlist is the single source of truth for what may cross — the count below is a consequence of that list, never a separate constant. **Permission:** `research.confirm` is held by `owner`, `admin`, `merchandiser` — not by `researcher` |
| The allowlist | Two entries, both to `categories`, both written or configured by a member of staff rather than scraped. Neither points at `products`, and no `anon` role can read either side |
| Test | `tests/integration/rls-policies.test.ts` reads `information_schema.referential_constraints` and asserts the research→public FK inventory **equals** the allowlist — a missing entry fails as loudly as an extra one; a schema test asserts no FK from any `research_*` table to `products` |

| # | Constraint | Column | References | Added by | Why it is permitted |
|---|---|---|---|---|---|
| 1 | `research_source_category_map_category_id_fkey` | `research_source_category_map.category_id` | `categories (on delete set null)` | Phase 26 | A category mapping is configuration typed by staff. It points at taxonomy, not at `products` |
| 2 | `research_products_matched_category_id_fkey` | `research_products.matched_category_id` | `categories (on delete set null)` | Phase 28 | The result of applying that human-authored map |

**Known divergence — the schema register says three, and this rule says two.** The number is
load-bearing because the test above is an equality assertion, so the two documents cannot both be
built. `DATA_MODEL.md` §1.1 rule 7 and §11 state *three* allowlisted references, naming
`research_direction_briefs.target_category_id` as the third. Every document that owns the schema it
describes states *two*: `PHASE-23-30.md` (which owns Phases 26 and 28, and states "there is never a
third"), `SCRAPER.md` §13.2, and — decisively — `PHASE-31-38.md`, which owns Phase 34 and specifies
that table's column as `target_category_slug text` with a `check` constraint against D3's seven
slugs and **no foreign key at all**, together with a verification step that temporarily converting it
to `target_category_id uuid references categories(id)` must make the isolation guard *fail*. This
rule therefore follows the three documents that specify the migrations and the subsystem, not the one
that summarises them. `DATA_MODEL.md` §11 is the row to correct, and until it is, §M open question 7 records the
contradiction rather than leaving an engineer to discover it when the equality assertion breaks.
Adding a third entry — here, in `SECURITY.md` T5 and in the guard's allowlist — is a BR-K1
amendment, not a pull request.

**A RIVYA PRODUCT IS CREATED ONLY BY AN OWNER TYPING ONE, OR BY THE PHASE 24 APPROVED-IMPORT PATH,
AND NEITHER READS A RESEARCH TABLE.** That is the whole rule in one quotable sentence, and it exists
in this form because a sentence is what gets repeated in a meeting. Phase 29 added the fourth
guarantee behind it: `scripts/research/check-no-autoimport.mjs` fails the build if any module under
`lib/scraper/`, `lib/supabase/repositories/research/`, `app/(studio)/studio/(shell)/research/` or
`scripts/research/` writes `products`, `product_media`, `product_specs`, `product_materials`,
`media_assets`, `collections` or `product_collections` — or imports a first-party WRITE from
anywhere. It permits a first-party READ, because the taxonomy crossing above is by design and a
guard that refused it would be refusing the design.

**PHASE 35 — THE ONE BRIDGE, AND EXACTLY WHAT IT WRITES.** `startProductFromConfirmation`
(`app/(studio)/studio/(shell)/research/confirmed/actions.ts`) is the only symbol in the repository
that writes `products` while importing a research repository. It reads
`getConfirmationForBridge(id) → { id, stage, archived_at }` — a `.strict()` projection with no
competitor text in scope — and, given a `CONFIRMED` row with a live decision, `catalog.write`, the
`research_product_bridge` flag, a slug the person typed, a category they chose and the seeded
acknowledgement ticked, inserts **exactly** these five fields and nothing else:

| Field | Value |
|---|---|
| `slug` | typed by the person |
| `title` | the slug's title case — a placeholder the owner replaces |
| `category_id` | chosen by the person |
| `status` | `DRAFT` |
| `price_state` | `PRICE_ON_REQUEST` |

No title, description, price, currency, dimension, material, availability, lead time or image
crosses that line, in any code path, ever; there is no "import fields" option to disable. Proof:
`lib/scraper/workflows/bridge-draft.ts` is the builder; `tests/unit/confirmation-no-import.test.ts`
and `tests/unit/rls/phase35.test.ts` put a research row of sentinels through the projection and the
insert and find none in any column of `products`, `product_media`, `product_materials` or
`product_collections`. The I4 carve-out is one symbol in one file with one permitted reader,
encoded in `scripts/research/bridge-isolation.mjs` under `check-research-isolation.mjs` and proved
to fail on a second writer, a moved symbol and a wider projection (amendment A35, proposed). **The
flag ships `false`**: the bridge is inert until the owner accepts the amendment by enabling it.

**`CONFIRMED` MEANS "CONFIRMED AS A RESEARCH REFERENCE" AND NOTHING ELSE.** It creates no product,
no draft product, no media row and no CMS content. The Studio confirm dialog says so in seeded copy
(`studio.research.confirmMeaning`), because the failure this guards against is not a developer
adding an import — it is somebody reading a screen full of "confirmed" competitor rows and
concluding, six months later, that the catalogue must have been approved from them.

### BR-F2b — Placeholder content is marked, listed and removable

**Rule.** Content written to make the site demonstrable before the real catalogue exists carries
`is_demo`, is listed in `docs/content/DEMO_CONTENT.md`, and is removed in one command. Adding
placeholder rows is authorised; adding **unmarked** placeholder rows is not.

Permission to write a placeholder **does not suspend BR-D1**. A fabricated price is a fabricated
price whether or not `is_demo` sits beside it — the column records what a row *is*, not what it may
*claim*. So no demo row states a price, a dimension, a material, a specification, stock, a lead
time, an award, a certification or a durability claim, and no demo testimonial is attributed to a
person.

| | |
|---|---|
| Enforced by | **Schema:** `is_demo boolean not null default false` on `products`, `pages`, `page_sections`, `journal_articles`, `portfolio_projects`, `testimonials` (migration `0180`). **Tooling:** `npm run demo:seed` writes only marked rows; `npm run demo:purge` deletes every row carrying the column and reverses the two edits the seeder makes to rows it does not own. **Register:** `npm run demo:check-register` regenerates `DEMO_CONTENT.md` from the modules and fails the build on a diff |
| Test | `tests/unit/demo-content.test.ts` greps the demo modules for money, measurements, lead times, awards and guarantees, and asserts every testimonial attribution and project location is explicitly a placeholder |
| Not a visibility rule | No policy tests `is_demo`. A demo product is published and rendered exactly like a real one, because a placeholder catalogue that behaved differently would tell the owner nothing about the site they are evaluating. What the column buys is a badge in Studio and a purge that cannot miss |
| Two kinds of row cannot be published at all | `portfolio_projects` and `testimonials` each carry an evidence gate refusing PUBLISHED without the owner's verification or the subject's consent. A script cannot grant itself either, and does not try: the demo rows exist so the Studio screens have something to work against |
| No photographs | All 250 library assets carry `is_concept`, and `products_reject_concept_hero` (Phase 14) refuses a concept render as a product's hero. Demo products have no imagery, and real photography is the one thing a placeholder cannot stand in for |

**It is not `content/seed/**`, and must never move there.** `SeedableTable` deliberately has no
`products` member — SEED §32 forbids seeded inventory and the type is the enforcement. The
authorisation covers a separate, separately-named, reversible tool; it does not reopen that rule.

---

### BR-F4b — Nothing calculates a bespoke price

**Rule.** No column, no field, no validation key and no rendered surface in the customization
system may hold, derive or display a price, cost, surcharge, multiplier, estimate or quote. FEAT §15
says it in as many words — *do not calculate fake bespoke pricing* — and D1 forbids checkout
outright. Price vocabulary on the site is the seeded SEED §30 set — `Request a Quote`,
`Starting from`, `Price on Request` — rendered by the product surfaces and never by the
configurator.

The risk this guards is not that somebody puts a price on the public form; nobody would. It is that
somebody adds `price_modifier` to a field "just for internal estimating", and six months later a
summary renders it.

| | |
|---|---|
| Enforced by | **Schema:** no price column exists on any `customization_*` table, and `customization_form_fields.validation` is constrained to a fixed allowlist of Zod keys — `min`, `max`, `step`, `minLength`, `maxLength`, `pattern`, `accept`, `maxFiles`, `maxBytes` — so a surcharge cannot arrive dressed as validation. **Type:** `form_field_type` has fourteen members and none is a currency input |
| Test | `tests/unit/no-pricing.test.ts` greps migration `0170`, `lib/cms/forms.ts` and `components/patterns/Configurator/**` for price-shaped identifiers and fails on a hit |
| The review screen | Lists every answer given and no total. There is nothing to compute one from, because no field carries a number that means money |

---

### BR-F3 — Research data is never publicly searchable

**Rule.** `search_documents` (public) and `research_search_documents` (staff) are two indexes with
one boundary. Public search covers products, categories, collections, portfolio and journal only.

| | |
|---|---|
| Enforced by | **Schema:** two tables with disjoint `entity_type` check constraints; `research_search_documents` is RLS-RESEARCH with no `anon` policy. **Build guard:** `check-data-layer.mjs` |
| Test | `tests/e2e/search-public.spec.ts` asserts a term present only in research data returns no public result |

### BR-F4 — No competitor image is downloaded, re-hosted or displayed publicly

**Rule.** `research_products.image_urls` holds **URLs only**. No research image is fetched into
Cloudinary, into Supabase Storage, or into `media_assets`. Studio views proxy or link; the public
site never renders one.

| | |
|---|---|
| Enforced by | **Schema:** no `research_product_images` table exists; `research_image_extraction_mode` has no value that downloads (`NONE · URL_ONLY · URL_AND_DIMENSIONS`) |
| Test | `tests/integration/forbidden-tables.test.ts`; a network assertion in the scraper suite that no image byte is fetched during a run |

### BR-F6 — A direction brief has no path to the catalogue

**Rule.** A Phase 34 direction brief is an internal research document. It cannot be published
(`PUBLISHED` is refused by check constraint and by the Zod schema), it carries no Rivya price,
dimension, material, lead time or tolerance (there is no column for one), and it cannot become a
product: no module may import both the direction repository and the products repository, and the
build fails on one (`scripts/research/direction-isolation.mjs`, under I4). `APPROVED` means a named
person agreed the direction is worth exploring, at a time; it is not a capability claim, and whether
Rivya can make anything a brief describes is `OWNER_VERIFICATION_REQUIRED`.

**Why.** The button that "creates the product from the brief" is the obvious feature, and it is the
one that turns competitor research into catalogue content with nobody having typed it (BR-F2). A
brief is what a maker reads before sketching; product creation is a Phase 35 act, taken by hand.

**Observed is not intended.** Figures copied from research render with their coverage and the words
"observed in competitor research", on screen and in print. Competitor prose is never pasted into a
brief's sections, and no competitor image is attached; mood reference is Rivya concept media only.

### BR-F5 — Scraped is not trusted

**Rule.** The pipeline `RAW → NORMALIZED → VALIDATED → MATCHED → REVIEW → SHORTLISTED → CONFIRMED`
is not a formality. A row before `CONFIRMED` is a lead, not a fact, and no analytics surface may
present research figures as Rivya figures.

| | |
|---|---|
| Enforced by | **Schema:** `research_stage` and a separate `research_disposition` (rejection is a disposition, not a stage). **UI:** research analytics are labelled as competitive, with explicit coverage statements (FEAT §28) |
| Test | `tests/e2e/research-run-lifecycle.spec.ts` walks the stages; a review check that no first-party dashboard card sources a `research_*` table |

### BR-F6 — Source conduct is bounded and reviewable

**Rule.** Every source carries a rate limit, a request delay, a concurrency cap, a `robots`
decision, and a policy-review status (`UNREVIEWED · APPROVED · RESTRICTED · BLOCKED`). A source that
is `UNREVIEWED` or `BLOCKED` cannot run. A broken adapter fails alone; five consecutive failures
open a circuit breaker.

| | |
|---|---|
| Enforced by | **Server guard:** the run planner refuses a source whose policy status is not `APPROVED`; `research_fetches.robots_decision` records the decision per fetch |
| Test | `tests/e2e/research-run-lifecycle.spec.ts`: a `BLOCKED` source cannot be run from the UI or the API; a failing adapter does not fail its siblings |

### BR-F7 — Snapshots are evidence, and private

**Rule.** HTML snapshots live in a private Supabase Storage bucket outside the media seam, are never
publicly deliverable, and are retained 180 days.

| | |
|---|---|
| Enforced by | **Storage:** private bucket, signed short-lived access for staff only; not routed through `MediaProvider` |
| Test | An unauthenticated request for a snapshot object is refused |

---

## G. Roles and permissions

### BR-G1 — One role per user, six roles, no ad-hoc grants

**Rule.** `staff_profiles.role` holds exactly one of `owner · admin · editor · merchandiser ·
researcher · viewer`. There are no per-record permissions, no group memberships and no ad-hoc
grants. `system.owner.transfer` is held by `owner` alone and by no other role, ever.

**The matrix** (source of truth: `lib/auth/permissions.ts`, generated into SQL by
`scripts/auth/gen-role-sql.ts` with a CI drift check):

| Permission | owner | admin | editor | merchandiser | researcher | viewer |
|---|---|---|---|---|---|---|
| `catalog.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `catalog.write` | ✓ | ✓ | — | ✓ | — | — |
| `catalog.publish` | ✓ | ✓ | — | ✓ | — | — |
| `content.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `content.write` | ✓ | ✓ | ✓ | — | — | — |
| `content.publish` | ✓ | ✓ | ✓ | — | — | — |
| `media.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `media.write` | ✓ | ✓ | ✓ | ✓ | — | — |
| `media.delete` | ✓ | ✓ | — | — | — | — |
| `merchandising.write` | ✓ | ✓ | — | ✓ | — | — |
| `inquiries.read` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `inquiries.write` | ✓ | ✓ | — | ✓ | — | — |
| `inquiries.export` | ✓ | ✓ | — | ✓ | — | — |
| `research.read` | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| `research.write` | ✓ | ✓ | — | — | ✓ | — |
| `research.confirm` | ✓ | ✓ | — | ✓ | — | — |
| `analytics.read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `bulk.execute` | ✓ | ✓ | — | ✓ | — | — |
| `destructive.execute` | ✓ | ✓ | — | — | — | — |
| `operations.audit.read` | ✓ | ✓ | — | — | — | — |
| `operations.logs.read` | ✓ | ✓ | — | — | — | — |
| `system.settings.write` | ✓ | ✓ | — | — | — | — |
| `system.flags.write` | ✓ | ✓ | — | — | — | — |
| `system.users.manage` | ✓ | ✓ | — | — | — | — |
| `system.owner.transfer` | ✓ | — | — | — | — | — |

**The matrix is a spine, not a closed set.** Phase 04 creates the rows above; a later phase may
append a permission, and when it does it back-writes the row into `PHASE-00-04.md` and into
`lib/auth/permissions.ts` in the same PR. The additions currently planned:

| Permission | Added by | owner | admin | editor | merchandiser | researcher | viewer |
|---|---|---|---|---|---|---|---|
| `research.score.manage` | 32 | ✓ | ✓ | — | — | — | — |
| `research.similarity.run` | 33 | ✓ | ✓ | — | — | ✓ | — |
| `research.direction.write` | 34 | ✓ | ✓ | — | ✓ | ✓ | — |
| `research.direction.approve` | 34 | ✓ | ✓ | — | ✓ | — | — |
| `integrations.sheets.manage` | 36 | ✓ | ✓ | — | — | — | — |
| `integrations.sheets.run` | 36 | ✓ | ✓ | — | ✓ | ✓ | — |
| `system.environment.read` | 38 | ✓ | ✓ | — | — | — | — |
| `system.docs.read` | 38 | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `operations.logs.export` | 38 | ✓ | ✓ | — | — | — | — |

A role not listed in a row holds that permission not at all. There is exactly one source of truth —
`lib/auth/permissions.ts` — and `scripts/auth/gen-role-sql.ts` generates the SQL from it with a CI
drift check, so no permission can exist in the database that the type system does not know about, or
the reverse.

| | |
|---|---|
| Enforced by | **RLS** (coarse, role-level, in the database) **and** `requirePermission()` (fine, per action, in the server). `proxy.ts` redirects; it never authorises |
| Test | `tests/unit/rls/*.test.ts` — one authenticated client per role asserting allow/deny per table; `tests/e2e/studio-authz.spec.ts` — as `viewer`, direct POSTs to publish, bulk-apply, media-delete and role-change all return 403; a drift test asserts the generated SQL and the TypeScript union name the same permission set |

### BR-G2 — Every Studio page and every mutation re-checks server-side

**Rule.** Navigation visibility is a convenience, never a control. Each page resolves the session and
calls the permission helper before rendering; each server action does the same before working.

| | |
|---|---|
| Enforced by | **Build guard:** `scripts/security/check-action-guards.mjs` asserts every exported server action calls the permission helper |
| Test | `tests/e2e/studio-authz.spec.ts` requests a forbidden page directly by URL and asserts a 403/redirect plus an `audit_logs` row with `result = 'DENIED'` |

### BR-G3 — Staff are invited, never self-registered

**Rule.** New staff arrive by invitation from `/studio/system/users`. Role elevation is an explicit,
audited action. A newly provisioned profile defaults to `viewer` / `INVITED`.

| | |
|---|---|
| Enforced by | **Platform:** public sign-up disabled. **Schema:** provisioning trigger defaults; **Permission:** `system.users.manage` |
| Test | A sign-up attempt is rejected; a role change writes an `audit_logs` row naming the before and after role |

### BR-G4 — Destructive actions are confirmed, snapshotted and undoable

**Rule.** A destructive or bulk action requires `ConfirmDialog` with a typed row count, records a
per-item snapshot, and offers a 24-hour undo (FEAT §20). Re-authentication is required if the
session is older than 30 minutes.

| | |
|---|---|
| Enforced by | **Server guard:** `destructive.execute` / `bulk.execute`; `bulk_operations` + `bulk_operation_items` carry the snapshots; `revoke delete` on both |
| Test | `tests/e2e/bulk.spec.ts`: a bulk unpublish previews the exact count, applies, and is undone within the window to the byte |

### BR-G5 — Every privileged mutation and every denial is a record

**Rule.** `audit_logs` receives a row on success **and** on denial, with actor, role snapshot, action,
entity, redacted before/after, result, request id. It is append-only: `revoke update, delete`.

| | |
|---|---|
| Enforced by | **Schema:** append-only; **Server guard:** `withAudit()` wrapper; **Redaction:** every blob passes `lib/logging/redact.ts` |
| Test | `tests/unit/redact.test.ts` and `tests/e2e/studio-authz.spec.ts` (a denial produces a `DENIED` row) |

---

## H. Owner verification

### BR-H1 — Three states, one gate

`owner_verification` is `NOT_REQUIRED · OWNER_VERIFICATION_REQUIRED · VERIFIED`. Publication is
impossible while the value is `OWNER_VERIFICATION_REQUIRED` — enforced by trigger and constraint,
not by the interface.

### BR-H2 — What requires owner verification

| Class | Examples | Default state |
|---|---|---|
| Production capability | 3D/digital fabrication, commercial tables, sculptural seating, architectural work, preservation compatibility | `OWNER_VERIFICATION_REQUIRED` |
| Process claims | The five- and seven-step process statements (SEED §10, §16) | `OWNER_VERIFICATION_REQUIRED` |
| Availability and edition claims | Custom sizing, one-of-one, limited edition, lead times | `OWNER_VERIFICATION_REQUIRED` |
| Legal and identity | Legal entity, jurisdiction, controller, statutory basis, accessibility statement | `OWNER_VERIFICATION_REQUIRED`; `/privacy` and `/terms` stay `DRAFT` |
| Contact of record | Production WhatsApp number, phone, email, map location | `OWNER_VERIFICATION_REQUIRED` |
| Delivered work | Any portfolio project, client name, testimonial | `OWNER_VERIFICATION_REQUIRED` + consent |
| Operational settings the owner owns | MFA policy, Supabase PITR window, Cloudinary backup retention, domain and DNS, deployment region assumption, cookie-banner necessity, newsletter existence | `OWNER_VERIFICATION_REQUIRED`, recorded in the ops docs |
| Pure brand and editorial voice | Mood, material description, invitation to enquire | `NOT_REQUIRED` |

### BR-H3 — Verification is an act, not a default

**Rule.** Only a human may move a row to `VERIFIED`, and the transition is audited. No script, seed
run, import or migration may set it.

**The permission is `content.verify`, which is OWNER AND ADMIN ONLY — narrower than
`content.publish`.** An earlier version of this rule said `content.publish`, which also admits
`editor`. That was wrong for the case the rule exists for: confirming that Rivya delivered a
project, or that a named person really said something, is a claim made on the business's own
behalf, and an editor may not make it. Publishing and verifying are separate permissions precisely
so that an editor can prepare a page they cannot vouch for.

| | |
|---|---|
| Enforced by | **Schema:** the seed runner never changes `owner_verification` or `status` on an existing row (BR-D6); **Audit:** the transition writes an `audit_logs` row |
| Test | `tests/integration/seed-idempotency.test.ts` asserts the runner leaves both columns untouched; an audit assertion covers the transition |

---

## I. Data protection and retention

### BR-I1 — Personal data lives in exactly one place

**Rule.** The only personal data in the system is in `inquiries` and `inquiry_attachments`: name,
phone, optional email, city, message, configurator answers and uploaded reference files. It may
never appear in `search_documents`, `web_vitals_samples`, `audit_logs` blobs, `system_logs`, a
WhatsApp URL beyond what the enquirer typed, or a screenshot from a lower environment.

| | |
|---|---|
| Enforced by | **Schema:** the `search_documents` writer excludes inquiry personal fields; the vitals payload schema rejects any extra key; the redactor covers audit blobs |
| Test | `tests/unit/pii-scope.test.ts` asserts no inquiry personal field reaches any index, sample or log |

### BR-I2 — Retention is stated, not assumed

| Data | Retention | Purged by |
|---|---|---|
| `inquiries` personal fields | 24 months from last activity, then anonymised (contact fields nulled, row kept for counts) | `scripts/ops/anonymise-inquiries.ts`, dry-runnable |
| `inquiry_attachments` orphans | 30 days | Retention cron |
| `system_logs` `INFO`/`WARNING` | 90 days | Daily cron |
| `system_logs` `ERROR`/`SECURITY` | 400 days | Daily cron |
| `web_vitals_samples` | 90 days | Daily cron |
| `search_queries` | 90 days | Daily cron |
| `rate_limit_buckets` | 7 days | Daily cron |
| Research snapshots | 180 days | Retention job |
| `audit_logs`, `activity_events`, `content_revisions` | Not yet fixed — see §K open question 3 | — |

### BR-I3 — Production data never travels downward

**Rule.** No copy of production data may be placed in a preview or development environment. Lower
environments are seeded from the deterministic test fixture.

| | |
|---|---|
| Enforced by | **Process:** stated in `DEPLOYMENT.md`; **Guard:** `scripts/ops/check-env.ts` fails a build whose preview points at the production Supabase project |
| Test | A deliberate misconfiguration fails the build, naming the mismatch |

### BR-I4 — The enquirer can be answered

**Rule.** An owner-only Studio action exports or erases one enquirer's data on request. Erasure
anonymises rather than deletes, so counts and history survive.

| | |
|---|---|
| Enforced by | **Permission:** `owner` only; **Audit:** the action is logged |
| Test | `tests/unit/pii-scope.test.ts` plus a Studio e2e covering export and erase |

---

## J. Secrets and exposure

### BR-J1 — The never-expose list

`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `REVALIDATE_SECRET` must never reach
a client bundle, a client-visible response, a log line, an error message, a Studio screen, a
screenshot, or the Environment page. **Not the value, not a prefix, not a length, not a hash** (D8).

| | |
|---|---|
| Enforced by | Four independent layers: `import 'server-only'`; `scripts/security/check-secret-exposure.mjs` over the built output; `lib/logging/redact.ts` on every log, audit blob and error path; `gitleaks` in CI |
| Test | Each guard ships with a seeded counter-example that must fail the guard; `tests/e2e/deploy-smoke.spec.ts` scrapes the rendered Environment page for every server-only name and any value-shaped string |
| Detail | `docs/ops/SECURITY.md` §5 and `docs/ops/ENVIRONMENT.md` §2 |

### BR-J2 — The Environment page reports reachability only

**Rule.** `/studio/system/environment` shows booleans, statuses, latencies, counts, identifiers
(commit SHA, branch, migration version) and nothing else. `configured` is computed from the
**presence of the variable name**, never from its content.

| | |
|---|---|
| Enforced by | **Server guard:** each check returns the fixed shape `{ id, configured, status, latency_ms, checked_at, code }`; upstream messages are mapped to a fixed code enum and never rendered |
| Test | `tests/unit/env-checks-no-secrets.test.ts`; `tests/e2e/deploy-smoke.spec.ts` |

### BR-J3 — The documentation browser serves a fixed allowlist

**Rule.** `/studio/system/documentation` serves exactly ten paths, redacted at build time, rendered
without raw HTML. It can never be pointed at `.env`, a migration, `docs/requirements/**`,
`SECURITY.md`, `SESSION-STATE.md` or any path outside the allowlist. A request names an allowlist
**key**; an unknown key is `notFound()`.

| | |
|---|---|
| Enforced by | **Build step:** `npm run docs:index` reads the allowlist and writes a generated JSON index; no filesystem path parameter exists |
| Test | `tests/unit/docs-allowlist.test.ts`: an unknown key 404s; a traversal attempt is not even representable |

---

## K. Change control

### BR-K1 — The canonical decisions change by amendment only

Never edit a D-section in place. Append a dated entry under *Amendments* stating what changed, why,
which phases are affected, and which documents were updated in the same PR.

### BR-K2 — Requirements are specifications of record

`docs/requirements/**` is read-only history. A PR that modifies it is rejected by
`scripts/docs/check-doc-contract.mjs`. Decisions that supersede a requirement are recorded as
amendments.

### BR-K3 — Documentation moves with the code

The path-to-document contract in `ARCHITECTURE.md` §12 is enforced in CI. A migration without a
`DATA_MODEL.md` change, or an `lib/auth/**` change without a `SECURITY.md` change, does not merge.

### BR-K4 — A rule may not be weakened silently

Relaxing any rule in this document requires: the amendment (BR-K1), the removal or modification of
its enforcing mechanism in the same PR, and a note in `CHANGELOG.md`. Deleting a test that proves a
rule, without deleting the rule, is a rejection.

---

## L. Rule index

| ID | Rule | Strongest enforcement layer |
|---|---|---|
| BR-A1 | No online checkout | Schema (absence) + build guard |
| BR-A2 | No payment gateway | Schema (absence) + dependency + header |
| BR-A3 | No customer accounts | Platform + RLS |
| BR-B1 | Persist before WhatsApp redirect | Type + schema transaction |
| BR-B2 | Token-allowlisted handoff message | Type |
| BR-B3 | Public inserts one thing, reads none | RLS |
| BR-B4 | Minimal collection, no tracking | Schema + build guard |
| BR-B5 | First-party spam control | Server guard |
| BR-C1 | Four coherent price states | Schema constraint |
| BR-C2 | Zero is never a price | Schema constraint |
| BR-C3 | Bespoke pricing never calculated | Schema (absence) + test |
| BR-C4 | Currency explicit or absent | Schema constraint |
| BR-C5 | No price sort; facet counts describe the page they sit beside | Code + content + test |
| BR-D1 | Never fabricate a business fact | Schema (never seeded) + review |
| BR-D2 | Capability claims are owner-verified | Schema trigger |
| BR-D3 | Empty states, never invented content | Schema + content |
| BR-D4 | No marketing copy in JSX | Build guard + review |
| BR-D5 | No named person without consent | Schema gate (two, one per table) |
| BR-D6 | Idempotent seed, never overwrites owner | Data + runner algorithm |
| BR-D7 | Alt text is real text | Schema constraint |
| BR-D8 | No inference: nothing computed, converted or estimated | Schema (absence) + review |
| BR-D9 | Delivered work is unverified until an owner says otherwise | Schema default + gate + `content.verify` |
| BR-D10 | Curated, never inferred; an empty slot never fabricates | Resolver + CHECK + trigger + gate |
| BR-D11 | No invented relation, no invented search result | Schema constraint + code separation + test |
| BR-E1 | Asset-priority ladder | Data + process |
| BR-E2 | Never regenerate a manifest asset | Schema unique + build guard |
| BR-E3 | Concept media is never delivered work | Schema trigger |
| BR-E4 | Asset IDs never collide | Build guard |
| BR-E5 | Desktop and mobile are separate slots | Schema |
| BR-E6 | No deletion while in use | Schema trigger + permission |
| BR-E7 | A 3D model is supplied, never generated, and shows nothing it did not come with | Schema + source-level test |
| BR-F1 | Research never published | RLS + build guard |
| BR-F2 | Research never auto-imported | Schema (FK allowlist) + permission |
| BR-F3 | Research never publicly searchable | Schema + RLS |
| BR-F4 | No competitor image downloaded | Schema (absence) |
| BR-F5 | Scraped is not trusted | Schema stages + UI labelling |
| BR-F6 | Source conduct bounded | Server guard |
| BR-F7 | Snapshots private | Storage policy |
| BR-G1 | Six roles, one each, fixed matrix | RLS + server guard |
| BR-G2 | Server-side re-check everywhere | Build guard |
| BR-G3 | Invitation only | Platform + permission |
| BR-G4 | Destructive actions confirmed and undoable | Server guard + snapshots |
| BR-G5 | Every mutation and denial audited | Schema append-only |
| BR-H1 | One publication gate | Schema trigger |
| BR-H2 | What requires verification | Data classification |
| BR-H3 | Verification is a human act | Runner rule + audit |
| BR-I1 | Personal data in one place | Schema + redactor |
| BR-I2 | Stated retention | Cron jobs |
| BR-I3 | Production data never travels down | Guard + process |
| BR-I4 | Export and erase on request | Permission + script |
| BR-J1 | Never-expose list | Four guards |
| BR-J2 | Reachability only | Server guard |
| BR-J3 | Documentation allowlist | Build step |
| BR-K1 | Amendment-only canonical change | Process |
| BR-K2 | Requirements are read-only | Doc-contract guard |
| BR-K3 | Docs move with code | Doc-contract guard |
| BR-K4 | No silent weakening | Process + review |

---

## M. Open questions for the canonical decisions

Raised, not acted on. **Two divergences exist above and are marked in place rather than hidden:**
the `lib/` module paths named in BR-B5 and BR-C1, which D2 does not enumerate (item 6), and the
research foreign-key count, where the schema register and every phase document disagree (item 7).
Nothing else above knowingly diverges from `CANONICAL-DECISIONS.md`.

1. **Permission spelling.** D5 names the roles but not the permission format. This document uses the
   dot form (`content.write`) because `lib/auth/permissions.ts` owns the union and CI drift-checks
   it. Suggested amendment: fix the spelling in D5 beside the role list. (Also `ARCHITECTURE.md`
   open question 1.)
2. **No `content.review` permission.** The status workflow needs a `REVIEW → APPROVED` transition
   permission that the Phase 04 matrix lacks. Either add `content.review`, or state in D5 that
   `content.publish` covers approval.
3. **Retention for `audit_logs`, `activity_events` and `content_revisions` is unspecified.** BR-I2
   leaves three rows blank because no canonical section fixes them. Suggested amendment: a retention
   table in D5, so the four histories do not drift apart.
4. **`GOOGLE_SHEETS_SPREADSHEET_ID` classification.** D8 lists it as server-only; this document and
   `SECURITY.md` treat it as *sensitive* rather than *secret* (it identifies private data but does
   not grant access on its own). Suggested amendment: record the two-tier distinction in D8 so the
   Environment page's "configured / not configured" display is unambiguous.
5. **Three permission names appear in phase documents but in no matrix:** `media.publish`,
   `merchandising.read` and `research.enabled`. Each is either a synonym for a permission that
   already exists (`media.write`, `catalog.read`, a feature flag rather than a permission) or a
   genuine addition. They must be reconciled **before** Phase 04 writes `lib/auth/permissions.ts`,
   because after that the CI drift check makes an unnamed permission a build failure rather than a
   documentation inconsistency.
6. **Is D2's `lib/` domain list closed? — one of the two open divergences above.** D2 fixes ten
   subdomains (`supabase · media · cms · auth · whatsapp · scraper · analytics · seo · logging ·
   flags`). This document names two guards outside that list: `lib/security/rate-limit.ts` (BR-B5,
   Phase 41) and `lib/catalog/price-state.ts` (BR-C1, Phase 14). `ARCHITECTURE.md` open question 2
   raises the identical question and proposes amendment **A3** — record that D2's list is a *floor*
   rather than a ceiling and fix the criterion for a new domain: *a distinct external dependency or a
   distinct trust boundary*. Two notes that document does not carry. First, `lib/catalog/` is one of
   the eight it already enumerates, so BR-C1 is covered by A3 as drafted. Second, **`lib/security/`
   is a ninth path, listed in neither D2 nor that table**, yet `PHASE-39-46.md` places
   `rate-limit.ts` and `csp.ts` there and `TESTING.md` §7 puts `rate-limit.ts` on the 100 %-branch
   list; it meets the proposed criterion (a distinct trust boundary — every hostile public request
   passes through it, and folding it into `lib/logging/` or `lib/auth/` would put the abuse ceiling
   inside a domain that neither owns it), so A3 must enumerate **nine**, not eight. Until the
   amendment lands, D2's ten remain the contract and both paths above are provisional; the fallback,
   if A3 is refused, is `lib/auth/rate-limit.ts` and `lib/supabase/repositories/catalog/price-state.ts`,
   corrected in the phase documents in the same change. Neither rule's substance changes either way.
7. **`DATA_MODEL.md` and every phase document disagree on how many foreign keys may cross the
   research boundary — the second open divergence, and it will fail a test rather than a review.**
   BR-F2 fixes the allowlist at **two** entries and specifies an *equality* assertion over
   `information_schema.referential_constraints`, so an allowlist with a name that no constraint
   matches fails exactly as hard as an unallowlisted constraint. `DATA_MODEL.md` §1.1 rule 7 ("Exactly
   three foreign keys cross that line") and §11 (which lists
   `research_direction_briefs.target_category_id` as "the third and last taxonomy reference") say
   three. `PHASE-23-30.md`, `SCRAPER.md` §13.2 and `PHASE-31-38.md` say two, and `PHASE-31-38.md` —
   the document that owns Phase 34 and therefore migrations `0320`–`0321` — specifies the column as
   `target_category_slug text` with a check constraint against D3's seven slugs and no foreign key,
   plus a verification step asserting that converting it to a real reference *fails* the guard. BR-F2
   and `SECURITY.md` T5 follow the four documents that specify migrations. Two ways to close this,
   and the owner should pick one rather than let it drift: (a) correct `DATA_MODEL.md` §1.1 rule 7
   and §11 to two, keeping the slug column — no migration changes, no coupling added; or (b) amend
   D5 to permit a third taxonomy reference, convert `target_category_slug` to
   `target_category_id uuid references categories(id)`, and update BR-F2, `SECURITY.md` T5,
   `PHASE-23-30.md`, `PHASE-31-38.md`, `SCRAPER.md` §13.2 and the guard's allowlist in the same PR.
   **(a) is the smaller change and the one this document expects**, because the check constraint is
   as durable as a foreign key against a list D3 fixes and costs no coupling; `PHASE-31-38.md` raises
   the same choice as its own open question 13. Whichever is chosen, the allowlist and this rule move
   together — BR-K4 forbids changing one without the other.
