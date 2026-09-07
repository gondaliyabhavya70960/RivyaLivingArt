# CONTENT GUIDE — the editorial standard for Rivya Living Art

> How copy is stored, classified, verified, seeded, prioritised and written. Binding on every
> engineer who renders a string and every editor who types one.
>
> The audit of what actually exists is `docs/content/INITIAL_CONTENT_INVENTORY.md`. The contract
> above both is `docs/architecture/CANONICAL-DECISIONS.md`; where this document and that one
> disagree, that one wins. The specification of record is
> `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md`, cited below as **SEED §n**.

---

## 0. How to read this document

| If you are | Read |
|---|---|
| Building a section renderer | §1, §11, §12 |
| Writing seed modules | §1, §3, §4, §5, §6, §8 |
| Writing or editing public copy in the Studio | §2, §3, §6, §7, §8, §9, §13 |
| Deciding whether a sentence can be published | §3, §4, §7, §13 |
| Adding a page, section or reusable string | §12 |

Nine rules carry the weight. Everything else follows from them.

| # | Rule | Section |
|---|---|---|
| R1 | Public marketing copy never lives in JSX | §1 |
| R2 | Five statuses, one transition table, enforced twice | §2 |
| R3 | Every field is classified; the seed never writes `VERIFIED_BUSINESS_FACT` | §3 |
| R4 | A capability claim is `OWNER_VERIFICATION_REQUIRED` until an owner says otherwise | §4 |
| R5 | Seeding is idempotent and never overwrites an owner edit | §5 |
| R6 | The priority order is large format first, and it does not drift | §6 |
| R7 | Twelve things are never shipped | §7 |
| R8 | The voice is declarative, material and unhurried | §8 |
| R9 | Content and its media are designed together, never separately | §11 |

---

## 1. R1 — the source-of-truth rule

**SEED §1 and D2 state the same rule twice because it is the one that decays first.** A component
renders a value; it never contains a sentence.

```tsx
// Forbidden
<h1>Objects shaped by flow.</h1>

// Required
<h1>{section.heading}</h1>
```

### 1.1 The resolution chain

Every visitor-facing string comes from exactly one of three places, in this order:

| Source | Table | Used for | Studio |
|---|---|---|---|
| The section | `page_sections` | Copy that belongs to one place on one page | `/studio/content/pages/[pageId]` |
| The entity | `categories`, `journal_articles`, `journal_categories`, `faqs`, `customization_form_fields` | Copy that belongs to a thing, wherever it appears | `/studio/catalog/*`, `/studio/content/*` |
| The global | `global_content` | Copy reused in more than one place | `/studio/content/pages/global` |

There is no fourth source. A string that fits none of the three is a defect, not a special case —
see §12.3.

### 1.2 What may legitimately be in a component

- Structural markup, class names and layout.
- ARIA roles and element semantics (`role`, `aria-current`), which are contracts, not copy.
- Development-only diagnostics behind `process.env.NODE_ENV !== 'production'`.
- Nothing else.

Nine interface-chrome strings currently break this rule — pagination, breadcrumb, lightbox, skip
link and their neighbours — because `global_content.group_key`'s vocabulary has no group that
accepts them. They are listed in `INITIAL_CONTENT_INVENTORY.md` §1.3 and §28 with the one-migration
fix. **Do not add a tenth.**

### 1.3 The enforcement

| Guard | Where | Fails on |
|---|---|---|
| `no-literal-copy` ESLint rule | `components/sections/**`, `components/patterns/**` | A JSX text node of more than two words that is not a variable, with an `eslint-disable` line requiring a comment naming the exemption |
| `tests/unit/seed-modules.test.ts` | CI | A seed module writing to a table outside the allowlist |
| `tests/e2e/seed-editability.spec.ts` | CI | An inventory row whose stated Studio location does not render an editable control |
| Copy review | Pull request | A string added to a component instead of a seed module |

### 1.4 The consequence, stated plainly

Changing a headline is an editor's action at 11pm without a developer, without a build and without a
deploy. That is the whole point of the CMS, and every literal in a component takes one sentence back
out of the owner's hands.

---

## 2. R2 — the status workflow

### 2.1 The five states

`content_status` is `DRAFT · REVIEW · APPROVED · PUBLISHED · ARCHIVED`, on every content-bearing
table (D5).

| State | Means | Visible publicly |
|---|---|---|
| `DRAFT` | Being written. The seed's default for everything except global labels and Studio copy | No |
| `REVIEW` | Submitted for editorial reading | No |
| `APPROVED` | Editorially accepted, awaiting publication or a scheduled window | No |
| `PUBLISHED` | Live, subject to `publish_at` / `unpublish_at` | Yes |
| `ARCHIVED` | Withdrawn, retained with its revision history | No |

### 2.2 The transition table

| From | To | Permission |
|---|---|---|
| `DRAFT` | `REVIEW`, `ARCHIVED` | `content.write` |
| `REVIEW` | `APPROVED`, `DRAFT`, `ARCHIVED` | `content.review` |
| `APPROVED` | `PUBLISHED`, `REVIEW`, `ARCHIVED` | `content.publish` |
| `PUBLISHED` | `ARCHIVED`, `DRAFT` (unpublish) | `content.publish` |
| `ARCHIVED` | `DRAFT` | `content.write` |

Enforced **twice**: in `lib/cms/publishing.ts` and by the `enforce_status_transition` trigger. An
API caller cannot skip `REVIEW`, and neither can a script.

### 2.3 `OWNER_VERIFICATION_REQUIRED` is a sixth dimension, not a sixth state

SEED §2 lists it alongside the five, but it is a separate column — `owner_verification`, values
`NOT_REQUIRED · OWNER_VERIFICATION_REQUIRED · VERIFIED` (D5). A row can be `DRAFT` **and**
`OWNER_VERIFICATION_REQUIRED`; the two travel independently.

The gate: `enforce_owner_verification_gate` refuses the transition to `PUBLISHED` while the flag is
`OWNER_VERIFICATION_REQUIRED`, and **the refusal names the field**. The editor's two options are
stated in the refusal: remove the claim, or ask an owner or admin to set `VERIFIED`.

Only `owner` and `admin` may set `VERIFIED`. An editor cannot verify their own claim — that is the
whole mechanism.

### 2.4 Where the specification's vocabulary maps onto this schema

SEED marks two things with words this schema does not have. Both mappings are fixed here:

| SEED says | Stored as | Rows affected |
|---|---|---|
| `DRAFT_MARKETING_COPY` (§6, §10 §02) | `status = 'DRAFT'`, `fact_classification = 'BRAND_COPY'`, `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` | `brand.introduction`, homepage 02 Manifesto |
| `DRAFT_COLLECTION_CONCEPT` (FEAT §9) | `collections.concept_state`, a separate enum with its own publish gate | The ten concept names, if any are seeded |

### 2.5 Revisions

`write_revision()` is a database trigger on `pages`, `page_sections`, `navigation_items`,
`global_content` and `faqs`. It writes the full row snapshot to `content_revisions` on every insert
and update. No application write path can forget it, restoring a revision is itself a revision, and
a restore re-runs `sync_media_usages` so a media binding cannot be lost by rolling back.

---

## 3. R3 — the six fact classifications

`fact_classification` is `BRAND_COPY · EDITORIAL_COPY · VERIFIED_BUSINESS_FACT · PRODUCT_FACT ·
SEO_COPY · LEGAL_COPY` (D5). `page_sections` additionally carries `field_classifications jsonb`, a
`{ field: classification }` map, so one section can hold a brand headline and a flagged capability
claim without blurring them.

### 3.1 The six, with worked examples from the seeded copy

| Classification | What it is | Seeded example | Who may change it |
|---|---|---|---|
| `BRAND_COPY` | The studio's own identity and positioning. No external referent, nothing a customer could rely on | *Objects shaped by flow. Built to live with.* | Editor |
| `EDITORIAL_COPY` | Description and interpretation — of a material, a category, an idea | *Art with depth, light and material presence.* | Editor |
| `VERIFIED_BUSINESS_FACT` | An assertion about the business that an owner has confirmed | none at seed — see §3.3 | Owner or admin only |
| `PRODUCT_FACT` | A measurable property of a physical object: dimension, material, price state, availability, edition | none at seed — `products` ships with zero rows | Owner, via the product record |
| `SEO_COPY` | Text that exists to be indexed and shared | *About Rivya Living Art \| Resin Furniture & Functional Art* | Editor |
| `LEGAL_COPY` | Text that creates or describes an obligation | FAQ 05, the terms and privacy bodies, the form consent line | Owner, usually with advice |

### 3.2 The decision table

Ask these in order and stop at the first "yes".

| Question | Classification |
|---|---|
| Does the sentence state a measurable property of a specific physical object? | `PRODUCT_FACT` |
| Does it create, describe or limit an obligation — payment, data, delivery, consent? | `LEGAL_COPY` |
| Does it assert what the business can do, has done, or will do for a customer? | `OWNER_VERIFICATION_REQUIRED`, then `VERIFIED_BUSINESS_FACT` once confirmed |
| Does it exist primarily to be indexed or shared? | `SEO_COPY` |
| Does it describe or interpret a material, category or idea without asserting capability? | `EDITORIAL_COPY` |
| Otherwise — it expresses who the studio is | `BRAND_COPY` |

### 3.3 The seed never writes `VERIFIED_BUSINESS_FACT`

This is the rule that keeps the classification honest. The seed cannot verify anything; it has no
access to the business. So it writes the *claim* with the classification it would eventually carry,
plus the flag. Verification promotes it. A `VERIFIED_BUSINESS_FACT` row therefore always means a
person decided, which is the only meaning worth having.

The same applies to `PRODUCT_FACT`: `products` and `product_specs` ship with zero rows permanently
by seed policy (SEED §32). A seed module that writes to a catalogue table fails
`tests/unit/seed-modules.test.ts`.

### 3.4 The descriptor / claim line

The most frequent judgement in this project. SEED §6 seeds four short descriptors without a flag and
marks only the long introduction — that is the line, and it generalises:

> **Naming the materials and object types a studio works in is brand copy. Describing what the
> studio will do for a customer is a capability claim.**

| Sentence | Side | Why |
|---|---|---|
| *Collectible Furniture · Resin Art · Digital Fabrication* | Descriptor | Names a field of work |
| *Bespoke resin furniture, statement art and custom commissions.* | Descriptor | Names object types, promises nothing |
| *We create statement furniture, sculptural objects and bespoke resin pieces shaped through resin work, natural materials, digital design, 3D fabrication and hand-finishing.* | Claim | Enumerates production methods as current capability |
| *Custom sizing can be discussed for eligible projects.* | Claim | Offers a service and implies eligibility criteria |
| *A table can become a landscape.* | Descriptor | Metaphor, not an offer |

When the line is genuinely unclear, flag. A flagged sentence costs one owner conversation; an
unflagged false claim costs trust.

---

## 4. R4 — owner verification in practice

### 4.1 What triggers the flag

Seed anything as `OWNER_VERIFICATION_REQUIRED` that asserts:

- a production method, technique or machine capability;
- a service offered, or the scope of a commission;
- a dimension, tolerance, timeline, lead time or availability;
- a material property, durability or preservation performance;
- a real business fact the repository does not contain — contact details, location, social presence;
- a category or product type the studio may not yet make.

### 4.2 What clears it

An `owner` or `admin` sets `owner_verification = 'VERIFIED'` on the row. The trigger then permits
`PUBLISHED`. `INITIAL_CONTENT_INVENTORY.md` §30 groups all 108 seeded flags into **ten owner
decisions**, each stated as a question with its consequence if the answer is no — so verification is
ten conversations, not a hundred and eight approvals.

### 4.3 Extensions this project made to the specification's flag list

Recorded rather than applied silently, so a later reader can disagree with the reasoning rather than
discover the divergence:

| Row | SEED marks it? | Flagged here because |
|---|---|---|
| About — 02 Philosophy | No | Its third sentence claims digital fabrication as a working method, which SEED flags everywhere else the claim appears |
| All ten FAQ answers | Only 01 and 07 | Every answer touches process, delivery, pricing or customization capability. `PHASE-05-09.md` already takes this reading |
| Large Format — Sculptural Seating | *"Mark if not yet produced"* | The seed cannot know whether it has been produced, so it flags and lets the owner clear it |
| Contact enquiry types | No | The eight options are an offer; two of them name capabilities gated elsewhere |
| Preservation form template | *"Do not promise compatibility before review"* | Asking *Item / Flower Type* implies the studio can preserve what is named |
| `commerce.ready_stock` | No | *Ready Stock* asserts that a physical object exists and can ship |
| Social profile URLs | No | A published social link asserts a real business presence |

### 4.4 Re-opening a verification

A `VERIFIED` row that is then edited in a way that **adds or widens a claim** must be returned to
`OWNER_VERIFICATION_REQUIRED`. The trigger cannot detect this — semantics are not diffable — so it is
an editorial obligation, and §13 makes it a review question.

Concretely: `/process` step 04 is seeded to name no machine, no technique and no tolerance. Adding
one re-opens verification even if the row is already `VERIFIED`.

---

## 5. R5 — idempotent seeding, `content_seed_version = "rivya-v1"`

### 5.1 The commands

```bash
npm run seed:content -- --dry-run       # prints insert / update / skip per row, writes nothing
npm run seed:content                    # applies
npm run seed:content -- --only=homepage # one module
npm run seed:content -- --report        # summary to activity_events, regenerates the inventory
npm run content:inventory               # regenerates docs/content/INITIAL_CONTENT_INVENTORY.md
```

### 5.2 The seven rules

1. Every seeded row carries a stable natural `seed_key` — `home.hero`,
   `nav.header.collection.furniture`, `global.cta.commission_a_piece`, `faq.01` — and
   `content_seed_version = 'rivya-v1'`.
2. The runner connects with the service role and writes `updated_by = NULL`. The `set_owner_edited`
   trigger sets `owner_edited = true` whenever `updated_by` is non-null, so a human edit marks
   itself and the runner never has to guess.
3. Per row: **insert** when no row with that `seed_key` exists; **update** only when
   `owner_edited = false` **and** the stored `content_seed_version` differs; **skip** otherwise, and
   list the `seed_key` in the run report.
4. The runner never deletes a row, and never reorders rows a human has reordered.
5. The runner never changes `status` on an existing row. A row a human published is never demoted.
6. Every run writes a `content_seed_runs` record: counts of inserted, updated,
   skipped-owner-edited and failed, plus the per-`seed_key` outcome list.
7. An unresolved media binding **fails the run**. `content/seed/media-bindings.ts` may only
   reference `rivya_asset_id` values present in `data/higgsfield/asset-manifest.json`; there is no
   placeholder fallback.

### 5.3 How to change seeded copy after launch

**In the Studio.** Not in the seed module. Editing `content/seed/homepage.ts` after production and
re-running the seed changes nothing on any row an owner has touched, and that is correct behaviour,
not a bug to work around.

The seed module is the *initial* value. Once the site is live it is history — useful for rebuilding
a staging database from scratch, useless as a way to push a copy change. There is no
`--force-overwrite` flag and adding one would defeat rule 2.

### 5.4 When a second seed version is justified

A `rivya-v2` is warranted only when new *structure* arrives — a new page, a new section type, a new
global group — not when a sentence changes. Bump the constant, add the new `seed_key`s, and let
rule 3 leave every existing row alone.

---

## 6. R6 — the content priority hierarchy (SEED §56)

```
1. Large-format furniture
2. Collectible / sculptural furniture
3. 3D + resin
4. Statement art / architectural work
5. Preservation
6. Décor
7. Gifts
```

### 6.1 Why it is a rule and not a preference

The manifest's asset distribution pulls the other way: 18 décor images, 19 preservation, 10 gifts,
20 wall art — against 18 large-format frames total, of which only five are dining tables. Whoever
builds a page from what is easiest to illustrate will build a gift store. SEED §56 exists to stop
exactly that, and `CONTEXT.md` repeats it.

### 6.2 Where the order is enforced

| Surface | Enforcement |
|---|---|
| `categories.sort_order` | Seeded 1–7 in the order above; `tests/unit/seed-modules.test.ts` asserts it |
| Collection landing tiles | Read `categories.sort_order` — there is no second order column |
| Mega menu | Same column |
| Homepage section order | Secondary Objects is `position = 11`; a unit test asserts `position > 10` for that `seed_key` |
| Merchandising | Editorial discipline. The Studio cannot enforce it, so `studio_help.homepage_selected_works` and this section carry the rule instead |

### 6.3 The vocabulary rule that prevents drift

**The words *gift*, *gifting*, *keepsake*, *souvenir*, *memento* and *personalised* must not appear
in any homepage section at `position ≤ 10`, anywhere on `/about`, or anywhere on `/large-format`.**

They are correct and welcome in homepage section 11, on `/collection/gifts`,
`/collection/preservation`, `/collection/decor` and in the journal. The rule is not squeamishness
about small objects — it is that the first ten sections establish what kind of studio this is, and
one gifting sentence among them re-frames everything after it.

### 6.4 The drift test

Before publishing any new or edited section on `/`, `/about` or `/large-format`:

1. If a visitor read only this section, what size of object would they picture?
2. Does the section's media show something a person could sit at, eat at, or stand in front of?
3. Would this sentence read the same on a personalised-gifts site? If yes, it is in the wrong place.

---

## 7. R7 — the hard quality rule (SEED §55)

### 7.1 Never ship

| # | Never | Instead |
|---|---|---|
| 1 | Lorem ipsum | Write the real sentence, or leave the field empty and let the section render without it |
| 2 | "Coming Soon" on a primary page | A specific, finite empty state — *The project archive is being prepared.* A path with no `PUBLISHED` page resolves to `notFound()` |
| 3 | Generic AI buzzwords | Material nouns. See §8.5 |
| 4 | Unverified superlatives | Nothing, or a description. *Large surfaces create space for resin flow* beats *the finest resin tables* |
| 5 | Fake awards | Nothing. There is no awards field in the schema |
| 6 | Fake clients | The portfolio empty state. `portfolio_projects` ships with zero rows |
| 7 | Fake testimonials | `testimonials` ships with zero rows; `enforce_evidence_gate()` requires `client_consent_state = 'GRANTED'` |
| 8 | Fake projects | As 6 |
| 9 | Fake sales numbers | Nothing. There is no such field |
| 10 | Fake years of experience | Nothing. The seed contains no founding date, and inventing one is D10's exact prohibition |
| 11 | Fake production capabilities | A flagged claim the owner can confirm or delete |
| 12 | Fake material certifications | Nothing. `materials.description` carries no durability, certification or performance claim by rule |

### 7.2 The mechanical checks

```bash
grep -rniE "lorem|coming soon|\bTBD\b" content/seed/
grep -rniE "world-class|award-winning|trusted by|years of experience|industry-leading|premium quality" content/seed/
grep -rniE "guarantee|warrant|certified|waterproof|scratch-proof|lifetime" content/seed/
```

All three must return nothing. They run in `tests/unit/seed-modules.test.ts` and in CI. The third is
the one that matters most: a durability claim about resin is both the easiest sentence to write and
the one most likely to become a dispute.

### 7.3 Elegant is not the same as vague

SEED §55 asks for *elegant draft marketing content* while preserving factual integrity. These are
compatible, and the seeded copy shows how: specificity about **materials and intent** carries the
elegance, so no specificity about **capability or performance** is needed.

> Large surfaces create space for resin flow, natural edge, colour and material contrast to unfold
> at architectural scale.

Four concrete nouns, one spatial idea, zero claims. That is the register.

### 7.4 Protected sentences

Three seeded statements encode a business rule (D1) and may not be edited into contradiction. An
edit that weakens any of them is a defect, not an editorial choice:

| Sentence | Where | Encodes |
|---|---|---|
| *No. Rivya does not process online payments through the website. Pricing, payment arrangements and delivery details are finalized directly through WhatsApp.* | FAQ 05 | No payment gateway |
| *No. There are no customer accounts. You can browse, customize and submit an enquiry without creating an account.* | FAQ 06 | No customer accounts |
| *Your enquiry is recorded and you are then redirected to WhatsApp* / *Price, production details, payment and delivery are confirmed manually.* | FAQ 04, Custom Commissions step 04 | Persist, then redirect — never the reverse |

If the business rules ever change, they change in `CANONICAL-DECISIONS.md` first, by amendment, and
these sentences follow.

### 7.5 One article carries a sourcing condition

Journal article 02, *Choosing the Right Size for a Statement Dining Table*, must not resolve into a
table of standard dimensions. SEED §20 says *avoid claiming exact standards unless sourced*, so the
publication condition for that article is a citation for every numeric claim, or no numeric claims.
Article 08 carries the equivalent condition on preservation performance.

---

## 8. R8 — the voice, inferred from the seeded copy

Nothing here is invented. Every rule below is a pattern already present in the SEED copy; it is
written down so new copy matches what exists.

### 8.1 Shapes

| Element | Pattern | Examples |
|---|---|---|
| Eyebrow | Upper case, one to four words, no full stop unless it is two sentences | `LARGE FORMAT` · `FROM LIQUID TO OBJECT` · `SMALLER IN SCALE. STILL PERSONAL.` |
| Heading | A declarative sentence with a terminal full stop, or a question. 4–10 words. Often two short sentences | *Objects with presence.* · *Furniture can hold more than function.* · *Have a piece in mind?* |
| Two-part heading | Two sentences; the second is the emphasis and goes in `heading_highlight` | *Not decoration added to an object. / The material is the object.* |
| Body | One to three sentences, 20–45 words each. Never more than two paragraphs in a section | *A table can become a landscape. A surface can capture movement.* |
| Card description | One sentence, 12–25 words, no CTA inside it | *Grain, edge and natural variation introduce warmth and individuality.* |
| CTA | Two to four words, verb first, title case, no full stop | *Explore Large Format* · *Commission a Piece* |
| Step | `01 — Understand` — two digits, spaced em dash, one-word or two-word verb | `04 — Finish` |

### 8.2 Punctuation

- **Full stops in headings.** The seeded copy uses them consistently. Keep them.
- **Em dashes are unspaced**, following the specification: *objects—combining it*,
  *transformation—bringing together*, *art-object mindset—from seating*. Use at most one per
  paragraph.
- **No exclamation marks anywhere.** There is not one in the entire specification.
- **No semicolons in body copy.** Two sentences instead.
- **Middle dot `·`** separates items in a descriptor: *Collectible Furniture · Resin Art · Digital
  Fabrication*.
- **Ampersand** only inside proper names of categories: *Wall & Statement Art*, *Care & Education*.

### 8.3 Person

| Surface | Person | Example |
|---|---|---|
| `/about` | First person plural | *We work where material becomes expression.* · *Our primary direction is…* |
| Everywhere else | Third person, or no subject at all | *Rivya's work explores this transformation.* · *A commission starts with your space.* |
| Direct address | Second person, only for the visitor's own actions | *Share your dimensions, space photographs, references and intended use.* |

Never *I*. Never *the team*. Never *our clients*.

### 8.4 Hedged verbs are the house register for anything not yet verified

*can be discussed · may be available · can help establish · explores · is developing · offers space
for*. These are not weasel words here — they are the accurate description of a studio taking
enquiries. Compare: *we build custom conference tables to any specification* is both stronger and,
absent verification, false.

### 8.5 Word bank and banned list

**Use:** material · form · surface · depth · transparency · colour · movement · presence ·
proportion · silhouette · edge · grain · scale · composition · finish · context · space · flow ·
translucency · casting · structure.

**Never use:** unleash · elevate · curated experience · game-changing · world-class · unrivalled ·
industry-leading · award-winning · trusted by · bespoke luxury handcrafted premium (stacked) ·
timeless · exquisite · one-stop · seamless · revolutionary · state-of-the-art · passion for
perfection.

**Handle with care:** *bespoke* and *luxury* each appear rarely in the seeded copy and never
together. *Handcrafted* does not appear at all in public copy — it appears only in the Higgsfield
prompt recipe, which is internal.

### 8.6 Spelling

House prose is British-leaning: **colour**, **personalised**, **recognise**, **décor** (with the
acute), **enquiry** / **enquire**.

Two exceptions, both deliberate:

1. **`customize` / `customization` / `customizable` stay American, everywhere.** They are not only
   copy — they are identifiers: `customization_forms`, `customization_form_fields`, `form_kind`, and
   the seeded labels *Customize This Piece* and *Customizable*. One spelling across code, database
   and copy is worth more than orthographic consistency.
2. **Quoted specification copy keeps the specification's spelling**, even where it is internally
   inconsistent. Two known cases, both on homepage section 11: the card label is **Personalised
   Pieces** and the body says **personalized pieces**; and *finalized* appears in FAQ 05. These are
   seeded verbatim. New copy follows the British form.

**Enquiry versus inquiry** is the same split, and it matters: public copy says **enquiry** (*Send an
Enquiry*, *Enquire on WhatsApp*, *Enquiry Type*); the schema says `inquiries`, `inquiry_kind`,
`inquiry_status`, `inquiry_events`. Never let one leak into the other's territory.

### 8.7 A worked revision

> **Before** — Rivya Living Art is a world-class, award-winning studio crafting exquisite bespoke
> luxury resin furniture with over 10 years of experience. Our premium epoxy tables are guaranteed
> to last a lifetime!

Nine failures: unverified superlative, fake award, stacked adjectives, invented tenure, durability
guarantee, exclamation mark, no material specificity, no verifiable content, and a claim about
products that do not exist.

> **After** — Rivya Living Art is a contemporary material-led studio focused on furniture,
> sculptural objects and resin art. Our approach begins with a simple idea: functional objects do
> not have to disappear into a room.

Shorter, entirely defensible, and it says something the reader could not have guessed.

---

## 9. Alt text (SEED §43)

Every media asset carries editable alt text. `page_sections.media_alt_override` takes precedence
over `media_assets.alt_text`; both are editable, the override at the section, the default in the
asset drawer at `/studio/media/all`.

| Rule | Detail |
|---|---|
| Describe what is visible | *Sculptural resin dining table presented in a minimal architectural interior.* |
| Never `image 1`, `hero`, `photo`, `banner` | The seed refuses to write them; review catches the rest |
| 8–20 words | Long enough to be useful, short enough to be heard |
| Do not repeat the adjacent heading | A screen-reader user hears both |
| **Never describe concept media as delivered work** | No *a table Rivya made for a client in…*. The asset is `is_concept = true` |
| Do not announce AI generation in alt text | It describes the image. The `is_ai_generated` flag is the metadata answer, and `studio_help.higgsfield_asset` is the editor-facing warning |
| Decorative media takes `alt=""` | And is marked decorative on the section, not given a hollow sentence |

The manifest ships an `alt_text_draft` per asset, truncated from the generation prompt. **It is a
starting point, not alt text** — prompts describe lighting, palette and camera, which a screen-reader
user does not need. Rewriting it is part of binding an asset.

---

## 10. SEO copy (SEED §41, §42)

| Field | Rule |
|---|---|
| Title | 50–60 characters. The global template is `%s \| Rivya Living Art`; a `PATH` row supplies the whole title, template included |
| Description | 140–160 characters, one or two sentences, no keyword list |
| Social title / description | May differ from the page title; both resolve from `seo_entries`, with `global_content.SOCIAL` supplying the share-card overlay text |
| `derived` | `true` when the row was generated from page copy rather than written. An owner edit sets it `false`, which is how the SEO editor shows whether a value is theirs or a default |
| Keyword themes | Seventeen seeded rows, all `research_status = 'UNRESEARCHED'`. **There is no volume, difficulty or ranking column**, so there is nowhere to record a number nobody measured |

Do not keyword-stuff. SEED §42's themes are directions for research, not phrases to insert. A page
that reads well for a human and names its materials accurately is already doing the work.

---

## 11. R9 — content and media are designed together (FEAT §36)

Every seeded section that declares a media slot is either **bound to a real manifest asset** or
**recorded as a named gap**. There is no third outcome, and specifically no placeholder image.

### 11.1 The asset priority ladder (D6)

```
1. Verified real Rivya media
2. Approved user-provided asset
3. Existing approved Higgsfield asset   ← the 250 in the manifest
4. Existing suitable Rivya render
5. New Higgsfield generation
6. Technical fallback, only if unavoidable
```

**Regenerating anything already in the manifest is a defect, not a shortcut.** Before writing a
generation brief, read `INITIAL_CONTENT_INVENTORY.md` §29: fourteen of the twenty-one open briefs
already have a named reuse candidate.

### 11.2 The rules that govern a binding

- Desktop and mobile are **separate slots** (D6). One landscape source is never cropped into both by
  the renderer.
- The eight permitted ratios are `21:9 · 16:9 · 4:3 · 3:2 · 1:1 · 4:5 · 3:4 · 9:16`. A slot needing
  a ratio the asset does not have gets a `media_crops` derivative, recorded, not an inline
  transform.
- Every media row carries `alt_text`, `is_ai_generated` and `is_concept`.
- Concept media may never be attached to a product at all — `reject_concept_product_media()` refuses
  the insert.
- A missing image renders `MediaSlot`'s reserved aspect box with the seeded label
  *Image temporarily unavailable* (SEED §47). **The layout does not collapse.**

### 11.3 When there is no right asset

Leave the slot null and record the gap. A section rendering strong copy without an image is honest;
the same section carrying a photograph of something Rivya did not make is not. The gap register is
the Phase 43 work list, and it is shorter and more useful than a page of near-misses.

---

## 12. Adding new content

### 12.1 A new page

1. Add a `pages` row: `slug`, `path` (leading slash, matching D3 or an approved amendment), `kind`,
   `title`.
2. Add its `page_sections` in `position` order, each with a `block_type` that resolves in
   `lib/cms/registry.ts`.
3. Add a `seo_entries` row with `scope = 'PATH'`, or let it inherit the `GLOBAL` row.
4. Add the navigation and footer links if the page is meant to be reachable.
5. Classify every field; flag every capability claim.
6. Bind or gap every media slot.
7. Regenerate the inventory: `npm run content:inventory`.

A path outside D3's route map needs an amendment to `CANONICAL-DECISIONS.md` first. Not a silent
addition.

### 12.2 A new section type

1. `content/blocks/<type>.ts` — Zod `schema`, `defaults`, `mediaSlots`. This is the block's contract.
2. `components/sections/<Type>.tsx` — a renderer, 1:1 with the block type, containing no copy.
3. Register it in `lib/cms/registry.ts`.
4. Add the Studio editor fields; a `payload` key with no control is a coverage regression that
   `seed-editability.spec.ts` will catch.
5. Seed an instance with a stable `seed_key` if it ships as part of the initial content.

### 12.3 A new reusable string

Add a `global_content` row: `group_key` (from the fixed vocabulary), `key`, `label` (what the Studio
field is called), `value`, `description` (helper text shown beside the field).

If no `group_key` fits, **stop**. Do not force it into the nearest group and do not put the string
in a component. Raise it — the current instance of exactly this problem is the nine interface-chrome
strings and the proposed `UI_CHROME` group
(`INITIAL_CONTENT_INVENTORY.md` §31, open question 1).

---

## 13. The pre-publication checklist

Ten questions. Any "no" blocks publication.

1. Does every sentence in this section come from the database rather than a component?
2. Is every field classified, and is `field_classifications` set where a section mixes kinds?
3. Does anything here assert what the business can do, has done, or will do? If so, is it flagged —
   or verified by an owner, not by me?
4. If this row was already `VERIFIED`, does my edit add or widen a claim? If so, has it gone back to
   `OWNER_VERIFICATION_REQUIRED`? (§4.4)
5. Is there a number in this copy — a dimension, price, duration, count, year? Where did it come
   from, and can I show the source?
6. Do the three greps in §7.2 return nothing?
7. If this is `/`, `/about` or `/large-format`, does it pass the §6.4 drift test and the §6.3
   vocabulary rule?
8. Does every media slot have a real bound asset, or a recorded gap? No placeholder, no near-miss?
9. Does every image have alt text that describes what is visible and does not present concept media
   as delivered work?
10. Does the SEO row say something true and specific, or is it a keyword list?

---

## 14. Statements in this document requiring owner verification

This document describes rules, not the business, with three exceptions that an owner should confirm:

| Statement | Why it needs confirmation |
|---|---|
| The contact details quoted in `CONTEXT.md` and seeded into `global_content.CONTACT` | Real business facts the repository cannot verify (inventory V1) |
| That British-leaning spelling is the house standard | An owner may prefer Indian-English or American conventions; the whole of §8.6 follows from that choice |
| That *enquiry* is the public-facing word while the schema says `inquiries` | A deliberate split. If the owner prefers *inquiry* publicly, the seeded CTA labels change and the schema does not |

---

## 15. Open questions for the canonical decisions

Raised, not acted on.

1. **`global_content.group_key` has no group for interface chrome.** Nine visitor-facing strings sit
   in components as a result. Suggested amendment: add `UI_CHROME` to the check constraint. Raised in
   full in `INITIAL_CONTENT_INVENTORY.md` §31.
2. **`fact_classification` has no value for interface labels.** Pagination, filter and form-control
   text is neither brand, editorial, legal nor SEO copy. This document classifies it `No · UI` in the
   inventory and leaves the column null. Suggested amendment: either add `UI_COPY` to the enum or
   record that null is the correct value for chrome.
3. **The transition from a flagged claim to `VERIFIED_BUSINESS_FACT` is manual in two columns.**
   Setting `owner_verification = 'VERIFIED'` does not change `fact_classification`, so a verified
   capability claim can keep sitting as `BRAND_COPY`. Suggested amendment: have the verification
   action promote the classification, or state that the two are deliberately independent.
4. **D10 forbids fabricating awards, certifications and testimonials but the schema has no columns
   for them at all.** That is stronger than the rule and probably right. Suggested amendment: record
   in D10 that the prohibition is enforced by absence, so a later phase does not add the fields
   "for completeness".
5. **Nothing defines who owns editorial sign-off between `REVIEW` and `APPROVED`.** The permission
   `content.review` exists; the role that holds it in practice is not stated. Suggested amendment:
   name it in D5's role list.
