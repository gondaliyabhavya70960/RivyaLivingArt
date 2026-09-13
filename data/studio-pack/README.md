# Studio pack — operator drafts, not seed inventory

**Nothing in this directory is seeded, rendered, imported or published.** It is the owner's content
pack, extracted from `Rivya-Studio-Content-Pack.xlsx` on 2026-09-13, held as JSON so a person can
read it, diff it and paste from it. No module under `content/seed/` imports these files and none
should. Two of the nine were also transcribed into seed modules — the FAQs and the journal ideas —
and the note below says exactly what was and was not carried across.

## What is here

| File | Rows | Where it goes |
|---|---|---|
| `comparators.json` | 60 | `/studio/research/sources`, by hand |
| `product-concepts.json` | 76 | `/studio/catalog/products`, by hand |
| `journal.json` | 59 | transcribed into `content/seed/journal.ts` |
| `faqs.json` | 55 | transcribed into `content/seed/faq.ts` |
| `materials.json` | 52 | `/studio` materials, by hand |
| `portfolio-studies.json` | 55 | `/studio` portfolio, by hand |
| `commission-briefs.json` | 55 | `/studio`, by hand |
| `seo-themes.json` | 55 | internal research targets |
| `collections.json` | 61 | 10 canonical, 51 series ideas |

## The rules this pack is held to

**Products are not seedable and never will be.** `SeedableTable` in `content/seed/types.ts` has no
`products` member, deliberately, so a module targeting it cannot be written — there is nothing to
review and nothing to catch. All 76 concepts here are `REQUEST_FOR_QUOTE` and their dimensions are
**brief envelopes, not manufactured facts**. A product becomes real when the object exists and the
owner enters it.

**Comparators ship disabled.** All 60 rows carry `enabled = NO` and `image_mode = NONE`, and nothing
in this repository turns them on. `research_sources` is not inserted here — the scraper stays off,
and the app requires a policy note of at least 20 characters before a source can be enabled. That
is the owner's decision to make and to write down.

**Portfolio invents no clients.** All 55 rows are `STUDIO_STUDY` with no client named. D10's first
sentence forbids asserting a delivered project, and an empty portfolio is the honest state until
there is a real one to show.

**Collections stay concepts.** 10 canonical (Ocean → Bespoke) are the primary set. The other 51 are
series *ideas* and must not become 51 published collections; they are names to choose from, not
inventory.

**Nothing claims a lead time, a UV or yellowing warranty, food-safe status, an edition size, or a
completed commission.** Every row that touches one of those declines it or says it depends on the
project. That was checked across all nine files, not assumed.

## What was carried into the seed, and what was not

`content/seed/faq.ts` and `content/seed/journal.ts` were extended from this pack. Three decisions
are worth knowing before anyone re-runs the extraction:

1. **The original ten FAQs and ten journal ideas were kept verbatim.** The pack supplies its own,
   slightly tighter wording for both. It was not taken. SEED §23's FAQ answers restate fixed
   business rules — no online payment, no customer accounts, enquiry-then-WhatsApp — and a
   paraphrase erodes them. Where the pack's verification flags were *looser* than the repo's for
   those ten, the repo's stricter flag won.
2. **Three FAQ answers ended with an instruction to the verifier** ("Do not publish a blanket
   insurance claim", and two like it). `faqs` has no notes column, so those sentences were split
   out of `answer` into a `caution` field that lives in the module and never reaches the database.
3. **No journal cover was invented.** `ARTICLE_COVERS` still holds ten pairs; articles 11-59 carry
   no `media` key at all. The seed runner throws on an asset id the Higgsfield manifest does not
   carry, which is the guard working.

## Loading the rest

Sign in at `/studio` (`/stu` is a 404), open the matching file, create the row, **leave it DRAFT**.
Publish a product only when the object exists. Bind Higgsfield images as concept media, never as a
photograph of delivered work — the `product_media` trigger refuses concept assets, and that refusal
is the design rather than an obstacle.
