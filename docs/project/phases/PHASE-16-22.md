---
doc: PHASE-16-22
status: CURRENT
owning_phase: 01
last_reviewed: 2026-09-12
owner_verification: NOT_REQUIRED
---

# PHASES 16–22 — Collections, Portfolio, Journal, Commissions, Inquiry, 3D, Merchandising

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the
> canonical decisions differ, the canonical decisions win and this document is wrong.
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (cited as
> *FEAT §n*) and `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (cited as *SEED §n*).
> Sibling phase documents: `PHASE-00-04.md`, `PHASE-05-09.md`, `PHASE-10-15.md`.

This block turns a rendered catalogue into a complete conversion path. Phase 16 gives collections
an exhibition surface; 17 gives projects a home that stays honestly empty until real work exists;
18 gives the studio a voice; 19 turns a contact form into a configurator; 20 makes the conversion
model real — persisted inquiry, then WhatsApp; 21 lets a visitor inspect an object in three
dimensions without ruining the page it sits on; 22 hands the owner the controls that decide what
the homepage and store show. Nothing in this block adds checkout, payment or customer accounts, and
nothing in it invents a product, a project, a price, a dimension, a client or a capability.

## Conventions used by all seven phases

| Convention | Value |
|---|---|
| Migration blocks | 16 → `0140–0149`, 17 → `0150–0159`, 18 → `0160–0169`, 19 → `0170–0179`, 20 → `0180–0189`, 21 → `0190–0199`, 22 → `0200–0209` |
| Migration filename | `supabase/migrations/<nnnn>_phase<nn>_<subject>.sql`, forward-only |
| Permission string | `<resource>:<action>` — the Phase 04 matrix is authoritative; new permissions are added to `lib/auth/permissions.ts` and regenerated into SQL |
| Route notation | `/studio/...` = D4 Studio route; `/...` = D3 public route; `app/api/...` = route handler |
| Server actions | co-located `actions.ts` beside the route; every action re-checks permission server-side |
| Zod boundary | form payload, request body, seed module, jsonb payload and uploaded manifest are all Zod-parsed |
| Copy location | no marketing copy in JSX (SEED §1). Every string these phases render comes from `page_sections`, `global_content`, or an entity column |
| Never invented | product names presented as inventory, prices, dimensions, materials, lead times, delivered projects, clients, testimonials, awards, certifications, durability claims (D10, FEAT §38, SEED §32/§55) |
| Conversion model | persisted inquiry → WhatsApp handoff. No checkout, no payment gateway, no customer accounts (D1) |

### Three mechanisms introduced here and reused across the block

**1. The entity-page pattern (Phase 16, reused by 17 and 18).** A collection, a portfolio project
and a journal article are each an ordered list of CMS blocks, so none of them gets a private block
system. Each entity row carries `page_id uuid unique references pages(id)`; the linked `pages` row
carries `kind` = `COLLECTION` | `PROJECT` | `ARTICLE` and `path` = the entity's public path. The
entity row's `status` is authoritative and a trigger (`sync_entity_page_status`) mirrors it onto
the page row, so `lib/cms/resolve.ts`, revision history, scheduling and draft preview all work
unchanged. Deleting the entity cascades to its page.

**2. `entity_relations` (Phase 16, reused by 17, 18, 22).** One curated-edge table for every
non-product source. `product_relations` (Phase 03) remains the product-sourced edge. Neither table
is ever written automatically without a stated rule (FEAT §11). See *Open questions*.

**3. The `deferred` seed outcome (Phase 16).** `scripts/seed-content.ts` gains a fourth per-record
outcome beside insert / update / skip: a seed module may declare `requiresTables: string[]`, and
records whose tables do not yet exist are reported `deferred` instead of failing the run. This is
what lets the Phase 09 modules `journal.ts` and `commissions.ts` hold the journal taxonomy, the ten
article drafts and the three customization templates in one place while the tables that receive
them arrive in Phases 18 and 19. Copy is never duplicated across modules to work around ordering.

### Shared D9 completion checklist

Every phase below inherits all ten points of D9 and is **not COMPLETE** until each is true:

- [ ] 1. Scope implemented
- [ ] 2. Relevant tests run
- [ ] 3. No known scope-breaking error
- [ ] 4. Documentation updated (per the D7 map and FEAT §43)
- [ ] 5. `CHANGELOG.md` updated
- [ ] 6. `PROJECT_STATE.md` updated
- [ ] 7. `docs/SESSION-STATE.md` updated with the FEAT §40 field set
- [ ] 8. Remaining issues documented
- [ ] 9. Next phase identified
- [ ] 10. Repository remains recoverable (migrations replay from clean, no uncommitted generated state)

---

## PHASE 16 — Collections / Exhibitions

**Goal** — A Rivya collection stops being a filtered product grid and becomes an exhibition
(FEAT §8): a page that opens with a hero and a written statement, carries signature media, a
material story, an optional film, an optional 3D element, the products that belong to it, the
projects and journal pieces that surround it, and a commission invitation at the end. The
collection concept system (FEAT §9) lands alongside it: ten named design stories — Ocean, Earth,
Aurora, Midnight, Monsoon, Geode, Forest, Clear, Botanical, Bespoke — exist in Studio as editable
concepts that the public cannot see, and cannot see, until the owner confirms that the collection
is real. After this phase the owner can compose an exhibition without a deploy, and the database
physically refuses to publish a concept nobody has confirmed.

**Depends on** — Phase 08 (CMS engine, block registry, revisions, scheduling, preview), Phase 09
(seed runner and seeded copy), Phase 10 (public site shell and `lib/cms/resolve.ts` consumption),
Phase 14 (product catalogue and `ProductCard`), Phase 06/07 (media and migrated assets).

**Scope**

- The `collections` table from Phase 03 is promoted from a stub into a full entity: statement,
  concept state, curation, relations, SEO, an exhibition page and a publication gate.
- `collection_concept_state` values fixed at `DRAFT_COLLECTION_CONCEPT · OWNER_CONFIRMED · RETIRED`.
  A collection may only reach `status = 'PUBLISHED'` while `concept_state = 'OWNER_CONFIRMED'`;
  enforced by trigger and by `lib/cms/publishing.ts`.
- The entity-page pattern: `pages.kind` check extended with `COLLECTION`; `collections.page_id`
  added; `sync_entity_page_status` and `sync_collection_page_path` triggers.
- Two new CMS blocks — `collection-products` and `signature-media` — plus an **Exhibition template**
  action in Studio that inserts the eleven FEAT §8 elements in order.
- `entity_relations` and its repository, used here for project, journal, material and
  collection-to-collection edges.
- Product curation through the existing `product_collections` join (Phase 03), with drag ordering.
- The ten concept rows, seeded through a new module `content/seed/collection-concepts.ts` as
  **name, slug and sort order only** — no statement, no media, no products. A statement describing
  a collection that does not yet exist would assert business capability (D10), so the field is left
  empty with Studio helper copy explaining why.
- `/collections/[slug]` rendering, its metadata, canonical URL, JSON-LD `CollectionPage`, and
  inclusion in the sitemap only when published.

**Out of scope**

- A `/collections` index route. D3 defines `/collections/[slug]` and no plural index; collections
  are reached from `/collection`, from featured slots (Phase 22), from product pages and from
  search. Do not add the route.
- Writing collection statements, or attaching products to concepts. Both are owner acts.
- Publishing any of the ten concepts. The phase ships with zero published collections.
- The relations *engine* — scoring, similarity, automatic suggestions. Phase 23 owns that;
  Phase 16 stores only hand-made edges.
- Merchandising of collections onto the homepage or store — Phase 22.
- The 3D element itself. The `three-d-resin` block reserves a model slot; Phase 21 fills it.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0140_phase16_collections.sql` | columns, `entity_relations`, page-kind extension, triggers |
| RLS | `supabase/migrations/0141_phase16_collections_rls.sql` | public read published only; staff writes gated by `catalog:write` |
| Repository | `lib/supabase/repositories/collections.ts` | `listPublished`, `getBySlug`, `curatedProducts`, `relatedContent` |
| Relations repository | `lib/supabase/repositories/relations.ts` | `getRelations(sourceType, sourceId)`, `setRelations(...)`; the only writer of `entity_relations` |
| Row schemas | `lib/supabase/schemas/collection.ts`, `lib/supabase/schemas/relation.ts` | Zod, derived from generated types |
| Block schema | `content/blocks/collection-products.ts` | `schema`, `defaults`, `mediaSlots` (none) |
| Block schema | `content/blocks/signature-media.ts` | desktop + mobile slots, optional video slot, caption |
| Renderers | `components/sections/CollectionProducts.tsx`, `components/sections/SignatureMedia.tsx` | 1:1 with block types (D2) |
| Studio editors | `components/studio/blocks/{CollectionProductsEditor,SignatureMediaEditor}.tsx` | |
| Exhibition template | `content/templates/exhibition.ts` | ordered block list applied on "Create exhibition page" |
| Public route | `app/(site)/collections/[slug]/page.tsx` | Server Component; `generateStaticParams` over published collections |
| Public metadata | `app/(site)/collections/[slug]/opengraph-image.tsx` | uses `og` preset from `lib/media/transform.ts` |
| Studio list | `app/(studio)/studio/catalog/collections/page.tsx` | `DataTable`: name, concept state, products, status, updated |
| Studio editor | `app/(studio)/studio/catalog/collections/[collectionId]/page.tsx` + `actions.ts` | identity, statement, curation, relations, SEO, page link |
| Curation UI | `components/studio/CollectionCurator.tsx` | search products, add, drag-reorder, remove |
| Relations UI | `components/studio/RelatedContentPicker.tsx` | reused by Phases 17, 18 |
| Seed module | `content/seed/collection-concepts.ts` | ten FEAT §9 names; registered in `content/seed/index.ts` |
| Seed runner change | `scripts/seed-content.ts` | adds the `deferred` outcome and `requiresTables` |
| Docs | `docs/architecture/DATA_MODEL.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/content/CONTENT_GUIDE.md` | new tables, new Studio screens, two new blocks |
| Tests | `tests/unit/collections-publish-gate.test.ts`, `tests/unit/cms-registry.test.ts` (extended), `tests/e2e/collection-exhibition.spec.ts` | gate, registry parity, full authoring walk |

**Exhibition block order (FEAT §8), as applied by `content/templates/exhibition.ts`**

| # | FEAT §8 element | Block type | Phase that built it |
|---|---|---|---|
| 1 | Hero | `hero` | 08 |
| 2 | Collection statement | `statement` | 08 |
| 3 | Signature media | `signature-media` | **16** |
| 4 | Products | `collection-products` | **16** |
| 5 | Material story | `material-story` | 08 |
| 6 | Video | `signature-media` (video slot) | **16** |
| 7 | Portfolio / project reference | `portfolio-strip` | 08 |
| 8 | 3D element | `three-d-resin` | 08 schema, 21 viewer |
| 9 | Editorial copy | `rich-text` | 08 |
| 10 | Related journal stories | `journal-strip` | 08 |
| 11 | Commission CTA | `commission-cta` | 08 |

Every block is optional and removable; the template is a starting point, not a constraint.

**Database**

| Table | Change | Key columns |
|---|---|---|
| `collections` | extended | adds `page_id uuid unique references pages(id) on delete set null`, `subtitle`, `statement_long text`, `signature_media_id`, `video_media_id`, `seo_entry_id`, `owner_confirmed_at`, `owner_confirmed_by`, `seed_key`, `content_seed_version`, `owner_edited bool default false`; keeps `slug`, `name`, `statement`, `concept_state`, `hero_media_id`, `sort_order` from Phase 03 |
| `entity_relations` | new | `id uuid pk`, `source_type relation_entity`, `source_id uuid`, `target_type relation_entity`, `target_id uuid`, `relation_type relation_kind`, `note text`, `sort_order int not null default 0`, `created_at`, `created_by`; `unique (source_type, source_id, target_type, target_id, relation_type)`; `check (not (source_type = target_type and source_id = target_id))` |
| `pages` | altered | `kind` check becomes `('PAGE','CATEGORY','SYSTEM','COLLECTION')` |

New enums: `relation_entity` = `PRODUCT · COLLECTION · CATEGORY · PORTFOLIO_PROJECT ·
JOURNAL_ARTICLE · MATERIAL`; `relation_kind` = `RELATED · FEATURES · REFERENCES · USES_MATERIAL ·
PART_OF`. `collection_concept_state` gains `OWNER_CONFIRMED` and `RETIRED` via
`alter type ... add value if not exists`, in its own migration statement so no transaction uses a
value it just created.

The publication gate, verbatim:

```sql
create or replace function public.enforce_collection_publish_gate() returns trigger
  language plpgsql as $$
begin
  if new.status = 'PUBLISHED' and new.concept_state <> 'OWNER_CONFIRMED' then
    raise exception 'collection % cannot be published while concept_state = % (FEAT §9)',
      new.slug, new.concept_state;
  end if;
  return new;
end $$;
```

RLS: `anon` may `SELECT` `collections` only where `status = 'PUBLISHED'`; staff reads need
`catalog:read`; writes need `catalog:write`; `concept_state = 'OWNER_CONFIRMED'` may only be set by
`owner` or `admin`. `entity_relations` is never publicly readable by itself — the public reads it
only through repository functions that re-filter targets to published rows.

**Studio surface** — fills `/studio/catalog/collections` (list) and creates
`/studio/catalog/collections/[collectionId]` (editor). The editor has five panels: **Identity**
(name, slug, sort order, concept state with an owner-only confirm control), **Statement** (short
statement, long statement, fact classification, owner-verification), **Curation** (product search
and drag-ordered list writing `product_collections`), **Related content** (`RelatedContentPicker`
over `entity_relations`), **Exhibition page** (a link into `/studio/content/pages/[pageId]` plus
the "Create exhibition page from template" action). A persistent notice on any collection in
`DRAFT_COLLECTION_CONCEPT` reads as a concept, not a product line.

**Public surface** — `/collections/[slug]`, published rows only; anything else is `notFound()`.
The route is absent from `sitemap.xml` while unpublished. `/collection` and `/collection/[category]`
(Phase 14) gain a link into a collection only where one is published.

**Media** — no new family is consumed and nothing is generated. The Studio media picker for a
collection hero, signature slot or video slot is scoped to families that carry atmosphere rather
than fabricated product photography: `material-macro` (39), `wall-art` (20), `three-d-resin` (13),
`interior-lifestyle` (5) and the `largeformat-*` families (18 across six families). Every candidate
is `is_concept = true`, so the picker shows the Phase 07 concept banner and a caption may never
describe the image as a delivered Rivya collection.

**Risks**

| Risk | Mitigation |
|---|---|
| A seeded concept is mistaken for a real collection and published | Trigger blocks `PUBLISHED` unless `concept_state = 'OWNER_CONFIRMED'`; only owner/admin may set that state; the seed writes no statement, media or products, so a published concept would visibly be an empty page |
| Collections quietly become a second block system | The entity-page pattern reuses `pages`/`page_sections`; `tests/unit/cms-registry.test.ts` fails if a renderer exists outside `components/sections/` or a block bypasses the registry |
| `entity_relations` grows automatic edges and starts inventing associations | `setRelations()` requires an `actor` argument and writes `created_by`; no code path calls it without a human action; a unit test asserts zero rows with `created_by is null` |
| A related product is unpublished and leaks through a collection page | The public read path joins on `status = 'PUBLISHED'` for every target; an e2e test unpublishes a curated product and asserts it disappears from `/collections/[slug]` |
| Slug edits break live URLs | `sync_collection_page_path` updates `pages.path` in the same transaction; changing a slug on a published collection requires a confirm dialog and writes a 301 row for Phase 39 to consume |
| Exhibition pages diverge in structure until none look alike | The template fixes the default order; `docs/content/CONTENT_GUIDE.md` documents which blocks are expected and which are optional |

**Verification**

1. `npx supabase db reset && npx supabase db push` — `0140`/`0141` apply from clean.
2. `npm run seed:content -- --only=collection-concepts` — ten rows inserted; re-run reports ten
   skips. `psql "$DATABASE_URL" -c "select slug, concept_state, status from collections order by
   sort_order"` returns exactly `ocean, earth, aurora, midnight, monsoon, geode, forest, clear,
   botanical, bespoke`, all `DRAFT_COLLECTION_CONCEPT` / `DRAFT`.
3. `psql "$DATABASE_URL" -c "update collections set status='PUBLISHED' where slug='ocean'"` —
   rejected by `enforce_collection_publish_gate` with the slug named.
4. `npm run test:unit -- collections-publish-gate cms-registry` — passes.
5. In Studio as `merchandiser`: open a collection, attempt to set `concept_state = OWNER_CONFIRMED`
   → control absent and a direct server-action POST returns 403 with a `DENIED` audit row. Repeat
   as `owner` → succeeds.
6. `npx playwright test tests/e2e/collection-exhibition.spec.ts` — create a collection, apply the
   exhibition template, confirm eleven blocks appear in the §8 order, bind a hero and a signature
   image, curate three published products, add one related journal article, save draft, preview at
   `/collections/<slug>` in draft mode, confirm the owner, publish, and assert the public page
   renders all eleven sections with the three products in the curated order.
7. Unpublish one curated product; reload `/collections/<slug>` — two products render, no gap, no
   placeholder card.
8. `curl -s $NEXT_PUBLIC_SITE_URL/sitemap.xml | grep -c '/collections/'` — equals the number of
   published collections, and is `0` before step 6 publishes one.

**Exit criteria**

- [ ] All ten FEAT §9 concept names exist as `collections` rows, `DRAFT_COLLECTION_CONCEPT`, with
      no statement, no media, no products and no published state.
- [ ] `concept_state` enum has all three values and only owner/admin may set `OWNER_CONFIRMED`.
- [ ] The publication gate is enforced in the database *and* in `lib/cms/publishing.ts`.
- [ ] All eleven FEAT §8 elements are available as blocks, and the exhibition template applies them
      in order.
- [ ] `collection-products` and `signature-media` each have schema + renderer + editor, proven by
      the registry test.
- [ ] `entity_relations` exists with the stated enums and unique constraint, and has no code path
      that writes without an actor.
- [ ] `/collections/[slug]` renders published collections only, is in the sitemap only when
      published, and 404s otherwise.
- [ ] The public read path filters every related target to `status = 'PUBLISHED'`.
- [ ] `docs/architecture/DATA_MODEL.md`, `docs/studio/STUDIO_GUIDE.md` and
      `docs/content/CONTENT_GUIDE.md` are updated; next phase = 17.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 17 — Portfolio / Projects

**Goal** — Rivya gains a project archive that is structurally incapable of lying. The schema, the
Studio editor, the public landing page and the project detail route all exist and are complete, and
the site ships with **zero projects**, because no verified project exists yet. `/portfolio` renders
the SEED §28 empty state rather than fabricated client work; `/portfolio/[slug]` returns 404 for
every slug; and the database refuses to publish a project that is not owner-verified, or one that
names a client without recorded consent. When the owner has real work to show, publishing it is a
Studio action, not a code change.

**Depends on** — Phase 16 (entity-page pattern, `entity_relations`, `RelatedContentPicker`),
Phase 08 (CMS engine and the `empty-state` and `portfolio-strip` blocks), Phase 09 (seeded landing
copy and empty-state copy), Phase 10 (public shell), Phase 06 (media).

**Scope**

- `portfolio_projects`, `portfolio_project_media` and `testimonials`, each shipping with zero rows.
- Two independent publication gates on a project: `owner_verification = 'VERIFIED'`, and — when
  `client_display_name is not null` — `client_consent = 'GRANTED'` with a recorded consent
  reference. The same pair applies to a testimonial through its own columns
  (`attributed_to`, `consent`). Both gates are enforced by a per-table trigger function and by the
  publishing service.
- The entity-page pattern for project detail: `pages.kind` gains `PROJECT`; a project's story is an
  ordered block list at `/portfolio/[slug]`.
- `/portfolio` landing: seeded hero (SEED §17) plus a `portfolio-strip` of published projects that
  falls through to the seeded `empty-state` block when the published count is zero.
- The SEED §28 empty state is the canonical one and is already seeded by Phase 09's `portfolio.ts`.
  Its copy, quoted so no engineer re-invents it:

  | Field | Value |
  |---|---|
  | Heading | *The project archive is being prepared.* |
  | Body | *Verified Rivya projects will appear here as the portfolio develops.* |
  | CTA | *Explore the Collection* → `/collection` |

  SEED §17's inline sentence (*"Portfolio archive is being prepared. Explore the collection or
  discuss a custom project with us."*) is the landing hero's supporting line, not a second empty
  state. Both are seeded rows; neither is written in JSX.
- Project relations (FEAT §11): used/related products, related materials, related articles, related
  collections — all through `entity_relations` with `source_type = 'PORTFOLIO_PROJECT'`.
- `/studio/content/portfolio` and `/studio/content/testimonials` filled, replacing the Phase 08
  stubs.

**Out of scope**

- Creating any project, project photograph, client name, location, completion date, testimonial or
  case-study narrative. Every one of those is a business fact the owner supplies (D10, FEAT §38).
- Binding the five `gallery-scene` assets to a project. They are landing atmosphere only, already
  bound by Phase 09, and attaching them to a project record would present concept media as
  delivered work (manifest `policy.rules[0]`).
- Public testimonial rendering with zero rows — the block exists and renders nothing.
- Project-level 3D — Phase 21 adds the viewer and `associated_project_id` is already on
  `media_assets` from Phase 06.
- Awards, certifications, press mentions, client logos. Not modelled, not rendered, not seeded.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0150_phase17_portfolio.sql` | tables, enums, gates, page-kind extension |
| RLS | `supabase/migrations/0151_phase17_portfolio_rls.sql` | public read published only; writes need `content:write` |
| Repository | `lib/supabase/repositories/portfolio.ts` | `listPublished`, `getBySlug`, `gallery`, `related` |
| Repository | `lib/supabase/repositories/testimonials.ts` | `listPublished` (returns `[]` until real rows exist) |
| Row schemas | `lib/supabase/schemas/{portfolio-project,testimonial}.ts` | Zod |
| Block schema | `content/blocks/project-gallery.ts` | ordered media list with per-item caption and alt override |
| Renderer | `components/sections/ProjectGallery.tsx` | grid + lightbox, keyboard-complete |
| Renderer | `components/sections/TestimonialStrip.tsx` | renders nothing when the published set is empty |
| Card pattern | `components/patterns/ProjectCard.tsx` | registered in `COMPONENT_REGISTRY.md` |
| Public landing | `app/(site)/portfolio/page.tsx` | strip + empty-state fallthrough |
| Public detail | `app/(site)/portfolio/[slug]/page.tsx` | published projects only; `generateStaticParams` |
| Studio list/editor | `app/(studio)/studio/content/portfolio/page.tsx`, `[projectId]/page.tsx`, `actions.ts` | identity, story blocks, gallery, relations, verification |
| Studio testimonials | `app/(studio)/studio/content/testimonials/page.tsx`, `actions.ts` | list, create, consent state, publish gate |
| Verification panel | `components/studio/OwnerVerificationPanel.tsx` | shows why publishing is blocked and who may unblock it |
| Docs | `docs/architecture/DATA_MODEL.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/project/BUSINESS_RULES.md` | the two gates are business rules, not implementation detail |
| Tests | `tests/unit/portfolio-publish-gate.test.ts`, `tests/unit/portfolio-empty.test.ts`, `tests/e2e/portfolio.spec.ts` | gates, empty state, full authoring walk |

**Database**

| Table | Key columns |
|---|---|
| `portfolio_projects` | `id`, `slug citext unique`, `page_id uuid unique references pages(id)`, `title`, `subtitle`, `summary`, `project_type text`, `location_label text`, `completed_on date`, `is_client_project bool not null default false`, `client_display_name text`, `client_consent client_consent_state not null default 'NOT_APPLICABLE'`, `client_consent_reference text`, `client_consent_recorded_at`, `client_consent_recorded_by`, `evidence_note text`, `hero_media_id`, `seo_entry_id`, `sort_order int`, `status content_status`, `owner_verification owner_verification not null default 'OWNER_VERIFICATION_REQUIRED'`, `fact_classification`, `published_at`, `published_by`, `created_at`, `updated_at`, `updated_by` |
| `portfolio_project_media` | `(project_id, media_asset_id)` composite PK, `role text check (role in ('hero','gallery','detail','process','video','model'))`, `caption text`, `alt_override text`, `sort_order int` |
| `testimonials` | `id`, `attributed_to text`, `attribution_role text`, `quote text`, `project_id uuid null`, `consent client_consent_state not null default 'PENDING'`, `consent_reference text`, `status content_status`, `owner_verification`, `sort_order`, audit columns |

New enum: `client_consent_state` = `NOT_APPLICABLE · PENDING · GRANTED · WITHDRAWN`.
`pages.kind` check becomes `('PAGE','CATEGORY','SYSTEM','COLLECTION','PROJECT')`.

The two tables name a person through different columns — `portfolio_projects.client_display_name` /
`client_consent`, `testimonials.attributed_to` / `consent` — so the gate is **one function per
table**, each referencing only columns that exist on its own table. A single shared function would
raise `record "new" has no field …` on the first write to either table:

```sql
create or replace function public.enforce_project_evidence_gate() returns trigger
  language plpgsql as $$
begin
  if new.status = 'PUBLISHED' then
    if new.owner_verification <> 'VERIFIED' then
      raise exception 'portfolio_project % cannot be published until owner_verification = VERIFIED (D10)',
        new.id;
    end if;
    if new.client_display_name is not null
       and new.client_consent is distinct from 'GRANTED' then
      raise exception 'portfolio_project % names a client without GRANTED consent', new.id;
    end if;
  end if;
  if new.client_consent = 'WITHDRAWN' then
    new.status := 'ARCHIVED';
  end if;
  return new;
end $$;

create or replace function public.enforce_testimonial_evidence_gate() returns trigger
  language plpgsql as $$
begin
  if new.status = 'PUBLISHED' then
    if new.owner_verification <> 'VERIFIED' then
      raise exception 'testimonial % cannot be published until owner_verification = VERIFIED (D10)',
        new.id;
    end if;
    if new.attributed_to is not null
       and new.consent is distinct from 'GRANTED' then
      raise exception 'testimonial % names a person without GRANTED consent', new.id;
    end if;
  end if;
  if new.consent = 'WITHDRAWN' then
    new.status := 'ARCHIVED';
  end if;
  return new;
end $$;

create trigger trg_portfolio_projects_evidence_gate
  before insert or update on public.portfolio_projects
  for each row execute function public.enforce_project_evidence_gate();

create trigger trg_testimonials_evidence_gate
  before insert or update on public.testimonials
  for each row execute function public.enforce_testimonial_evidence_gate();
```

Both functions are `before` triggers so the `WITHDRAWN` branch can rewrite `status` in place: a
consent column moving to `WITHDRAWN` forces the row back to `ARCHIVED` on the same statement.
`lib/cms/publishing.ts` re-checks both gates before it attempts the write, so `OwnerVerificationPanel`
names the unmet gate instead of surfacing a raised exception; the triggers are the backstop, not the
user interface. RLS: `anon` may
`SELECT` published rows only; staff reads need `content:read`; writes need `content:write`; only
`owner`/`admin` may set `owner_verification = 'VERIFIED'`,
`portfolio_projects.client_consent = 'GRANTED'` or `testimonials.consent = 'GRANTED'`.

**Studio surface** — fills `/studio/content/portfolio` (list with a permanent zero-row explanation
rather than an error state, plus "New project") and creates
`/studio/content/portfolio/[projectId]` with panels: **Identity** (title, slug, type, location,
completion date), **Client** (is-client-project toggle, display name, consent state, consent
reference — the consent fields are disabled until the toggle is on), **Story** (link to the block
editor for the linked `PROJECT` page), **Gallery** (`portfolio_project_media` with drag ordering
and per-item alt override), **Related** (`RelatedContentPicker`), **Verification**
(`OwnerVerificationPanel`, which names every unmet gate before publish is attempted). Fills
`/studio/content/testimonials` with the same consent discipline.

**Public surface** — `/portfolio` (always renders; strip or empty state) and `/portfolio/[slug]`
(404 for every slug while zero projects are published). `/portfolio` stays in the sitemap;
individual project URLs enter it only on publish.

**Media** — `gallery-scene`, 5 assets, all on manifest page `portfolio`, section `gallery`:
`GALLERY-SCENE-001` image 4:5, `-002` image 21:9, `-003` image 16:9, `-004` image 16:9,
`-005` **video** 16:9. Each `rivya_asset_id` is unique across the manifest, so media is bound by
id with no disambiguation by type. These
remain bound to the `/portfolio` landing hero and atmosphere strip exactly as Phase 09 bound them,
carry `is_concept = true`, and are never attached to a `portfolio_projects` row. No other family is
consumed. Nothing is generated: the Phase 07 gap list already records "no project media" as an
accepted gap, resolved by the empty state, not by generation.

**Risks**

| Risk | Mitigation |
|---|---|
| Pressure to "fill" the portfolio with concept imagery before real work exists | A DB constraint prevents `portfolio_project_media` referencing a media row with `is_concept = true`; `tests/unit/portfolio-publish-gate.test.ts` asserts the rejection |
| A named client is published without consent | Consent gate in the trigger; consent fields are owner/admin-only; withdrawal archives the row automatically |
| `/portfolio/[slug]` renders a draft to the public through a stale cache | The route revalidates on publish through the Phase 08 revalidation path; an e2e test requests a draft slug anonymously and asserts 404 |
| The empty state is replaced with "Coming Soon" by a well-meaning editor | SEED §55 forbids it; the copy lives in `global_content`/`page_sections`, and a unit test greps seeded and stored copy for `Coming Soon` |
| Project completion dates or locations get typed in as guesses | Both fields carry `OWNER_VERIFICATION_REQUIRED` by default and are listed in `OwnerVerificationPanel` before publish |
| Testimonials arrive as marketing copy written in-house | `testimonials` ships with zero rows, `consent` defaults to `PENDING`, and the publish gate treats `attributed_to` exactly like a client name |

**Verification**

1. `npx supabase db push` — `0150`/`0151` apply from clean.
2. `psql "$DATABASE_URL" -c "select count(*) from portfolio_projects"` → `0`;
   `select count(*) from testimonials` → `0`.
3. `curl -s $NEXT_PUBLIC_SITE_URL/portfolio | grep -F 'The project archive is being prepared.'` —
   one match; `curl -o /dev/null -w '%{http_code}' $NEXT_PUBLIC_SITE_URL/portfolio/anything` → `404`.
4. `npm run test:unit -- portfolio-publish-gate portfolio-empty` — passes, including the
   concept-media rejection and both publish gates **on both tables**: an insert into
   `portfolio_projects` and an insert into `testimonials` each succeed as `DRAFT` without a
   missing-field error, publishing either while `owner_verification <> 'VERIFIED'` raises, and a
   testimonial with `attributed_to` set and `consent = 'PENDING'` cannot be published.
5. Create a project in Studio, mark it a client project with a display name, leave consent
   `PENDING`, set `owner_verification = VERIFIED` as owner, attempt publish → refused with the
   consent reason named in the UI and a `DENIED` audit row.
6. Set consent `GRANTED` with a reference, publish → succeeds; `/portfolio` now renders the strip
   and no empty state; `/portfolio/<slug>` returns 200.
7. Set consent `WITHDRAWN` → row moves to `ARCHIVED`, `/portfolio/<slug>` returns 404 within one
   revalidation cycle.
8. Attempt to attach `GALLERY-SCENE-002` to the project gallery → rejected by the concept-media
   constraint with a readable message.
9. `npx playwright test tests/e2e/portfolio.spec.ts` — landing empty state, authoring walk,
   gallery lightbox keyboard model, relations rendering, and anonymous 404 on a draft slug.

**Exit criteria**

- [ ] `portfolio_projects`, `portfolio_project_media` and `testimonials` exist and contain zero rows.
- [ ] `/portfolio` renders the SEED §28 empty state verbatim from seeded content, with no
      "Coming Soon" anywhere.
- [ ] `/portfolio/[slug]` returns 404 for every slug while no project is published.
- [ ] Publishing requires `owner_verification = 'VERIFIED'`; naming a client or a person
      additionally requires `GRANTED` consent — `portfolio_projects.client_consent` and
      `testimonials.consent` respectively — enforced in the database by
      `enforce_project_evidence_gate()` and `enforce_testimonial_evidence_gate()`, each of which
      references only its own table's columns.
- [ ] Concept media (`is_concept = true`) cannot be attached to a project gallery.
- [ ] The five `gallery-scene` assets remain landing-only and are not referenced by any project row.
- [ ] `/studio/content/portfolio` and `/studio/content/testimonials` are filled and no longer stubs.
- [ ] Project relations write through `entity_relations` with an actor recorded.
- [ ] `docs/project/BUSINESS_RULES.md` documents both gates; `DATA_MODEL.md` documents the tables;
      next phase = 18.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 18 — Journal

**Goal** — Rivya gains an editorial surface. The journal landing lists published articles, each
article renders as a composed block document at `/journal/[slug]`, the nine seeded categories give
it structure at `/journal/category/[slug]`, and each article ends with related content chosen by a
human or by one stated rule. The ten seeded article ideas from SEED §20 land as `DRAFT` records
with title and angle intact and nothing else invented — no body text asserting technique,
tolerance, timeline or performance is written for the owner. After this phase the studio can
publish an article without a deploy, and readers move from a story to the objects and projects it
touches.

**Depends on** — Phase 16 (entity-page pattern, `entity_relations`), Phase 08 (blocks, revisions,
scheduling, preview), Phase 09 (the `journal.ts` seed module that holds the categories and drafts),
Phase 10 (public shell), Phase 06/07 (the 24 migrated journal assets).

**Scope**

- `journal_categories` and `journal_articles`, plus `journal_article_categories` for secondary
  categories. The entity-page pattern gives each article its block document (`pages.kind` gains
  `ARTICLE`).
- The Phase 09 `journal.ts` module is re-applied: `npm run seed:content -- --only=journal` now
  resolves its previously `deferred` records and writes nine categories and ten `DRAFT` articles.
  The copy is not restated here or anywhere else — SEED §19 and §20 are its source.

  | # | Seeded article title (SEED §20) | Seeded angle | Extra flag |
  |---|---|---|---|
  | 01 | What Makes a Resin Table More Than a Surface? | material depth, composition, scale, role in interiors | — |
  | 02 | Choosing the Right Size for a Statement Dining Table | room proportion, circulation, seating, visual scale | no dimension standard may be stated without a cited source |
  | 03 | Resin and Wood: Designing Around Contrast | transparency/colour against natural grain | — |
  | 04 | From Digital Form to Physical Object | digital design, 3D fabrication, resin experimentation | any Rivya-specific capability claim is `OWNER_VERIFICATION_REQUIRED` |
  | 05 | What to Prepare Before Requesting a Custom Furniture Commission | dimensions, references, use, materials, space images | — |
  | 06 | A Guide to Resin Colour, Transparency and Visual Depth | — | — |
  | 07 | Large Wall Art: Thinking Beyond Decoration | — | — |
  | 08 | Preserving Flowers in Resin: What a Custom Brief Should Include | — | no preservation-performance promise |
  | 09 | How Material Choice Changes the Character of a Space | — | — |
  | 10 | Why Bespoke Furniture Starts With Context | — | — |

- Nine categories seeded in SEED §19 order: Resin Furniture, Collectible Design, Materials,
  3D Printing, Studio Process, Custom Projects, Interior Art, Preservation, Care & Education.
- Related content (FEAT §11): curated edges through `entity_relations`
  (`JOURNAL_ARTICLE → PRODUCT | PORTFOLIO_PROJECT | JOURNAL_ARTICLE | COLLECTION`), plus exactly one
  automatic rule when curation yields fewer than three items: fill from the same primary category,
  published, ordered by `published_at desc`, excluding the current article, labelled from
  `global_content` as *More in {category}*. No similarity scoring, no personalisation, no
  invented association (FEAT §11).
- Article-level SEO: `seo_entries` row per article, JSON-LD `Article` with `author` set to the
  organisation unless a verified human byline exists, `datePublished`/`dateModified` from real
  columns.
- `/journal` landing with category filter chips, pagination (12 per page), and the SEED §29 empty
  state (*More from the studio soon.*) when zero articles are published.
- `/studio/content/journal` filled, replacing the Phase 08 stub.

**Out of scope**

- Writing article bodies. The seed carries title, angle, category and cover binding; the body is a
  single empty `rich-text` block with the angle stored as an editor note (SEED §20: seed as `DRAFT`,
  do not publish automatically).
- Publishing any article. All ten stay `DRAFT` at the end of this phase.
- Comments, reactions, sharing counts, newsletter capture (SEED §25 remains out of scope) and
  reading-progress analytics.
- Named human authors. `byline` defaults to the organisation; entering a person's name sets
  `OWNER_VERIFICATION_REQUIRED`.
- Tag taxonomy beyond the nine categories, and `/journal/tag/*` — D3 has no such route.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0160_phase18_journal.sql` | tables, page-kind extension, triggers, indexes |
| RLS | `supabase/migrations/0161_phase18_journal_rls.sql` | published-only public read; `content:*` for staff |
| Repository | `lib/supabase/repositories/journal.ts` | `listPublished`, `getBySlug`, `listByCategory`, `relatedFor` |
| Related rule | `lib/cms/related.ts` | `relatedForArticle()` — curated first, then the single stated fallback rule |
| Row schemas | `lib/supabase/schemas/{journal-article,journal-category}.ts` | Zod |
| Card pattern | `components/patterns/ArticleCard.tsx` | registry entry required |
| Renderer | `components/sections/JournalStrip.tsx` (extended) | accepts curated or rule-filled lists |
| Public landing | `app/(site)/journal/page.tsx` | list, filter chips, pagination, empty state |
| Public article | `app/(site)/journal/[slug]/page.tsx` | block document, byline, cover, related strip |
| Public category | `app/(site)/journal/category/[slug]/page.tsx` | category intro + list; 404 on unknown slug |
| Feed *(held — see open question 8)* | `app/(site)/journal/rss.xml/route.ts` | published articles only; absolute URLs; adds a public URL D3 does not list, so it ships only if that amendment is accepted |
| Studio list/editor | `app/(studio)/studio/content/journal/page.tsx`, `[articleId]/page.tsx`, `actions.ts` | identity, categories, cover, body blocks, related, schedule |
| Studio categories | `app/(studio)/studio/content/journal/categories/page.tsx` | rename, reorder, hide; slugs are stable |
| Seed re-application | `content/seed/journal.ts` (Phase 09, unchanged) | resolved from `deferred` in this phase |
| Docs | `docs/architecture/DATA_MODEL.md`, `docs/content/CONTENT_GUIDE.md`, `docs/studio/STUDIO_GUIDE.md` | tables, related rule, editorial workflow |
| Tests | `tests/unit/journal-related.test.ts`, `tests/unit/journal-seed.test.ts`, `tests/e2e/journal.spec.ts` | fallback rule, seed counts and statuses, reader walk |

**Database**

| Table | Key columns |
|---|---|
| `journal_categories` | `id`, `slug citext unique`, `name`, `description`, `intro_heading`, `position int`, `status content_status`, `seed_key`, `content_seed_version`, `owner_edited`, audit columns |
| `journal_articles` | `id`, `slug citext unique`, `page_id uuid unique references pages(id)`, `title`, `standfirst text`, `excerpt text`, `angle_note text`, `primary_category_id fk`, `cover_media_id`, `cover_mobile_media_id`, `byline text not null default 'Rivya Living Art'`, `reading_minutes int`, `seo_entry_id`, `published_at`, `published_by`, `status content_status`, `owner_verification`, `fact_classification`, `seed_key`, `content_seed_version`, `owner_edited`, audit columns |
| `journal_article_categories` | `(article_id, category_id)` composite PK, `position int` |

`pages.kind` check becomes `('PAGE','CATEGORY','SYSTEM','COLLECTION','PROJECT','ARTICLE')`.
`reading_minutes` is computed on save from the block text at 200 words per minute — derived, never
typed. Indexes: `journal_articles (status, published_at desc)`,
`journal_articles (primary_category_id, published_at desc)`, `pg_trgm` on `title`.

RLS: `anon` may `SELECT` `journal_categories` and `journal_articles` where `status = 'PUBLISHED'`
and, for articles, `published_at <= now()`; staff reads need `content:read`; writes `content:write`;
publishing `content:publish` (Phase 08 transition table). A trigger refuses `PUBLISHED` while
`owner_verification = 'OWNER_VERIFICATION_REQUIRED'`, which is what keeps article 04's capability
claims and article 08's preservation language out of production until reviewed.

**Studio surface** — fills `/studio/content/journal` (list: title, category, status, cover bound?,
scheduled at, updated by) and creates `/studio/content/journal/[articleId]` with panels —
*Identity* (title, slug, standfirst, excerpt, byline), *Categories* (primary + secondary), *Cover*
(desktop and mobile media slots, separate per D6), *Body* (link into the block editor for the
linked `ARTICLE` page), *Related* (`RelatedContentPicker`) and *Publishing* (status, `publish_at`,
`unpublish_at`, owner-verification panel). Adds
`/studio/content/journal/categories` for the nine seeded categories.

**Public surface** — `/journal`, `/journal/[slug]` and `/journal/category/[slug]`, all three fixed
by D3, plus one public URL D3 does not list: the feed at `/journal/rss.xml`. It is a route handler,
not a page, and it is not a Next.js root convention the way `sitemap.xml` and `robots.txt` are
(PHASE-10-15), so it is a genuine addition to the D3 map and is raised as
**open question 8** below rather than shipped silently. Build the feed only once that amendment is
accepted; until then the deliverable, verification step 8 and the exit-criteria line for it are
held. Unknown category slugs 404; unpublished
article slugs 404 for anonymous requests and render in draft mode for staff through the Phase 08
preview token.

**Media** — the `journal` page bucket: `editorial` (19 assets — `EDITORIAL-001` … `-016` are images
at 4:5, 3:2, 1:1, 3:4 and 16:9, plus three videos: `EDITORIAL-017` 9:16, `EDITORIAL-018` 16:9,
`EDITORIAL-019` 16:9)
and `workshop-session` (5 images, all 16:9). Twenty-four assets for ten drafts, so each seeded draft
gets a distinct desktop cover from `editorial` and a distinct mobile cover where a 4:5 or 3:4
variant exists; `workshop-session` supplies the landing atmosphere and the category headers. Covers
are bound by `content/seed/media-bindings.ts` (Phase 09) using `rivya_asset_id` values; a binding
that cannot be resolved fails the seed rather than falling back to a placeholder. Nothing is
generated — the Phase 07 gap table already records journal covers as **covered**.

**Risks**

| Risk | Mitigation |
|---|---|
| A seeded draft is published with an empty body | Publishing requires at least one non-empty block; `lib/cms/publishing.ts` refuses and names the article |
| An article states a technical or preservation claim as fact | Articles 02, 04 and 08 seed `OWNER_VERIFICATION_REQUIRED`; the trigger blocks publishing until an owner verifies; `CONTENT_GUIDE.md` records why |
| The related-content fallback starts inventing associations | Exactly one rule exists, stated in `lib/cms/related.ts` and asserted by `journal-related.test.ts`; curated edges always win; the fallback is visibly labelled *More in {category}* |
| Category slugs get renamed and break URLs | Slugs are immutable after seed; renaming edits `name` only, and an attempted slug change on a published category requires a confirm dialog plus a redirect row for Phase 39 |
| The journal drifts into a gift-shop voice | SEED §56 priority order is documented in `CONTENT_GUIDE.md`; the landing orders by `published_at`, and category order follows the seeded `position` |
| Cover media reads as documentary photography of real work | Every journal asset is `is_concept = true`; alt text is reviewed in Phase 09's exit criteria; no caption describes an image as a finished commission |

**Verification**

1. `npx supabase db push && npm run seed:content -- --only=journal` — reports nine category inserts
   and ten article inserts, and zero `deferred`.
2. `psql "$DATABASE_URL" -c "select count(*) from journal_categories"` → `9`;
   `select count(*) filter (where status='DRAFT') from journal_articles` → `10`;
   `select count(*) filter (where status='PUBLISHED') from journal_articles` → `0`.
3. Re-run `npm run seed:content -- --only=journal` — nineteen skips, no `updated_at` change.
4. `curl -s $NEXT_PUBLIC_SITE_URL/journal | grep -F 'More from the studio soon.'` — one match while
   nothing is published.
5. `npm run test:unit -- journal-related journal-seed` — the fallback rule returns same-category,
   published, recency-ordered items, excludes the current article, and never fires when three or
   more curated edges exist.
6. In Studio: open article 04, add a `rich-text` block, attempt publish → refused because
   `owner_verification = OWNER_VERIFICATION_REQUIRED`; verify as owner, publish → succeeds.
7. `npx playwright test tests/e2e/journal.spec.ts` — landing pagination at 12, category filter,
   article renders cover + body + related strip, `/journal/category/materials` lists only that
   category, an unknown category 404s, and an unpublished slug 404s anonymously but renders under a
   valid preview token.
8. *Only if open question 8 is accepted:* `curl -s $NEXT_PUBLIC_SITE_URL/journal/rss.xml |
   xmllint --noout -` — well-formed; item count equals the published article count. If the
   amendment is declined, assert instead that the URL returns `404` and that no feed link element
   appears in `/journal`'s `<head>`.

**Exit criteria**

- [ ] Nine categories exist with SEED §19 names in SEED §19 order.
- [ ] Ten articles exist, all `DRAFT`, with SEED §20 titles and angle notes, and none published by
      the seed.
- [ ] Every seeded draft has a bound desktop cover, and a mobile cover wherever a portrait variant
      exists; no binding falls back to a placeholder.
- [ ] `/journal`, `/journal/[slug]` and `/journal/category/[slug]` all render; unknown slugs 404.
- [ ] `/journal/rss.xml` exists **only** if open question 8 has been accepted as a D3 amendment;
      otherwise it is absent and no feed is advertised.
- [ ] The related-content engine uses curated edges first and exactly one documented fallback rule.
- [ ] Articles 02, 04 and 08 carry `OWNER_VERIFICATION_REQUIRED` and cannot be published unverified.
- [ ] `reading_minutes` is computed, never entered by hand.
- [ ] `/studio/content/journal` and its categories screen are filled and no longer stubs.
- [ ] `DATA_MODEL.md`, `CONTENT_GUIDE.md` and `STUDIO_GUIDE.md` updated; next phase = 19.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 19 — Bespoke / Custom Configurator

**Goal** — `/custom-commissions` stops being a page with a contact form and becomes a guided brief.
A visitor walks the FEAT §15 sequence — project type, approximate dimensions, wood preference, resin
direction, colour, finish, base and structure, reference upload, location, notes, contact details —
and arrives at a complete, validated brief. Every step, every field, every option, every label and
every ordering decision is Studio-configurable, so changing the questions is an editorial act. The
three SEED §33–§35 templates (furniture, preservation, 3D + resin) exist as real form definitions.
Nothing anywhere in this phase calculates, estimates, implies or displays a bespoke price.

**Depends on** — Phase 06 (signed uploads, `media_assets`), Phase 08 (CMS blocks and
`global_content` labels), Phase 09 (`commissions.ts` seed module holding the three templates),
Phase 14/15 (product and product-detail surfaces that link to a form), Phase 10 (public shell).

**Scope**

- `customization_forms`, `customization_form_steps`, `customization_form_fields`, and
  `product_customization_forms` binding a form to a product or a category.
- The three seeded templates, resolved from `deferred` by re-running
  `npm run seed:content -- --only=commissions`. The 3D + resin template seeds
  `OWNER_VERIFICATION_REQUIRED` as SEED §35 requires.
- A runtime schema builder, `lib/cms/forms.ts`: `buildFormSchema(form)` turns a stored form
  definition into a Zod object, so validation is generated from the same rows the editor edits and
  cannot drift from them.
- The multi-step configurator: one step per screen, progress indicator, back/next, per-step
  validation, deep-linkable `?step=` parameter, browser-back support, and draft state held in
  `sessionStorage` only. It also honours `/custom-commissions?product=<slug>`, the link Phase 15's
  conversion rail emits: the referenced product is resolved, its bound form is selected, and
  `project_type` is pre-filled — from the product row, never from a guess. There is no server-side draft and no identity — customer accounts are
  forbidden (D1).
- Public reference upload: `app/api/inquiries/upload-sign/route.ts`, unauthenticated but tightly
  constrained; used by the configurator here and by the contact form in Phase 20.
- A minimal feature-flag primitive (FEAT §32): `feature_flags` table, `lib/flags/index.ts`,
  `isEnabled(flag)` evaluated server-side, and an owner-only toggle list at `/studio/system/flags`.
  First consumers: `commission_configurator` (this phase) and `3d_viewer` (Phase 21). The full
  flag management UI remains Phase 38.
- `/studio/catalog/customization-forms` filled: list, form builder, step and field editors,
  template duplication, product and category binding, live preview.

**Out of scope**

- Persisting the inquiry and handing off to WhatsApp — Phase 20. This phase ends at a validated
  payload; `commission_configurator` ships **flag-off** and `/custom-commissions` keeps rendering
  its Phase 09 copy until Phase 20 turns the flag on.
- Any pricing: no price fields, no price arithmetic, no "estimated cost", no configurator-driven
  quote. Price vocabulary stays the seeded SEED §30 labels — `Request a Quote`, `Starting from`,
  `Price on Request` — rendered by the product surfaces, not by the configurator.
- Material or dimension validation that asserts what Rivya can make (for example "maximum span
  3200 mm"). Bounds are only enforced where the owner enters them, and default to none.
- Lead times, availability, production scheduling, delivery estimates.
- 3D preview of the configured object.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0170_phase19_customization_forms.sql` | four tables, enums, ordering constraints |
| Migration | `supabase/migrations/0171_phase19_flags.sql` | `feature_flags`, seeded off |
| RLS | `supabase/migrations/0172_phase19_rls.sql` | published forms readable by anon; writes need `catalog:write` |
| Schema builder | `lib/cms/forms.ts` | `buildFormSchema`, `buildStepSchema`, `summariseAnswers` |
| Repository | `lib/supabase/repositories/customization-forms.ts` | `getPublishedBySlug`, `forProduct`, `forCategory` |
| Flags | `lib/flags/index.ts`, `lib/flags/flags.ts` | typed flag union; server-side evaluation only |
| Configurator | `components/patterns/Configurator/{index.tsx,Step.tsx,Progress.tsx,ReferenceUpload.tsx,Review.tsx}` | client component, keyboard-complete |
| Block schema | `content/blocks/commission-configurator.ts` | selects which form slug the block mounts |
| Renderer | `components/sections/CommissionConfigurator.tsx` | mounts the configurator behind the flag |
| Upload endpoint | `app/api/inquiries/upload-sign/route.ts` | POST, Zod, rate-limited, folder-forced, MIME-limited |
| Studio list | `app/(studio)/studio/catalog/customization-forms/page.tsx` | forms, kind, bindings, status |
| Studio builder | `app/(studio)/studio/catalog/customization-forms/[formId]/page.tsx` + `actions.ts` | step/field CRUD, drag ordering, duplicate template, preview |
| Studio flags | `app/(studio)/studio/system/flags/page.tsx` | owner-only toggle list |
| Docs | `docs/studio/STUDIO_GUIDE.md`, `docs/architecture/DATA_MODEL.md`, `docs/project/BUSINESS_RULES.md` | the no-pricing rule is a business rule |
| Tests | `tests/unit/form-schema.test.ts`, `tests/unit/no-pricing.test.ts`, `tests/e2e/configurator.spec.ts` | schema generation, pricing-absence guard, full walk |

**FEAT §15 step sequence, fixed as seeded step keys**

| # | FEAT §15 step | `step.key` | Default state |
|---|---|---|---|
| 1 | Product / Project Type | `project_type` | enabled, required |
| 2 | Approximate Dimensions | `dimensions` | enabled, required |
| 3 | Wood Preference | `wood` | enabled, optional |
| 4 | Resin Direction | `resin_direction` | enabled, optional |
| 5 | Colour | `colour` | enabled, optional |
| 6 | Finish | `finish` | enabled, optional |
| 7 | Base / Structure | `base_structure` | enabled, optional |
| 8 | Reference Upload | `references` | enabled, optional |
| 9 | Location | `location` | enabled, required |
| 10 | Notes | `notes` | enabled, optional |
| 11 | Contact Details | `contact` | enabled, required, always last |

Steps 1–10 may be disabled, renamed and reordered from Studio. `contact` may be renamed but not
disabled and not moved off the end — without it there is no one to reply to. The two terminal
actions in FEAT §15, *Save Inquiry* and *WhatsApp*, are not configurable steps; they are Phase 20.

**Seeded templates** — the field lists come from SEED §33–§35 and are not restated here; the
mapping onto steps is:

| Template (`slug`) | Kind | Fields → steps |
|---|---|---|
| `furniture-commission` | `FURNITURE` | Desired Size / Length / Width / Height → `dimensions`; Resin Colour Direction + Transparency Preference → `resin_direction`; Wood Preference → `wood`; Base / Leg Preference → `base_structure`; Finish Preference → `finish`; Reference Images → `references`; Delivery City → `location`; Project Notes → `notes` |
| `preservation-commission` | `PRESERVATION` | Preservation Type + Occasion + Item / Flower Type → `project_type`; Preferred Shape + Preferred Size → `dimensions`; Personalization → `notes`; Reference Image → `references`; Notes → `notes` |
| `three-d-resin-commission` | `THREE_D_RESIN` | Object Type + Intended Use → `project_type`; Approximate Dimensions → `dimensions`; Preferred Form Direction + 3D Structure Direction → `base_structure`; Resin Colour → `colour`; Reference Images → `references`; Notes → `notes` |

Every field row supports the SEED §33 contract: enabled, disabled, required, optional, reordered,
renamed. The preservation template carries no compatibility promise and the 3D + resin template
carries `OWNER_VERIFICATION_REQUIRED` until the owner defines real manufacturing options.

**Database**

| Table | Key columns |
|---|---|
| `customization_forms` | `id`, `slug citext unique`, `name`, `kind form_kind`, `description`, `intro_heading`, `intro_body`, `submit_label_key text` (resolves in `global_content`), `is_default bool`, `status content_status`, `owner_verification`, `fact_classification`, `seed_key`, `content_seed_version`, `owner_edited`, audit columns |
| `customization_form_steps` | `id`, `form_id fk on delete cascade`, `key text`, `title`, `description`, `position int`, `is_enabled bool default true`, `is_required bool default false`; `unique (form_id, key)`, `unique (form_id, position) deferrable initially deferred` |
| `customization_form_fields` | `id`, `form_id fk`, `step_id fk on delete cascade`, `key text`, `label`, `help_text`, `placeholder`, `field_type form_field_type`, `options jsonb default '[]'`, `validation jsonb default '{}'`, `is_enabled bool default true`, `is_required bool default false`, `position int`, `include_in_whatsapp bool default true`; `unique (form_id, key)` |
| `product_customization_forms` | `id`, `form_id fk`, `product_id uuid null`, `category_id uuid null`, `position int`; `check (num_nonnulls(product_id, category_id) = 1)` |
| `feature_flags` | `key text pk`, `description`, `is_enabled bool not null default false`, `updated_at`, `updated_by` |

New enums: `form_kind` = `FURNITURE · PRESERVATION · THREE_D_RESIN · CUSTOM`;
`form_field_type` = `TEXT · TEXTAREA · NUMBER · DIMENSION · SELECT · MULTISELECT · RADIO ·
CHECKBOX · COLOUR_DIRECTION · FILE · CITY · CONTACT_NAME · CONTACT_PHONE · CONTACT_EMAIL`.

There is deliberately **no** price, currency, cost, multiplier or surcharge column anywhere in this
schema, and `validation` is Zod-shaped only (`min`, `max`, `maxLength`, `pattern`, `accept`,
`maxFiles`, `maxBytes`). `tests/unit/no-pricing.test.ts` greps the migration, the schema builder and
`components/patterns/Configurator/**` for price-shaped identifiers and fails on a hit.

RLS: `anon` may `SELECT` forms, steps and fields where the form's `status = 'PUBLISHED'`; staff
reads need `catalog:read`; writes need `catalog:write`. `feature_flags` is readable by any active
staff member and writable only by `owner`.

**Public upload endpoint constraints** (`app/api/inquiries/upload-sign/route.ts`)

| Constraint | Value |
|---|---|
| Method / body | POST only, Zod-parsed, same-origin check |
| Rate limit | 10 signatures per IP per hour, 3 per minute; exceeded → 429 with the SEED §49 upload-error copy |
| Folder | forced to `rivya/inquiries/incoming/<uuid v4 issued by the server>`; the client cannot choose it |
| MIME allowlist | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf` |
| Size / count | 10 MB per file, 5 files per submission |
| Resulting rows | `media_assets` with `source = 'USER_UPLOAD'`, `status = 'DRAFT'`, `is_ai_generated = false`, `is_concept = false`, alt text set to the original filename pending editor review |
| Visibility | never returned by any public read path; visible only in `/studio/inquiries` and `/studio/media` |
| Orphans | uploads not referenced by an inquiry within 30 days are purged by a cron job registered in Phase 38 |

**Studio surface** — fills `/studio/catalog/customization-forms` (list: name, kind, bindings,
fields, status, owner-verification pill) and creates
`/studio/catalog/customization-forms/[formId]`: a two-pane builder with a drag-ordered step and
field tree on the left and a live preview of the public configurator on the right, plus the actions
*Duplicate from template*, *Bind to product/category* and *Preview as visitor*, the last of which
opens the flag-gated route in draft mode. Also creates a minimal `/studio/system/flags`
(owner-only, key, description, toggle, last changed by).

**Public surface** — no new route. `/custom-commissions` (D3, seeded in Phase 09) gains the
`commission-configurator` block, which renders the configurator when
`isEnabled('commission_configurator')` and otherwise renders nothing, leaving the seeded copy and
existing CTAs in place. Product pages (Phase 15) render *Customize This Piece* only when a form is
bound and the flag is on. `app/api/inquiries/upload-sign` is a route handler, not a page.

**Media** — None consumed from the manifest. This phase creates the first non-Higgsfield media
path: visitor reference uploads, which are `is_ai_generated = false`, `is_concept = false`, private,
and never rendered on a public surface.

**Risks**

| Risk | Mitigation |
|---|---|
| A price field is added "just for internal estimating" | No price column exists; `no-pricing.test.ts` runs in CI over the migration and the configurator directory; `BUSINESS_RULES.md` states the prohibition |
| The public upload endpoint becomes an open file host | Server-issued folder, MIME allowlist, byte and count ceilings, per-IP rate limit, no listing path, 30-day orphan purge, and uploads land `DRAFT` so RLS keeps them out of public reads |
| Form definitions and validation drift apart | Validation is generated from the stored rows by `buildFormSchema`; `form-schema.test.ts` round-trips each seeded template and asserts the generated schema rejects and accepts the expected payloads |
| A visitor loses a long brief on refresh | Step answers persist to `sessionStorage` under a versioned key; the review step restores them; clearing happens on successful submit (Phase 20) |
| The configurator ships half-finished because Phase 20 is not done | The route is flag-gated off; the flag is only switched on in Phase 20's exit criteria; a Playwright test asserts `/custom-commissions` is unchanged while the flag is off |
| Disabling the contact step leaves unreachable inquiries | `contact` cannot be disabled or reordered; the server action rejects a form definition that lacks a contact step |
| A required field is added after templates are bound and breaks live forms | Field changes are versioned through `content_revisions`; the builder warns when a bound form gains a required field, and preview must be run before publish |

**Verification**

1. `npx supabase db push && npm run seed:content -- --only=commissions` — three form templates
   insert with zero `deferred`; `select slug, kind, owner_verification from customization_forms`
   returns the three rows with `three-d-resin-commission` flagged
   `OWNER_VERIFICATION_REQUIRED`.
2. `psql "$DATABASE_URL" -c "select f.key, s.key from customization_form_fields f join
   customization_form_steps s on s.id = f.step_id where f.form_id = (select id from
   customization_forms where slug='furniture-commission') order by s.position, f.position"` —
   returns the SEED §33 field list mapped onto the step table above.
3. `npm run test:unit -- form-schema no-pricing` — passes; add a `price_modifier` column to the
   migration and confirm `no-pricing` fails.
4. `curl -X POST $NEXT_PUBLIC_SITE_URL/api/inquiries/upload-sign -H 'content-type: application/json'
   -d '{"folder":"rivya/brand","mime":"image/png","bytes":1024}'` — folder is ignored and the
   response signs `rivya/inquiries/incoming/<uuid>`; repeat with `"mime":"text/html"` → 422; loop
   the call 11 times in an hour → 429 carrying the SEED §49 upload-error copy.
5. Enable `commission_configurator` in `/studio/system/flags` as `owner` (as `admin`, the toggle is
   absent and a direct POST is denied and audited), then
   `npx playwright test tests/e2e/configurator.spec.ts` — walk all eleven steps of
   `furniture-commission`, assert per-step validation, back/forward navigation, `?step=` deep link,
   `sessionStorage` restore after reload, upload of two references, and a review screen listing
   every answered field and **no price of any kind**.
6. In Studio, disable the `wood` step and rename `finish` to *Surface Finish*; reload the public
   configurator → ten steps, renamed label, no deploy.
7. Attempt to disable the `contact` step → server action rejects with a named reason.
8. Turn the flag off; `curl -s $NEXT_PUBLIC_SITE_URL/custom-commissions | grep -c 'configurator'` →
   `0`, and the seeded Phase 09 copy still renders.

**Exit criteria**

- [ ] All eleven FEAT §15 steps exist as step rows with the keys above, and steps 1–10 are
      enable/disable/rename/reorder-able from Studio.
- [ ] `contact` is always present and always last, enforced server-side.
- [ ] The three SEED §33–§35 templates exist with their field lists intact; the 3D + resin template
      is `OWNER_VERIFICATION_REQUIRED`.
- [ ] Every field supports enabled, disabled, required, optional, reordered and renamed.
- [ ] Validation is generated from stored rows, not hand-written per form.
- [ ] No price, cost, currency, estimate or quote calculation exists anywhere in the schema or the
      configurator, proven by `no-pricing.test.ts` in CI.
- [ ] The public upload endpoint enforces every constraint in the table above, and uploads are
      private, `DRAFT`, and purge-scheduled.
- [ ] `feature_flags` exists, `commission_configurator` and `3d_viewer` are registered, both off,
      and only `owner` can toggle them.
- [ ] `/studio/catalog/customization-forms` is filled with a working builder and live preview.
- [ ] `BUSINESS_RULES.md`, `STUDIO_GUIDE.md` and `DATA_MODEL.md` updated; next phase = 20.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 20 — Inquiry + WhatsApp Flow

**Goal** — The conversion model becomes real, and becomes safe. Every enquiry — from a product page,
the contact form, or the Phase 19 configurator — is validated, written to the database and given a
reference code **before** anything else happens. Only after that write succeeds is a WhatsApp
message composed from the seeded template and the visitor handed off. If the write fails, the
visitor is told so and stays exactly where they are: the redirect never happens without persistence
(SEED §49). Staff get a real inbox at `/studio/inquiries` with the five D4 views, a status pipeline
and an export. No checkout, no payment, no account, at any point.

**Depends on** — Phase 19 (configurator payload, upload endpoint, flags), Phase 15 (product detail
enquiry CTA), Phase 09 (seeded WhatsApp templates, success copy, error copy, action labels),
Phase 08 (`global_content`, `contact-form` block), Phase 05 (Studio primitives, activity feed).

**Scope**

- `inquiries`, `inquiry_attachments` and `inquiry_events`, with anon-insert-only RLS: the public may
  create an enquiry and may never read one.
- The single write path `submitInquiry()`: Zod-validate → insert inside one transaction → allocate
  `reference_code` → attach uploaded references → write an `inquiry_events` row → return
  `{ referenceCode, whatsappUrl | null }`. The URL comes from Phase 10's
  `buildHandoffUrl({ inquiryId, template, values })`, whose `inquiryId` is required and
  non-optional, so it is **unconstructable before the insert** and a failed insert cannot produce a
  URL. `buildDirectContactUrl` stays restricted to the Phase 10 allowlist and is never used here.
- The two seeded templates rendered by Phase 10's `lib/whatsapp/`: SEED §36 (product / general
  enquiry) and SEED §37 (custom commission), with the exact token names
  `{{product_or_project}} {{customer_name}} {{phone}} {{city}} {{customization_summary}} {{notes}}
  {{reference_urls}} {{inquiry_id}}` and `{{project_type}} {{dimensions}} {{city}}
  {{material_direction}} {{notes}} {{reference_urls}} {{inquiry_id}}`.
- Graceful shortening (SEED §36). Phase 10 built the mechanism and the hard `wa.me` length cap;
  this phase fixes the exact ladder below, records which level fired on the inquiry row, and adds
  the `whatsapp.include_reference_urls` toggle.
- Success and error surfaces using the seeded copy, rendered as in-page states — D3 defines no
  success route, so none is created.
- Contact details consolidated: `global_content` gains the group `CONTACT`
  (`phone`, `whatsapp_number`, `email`, `maps_url`), so SEED §21's "do not hardcode these values in
  multiple components" holds. `NEXT_PUBLIC_WHATSAPP_NUMBER` (D8) is the deployment default; a
  `VERIFIED` `global_content` value overrides it.
- The five D4 inquiry views, a status pipeline, assignment, internal notes, attachment viewing and
  CSV export gated on `inquiries.export`.
- The `commission_configurator` flag is switched on at the end of this phase.

**Out of scope**

- Payment, deposit capture, invoicing, order records, cart, checkout or any commercial state beyond
  an enquiry (D1). `Place Order` (SEED §31) stays a label that resolves to this flow and is enabled
  here only as an alias for *Send an Enquiry*; it never implies a transaction.
- Customer accounts, login, saved enquiries or enquiry status lookup by the visitor.
- Automated replies, CRM sync, email notification pipelines, quotation automation (FEAT §39).
- WhatsApp Business API integration. The handoff is a `wa.me` deep link, nothing more.
- Analytics dashboards over enquiries — Phase 37 consumes this data.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0180_phase20_inquiries.sql` | three tables, enums, reference-code sequence |
| RLS | `supabase/migrations/0181_phase20_inquiries_rls.sql` | anon insert only; staff read via `inquiries:read` |
| Migration | `supabase/migrations/0182_phase20_contact_settings.sql` | `global_content.group` gains `CONTACT`; seeded values migrated |
| Repository | `lib/supabase/repositories/inquiries.ts` | `create`, `listForStudio`, `get`, `setStatus`, `addNote`, `export` |
| Row schemas | `lib/supabase/schemas/inquiry.ts` | one Zod schema per `inquiry_kind`; the trust boundary |
| Template renderer | `lib/whatsapp/render.ts` (Phase 10, extended) | token allowlist finalised; unknown token → empty line, never `{{token}}` |
| Shortener | `lib/whatsapp/shorten.ts` (Phase 10, extended) | the five-level ladder below; pure, unit-tested; returns the level that fired |
| Number resolution | `lib/whatsapp/number.ts` | `global_content` (`VERIFIED`) → `NEXT_PUBLIC_WHATSAPP_NUMBER`; E.164 normalisation; consumed by Phase 10's builders |
| Submit action | `app/(site)/_actions/submit-inquiry.ts` | the only public write path; re-validated server-side |
| Success state | `components/patterns/InquirySuccess.tsx` | SEED §48 copy from `global_content`; `Continue to WhatsApp` |
| Error states | `components/patterns/FormErrors.tsx` | SEED §49 copy; save-error path never navigates |
| Product enquiry | `components/patterns/ProductInquiryDialog.tsx` | mounts inside Phase 15's `ProductInquiryRail`; the rail's disabled submit becomes live here |
| Studio views | `app/(studio)/studio/inquiries/{all,product,commission,consultation,quote}/page.tsx` | `DataTable` + `FilterBar`, shared component |
| Studio detail | `app/(studio)/studio/inquiries/[inquiryId]/page.tsx` + `actions.ts` | payload, attachments, events, pipeline, notes, assignment |
| Export | `app/api/studio/inquiries/export/route.ts` | CSV, `inquiries:export`, audited, no raw IP |
| Docs | `docs/project/BUSINESS_RULES.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/architecture/DATA_MODEL.md`, `docs/ops/SECURITY.md` | conversion rule, inbox, schema, PII handling |
| Tests | `tests/unit/whatsapp-render.test.ts`, `tests/unit/whatsapp-shorten.test.ts`, `tests/unit/inquiry-persistence.test.ts`, `tests/e2e/inquiry-flow.spec.ts` | tokens, shortening, the no-redirect-on-failure rule, three end-to-end paths |

**The persistence rule, stated so it cannot be misread**

```
validate → insert → allocate reference_code → attach references → log event
                                   │
                     insert failed │ insert succeeded
                                   ▼
      render SEED §49 save-error   │   return { referenceCode, whatsappUrl }
      stay on the page             │   render SEED §48 success state
      no navigation, no wa.me URL  │   visitor clicks "Continue to WhatsApp"
      built, no reference code     │   (or is auto-forwarded after 1s, cancellable)
```

Three properties make this enforceable rather than aspirational: Phase 10's `buildHandoffUrl`
takes `inquiryId` as a required, non-optional argument, so it does not type-check before the insert;
`submitInquiry` returns a discriminated union (`{ ok: true, ... } | { ok: false, code }`) that the
client must narrow before navigating; and `tests/unit/inquiry-persistence.test.ts` forces the insert
to fail and asserts the returned object contains no URL.

**Graceful shortening ladder** (SEED §36 "shorten gracefully if the message becomes too long")

Budget: 1,800 characters of decoded message text. Steps apply in order until the message fits.

| # | Action |
|---|---|
| 1 | Drop lines whose only token resolved to empty |
| 2 | Keep the first 8 `{{customization_summary}}` items; append *…and N more (enquiry {{inquiry_id}})* |
| 3 | Truncate `{{notes}}` to 300 characters on a word boundary with an ellipsis |
| 4 | Replace `{{reference_urls}}` with *N reference images attached (enquiry {{inquiry_id}})* |
| 5 | Fall back to the short form: greeting, product or project type, name, phone, city, enquiry id |

`{{inquiry_id}}` — the human-readable `reference_code` — is never dropped at any level; it is what
lets the owner find the full brief in Studio. Fields carrying `include_in_whatsapp = false`
(Phase 19) never enter the summary, and internal columns (`ip_hash`, `user_agent`, `utm_*`,
`assigned_to`, notes) never enter it at all. `{{reference_urls}}` renders as a count by default; a
`global_content` toggle `whatsapp.include_reference_urls` may switch it to full delivery URLs.

**Database**

| Table | Key columns |
|---|---|
| `inquiries` | `id uuid pk`, `reference_code text unique not null` (format `RIV-<yyyy>-<6-digit sequence>`), `kind inquiry_kind not null`, `pipeline_status inquiry_status not null default 'NEW'`, `source_path text`, `product_id uuid null`, `collection_id uuid null`, `customization_form_id uuid null`, `name text not null`, `phone text not null`, `email citext null`, `city text`, `message text`, `answers jsonb not null default '{}'`, `enquiry_type text` (SEED §22 list), `whatsapp_state whatsapp_state not null default 'NOT_SENT'`, `whatsapp_shortened_at_level int`, `consent_contact bool not null default true`, `referrer text`, `utm jsonb`, `ip_hash text`, `user_agent text`, `assigned_to uuid null`, `created_at`, `updated_at`, `updated_by` |
| `inquiry_attachments` | `(inquiry_id, media_asset_id)` composite PK, `position int`, `created_at` |
| `inquiry_events` | `id`, `inquiry_id fk`, `event inquiry_event_kind`, `actor_id uuid null`, `from_status`, `to_status`, `note text`, `metadata jsonb`, `occurred_at timestamptz default now()`; append-only |

New enums: `inquiry_kind` = `PRODUCT · COMMISSION · CONSULTATION · QUOTE · GENERAL` (the five D4
views, plus `GENERAL` for the contact form, surfaced under *All*); `inquiry_status` = `NEW · READ ·
IN_CONVERSATION · QUOTED · WON · LOST · SPAM · ARCHIVED`; `whatsapp_state` = `NOT_SENT ·
REDIRECTED · SHORTENED · UNAVAILABLE`; `inquiry_event_kind` = `CREATED · WHATSAPP_REDIRECT ·
VIEWED · STATUS_CHANGED · NOTE_ADDED · ASSIGNED · EXPORTED`.

`inquiries` is not content, so it carries `pipeline_status` rather than the D5 `content_status` —
the same documented deviation Phase 05 made for `activity_events`, recorded in `DATA_MODEL.md`.
Storage is minimised deliberately: no raw IP (salted `ip_hash` only, pepper from server env), no
cookies beyond the session, no fingerprinting, no third-party captcha. Spam control is a honeypot
field, a minimum time-to-submit of 3 seconds, and a per-IP rate limit of 5 submissions per hour.

RLS: `anon` has `INSERT` only on `inquiries` and `inquiry_attachments`, with a `WITH CHECK` that
forces `pipeline_status = 'NEW'`, `assigned_to is null` and `updated_by is null`; `anon` has **no**
`SELECT` policy on any of the three tables. Staff `SELECT` needs `inquiries:read`; `UPDATE` needs
`inquiries:write`; export needs `inquiries:export`; `inquiry_events` is insert-via-trigger and
service-role, never updatable.

**Studio surface** — fills all five D4 inquiry routes from one shared component with a `kind`
filter: `/studio/inquiries/{all,product,commission,consultation,quote}` exactly as D4 lists them.
Columns:
reference code, kind, name, city, product or form, pipeline status, WhatsApp state, received,
assignee. Creates `/studio/inquiries/[inquiryId]`: the full answer set rendered against the form
definition that produced it, attachments with previews, the event timeline, a pipeline control, an
internal note field, assignment, and **Open in WhatsApp** which re-renders the same template for
staff use. Every status change writes `inquiry_events` and `activity_events`.

**Public surface** — no new route (D3 has none for enquiries). Surfaces gained:
`/contact` (the Phase 08 `contact-form` block becomes live with the SEED §22 fields and eight
enquiry types), `/product/[slug]` (enquiry dialog and *Request a Quote*),
`/custom-commissions` (the Phase 19 configurator, flag switched on here), and the closing
`final-cta` band on any page. The success and error states are in-page.

**Media** — None consumed from the manifest. Visitor reference uploads created by the Phase 19
endpoint are linked here through `inquiry_attachments` and remain private.

**Risks**

| Risk | Mitigation |
|---|---|
| A redirect happens after a failed write, losing the enquiry silently | `buildHandoffUrl` requires a persisted `inquiryId`; the action returns a discriminated union; `inquiry-persistence.test.ts` forces failure and asserts no URL; the e2e test intercepts the DB error and asserts the browser never navigates to `wa.me` |
| A very long brief produces a URL a browser or WhatsApp truncates | The five-step ladder with a 1,800-character budget; `whatsapp-shorten.test.ts` feeds a 60-field payload and asserts the result fits, still parses, and still contains the reference code |
| Personal data leaks through the WhatsApp message or the export | Only visitor-entered, `include_in_whatsapp` fields are rendered; internal columns are excluded by an allowlist in `render.ts`; the CSV export omits `ip_hash` and `user_agent` and is audited |
| Public read access to enquiries through a policy mistake | `anon` has no `SELECT` policy at all; `tests/unit/rls` (Phase 04 harness) asserts an anon client reading `inquiries` returns zero rows and that insert with a forged `pipeline_status` is rejected |
| Spam floods the inbox | Honeypot + minimum submit time + per-IP rate limit + `SPAM` pipeline status; no third-party captcha is introduced |
| The WhatsApp number is missing or unverified in an environment | Resolution order is `global_content` (`VERIFIED`) → `NEXT_PUBLIC_WHATSAPP_NUMBER`; if neither resolves, `whatsapp_state = 'UNAVAILABLE'`, the enquiry still persists, and the success state shows the saved reference code and the seeded contact details instead of a broken link |
| `Place Order` is read as a checkout | The label resolves to this flow, `BUSINESS_RULES.md` records it, and no order, cart or payment table exists to receive it |

**Verification**

1. `npx supabase db push` — `0180`–`0182` apply from clean; `select group, key from global_content
   where group = 'CONTACT'` returns four rows.
2. `npm run test:unit -- whatsapp-render whatsapp-shorten inquiry-persistence` — token rendering
   (including every token name from SEED §36 and §37), all five shortening levels, and the
   no-URL-on-failure guarantee.
3. As an anonymous client: `select * from inquiries` → zero rows;
   `insert ... (pipeline_status) values ('WON')` → rejected by the `WITH CHECK`.
4. `npx playwright test tests/e2e/inquiry-flow.spec.ts` — three paths asserted end to end:
   (a) contact form → row created, reference code shown, SEED §48 copy rendered,
   *Continue to WhatsApp* href is `https://wa.me/<digits>?text=…` containing the reference code;
   (b) product enquiry from `/product/[slug]` → `kind = 'PRODUCT'` with `product_id` set;
   (c) configurator → `kind = 'COMMISSION'` with the full answer set in `answers` and two
   attachments linked.
5. In the same suite, with the insert forced to fail: the page shows *Your enquiry could not be
   saved. Please try again before continuing to WhatsApp.*, `page.url()` is unchanged, and no
   request to `wa.me` is made.
6. Submit a 60-field brief with 5 references; assert the generated message is ≤ 1,800 characters,
   `whatsapp_state = 'SHORTENED'`, `whatsapp_shortened_at_level` is recorded, and the reference code
   is present.
7. Unset both the `global_content` number and `NEXT_PUBLIC_WHATSAPP_NUMBER`; submit → the enquiry
   persists, `whatsapp_state = 'UNAVAILABLE'`, and the success state shows contact details with no
   dead link.
8. In Studio as `merchandiser`: open `/studio/inquiries/all`, filter to `COMMISSION`, open one, move
   it to `IN_CONVERSATION`, add a note, assign it; assert three `inquiry_events` rows and matching
   `activity_events`. Export as `editor` → 403 with a `DENIED` audit row.
9. `node scripts/site/check-whatsapp-usage.mjs` (Phase 10) — exits 0: no literal `wa.me` or
   `api.whatsapp.com` outside `lib/whatsapp/**`, and `buildDirectContactUrl` is imported only from
   the Phase 10 allowlist.

**Exit criteria**

- [ ] Every enquiry is persisted before any redirect, and a failed persist produces no WhatsApp URL
      and no navigation — proven in unit and e2e tests.
- [ ] Both SEED §36 and §37 templates render with their exact token names and no unresolved
      `{{token}}` ever reaches the message.
- [ ] The shortening ladder keeps every message within budget and always retains the reference code.
- [ ] SEED §48 success copy and all three SEED §49 error copies render from seeded content, not JSX.
- [ ] `anon` can insert an enquiry and cannot read one; forged status or assignment on insert is
      rejected.
- [ ] All five D4 inquiry routes are filled, with pipeline, notes, assignment, attachments and
      events.
- [ ] Export is gated on `inquiries:export`, audited, and omits `ip_hash` and `user_agent`.
- [ ] Contact details live in `global_content` group `CONTACT` and appear in exactly one place in
      code.
- [ ] `commission_configurator` is enabled and `/custom-commissions` completes a full brief-to-
      WhatsApp journey.
- [ ] No checkout, cart, payment, order or customer-account table, route or label exists.
- [ ] `BUSINESS_RULES.md`, `SECURITY.md`, `STUDIO_GUIDE.md` and `DATA_MODEL.md` updated; next
      phase = 21.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 21 — 3D Product Experience

**Goal** — A visitor can pick an object up and turn it over. Where a `GLB` or `GLTF` model exists,
the product, project or collection page offers an inspection experience with orbit, zoom, reset,
fullscreen, material inspection, variant switching, dimension indicators, lighting and environment
presets, and full touch support (FEAT §12) — and it costs the page nothing until the visitor asks
for it. The viewer is dynamically imported, never in the initial route bundle, always preceded by a
poster, and silent under reduced motion, on constrained devices and when the flag is off (FEAT §14).
The manifest contains no models, so this phase ships the capability with zero models and the owner
supplies the first one.

**Depends on** — Phase 06 (`media_assets` 3D metadata, folders, signed upload), Phase 15 (product
detail page and its gallery), Phase 19 (`feature_flags`, `3d_viewer`), Phase 02 (the reserved
`--rv-3d-*` overlay token layer), Phase 16/17 (collection and project surfaces that may host a
model).

**Scope**

- `components/three/`, client-only, dynamically imported: `ModelViewer`, `ViewerCanvas`,
  `ViewerControls`, `VariantSwitcher`, `DimensionOverlay`, `LightingPresetSelect`,
  `EnvironmentPresetSelect`, `LoadingProgress`, `PosterFallback`.
- Loader support for `GLB` and `GLTF`, with `KHR_draco_mesh_compression` and
  `EXT_meshopt_compression` decoders **self-hosted** under `public/draco/` and `public/basis/` — no
  CDN dependency and no runtime fetch outside the origin.
- The FEAT §12 control set, each with a pointer, touch and keyboard route:

  | Control | Pointer / touch | Keyboard |
  |---|---|---|
  | Orbit | drag / one-finger drag | arrow keys (5° per press) |
  | Zoom | wheel / pinch | `+` and `-` |
  | Pan | right-drag / two-finger drag | `Shift` + arrows |
  | Reset camera | button | `R` |
  | Fullscreen | button | `F`; `Esc` exits |
  | Material inspection | toggle | `M` |
  | Variant switching | tab list | arrows within the tab list |
  | Dimension indicators | toggle | `D` |
  | Lighting preset | select | native select keyboard model |
  | Environment preset | select | native select keyboard model |

- Presets as code (`components/three/presets.ts`): four lighting presets (`studio-soft`,
  `gallery-directional`, `daylight-window`, `low-key`) and three environment presets
  (`neutral-room`, `dark-gallery`, `warm-interior`), all built from the Phase 02 palette. Per-model
  defaults are stored in `media_assets.viewer_settings jsonb`.
- Variant switching reads `KHR_materials_variants` from the model when present; Studio may attach a
  human label and an optional `materials` reference per variant key. Labels only — no invented
  material specification — and a variant that names a material is owner-verified before that name
  reaches the public viewer.
- Dimension indicators render **only** `products.dimensions` values entered by the owner. A model's
  bounding box is never presented as a product dimension (D10).
- Studio model management: `/studio/media/models` gains a GLB inspector that parses the file
  server-side to populate `poly_count`, `texture_count` and `file_size_bytes`, a poster capture
  action, viewer-settings editing, and product/project association.
- The FEAT §14 performance contract, enforced by test, in the budgets below.

**Out of scope**

- Generating, sourcing, commissioning or approximating any 3D model. The manifest has none, and a
  model of a product that does not exist would be an invented product fact.
- AR, room visualisation, scene composition, virtual showrooms (FEAT §39 — architect for, do not
  build).
- A configurator that renders the visitor's choices in 3D. Phase 19's configurator stays 2D.
- Physically-based material accuracy claims, renderings presented as photographs of delivered work,
  or a "true colour" promise.
- Model editing, retopology or compression inside Studio. Preparation happens before upload; the
  inspector reports and rejects, it does not fix.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0190_phase21_model_metadata.sql` | `viewer_settings jsonb`, `model_variant_labels`, upload ceilings as check constraints |
| Viewer entry | `components/three/ModelViewer.tsx` | `'use client'`; the only module importing `@react-three/fiber` |
| Dynamic wrapper | `components/patterns/ModelViewerMount.tsx` | `next/dynamic` with `ssr: false`; renders `PosterFallback` until intent |
| Canvas + controls | `components/three/{ViewerCanvas,ViewerControls,VariantSwitcher,DimensionOverlay,LoadingProgress,PosterFallback}.tsx` | one concern each |
| Presets | `components/three/presets.ts` | four lighting, three environment, all token-derived |
| Loader policy | `lib/media/model.ts` | decoder paths, format detection, `viewer_settings` parsing, capability probe |
| GLB inspector | `scripts/media/inspect-model.ts` + `app/api/studio/models/inspect/route.ts` | server-side parse via `@gltf-transform/core`; returns counts and warnings |
| Decoders | `public/draco/**`, `public/basis/**` | vendored, version pinned, licence recorded in `COMPONENT_REGISTRY.md` |
| Studio inspector | `components/studio/ModelInspectorDrawer.tsx` | metadata, warnings, poster capture, variants, viewer settings, associations |
| Docs | `docs/media/MEDIA_GUIDE.md`, `docs/ops/PERFORMANCE.md`, `docs/design/COMPONENT_REGISTRY.md`, `docs/architecture/DATA_MODEL.md` | model rules, budgets, viewer registry rows |
| Tests | `tests/unit/model-policy.test.ts`, `tests/e2e/model-viewer.spec.ts`, `tests/e2e/model-performance.spec.ts` | ceilings and fallbacks, control model, budget assertions |

**Performance and asset budgets (FEAT §14, FEAT §46)**

| Budget | Value | Enforcement |
|---|---|---|
| Viewer JavaScript in the initial route bundle | 0 bytes | `model-performance.spec.ts` asserts no `three`/`@react-three` chunk in the first document's script set |
| Load trigger | explicit click on *Inspect in 3D*, or intersection when all of: viewport ≥ 768 px, `prefers-reduced-motion: no-preference`, `navigator.connection.saveData !== true`, `deviceMemory >= 4` | `lib/media/model.ts` capability probe |
| LCP element | the poster image, never the canvas | Playwright LCP entry assertion at 1920 and 390 |
| Model file size | reject > 15 MB; warn > 8 MB | check constraint + inspector warning |
| Compression | required above 5 MB (`KHR_draco_mesh_compression` or `EXT_meshopt_compression`) | inspector rejects on upload |
| Triangles | reject > 250,000; warn > 150,000 | inspector |
| Textures | reject any texture > 2048 px; warn > 4 textures | inspector |
| Poster | mandatory before a model may be **associated** with a public entity; a model may be uploaded and inspected without one | check constraint `kind <> 'MODEL_3D' or (associated_product_id is null and associated_project_id is null) or model_poster_id is not null` |
| Reduced motion | no auto-rotate, no intro animation, no idle motion; poster plus an explicit control | `useReducedMotion` from Phase 02; e2e assertion under `prefers-reduced-motion: reduce` |
| Mobile fallback | below 768 px the viewer is opt-in only, fullscreen by default once opened | e2e at 390 px |
| Flag off | nothing 3D is requested, rendered or downloaded | e2e with `3d_viewer` disabled |

**Database** — one altered table and one new one. `media_assets` gains
`viewer_settings jsonb not null default '{}'` (Zod-validated: `camera`, `exposure`,
`lightingPreset`, `environmentPreset`, `autoRotate`, `minDistance`, `maxDistance`) and the check
constraints for size, triangles and poster above. New table `model_variant_labels`:
`id`, `media_asset_id fk on delete cascade`, `variant_key text`, `label text`,
`material_id uuid null references materials(id)`, `position int`,
`fact_classification not null default 'EDITORIAL_COPY'`,
`owner_verification owner_verification not null default 'NOT_REQUIRED'`, `created_at`,
`updated_at`, `updated_by`; `unique (media_asset_id, variant_key)`.

A bare label is editorial copy and needs no verification. A label that also carries a `material_id`
asserts that a named material is present in a real object, which is a product fact (D10), so:
`check (material_id is null or owner_verification <> 'NOT_REQUIRED')` — attaching a material forces
the row to at least `OWNER_VERIFICATION_REQUIRED` — and the public read path in
`lib/media/model.ts` returns `material_id` **only** where `owner_verification = 'VERIFIED'`. An
unverified association still renders its label in `VariantSwitcher`; it simply carries no material
name. Attaching a `material_id` links to an existing `materials` row and never invents a
specification, and only `owner`/`admin` may set `owner_verification = 'VERIFIED'`. RLS otherwise
mirrors `media_assets`: public read only where the owning asset is `PUBLISHED`; writes need
`media:write`.

**Studio surface** — fills the 3D half of `/studio/media/models`: upload with the inspector
(rejections and warnings shown before save), the FEAT §13 metadata block populated from the parse
rather than typed, poster capture or upload, `viewer_settings` editing with a live preview, variant
label editing, and association to a product or a project. `/studio/system/flags` gains the
`3d_viewer` toggle (created in Phase 19).

**Public surface** — no new route. The viewer mounts on `/product/[slug]` (Phase 15) as a gallery
tab when the product has a `model_media_id`, on `/collections/[slug]` through the `three-d-resin`
block's model slot (Phase 16), on `/portfolio/[slug]` when a project has an associated model
(Phase 17), and on `/collection/3d-resin` for any published product in that category that has one.
Every mount point renders the poster and nothing else when no model exists, when the flag is off, or
when the capability probe declines.

**Media** — `three-d-resin` (13 images: ten 16:9, two 3:4, one 4:5) supplies posters and narrative
imagery for the 3D + resin surfaces, and `material-macro` (39) supplies material-inspection
context. Both are still images; neither is a model and neither may be captioned as a render of a
delivered piece. **Zero `MODEL_3D` rows exist in the manifest**, so this phase ships with zero
models and creates the first upload path for them. Nothing is generated.

**Risks**

| Risk | Mitigation |
|---|---|
| Three.js lands in the initial bundle and destroys LCP | `next/dynamic` with `ssr: false` behind an intent gate; `model-performance.spec.ts` fails the build if a `three` chunk appears in the first document |
| A heavy model ships because nobody checked it | Server-side inspection with hard rejects at 15 MB / 250k triangles / 2048 px textures, and mandatory compression above 5 MB |
| Bounding-box dimensions are shown as product dimensions | `DimensionOverlay` accepts only `products.dimensions`; it renders nothing when that column is null; a unit test asserts the component never reads model geometry for labels |
| A model renders as photography of a finished piece | Viewer chrome carries the concept notice when the model's `is_concept = true`; posters follow the same alt-text rules as every other asset |
| Motion causes discomfort or fails accessibility review | Reduced-motion disables auto-rotate and intro animation entirely, every control has a keyboard route, the canvas has an accessible name and a described-by summary, and focus is trapped in fullscreen |
| Decoder loaded from a CDN breaks offline or under CSP | Decoders are vendored under `public/`; a unit test asserts no external origin appears in `lib/media/model.ts` |
| The viewer ships with nothing to view and looks broken | Every mount point falls back to the poster or the existing gallery; the tab is absent when no model exists |

**Verification**

1. `npx supabase db push && npm run test:unit -- model-policy` — ceilings, compression requirement,
   poster requirement and the dimension-source rule all pass.
2. `npm run build && node -e "…"` (or the Playwright equivalent) — no `three` or `@react-three`
   chunk appears in the initial script set for `/product/[slug]`.
3. Upload a 20 MB uncompressed GLB in `/studio/media/models` → rejected with the size and
   compression reasons named. Upload a 6 MB Draco-compressed model with 120k triangles → accepted,
   with `poly_count`, `texture_count` and `file_size_bytes` populated from the parse, not typed.
   No poster exists yet and the row is accepted anyway: the poster constraint gates *association*,
   not existence.
4. Attempt to associate that model with a product before capturing a poster → rejected by the
   poster check constraint. Capture a poster, retry → accepted.
5. `npx playwright test tests/e2e/model-viewer.spec.ts` — with `3d_viewer` on and a model attached:
   the poster renders first, *Inspect in 3D* loads the viewer with a visible progress indicator, and
   every FEAT §12 control works by mouse, by touch emulation and by the keyboard route in the table
   above. Reset returns the camera to the stored `viewer_settings.camera`.
6. Same suite under `prefers-reduced-motion: reduce` — no auto-rotate, no intro animation, poster
   plus explicit control only.
7. Same suite at 390 px — the viewer does not auto-load; opening it goes fullscreen; pinch-zoom and
   one-finger orbit work.
8. Turn `3d_viewer` off — no 3D chunk is requested on any page, and every mount point renders its
   poster or gallery with no empty slot.
9. Set `products.dimensions` to null → the dimension toggle is absent; set real owner-entered
   values → the overlay renders exactly those values and no others.
10. Run axe on the product page with the viewer open at 1280 px — zero critical or serious
    violations; the canvas has an accessible name and a text alternative describing the object.
11. Add a variant label with a `material_id` while leaving `owner_verification = 'NOT_REQUIRED'` →
    rejected by the check constraint. Set `OWNER_VERIFICATION_REQUIRED` and save → accepted, and the
    public viewer shows the label with no material name. Verify as `owner` → the material name
    appears; the same mutation as `merchandiser` returns 403 with a `DENIED` audit row.

**Exit criteria**

- [ ] `GLB` and `GLTF` both load, with Draco and meshopt decoders served from the origin.
- [ ] Every FEAT §12 control exists and is operable by pointer, touch and keyboard.
- [ ] The viewer contributes zero bytes to the initial route bundle, proven by a build assertion.
- [ ] The LCP element on a product page with a model is the poster image at 1920 and at 390.
- [ ] All upload ceilings are enforced server-side, and metadata is parsed, never typed.
- [ ] A model cannot be associated with a public entity without a poster; a model with no
      association may exist without one.
- [ ] A variant label carrying a `material_id` is at least `OWNER_VERIFICATION_REQUIRED` by check
      constraint, and its material name reaches the public viewer only at `VERIFIED`.
- [ ] Dimension indicators render owner-entered `products.dimensions` only, and nothing when null.
- [ ] Reduced-motion, small-viewport, save-data and flag-off paths all fall back to the poster with
      no console error and no downloaded 3D payload.
- [ ] `viewer_settings` and variant labels are editable in Studio with a live preview.
- [ ] `PERFORMANCE.md`, `MEDIA_GUIDE.md`, `COMPONENT_REGISTRY.md` and `DATA_MODEL.md` updated;
      next phase = 22.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 22 — Homepage / Store Merchandising

**Goal** — The owner takes the controls. Which products appear in Selected Works, in what order,
which collections are featured, how the store's seven categories are ordered, which pieces are
pinned inside a category, and when each of those arrangements starts and stops — all of it becomes a
Studio decision with a schedule, and none of it is hardcoded (SEED §10-04). Because the catalogue
ships with zero published products (SEED §32), the more important half of this phase is what happens
when a curated slot is empty: an editorial fallback that is honest about being editorial, never a
fabricated product card.

**Depends on** — Phase 14 (products and cards), Phase 16 (collections), Phase 15 (product detail),
Phase 08/09 (blocks, `selected-works` block, seeded homepage copy), Phase 05 (Studio primitives),
Phase 19 (flags, optional).

**Scope**

- `merchandising_slots` and `merchandising_entries`: a slot is a named, typed, scheduled, ordered
  list of entity references; an entry is one reference with its own window.
- **Eleven seeded slots, all empty**: four global slots plus one per-category pinning slot for each
  of the seven D3 categories. `merchandising_slots.key` is `citext unique`, so the per-category
  slots need a deterministic key — `CATEGORY_PINNED_<CATEGORY_SLUG>` with the D3 slug uppercased and
  `-` replaced by `_`. Every slot has exactly one owning Studio screen; no slot is edited from two
  places, and there is no "reusable" slot without a surface.

  | Slot key | `surface` (D3 path) | Entity types | Min items | Fallback | Owning Studio screen |
  |---|---|---|---|---|---|
  | `HOMEPAGE_SELECTED_WORKS` | `/` §10-04 | `PRODUCT` | 3 | `EDITORIAL_BLOCK` | `/studio/merchandising/homepage` |
  | `HOMEPAGE_FEATURED_COLLECTIONS` | `/` §10-03 | `COLLECTION`, `CATEGORY` | 3 | `HIDE_SECTION` | `/studio/merchandising/featured` |
  | `HOMEPAGE_JOURNAL_STRIP` | `/` §10-12 | `JOURNAL_ARTICLE` | 3 | `HIDE_SECTION` | `/studio/merchandising/homepage` |
  | `STORE_FEATURED_ROW` | `/collection` | `PRODUCT`, `COLLECTION` | 3 | `HIDE_SECTION` | `/studio/merchandising/featured` |
  | `CATEGORY_PINNED_FURNITURE` | `/collection/furniture` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |
  | `CATEGORY_PINNED_COLLECTIBLE_DESIGN` | `/collection/collectible-design` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |
  | `CATEGORY_PINNED_3D_RESIN` | `/collection/3d-resin` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |
  | `CATEGORY_PINNED_WALL_STATEMENT_ART` | `/collection/wall-statement-art` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |
  | `CATEGORY_PINNED_PRESERVATION` | `/collection/preservation` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |
  | `CATEGORY_PINNED_DECOR` | `/collection/decor` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |
  | `CATEGORY_PINNED_GIFTS` | `/collection/gifts` | `PRODUCT` | 1 | `SHOW_EMPTY_STATE` | `/studio/merchandising/store` |

  Featured collections are one slot, not two: `HOMEPAGE_FEATURED_COLLECTIONS` is the only slot
  `components/sections/FeaturedCollections.tsx` reads, and `/studio/merchandising/featured` is the
  only screen that writes it. A category added after this phase gets its `CATEGORY_PINNED_*` slot
  created by the same server action that creates the category, so `surface` is never null and the
  key scheme stays mechanical.

  A `CATEGORY_PINNED_*` slot governs the pinned region of its category page and nothing else: an
  empty slot leaves the category's own product listing untouched, and its `SHOW_EMPTY_STATE`
  fallback is reached only when the category has no published products at all — which is the state
  the site ships in (SEED §32).

- Store ordering: `/studio/merchandising/store` edits `categories.sort_order` (Phase 03) with drag
  ordering, defaulting to the SEED §13 order — Furniture, Collectible Design, 3D + Resin, Wall &
  Statement Art, Preservation, Décor, Gifts — which is also the SEED §56 content priority. A guard
  warns, with the SEED §56 rationale, when Gifts or Décor is moved above Furniture.
- Featured collections: `/studio/merchandising/featured` owns `HOMEPAGE_FEATURED_COLLECTIONS` and
  `STORE_FEATURED_ROW`, and curates published collections only; a collection in
  `DRAFT_COLLECTION_CONCEPT` cannot be featured (Phase 16 gate, re-checked here).
- Scheduling: `/studio/merchandising/scheduling` is a single calendar view of every slot and entry
  window. Windows are honoured by the Phase 08 cron
  (`app/api/cron/content-schedule/route.ts`), which gains a merchandising pass and revalidates the
  affected paths.
- The resolution rule, stated once and implemented once in `lib/cms/merchandising.ts`, wired in
  behind the Phase 11 selector seam: `lib/cms/selectors/products.ts` keeps its interface and gains
  a merchandising-backed implementation, so `selected-works` and every other reference block picks
  up real curation without a single change to a renderer.
- `/studio/merchandising/homepage` also owns the homepage hero media override and the Selected Works
  heading, so the owner does not have to move between two screens to change what the homepage says
  and shows.

**Out of scope**

- Creating, importing or publishing any product. Slots reference products; they do not make them.
- "Popular", "trending", "best selling" or any ordering derived from behaviour. No analytics data
  exists, and manufacturing one would be an invented business fact (FEAT §28: do not manufacture
  unavailable analytics).
- Personalised or per-visitor merchandising, A/B tests, geo variants.
- Discounting, badging as "sale", stock counts or availability claims. `Ready Stock` remains the
  Phase 09 `OWNER_VERIFICATION_REQUIRED` label and is not driven from here.
- Bulk product operations — Phase 24.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0200_phase22_merchandising.sql` | two tables, enums, eleven seeded slots (four global + seven `CATEGORY_PINNED_*`), indexes |
| RLS | `supabase/migrations/0201_phase22_merchandising_rls.sql` | public read of open windows; writes need `merchandising:write` |
| Resolver | `lib/cms/merchandising.ts` | `resolveSlot(key, ctx)` — the single read path; returns entries, fallback mode and provenance |
| Selector swap | `lib/cms/selectors/products.ts` (Phase 11) | its Phase 11 implementation is replaced by one backed by `resolveSlot`; the interface and every consuming block are untouched (Phase 11: "Phase 22 swaps products") |
| Repository | `lib/supabase/repositories/merchandising.ts` | slot and entry CRUD, reorder, window edits |
| Block update | `content/blocks/selected-works.ts` | gains `slotKey` and `fallbackSectionId`; renderer consumes `resolveSlot` |
| Renderer | `components/sections/SelectedWorks.tsx` | curated grid, or the editorial fallback; never a placeholder card |
| Renderer | `components/sections/FeaturedCollections.tsx` | published collections only |
| Editorial fallback | `components/patterns/EditorialFallback.tsx` (Phase 11, extended) | now accepts a `fallbackSectionId`; still media + copy tiles with no price, no *View Product*, no product link |
| Studio homepage | `app/(studio)/studio/merchandising/homepage/page.tsx` + `actions.ts` | `HOMEPAGE_SELECTED_WORKS`, `HOMEPAGE_JOURNAL_STRIP`, hero override; links out to the featured screen |
| Studio store | `app/(studio)/studio/merchandising/store/page.tsx` + `actions.ts` | category order, the seven `CATEGORY_PINNED_*` slots, default sort |
| Studio featured | `app/(studio)/studio/merchandising/featured/page.tsx` + `actions.ts` | `HOMEPAGE_FEATURED_COLLECTIONS` and `STORE_FEATURED_ROW`, published collections only |
| Studio scheduling | `app/(studio)/studio/merchandising/scheduling/page.tsx` | calendar of every window, conflict warnings |
| Cron update | `app/api/cron/content-schedule/route.ts` | adds the merchandising pass and path revalidation |
| Docs | `docs/studio/STUDIO_GUIDE.md`, `docs/content/CONTENT_GUIDE.md`, `docs/architecture/DATA_MODEL.md` | slots, fallback rules, scheduling |
| Tests | `tests/unit/merchandising-resolve.test.ts`, `tests/e2e/merchandising.spec.ts` | resolution ladder, scheduling, fallback, curation walk |

**The resolution ladder** (`lib/cms/merchandising.ts`, applied in order)

| # | Step |
|---|---|
| 1 | Load entries for the slot where the entry `status = 'PUBLISHED'` and `now()` is inside `[publish_at, unpublish_at)` |
| 2 | Drop entries whose referenced entity is missing, archived, or not `status = 'PUBLISHED'` |
| 3 | If the surviving count ≥ `min_items` → render the curated list in `position` order. Provenance: `CURATED` |
| 4 | Else if `auto_fill = true` → top up from published entities of the slot's type within its scope, ordered by `published_at desc`, excluding entries already present. Provenance: `RULE_FILLED`, and the rule is named in the response |
| 5 | Else apply `fallback_mode`: `EDITORIAL_BLOCK` renders the section identified by `fallbackSectionId`; `HIDE_SECTION` renders nothing at all; `SHOW_EMPTY_STATE` renders the seeded SEED §27 collection empty state |

There is no sixth step. A placeholder product card is never rendered, and no ordering is ever
random, behavioural or inferred.

**The editorial fallback, precisely.** With zero published products, `HOMEPAGE_SELECTED_WORKS`
always reaches step 5 and renders the section named by `fallbackSectionId` — by default the seeded
homepage `material-story` section (SEED §10-05). `EditorialFallback` tiles carry a heading, a short
line of editorial copy and a media asset, and are structurally incapable of looking like inventory:
no price element, no `Price on Request` label, no product link, no *View Product* CTA, no SKU, no
dimensions. Their only CTA targets `/large-format`, `/collection` or `/custom-commissions`. Because
every candidate asset is `is_concept = true`, no tile caption may describe the image as a delivered
piece (manifest `policy.rules[0]`).

**Database**

| Table | Key columns |
|---|---|
| `merchandising_slots` | `id`, `key citext unique`, `name`, `description`, `surface text not null` (the D3 path the slot appears on — every slot has exactly one; there are no surface-less "reusable" slots), `owning_studio_route text not null` (the single D4 screen permitted to write the slot), `allowed_entity_types relation_entity[]`, `min_items int not null default 3`, `max_items int not null default 12`, `auto_fill bool not null default false`, `auto_fill_rule text`, `fallback_mode merch_fallback not null`, `fallback_section_id uuid null references page_sections(id)`, `status content_status`, `seed_key`, audit columns |
| `merchandising_entries` | `id`, `slot_id fk on delete cascade`, `entity_type relation_entity`, `entity_id uuid`, `position int not null`, `is_pinned bool default false`, `publish_at`, `unpublish_at`, `status content_status`, `note text`, audit columns; `unique (slot_id, entity_type, entity_id)`; `check (unpublish_at is null or publish_at is null or unpublish_at > publish_at)` |

New enum: `merch_fallback` = `EDITORIAL_BLOCK · HIDE_SECTION · SHOW_EMPTY_STATE`. Indexes:
`merchandising_entries (slot_id, position)`, `(publish_at)`, `(unpublish_at)`. `categories.sort_order`
is reused for store ordering — no second ordering column is created. RLS: `anon` may `SELECT` both
tables for published slots and in-window entries (the resolver still re-filters targets); writes
need `merchandising:write` (Phase 04 matrix: owner, admin, merchandiser).

**Studio surface** — fills all four D4 merchandising routes, with the slot ownership fixed by the
table above so no slot is editable from two screens.
`/studio/merchandising/homepage`: two slot editors (`HOMEPAGE_SELECTED_WORKS`,
`HOMEPAGE_JOURNAL_STRIP`) with entity search, drag ordering, per-entry windows, a fallback-mode
selector with a live preview of what the public currently sees, plus the homepage hero media
override; the featured-collections region shows a read-only preview and a link to the featured
screen rather than a second editor.
`/studio/merchandising/store`: drag ordering of the seven categories with the SEED §56 priority
warning, plus the seven `CATEGORY_PINNED_*` slots, each edited beside the category it belongs to.
`/studio/merchandising/featured`: `HOMEPAGE_FEATURED_COLLECTIONS` and `STORE_FEATURED_ROW`,
published collections only, with an inline explanation when a concept collection is not selectable.
`/studio/merchandising/scheduling`: a month calendar of every slot and entry window, with overlap
and gap warnings and a jump-to-editor action. Every mutation writes `activity_events` and is
audited.

**Public surface** — no new route. Behaviour changes on `/` (Selected Works, featured collections,
journal strip), `/collection` (category order and featured row) and `/collection/[category]`
(pinned products first, then the category's default sort). All three already exist from Phases
10–14.

**Media** — the editorial fallback consumes assets already migrated and already bound:
`interior-lifestyle` (5, page `home`), `material-macro` (39, page `about`) and the `largeformat-*`
families (18 across `largeformat-dining` 5, `largeformat-console` 4, `largeformat-seating` 4,
`largeformat-side` 3, `largeformat-coffee` 1, `largeformat-monumental` 1). The homepage hero video
and poster remain the Phase 07 recorded gap (`HOME-HERO-VIDEO-001`, `HOME-HERO-POSTER-001`); this
phase does not substitute another family for them and does not generate anything — the hero renders
its bound still until the owner supplies the film.

**Risks**

| Risk | Mitigation |
|---|---|
| An empty Selected Works grid gets filled with concept images styled as products | `EditorialFallback` has no price, link-to-product or CTA affordance; `merchandising-resolve.test.ts` asserts the fallback output contains no product route and no price label |
| Someone hardcodes three product slugs "temporarily" | The renderer takes its list only from `resolveSlot`; a lint rule bans product slug literals in `components/sections/**`; SEED §10-04 is quoted in `CONTENT_GUIDE.md` |
| An unpublished or archived product appears through a stale slot entry | Step 2 of the ladder re-checks the target's status on every read; an e2e test unpublishes a curated product and asserts it vanishes without leaving a gap |
| A schedule fires but the page stays stale | The cron pass revalidates every affected D3 path and writes an `activity_events` row; the e2e test asserts the public page changes after the window opens |
| Merchandising drifts the site back to gift-shop positioning | The store editor warns with the SEED §56 rationale when Gifts or Décor is ordered above Furniture, and the default order is restorable in one click |
| `auto_fill` becomes an implicit recommendation engine | `auto_fill` defaults to `false`; when enabled, `auto_fill_rule` is a required, human-readable string, the response carries `RULE_FILLED` provenance, and only recency ordering is implemented |
| A concept collection is featured on the homepage | Featured curation queries published collections only, and the Phase 16 gate means a concept cannot be published |

**Verification**

1. `npx supabase db push` — `0200`/`0201` apply; `select key, surface, min_items, fallback_mode
   from merchandising_slots order by key` returns the eleven seeded slots — four global plus one
   `CATEGORY_PINNED_<CATEGORY_SLUG>` for each of the seven D3 categories, each with a non-null
   `surface` — all with zero entries; `select count(*) from merchandising_slots where key like
   'CATEGORY\_PINNED\_%'` → `7`.
2. `npm run test:unit -- merchandising-resolve` — all five ladder steps, including: fewer than
   `min_items` with `auto_fill = false` falls back; an entry whose target is unpublished is dropped;
   an out-of-window entry is dropped; `HIDE_SECTION` renders nothing rather than an empty heading.
3. With zero published products: `curl -s $NEXT_PUBLIC_SITE_URL/ | grep -c '/product/'` → `0`, and
   the Selected Works region renders the editorial fallback with no price string.
4. Publish three products (owner entry, not seed), curate them into `HOMEPAGE_SELECTED_WORKS`,
   reorder them, reload `/` → they render in the curated order.
5. Unpublish the middle product → two render, in order, with no gap and no placeholder.
6. Set an entry's `publish_at` two minutes ahead; call the content-schedule cron with the correct
   secret after the window opens → the entry appears on `/` and an `activity_events` row exists.
   Call the cron without the secret → 401.
7. Reorder categories in `/studio/merchandising/store` so Gifts is first → a warning citing SEED §56
   appears before saving; save anyway, reload `/collection`, confirm the new order, then use
   **Restore recommended order** and confirm the SEED §13 order returns.
8. Attempt to feature a `DRAFT_COLLECTION_CONCEPT` collection → not selectable, and a direct
   server-action POST is rejected and audited.
9. As `editor`, open `/studio/merchandising/homepage` → read-only; a direct mutation POST returns
   403 with a `DENIED` audit row. As `merchandiser` → succeeds.
10. `npx playwright test tests/e2e/merchandising.spec.ts` — the full curation, scheduling and
    fallback walk at 1920 and 390.

**Exit criteria**

- [ ] Eleven slots exist, seeded empty, with the stated keys, surfaces, types, minimums and fallback
      modes: four global slots plus one `CATEGORY_PINNED_<CATEGORY_SLUG>` per D3 category.
- [ ] Every slot has exactly one owning Studio screen, and `HOMEPAGE_FEATURED_COLLECTIONS` is the
      only featured-collections slot in the schema.
- [ ] No product appears on the homepage or store through anything but a merchandising slot; no
      product slug is written in code.
- [ ] The resolution ladder is implemented exactly once and returns provenance
      (`CURATED` | `RULE_FILLED` | `FALLBACK`).
- [ ] The Phase 11 product selector is swapped to the merchandising-backed implementation with no
      change to `lib/cms/selectors/*` interfaces or to any `components/sections/**` renderer.
- [ ] With zero published products, `/` renders the editorial fallback and contains no product
      link, price label or placeholder card.
- [ ] Store category order is editable, defaults to SEED §13, warns on SEED §56 inversion, and is
      restorable.
- [ ] Featured collections accept published collections only; concepts are unselectable.
- [ ] Every slot and entry supports `publish_at` / `unpublish_at`, honoured by the cron with path
      revalidation.
- [ ] All four D4 merchandising routes are filled and permission-gated to owner, admin and
      merchandiser.
- [ ] No behavioural, popularity or inferred ordering exists anywhere in the resolver.
- [ ] `STUDIO_GUIDE.md`, `CONTENT_GUIDE.md` and `DATA_MODEL.md` updated; next phase = 23
      (Global Search + Product Relations).
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## Cross-phase notes

**What must be true before Phase 23 begins.** Global Search and the relations engine assume:
`entity_relations` and `product_relations` both exist and are populated only by human action (16);
projects and articles are searchable entities with real statuses (17, 18); customization forms are
queryable by product and category (19); enquiries exist as a Studio entity type for the Studio-side
palette (20); and merchandising slots exist so that search results and curated surfaces cannot
disagree about what is published (22). Phase 23 must not expose research (`research_*`) data in
public search (FEAT §19).

**Statements requiring owner sign-off before publication.** Each of the following ships blocked by
an owner-only gate enforced in the database. Most use the D5 `owner_verification` flag and cannot be
published until the owner sets `VERIFIED`; the collection concepts use a different gate, named in
the table, because a concept's problem is not an unverified claim but an unconfirmed body of work.
Only `owner` and `admin` may clear any gate below.

| Artefact | Phase | Gate | Why |
|---|---|---|---|
| The ten collection concepts (FEAT §9) | 16 | `concept_state = 'OWNER_CONFIRMED'`, enforced by `enforce_collection_publish_gate()`; seeded `DRAFT_COLLECTION_CONCEPT` / `DRAFT` | Named collections assert that a body of work exists |
| Any collection statement written later | 16 | `owner_verification = 'VERIFIED'` on `collections` | Describes what the collection is and implies delivered pieces |
| Every portfolio project, and every field on it | 17 | `owner_verification = 'VERIFIED'`, via `enforce_project_evidence_gate()` | A delivered project is a business fact by definition |
| Every testimonial and every named person | 17 | `owner_verification = 'VERIFIED'` plus `consent = 'GRANTED'`, via `enforce_testimonial_evidence_gate()` | Attribution requires consent, not just accuracy |
| Journal articles 02, 04 and 08 | 18 | `owner_verification = 'VERIFIED'` on `journal_articles` | Dimension standards, fabrication capability, preservation performance |
| Any human byline replacing the organisation | 18 | `owner_verification = 'VERIFIED'` on `journal_articles` | Names a real person |
| The `three-d-resin-commission` template (SEED §35) | 19 | `owner_verification = 'VERIFIED'` on `customization_forms` | Manufacturing options are not yet defined |
| Contact phone, WhatsApp number, email and map link | 20 | `owner_verification = 'VERIFIED'` on the `global_content` `CONTACT` rows; an unverified value never overrides `NEXT_PUBLIC_WHATSAPP_NUMBER` | Real business contact details |
| `Ready Stock` and any availability label | 20/22 | `owner_verification = 'VERIFIED'` on its `global_content` `COMMERCE_LABEL` row | Asserts stock the system does not track |
| A model variant label that names a material | 21 | `check (material_id is null or owner_verification <> 'NOT_REQUIRED')` on `model_variant_labels`; the material name reaches the public read path only at `VERIFIED` | Names a material as present in a real object |

**Open questions for the canonical decisions.** Raised, not acted on. Items 1–7 are readings of
the canonical decisions that this document adopts without contradicting them. **Item 8 is a
genuine proposed divergence** — a public URL D3 does not list — and the work it covers is held
until the amendment is accepted or declined; nothing else in this document adds a route, table
prefix, role or stack choice the canonical decisions do not already allow.

1. **Migration block allocation.** `PHASE-10-15.md` allocates `0080–0139` to Phases 10–15, one
   decade each, so this document continues at `0140`. The convention now spans three phase
   documents and no canonical section states it. Suggested amendment: record the rule — one decade
   per phase, forward-only, `<nnnn>_phase<nn>_<subject>.sql` — once, in D5 or `DATA_MODEL.md`.
2. **Two relation tables.** Phase 03 created `product_relations`; Phase 16 adds `entity_relations`
   for non-product sources. This is deliberate — renaming a table Phase 23 will build an engine on
   is worse than a documented pair — but a single polymorphic edge table would be cleaner. Suggested
   amendment: let Phase 23 propose the merge with a migration, or bless the pair in D5.
3. **Seed modules that write into later phases' tables.** `PHASE-05-09.md` lists nine journal
   categories, ten journal drafts and three customization templates as Phase 09 output, while also
   placing the journal and form tables in Phases 18 and 19. This document resolves the ordering with
   the `deferred` seed outcome, keeping the copy in one module and applying it when its table
   arrives. Confirm this, or move those records into Phase 18/19 seed modules and amend Phase 09's
   exit criteria.
4. **D2 `lib/` domain list.** D2 fixes `lib/` to ten domains, none of which is inquiries,
   commissions or merchandising. Following Phase 05's precedent, this document maps onto existing
   domains: persistence into `lib/supabase/repositories/`, form and merchandising resolution into
   `lib/cms/`, message rendering into `lib/whatsapp/`, flags into `lib/flags/`. Confirm this reading
   of D2, or add the domains explicitly.
5. **`pages.kind` growth.** Phases 16–18 extend `pages.kind` to `COLLECTION`, `PROJECT` and
   `ARTICLE` so that collections, projects and articles reuse one block engine. This is an
   extension of the D5 model, not a contradiction of it, but it makes `pages` the spine of far more
   than "pages". Confirm, or split entity documents into their own `entity_sections` table.
6. **Feature flags arriving in Phase 19.** FEAT §32 lists flags under System, and D4 places them at
   `/studio/system/flags`, but the first consumer is the Phase 19 configurator and the second is the
   Phase 21 viewer — both before Phase 38. Phase 19 therefore ships the minimal primitive and an
   owner-only toggle. Confirm that Phase 38 extends rather than replaces it.
7. **`site_settings` versus `global_content`.** Phase 20 puts contact details in `global_content`
   group `CONTACT` rather than creating a `site_settings` table, so SEED §21's "do not hardcode
   these values" holds with no new table. If Phase 38 introduces `site_settings`, it should read
   through the same keys rather than duplicating them.
8. **A journal feed at `/journal/rss.xml` (proposed D3 amendment).** Phase 18 wants a syndication
   feed, and D3's public route map does not contain one. `sitemap.xml` and `robots.txt` are outside
   the map because they are Next.js root-level file conventions established in `PHASE-10-15.md`;
   `/journal/rss.xml` is not — it is a route handler under `app/(site)/journal/`, so shipping it
   would extend the fixed map by one public URL. Suggested amendment: add `/journal/rss.xml` to D3
   as a non-page endpoint, with the rule that feed items are published articles only and every URL
   in the feed is absolute and derived from `NEXT_PUBLIC_SITE_URL`. Until this is accepted the
   deliverable, verification step 8 and the matching exit criterion in Phase 18 are held, and the
   route is not created. Declining it costs nothing else in the phase: no other deliverable depends
   on the feed.
