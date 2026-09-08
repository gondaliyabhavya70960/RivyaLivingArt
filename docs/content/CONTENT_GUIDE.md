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

## 2. The 28 blocks, and the six that are built

`lib/cms/block-types.ts` lists the whole PHASE-05-09 §08 catalogue. Six are built; 22 are declared
`PLANNED` (amendment A8).

| Built | Payload family it proves |
|---|---|
| `hero` | Media-only — the desktop/mobile pair, plus a poster slot for video |
| `statement` | No payload at all |
| `category-grid` | Repeating items with indexed media references |
| `process-steps` | Repeating items, ordered — the number is the content |
| `empty-state` | Query-and-global: its message comes from `global_content` |
| `divider` | No payload **and** no copy fields |

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

`npm run seed:content` applies `content/seed/**` idempotently. Phase 08 adds two modules:

- **`pages`** — one row per static D3 route, plus the reserved SYSTEM row. Structure only: no
  sections, therefore no copy.
- **`global-content`** — the strings the renderers require. The media chrome is written here; the
  three empty states are SEED §27, §28 and §29 **verbatim**.

**Re-seeding never overwrites something a human typed.** The runner hashes what it wrote; if the
row's current values no longer match that hash, a person edited it and the row is skipped. It also
never changes `status` on an existing row, so a page an editor archived stays archived.

---

## 9. What Phase 09 inherits

- The 22 unbuilt blocks.
- A repeater UI. A block with repeating items is edited as JSON today — validated on save against
  its own schema and refused rather than coerced. An honest admission, not a placeholder.
- Section copy for all twelve pages, each carrying its own classification and verification flag.
- `t()` in `components/studio/strings.ts` reading from `global_content` instead of its constants.
  Every entry already declares the row it becomes, so nothing in `app/(studio)/**` changes.
