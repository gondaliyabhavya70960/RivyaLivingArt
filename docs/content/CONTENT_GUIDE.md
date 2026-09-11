# Content guide — how a page is built, and what refuses to let it go live

Phase 08. The CMS engine: pages, blocks, the status workflow, media binding and the schedule.

This document is for two readers. An **editor** wants to know how to build a page and why the
system sometimes says no. An **engineer** wants to know where each rule lives so they can change it
in one place. Both are served by the same explanations, so neither is separated out.

---

## 1. The shape of a page

A page is a row in `pages` and an ordered list of rows in `page_sections`. Nothing else.

```
pages                    one row per addressable route (/, /about, /process …)
  └─ page_sections       one row per block, ordered by `position`
       ├─ shared fields  eyebrow, heading, body, CTAs, media — real columns
       └─ payload        the block's own data, as jsonb, validated by its Zod schema
```

**Copy is never in the code.** `components/sections/**` renders `section.heading`, never a
headline. `npm run cms:check-copy` parses every renderer and fails the build on a string literal
that a visitor would read — a JSX text node, or a literal given to `alt`, `title`, `aria-label` and
the rest. Class names, `sizes` values and ratios are literals too and are fine; what distinguishes
copy is its position, which is why the gate uses the TypeScript parser and not a regex.

**Site-wide strings live in `global_content`**, keyed `GROUP.key`, and the renderers ship **no
fallbacks**. A missing key renders nothing. That is deliberate: a default in code would put a
sentence on the site that nobody wrote, and it would do it invisibly, because the page would look
finished. (`components/studio/strings.ts` does the opposite and carries literals, because Studio
chrome has to render before any content exists. The public site has no such excuse.)

---

## 2. The 34 blocks, and the twenty-seven that are built

`lib/cms/block-types.ts` lists the whole PHASE-05-09 §08 catalogue of 28, plus the two an exhibition
page needs (A14), the two the project archive needs (Phase 17), the configurator band (Phase 19) and
the merchandised featured band (Phase 22, A22). Twenty-seven are built; 7 are declared `PLANNED`.
Phase 08 built the first six, Phase 11 added the ten the homepage needed, Phase 12 added
`scale-statement` for `/about`, Phase 13 added the three `/large-format` needed, Phase 16 added two,
Phases 17, 19 and 20 one or two each, and Phase 22 added `featured-collections`.

| Built | Payload family it proves |
|---|---|
| `hero` | Media-only — the desktop/mobile pair, a poster slot, and two motion slots |
| `statement` | No payload at all |
| `category-grid` | Repeating items with indexed media references, and entry-level verification |
| `process-steps` | Repeating items, ordered — the number is the content |
| `empty-state` | Query-and-global: its message comes from `global_content` |
| `divider` | No payload **and** no copy fields |
| `manifesto`, `final-cta` | No payload — everything they show is a shared copy field |
| `selected-works`, `portfolio-strip`, `journal-strip` | **Reference blocks**: they render entities that may not exist, and show a seeded `EMPTY_STATE.*` sentence when there are none. **Since Phase 22, `selected-works` and `journal-strip` on the homepage are answered by a merchandising slot** (`HOMEPAGE_SELECTED_WORKS`, `HOMEPAGE_JOURNAL_STRIP`), through the five-step ladder in `lib/cms/merchandising.ts`, and carry the slot's fallback mode: `HIDE_SECTION` removes the band, `EDITORIAL_BLOCK` adds tiles drawn from a named section, `SHOW_EMPTY_STATE` is the sentence alone. Both gained an optional `slot_key`; `selected-works` also a `fallback_section_id`. On any other page they run their Phase 11 query as before. **No product slug is ever written in a payload or a renderer** — `npm run cms:check-copy` reports a `/product/<slug>` literal |
| `featured-collections` | A **reference block** with no query of its own (Phase 22): it asks `HOMEPAGE_FEATURED_COLLECTIONS` — curated under Studio → Merchandising → Featured from published, owner-confirmed collections and published categories — and hides itself below three. Not seeded onto the homepage; an editor places it on `/` or `/collection`. The seeded §10-03 band stays the editorial `category-grid` |
| `material-story` | Media positions with no labels — the words are the section's own heading |
| `material-palette`, `secondary-objects` | Repeating items with entry-level verification |
| `commission-cta` | Chips, each verifiable on its own |
| `three-d-resin` | A reserved slot for Phase 21's viewer that renders nothing while empty |
| `scale-statement` | No payload; a 21:9 desktop crop paired with a separate 4:5 mobile asset |
| `category-intro` | No payload; the sentence above a list, tighter to what follows than a statement |
| `category-list` | Repeating entries with entry-level verification, an optional picture and an optional validated link |
| `customization-note` | No payload, and the one renderer that refuses to draw itself unverified |
| `signature-media` | One image or film full width, with a caption bound to it. Used TWICE on an exhibition page — FEAT §8's element 3 is the still, element 6 the film — because they are the same band and only `is_video` differs. The still is always bound and always paints first; a film with no still renders nothing |
| `collection-products` | A **reference block** like `selected-works`, but scoped to one collection. It holds no product ids: curation lives in `product_collections`, and an empty `collection_slug` means "the collection this page belongs to", answered from `collections.page_id` |

A planned block cannot be added in Studio, and renders **nothing** on the public site — not a
placeholder, not a grey box. Studio lists them separately so the outstanding catalogue is visible
to the person who can ask for it.

Adding a block is one entry in `BLOCK_TYPES`, one file in `content/blocks/`, one line in each
registry, and one renderer. The compiler names every place you have missed: both registries are
`satisfies Record<BlockType, …>`, so an omission is a build error, not a runtime `undefined`.

### The chrome/copy split

`sharedFields` chooses which of the twelve SEED §5 **copy** fields a block's editor shows. The
**chrome** — visibility, theme, layout variant, position, the publish window, the fact
classification and the owner-verification flag — is rendered for every block regardless.
`sharedFields: []` therefore means "no copy fields", never "no editor".

---

## 3. Media, and the rule that is easiest to get wrong

A section binds media two ways:

- **The pair.** `media_desktop_id` and `media_mobile_id`, real columns with real foreign keys.
  They are two separate assets, not two sizes of one — each carries its own `alt_text`, which is
  why the renderer emits two elements rather than one `<picture>` with two sources.
- **Repeating slots.** A reserved `payload.media` array of `{ slot, role, media_id }`.
  `sync_media_usages` turns it into `cards[0]`, `cards[1]`, … — the indexed `slot_key` form
  `slotKeyOf()` strips.

> **A bound asset must name its `media_slot_key`.** This is enforced by
> `page_sections_media_needs_slot_key` (migration 0054), and the reason is not tidiness.
> `sync_media_usages` only writes a `media_usages` row when the slot key is present, and
> `cms_publish_section`'s approval (RV003) and verification (RV006) gates are **both joins through
> that table**. With a null slot key there is no binding as far as those checks are concerned — so
> before 0054 a section holding a DRAFT, unverified asset published with no media check at all, and
> the asset appeared on the public site having been reviewed by nobody. Verified, fixed, verified
> again.

Studio catches this before the database does, so an editor reads a sentence rather than a
constraint name — but the constraint is the guarantee, not the form.

---

## 4. The status workflow

Twelve edges, in `lib/cms/transitions.ts`, which is the single source.
`scripts/cms/gen-transition-sql.ts` renders `0052_phase08_transition_trigger.sql` from it, and
`npm run cms:check-transitions` byte-compares the file against a fresh render — the trigger and the
TypeScript cannot drift.

```
DRAFT     → REVIEW · ARCHIVED                    content.write
REVIEW    → DRAFT · APPROVED · ARCHIVED          content.review
APPROVED  → PUBLISHED · REVIEW · DRAFT · ARCHIVED    content.publish
PUBLISHED → DRAFT · ARCHIVED                     content.publish
ARCHIVED  → DRAFT                                content.write
```

Studio shows only the edges the signed-in role can actually take. An offered control that always
refuses reads as a bug in the product rather than as a boundary — but the server checks again
regardless, because a Server Action is reachable with `curl` and a session cookie.

### Why a publish can be refused

`cms_publish_section` runs the whole transition and its media cascade in one transaction, and
refuses **before writing anything**:

| Code | Meaning |
|---|---|
| RV001 | The section does not exist, or the edge is not one of the twelve |
| RV002 | The section itself asserts an unverified business claim |
| RV003 | A bound asset is not APPROVED — nobody reviewed it |
| RV006 | A bound asset is APPROVED but still `OWNER_VERIFICATION_REQUIRED` |
| RV007 | A restore names media that no longer exists |

**RV006 is the one you will meet.** All 250 imported Higgsfield assets are APPROVED *and*
`OWNER_VERIFICATION_REQUIRED`, which collides with `media_assets_verified_before_publish` from
Phase 03. Nothing that binds one can be published until the owner verifies it in the Media Manager.
This is working as designed — the assets are AI-generated and assert things about Rivya's work that
only the owner can confirm — but it means **the site cannot go live on Higgsfield media alone**.

The picker says so at the moment of choosing, rather than letting an editor build a whole page and
discover it at the last step.

---

## 5. Scheduling

Set `publish_at` on an APPROVED section and `unpublish_at` on a published one. Times are UTC.

Two different mechanisms, and confusing them causes real mistakes:

- **The window is what a visitor sees.** `sectionIsLive` stops rendering a section the moment
  `unpublish_at` passes, whatever the row's status says. This needs no cron and cannot be late.
- **The sweep makes the status agree.** `cms_run_content_schedule` (0053), called by
  `/api/cron/content-schedule`, moves APPROVED → PUBLISHED when the moment arrives and
  PUBLISHED → ARCHIVED when the window closes, so Studio does not show a section as PUBLISHED that
  nobody can reach.

A refused scheduled publish is recorded on the row — `schedule_attempts`, `schedule_error` — and
after three attempts the section goes `BLOCKED` and stops being retried. A permanently
unpublishable section retrying every tick forever is indistinguishable from one that worked.
**Editing the section un-blocks it**, which is the only thing that could have changed the answer.

> **Cadence.** `vercel.json` schedules the sweep once a day at 03:00 UTC, because Vercel's Hobby
> plan permits daily crons only. A section scheduled for 09:00 therefore publishes at 03:00 the
> next day. Hourly or finer requires a paid plan and the owner's approval.

---

## 6. Previewing

`/api/preview?path=/about` enables draft mode for the signed-in staff session and redirects there.
Draft mode ignores status and the window, so an unpublished page renders as it will look.

The **session** is the credential — there is no preview token. A token would travel in the URL,
land in browser history and in the `Referer` of every asset the previewed page loads. The path is
checked against the database as well as against a pattern, which is also what closes the open
redirect.

`DELETE /api/preview` turns it off, and takes no permission: it only ever removes the caller's own
cookie.

---

## 7. History

Every insert and update to a section, page, navigation item, global string or FAQ appends a row to
`content_revisions` — written by a trigger, so nothing can mutate content without the trail
recording it. `revision_no` counts per entity, so one section's history reads 1, 2, 3.

Restoring is `cms_restore_revision`. It needs `content.publish` when the section is currently
PUBLISHED and `content.write` otherwise: rolling back a live page changes what the public sees
without passing through the status workflow, which is the one thing the twelve edges exist to
prevent. The restore itself appends a revision, labelled RESTORE, so history records the rollback
rather than quietly rewinding.

---

## 8. Seeding

`npm run seed:content` applies `content/seed/**` idempotently. Twenty modules, 300 records —
every string from `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` verbatim, plus the two
modules whose strings a component needed and the specification does not supply: `site-chrome`
(Phase 10's shell controls and landmark names) and `catalog-ui` (Phase 14's listing controls). Both
say so in their own headers, so a reader can always tell a quoted sentence from a written one.

```
npm run seed:content -- --dry-run      decide everything, write nothing
npm run seed:content                   apply
npm run seed:content -- --report       apply, and write a line to the Studio activity feed
npm run seed:content -- --only=faq     one module
npm run seed:content -- --force --only=faq   overwrite owner edits in that module only
```

### The five verdicts

Per record, per run:

| Verdict | When | What happens |
|---|---|---|
| `inserted` | No row with that `seed_key` | Written, hash stored, version stamped |
| `updated` | The runner still owns it and the module's copy changed | Rewritten, new hash stored |
| `unchanged` | The runner owns it and nothing differs | **Nothing.** No write, no `updated_at`, no revision |
| `skipped (owner edit)` | A person owns it — see below | Nothing, and the `seed_key` is listed |
| `deferred` | Its target table does not exist yet | Nothing, counted, and the `seed_key` is listed |

`unchanged` is not cosmetic. `write_revision` fires on any UPDATE, so a runner that rewrote every
row on every run would append ~231 revisions per re-seed and the history an editor scrolls through
to find a real change would be almost entirely noise.

`deferred` is not a skip. A skip means a human owns the row and somebody may need to act; a
deferral means the runner *wants* to write and cannot yet. Folding them into one number would hide
a record authored and never applied — which is the specific failure the mechanism exists to
prevent.

### Three guards, any one decisive

Re-seeding never overwrites something a person did. Three independent tests, covering different
things:

- **`seed_content_hash`** — the row's current values no longer match what the seed last wrote.
  This is the only guard that catches an edit made *outside* the application: a direct `psql`
  update, a restore, a bulk import. Such a write sets no `updated_by`, so no trigger fires.
- **`owner_edited`** — set by a trigger whenever a write carries `updated_by`, which every Studio
  save does. One-way by design: nothing clears it, so a seed run cannot un-mark a human edit.
- **A status promotion** — the row is `PUBLISHED` and the module did not ask for that. Catches the
  row a person reviewed and shipped without changing a character, which hashes identically.

The published test is *not* a bare `status = 'PUBLISHED'` check. Route shells and global labels are
seeded published on purpose — a route that arrived `DRAFT` would 404 the whole site — so the
question is whether the row is published *beyond* what the module asked for.

### What is deferred, and to where

22 records are authored now and written later. They live in **one** module each; a test asserts
`seed_key` uniqueness across every module, so a later phase cannot restate them.

| Records | Waiting for | Applied by |
|---|---|---|
| 9 journal categories, 10 article drafts | `journal_categories`, `journal_articles` | Phase 18, `0160` |
| 3 customization form templates | `customization_forms`, `customization_form_fields` | Phase 19, `0170` |

Each is written unchanged when that phase runs `npm run seed:content -- --only=<module>`.

### What the seed will not do

- **No products, ever.** `products` is not a member of the `SeedableTable` union, so a module
  targeting it does not compile. SEED §32: live products come from owner entry, an approved import
  or the confirmed-product workflow.
- **No portfolio projects, no project photographs and no testimonials.** None of the three tables
  is in the `SeedableTable` union, so a module targeting one does not compile. `/portfolio` ships
  §28's empty state and nothing else.

  §28's copy is split between two places, deliberately: the HEADING —
  *The project archive is being prepared.* — is the page's own and sits on the `empty-state`
  section, while the BODY is the shared `EMPTY_STATE.portfolio` row in `global_content`, so
  `/portfolio`, `/journal` and `/collection` say the same kind of thing in the same voice and the
  owner rewords it once. The heading was missing until Phase 17 and the page had been rendering
  half the empty state; `tests/unit/portfolio-empty.test.ts` now asserts both lines verbatim.

  The CTA is §7's reusable *View the Collection*, not §28's *Explore the Collection* — one label per
  destination, recorded as amendment A15·b.
- **No article bodies.** SEED §20 supplies ten IDEAS — a title and an angle each — and says in
  capitals: seed as DRAFT, do not publish automatically. The seed writes the brief and the machinery;
  the writing is the owner's. Three of the ten (§20's 02, 04 and 08) carry
  `OWNER_VERIFICATION_REQUIRED` because §20 attaches a caution to each: room-size standards claimed
  without a source, Rivya-specific fabrication capability, and preservation-performance promises.

  The angle lives in `angle_note` and is rendered NOWHERE. `excerpt` — the line a card shows — is
  left null, because a summary of an unwritten article is a summary of nothing. The Phase 09 records
  put the angle in `excerpt`, which would have published ten editorial briefs as summaries on
  `/journal` the moment anything went live.

  Article covers are bound BY POSITION, not by subject, and an editor should change them. Every
  `editorial` asset is a concept render of a mood; none is a photograph of the piece any of these
  titles is about, because none of these articles is written.

- **No placeholder media.** A slot with no asset is left null and reported as a gap. A binding
  naming an asset that is not in the **manifest** *fails the run* — that is a typo, which is a
  different thing from a gap. A binding naming an asset the manifest carries but `media_assets`
  does not — a database the Higgsfield migration has not been run against, such as CI's throwaway
  PostgreSQL — is left null, reported under `media gaps` in the run summary, and bound by the next
  run after the migration; the run does not fail and nothing is substituted.
- **No invented business facts.** The contact details in `contact.ts` are the ones §21 supplies,
  seeded in one place because §21 forbids hardcoding them in several, and flagged for the owner.
  The location link §21 mentions but does not supply is left null.

### Owner verification

80 seeded rows carry `OWNER_VERIFICATION_REQUIRED` and **cannot be published until the owner clears
them** — `cms_publish_section` refuses with RV002 and a check constraint refuses underneath it.
That is D10 as a schema rule rather than a review convention.

All ten FAQ answers, every process step, the About scale and bespoke sections, three category
descriptions, the homepage's manifesto, material palette, commission, 3D + resin and process
sections, the announcement bar, the brand introduction, `Ready Stock`, and the contact details.
`docs/content/INITIAL_CONTENT_INVENTORY.md` lists every one.

**A CARD CAN BE WITHHELD WITHOUT WITHHOLDING ITS SECTION** (Phase 11). The column above is the
right mechanism when the claim IS the section — the homepage's manifesto and its 3D + resin band
are each one assertion, so the whole row waits. It is the wrong mechanism when a published band
holds one unconfirmed item among five: the homepage's category grid lists five families and two of
them assert production capability, and refusing the section would take the confirmed three off the
front page to withhold the other two.

So a repeating item carries its own flag, inside the payload:

```json
{ "key": "3d-resin", "title": "3D + Resin", "owner_verification": "OWNER_VERIFICATION_REQUIRED" }
```

- Set it in the block's JSON field on any block whose editor mentions it — `category-grid`,
  `material-palette`, `secondary-objects`, `commission-cta`, `process-steps`.
- `NOT_REQUIRED` and `VERIFIED` both render. They are different statements: one says the item makes
  no claim that needs checking, the other that it makes one and the owner has confirmed it. An
  ABSENT flag means `NOT_REQUIRED`, so nothing seeded before this existed disappeared when it
  shipped.
- Clearing a flag is an edit to that one entry, and the item appears on the next revalidation. No
  deploy, no migration.
- Fifteen homepage entries carry it today: two category cards, one material, six commission chips,
  five process statements and one secondary object. They are absent from the live page and their
  five sections are not.

Every repeating item also carries a `key` — a stable name that does not move when the list is
reordered. It becomes `data-entry-key` in the rendered markup, which is how a test can assert that
a withheld item is absent by name rather than by a position that shifts.

### Editorial groupings are not taxonomy

`/large-format` lists six groupings — Dining & Statement Tables, Coffee & Centre Tables, and so on.
**They are `category-list` entries in one section's payload, not rows in the `categories` table.**
The two sets are disjoint and they behave differently:

| | Editorial groupings | Taxonomy categories |
|---|---|---|
| Where | `page_sections.payload.entries` | The `categories` table |
| Routes | **None.** They create no URLs | `/collection/[category]`, one each |
| Edited in | The page's own editor | Studio → Catalogue → Categories |
| Reordered by | Dragging within the section | Their own position column |

A grouping may LINK to a taxonomy category, and often should. What it may never do is grow a route
of its own: `tests/unit/site-routes.test.ts` fails the build if a `/large-format/*` route file
appears, which is what would happen the first time somebody mistook one for the other.

**A link is rendered only when its destination is live.** An entry's `href` is a path you type, and
a page whose sections are all still DRAFT answers 404 — so `resolveInternalTarget` checks it against
the pages that actually render, and a card whose target is not ready renders as text rather than as
a dead link. Nothing is hidden: the words stay, only the anchor goes, and it comes back by itself
the day the destination publishes. The same rule applies to a section's calls to action.

### Writing a process chapter

`/process` is eight sections: a hero and seven chapters. **A chapter is one section carrying one
stage** — `process-steps` with its layout variant set to `chapter` — rather than one section
holding a list of seven. That shape is what lets the owner verify one stage without verifying the
rest, and it is why each chapter has its own picture and its own position.

Three rules follow from it, and each exists because the obvious alternative was tried:

- **Do not put a number in the copy.** The chapter's number is its position among the chapters that
  actually rendered, drawn by the renderer. All seven are `OWNER_VERIFICATION_REQUIRED`, so a page
  with the first, fourth and sixth verified would read "01 04 06" if the numbers were seeded — which
  tells a visitor something has been removed and invites them to wonder what. Numbered by position
  it reads 01 02 03, which is true: these are the stages Rivya has confirmed.
- **Do not fill in `steps`.** A chapter's words are the section's own heading and body. The seed
  used to copy them into a step as well, and the page rendered every sentence twice.
- **The picture is the section's media**, chosen in the section's own image fields. `steps` stays for
  the other shape — the homepage's process band is one section holding five stages.

The bands alternate left/right on the rendered number, so three published chapters alternate from
their own first band rather than inheriting the parity of the seven that were authored.

### What a caption may say

A caption, an alt text or a body on `/about` or `/process` describes **the material or the process
in the frame** and nothing else. It never names a piece, a price, a dimension, a lead time, a
client or an award. Every asset on both pages is `is_concept = true` — AI-developed concept media —
so a caption that named a delivered object would be describing something that does not exist.

`tests/e2e/{about,process}.spec.ts` scan the rendered page for a currency symbol, a number followed
by `mm`, `cm`, `m`, `in` or `ft`, and the words *client*, *customer*, *award*, *warranty* and
*guarantee*. The scan is deliberately blunt: it will occasionally object to an innocent sentence,
and that is the cheaper failure.

### The inventory

`npm run content:inventory` regenerates SEED §54's audit **from the database**, not from the
modules — the question is what is actually there, not what the seed intended.
`npm run content:check-inventory` regenerates and diffs, so a seed that changed the database
without updating the file fails the build.

---

## 8.5 The catalogue's strings, and the one choice hidden in them

Phase 14's listing reads its words from three groups, and nothing in `components/patterns/{ProductCard,
FilterRail,SortSelect,Pagination}` is a literal — `scripts/cms/check-section-copy.ts` fails the build
on one.

| What | Group | Where seeded |
|---|---|---|
| The ten SEED §30 price and badge labels | `COMMERCE_LABEL` | `content/seed/commerce-labels.ts` (Phase 09) |
| Filter group names, sort options, pagination, the two facet values §30 has no word for | `UI_LABEL` | `content/seed/catalog-ui.ts` |
| Apply, Clear Filters, Previous, Next | `ACTION_LABEL` | `content/seed/catalog-ui.ts` |
| "This collection is being prepared" (SEED §27) | `EMPTY_STATE` | `content/seed/global-content.ts` (Phase 08) |
| "No pieces match these filters." | `EMPTY_STATE` | `content/seed/commerce-labels.ts` (Phase 14) |

**The two empty states are different sentences on purpose.** SEED §27 is true of a category with
nothing published in it. It is FALSE of a category full of pieces none of which match the filters a
visitor just applied — and telling someone a collection is unfinished when it is one checkbox away
is how they leave. The filtered case names the filters as the cause and renders "Clear Filters"
beside it.

**`From` or `Starting from` — the owner chooses, and the mechanism is DISABLING one.** SEED §30
lists both, and they are two spellings of one state's label. `lib/catalog/price.ts` resolves
`COMMERCE_LABEL.from` first and falls back to `COMMERCE_LABEL.starting_from`, and `siteStrings()`
drops any row whose `is_enabled` is false. So:

- Leave both enabled → the card reads **From ₹12,500**. The shorter spelling, which is what fits.
- Disable `From` in Studio → the card reads **Starting from ₹12,500**. No deploy, no code change.
- Disable both → the card shows no price row at all, because there is no label to show. That is the
  general rule for every string on this site, not a special case: a missing row renders nothing
  rather than an English default nobody wrote.

**A facet with no label does not render.** The same rule, applied to a checkbox: an unlabelled option
is worse than an absent one, because a visitor can tick it and cannot tell what they ticked.
`OPEN_EDITION` and the `large-format` scale value are the two facet values SEED §30 has no word for —
the first because it is the ABSENCE of a scarcity claim and never appears on a card, the second
because it is a filter and not a badge — so both are `UI_LABEL` rows rather than an eleventh and
twelfth commerce label.

## 9. What Phase 10 inherits

- **The 12 unbuilt blocks.** Phase 11 built the ten the homepage needed, so all thirteen of its
  sections now render; the remaining twelve belong to pages Phases 12–19 compose. That is the split
  amendment A8 records.
- **A repeater UI.** A block with repeating items is edited as JSON today — validated on save
  against its own schema and refused rather than coerced. An honest admission, not a placeholder.
- **The `t()` swap.** `components/studio/strings.ts` still serves Studio copy from constants, and
  `studio-help.ts` now seeds the same strings into `global_content` under the keys each constant
  declares. Making `t()` read the database with the constant as its fallback is the remaining half;
  it was deliberately not done in the same commit that first wrote the rows, because the login page
  would then depend on a seed having been run against that environment.
- **The public routes.** Nothing under `app/(site)/` consumes `resolvePage` yet. The copy, the
  windowing, the media resolution and the renderers all exist; no route calls them.

## 10. Search engines and social cards — Phase 39

**Every page resolves its metadata through one ladder, per field, first hit wins:**

| Rung | What answers | Where it is edited |
|---|---|---|
| ENTITY | a `seo_entries` row of scope ENTITY for this one product, category, collection, project or article; beneath it the entity's own columns (`products.seo_title`, `categories.seo_description`) | the SEO panel on the entity's editor, or `/studio/content/seo?tab=entities` |
| PATH | a `seo_entries` row of scope PATH for this address | `/studio/content/seo?tab=pages` |
| DERIVED | the page's first `heading` and the first 155 characters of its first `body`, cut on a word boundary — never a sentence invented, never two sections joined | nowhere: it is a default, and the Coverage tab counts it as one |
| GLOBAL | the single GLOBAL row and the `SEO_DEFAULT` / `SOCIAL` strings (SEED §41, §44) | `/studio/content/seo?tab=global` |

The Studio prints the rung beside every field, so an editor always knows whether they are reading
their own words or a default. The title template (`%s | Rivya Living Art`) is applied to a page
title and never to a title that resolved from the GLOBAL rung, which is how `/` renders the brand
once.

**Canonical and robots** follow one table: a static path is canonical to itself; a filtered
listing is canonical to the unfiltered category and `noindex, follow`; page 2 onward of a bare
listing is canonical to itself with `rel=prev/next`; `/search` has no canonical and is `noindex,
follow`; an owner-set canonical must be absolute and on the site's own origin. A page with no
published section is `noindex` whatever its row says. `/studio/**` and `/api/**` carry
`X-Robots-Tag: noindex, nofollow` on every response, and so does every route of a non-production
deployment.

**Structured data** is an allowlist of eight types, each emitted by one builder that returns
nothing when its gate fails: `Organization` and `WebSite` on every page (the brand row not awaiting
verification), `BreadcrumbList` on entity routes (real published parents only), `Product`
(`offers` only for a FIXED price on a VERIFIED row — no rating, review, GTIN, MPN or availability,
ever), `CollectionPage`, `Article` (the author is the studio unless a VERIFIED byline names a
person), `FAQPage` (only VERIFIED rows; none verified, no block) and `ContactPoint` (the contact
section VERIFIED; never an address). `LocalBusiness`, opening hours, shipping and return terms,
awards and certifications are never emitted anywhere — each is a claim the studio has not made.

**Keyword themes** (`/studio/content/seo?tab=keywords`) are the seventeen SEED §42 themes as
research targets: theme, mapped path, status, notes and an evidence link. SEED §42 is binding —
"the actual SEO strategy must be refined through research before claiming ranking opportunity" —
so no volume, difficulty, rank or opportunity figure is recorded anywhere; the table has no column
for one. No keyword string is rendered on a public page and there is no keywords meta tag.

**Redirects** (`/studio/content/seo?tab=redirects`) are consulted only on an address that would
otherwise be a 404, followed one hop, and refused at save time when they would loop or chain. A
product whose address changes in Studio offers a redirect from the old address, pre-ticked.

