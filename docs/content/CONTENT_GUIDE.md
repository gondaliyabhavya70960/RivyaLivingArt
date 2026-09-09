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

## 2. The 28 blocks, and the seventeen that are built

`lib/cms/block-types.ts` lists the whole PHASE-05-09 §08 catalogue. Seventeen are built; 11 are
declared `PLANNED` (amendment A8). Phase 08 built the first six, Phase 11 added the ten the
homepage needed, and Phase 12 added `scale-statement` — the one block `/about` was still missing.

| Built | Payload family it proves |
|---|---|
| `hero` | Media-only — the desktop/mobile pair, a poster slot, and two motion slots |
| `statement` | No payload at all |
| `category-grid` | Repeating items with indexed media references, and entry-level verification |
| `process-steps` | Repeating items, ordered — the number is the content |
| `empty-state` | Query-and-global: its message comes from `global_content` |
| `divider` | No payload **and** no copy fields |
| `manifesto`, `final-cta` | No payload — everything they show is a shared copy field |
| `selected-works`, `portfolio-strip`, `journal-strip` | **Reference blocks**: they render entities that may not exist, and show a seeded `EMPTY_STATE.*` sentence when there are none |
| `material-story` | Media positions with no labels — the words are the section's own heading |
| `material-palette`, `secondary-objects` | Repeating items with entry-level verification |
| `commission-cta` | Chips, each verifiable on its own |
| `three-d-resin` | A reserved slot for Phase 21's viewer that renders nothing while empty |
| `scale-statement` | No payload; a 21:9 desktop crop paired with a separate 4:5 mobile asset |

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

`npm run seed:content` applies `content/seed/**` idempotently. Eighteen modules, ~231 records,
every string taken from `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` verbatim.

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
- **No portfolio projects and no testimonials.** `/portfolio` ships §28's empty state and nothing
  else.
- **No placeholder media.** A slot with no asset is left null and reported as a gap. A binding
  naming an asset that is not in `media_assets` *fails the run* — that is a typo, which is a
  different thing from a gap.
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
