# PROJECT_STATE — what is actually built

> Verified against the repository, not against intent. Update at the end of every phase.
> Last verified: Phase 42 (Comprehensive Testing), 2026-09-11. Phases 43 and 44 landed
> between them; Phase 42 ran last, by the owner's instruction to finish development first.

## Summary

The design system is built; the database spine exists, carries RLS policies for all six roles, and
has been verified against a real PostgreSQL **and against the hosted Supabase project**. What
exists: the toolchain, the token layer, 32 primitives, 3 motion helpers, 7 behavioural patterns, a
dev-only gallery, **seventy-one tables, all with RLS on and 240 policies between them, plus the first
derived VIEW in the schema**, generated types with a
drift gate, a repository layer with Zod at its boundary, an idempotent seed runner proved not to
overwrite an owner's edit, the Studio shell with its ⌘K palette and user management, the media
layer end to end, the Higgsfield migration, gap engine and tracker, **the CMS engine — pages,
blocks, the status workflow, media binding, scheduling, revisions and the Studio surfaces that
drive them** — a forward-only migration runner, and **33 gates** that fail the build on the
mistakes they were written for — the most consequential enforces the research isolation invariants:
it refuses a foreign key crossing the research/public boundary except the ONE named exception
amendment A26 argues for, an `anon` policy on any research table, an `anon` GRANT on any research
VIEW (a view has no policies, so its grants are the whole of its access control), a research
identifier anywhere under the public trees, and any path from the scraper to a catalogue write or to
a headless browser.

**Everything published is findable.** `search_documents` holds one flattened document per indexed
entity across eight types, maintained by eleven triggers rather than by a job, and
`research_search_documents` sits beside it — created empty, no `anon` policy — so the boundary
between the first-party catalogue and the research corpus that Phase 25 begins is visible in the
schema before that subsystem exists. `/search` returns grouped, ranked, paginated results and the
seeded SEED §26 empty state; the header carries an ARIA 1.2 combobox that submits a plain GET form
without JavaScript; the Studio palette reaches products, categories, collections, materials,
projects, articles, media and enquiries, each behind its own permission. An enquiry's document
carries a reference code, a kind, a product title and a status, and a test proves it carries no name,
phone number, email address, city or message.

**Relationships are data, and nothing invents one.** Nine relation names are fixed by CHECK on both
relation tables; four suggestion rules propose and none writes; every persisted edge records whether
a person made it or agreed to it; a dismissed suggestion never returns; and the three reciprocal
types create and destroy their inverse together. `/studio/catalog/relationships` is built.

**A page can now be built and rendered, and the copy is written.** `/studio/content/pages/[pageId]`
adds, edits, reorders and removes blocks; `lib/cms/resolve.ts` is the single server read path;
`components/sections/` renders six of the twenty-eight catalogue blocks. A test takes rows out of a
real PostgreSQL, parses them with the repository's own schemas and renders the page, so the chain
from column to markup is proved end to end and not only in fixtures.

**The public website exists.** `app/(site)/` carries a shell — skip link, announcement, header with
a keyboard-complete mega menu, `<main id="main">`, footer — and thirteen route files, one per D3
static path. Every string in that chrome is a `navigation_items`, `global_content` or
`contact-details` row; `npm run cms:check-copy` fails the build on a literal. Twelve routes build
static and are invalidated by `app/api/revalidate`; `/search` is dynamic because its query is its
state. Verified on a production build against a local PostgREST: `/process` 404 → publish its
sections → POST to the endpoint → 200, with `sitemap.xml` gaining exactly that path.

**The content seed is applied.** 20 pages, 53 sections, 10 FAQs, 47 navigation items, 9 SEO
entries and the global string library — 231 records, every one from the specification verbatim, 22
more authored and deferred to Phases 18 and 19. `docs/content/INITIAL_CONTENT_INVENTORY.md` audits
all 332 of them, generated from the database.

**The homepage is a composition.** Sixteen blocks were built for it — Phase 11 added
the ten the homepage needed — and all thirteen SEED §10 sections render from the CMS in seeded
order. Verified on a production build against a local PostgREST, with the sections walked to their
launch-day state: eleven publish, two are refused by the publish gate because the claim IS the
section, all fifteen entry-level withholdings are absent from the page, and the five sections around
them still render. 171.7 kB of gzipped client JavaScript, five client islands, no horizontal
overflow at any of the eight QA widths.

What does not exist: **a page a visitor can read**, and the reason is unchanged. Every route
renders, and every one answers 404, because Phase 09 seeds all 53 sections `DRAFT` and
`renderCmsPage` refuses to serve a published route with nothing on it — SEED §55, as code.
Publishing is an editorial act in Studio, and 25 of those sections cannot be published at all until
the owner verifies what they claim. Eight of the thirty-two blocks are still declared and
unbuilt (amendments A8, A14 and A15); a block with repeating items is edited as JSON until a repeater is built. No
product rows, and there will be none from a seed — `products` is not a member of the
`SeedableTable` union. **No media**: `media_assets` is empty until the Higgsfield migration runs, so
every image on every page is the SEED §47 fallback well and no visual baseline of a page is worth
taking yet.

**80 seeded rows await owner verification** and cannot be published until it is given — every FAQ
answer, every process step, and every sentence that asserts what Rivya can physically make.
`cms_publish_section` refuses them with RV002. That is D10 as a schema rule.

**The media migration has RUN.** All 250 Higgsfield assets are in Cloudinary — 231 uploaded, 19
adopted from an earlier partial run, 0 failed — and `media_assets` holds 250 rows on the local
cluster and on hosted, verified by two independent fingerprints (structural and full-text) that
matched exactly. Fidelity was checked against the plan before any database write: the id set matches
the manifest exactly, no id was invented, no `rivya_asset_id` or `generation_id` drifted, and all 26
videos carry a duration.

**What still blocks the site going live is owner-side and is one thing, not two.** Every one of
those assets is APPROVED *and* `OWNER_VERIFICATION_REQUIRED`, so `cms_publish_section` refuses
(RV006) any section that binds one until the owner verifies it. Recorded in *Remaining Work*.

**Collections are exhibitions, and none of them is published.** Phase 16 promoted `collections` from
a Phase 03 stub: eight new columns, a linked exhibition page, `entity_relations` for hand-made edges,
and two gates in the database — a collection cannot reach PUBLISHED unless its concept is
OWNER_CONFIRMED, and only an owner or admin can confirm one. The ten FEAT §9 concepts are seeded as
a name, a slug and an order, with no statement, no media, no products and no page: verified against
the database as ten rows, all DRAFT, zero with any content column set, zero published, zero pages of
kind COLLECTION. `/collections/<slug>` therefore answers 404 for all ten, which is the finished state
of the phase rather than an unfinished one. That phase took the block catalogue to 30, of which 22 were built
(amendment A14); the exhibition template inserts ten of FEAT §8's eleven elements, because the
eleventh maps to a block that renders nothing.

**The project archive exists and holds nothing.** Phase 17 added `portfolio_projects`,
`portfolio_project_media` and `testimonials`, all three with zero rows and no way for a seed to add
one — none is a member of `SeedableTable`, so a record targeting one does not compile. Publishing a
project needs two independent things: an owner has confirmed it happened, and — if it names a client
— that client's consent is recorded as GRANTED with a reference saying where the consent is held.
Both are enforced in the database by `enforce_project_evidence_gate()` and
`enforce_testimonial_evidence_gate()` — two functions, one per table, because a shared plpgsql
function referencing both tables' columns fails at runtime on the first write to whichever it was
not written for. Withdrawing consent archives the row on the same statement; the phase document's
own pseudo-code had that branch last, where it would have REFUSED the withdrawal and left the
project live under the name of somebody who asked not to be named (amendment A15·a).

`/portfolio` therefore renders SEED §28's empty state and `/portfolio/[slug]` answers 404 for every
slug, which is the finished state of this phase. Writing the test for that empty state found that
§28's HEADING had never been seeded — only its body — so the page had been rendering half of it
since Phase 09.

**The Studio can author one, end to end.** `/studio/content/portfolio` lists projects with a
permanent zero-row explanation and creates one from a title and an address; the editor carries
Verification, Identity, Client and consent, the story page (a `PROJECT` page with four starting
bands), the gallery and related content, with publish and unpublish under the verification panel.
`/studio/content/testimonials` does the same for quotes. `lib/portfolio/gates.ts` names the unmet
gate before Publish is pressed, and `tests/unit/rls/phase17.test.ts` holds that mirror and the
triggers to agreement across the full input matrix. `evidence_note` is unreadable to `anon` at the
grant (`0152`) — a column-level REVOKE alone was measured and had no effect at all.

**The block catalogue is 32, of which 24 are built.** `project-gallery` is the first block
restricted to one page kind (`allowedPages: ['/portfolio/[slug]']`), because it reads the gallery of
whichever project owns the page it sits on and is meaningless anywhere else. RC-219 `PortfolioCard`
is built and replaces Phase 11's `ReferenceCards` placeholder for projects.

**The journal exists, and holds ten ideas rather than ten articles.** Phase 18 added
`journal_categories`, `journal_articles` and `journal_article_categories`, and resolved the nineteen
records Phase 09 authored and deferred: nine SEED §19 categories (PUBLISHED — a category is taxonomy,
and a DRAFT one is a page that 404s) and ten SEED §20 article IDEAS, all DRAFT, each a title and an
angle with no body. §20 forbids publishing them automatically, and three carry
`OWNER_VERIFICATION_REQUIRED` because §20 attaches a caution to each.

Two rules that could have been application-only are in the database instead.
`set_article_reading_minutes()` derives `reading_minutes` from the linked page's visible sections at
200 words per minute and overwrites anything a caller sends — probed with 999, stored NULL — and
`enforce_article_has_body()` refuses to publish an article with no page, an empty page, or a page
whose only section is hidden. `journal_articles` is the only table on the site whose public read is
gated by a date: `published_at <= now()`, which is both the scheduling mechanism and the guard that
does not depend on a cron running on time.

`lib/cms/related.ts` holds FEAT §11's single automatic rule — curated edges first, then a
same-category fill, labelled as what it is — with a test that asserts the rule does not fire when
curation is sufficient and never repeats an article an editor already linked. `/journal`,
`/journal/[slug]` and `/journal/category/[slug]` all render; with nothing published the landing is
SEED §29's sentence and every article URL 404s. RC-220 `ArticleCard` is built.

**The studio can be asked for something it has not made.** Phase 19 added `customization_forms`,
`customization_form_steps`, `customization_form_fields`, `product_customization_forms` and
`feature_flags`, and resolved the three commission templates Phase 09 deferred: `FURNITURE`,
`PRESERVATION` and `THREE_D_RESIN` — 33 steps and 40 questions, all DRAFT, the last two
`OWNER_VERIFICATION_REQUIRED` because their options are not confirmed. Exactly one question is a
SELECT (`project_type`); every other choice is left open, because a list of options is a claim about
what the studio makes.

**Nothing in that group can hold a price.** `customization_form_fields.validation` carries an
allowlist CHECK of nine Zod keys, so `price_multiplier` and its relatives are rejected by the same
expression that keeps the object Zod-shaped, and the field-type enum has no money in it.
`tests/unit/no-pricing.test.ts` greps the migration and is mutation-tested against two deliberately
broken copies of the schema — both of which it originally passed, one because SQL doubles a quote
where JavaScript backslashes it, the other because `\b` creates no boundary before `_`.

**The configurator is built and switched off.** Eleven steps, one screen each, every question read
from the tables and the Zod schema generated from the same rows. It ends at a validated payload:
the review step's Submit button is rendered disabled with no handler, because D1 requires an inquiry
to be persisted before any WhatsApp redirect and persistence is Phase 20. `commission_configurator`
ships off, so `/custom-commissions` keeps its Phase 09 copy; `isEnabled()` is evaluated server-side,
so an off feature is absent from the response rather than hidden in it.

**Two Studio surfaces and a rate limiter came with it.**
`/studio/catalog/customization-forms` and its `[formId]` builder — one collapsed column with numeric
ordering, publish gating that states its three refusals before the button, and *Duplicate from
template* as a single-transaction database function (amendment A19). `/studio/system/flags` reads
for all six roles and writes for two (amendment A17). `rate_limit_buckets` and
`consume_rate_limit()` arrived twenty-two phases early because `app/api/inquiries/upload-sign` is
unauthenticated by design and an unlimited credential minter is an open file host with the studio's
Cloudinary bill attached (amendment A18).

**The funnel ends somewhere.** Phase 20 added `inquiries`, `inquiry_attachments` and
`inquiry_events`. `inquiries` is the ONLY table on the site a stranger may write and the only write
with no session behind it — D1 forbids customer accounts — so the anon INSERT policy is the guard,
pinning the row to the start of the pipeline, unassigned, with no claimed editor and no claimed
handoff. None of the three has an anon SELECT policy of any kind.

**Persist, then redirect, is enforced three ways rather than remembered.** `buildHandoffUrl` takes a
non-optional `inquiryId`; `submitInquiry` returns a discriminated union whose failure member has no
`whatsappUrl` property at all; and `tests/unit/inquiry-persistence.test.ts` forces the insert to
throw and asserts the returned object carries nothing that could be navigated to.

**Two findings came out of building it.** PostgreSQL applies the SELECT policy to an INSERT's
RETURNING clause, so on a table with an insert policy and no select policy the write succeeds and
the read-back is refused with a message that reads like a rejected write — which is why the caller
generates the id and `inquiry_reference_code()` returns the code (amendment A20). And the
append-only trigger on `inquiry_events` refused the CASCADE from `inquiries`, making an enquiry
undeletable by anybody including a superuser; migration `0193` narrows it so an event may go only
with the enquiry it belongs to.

**The public surfaces are the contact form, a product enquiry and the configurator.** `contact-form`
is the first block in this repository promoted from planned to built. The product path needs no
dialog: Phase 15's rail links to `/contact?product=<slug>`, the form reads it after mount, and a
slug that no longer resolves files a GENERAL enquiry rather than losing one. The configurator's
Submit is live and Phase 19's disabled button remains its behaviour when the new prop is absent.

**The inbox fills all five D4 routes from one component**, with a detail screen that renders the
brief against the form that produced it, an append-only timeline, a pipeline, notes and assignment.
The CSV export is gated on `inquiries.export`, audited including refusals, and omits `ip_hash` and
`user_agent` at the query rather than in the writer.

**`commission_configurator` is ON, on both databases.** Nothing appears on `/custom-commissions` yet
because all three commission templates are still DRAFT — the flag says the feature is built and
publication stays the owner's editorial act.

**Demonstration content exists, is marked, and is removable in one command.** The owner authorised
placeholder data for launch preparation: 30 products, 10 article bodies, 6 portfolio projects and 6
testimonials, every row carrying `is_demo` (migration `0180`), registered in
`docs/content/DEMO_CONTENT.md` and badged in the Studio. It is seeded by `npm run demo:seed` and
removed by `npm run demo:purge`, both separate from the content runner so the two can never be
confused. **Hosted currently carries 20 of the 30 products and the six categories and nothing else
of it** — the run was interrupted part way and has not been resumed pending the owner's decision.

**Writing the seed test found a publishing defect.** The Phase 09 records put each article's angle —
the studio's internal brief — into `excerpt`, which is what a card renders. Ten editorial briefs
would have appeared on `/journal` as summaries the moment anything went live.

**The Playwright suite cannot execute in this sandbox.** The network policy denies the Supabase host,
so every route answers 500 and no page can be measured — the first run of the Phase 16 spec reported
`expected 404, received 500` and pointed at collections before that was diagnosed. The spec now
checks a baseline route and skips with the reason, never in CI. Phase 15's three specs are in the
same position. Unit, RLS, seed and gate verification all run here and pass.

**The hosted project is level with the repository through `0193`.** Phase 20's `0190`, `0191` and
`0193` were applied through the Supabase MCP server with a ledger row and checksum on both sides,
and hosted matches local exactly: 41 tables, 160 policies, 55 migrations. `commission_configurator`
is switched on in both.

**The hosted project was level with the repository through `0184`.** Phase 19's `0170`-`0172`, the
demonstration marker `0180`, the publication-date fix `0181`, the rate limiter `0182`-`0183` and the
duplicate function `0184` were all applied through the Supabase MCP server, with a ledger row and
checksum written on both sides. Schema-verified identical to local: 38 tables, RLS on every one,
153 policies, the six `is_demo` columns and `cms_duplicate_customization_form()` as SECURITY INVOKER
with `anon` revoked.

**The hosted project was level with the repository through `0161`.** Phase 18's `0160`/`0161` were
applied through the Supabase MCP server, and the nine categories, ten drafts and nine journal UI
strings replayed there with local's own seed metadata, so the runner still owns them. Verified
against local by a 178-line fingerprint over the journal objects.

That comparison first reported a mismatch and the cause is worth recording: `pg_get_indexdef`
renders an operator class according to the READER's `search_path`, so the trigram index showed as
`extensions.gin_trgm_ops` locally and `gin_trgm_ops` on hosted while being the same index — same
opclass, same schema, same extension, checked directly against `pg_opclass`. Read with the same
`search_path` on both sides the fingerprints are identical (`f55c1a1e3258265162046c0288386bb0`). Any
future fingerprint must fix the search_path on both sides or it will chase this again. The gates were
also proved to BEHAVE on hosted inside a probe that rolled itself back.

**The hosted project was level with the repository through `0153`.** Phase 17's `0150`–`0153` were
applied through the Supabase MCP server and verified against local by a 146-line fingerprint over
columns, constraints, policies, indexes, triggers, function bodies, security flags, ACLs and enum
values, which matched exactly (`79215119657489fc98cdff8f6ead4d5c`). Applying them was not optional:
the Vercel build had failed on `Failed to collect page data for /portfolio/[slug]` with PGRST205,
because `generateStaticParams` runs at build time and queried a table hosted did not have —
`generateStaticParams` now also treats a missing table as "no paths" rather than taking the whole
site's build down.

**The hosted project was level with the repository through `0143`.** Phase 16's `0140`–`0142` and the
`0143` revoke were applied through the Supabase MCP server — hosted was at `0132`, so the revoke was
outstanding there too — and verified against local by a 106-line fingerprint over columns,
constraints, policies, indexes, triggers, function bodies, security flags, ACLs and enum values,
which matched exactly. The publish gate, the self-edge check and the blank-note check were each
shown to FIRE on hosted, inside a probe that rolled itself back. The ten concepts are replayed
there with local's seed metadata.

**The hosted project is level with the repository.** Every migration through
`0132_phase15_specifications_omitted.sql` is applied to `ccvarsmzickdkryoakdg` and recorded in
`public.schema_migrations` with the runner's own SHA-256, so `db:migrate` treats them as applied
rather than pending. Phase 14's `0120`–`0122` and Phase 15's `0130`–`0132` were applied through the
Supabase MCP server — this sandbox cannot reach the pooler — and each set was then verified against
local by fingerprint rather than assumed: column hash, constraint definitions, policy expressions,
index definitions, trigger names, enum values and the `is_valid_dimensions` function body all match,
and the function refuses `{"length_inches": 90}`, a zero, a negative, a string value and an array
identically on both.

Hosted content has been replayed and fingerprint-matched across all seven content tables.
`content_seed_runs` is deliberately EMPTY there: copying the local audit row would assert a seed run
that never happened on that database.

`0050`–`0055` and `0070`–`0071` were applied through the Supabase MCP server rather than by
`npm run db:migrate`, because the workflow that runs it lives on GitHub Actions, which has never
executed a step on this repository, and this sandbox's proxy refuses a Postgres connection to the
pooler. The ledger rows carry the same per-file SHA-256 the runner computes, so a run from a
machine that can reach the database sees them as applied and unedited.

Verified after applying, not assumed: `deferred_count` present, ten `content_seed_version` indexes,
`set_owner_edited` running as SECURITY DEFINER, and `BRAND` in the group constraint.

`0050`–`0055` were applied through the Supabase MCP server rather than by `npm run db:migrate`,
because the workflow that runs it lives on GitHub Actions, which has never executed a step on this
repository, and this sandbox's proxy refuses a Postgres connection to the pooler. The ledger rows
carry the same SHA-256 of each FILE that `scripts/db/migrate.mjs` computes, so a future run from a
machine that can reach the database sees them as applied and unedited rather than re-applying them.

**Verified after applying, not assumed from six success replies.** Hosted reports 7 CMS tables, all
with RLS on, 90 policies (identical to local), 6 `cms_*` functions, 8 triggers on `page_sections`,
and `page_sections_media_needs_slot_key` present. The only difference between the two schemas is
`public.schema_migrations` itself, which `db:reset` does not create locally.

**Hosted carries no content yet.** The whole seed — 231 records — has been applied locally only.
It is one command from a machine that can reach the database: `npm run seed:content`.
Hand-inserting those rows here would have written them without the `seed_content_hash` the runner
uses to tell its own writes from an owner's edit, which would make every future run skip them
permanently. The schema is ready for them; nothing else is needed.

**GitHub Actions executes since the repository went public on 2026-09-10.** Every earlier run died
unassigned in 2–3 seconds with a 404 on its logs — 57 of them when this was first written,
unchanged after a payment method was added — because a private repository's minutes are metered
and the allowance was spent. The first real runs found five defects the local `npm run check` never
ran, all fixed (`CHANGELOG.md`, "CI runs again"); the `verify` job now migrates, seeds, builds
against `scripts/db/local-rest.mjs` and runs the RLS suites on every push. Playwright is still
local only, so every browser figure in this document is from a local run.

## Phase status

| Phase | Title | Status | Evidence |
|---|---|---|---|
| 00 | Repository Audit & Baseline | **COMPLETE** | Audit performed on an empty repo (single initial commit, README only). Requirements captured to `docs/requirements/`. `.gitignore` added. |
| 01 | PRD, Architecture & Documentation | **COMPLETE** | `docs/architecture/CANONICAL-DECISIONS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SCRAPER.md`; `docs/project/PRD.md`, `BUSINESS_RULES.md`, `ROADMAP.md`, `phases/`; `docs/ops/*`; session-recovery file set. |
| 02 | Reference UI Audit + Design System | **COMPLETE** | Toolchain, token layer, 32 primitives, 2 motion helpers, 7 behavioural patterns, dev gallery, 5 gates. 282 unit tests, 104 e2e across the 8 QA widths, 16 visual baselines. |
| 03 | Supabase Database + Data Layer | **COMPLETE** | Migrations `0001`-`0008` applied and verified against PostgreSQL 16.13. 10 tables, 6 enums, 2 functions, 24 indexes, RLS on everywhere with no policy. Generated types + drift gate, 6 repositories, Zod schemas, seed runner proved idempotent and owner-edit-safe. 5 new gates, 35 new tests. |
| 04 | Supabase Auth + RBAC + RLS | **SUBSTANTIALLY COMPLETE** | Migrations `0009`-`0012`, 51 RLS policies across 12 tables, the permission matrix as generator input, Studio login/sign-out/user-management, 6 new gates. **10 of 11 verification steps pass** against a real PostgreSQL; step 8 (audit trail end to end) and the authenticated half of step 6 need a reachable Supabase project — both are `test.fixme` in the spec, not omitted. |
| 05 | Studio Foundation | **SUBSTANTIALLY COMPLETE** | The D4 route map as one manifest (58 leaves + `/studio`), the shell and top bar, the Overview with all three tabs, migrations `0020`/`0021`, 15 Studio primitives, the ⌘K palette with its provider registry and search endpoint, per-user chrome. 8 of 10 D9 points; the two gaps are the per-role e2e matrix and the shell's visual baselines, both needing a reachable Supabase project. |
| 06 | Cloudinary Media Architecture | **COMPLETE** | `MediaProvider` behind `getMediaProvider()`, with a build gate proving `lib/media/providers/cloudinary.ts` is the only SDK importer. Migrations `0022`/`0030`/`0031` applied to both databases. Six presets and the srcSet ladder matching `CLOUDINARY.md` §5. `app/api/media/sign` with five gates before the signature. `MediaImage` + `MediaVideo` (RC-232/233, both BUILT). Six Media Manager sections from one component. **All three canaries uploaded to the live account**, which is how the `g_auto` defect was found. 5 new gates, 656 unit tests. The §8 rate limit is Phase 41's table and is not enforced; `/studio/media/higgsfield` is Phase 07's. |
| 07 | Higgsfield Asset Audit + Initial Asset Plan | **COMPLETE** | The migration script, its committed ledger, migrations `0040`/`0041` on both databases, the 26-slot registry and `computeGaps()`, the tracker at `/studio/media/higgsfield` with all thirteen FEAT §34 columns and six filters, a read-only drawer with no regenerate control, and two guards wired into CI and `npm run check` — the regeneration guard verified to FAIL on a planted `WALL-ART-001` brief, and the status-document generator verified idempotent. **The migration has run**: all 250 manifest assets are in Cloudinary (231 uploaded, 19 adopted, 0 failed) through the Cloudinary MCP, and `media_assets` holds 250 `HIGGSFIELD` rows locally and on hosted, fingerprint-matched. `higgsfield_migration_runs` still holds 0 rows on both, because the MCP path bypassed the CLI ledger — recorded, not hidden. |
| 08 | CMS / Editable Content System | **COMPLETE** | Migrations `0050`–`0055` on both databases. The status trigger, revision writer, `sync_media_usages`, four `cms_*` SECURITY DEFINER functions, the block registry with 28 declared types, six built renderers, the Studio content surfaces, the preview route and the schedule cron. Amendments A7/A8. |
| 09 | Initial Website Content Seed | **COMPLETE** | Migration `0070`/`0071`, 15 seed modules, 231 records applied locally and 22 authored-and-deferred, the four-outcome runner contract, and `INITIAL_CONTENT_INVENTORY.md` generated from the database — 332 rows, 80 awaiting verification. Hosted carries none of it yet. |
| 10 | Public Website Foundation | **COMPLETE** | `app/(site)/` with the shell and thirteen route files, `renderCmsPage`, `MediaSlot`, the metadata/robots/sitemap/revalidate plumbing, the WhatsApp module and its usage gate. Verified against a local PostgREST on a production build; amendments A9/A10. |
| 11 | Homepage + Material Experience | **CODE COMPLETE; NOT MEASURED** | Ten new renderers (16 of 28 blocks built), entry-level owner verification, the three reference selectors and their editorial fallback, `HeroMotion` and `MaterialSequence`, the island-budget gate, the homepage JSON-LD. 8 e2e specs across 8 widths, 924 unit tests. Amendments A11/A12. **What is not done is the measurement**: LCP, CLS and INP are unmeasured because there is no media to measure, and `tests/e2e/homepage.visual.spec.ts` is deferred for the same reason. |
| 12 | About + Process | **CODE COMPLETE; NOT MEASURED** | `scale-statement` built (17 of 28 blocks), the `/process` chapter layout with positional numbering, `ChapterMedia` (RC-216) loaded on demand, the Studio verification banner and its nine seeded notes. 933 unit tests; `about.spec.ts` and `process.spec.ts` green at 1440 and 390 with zero serious axe violations. Both pages verified against a live database in their launch state — `/about` renders three of five sections, `/process` its hero — and `/process` was walked through a three-chapter state to prove the renumbering. Visual baselines deferred for the same reason as Phase 11: there is no media. |
| 13 | Large Format Experience | **CODE COMPLETE; NOT MEASURED** | `category-intro`, `category-list` and `customization-note` built (20 of 28 blocks), `lib/site/resolve-target.ts` and the live-path set on `getSiteChrome`, entry-level marks on three of the six groupings. 942 unit tests; `large-format.spec.ts` green at 1440 and 390. Verified against a live database: 4 of 5 sections publish, exactly the three confirmed groupings render, and both CTAs are dropped while `/custom-commissions` has nothing published — then reappear when it does. Visual baselines deferred; there is still no media. |
| 14 | Product Catalog | **CODE COMPLETE; CATALOGUE EMPTY BY DESIGN** | Migrations `0120`–`0122`, applied locally and to hosted. `lib/catalog/{query,price,validation,labels,rail,listing}`, `catalog-listing` and `catalog-admin` repositories, `/collection` and `/collection/[category]`, patterns RC-217/223/234/237, and the Studio catalogue editor with the FEAT §22 checklist. 1000 unit assertions including 17 database guards against a real PostgreSQL; `collection.spec.ts`, `collection-empty.spec.ts` and `catalog-studio.spec.ts` green at 1440, the filter/sort/pagination assertions all with JavaScript disabled. Verified against a live database in both states: three products with the four price states render their own labels and only two of them a number, 33 products paginate at 24 with correct `rel` and canonical links, then the catalogue was emptied and all seven category pages render SEED §27 with zero `[data-product-card]`. **The authenticated Studio half is `test.fixme`**, as in Phases 04 and 05, for the same reason: no reachable auth server. |
| 15 | Product Detail Experience | **CODE COMPLETE; NO PRODUCTS BY DESIGN** | Migrations `0130`–`0132`, `product_specs`, the specification block that has no placeholder branch at all, the dimensions shape constraint, `specifications_omitted`, the gallery with its lightbox (RC-238) and the four Studio tabs. `/product/[slug]` answers 404 for every slug because `products` holds zero rows. |
| 16 | Collections as Exhibitions | **CODE COMPLETE; NONE PUBLISHED BY DESIGN** | Migrations `0140`–`0143`. Eight new `collections` columns, `entity_relations`, the concept publish gate and its authority gate, the exhibition page and its ten-band template, `collection-products` and `signature-media` (30 blocks, 22 built), and the ten FEAT §9 concepts seeded as a name, a slug and an order. Applied to hosted and fingerprint-verified. Amendment A14. |
| 17 | Portfolio / Projects | **CODE COMPLETE; ARCHIVE EMPTY BY DESIGN** | Migrations `0150`–`0153`. `portfolio_projects`, `portfolio_project_media` and `testimonials`, all with zero rows and none seedable; two per-table evidence gates with the withdrawal branch first; `evidence_note` revoked from `anon` at the grant; `project-gallery` (32 blocks, 24 built) and RC-219 `PortfolioCard`; the project and testimonial Studio editors with consent, verification and publish. `lib/portfolio/gates.ts` mirrors both triggers and is held to agreement with them by test. Applied to hosted and fingerprint-verified through `0153`. Amendment A15. |
| 18 | Journal | **CODE COMPLETE; NOTHING PUBLISHED BY DESIGN** | Migrations `0160`/`0161`. Three tables, the ARTICLE page kind, `reading_minutes` derived by trigger, `enforce_article_has_body`, and the only date-gated public read on the site. Nine SEED §19 categories PUBLISHED and ten SEED §20 ideas DRAFT with covers bound; `lib/cms/related.ts` holds FEAT §11's one automatic rule; `/journal`, `/journal/[slug]` and `/journal/category/[slug]`; RC-220 `ArticleCard`; the Studio article editor and its categories screen. Applied to hosted and fingerprint-verified. Amendment A16. No RSS feed — the phase holds it behind an amendment nobody has granted. |
| 19 | Bespoke / Custom Configurator | **CODE COMPLETE; ON SINCE PHASE 20, TEMPLATES STILL DRAFT** | Migrations `0170`–`0172` and `0184`. Four form tables and `feature_flags`; `normalise_form_step_order()` repairs rather than refuses, because a refusing constraint trigger cannot survive one-row-per-transaction writes; `enforce_form_publishable()` refuses a form with no way to reply on it; an allowlist CHECK on `validation` makes a pricing key unstorable, mutation-tested. Three SEED §33–35 templates seeded DRAFT — 33 steps, 40 questions, one SELECT. The configurator ends at a VALIDATED PAYLOAD with Submit disabled and no handler: D1 requires the save first and persistence is Phase 20's, so `commission_configurator` shipped off; **Phase 20 gave the configurator its save path and switched the flag ON on both databases** — nothing shows on `/custom-commissions` until the owner publishes one of the three DRAFT templates. `/studio/catalog/customization-forms` and `[formId]`, `/studio/system/flags`, `cms_duplicate_customization_form()`. `rate_limit_buckets` brought forward for the unauthenticated upload endpoint. Applied to hosted through `0184`. Amendments A17, A18, A19. |
| — | Demonstration content | **SEEDED LOCALLY; PART-APPLIED ON HOSTED** | Owner-authorised placeholder data, marked `is_demo` by migration `0180`, registered in `docs/content/DEMO_CONTENT.md`, badged in the Studio and removable with `npm run demo:purge`. 30 products, 10 article bodies, 6 projects, 6 testimonials. **Hosted carries 20 of the 30 products and the six categories only** — the run was interrupted and awaits the owner's decision. |
| 20 | Inquiry + WhatsApp Flow | **CODE COMPLETE; NO ENQUIRIES BY DESIGN** | Migrations `0190`, `0191`, `0193`. `inquiries`, `inquiry_attachments`, `inquiry_events`; four enums; the reference-code sequence and its overwriting trigger; the anon INSERT policy that is the only guard on the only public write, and no anon SELECT anywhere. `submitInquiry` as the one write path, returning a union whose failure member has no URL; the five-level shortening ladder; the contact form promoted from planned to built; the product enquiry through `?product=`; the configurator's Submit live; the five-view inbox, its detail screen and an audited export that omits the hashed address. `commission_configurator` switched on. Amendment A20. |
| 21 | 3D Product Experience | **CODE COMPLETE; ZERO MODELS BY DESIGN; FLAG OFF** | Migrations `0194`–`0195` on both databases. `media_assets.viewer_settings` with `is_valid_viewer_settings()`; the FEAT §14 ceilings as CHECKs; the poster-before-association rule; `model_variant_labels` with the material-needs-verification CHECK and the Phase 08 authority trigger; `set_model_association()` writing both sides in one SECURITY INVOKER transaction. The viewer (`components/three/**`, RC-401) with every FEAT §12 control by pointer, touch and keyboard, four lighting and three environment presets from Phase 02 tokens, the mount (RC-228) behind three boundaries — a lazy mount, a probe-gated `import()` with `ssr: false`, and a static gate (`scripts/perf/check-bundle.mjs`) proved to fail on a planted import — measured at **303.6 kB gz** against 350. The inspector (`lib/media/inspect*.ts`) refuses in the browser before a signature and on the server after the upload, writes metadata from the parse, and destroys a refused file; `/studio/media/models` with uploader, list and drawer. Four mount points. Decoders vendored from `three@0.186.0`. 1,502 tests, none skipped. Amendment A21. `three_d_viewer` is OFF on both databases until the owner supplies a GLB of an object that exists. |
| 22 | Homepage / Store Merchandising | **COMPLETE; EVERY SLOT EMPTY, WHICH IS THE SHIPPED STATE** | Migrations `0200`–`0201` on both databases. `merchandising_slots` and `merchandising_entries`; the eleven slots inserted as structure (four global, one `CATEGORY_PINNED_<SLUG>` per D3 category, by trigger); `guard_merchandising_entry()` (type, existence, no concept collection), the rule-named CHECK, `merch_move_entry()` (SECURITY INVOKER, atomic), `merch_run_schedule()` (the cron's merchandising pass — records, archives, revalidates; never publishes). The five-step ladder in `lib/cms/merchandising.ts` with provenance; `selectProducts`/`selectArticles` swapped onto it with their signatures kept; `featured-collections` as the 34th block; the three fallback modes in the renderers; `MerchandisedRow` (RC-243) for the store row and the pinned region. Four Studio screens on one slot editor with the resolver's own answer as the preview; category order with the SEED §56 two-step and a restore. 1,534 tests, none skipped. Amendment A22. With zero published products every slot resolves to its fallback and no product card is fabricated anywhere. |
| 23 | Global Search + Product Relationships | **COMPLETE; THE INDEX HOLDS ONLY WHAT IS PUBLISHED** | Migrations `0210`–`0214` on both databases. `search_documents` with an eight-value `entity_type` CHECK and a second CHECK making the three Studio-only types structurally incapable of being `PUBLIC`; `research_search_documents` created EMPTY beside it with no `anon` policy, two phases before the subsystem that fills it; `search_queries` with no IP, no user agent and a CHECK refusing an actor on a public search. `refresh_search_document()` is the only writer, SECURITY DEFINER, behind eleven trigger functions and twelve triggers — so a member of staff cannot hand-write a search result the entity itself does not say. `search_documents_query()` ranks with `ts_rank_cd`, falls back to trigram similarity at 0.30 only when the exact pass returns fewer than four, and marks each row `EXACT` or `SIMILAR`. `/search` grouped and paginated; the header combobox (ARIA 1.2) degrading to a plain GET form; eight Studio palette providers. `product_relations` gains `origin`, `rule_key`, `note` and `paired_relation_id` under a nine-name vocabulary CHECK; `content_relations` and `relation_suppressions` join it; four stated rules propose and never write. Amendment A23. `scripts/search/check-search-scope.mjs` walks the import graph from the four public entry points and refuses any research identifier among them. |
| 24 | Bulk Management | **COMPLETE; NO ROWS TO OPERATE ON, WHICH IS D10 WORKING** | Migrations `0220`–`0221` on both databases. `bulk_operations` storing the exact previewed id list so Apply cannot widen it; `bulk_operation_items` holding the per-item before/after that makes the 24-hour undo real; `bulk_imports` and `bulk_import_rows`, the uploaded file not retained after apply. Four shape-C tables, read under `bulk.execute`, with no write policy for any session role and delete revoked twice over on the two record tables. Eleven registered operations across three modules — nine product, three media, five research registered `available: false` until Phase 29 — every one with a write-free preview, a Zod params schema and a destructive flag. Select → Preview → Confirm → Apply, the destructive confirmation typing the ROW COUNT as digits and the server re-checking it against a count it computes itself. Undo compares the `updated_at` the operation LEFT behind and skips rows edited since, reporting them by id. Amendment A24. `scripts/bulk/check-bulk-registry.mjs` fails the build on a preview that writes or a destructive flag that is missing or wrong. |
| 25 | Product Scraper Foundation | **COMPLETE; NO SOURCE APPROVED, SO NOTHING IS FETCHED** | Migrations `0230`–`0234` on both databases. Six enums; nine tables; `research_lease_work_items()` (SECURITY DEFINER, service role only, `for update skip locked` — the concurrency design PostgREST cannot express); the research search index filled by trigger. The seven FEAT §23 stages with rejection as a separate `disposition` column; `lib/scraper/core/stage.ts` the only writer of `stage`, emitting the pipeline event in the same call. The politeness posture: one named user agent with no fallback, robots.txt cached 24 h with a `Disallow` meaning no request is made, `Crawl-delay` as a floor, rate limit and delay enforced in the lease query, backoff with jitter, `Retry-After`, a circuit breaker at five failures, and a kill switch checked before every fetch. Snapshots gzipped into a private Supabase Storage bucket, 180-day retention. Four Studio surfaces, two command providers, an isolation guard proved to fail on each of I1–I4, and an end-to-end run against a real fixture server. Amendment A25. **Three gates stand between this code and any request: a policy review the owner records, a source they enable, and a flag they switch on. None is on.** |
| 26 | Comparator Source Management | **COMPLETE; STILL NO SOURCE, WHICH IS STILL THE SHIPPED STATE** | Migrations `0240`–`0241` on both databases. Four enums; three child tables — `research_source_url_patterns`, `research_source_category_map`, `research_source_schedules` — each with its own constraints and audit trail rather than keys in a blob; eight new columns on `research_sources`; three politeness ceilings tightened to FEAT §26's numbers so the form and the table refuse the same values. `research_source_health_v` computes last run and health on READ, `DISABLED → FAILING → DEGRADED → STALE → HEALTHY`, `security_invoker = true` so the Phase 25 policies still decide who may read it — and the isolation guard gains a fifth assertion for the half a policy cannot cover, because a VIEW has no policies and Supabase exposes a new one through PostgREST by default. The six-hour minimum interval is a CHECK calling `research_cron_min_interval_minutes()`, which parses cron in SQL and answers 0 for an expression it cannot read, so an unparseable schedule is refused rather than sailing through a `null >= 360`; `lib/scraper/core/cron.ts` mirrors it exactly and a 21-row table runs both against each other. EXCLUDE beats every other pattern kind whatever the priority, and an EXCLUDE that will not compile still excludes. An unmapped category is a first-class result — no stemming, no synonyms, no defaulting — and a mapping whose Rivya category is later deleted becomes `UNRESOLVED` rather than blocking the delete, which is the constraint this phase wrote first and a test found wrong. **`research_source_category_map.category_id` is the FIRST of exactly two research → public foreign keys**, allowlisted by constraint name under amendment **A26**, which is the D5 exception the phase document held as a blocker. The pattern tester makes no request at all; the single-URL probe makes exactly one, through the same fetcher every scheduled run uses, and is audited. Readiness and policy status are two columns because they are two questions, and recording a decision needs `research.write` AND `system.settings.write`. `tests/e2e/research-sources-crud.spec.ts` adds a complete second source through the interface and asserts `git status --porcelain` is EMPTY. |
| 27 | Scraper Extraction | **COMPLETE; NOTHING TO EXTRACT FROM, WHICH IS STILL THE SHIPPED STATE** | Migrations `0250`–`0251` on both databases. `research_product_versions` append-only and deduplicated by content hash — the substrate Phase 29 diffs, and the one thing that cannot be retrofitted; `research_adapter_runs` one row per (run, source, adapter) with the first five errors and the ABORTED flag. The `SourceAdapter` contract, whose `AdapterContext` grants no database handle, no `fetch`, no file system and no clock — an adapter is a pure function from bytes to a draft. `RawProductDraft` is STRINGS: a parsed number fails Zod, because parsing is Phase 28's, once, over stored evidence. The `generic` adapter reads JSON-LD (`@graph` and arrays included), microdata, RDFa, OpenGraph, configured selectors and `<title>`/`<h1>`, recording provenance per field, and never throws on malformed input. **A real denial-of-service vector was found by a test written for something else**: `node-html-parser` is super-quadratic in nesting depth, so a hundred kilobytes of unclosed `<div>` — well inside the fetcher's 2 MB cap — wedges the cron invocation, and the CPU budget cannot catch a single synchronous call into a dependency. `lib/scraper/adapters/parse.ts` estimates depth in one linear pass without building a tree, refuses past 200 levels, and is the only sanctioned parse in the tree. Four isolation layers, each with its own record, and a two-source test that interleaves a throwing adapter with a working one. `scripts/research/reextract.ts` re-derives versions from stored snapshots with zero network traffic. `source-a` and `source-b` are FEAT §27's placeholder names with `supports()` false, and a fifth guard assertion fails the build on any external host named anywhere under `lib/scraper/adapters/**`. Amendment **A27**, which is also where D1 gains an HTML-parsing row. |
| 28 | Normalization + Validation | **COMPLETE; NOTHING TO NORMALISE, WHICH IS STILL THE SHIPPED STATE** | Migrations `0260`–`0261`, on both databases. Twenty-three normalisation columns on `research_products`, three new tables, and `research_products_matched_category_fk` — **the second and final research → public foreign key**, which closes the allowlist the isolation guard has carried since Phase 25. The normalizer is PURE — no I/O, no clock, no database — which is what makes every rule a fixture table and `research:renormalize` a zero-traffic operation over stored evidence. **No exchange rate exists anywhere under `lib/scraper/`** and a test reads every file in the tree to keep it that way; `$` alone records `AMBIGUOUS` rather than guessing a country; amounts are integer minor units read with the source's own separators, because `1.234` is two different numbers in two conventions. **`AMBIGUOUS` stores nothing** — `dimensions_mm` is null unless the parse state is `PARSED`, so no chart ever reads a millimetre figure arrived at by supposing. Eleven validation rules, every one evaluated BEFORE the write, with `research_price_state_coherent` and `research_dimensions_sane` as backstops for a hand-written `UPDATE` and nothing else: a failing row is written, kept at `VALIDATED` with its findings attached, and counted — never dropped, never a raised database error. Matching proposes and never decides: auto-merge only on the source's own identifier, an identical title-and-price, or a title above 0.95 with measurements agreeing within 5 %; everything else is a merchandiser's reviewable candidate, and every duplicate flag is reversible and audited. `research.write` corrects a value, `research.confirm` decides an identity, and `0261` draws the same line at the row so a researcher cannot reach a duplicate flag sideways. **Three defects were found and fixed rather than worked around**: `array_length` on an empty array is NULL and a CHECK on NULL passes, so the lexicon's own constraint admitted the row it refused; the phase document's illustrative SQL puts a subquery in a CHECK, which PostgreSQL refuses outright; and one validation rule was written to catch shapes the draft schema already rejects, which would have made it unreachable. `/studio/research/explorer` shows raw beside normalised beside provenance with filters in the URL; `/studio/operations/data-quality` gains a Research tab and the material-lexicon editor. **Migration `0262` and eleven review findings, after the phase merged**: two more CHECK constraints that passed what they were written to refuse (a `citext` column makes `~` case-insensitive; `btrim(null) = ''` is NULL, not TRUE), three pipeline events that violated their own table's `moves_somewhere` constraint, a merchandiser locked out of a duplicate they were permitted to clear by an audit write that ran as the person rather than as the system, five parser defects each producing a confident wrong answer where the design calls for `AMBIGUOUS`, a severity filter that would have exceeded the PostgREST URL limit at a few hundred findings, two unvalidated query parameters reaching a `uuid` column, and the new offline gate's own hole — it read `*.test.ts` only, so a database import behind one helper passed; it now walks each test's import closure. Amendment **A28**. |
| 29 | Change Detection + Review | **COMPLETE; NOTHING HAS CHANGED BECAUSE NOTHING HAS BEEN FETCHED** | Migrations `0270`–`0271`. Seven tables in three postures that answer one question — who may write: what the SYSTEM detected (`research_changes`, `research_change_digests`) takes **no write policy for any role, owner included**, because a change row a session could insert is a competitor price move somebody invented; what a PERSON decided (`research_review_actions`, `research_notes`, `research_product_tags`) is `research.confirm` and append-only at a TRIGGER as well as at the policy, so the service role is refused too; what a person CONFIGURED (`research_change_rules`, `research_tags`) is `research.write`. **Diffs are version-to-version and both snapshot keys are stored**, so a change record is reproducible from evidence years later. Materiality is a stated rule with three levels and per-source thresholds tuned in Studio — `NOISE` recorded, hidden and uncounted, because a queue reporting a CDN rewriting an image URL beside a 12 % price rise is a queue people stop reading. The nine FEAT §25 actions write the append-only log FIRST, the domain effect second and the queue's stamp last, because there is no transaction and that order fails safely. Bulk review runs on the **Phase 24 engine** with a new `extraPermission` of `research.confirm`. **Four never-auto-import guarantees**: the isolation guard's I4 leg, a new CI gate proved to refuse the write against a fixture tree, the seeded confirm-dialog copy, and one quotable sentence in `BUSINESS_RULES.md` — plus an RLS test counting `products` either side of a confirm, which proves there is no database path either. One defect found by the suite rather than by an operator: the append-only DELETE trigger made `research_sources` undeletable, now stated precisely as "a decision about a row may not be erased while that row exists". Amendment **A29**. |
| 30 | Large-Format Research Workspace | **COMPLETE; NOTHING IS CLASSIFIED BECAUSE NOTHING HAS BEEN FETCHED** | Migrations `0280`–`0281`. Six columns on `research_products`, `research_large_format_rules` (five ordered rules, first match wins, seeded as configuration) and `research_saved_views`. **`is_large_format` is three-valued and the null means "we have no measurement"** — a boolean would force every badly-written page into the small bucket and make the workspace under-report large work in proportion to how poorly its sources write, which is a failure that looks like a finding. The first draft tied the null to the BAND and the phase document's own four verification rows caught it (amendment A30). Coverage is stated above every panel, zero in scope reads as 0 % rather than 100 %, no panel drops the unknown bucket, price panels never mix currencies and have no field for a combined total, and the gap panel reports RESEARCH COVERAGE with no comparison to Rivya's catalogue and no opportunity language — Rivya has no published products, so such a comparison would be an artefact of an empty catalogue. An editor override freezes the row permanently and the reclassification pass REPORTS the skip; proved end to end against a live fixture. `research_saved_views` is the first owner-scoped research table, with sharing as a second SELECT policy rather than a widened scope. Row selection arrived on this screen and on the change queue, so the Phase 24 bulk toolbar and the Phase 29 action bar both work from where a piece was found — with no second preview, confirmation or undo, and with the queue's checkbox carrying the PRODUCT id because that is what the five operations target. I3 now bans the scale identifiers rather than the English words. `0280`–`0281` are applied to the hosted project as well as locally, and a 67-object structure digest returns the same hash on both. Amendment **A30**. |
| 31 | Analytics + Comparison | **COMPLETE; NOTHING IS MEASURED BECAUSE NOTHING HAS BEEN FETCHED** | Migrations `0290`–`0292`. Three pure analyses under `lib/scraper/analytics/` — assortment, price architecture, dimensions — each returning a **coverage record** (`n`, denominator, percentage, exclusions by reason) beside its result, with `n + Σ excluded = denominator` asserted by test. `research_comparison_sets` / `_members` are a person's saved question under `research.write`; `research_analytics_snapshots` / `research_metric_coverage` are the machine's record with **no session write policy**, `coverage_pct` generated. **Currencies are never mixed at three layers** — the module throws, the workflow splits, and the snapshot key has no room for a combined row. `/studio/research/compare` and `/compare/[setId]` are filled (members, recompute, four panels each headed by `CoverageBadge`); the dashboard gains a per-source coverage panel reading health from the Phase 26 view. `npm run research:analytics` and a 02:30 UTC cron write snapshots. Four token-only SVG chart patterns, no chart library. Unit 154 files / 2,497 tests; RLS 24 / 545; hosted level through `0292` (amendment A31). |
| 32 | Opportunity Engine | **COMPLETE; NOTHING IS RANKED BECAUSE NOTHING HAS BEEN FETCHED AND NO MODEL IS ACTIVE** | Migrations `0300`–`0302`. Seven declared signals under `lib/scraper/analytics/opportunity/signals/`, the formula implemented once in `score.ts` and printed verbatim in SCRAPER §23, versioned models with `freeze_active_scoring_model()` and one ACTIVE by partial unique index, one component row per signal per score (**excluded is not zero** — a CHECK), v1 seeded DRAFT. `/studio/research/opportunities` filled: provenance header, both state tabs, the Explain drawer reproducing the total from stored components, the model panel with the rank-movement diff before Activate. `npm run research:score`, a 03:15 UTC cron, and `research:check-no-ml` in `npm run check` and CI. New permission `research.score.manage` (owner, admin). Hosted level through `0302` (amendment A32). |
| 33 | Visual Similarity | **COMPLETE, FIRST-PARTY HALF; COMPETITOR IMAGES ARE NEVER FETCHED (OWNER DECISION, A33)** | Migrations `0310`, `0311`, `0313` (`0312` unused). Pure hashers under `lib/scraper/analytics/similarity/` (dHash, DCT pHash, Hamming, seven-segment blocking with NEAR_DUPLICATE recall 1.0 measured against brute force, the band table with its "does not mean" column). `media_asset_hashes` first-party; `lib/media/hashes.ts` the one decoder module (`media:check-decoder` gate); the upload guard refuses a byte-identical or six-bit-near duplicate before the row, names the match, destroys the object, audits DENIED. `/studio/research/similarity` filled: decision, flags, legend with `PRECISION NOT YET MEASURED`, coverage, library self-check, history. `npm run media:hash` + the `Media hash backfill (hosted)` workflow (the container cannot reach Cloudinary — **the 250-asset backfill is an owner-dispatched run**), `research:similarity`, `research:similarity-sample`. New permission `research.similarity.run`. Hosted level through `0313`. |
| 34 | Product Direction Tool | **COMPLETE; NO BRIEF EXISTS UNTIL A PERSON WRITES ONE** | Migrations `0320`–`0321`. Nine prose sections a person writes, evidence captured by value with a required rationale, drift marked against the current value, observed figures with coverage and the observed-in-research label (screen, print, Markdown), revisions by SECURITY DEFINER trigger with a status-preserving restore, `PUBLISHED` unreachable, no price/dimension/material column, a checked category slug instead of a third I1 reference (A34), `guard_direction_brief_approval()`. `/studio/research/opportunities/direction` + `/[briefId]` (+ `?view=print`), `npm run research:direction-export`; the direction↔products import barrier under I4. New permissions `research.direction.write` / `.approve`. Hosted level through `0321`. |
| 35 | Shortlist + Confirmation | **COMPLETE-WITH-FLAG-OFF; THE BRIDGE IS INERT UNTIL THE OWNER ENABLES `research_product_bridge`** | Migrations `0330`–`0331`, no enum change. `research_shortlist_entries` (reason, score at entry, one open per row, closed never deleted), `research_confirmations` (decision note, archival as a column, `created_product_id` with no foreign key), `guard_research_stage_writer()` + `research_write_stage()` (service role only). `MOVEMENTS` in `stage.ts` compared cell for cell with the phase document and SCRAPER §26; Confirm needs a decision note; `returnToReview`, `archiveDecision`; bulk `research.close_entry` / `research.archive_confirmation`, every research bulk op through the stage machine with its own undo, 200-row cap. `/studio/research/shortlist`, `/studio/research/confirmed`, `PipelineBulkBar`, `StartProductDialog`; the one bridge `startProductFromConfirmation` writes five fields and nothing else, I4 carve-out encoded in `bridge-isolation.mjs` (A35, proposed). Hosted level through `0331`. |
| 35b | Demo catalogue + image prompt book | **COMPLETE; IMAGES WAIT FOR THE OWNER'S CLOUDINARY URLS** | No migration. Thirty-five `is_demo` products (five added where a category was thin), all on hosted with the article bodies, projects and testimonials; `npm run demo:sql` replays the seed as SQL; `docs/ASSET_GENERATION_PROMPTS.md` holds 45 ChatGPT prompts (35 product heroes at 4:5, 10 furniture room scenes at 16:9) with planned IDs `PRODUCT-HERO-NNN` / `PRODUCT-SCENE-NNN`; amendment A36 (concept visualisation rule, implemented by Phase 43's `0411` and intake script). |
| 36 | Google Sheets | **COMPLETE; INERT UNTIL THE OWNER'S FIVE-STEP SETUP AND THE FLAG** | Migrations `0340`–`0342`. `sheets_export_definitions` (no credential column; the entity, column and PII rules as CHECKs) and `sheets_sync_runs` (one RUNNING per definition, a CHECKed error vocabulary); seven `MANUAL` definitions seeded as structure. `lib/sheets/` — JWT by `node:crypto`, `spreadsheets` scope only, staging tab + atomic swap, jittered retry honouring `Retry-After`, circuit breaker at three, per-entity allowlist, run engine with the PII audit row — is a new D2 domain (A37). `/studio/research/sheets`, `npm run sheets:sync`, hourly cron under `CRON_SECRET`, flag `google_sheets = false`, permissions `integrations.sheets.manage` / `.run`. `sheets:check-no-read` in `check` and CI; the redaction test injects a generated key. Unit 169 files / 2,631 tests; RLS 29 / 596; hosted level through `0342`. |
| 37 | Studio Analytics | **COMPLETE; EVERY TILE IS A TRUE ZERO OR A NAMED REASON UNTIL THE CATALOGUE AND THE CORPUS FILL** | Migrations `0350`–`0351`. Eighteen FEAT §28 metrics under `lib/analytics/metrics/` (id parity by test; definitions verbatim in STUDIO_GUIDE §5.4 by test; `compute()` called only by `lib/analytics/snapshot.ts` by test); `lib/analytics/{reads,availability,snapshot}.ts`; `analytics_snapshots` with the reason-iff-unavailable CHECK and the `selectScope` policy predicate (A38); the Analytics tab (`AnalyticsTab`, `MetricTile`, `MetricUnavailable`, `MetricTrend`) reading snapshots only; `npm run analytics:snapshot`, the 03:45 UTC cron under `CRON_SECRET`; flag `advanced_analytics = false`; every FEAT §17 card whose table exists now counts (`BUILT_THROUGH_PHASE = 36`). Hosted level through `0351`. |
| 38 | Environment + Documentation + Logs | **COMPLETE** | Migrations `0360`–`0361`: `system_logs` (`level` × `channel`, append-only, `system_log_write()` dedupe on a five-minute window, retention 90/400 days), enums `log_level` / `log_channel`, `workflow_runs_v`. One redactor for every surface (key, value, shape; fixed token). `/studio/system/environment` (eight checks, reachability only, sentinel-proved), `/studio/system/documentation` (ten allowlisted documents from a `prebuild` index, no HTML branch), `/studio/operations/logs` (URL filters, redacted detail, audited CSV export under `operations.logs.export`), `/studio/operations/workflows`; `warnScraper`, Sheets failures and failed checks write the log; `/api/cron/log-retention`; `logs:check-separation` gate; `lib/ops/` in D2 (A39). Hosted level through `0361`. |
| 39 | SEO | **COMPLETE** | Migrations `0370`–`0371`: `seo_keyword_themes` (no numeric column; seventeen SEED §42 themes seeded `UNRESEARCHED`, two geography themes awaiting verification), `seo_redirects` (anon select of PUBLISHED only; one hop; loop and chain refused at save), `seo_entries` + `structured_data_type` / `noindex` / `nofollow` / `derived`. `lib/seo/`: the four-level ladder per field, the canonical table, one JSON-LD emitter with eight gated builders and `verifiedOnly()`, the sitemap index over six children, `robots.txt`, `X-Robots-Tag` by route class. `/studio/content/seo` (seven tabs) and the entity editors' SEO panels under the new `seo.write`. Gates `seo:check-jsonld-scope` and the build-time validator in CI. Hosted level through `0371`. |
| 40 | Performance | **COMPLETE** | Migration `0380`–`0381`: `web_vitals_samples` — ten columns, no identifier and no column one could go in, `route_pattern` CHECKed three ways, `analytics.read` select and no write policy at all. `perf/budgets.json` is the single source for every budget; `perf/bundle-baseline.json` records what each route measures and CI fails on 5% growth. Guards: per-route island census, third-party origin allowlist, caching contract, exactly-one-priority-image. `MediaImage` gained `priority` (`fetchpriority="high"`), fixing an LCP defect on every route; Studio gained `private, no-store`. `VitalsReporter` (RC-354) beacons at 10% from production only; `VitalsCard` (RC-355) shows p75 per route. The ~98 kB the section registry costs every CMS route is measured, evidenced and tracked in `PERFORMANCE.md` §4.5, not fixed here. |
| 41 | Accessibility + Security | **DEVELOPMENT COMPLETE** — tests deferred to Phase 42 by the owner's instruction | Migration `0390` (`0391` allocated and unused): `media_assets.is_decorative`, and the alt-text CHECK re-expressed as "a usable alternative, or explicitly decorative". `proxy.ts` attaches a per-request-nonce CSP and six static headers to every matched response, including the redirect, with the matcher widened to the public site; the policy ships REPORT-ONLY and `CSP_ENFORCE=1` flips it after an owner-read soak. `POST /api/csp-report` collects violations at `SECURITY` level. The rate-limit key became `hmac(salt, value)` under two separate salts, and the five surfaces SECURITY.md already listed are now wired. `validateUpload` runs in the save path against the first 4 kB of the stored original and refuses the ROW, destroying the Cloudinary object. A data request panel on `/studio/inquiries/all` and `ops:anonymise-inquiries` give subject access and erasure, owner-only and preview-first. `/studio/media/all/[assetId]` edits alt text and the decorative flag together with live quality warnings. Five new gates in `npm run check`. **Not built:** EXIF stripping (SECURITY §7.5), `request_id` in the proxy, and the whole test track. |
| 43 | Media Coverage + Higgsfield Finalization | **DEVELOPMENT COMPLETE** — tests deferred to Phase 42 | Migrations `0410`–`0411`: `media_crops`, one editor-chosen crop per (asset, D6 ratio), applied as `c_crop` BEFORE the delivery preset. The coverage report resolves all 26 declared slots — 15 reuse, 6 re-crop, 3 empty, **2 generate** — after correcting six `fillableBy` mappings and two dispositions the registry had left stale against Phase 07's own analysis. All 250 imported alt-text drafts rewritten from prompt fragments into sentences that pass the SEED §43 rules, in a committed file the generator will not overwrite. Studio: Coverage and Concept Placement tabs, the crop editor, the alt-text queue, the brand-format panel. `media:register-external` takes an owner-generated image by Cloudinary URL and refuses any other origin. **Nothing was generated**, and brand marks, 3D models and portfolio imagery never will be. |
| 44 | Vercel Deployment | **DEVELOPMENT COMPLETE** — drills NOT RUN, tests deferred to Phase 42 | No migration. `scripts/ops/preflight.ts` runs 13 named gates in one command, 10 of which run today; a skipped gate names the phase that owns it. `scripts/ops/check-env.ts` checks presence AND shape per environment and prints no value. `scripts/docs/check-doc-contract.mjs` exists at last and joins `npm run check`. `vercel.json` pins the framework, region and function limits; `next.config.ts` 308s `www` to the apex. `EnvironmentRibbon` (RC-362) and `BuildPanel` (RC-363). `db-migrate.yml` extended with a `pg_dump` snapshot and a GitHub Environment on the apply path. **One Supabase project (A42): a preview reads and writes production data**, recorded in DEPLOYMENT §1.1. **Neither the rollback nor the forward-fix drill has been run and no time is claimed.** |
| 42 | Comprehensive Testing | **COMPLETE** — ran last, by the owner's instruction to finish development first | No migration. `tests/fixtures/ids.ts` + `scripts/test/seed-fixture.ts`: one deterministic fixture behind the reserved id prefix `f0000000-0000-4000-8000-`, refusing any non-local database, with `--publish-seeded` walking the seeded sections up the real DRAFT → REVIEW → APPROVED → PUBLISHED ladder. Twelve committed PNGs from a hand-written encoder, served for every Cloudinary request by `tests/support/media-route.ts`. A third vitest project, `integration` — row security across the schema, seed idempotency by digest, the publish gates as the database owner, the migration ledger and every RPC call site against its function's non-defaulted parameters. Sixteen browser specs including the seven `tests/e2e/a11y/**` Phase 41 deferred; four visual specs with 33 baselines at three widths. `e2e.yml` (four shards, against a production build), `security.yml` (gitleaks over the whole history), `dependabot.yml`, `.gitleaks.toml`, `tests/flaky.json`. **It found eight production defects**, listed in `docs/PHASE_31_TO_46_IMPLEMENTATION.md`; the worst is that no enquiry could be saved in any environment since Phase 41. **Not true:** the Studio has no browser coverage beyond its login page (156 specs skip for want of an auth server), coverage is 47.9% and set as a ratchet, and CI does not compare the visual baselines. |
| 45–46 | Polish, handoff | **PLANNED** | Specified in `docs/project/phases/`. |

## What exists on disk

```
CLAUDE.md · CONTEXT.md · PROJECT_STATE.md · CHANGELOG.md · README.md
data/higgsfield/asset-manifest.json      250 assets, machine-readable
data/higgsfield/raw/{images,videos}.json raw generation history
scripts/media/build-higgsfield-manifest.py   deterministic classifier
scripts/media/check-asset-ids.py             gap-ID collision guard
scripts/media/migrate-higgsfield.ts          the 250-asset migration (RUN: 250 in Cloudinary)
scripts/media/assert-no-regeneration.ts      the regeneration guard
scripts/media/build-asset-status.ts          writes HIGGSFIELD_ASSET_STATUS.md §3-§4
content/media-slots.ts                       26 declared CMS media slots
content/asset-purposes.ts                    the §2.1 purpose vocabulary
lib/media/{manifest,migration,gaps,inventory}.ts
data/higgsfield/migration-log.json           the resume ledger (absent until the first run)
docs/requirements/                       the two governing specifications
docs/architecture/ docs/design/ docs/studio/ docs/media/ docs/content/ docs/ops/ docs/project/
docs/SESSION-STATE.md
```

## What does NOT exist yet

**The test track deferred from Phases 41–44 is written and running — Phase 42 did it.** The seven
`tests/e2e/a11y/*` specs, `tests/unit/{alt-text-coverage,rate-limit-window,upload-validation,pii-scope}`,
the `security-headers` and `studio-authz` e2e specs, and the gitleaks + `npm audit` workflow with
`.gitleaks.toml` and Dependabot all exist. There is no `exceptions.json` and there should not be one:
the axe sweep fails on critical and serious with no allowlist, and an argument that a rule is wrong
for this product belongs in `docs/ops/ACCESSIBILITY.md` beside the disabling.

**What is still not proved is the Studio.** 156 browser specs skip for want of a Supabase Auth server
the local PostgREST harness cannot provide, so the larger half of this product — the half the owner
works in — has browser coverage of its login page and nothing else. `docs/ops/TESTING.md` §13 lists
that and the three other blind spots, including that CI runs the behavioural widths and does not
compare the visual baselines.

**Three Phase 41 items are not built and are recorded where somebody would look for them.** EXIF is
not stripped from stored originals (SECURITY §7.5 names the mechanism and why it was not shipped
blind); `proxy.ts` assigns no `request_id`, so `audit_logs` and `system_logs` cannot yet be joined on
one (SECURITY §10); and `/studio/system/environment`'s Security section carries no dependency-audit
figure, because a number from somebody's last CI run would be a stale figure wearing a live badge.

Eight of the twenty-eight blocks have no renderer; the eight are listed as `null` in
`components/sections/registry.ts` and the two registries are asserted to agree, so a block cannot be
forgotten, only explicitly declared unbuilt.

`/product/[slug]` EXISTS as of Phase 15, and a product card is a link. What it does not have is
anything to render: see the paragraph below.

**`merchandising_entries` holds zero rows, and that is the finished state of Phase 22.** Eleven
slots exist and every one is empty, because there is nothing published to curate: with zero
published products the Selected Works band renders its editorial fallback, the homepage journal
band is hidden below three articles, the store's featured row is absent, and no category has a
pinned region. Curation is the owner's act in Studio → Merchandising, or nobody's.

**`media_assets` holds zero `MODEL_3D` rows, and that is the finished state of Phase 21.** The manifest carries no model, none is generated (a model's form and dimensions are a product specification, D10), and the viewer, the inspector and the upload path all exist and wait. `three_d_viewer` is OFF on both databases; switching it on before a model with a poster exists changes nothing on any page, because every mount point renders nothing without one.

**`products` holds zero rows, and that is the finished state of Phases 14 and 15, not a gap.** A
product exists because an owner types one into `/studio/catalog/products/new` (SEED §32); nothing
seeds one, nothing imports one, and `tests/e2e/collection-empty.spec.ts` counts `[data-product-card]`
elements on all seven category pages to keep it that way. Phase 15's three e2e specs skip for the
same reason, and say so rather than passing silently.

Phase 15 closed two of the five gaps this paragraph used to list: the product DETAIL surface and the
gallery editor with media roles both exist, along with the Specifications and Related editors.
Phase 23 closed the relationship engine — four stated rules that propose and never write, and a
workspace where an editor accepts, dismisses or removes every suggestion — and Phase 24 closed bulk
import, along with the ten other operations that run through the same engine. What the catalogue
still has no rows for is inventory, which is D10 working rather than a gap.

The Studio shell EXISTS but most leaves below `/studio` are stubs: a real route with a real
permission check and a notice naming the phase that will fill it, which is what stops navigation
dead-ending — except `/studio/media/higgsfield` (Phase 07), the content surfaces (Phase 08) and the
catalogue (Phases 14–15). Every migration is applied to BOTH the local cluster and the hosted
project. Hosted now carries content as well, replayed and fingerprint-matched; what it does not
carry is anything PUBLISHED, so the deployed preview renders a wordless shell and 404s every CMS
route until
`npm run seed:content` runs against it.

**CI runs; the hosted migration workflow has still never been dispatched.** GitHub Actions
executed its first step on 2026-09-10, when the repository went public, and the `verify` job is a
gate from that point (`docs/ops/ENVIRONMENT.md`, "GitHub Actions").
`.github/workflows/db-migrate.yml`, which applies migrations to hosted Supabase from a runner,
remains built and undispatched: it needs the `SUPABASE_DB_URL` repository secret, and the database
password that secret would carry is one of the six credentials awaiting rotation. Hosted migrations
have gone through the Supabase MCP server instead, and their ledger rows carry the same per-file
SHA-256 the runner computes.

## Verified facts

- Higgsfield workspace `ec502e11-f7e3-42e6-b11b-cca2088dbd9c` holds **224 images and 26 videos**,
  all completed, across 163 distinct prompt families.
- Aspect ratio coverage: 16:9 (121), 4:5 (50), 3:4 (21), 9:16 (16), 3:2 (16), 1:1 (13), 21:9 (9),
  4:3 (4) — desktop, portrait editorial and mobile-hero crops are all present.
- Node 22.22.2 / npm 10.9.7 available; npm registry reachable.
- The manifest regenerates byte-identically from the raw history; all 250 asset IDs and Cloudinary
  public IDs are unique (asserted by the generator); the gap-ID collision guard passes across
  31 documents.
- All 47 phases (00–46) are documented, each carrying all 12 required headings.
- Migrations `0001`-`0008` apply cleanly to an empty PostgreSQL 16.13 database; all ten tables
  have `relrowsecurity = true` and zero policies; `price_state` holds exactly
  `STARTING_FROM REQUEST_QUOTE PRICE_ON_REQUEST`; the type generator produces byte-identical
  output across runs.
- The seed runner inserts 7 rows on a fresh database, updates 7 and inserts 0 on a second run,
  and after an owner edits one row reports 1 `skipped_owner_edited` with that row's value intact.
  Publishing a row and re-seeding does not un-publish it.
- **Phase 22, as measured**: the ladder answers CURATED in position order, drops an out-of-window entry and an unpublished target, tops up by recency with the rule named and never counts a draft, and falls through to the slot's mode — against a client that answers from memory; the rendered fallback contains no `/product/` route, no price label and no product card, and a tile's CTA survives only to the three allowed paths; at the table, anon reads an entry only while PUBLISHED, inside its window, in a PUBLISHED slot, the editor cannot curate, the merchandiser can, a concept collection and a wrong type are refused for the owner, and the sweep is the service role's; every guard, the move function, the sweep (idempotent on a second run) and the categories trigger (insert and slug rename) probed by SQL with savepoints; hosted and local both hold 44 tables, 175 policies, eleven slots and 215 seeded `global_content` rows.
- **Phase 21, as measured**: the viewer chunk bundles to 303.6 kB gzipped (esbuild, React external) against a 350 kB budget, after the first measurement of 391 kB found `zod` in the graph; the bundle gate fails on a planted static import and passes on the tree; a Draco-compressed GLB built in a test is encoded and decoded end to end by the same decoder family the viewer serves; a merchandiser cannot mark a finish label VERIFIED at the database and an editor's product association fails as a whole; hosted and local both hold 42 tables, 165 policies and 213 seeded `global_content` rows — the hosted count was 157 before this phase, the 56 missing rows applied through `scripts/seed/emit-sql.ts` with the runner's own hashes.
- **733 unit and RLS tests** across 63 files, none skipped, with a local PostgreSQL 16.13 cluster
  reachable. All **twenty** gates pass locally. E2E: Studio access 13 passed / 4 `test.fixme`, the
  Higgsfield tracker 6 passed / 8 `test.fixme` (all needing a real Supabase session), and 104
  assertions across the eight FEAT §45 widths.
- **`computeGaps()` reproduces the phase document's own gap table** from the manifest: 13 coverable
  slots, 2 thin families, 11 gaps — including every page PHASE-05-09 §07 predicted (`/`,
  `/collection`, `/collection/furniture`, `/collection/collectible-design`,
  `/custom-commissions`, `/contact`, `/faq`) — plus one finding the document did not name,
  `gallery-scene`: 5 assets that no declared surface can use.
- **Both Phase 07 guards were proved to bite, not merely to pass.** `assert-no-regeneration.ts`
  exits 1 on a planted brief for `WALL-ART-001`, naming the asset and the folder it already
  occupies; `build-asset-status.ts` produces no diff on a second run.
- The navigation manifest is proved equal to D4 and to the filesystem: `tests/unit/studio-nav.test.ts`
  parses the route block out of `CANONICAL-DECISIONS.md` rather than transcribing it, so editing the
  contract fails the test. Both failure directions were provoked and confirmed.
- **Three defects were found by tests rather than by review** while building Phase 05, all of the
  same shape — code that looked right and quietly asserted something false: the environment badge
  rendered "Development" from an ABSENT variable; a test selecting "the first form" silently changed
  its subject when a control was added above it; and the command palette opened with focus on its
  close button, so ⌘K could not be typed into.
- `scripts/db/migrate.mjs` was verified against a real PostgreSQL: 12 migrations applied from
  empty, a second run is a no-op, a migration edited after being applied is refused, a deliberately
  broken migration left no ledger row and no leaked table, and the connection password appears in
  no output.
- `proxy.ts` is registered by Next — the production build reports `Proxy (Middleware)` in its
  route table — and all four refusals in `security:check-proxy` were verified by breaking the
  file four ways.

## Known risks carried forward

1. ~~The migration set has never been applied to the hosted Supabase project.~~ **RESOLVED
   2026-09-08.** All fifteen migrations are applied to `ccvarsmzickdkryoakdg` (PostgreSQL 17.6),
   verified field-by-field against the local schema, with RLS confirmed per role on the real
   project. Reached through the Supabase MCP server; ordinary egress to `*.supabase.co` is still
   blocked from this sandbox, and `db-migrate.yml` remains built and undispatched — it needs the
   `SUPABASE_DB_URL` secret, which waits on the rotation in item 2.
2. **Six pasted secrets are still unrotated.** The Supabase service-role key, secret key, JWT
   secret and database password, plus the Cloudinary API key and API secret, were exposed in chat
   transcripts on 2026-09-08. Treat all six as compromised until rotated; `docs/SESSION-STATE.md`
   carries the list and what each one grants. Names only are recorded — no value, prefix or length
   is written anywhere in this repository.
3. **The Higgsfield migration has never executed.** The planner, ledger and row mapping are
   exercised over all 250 real manifest rows — but with a fake uploader, and a fake uploader
   cannot 400. Phase 06 is the precedent worth remembering: 23 URL-builder tests passed while
   every video URL would have been rejected by Cloudinary, and a 20 MB PNG failed an upload cap
   no test knew about. Run `--limit=5` before the full 250.
4. **`media_usages.slot_key` must carry the registry key** from `content/media-slots.ts`
   verbatim. Nothing enforces it — the database requires only non-blank — so a Phase 08 trigger
   writing the old short form (`media`, `card.3`) will make the Gaps tab report every slot as
   unbound, silently and plausibly.
5. Every seeded statement about fabrication capability is unverified and carries
   `OWNER_VERIFICATION_REQUIRED`. The site cannot publish those claims until the owner confirms.
6. Competitor scraping (Phases 25–35) needs a per-source legal/ToS review before any source is
   enabled; the plan records the requirement but the review itself is an owner decision.
