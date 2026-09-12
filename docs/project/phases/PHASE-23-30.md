---
doc: PHASE-23-30
status: CURRENT
owning_phase: 01
last_reviewed: 2026-09-12
owner_verification: NOT_REQUIRED
---

# PHASES 23–30 — Search, Relationships, Bulk Management and the Research Pipeline

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the canonical
> decisions differ, the canonical decisions win and this document is wrong.
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (cited as *FEAT §n*)
> and `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (cited as *SEED §n*).
> Predecessor documents: `docs/project/phases/PHASE-00-04.md`, `PHASE-05-09.md`, `PHASE-10-15.md`,
> `PHASE-16-22.md`.

Phases 00–22 produced a public website, a catalogue, a CMS, a media library, an inquiry flow and a
merchandising layer. Every one of those surfaces is *first-party*: the owner typed it, seeded it or
approved it. This block adds two things that are not.

Phases 23–24 finish the first-party system. Search makes everything already published findable, and
the relationship model makes the connections between products, projects and articles explicit rather
than implied. Bulk management makes a catalogue of a few hundred rows maintainable by one person.

Phases 25–30 build something categorically different: a **research** subsystem that reads other
people's websites. Nothing it produces is a Rivya product, nothing it produces is publishable, and
nothing it produces may ever reach a visitor. The whole of D5's `research_` prefix rule, FEAT §19's
"do not expose internal scraper data publicly" and FEAT §25's "never automatically import changes
into Rivya products" exist to keep those two worlds apart. This document treats that separation as a
structural invariant enforced in four places at once — schema, RLS, a CI guard and a test — not as a
convention anyone is expected to remember.

## The isolation invariant — read this before writing any code in Phases 25–30

Four rules hold for the whole research subsystem. A change that breaks any of them is a defect, not a
trade-off.

| # | Invariant | Enforced by |
|---|---|---|
| I1 | No `research_*` table has a foreign key to, or is referenced by, any public content table (`products`, `categories`, `collections`, `materials`, `media_assets`, `portfolio_projects`, `journal_articles`, `pages`, `page_sections`, `product_relations`, `content_relations`) — except the two allowlisted taxonomy references (`research_source_category_map.category_id`, Phase 26; `research_products.matched_category_id`, Phase 28), named individually in the guard | Migration review + `scripts/research/check-research-isolation.mjs` reading `information_schema.referential_constraints`, whose allowlist holds exactly those two constraint names and fails on a third |
| I2 | No `research_*` table has an `anon` policy of any kind. Staff `select` requires `research.read` | Phase 04 policy pattern (research tables never receive policy 1) + `scripts/auth/check-rls.ts` extension |
| I3 | No identifier matching `/research_\|researchProduct\|scraper/i` appears anywhere under `app/(site)/**`, `lib/cms/**`, `lib/catalog/**`, `lib/seo/**`, `components/sections/**` or `content/**` | `check-research-isolation.mjs`, wired into `npm run check` |
| I4 | A row in `research_*` can only ever become a Rivya product by an owner typing one. There is no code path — no server action, no script, no SQL function, no Studio button — that writes to `products` from a `research_*` read | `check-research-isolation.mjs` (no import of `lib/scraper/**` inside `lib/supabase/repositories/products.ts` or any catalog server action) + `tests/unit/research-isolation.test.ts` |

The two allowlisted references are staff-written taxonomy pointers, not scraped values, and both are
`on delete set null`. They are still a narrow, knowing exception to D5's "scraped data … never joins
directly to public product tables", and D5 carries no amendment for them yet. Either a dated amendment
(A2) records the exception before Phase 26's migration `0240` ships, or both tables store the category
*slug* as text instead and the allowlist stays empty. That is *Open question 4*, and it is the single
item in this document that does not yet conform to `CANONICAL-DECISIONS.md`. The invariant is
otherwise absolute: a third research→public foreign key is a defect, not a trade-off.

Competitor **imagery and text are never re-hosted**. Extracted image URLs are stored as text.
Nothing from a research row is uploaded to Cloudinary, written to `media_assets`, or served from a
Rivya origin. Studio renders a source image only through the authenticated, non-caching proxy defined
in Phase 27, and only where the source's `image_extraction_mode` permits it.

## Conventions used by all eight phases

| Convention | Value |
|---|---|
| Migration numbering | 23 → `0210–0219`, 24 → `0220–0229`, 25 → `0230–0239`, 26 → `0240–0249`, 27 → `0250–0259`, 28 → `0260–0269`, 29 → `0270–0279`, 30 → `0280–0289` (the `10N − 20` rule established by `PHASE-10-15.md`) |
| Migration filename | `supabase/migrations/<nnnn>_phase<nn>_<subject>.sql` |
| Permission spelling | `<domain>.<action>`, the Phase 04 form (`research.write`), per the reconciliation in `PHASE-10-15.md` |
| Data access | `lib/supabase/repositories/**` only. No route, server action or scraper worker calls `.from(...)` directly (Phase 03 rule, enforced by `scripts/db/check-data-layer.mjs`) |
| Validation | Zod at every trust boundary (D1). For Phases 25–30 the network response of a third-party website **is** a trust boundary, and the most hostile one in the system |
| Rendering default | Server Component. `'use client'` requires a named reason and a `components/patterns/**` or `components/studio/**` home |
| Studio copy | Studio helper strings come from `global_content` (SEED §40), not literals |
| Feature flags | `research.enabled` (master kill switch, FEAT §32) is checked by every scraper entry point before any network call. Off by default in every environment until a source is policy-approved |
| Research scheduling | Vercel cron → `app/api/cron/research/route.ts`, drained in bounded slices; no long-running process |
| `updated_by` | Every research mutation records the acting `staff_profiles.user_id`; automated pipeline writes record `null` and set `actor_kind = 'SYSTEM'` |

### Permission mapping for the research subsystem

The Phase 04 matrix is the contract; this table only says which of its permissions each new action
uses. Note the split it produces, which is deliberate: **a researcher operates the pipeline, a
merchandiser judges its output.**

| Action | Permission required | Roles that hold it |
|---|---|---|
| Read any `/studio/research/**` surface | `research.read` | owner, admin, merchandiser, researcher, viewer |
| Create/edit a source, job or schedule; queue or cancel a run; re-run normalization | `research.write` | owner, admin, researcher |
| Approve a source's policy review, or enable a source | `research.write` **and** `system.settings.write` | owner, admin |
| Edit a normalised value, set `matched_category_id`, set `is_large_format` or `scale_band`, freeze a key in `normalized_overrides`, dismiss a `research_validation_issues` row | `research.write` | owner, admin, researcher |
| Disposition a row or a change — Review · Ignore · Shortlist · Reject · Mark Duplicate (writing `duplicate_of_id` + `disposition = 'DUPLICATE'`, and its reversal) · Confirm · Add Note · Add Tag · Compare (FEAT §25) — and every `stage` move | `research.confirm` | owner, admin, merchandiser |
| Any bulk disposition of more than one row | `research.confirm` **and** `bulk.execute` | owner, admin, merchandiser |
| Bulk archive, bulk unpublish, or any bulk write that removes live content | `bulk.execute` **and** `destructive.execute` | owner, admin |

The dividing line is the **column, not the screen**. `disposition`, `duplicate_of_id`, `stage` and any
`research_match_candidates` decision (accepting one writes both of the first two) are `research.confirm`.
Every other research column a person can edit — normalised values, `matched_category_id`,
`normalized_overrides`, `is_large_format`, `scale_band`, `large_format_source`, issue dismissal — is
`research.write`. This is exactly the split `PHASE-00-04.md` already records for the `research_*` RLS
profile: "`research.write`, or `research.confirm` for disposition-bearing writes". Each phase below
restates it for the columns it introduces, so no screen has to be read to know which permission applies.

### Inherited-precedent notes

Two things this document relies on, stated so a reader does not think they were invented here.

1. **`lib/` domain list.** D2 enumerates `lib/` subdomains and `PHASE-05-09.md` reads that list as
   closed; `PHASE-10-15.md` then adds `lib/site/` and `lib/catalog/`. This document follows the later
   precedent and adds `lib/search/`, `lib/relations/` and `lib/bulk/`. `lib/scraper/` and its six
   children (`core · adapters · normalization · validation · workflows · analytics`) are named in D2
   itself and are used exactly as written. The ambiguity is raised in *Open questions*.
2. **`product_relations` is not renamed.** Phase 03 created it with `source_product_id`; Phase 15
   indexes it. Phase 23 therefore adds a parallel `content_relations` for non-product sources rather
   than generalising a table two shipped phases already depend on.

### Shared D9 completion checklist

Every phase inherits all ten points of D9 and is **not COMPLETE** until each is true:

- [ ] 1. Scope implemented
- [ ] 2. Relevant tests run
- [ ] 3. No known scope-breaking error
- [ ] 4. Documentation updated (per D7 map and FEAT §43)
- [ ] 5. `CHANGELOG.md` updated
- [ ] 6. `PROJECT_STATE.md` updated
- [ ] 7. `docs/SESSION-STATE.md` updated with the FEAT §40 field set
- [ ] 8. Remaining issues documented
- [ ] 9. Next phase identified
- [ ] 10. Repository remains recoverable (migrations replay from clean, no uncommitted generated state)

---

## PHASE 23 — Global Search + Product Relationships

**Goal** — everything Rivya has published becomes findable, and the connections between things
become data rather than inference. A visitor types two characters into the header and gets grouped
suggestions across products, categories, collections, projects and journal articles; `/search` stops
returning the seeded no-results state that Phase 10 shipped as a placeholder and starts returning
results. Inside Studio the same query additionally reaches materials, media and inquiry references,
under permission. Separately, the `product_relations` edge Phase 03 created gets an actual model: a
named relation vocabulary, a second table for non-product sources, four stated suggestion rules that
propose edges but never create them, and a relationship workspace where an editor accepts, dismisses,
reorders or overrides every one of them.

**Depends on** — Phase 03 (`product_relations`, repositories, `pg_trgm` + `unaccent`), 04
(permissions, RLS pattern), 05 (command-palette provider registry, `app/api/studio/search/route.ts`),
10 (`/search` route, SEED §26 copy), 14 (catalogue filters, `ProductCard`), 15 (`RelatedContent`),
16 (`collections`), 17 (`portfolio_projects`), 18 (`journal_articles`), 20 (`inquiries`).

**Scope**

- **One index, two visibilities, and a hard allowlist.** `search_documents` holds a flattened,
  denormalised document per indexed entity. `visibility = 'PUBLIC'` rows are the five FEAT §18 public
  types; `visibility = 'STAFF'` rows are the Studio-only types. `entity_type` carries a `check`
  constraint naming the exact eight permitted values, so no research type can be inserted by a bug,
  a migration or a well-meaning later phase.

  | Entity type | Visibility | Indexed fields | Notes |
  |---|---|---|---|
  | `product` | PUBLIC | title, subtitle, summary, sku, category name, material names, collection names | `sku` is indexed for both scopes; it is not rendered on public results |
  | `category` | PUBLIC | name, subtitle, description | |
  | `collection` | PUBLIC | name, statement | Only `concept_state <> 'DRAFT_COLLECTION_CONCEPT'` rows (FEAT §9) |
  | `portfolio_project` | PUBLIC | title, summary, location-free body | |
  | `journal_article` | PUBLIC | title, excerpt, body, category | |
  | `material` | STAFF | name, family, description | FEAT §18 lists Materials for Studio search only |
  | `media_asset` | STAFF | `rivya_asset_id`, filename, alt text, folder, tags | |
  | `inquiry` | STAFF | reference code, inquiry type, related product title, `pipeline_status` | **No personal data.** Never the name, phone number, email address, uploaded filename or message body of an enquirer |

- **Index maintenance is a trigger, not a job.** `refresh_search_document(entity_type, entity_id)` is
  a `security definer` function; one `after insert or update or delete` trigger per source table calls
  it. A delete on the source removes the document row. `scripts/search/reindex.ts` rebuilds the whole
  index and is the only supported repair path; it is idempotent and reports per-type counts.
- **Ranking.** `search_vector` is a stored generated column: `setweight(to_tsvector('simple',
  unaccent(title)),'A') || setweight(…subtitle…,'B') || setweight(…body…,'C')`. Query path is
  `websearch_to_tsquery` first; when it yields fewer than four rows, a second pass ranks by
  `similarity(title, q)` with a 0.30 threshold — that is the whole of "typo tolerance where
  practical" (FEAT §19), and it is a documented fallback, not a fuzzy-everything mode.
- **Public search UI.** `/search?q=&type=&category=&page=` is server-rendered, results grouped by
  entity type in a fixed order (Products · Collections · Categories · Portfolio · Journal), 10 per
  group on the landing view and paginated when a single `type` is selected. Filters reuse the Phase 14
  URL-parameter contract when `type=product`. Zero results renders the SEED §26 copy from
  `global_content` — `Nothing matched that search.` / `Try another material, product type or
  collection.` / `Explore the Collection` — never a fabricated suggestion.
- **Suggestions.** `app/api/search/suggest/route.ts` (GET, `q` ≥ 2 characters, ≤ 64 characters, max 8
  results across ≤ 3 groups, 200 ms statement timeout, `Cache-Control: public, s-maxage=60,
  stale-while-revalidate=300`). The header input is an ARIA 1.2 combobox:
  `role="combobox"` + `aria-expanded` + `aria-controls`, listbox options with `aria-activedescendant`,
  `ArrowDown`/`ArrowUp` move, `Enter` navigates, `Escape` closes and restores the input, and the
  result count is announced through a polite live region. It degrades to a plain `<form method="get">`
  submitting to `/search` with JavaScript disabled.
- **Studio search.** Extends the Phase 05 endpoint and palette registry with one provider per entity
  type. Each provider declares its required permission and is dropped from the response when the
  session role lacks it — a researcher, who does not hold `inquiries.read` in the Phase 04 matrix, gets
  no inquiry group and no count that implies one exists. Research providers are **not** registered here;
  Phases 25, 26 and 28 register them against `research_search_documents`, which this phase creates empty
  and unreadable by `anon`: *Competitor Sources* and *Workflow Runs* in Phases 25 and 26, and FEAT §18's
  *Scraped Products* in Phase 28, which is the first phase in which a research row carries a normalised
  title worth indexing.
- **Zero-result logging.** `search_queries` records `query_text`, `normalized_query`, `scope`,
  `result_count` and `occurred_at` for public and Studio searches. No IP, no user agent, no actor id
  for public searches. Retention is 90 days, enforced by `scripts/search/prune-queries.ts` run from
  the same cron route as the research scheduler. It exists so the owner can see what visitors looked
  for and did not find; it is not analytics and it is not a profile.
- **Relation vocabulary.** `relation_type` becomes a controlled set enforced by `check` constraints on
  both relation tables: `RELATED_PRODUCT · PORTFOLIO_PROJECT · JOURNAL_ARTICLE · DESIGN_FAMILY ·
  RESIN_STYLE · WOOD_SPECIES · CUSTOMIZATION_FORM · MATERIAL_STORY · DESIGN_DIRECTION`. Category,
  collection, material and media relations keep their existing dedicated tables from Phase 03 and are
  not duplicated here.
- **`product_attribute_terms`.** One table with a `taxonomy` enum covering `DESIGN_FAMILY`,
  `RESIN_STYLE` and `WOOD_SPECIES` (FEAT §10), rather than three near-identical tables. **Zero rows
  are seeded.** A term such as a wood species is vocabulary, but attaching it to Rivya is a capability
  claim, so terms are owner-created and any term surfaced publicly carries
  `OWNER_VERIFICATION_REQUIRED` until verified (D10).
- **Suggestion rules — exactly four, all deterministic, none persisted.** FEAT §11 permits automatic
  relations only where a reliable rule exists. `lib/relations/rules.ts` computes suggestions on demand
  and returns them with the rule key and a human-readable reason. Nothing is written until an editor
  accepts.

  | Rule key | Rule | Why it is reliable |
  |---|---|---|
  | `same-collection` | Products sharing a published `collections` row | An editor deliberately put both in that collection |
  | `shared-materials` | Products sharing ≥ 2 `product_materials` rows | Two shared materials is an editorial decision, not a coincidence |
  | `journal-linked-product` | A published article whose body contains an internal link to `/product/<slug>` | The author linked it explicitly |
  | `project-featured-product` | A published project with an existing `content_relations` edge to the product, suggesting the inverse edge | The forward edge already exists and was made by hand |

  Explicitly **not** rules: view-count affinity, price-band affinity, title similarity, image
  similarity (Phase 33 and even then research-only), and anything phrased "customers also viewed" —
  there are no customer accounts (D1).
- **Editor override, in four gestures.** Accept a suggestion → an edge with `origin = 'RULE_ACCEPTED'`
  and its `rule_key`. Dismiss → a `relation_suppressions` row so the same suggestion never returns.
  Create by hand → `origin = 'EDITOR'`. Reorder or delete → always available, including on accepted
  edges. Reciprocal types (`RELATED_PRODUCT`, `PORTFOLIO_PROJECT`, `JOURNAL_ARTICLE`) create the
  inverse edge in the same transaction with a shared `paired_relation_id`; deleting one deletes both.
- **Public rendering is unchanged.** Phase 15's rule stands: only real edges render under "Related";
  the same-category fallback keeps its honest "More in {Category}" heading. Phase 23 gives editors a
  way to replace that fallback with real edges — it does not upgrade the fallback's label.

**Out of scope**

- Visual/image similarity (Phase 33) and any research-derived suggestion. `search_documents` cannot
  hold a research row by constraint.
- Personalisation, recency-weighted-by-viewer ranking, or any per-visitor state. No customer accounts
  exist (D1) and none are being introduced.
- Search abuse controls beyond input caps and caching. A request-rate limiter is Phase 41's call.
- Synonym dictionaries, stemming beyond `simple` + `unaccent`, multilingual analysis, and vector /
  embedding search. If the corpus grows past what Postgres full-text serves, that is a later decision
  with an amendment, not a quiet swap.
- Bulk editing of relations (Phase 24) and the research search providers (Phases 25–26).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Search migrations | `supabase/migrations/0210_phase23_search.sql`, `0211_phase23_search_triggers.sql`, `0212_phase23_search_rls.sql` | Table, allowlist check, triggers, policies |
| Relations migration | `supabase/migrations/0213_phase23_relations.sql` | `content_relations`, `relation_suppressions`, `product_attribute_terms`, `product_relations` columns |
| Query layer | `lib/search/query.ts` | Zod over `searchParams`; `websearch_to_tsquery` + trigram fallback; canonical URL builder |
| Result grouping | `lib/search/group.ts` | Fixed group order, per-group caps, result → card mapping |
| Repositories | `lib/supabase/repositories/{search,relations}.ts` | The only files that touch the two index tables |
| Public search route | `app/(site)/search/page.tsx` | Replaces the Phase 10 placeholder body; same path |
| Suggest endpoint | `app/api/search/suggest/route.ts` | GET, capped, cached, public scope only |
| Search input | `components/patterns/SearchCombobox/{index.tsx,Listbox.tsx}` | Client; ARIA 1.2 combobox; no-JS fallback form |
| Result cards | `components/patterns/SearchResultCard.tsx` | Server; one variant per entity type |
| Studio providers | `components/studio/command/providers/{products,categories,collections,materials,portfolio,journal,media,inquiries}.ts` | Permission-declared, registered with the Phase 05 registry |
| Relation rules | `lib/relations/rules.ts` | Four rules; pure functions; returns `{ ruleKey, reason, target }[]` |
| Relation writer | `lib/relations/write.ts` | Accept, dismiss, create, reorder, delete; reciprocity in one transaction |
| Relationship workspace | `app/(studio)/studio/catalog/relationships/**` | Fills the D4 leaf |
| Reindex + prune scripts | `scripts/search/{reindex.ts,prune-queries.ts}` | Idempotent; per-type counts |
| Scope guard | `scripts/search/check-search-scope.mjs` | Fails if any research identifier appears in the public search path |
| Tests | `tests/unit/{search-query,search-scope,relation-rules,relation-reciprocity}.test.ts`, `tests/e2e/{search-public,search-combobox-a11y,studio-relationships}.spec.ts` | Scope, ranking, keyboard, override |
| Docs | `docs/architecture/DATA_MODEL.md`, `docs/studio/STUDIO_GUIDE.md`, `docs/project/BUSINESS_RULES.md` | Index model; workspace; the "no invented relation" rule |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `search_documents` | `id`, `entity_type text not null check (entity_type in ('product','category','collection','portfolio_project','journal_article','material','media_asset','inquiry'))`, `entity_id uuid not null`, `visibility search_visibility not null`, `status text not null` (see the status note below), `url_path text`, `title text not null`, `subtitle text`, `body text`, `keywords text[]`, `image_media_id uuid`, `category_slug citext`, `search_vector tsvector generated always as (…) stored`, `indexed_at timestamptz` | `unique (entity_type, entity_id)`; GIN on `search_vector`; GIN `gin_trgm_ops` on `title` |
| `research_search_documents` | Same shape, `entity_type check (entity_type in ('research_product','research_source','research_run'))`, `visibility` always `'STAFF'`, `status text not null` over the seven `research_stage` values | Created **empty** here so the separation is visible in the schema from day one. Populated by Phases 25, 26 and 28. No `anon` policy, ever (I2) |
| `search_queries` | `id`, `query_text text not null`, `normalized_query text not null`, `scope text check (scope in ('PUBLIC','STUDIO'))`, `result_count int not null`, `staff_user_id uuid null`, `occurred_at timestamptz default now()` | No IP, no user agent. 90-day retention |
| `content_relations` | `id`, `source_type text check (source_type in ('portfolio_project','journal_article','collection'))`, `source_id uuid not null`, `target_type text`, `target_id uuid not null`, `relation_type text`, `sort_order int default 0`, `origin relation_origin not null default 'EDITOR'`, `rule_key text`, `note text`, `paired_relation_id uuid`, plus D5 common set | `unique (source_type, source_id, target_type, target_id, relation_type)` |
| `relation_suppressions` | `id`, `source_type text`, `source_id uuid`, `target_type text`, `target_id uuid`, `rule_key text not null`, `reason text`, `suppressed_by uuid`, `suppressed_at timestamptz default now()` | A dismissed suggestion never returns |
| `product_attribute_terms` | `id`, `taxonomy attribute_taxonomy not null`, `slug citext`, `name text not null`, `description text`, `sort_order int`, plus D5 common set | `unique (taxonomy, slug)`; **zero rows seeded** |
| `product_relations` (altered) | `+ origin relation_origin not null default 'EDITOR'`, `+ rule_key text`, `+ note text`, `+ paired_relation_id uuid` | `+ unique (source_product_id, target_type, target_id, relation_type)`; `+ check` on the relation vocabulary |

**Why `status` is `text` and not `content_status`.** Seven of the eight indexed entities carry
`content_status`, but `inquiries` does not: `DATA_MODEL.md` §1.4 exempts it and its `inquiries` table
entry says "**not** `content_status`", because it carries `pipeline_status inquiry_status` instead.
There is therefore no legal `content_status` value an inquiry document could hold, and
`refresh_search_document('inquiry', …)` would have to invent a mapping. It does not. `status` stores
the source row's own status token **verbatim** — `content_status` for the seven content types,
`inquiry_status` for `inquiry`, and `research_stage` on `research_search_documents`. Junk values are
still impossible, because `search_documents` carries
`check (status in ('DRAFT','REVIEW','APPROVED','PUBLISHED','ARCHIVED','NEW','READ','IN_CONVERSATION','QUOTED','WON','LOST','SPAM'))`
and `research_search_documents` carries the equivalent check over the seven stage values. The anon
predicate `visibility = 'PUBLIC' and status = 'PUBLISHED'` is unaffected: only the five public content
types are ever written with `visibility = 'PUBLIC'`, and
`check (entity_type not in ('material','media_asset','inquiry') or visibility = 'STAFF')` makes that
structural rather than conventional. `DATA_MODEL.md`'s `search_documents` row currently reads
`status content_status`; correcting it to `status text` is part of this phase's documentation deliverable.

New enums in `0210`/`0213`: `search_visibility as enum ('PUBLIC','STAFF')`,
`relation_origin as enum ('EDITOR','RULE_ACCEPTED')`,
`attribute_taxonomy as enum ('DESIGN_FAMILY','RESIN_STYLE','WOOD_SPECIES')`.

RLS: `search_documents` — anon `select using (visibility = 'PUBLIC' and status = 'PUBLISHED')`; staff
`select` for any active role; writes service-role only (triggers run `security definer`).
`research_search_documents` and `search_queries` — no anon policy at all; `select` requires
`research.read` and `analytics.read` respectively.

**Studio surface** — **fills** `/studio/catalog/relationships` (entity picker, edges grouped by
relation type with drag reordering, a Suggestions panel per rule with Accept / Dismiss, an inverse-edge
indicator, and a coverage panel counting published products with zero manual edges). **Extends**
`/studio/system/settings` with the relation-vocabulary and attribute-term editors, and the Phase 05
command palette everywhere.

**Public surface** — `/search` (body replaced, path unchanged) and `app/api/search/suggest`. The
header search input appears on every `(site)` route via the Phase 10 shell.

**Media** — search result cards use each entity's own bound hero asset. For categories that is the
Phase 09 binding: `3d-resin` → `three-d-resin` (13), `wall-statement-art` → `wall-art` (20),
`preservation` → `preservation-varmala` (15) + `preservation-keepsake` (4), `decor` → `decor` (18),
`gifts` → `gifts` (10); `furniture` and `collectible-design` remain unbound and render as text-only
cards. Product cards use real media only and, since no product exists yet, render none. No asset is
generated (D6, FEAT §33).

**Risks**

| Risk | Mitigation |
|---|---|
| A research row reaches the public index | `entity_type` `check` constraint physically excludes every research type; `research_search_documents` is a separate table with no anon policy; `check-search-scope.mjs` fails the build on a research identifier in the public path; `tests/unit/search-scope.test.ts` asserts the anon role reads zero rows from the research index |
| Inquiry documents leak personal data into Studio search results and then into a screenshot or export | The inquiry document stores reference code, type, related product title and status only. `tests/unit/search-scope.test.ts` inserts an inquiry with a name, phone and message and asserts none of the three appears in its `search_documents` row |
| Trigram fallback turns every query into a fuzzy match and ruins precision | The fallback runs only when the exact pass returns fewer than four rows, at a 0.30 threshold, and its results are visually grouped under a distinct heading so the ranking change is legible |
| Index drifts from source tables after a bulk operation | Triggers fire per row including from Phase 24 bulk writes; `reindex.ts` is idempotent and a nightly cron slice reconciles counts, logging a discrepancy as a `WARNING` system log |
| Suggestion rules silently become the relation model | Rules never write. Every persisted edge carries `origin`; a unit test asserts `lib/relations/rules.ts` exports no function that performs a write, and the workspace shows accepted-from-rule edges with their rule key so an editor can audit them |
| Reciprocal edges drift out of sync | `paired_relation_id` plus a delete trigger that removes the pair; `tests/unit/relation-reciprocity.test.ts` creates, reorders and deletes from both directions |
| Search becomes the place someone adds a "did you mean" that invents a product name | No suggestion text is generated. Zero results renders seeded copy only (SEED §26, D10) |

**Verification**

1. `npm run db:migrate && npm run db:types && git diff --exit-code lib/supabase/database.types.ts` — clean.
2. `psql -c "insert into search_documents (entity_type, entity_id, visibility, status, title) values ('research_product', gen_random_uuid(), 'PUBLIC', 'PUBLISHED', 'x');"` → rejected by the `check` constraint.
3. As the `anon` role: `select count(*) from research_search_documents;` → permission denied. As `editor` — the only role in the Phase 04 matrix without `research.read`; `viewer` holds it — the same query is denied.
4. `node scripts/search/check-search-scope.mjs` → exits 0. Add `research_products` to `lib/search/query.ts` and confirm it exits non-zero.
5. `npm run test:unit -- search-query search-scope relation-rules relation-reciprocity` — all green.
6. Seed the Playwright fixture with one published product, one collection, one project and one article. `npx playwright test tests/e2e/search-public.spec.ts` — `/search?q=resin` returns grouped results in the fixed order; `/search?q=zzzzzz` returns the seeded SEED §26 copy and HTTP 200; a `DRAFT` article never appears.
7. `npx playwright test tests/e2e/search-combobox-a11y.spec.ts` — keyboard only: two characters open the listbox, `ArrowDown` moves `aria-activedescendant`, `Enter` navigates, `Escape` closes and returns focus. axe reports zero critical/serious violations. Disable JavaScript and confirm the form still reaches `/search`.
8. `curl "localhost:3000/api/search/suggest?q=a"` → 400 (below minimum). `?q=resin` → ≤ 8 results and a `s-maxage=60` header. Confirm no research field name appears in any response body.
9. `npx playwright test tests/e2e/studio-relationships.spec.ts` — accept a `shared-materials` suggestion, assert the edge is created with `origin='RULE_ACCEPTED'` and its inverse exists; dismiss another, reload, assert it does not return; delete a manual edge and assert both directions vanish.
10. `node scripts/search/reindex.ts --dry-run` twice → identical per-type counts, zero writes.

**Exit criteria**

- [ ] `search_documents` covers all eight entity types with the correct visibility, and the `check` constraint makes a research row uninsertable.
- [ ] `research_search_documents` exists, is empty, and is unreadable by `anon` and by `editor`, the only staff role without `research.read`.
- [ ] No inquiry personal data reaches any index row, proved by test.
- [ ] Public `/search` returns grouped, ranked, filtered, paginated results and the seeded SEED §26 empty state; unpublished content never appears.
- [ ] The header combobox is fully keyboard-operable, screen-reader-announced, and works with JavaScript disabled.
- [ ] Studio search returns only the groups the session's role may read.
- [ ] `product_relations` and `content_relations` together express every FEAT §10 relationship that does not already have a dedicated table, with a constrained vocabulary.
- [ ] Exactly four suggestion rules exist, each with a stated reason; no rule writes an edge; dismissal is permanent.
- [ ] `product_attribute_terms` ships with zero rows.
- [ ] `check-search-scope.mjs` is wired into `npm run check` and fails on a scope violation.
- [ ] Phase-specific D9 evidence: docs updated = `DATA_MODEL.md`, `STUDIO_GUIDE.md`, `BUSINESS_RULES.md`; tests run = the four unit suites and three e2e specs above; next phase = 24.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 24 — Bulk Management

**Goal** — one person can maintain a catalogue. Phase 24 adds a single bulk-operation engine with a
mandatory preview step, a typed confirmation for anything destructive, a per-item before-snapshot, a
24-hour undo, and an audit trail that says who changed what and lets a reviewer see the exact rows.
It then mounts that engine on the three FEAT §20 surfaces: products, media and the scraper. The
scraper surface is registered but empty — its tables do not exist until Phase 25 — and that is stated
here rather than discovered later.

**Depends on** — Phase 04 (`bulk.execute`, `destructive.execute`, `audit_logs`), 05 (`DataTable` row
selection hook, `ConfirmDialog`), 06 (media library), 14 (product editor, `lib/catalog/validation.ts`,
publication readiness), 20 (`inquiries`, for export), 23 (search index triggers must fire on bulk
writes).

**Scope**

- **One engine.** `lib/bulk/` defines a `BulkOperation` contract: `kind`, `targetEntity`, a Zod
  `paramsSchema`, `isDestructive`, a `preview(selection, params)` that performs no writes, and an
  `applyItem(id, params, tx)` that returns `{ before, after }`. Every surface registers operations;
  no surface implements its own loop. A registered operation that omits `preview` fails a unit test.
- **Four-step flow, always.** Select → Preview → Confirm → Apply. The preview is computed server-side
  and stored as a `bulk_operations` row with `status = 'PREVIEW'` and a `confirmation_token`; Apply
  requires that exact token, so a stale tab cannot apply a preview built from a different selection.
  Preview reports per-row outcome: will apply, will skip (and why), will fail validation (and which
  rule).
- **Destructive actions.** Archive, unpublish, bulk media folder move that breaks a live reference,
  and bulk research rejection are destructive. They require `destructive.execute` in addition to
  `bulk.execute`, and the confirm dialog requires the operator to type the row count as digits (for
  example `47`) before the button enables. **Bulk never hard-deletes anything.** Permanent deletion
  stays a single-row action on its own surface, so a mis-click can destroy one row, never a page of
  them.
- **Undo.** Every applied item stores `before` and the entity's `updated_at` at read time. Undo is
  available for 24 hours (`undo_deadline_at`), re-applies each `before` in a transaction, and **skips
  any row whose `updated_at` has changed since**, reporting those rows by id rather than overwriting
  someone else's later edit. Undo is itself a `bulk_operations` row with `undo_of_operation_id` set,
  so undoing an undo is a normal, audited operation. Import is undoable in the same way: rows it
  inserted are archived, rows it updated are restored.
- **Audit.** One `audit_logs` row per operation (`action = 'bulk.<kind>'`, `summary` carrying counts,
  `before`/`after` carrying the params and the counts, never the full row set) and one
  `activity_events` row. Per-item before/after lives in `bulk_operation_items` and is reachable from
  `/studio/operations/audit` by following the operation id. This keeps the audit log readable while
  losing nothing.
- **Product bulk surface** (`/studio/catalog/bulk`) — FEAT §20's product list in full: import, edit,
  publish, unpublish, archive, category assignment, collection assignment, status change, tag
  assignment, material assignment, media assignment.

  | Operation | Destructive | Guard |
  |---|---|---|
  | `product.publish` | no | Every selected row must pass the Phase 14 readiness checklist; rows that fail are listed in preview and excluded, never force-published |
  | `product.unpublish` / `product.archive` | yes | Typed count confirmation; undoable |
  | `product.set_category` / `set_collections` / `set_materials` | no | Target must exist and be published |
  | `product.set_status` | conditional | Destructive when the transition removes a row from `PUBLISHED` |
  | `product.assign_media` | no | Refuses any asset with `is_concept = true` (Phase 14 trigger, re-checked in preview so the failure is visible before Apply) |
  | `product.set_tags` | no | Tags from `product_attribute_terms` only; no free text |
  | `product.import` | no | See below |

- **Import** (`/studio/operations/imports`). CSV or TSV upload → column mapping UI → dry-run
  validation against `lib/catalog/validation.ts` → per-row preview → apply. Every imported product
  lands as `DRAFT` with `owner_verification` untouched, and **import can never publish**. This is
  SEED §32's "approved import" path: the import is the approval step, the publish is a separate,
  deliberate act. A row failing any FEAT §21 rule (duplicate SKU, duplicate slug, impossible
  dimensions, malformed URL, broken media reference, invalid price state, quote-only carrying a price,
  missing required publication data) is reported with its row number and rule name and is not applied.
- **Export** (`/studio/operations/exports`). CSV export of products, media and inquiries. Inquiry
  export requires `inquiries.export`, is audited with the field set exported, and excludes free-text
  message bodies unless the operator ticks an explicit box that is itself recorded in the audit row.
- **Media bulk surface** (toolbar on `/studio/media/all`). Bulk tag, bulk move/folder, bulk archive.
  Four fields are immutable in bulk and rejected at the engine: `rivya_asset_id`,
  `higgsfield_generation_id`, `is_ai_generated`, `is_concept`. The 250 manifest rows are operands here
  and it must not be possible to launder a concept asset into a real one by selecting a page of rows
  (D6, D10).
- **Scraper bulk surface.** Registered as `targetEntity = 'research_product'` with the FEAT §20 list
  — shortlist, reject, mark duplicate, assign research tags, confirm — but **all five operations are
  disabled and render an unavailable state naming Phase 29**, because `research_products` does not
  exist yet. Phase 29 enables them by implementing the operations against the same engine; it does not
  build a second bulk system.
- **Concurrency and size.** An operation is capped at 500 rows per apply; larger selections are
  rejected in preview with the count. Application runs in batches of 50 inside one transaction per
  batch, with a partial-failure result (`status = 'PARTIAL'`) rather than an all-or-nothing rollback,
  because a 500-row publish failing on row 499 must not discard 498 good writes.

**Out of scope**

- Any scraper bulk *implementation* (Phase 29 for review dispositions, Phase 35 for shortlist and
  confirmation). Phase 24 ships the engine and the registration only.
- Bulk deletion of any kind, permanently. Bulk operations soft-delete via archive.
- Bulk editing of CMS page sections or navigation — content publishing has its own Phase 08 flow.
- Google Sheets as an import or export target (Phase 36).
- Scheduled or recurring bulk operations, and rule-driven automatic bulk actions. Every bulk operation
  is initiated by a person who saw the preview.
- Undo beyond 24 hours, and undo of a hard delete (which cannot occur).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0220_phase24_bulk.sql` | Four tables + RLS |
| Engine | `lib/bulk/{types.ts,registry.ts,run.ts,undo.ts}` | Contract, registration, batched apply, undo |
| Product operations | `lib/bulk/operations/products/*.ts` | One file per operation in the table above |
| Media operations | `lib/bulk/operations/media/{tag,move,archive}.ts` | Immutable-field guard shared |
| Research stubs | `lib/bulk/operations/research/index.ts` | Registered, `available: false`, owning phase 29 |
| Import pipeline | `lib/bulk/import/{parse.ts,map.ts,validate.ts,apply.ts}` | CSV/TSV, mapping, dry-run, apply |
| Export pipeline | `lib/bulk/export/{products.ts,media.ts,inquiries.ts}` | Streamed CSV; audited field set |
| Bulk UI | `components/studio/bulk/{SelectionBar,PreviewTable,ConfirmDestructive,OperationResult,UndoBanner}.tsx` | Typed-count confirmation lives here |
| Product bulk page | `app/(studio)/studio/catalog/bulk/**` | Fills the D4 leaf |
| Imports / exports pages | `app/(studio)/studio/operations/{imports,exports}/**` | Fill two D4 leaves |
| Audit detail | `app/(studio)/studio/operations/audit/[operationId]/page.tsx` | Per-item before/after viewer |
| Guard | `scripts/bulk/check-bulk-registry.mjs` | Every registered operation has a preview, a Zod schema and a destructive flag |
| Tests | `tests/unit/{bulk-engine,bulk-undo,bulk-import-validation,bulk-media-immutable}.test.ts`, `tests/e2e/{bulk-products,bulk-destructive-confirm,bulk-undo}.spec.ts` | Preview accuracy, undo skip rule, immutability |
| Docs | `docs/studio/STUDIO_GUIDE.md`, `docs/architecture/DATA_MODEL.md`, `docs/ops/SECURITY.md` | Flow, tables, the destructive-permission rule |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `bulk_operations` | `id`, `kind text not null`, `target_entity text check (target_entity in ('product','media_asset','inquiry','research_product'))`, `status text check (status in ('PREVIEW','QUEUED','RUNNING','SUCCEEDED','PARTIAL','FAILED','UNDONE'))`, `is_destructive bool not null`, `selection jsonb not null`, `params jsonb not null`, `counts jsonb not null default '{}'`, `confirmation_token text`, `confirmed_at`, `actor_user_id`, `actor_role user_role`, `requested_at`, `started_at`, `finished_at`, `undo_deadline_at`, `undone_at`, `undone_by`, `undo_of_operation_id uuid references bulk_operations` | `selection` stores the exact id list previewed, so Apply cannot widen it |
| `bulk_operation_items` | `id`, `operation_id uuid not null references bulk_operations on delete cascade`, `entity_id uuid not null`, `result text check (result in ('APPLIED','SKIPPED','FAILED','UNDONE'))`, `reason text`, `before jsonb`, `after jsonb`, `row_version_before timestamptz`, `error text` | `unique (operation_id, entity_id)`; index on `(operation_id, result)` |
| `bulk_imports` | `id`, `operation_id`, `filename text`, `checksum text`, `delimiter text`, `column_map jsonb`, `row_count int`, `valid_count int`, `invalid_count int`, `status text` | Uploaded file itself is not retained after apply |
| `bulk_import_rows` | `id`, `import_id`, `row_number int`, `raw jsonb`, `mapped jsonb`, `issues jsonb default '[]'`, `action text check (action in ('INSERT','UPDATE','SKIP'))`, `target_entity_id uuid`, `applied bool default false` | Retained 30 days for post-hoc review, then pruned |

RLS: `select` on all four requires `bulk.execute` or `operations.audit.read`; `insert`/`update` is
service-role only (server actions run through the admin client after `requirePermission`). `revoke
delete` on `bulk_operations` and `bulk_operation_items` — the record of what was done is not itself
erasable.

**Studio surface** — **fills** `/studio/catalog/bulk`, `/studio/operations/imports`,
`/studio/operations/exports`. **Extends** `/studio/media/all` with a selection toolbar,
`/studio/catalog/products` with "Select all matching filter → Bulk", and `/studio/operations/audit`
with the per-operation item viewer. **Registers, disabled**: the research bulk toolbar on
`/studio/research/explorer` and `/studio/research/changes`, which render "Available from Phase 29".

**Public surface** — **None.**

**Media** — **None consumed.** The media bulk surface operates on the 250 migrated manifest rows as
data. The engine rejects any bulk write to `rivya_asset_id`, `higgsfield_generation_id`,
`is_ai_generated` or `is_concept`, and no operation in this phase creates, generates or deletes an
asset (D6, FEAT §33).

**Risks**

| Risk | Mitigation |
|---|---|
| A bulk publish pushes products that fail the readiness checklist | `product.publish` re-runs `lib/catalog/validation.ts` per row in preview and in apply; failing rows are excluded and listed. There is no force flag |
| A bulk archive removes live content and cannot be reversed | Typed-count confirmation, `destructive.execute` required, per-item `before` snapshot, 24-hour undo, and a hard rule that bulk never hard-deletes |
| Undo silently overwrites a later manual edit | Undo compares `row_version_before` with the row's current `updated_at` and skips on mismatch, reporting the skipped ids in the result and in the audit row |
| A stale browser tab applies a preview built from a different selection | Apply requires the `confirmation_token` issued with that preview and re-reads `selection` from the row; a changed filter produces a new preview and a new token |
| A concept asset becomes a product hero through a bulk media assignment | The Phase 14 trigger still fires, and preview surfaces the rejection before Apply so the operator sees it rather than a post-hoc failure |
| The audit log becomes unreadable after a 500-row operation | One audit row per operation with counts; per-item detail lives in `bulk_operation_items` behind a link |
| A 500-row operation times out mid-flight and leaves inconsistent state | Batches of 50, one transaction per batch, `status = 'PARTIAL'` with exact per-item results; re-running is safe because each operation is idempotent on its own `after` state |
| Someone builds a second bulk path for the scraper in Phase 29 | The research operations are registered here with `available: false` and an owning phase, and `check-bulk-registry.mjs` fails if any surface applies a mutation outside `lib/bulk/run.ts` |
| Inquiry export leaks message bodies into a spreadsheet by default | Message bodies are excluded unless explicitly ticked; the tick is recorded in the audit row along with the exported field list |

**Verification**

1. `npm run db:migrate` — `0220` applies from clean; `npm run db:types` produces no diff.
2. `node scripts/bulk/check-bulk-registry.mjs` — exits 0. Remove a `preview` from one operation and confirm it exits non-zero.
3. `npm run test:unit -- bulk-engine bulk-undo bulk-import-validation bulk-media-immutable` — green.
4. As `merchandiser`, `npx playwright test tests/e2e/bulk-products.spec.ts` — select 12 products (3 failing readiness), preview shows 9 apply / 3 excluded with named rules, apply publishes exactly 9.
5. As `merchandiser`, attempt `product.archive` → refused server-side (`destructive.execute` missing). As `admin`, the confirm button stays disabled until the exact row count is typed.
6. `npx playwright test tests/e2e/bulk-undo.spec.ts` — apply a 20-row category change; edit one row by hand; press Undo; assert 19 restored, 1 reported skipped, and the skipped row still carries the manual edit.
7. Upload a CSV with a duplicate SKU, a malformed media reference and a `REQUEST_QUOTE` row carrying a price → preview reports three issues with row numbers and rule names; apply inserts only the valid rows, all as `DRAFT`.
8. `psql -c "select status from products where id in (select target_entity_id from bulk_import_rows where applied);"` → every value is `DRAFT`.
9. `psql -c "delete from bulk_operation_items limit 1;"` as `authenticated` → permission denied.
10. Bulk-tag 30 media rows, then `select count(*) from media_assets where is_concept = false and rivya_asset_id like 'PROCESS-%';` → unchanged from before the operation.
11. Open `/studio/research/explorer` as `admin` → the bulk toolbar renders the "Available from Phase 29" state, not a broken control.

**Exit criteria**

- [ ] Exactly one bulk engine exists; every surface registers operations against it and none loops on its own.
- [ ] Every operation has a Zod params schema, a write-free preview, and a declared destructive flag, proved by the registry guard.
- [ ] Destructive operations require `destructive.execute` plus a typed row count; non-destructive require `bulk.execute`.
- [ ] Bulk never hard-deletes; archive is the only removal, and it is undoable for 24 hours.
- [ ] Undo skips rows changed since the operation and reports them by id.
- [ ] Every operation writes one `audit_logs` row and per-item before/after, and the audit rows cannot be deleted.
- [ ] Import lands every row as `DRAFT` and cannot publish; every FEAT §21 rule is enforced with a named error and a row number.
- [ ] Media bulk cannot alter `rivya_asset_id`, `higgsfield_generation_id`, `is_ai_generated` or `is_concept`.
- [ ] The scraper bulk surface is registered, disabled, and names Phase 29.
- [ ] Phase-specific D9 evidence: docs updated = `STUDIO_GUIDE.md`, `DATA_MODEL.md`, `SECURITY.md`; tests run = four unit suites and three e2e specs; next phase = 25.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 25 — Product Scraper Foundation

**Goal** — Rivya gains the machinery to fetch pages from a competitor website, politely, on a
schedule, under a kill switch, and to store what came back in a place that can never reach a visitor.
This phase builds the pipeline's skeleton and its first stage: the source record, the job, the run,
the work queue, the fetch log with its snapshot, the RAW item, and the `research_products` row that
will carry a discovered product through all seven FEAT §23 stages. It extracts nothing structured —
Phase 27 does that — and it normalizes nothing — Phase 28 does that. What it must get exactly right
is the politeness posture and the isolation invariant, because both are far harder to retrofit than
to build.

**Depends on** — Phase 03 (migrations, repositories), 04 (RLS pattern, roles, `audit_logs`), 05
(Studio shell, `DataTable`, `EmptyState`), 23 (`research_search_documents` exists and is unreadable
by anon), 24 (bulk engine, for the registered-but-disabled research operations).

**Scope**

- **The seven stages, exactly as FEAT §23 writes them.** `research_stage` is an enum with precisely
  seven values — `RAW · NORMALIZED · VALIDATED · MATCHED · REVIEW · SHORTLISTED · CONFIRMED` — and a
  row moves forward one stage at a time. Rejection is **not** a stage: `research_disposition`
  (`NONE · IGNORED · REJECTED · DUPLICATE`) is a separate column so the pipeline vocabulary stays
  literally the requirement's, and a rejected row keeps the stage it reached. Every transition writes
  a `research_pipeline_events` row with from-stage, to-stage, actor and reason. There is no code path
  that sets `stage` outside `lib/scraper/core/stage.ts`.
- **Politeness posture, and it is not optional.**

  | Control | Implementation |
  |---|---|
  | Identification | `SCRAPER_USER_AGENT` (D8) is the only user agent used, and it names Rivya plus a contact URL. No browser impersonation, no rotating agents |
  | robots.txt | Fetched per host, cached in `research_robots_cache` with a 24-hour TTL, parsed for the Rivya agent then `*`. A `Disallow` match means the URL is **never fetched**; the attempt is logged with `robots_decision = 'DISALLOWED'` |
  | `Crawl-delay` | Read from robots.txt and applied as a **floor** on the source's `request_delay_ms`; a source configured faster than robots asks is slowed, never the reverse |
  | Rate limit | Per-source `rate_limit_rpm`, `request_delay_ms` and `concurrency`, enforced by the lease query, not by hopeful `sleep()` calls |
  | Backoff | `429` and `503` honour `Retry-After`; otherwise exponential backoff 2⁰…2⁵ minutes with jitter. Five consecutive failures open a circuit breaker that disables the source's runs and raises a `WARNING` system log |
  | Kill switch | Feature flag `research.enabled` plus per-source `is_enabled`; both are checked immediately before every fetch, not once per run |
  | Scope | Public product pages only. **Never**: authenticated or paywalled pages, pages behind a CAPTCHA, checkout or cart flows, personal data of any kind, or any page whose robots rules disallow it |
  | Technique | Plain HTTP `GET` with a bounded body size (2 MB) and a 15 s timeout. **No** headless browser, **no** proxy rotation, **no** IP cycling, **no** cookie-jar session forgery, **no** CAPTCHA solving. If a source requires any of those to read, the answer is that Rivya does not read it |

- **Policy review gate.** `research_sources.policy_status` (`UNREVIEWED · APPROVED · RESTRICTED ·
  BLOCKED`) starts at `UNREVIEWED`. A source cannot be enabled, and no run can be created for it,
  until an owner or admin sets `APPROVED` with `policy_reviewed_by`, `policy_reviewed_at` and
  `policy_notes`. The underlying determination — whether a given site's terms permit this — is a
  legal and commercial judgement that this repository cannot make. Every seeded source row and the
  Studio approval control are therefore marked **OWNER_VERIFICATION_REQUIRED**, and
  `docs/architecture/SCRAPER.md` states plainly that approval is the owner's assertion, not the
  engineering team's.
- **Job → run → work item.** A `research_jobs` row is the standing definition (source, type, scope,
  schedule). A `research_runs` row is one execution. `research_work_items` is the queue: one row per
  URL, leased with `select … for update skip locked`, retried with backoff, unique on
  `(run_id, url)`. This shape exists because Vercel functions are short-lived; a run is drained across
  many invocations and survives a cold start.
- **Scheduling.** `vercel.json` registers `app/api/cron/research/route.ts` every five minutes with
  `export const maxDuration = 60`. Each invocation: (1) promote due jobs whose source is enabled and
  policy-approved into runs and work items; (2) lease up to `concurrency` items per source, filtered
  by `next_fetch_not_before`; (3) fetch within a 50-second wall-clock budget; (4) write fetch, raw
  item and stats; (5) release leases and re-arm. A run that exceeds its budget stays `RUNNING` and
  continues on the next tick. Cancellation sets `status = 'CANCELLED'` and the drain loop checks it
  between items.
- **Snapshots.** Every fetch stores the response body to a private object store keyed
  `research/<source_slug>/<yyyy>/<mm>/<dd>/<sha256>.html.gz`, and records `content_hash`, byte size
  and `storage_key` on `research_fetches`. Snapshots are the evidence behind FEAT §24's change
  detection and are retained 180 days, then pruned by the same cron. They are **never** written to
  Cloudinary and never served from a public route.
- **RAW items.** `research_raw_items` stores exactly what came back and nothing interpreted: the URL,
  the fetch id, the content hash, and a `raw jsonb` payload that in this phase contains only the
  document title, canonical URL and any discovered product-link candidates. Structured field
  extraction is Phase 27's job and this phase must not pre-empt it with a "temporary" parser.
- **`research_products`.** One row per discovered product per source, keyed
  `unique (source_id, source_url)`, carrying `stage`, `disposition`, `first_seen_at`, `last_seen_at`,
  `first_seen_run_id`, `last_seen_run_id`. Created at stage `RAW`. It has no foreign key to any public
  table and never will (I1).
- **Studio, read-only where it must be.** `/studio/research/dashboard` shows run health, queue depth,
  last-run freshness per source and stage counts — all zero until a source is approved.
  `/studio/research/scrape` is the "new run" form (source, job type, scope, dry-run toggle).
  `/studio/research/jobs` and `/studio/research/runs` list and drill into jobs and runs, with cancel,
  retry-failed-items and a live-ish status that polls at 10-second intervals.
- **Isolation guard.** `scripts/research/check-research-isolation.mjs` implements I1–I4 and is wired
  into `npm run check`. It is the single most important artefact in this phase.

**Out of scope**

- Structured extraction and adapters (Phase 27). This phase's `generic` fetch produces links and a
  title, nothing more.
- Normalization, unit parsing, currency handling, validation, matching and deduplication (Phase 28).
- Change detection, diffing and review (Phase 29); the large-format workspace (Phase 30); comparison,
  similarity, opportunity scoring, shortlist and Sheets (Phases 31–36).
- The full FEAT §26 source configuration surface (Phase 26). This phase creates the identity and
  politeness columns the engine needs to run and a read-only source list; the management screen,
  category mapping, URL patterns and health view are Phase 26.
- Any image download, image re-hosting or Cloudinary write from a research row — permanently.
- Any write to `products`, `media_assets` or any public table from anywhere in `lib/scraper/**` —
  permanently (I4).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Enums | `supabase/migrations/0230_phase25_research_enums.sql` | Six enums, added before use |
| Core tables | `supabase/migrations/0231_phase25_research_core.sql` | Sources, jobs, runs, fetches, raw items, products, events, robots cache |
| Queue | `supabase/migrations/0232_phase25_research_queue.sql` | `research_work_items`, lease indexes |
| RLS | `supabase/migrations/0233_phase25_research_rls.sql` | Staff-only policies; **no anon policy on any table** |
| Stage machine | `lib/scraper/core/stage.ts` | The only writer of `research_products.stage`; emits pipeline events |
| Fetcher | `lib/scraper/core/fetch.ts` | UA, timeout, size cap, redirect cap, snapshot write |
| Robots | `lib/scraper/core/robots.ts` | Fetch, parse, cache, decide; `Crawl-delay` floor |
| Rate limiter | `lib/scraper/core/rate-limit.ts` | Lease-time enforcement, backoff, circuit breaker |
| Queue driver | `lib/scraper/workflows/drain.ts` | Promote, lease, execute, release, re-arm within budget |
| Scheduler | `lib/scraper/workflows/schedule.ts` | Cron expression → `next_run_at`; overlap prevention |
| Cron route | `app/api/cron/research/route.ts` | `maxDuration = 60`; also prunes snapshots and `search_queries` |
| Repositories | `lib/supabase/repositories/research/{sources,jobs,runs,work-items,fetches,raw-items,products}.ts` | Sole `.from(...)` callers |
| Studio pages | `app/(studio)/studio/research/{dashboard,scrape,jobs,runs}/**` | Fill four D4 leaves |
| Search providers | `components/studio/command/providers/research-{sources,runs}.ts` | Against `research_search_documents`; `research.read` declared |
| Isolation guard | `scripts/research/check-research-isolation.mjs` | I1–I4; wired into `npm run check` |
| Snapshot pruner | `scripts/research/prune-snapshots.ts` | 180-day retention |
| Tests | `tests/unit/{robots-parse,rate-limit,stage-machine,research-isolation}.test.ts`, `tests/e2e/{research-dashboard,research-run-lifecycle}.spec.ts` | Politeness, stages, isolation |
| Docs | `docs/architecture/SCRAPER.md` (created), `docs/architecture/DATA_MODEL.md`, `docs/ops/SECURITY.md`, `docs/studio/STUDIO_GUIDE.md` | Posture, schema, secrets, screens |

**Database**

New enums: `research_stage ('RAW','NORMALIZED','VALIDATED','MATCHED','REVIEW','SHORTLISTED','CONFIRMED')`,
`research_disposition ('NONE','IGNORED','REJECTED','DUPLICATE')`,
`research_run_status ('QUEUED','RUNNING','SUCCEEDED','PARTIAL','FAILED','CANCELLED')`,
`research_job_type ('DISCOVERY','DETAIL','REFRESH')`,
`research_policy_status ('UNREVIEWED','APPROVED','RESTRICTED','BLOCKED')`,
`research_trigger ('MANUAL','SCHEDULED')`.

| Table | Key columns | Notes |
|---|---|---|
| `research_sources` | `id`, `slug citext unique`, `name`, `base_url text`, `region text`, `currency char(3)`, `source_type text`, `is_enabled bool not null default false`, `adapter_key text not null default 'generic'`, `rate_limit_rpm int not null default 20`, `request_delay_ms int not null default 3000`, `concurrency int not null default 1`, `next_fetch_not_before timestamptz`, `in_flight_count int not null default 0`, `consecutive_failures int not null default 0`, `circuit_open_until timestamptz`, `policy_status research_policy_status not null default 'UNREVIEWED'`, `policy_reviewed_by`, `policy_reviewed_at`, `policy_notes text`, plus D5 common set | Phase 26 adds the remaining FEAT §26 fields. `check (is_enabled = false or policy_status = 'APPROVED')` |
| `research_jobs` | `id`, `source_id`, `job_type research_job_type`, `name`, `scope jsonb not null default '{}'`, `cron_expression text`, `next_run_at`, `is_enabled bool default false`, `max_urls int`, plus D5 common set | `scope` holds seed URLs / category paths; Phase 26 supplies patterns |
| `research_runs` | `id`, `job_id`, `source_id`, `status research_run_status`, `trigger research_trigger`, `requested_by uuid`, `queued_at`, `started_at`, `finished_at`, `stats jsonb default '{}'`, `error_summary text`, `is_dry_run bool default false` | Index `(source_id, started_at desc)` |
| `research_work_items` | `id`, `run_id`, `source_id`, `url text not null`, `depth int default 0`, `state text check (state in ('PENDING','LEASED','DONE','FAILED','SKIPPED'))`, `lease_until timestamptz`, `attempts int default 0`, `not_before_at timestamptz`, `last_error text` | `unique (run_id, url)`; partial index `(source_id, not_before_at) where state = 'PENDING'` |
| `research_fetches` | `id`, `run_id`, `source_id`, `work_item_id`, `url`, `final_url`, `http_status int`, `robots_decision text check (robots_decision in ('ALLOWED','DISALLOWED','NO_ROBOTS','ERROR'))`, `content_hash text`, `bytes int`, `duration_ms int`, `storage_key text`, `fetched_at`, `error text` | A `DISALLOWED` row records the decision and performs **no** request |
| `research_raw_items` | `id`, `run_id`, `source_id`, `fetch_id`, `source_url text`, `source_external_id text`, `raw jsonb not null`, `content_hash text`, `adapter_key text`, `adapter_version text`, `extracted_at` | Phase 27 fills `raw` properly |
| `research_products` | `id`, `source_id`, `source_url text`, `source_external_id text`, `stage research_stage not null default 'RAW'`, `disposition research_disposition not null default 'NONE'`, `first_seen_at`, `last_seen_at`, `first_seen_run_id`, `last_seen_run_id`, `current_version_id uuid` (Phase 27 adds the FK), plus D5 common set | `unique (source_id, source_url)`; index `(stage, disposition, last_seen_at desc)` |
| `research_pipeline_events` | `id`, `entity_type text`, `entity_id uuid`, `from_stage research_stage`, `to_stage research_stage`, `actor_user_id uuid`, `actor_kind text check (actor_kind in ('STAFF','SYSTEM'))`, `reason text`, `occurred_at` | Append-only; `revoke update, delete` |
| `research_robots_cache` | `id`, `host text unique`, `body text`, `fetched_at`, `expires_at`, `crawl_delay_s numeric` | 24-hour TTL |

RLS on every table above: `select` requires `research.read`; `insert`/`update` requires
`research.write` or the service role; **no `anon` policy is created on any of them** (Phase 04's
research exception, I2). `research_pipeline_events` additionally revokes `update` and `delete`.

**Studio surface** — **fills** `/studio/research/dashboard`, `/studio/research/scrape`,
`/studio/research/jobs`, `/studio/research/runs` (and `runs/[id]` as a stub that Phase 27 completes).
`/studio/research/sources` remains a read-only list until Phase 26. Every page begins with
`await requirePermission('research.read')` and write controls additionally check `research.write`.

**Public surface** — **None, and this is load-bearing.** `app/api/cron/research` is a route handler,
not a page; it returns `404` to any request lacking Vercel's cron header (see *Open questions* on the
absence of a cron secret in D8). No `(site)` route, sitemap entry, feed or JSON-LD block references a
research table (I3).

**Media** — **None.** No asset from `data/higgsfield/asset-manifest.json` is consumed, and no
competitor image is fetched, downloaded, cached, re-hosted or written to `media_assets` or Cloudinary
in this phase or any later one.

**Risks**

| Risk | Mitigation |
|---|---|
| Rivya crawls a site it has no right to crawl | `policy_status` gate blocks run creation; the `check (is_enabled = false or policy_status = 'APPROVED')` constraint makes an enabled-but-unreviewed source impossible; approval requires `system.settings.write` and is marked OWNER_VERIFICATION_REQUIRED in Studio and in `SCRAPER.md` |
| A misconfigured source hammers a host | Delay, rate limit and concurrency are enforced in the lease query, not in application code; `Crawl-delay` overrides a faster configuration; a circuit breaker opens after five consecutive failures; `research.enabled` kills every source at once |
| Vercel's function timeout leaves a run half-done and unrecoverable | Work items are the unit of progress, not runs. Leases expire and are re-claimed; `attempts` and `not_before_at` drive retry; a run resumes on the next cron tick |
| Two cron invocations overlap and double-fetch | `for update skip locked` leasing plus `unique (run_id, url)`; `schedule.ts` refuses to create a second run for a job whose previous run is still `RUNNING` |
| Scraped data leaks to the public site | I1–I4 with four independent enforcement points; `check-research-isolation.mjs` in `npm run check`; `tests/unit/research-isolation.test.ts` asserts the anon role reads zero rows from every `research_*` table |
| Snapshots grow without bound and become a cost and a liability | Gzipped, hashed, 180-day retention, pruned by cron, stored outside Cloudinary, never public |
| Someone adds a headless browser "just for one difficult source" | The prohibition is written into `SCRAPER.md` and `SECURITY.md`, and `check-research-isolation.mjs` fails on an import of any browser-automation package inside `lib/scraper/**` |
| A temporary parser lands here and Phase 27's adapter architecture never happens | `research_raw_items.raw` has a Zod schema in this phase accepting only `{ title, canonicalUrl, links }`; anything richer fails validation |

**Verification**

1. `npm run db:migrate` — `0230`–`0233` apply from clean; `npm run db:types` produces no diff.
2. `psql -c "select tablename from pg_policies where schemaname='public' and tablename like 'research_%' and roles::text like '%anon%';"` → zero rows (I2).
3. `psql -c "select count(*) from information_schema.referential_constraints rc join information_schema.table_constraints tc on … where (research → public) or (public → research);"` → zero (I1); the guard's allowlist is empty at this point. Encoded in `check-research-isolation.mjs`.
4. `node scripts/research/check-research-isolation.mjs` → exits 0. Add `import { getResearchProducts } from '@/lib/scraper/core'` to any `app/(site)` file and confirm non-zero.
5. `npm run test:unit -- robots-parse rate-limit stage-machine research-isolation` — green. `robots-parse` covers `Disallow: /`, agent-specific blocks, `Crawl-delay`, malformed files and a 404 robots.
6. Insert a source with `policy_status = 'UNREVIEWED'` and `is_enabled = true` → rejected by the check constraint.
7. Approve and enable a local fixture source served by a test HTTP server. Create a `DISCOVERY` job, hit `/api/cron/research`, and assert: `research_runs` moves `QUEUED → RUNNING`; work items are leased; requests to the fixture arrive no faster than `request_delay_ms`; the fixture's `Disallow` path produces a `research_fetches` row with `robots_decision='DISALLOWED'` **and no HTTP request** (asserted from the fixture server's own log).
8. Set the fixture to return `429` with `Retry-After: 30` → the item's `not_before_at` advances by ≥ 30 s and `attempts` increments. Five consecutive `500`s → `circuit_open_until` is set and no further fetch is attempted.
9. Turn off the `research.enabled` flag mid-run → the next cron tick performs zero fetches and logs a `WARNING`.
10. `curl localhost:3000/api/cron/research` without the cron header → 404.
11. `npx playwright test tests/e2e/research-run-lifecycle.spec.ts` — as `researcher`: start a run, watch status advance, cancel it, assert `CANCELLED` and no further fetches. As `viewer`: every write control is absent and a direct POST is refused server-side.
12. `grep -rn "research_" app/\(site\) components/sections lib/cms lib/catalog lib/seo content` → no matches (I3).

**Exit criteria**

- [ ] The seven FEAT §23 stage values exist exactly as written, with disposition as a separate column, and only `lib/scraper/core/stage.ts` writes `stage`.
- [ ] No `research_*` table has an `anon` policy; no FK crosses the research/public boundary at the end of this phase — the guard's allowlist is empty here, gains its first entry in Phase 26 and its second and last in Phase 28; the isolation guard is wired into `npm run check` and fails on a violation.
- [ ] A source cannot be enabled without `policy_status = 'APPROVED'`, and approval is owner/admin only and flagged OWNER_VERIFICATION_REQUIRED.
- [ ] robots.txt is honoured, cached, and its `Crawl-delay` acts as a floor; a disallowed URL produces a logged decision and zero network requests.
- [ ] Rate limit, request delay, concurrency, `Retry-After` backoff and the circuit breaker are all enforced at lease time and proved against a fixture server.
- [ ] `research.enabled` stops every source immediately.
- [ ] A run survives function timeouts and cold starts, resumes on the next tick, and cannot be double-executed.
- [ ] Every fetch stores a hashed, gzipped snapshot with a 180-day retention job.
- [ ] No competitor image is downloaded or re-hosted; no Cloudinary write occurs from `lib/scraper/**`.
- [ ] `docs/architecture/SCRAPER.md` exists and states the posture, the prohibitions and the owner-verification requirement.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `DATA_MODEL.md`, `SECURITY.md`, `STUDIO_GUIDE.md`; tests run = four unit suites and two e2e specs; next phase = 26.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 26 — Comparator Source Management

**Goal** — adding a new competitor source becomes a Studio task rather than an engineering task.
`/studio/research/sources` becomes the complete FEAT §26 configuration surface: every one of the
twenty-three named fields is editable, validated, audited and consumed by the Phase 25 engine, with
URL patterns and category mapping as first-class child records rather than a JSON blob nobody can
review. A researcher can add a source, map its categories to Rivya's seven, describe its URL shapes,
test them without fetching anything disallowed, hand it to an owner for policy review, and enable it —
without a deploy.

**Depends on** — Phase 25 (core tables, engine, politeness controls, policy gate), 04 (`research.write`,
`system.settings.write`), 05 (`DataTable`, `DrawerForm`, `StatusPill`), 23 (`categories` search
provider for the mapping picker), 24 (bulk enable/disable of sources).

**Scope**

- **The twenty-three FEAT §26 fields, each with a home.** This table is the specification; the
  migration and the form are both generated from reading it.

  | # | FEAT §26 field | Storage | Type / validation |
  |---|---|---|---|
  | 1 | Name | `research_sources.name` | text, required, unique with `slug` |
  | 2 | Website | `research_sources.base_url` | absolute `https://` URL, host must match every URL pattern's host |
  | 3 | Region | `research_sources.region` | ISO-3166-1 alpha-2, or `GLOBAL` |
  | 4 | Currency | `research_sources.currency` | ISO-4217 alpha-3; the source's *stated* currency, never converted |
  | 5 | Source Type | `research_sources.source_type` | enum `BRAND · RETAILER · MARKETPLACE · GALLERY · ARTISAN · DIRECTORY` |
  | 6 | Analytics League | `research_sources.analytics_league` | enum `PEER · ASPIRATIONAL · ADJACENT · MASS`; drives grouping in Phase 31, never a public label |
  | 7 | Enabled | `research_sources.is_enabled` | bool; blocked unless `policy_status = 'APPROVED'` (Phase 25 constraint) |
  | 8 | Collection Mode | `research_sources.collection_mode` | enum `SITEMAP · CATEGORY_CRAWL · SEED_URLS · FEED`; determines which discovery strategy `lib/scraper/workflows/discover.ts` uses |
  | 9 | Category Mapping | `research_source_category_map` | child rows: source category label/path → Rivya `categories.id` or explicit `IGNORE` |
  | 10 | URL Patterns | `research_source_url_patterns` | child rows: `kind` (`PRODUCT · CATEGORY · EXCLUDE · PAGINATION`), `pattern`, `is_regex`, `priority` |
  | 11 | Extraction Adapter | `research_sources.adapter_key` | must resolve in the Phase 27 registry; validated on save |
  | 12 | Image Extraction | `research_sources.image_extraction_mode` | enum `NONE · URL_ONLY · URL_AND_DIMENSIONS`; **no mode downloads or re-hosts an image** |
  | 13 | Price Extraction | `research_sources.price_extraction` | jsonb: selector or JSON-LD path, currency override, decimal separator, thousands separator |
  | 14 | SKU Extraction | `research_sources.sku_extraction` | jsonb: selector/path plus an optional strip pattern |
  | 15 | Attribute Extraction | `research_sources.attribute_extraction` | jsonb: ordered list of `{ key, selector, kind }` for dimensions, materials, availability, lead time, variants, customization |
  | 16 | Rate Limit | `research_sources.rate_limit_rpm` | int 1–60; higher values rejected outright |
  | 17 | Request Delay | `research_sources.request_delay_ms` | int ≥ 1000; raised silently to the robots `Crawl-delay` floor |
  | 18 | Concurrency | `research_sources.concurrency` | int 1–4 |
  | 19 | Scheduling | `research_source_schedules` | child rows: `job_type`, `cron_expression`, `timezone`, `is_enabled`; minimum interval 6 hours |
  | 20 | Last Run | `research_source_health_v.last_run_at` | view column, derived from `research_runs` |
  | 21 | Health | `research_source_health_v.health` | view column: `HEALTHY · DEGRADED · FAILING · STALE · DISABLED` (rules below) |
  | 22 | Policy Review | `policy_status`, `policy_reviewed_by`, `policy_reviewed_at`, `policy_notes` | Phase 25 columns; the workflow is built here |
  | 23 | Notes | `research_sources.notes` | free text, staff-only, never rendered outside Studio |

- **Health is derived, never stored.** `research_source_health_v` computes, per source:
  `DISABLED` when `is_enabled = false`; `FAILING` when the last two runs failed or the circuit is
  open; `DEGRADED` when the last run is `PARTIAL` or the 7-day success rate is below 80 %;
  `STALE` when the newest successful run is older than twice the configured schedule interval;
  otherwise `HEALTHY`. A view cannot go stale the way a cached column can, and the rule is legible in
  SQL rather than buried in a worker.
- **URL pattern tester.** A `DRY_RUN` control that takes a list of candidate URLs the operator pastes
  in, and reports for each: which pattern matched, its kind, and the robots decision — **without
  making any request**, because robots is answered from `research_robots_cache`. A separate "probe one
  URL" action performs a single real fetch, is rate-limited like any other, refuses a disallowed path,
  and is audited.
- **Category mapping editor.** Two columns: source categories observed in `research_raw_items` (once
  Phase 27 populates them) or typed by hand, mapped to one of Rivya's seven D3 categories or to
  `IGNORE`. Unmapped source categories are surfaced as a count on the dashboard so the gap is visible;
  Phase 28 leaves those rows unmatched rather than guessing.
- **Adapter selection.** A picker listing every adapter the Phase 27 registry exports, with its
  version and its declared capabilities. Selecting an adapter whose `supports()` rejects the source's
  `base_url` shows a warning and requires an explicit override tick that is recorded in the audit row.
  `generic` is always available.
- **Policy review workflow.** A researcher prepares a source and marks it *Ready for review*. An owner
  or admin sees a review panel with the site's robots.txt (rendered from cache), the URL patterns, the
  extraction configuration and a mandatory notes field, then sets `APPROVED`, `RESTRICTED` (approved
  but limited to specific patterns) or `BLOCKED`. Every transition writes an `audit_logs` row. The
  panel carries the standing **OWNER_VERIFICATION_REQUIRED** banner: this repository cannot determine
  what a third party's terms permit.
- **Zero seeded sources.** No competitor name, domain, region or currency is invented. The sources
  list ships empty with an `EmptyState` explaining that a source must be added and policy-reviewed
  before anything can run.
- **Search providers.** Registers the `research_source` documents in `research_search_documents` so
  Studio search (Phase 23) can find a source by name or host — under `research.read`, never public.

**Out of scope**

- Writing adapters (Phase 27). This phase selects and configures them; it does not implement one.
- Any normalization of the values these fields configure (Phase 28).
- Automatic source discovery, competitor suggestion, or importing a source list from anywhere. A
  human adds a source, deliberately.
- Per-source cost tracking, quota purchase or third-party scraping-API integration.
- Publishing anything about a source. Names, notes and league classifications are staff-only forever.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0240_phase26_source_config.sql` | Source columns + three child tables + health view |
| Source schema | `lib/scraper/core/source-schema.ts` | Zod for all 23 fields, including the jsonb extraction shapes |
| Pattern matcher | `lib/scraper/core/url-patterns.ts` | Glob and regex, priority ordering, `EXCLUDE` wins |
| Category mapping | `lib/scraper/core/category-map.ts` | Source label → `categories.id` or `IGNORE`; unmapped is a first-class result |
| Health view + reader | `lib/supabase/repositories/research/source-health.ts` | Reads `research_source_health_v` |
| Sources surface | `app/(studio)/studio/research/sources/**` | List, create, edit, mapping editor, pattern tester, policy panel |
| Pattern tester action | `app/(studio)/studio/research/sources/[id]/actions.ts` | `testPatterns` (no network), `probeUrl` (one audited fetch) |
| Adapter picker | `components/studio/research/AdapterPicker.tsx` | Reads the Phase 27 registry; version + capabilities |
| Policy panel | `components/studio/research/PolicyReviewPanel.tsx` | robots.txt render, notes, three-way decision, OVR banner |
| Search provider | `components/studio/command/providers/research-sources.ts` | Indexes into `research_search_documents`; FEAT §18's *Competitor Sources* group |
| Isolation guard | `scripts/research/check-research-isolation.mjs` | Allowlist entry 1: `research_source_category_map.category_id`, by constraint name. Exactly one entry at the end of this phase |
| Tests | `tests/unit/{source-schema,url-patterns,category-map,source-health}.test.ts`, `tests/e2e/{research-sources-crud,research-policy-review}.spec.ts` | Validation, matching, health rules, workflow |
| Docs | `docs/architecture/SCRAPER.md` (source configuration chapter), `docs/architecture/DATA_MODEL.md`, `docs/studio/STUDIO_GUIDE.md` | The field table above is copied into `SCRAPER.md` verbatim |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `research_sources` (altered) | `+ analytics_league`, `+ collection_mode`, `+ image_extraction_mode`, `+ price_extraction jsonb`, `+ sku_extraction jsonb`, `+ attribute_extraction jsonb`, `+ notes text`, `+ readiness text check (readiness in ('DRAFT','READY_FOR_REVIEW','REVIEWED'))` | Four new enums: `research_source_type`, `research_analytics_league`, `research_collection_mode`, `research_image_extraction_mode` |
| `research_source_url_patterns` | `id`, `source_id`, `kind text check (kind in ('PRODUCT','CATEGORY','EXCLUDE','PAGINATION'))`, `pattern text not null`, `is_regex bool default false`, `priority int default 0`, `notes text`, plus D5 common set | `unique (source_id, kind, pattern)`; a regex is compiled and length-capped on save |
| `research_source_category_map` | `id`, `source_id`, `source_label text not null`, `source_path text`, `category_id uuid references categories`, `is_ignored bool default false`, plus D5 common set | `check (category_id is not null or is_ignored)`; `unique (source_id, source_label)`. **This is the first of exactly two references from a `research_*` table to a public table, and both are deliberate**: see the note below |
| `research_source_schedules` | `id`, `source_id`, `job_type research_job_type`, `cron_expression text`, `timezone text default 'UTC'`, `is_enabled bool default false`, `next_run_at`, plus D5 common set | `check` rejecting an interval shorter than 6 hours |
| `research_source_health_v` | View: `source_id`, `last_run_at`, `last_run_status`, `success_rate_7d`, `queue_depth`, `health text` | Derived only; no writes |

**Note on I1 and `research_source_category_map.category_id`.** D5 says scraped data never joins
directly to public product tables. A *category mapping* is configuration written by a member of staff,
not scraped data, and it points at taxonomy rather than at `products`. The exception is therefore
narrow and explicit: `category_id` references `categories` with `on delete set null`, and it is one of
exactly two such references permitted anywhere in the research schema — the other being
`research_products.matched_category_id`, added in Phase 28 on the same reasoning.
`check-research-isolation.mjs` gains its **first** allowlist entry here, naming this constraint, and
fails on any other; Phase 28 adds the **second and final** entry. There is never a third.

D5 itself still reads "scraped data … never joins directly to public product tables" and carries no
amendment for either reference. This phase is therefore blocked on one of two owner decisions, recorded
as *Open question 4*: append a dated amendment (A2) to `CANONICAL-DECISIONS.md` recording the narrow
taxonomy exception, or direct the alternative — store the category *slug* as text on both tables,
losing referential integrity and keeping the allowlist empty. The document does not choose
unilaterally, and both Phase 26 and Phase 28 carry the decision as an exit criterion.

**Studio surface** — **fills** `/studio/research/sources` (list with health and last-run columns,
create/edit drawer covering all 23 fields, category-mapping editor, URL-pattern editor and tester,
schedule editor, policy-review panel, enable/disable with the constraint's reason shown when refused).
**Extends** `/studio/research/dashboard` with per-source health tiles and an unmapped-category count.

**Public surface** — **None.**

**Media** — **None.** `image_extraction_mode` never downloads. Its most permissive value,
`URL_AND_DIMENSIONS`, stores a URL string and two integers.

**Risks**

| Risk | Mitigation |
|---|---|
| Configuration becomes an unreviewable JSON blob | URL patterns, category mappings and schedules are child tables with their own rows, constraints and audit trail; only the three extraction configs remain jsonb, each with a Zod schema and a rendered form |
| A regex pattern causes catastrophic backtracking during a run | Patterns are length-capped at 200 characters, compiled on save with a rejection on failure, and matched with a per-URL time budget; the default is glob, not regex |
| A source is enabled before policy review | The Phase 25 check constraint refuses it at the database, and the Studio control is disabled with the reason shown |
| The engine is edited every time a source is added — the exact thing FEAT §26 forbids | Every behavioural difference between sources is a column or a child row, never a branch in `lib/scraper/core/**`; `tests/e2e/research-sources-crud.spec.ts` adds a complete second source through the UI only, with zero code changes |
| Health becomes a stale cached column that lies | Health is a SQL view computed on read |
| A category mapping silently guesses | An unmapped source category is `null`, counted on the dashboard, and left unmatched by Phase 28 — never defaulted to `furniture` or to the first category |
| Extraction configuration leaks into public code | `check-research-isolation.mjs` (I3); the config is read only inside `lib/scraper/**` |

**Verification**

1. `npm run db:migrate` — `0240` applies; `npm run db:types` produces no diff.
2. `npm run test:unit -- source-schema url-patterns category-map source-health` — green; `url-patterns` covers `EXCLUDE` beating `PRODUCT`, priority ordering, glob vs regex, and a host mismatch against `base_url`.
3. `npx playwright test tests/e2e/research-sources-crud.spec.ts` — as `researcher`, create a source filling all 23 fields, add three URL patterns, map four source categories (one to `IGNORE`), add a 12-hour schedule, and save. Assert **zero** source files changed (`git status --porcelain` is empty in the test's repo check).
4. Attempt to enable the new source while `policy_status = 'UNREVIEWED'` → the control is disabled; a direct server-action POST returns a permission/constraint error and writes an `audit_logs` row with `result = 'DENIED'`.
5. `npx playwright test tests/e2e/research-policy-review.spec.ts` — as `admin`, open the policy panel, see the cached robots.txt rendered, submit `APPROVED` with notes; assert `policy_reviewed_by`/`_at` set and an audit row written. As `researcher`, the same control is absent and a direct POST is refused.
6. Paste 20 candidate URLs into the pattern tester → per-URL match and robots decision returned; assert the fixture server logged **zero** requests. Then use "probe one URL" on a disallowed path → refused before any request, with the reason shown.
7. `psql -c "select health from research_source_health_v;"` after forcing two failed runs → `FAILING`; after a successful run → `HEALTHY`; after ageing the last success beyond twice the interval → `STALE`.
8. `psql -c "insert into research_source_schedules (source_id, job_type, cron_expression) values (…, 'REFRESH', '*/5 * * * *');"` → rejected by the minimum-interval check.
9. `node scripts/research/check-research-isolation.mjs` → exits 0 with exactly one allowlisted FK (Phase 28 adds the second and last); add an FK from any research table to `products` and confirm it exits non-zero.
10. `select count(*) from research_sources;` on a freshly seeded database → `0`.

**Exit criteria**

- [ ] All twenty-three FEAT §26 fields are stored, validated, editable in Studio and consumed by the Phase 25 engine.
- [ ] URL patterns, category mappings and schedules are child tables with constraints, not blobs.
- [ ] A complete new source can be added through the UI with zero code changes, proved in e2e.
- [ ] Health is a view with the five documented states and cannot be stale.
- [ ] The pattern tester makes no network request; the single-URL probe is rate-limited, robots-checked and audited.
- [ ] Policy review is owner/admin only, records reviewer, timestamp and notes, is audited, and carries the OWNER_VERIFICATION_REQUIRED banner.
- [ ] No source is seeded; no competitor name or domain appears anywhere in the repository.
- [ ] `research_source_category_map.category_id` is the only research→public foreign key at the end of Phase 26 and is allowlisted by constraint name in the isolation guard; Phase 28 adds the second and final one.
- [ ] The D5 question is settled before `0240` ships: `CANONICAL-DECISIONS.md` carries a dated amendment recording the taxonomy exception, **or** the mapping stores the category slug as text and the guard's allowlist stays empty (*Open question 4*).
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `DATA_MODEL.md`, `STUDIO_GUIDE.md`; tests run = four unit suites and two e2e specs; next phase = 27.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 27 — Scraper Extraction

**Goal** — the pipeline starts producing structured rows. Phase 27 implements the FEAT §27 adapter
architecture: a narrow contract, a versioned registry, a `generic` adapter that gets a useful result
from any site publishing schema.org product data, and per-source vendor adapters that can be added
without touching the core. The phase's defining constraint is the one FEAT §27 states outright — **a
broken source adapter must not break other sources** — so isolation is built as an execution boundary
with its own status record, not as a hope that nothing throws.

**Depends on** — Phase 25 (fetcher, queue, snapshots, stage machine, `research_raw_items`,
`research_products`), 26 (adapter selection, URL patterns, extraction configuration).

**Scope**

- **The adapter contract, and it is deliberately small.**

  ```ts
  export interface SourceAdapter {
    readonly key: string;                    // 'generic' | vendor key
    readonly version: string;                // semver; recorded on every row it produces
    readonly capabilities: AdapterCapability[]; // 'DISCOVER' | 'EXTRACT' | 'PAGINATE'
    supports(source: ResearchSource): boolean;
    discover(ctx: AdapterContext, page: FetchedPage): Promise<DiscoveredUrl[]>;
    extract(ctx: AdapterContext, page: FetchedPage): Promise<RawProductDraft>;
  }
  ```

  `AdapterContext` exposes the source configuration, the URL-pattern matcher and a logger — and
  **nothing else**. It carries no database handle, no `fetch`, no file-system access and no
  Cloudinary client. An adapter is a pure function from bytes to a draft; every side effect belongs to
  the core. This is what makes an adapter safe to accept, cheap to test and impossible to misuse.
- **`RawProductDraft` is raw on purpose.** Every field is the source's own string: `title`,
  `priceText`, `currencyText`, `skuText`, `availabilityText`, `leadTimeText`, `descriptionHtml`,
  `dimensionTexts: string[]`, `materialTexts: string[]`, `variantTexts: string[]`,
  `customizationTexts: string[]`, `imageUrls: string[]`, `categoryLabels: string[]`,
  `externalId`, `canonicalUrl`, plus `confidence: Record<field, 0|1>` recording which fields were
  actually found rather than defaulted. **An adapter never parses a number, converts a unit, resolves
  a currency or maps a category** — Phase 28 does all four, and keeping them out of adapters is what
  makes a vendor adapter reviewable in ten minutes.
- **The `generic` adapter.** Extraction order, first hit wins per field: JSON-LD `Product` (including
  `@graph` and arrays), then microdata `itemtype="…/Product"`, then RDFa, then OpenGraph
  (`og:title`, `product:price:amount`), then the source's configured selectors from
  `price_extraction` / `sku_extraction` / `attribute_extraction`, then `<title>` and `<h1>` as a last
  resort. Every field records which strategy produced it in `raw.provenance`, so a wrong value can be
  traced to a rule rather than guessed at.
- **Vendor adapters.** `lib/scraper/adapters/source-a/` and `source-b/` exist as the FEAT §27 folder
  shape with the `generic` adapter's behaviour plus a `supports()` that matches nothing, and a README
  explaining how to fill them. **They are placeholders named exactly as the requirement writes them,
  not real vendors** — no competitor is named anywhere in this repository (D10). A real vendor adapter
  is added by the owner after that source has passed policy review.
- **Failure isolation, four layers.**

  | Layer | Behaviour |
  |---|---|
  | Per item | `extract()` runs inside a try/catch with a 5-second CPU budget. A throw, a timeout or a Zod failure marks that work item `FAILED` with the error, and the drain loop continues to the next item |
  | Per source, per run | `research_adapter_runs` records one row per (run, source, adapter). Ten consecutive item failures for one source stop **that source's** items for the rest of the run and set `status = 'ABORTED'` |
  | Per source, across runs | Three consecutive `ABORTED` adapter runs set the source's `circuit_open_until` (Phase 25) and raise a `WARNING` system log naming the adapter and version |
  | Cross-source | Every source's items are leased and executed independently. A test proves that with adapter A throwing on every item, source B's run still reaches `SUCCEEDED` |

- **Versioning and provenance.** `adapter_key` and `adapter_version` are written on every
  `research_raw_items` and `research_product_versions` row. Changing an adapter's output shape is a
  minor version bump; re-extraction of stored snapshots under a new version is an explicit
  `REFRESH` job, never automatic, so a version change cannot silently rewrite history.
- **Versions, not overwrites.** `research_product_versions` stores one row per (product, run) whose
  content hash differs from the previous version, holding the `RawProductDraft` as `raw jsonb`, the
  snapshot's `storage_key`, `content_hash`, `adapter_key`, `adapter_version` and `observed_at`.
  `research_products.current_version_id` points at the newest. This table is the substrate Phase 29
  diffs; without it change detection would be comparing against a mutated row.
- **Re-extraction from snapshots.** `scripts/research/reextract.ts --source=<slug> --since=<date>`
  re-runs an adapter against stored snapshots with **zero network traffic**, producing new versions.
  This is how an adapter fix is validated against real historical pages before it is enabled.
- **Golden fixtures and contract tests.** `tests/fixtures/scraper/<adapter>/<case>.html` plus an
  expected `RawProductDraft` JSON. `tests/unit/adapter-contract.test.ts` runs every registered adapter
  through a shared suite: `supports()` is pure, `extract()` never throws on malformed input (it
  returns a draft with low confidence), no adapter imports `node:fs`, `lib/supabase/**` or any HTTP
  client, and every adapter has at least three fixtures.
- **Run detail surface.** `/studio/research/runs/[id]` gains per-source adapter panels: items seen,
  extracted, failed, aborted; the first five errors with their URLs; and a per-item drawer showing the
  extracted draft beside the stored snapshot, so a merchandiser can see exactly what the adapter read.

**Out of scope**

- Normalization, unit parsing, currency resolution, category matching, deduplication and validation
  (Phase 28). Adapters emit strings.
- Change detection and diffing (Phase 29), even though `research_product_versions` lands here.
- Any real vendor adapter. `source-a` and `source-b` remain the requirement's placeholder names.
- Headless browsers, JavaScript execution, DOM emulation beyond an HTML parser, and any technique
  intended to defeat a bot defence (Phase 25 posture, permanent).
- Downloading, caching, re-hosting or transforming any competitor image. `imageUrls` are strings.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0250_phase27_extraction.sql` | `research_product_versions`, `research_adapter_runs`, `current_version_id` FK |
| Contract | `lib/scraper/adapters/types.ts` | `SourceAdapter`, `AdapterContext`, `FetchedPage`, `DiscoveredUrl` |
| Draft schema | `lib/scraper/adapters/draft-schema.ts` | Zod `RawProductDraft`; every field optional, all strings |
| Registry | `lib/scraper/adapters/registry.ts` | Key → adapter; version reporting; used by the Phase 26 picker |
| Generic adapter | `lib/scraper/adapters/generic/{index.ts,jsonld.ts,microdata.ts,opengraph.ts,selectors.ts}` | Strategy order + provenance |
| Placeholder adapters | `lib/scraper/adapters/{source-a,source-b}/{index.ts,README.md}` | FEAT §27 folder shape; `supports()` returns false |
| Isolation boundary | `lib/scraper/core/run-adapter.ts` | try/catch, CPU budget, per-source abort, adapter-run record |
| Extraction workflow | `lib/scraper/workflows/extract.ts` | Item → adapter → draft → version → `research_products` at `RAW` |
| Re-extraction script | `scripts/research/reextract.ts` | Snapshot-only; no network; `--dry-run` |
| Run detail UI | `app/(studio)/studio/research/runs/[id]/**` | Per-source panels, error list, draft/snapshot drawer |
| Fixtures | `tests/fixtures/scraper/**` | ≥ 3 per adapter, including a malformed page |
| Tests | `tests/unit/{adapter-contract,generic-jsonld,generic-fallbacks,adapter-isolation,version-hashing}.test.ts`, `tests/e2e/research-run-detail.spec.ts` | Contract, strategies, isolation, versioning |
| Docs | `docs/architecture/SCRAPER.md` (adapter chapter, including "how to write an adapter"), `docs/architecture/DATA_MODEL.md` | |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `research_product_versions` | `id`, `research_product_id not null references research_products on delete cascade`, `run_id`, `fetch_id`, `raw jsonb not null`, `content_hash text not null`, `storage_key text`, `adapter_key text`, `adapter_version text`, `observed_at timestamptz default now()`, `normalized jsonb` (written by Phase 28) | `unique (research_product_id, content_hash)` — an unchanged page produces no new version; index `(research_product_id, observed_at desc)` |
| `research_adapter_runs` | `id`, `run_id`, `source_id`, `adapter_key`, `adapter_version`, `status text check (status in ('OK','PARTIAL','ABORTED','FAILED'))`, `items_seen int`, `items_extracted int`, `items_failed int`, `first_errors jsonb default '[]'`, `duration_ms int`, `started_at`, `finished_at` | `unique (run_id, source_id, adapter_key)`; the unit of blast-radius accounting |
| `research_products` (altered) | `+ current_version_id uuid references research_product_versions on delete set null` | Set by `extract.ts` after a new version is written |

RLS unchanged from Phase 25: `research.read` to select, `research.write` or service role to write, no
`anon` policy.

**Studio surface** — **fills** `/studio/research/runs/[id]` (per-source adapter panels, error lists,
draft/snapshot drawer). **Extends** `/studio/research/sources` with each source's live adapter status
and version. No new D4 leaf.

**Public surface** — **None.**

**Media** — **None.** `RawProductDraft.imageUrls` holds strings. Nothing is fetched, stored,
transformed or written to `media_assets` or Cloudinary.

**Risks**

| Risk | Mitigation |
|---|---|
| One malformed page or one bad adapter kills an entire nightly run across all sources | Four isolation layers with their own records; `tests/unit/adapter-isolation.test.ts` runs two sources where adapter A throws on every item and asserts source B completes `SUCCEEDED` with its full item count |
| An adapter gains a database handle or a `fetch` and becomes untestable | `AdapterContext` exposes neither; `adapter-contract.test.ts` fails any adapter importing `lib/supabase/**`, `node:fs`, `undici`, `axios` or `node-fetch` |
| Adapters start parsing prices and units, and normalization ends up in two places | `RawProductDraft` types every extracted field as `string`; a numeric field in a draft fails the Zod schema |
| An adapter version bump silently rewrites stored data | Versions are append-only and keyed by content hash; re-extraction is an explicit `REFRESH` job or the offline script, and both write new versions rather than mutating old ones |
| Regex-based HTML parsing produces silent nonsense | Parsing uses a real HTML parser; every field records its provenance strategy; low-confidence fields are visible in the run detail drawer |
| A real competitor name lands in `source-a` and enters the repository | The placeholders' `supports()` returns false and their READMEs state the rule; a CI grep in `check-research-isolation.mjs` fails on any hard-coded external host inside `lib/scraper/adapters/**` |
| Snapshot re-extraction hits the network by accident | `reextract.ts` runs with the fetcher module unavailable (injected null) and a unit test asserts a network attempt throws |

**Verification**

1. `npm run db:migrate` — `0250` applies; types regenerate with no diff.
2. `npm run test:unit -- adapter-contract generic-jsonld generic-fallbacks adapter-isolation version-hashing` — green.
3. Point a fixture source at a local server serving a JSON-LD product page. Run a `DETAIL` job → one `research_products` row at stage `RAW`, one `research_product_versions` row, `adapter_key='generic'`, `adapter_version` recorded, `raw.provenance.title = 'jsonld'`.
4. Re-run the same job with the page unchanged → **no** new version row (content hash equal), `last_seen_at` updated, `research_adapter_runs.items_extracted` still counts the item.
5. Change one price digit in the fixture and re-run → exactly one new version row; `current_version_id` advances.
6. Serve a page with no JSON-LD but OpenGraph tags → the draft is produced with `provenance.title = 'opengraph'` and `confidence.priceText = 1`. Serve a page of broken HTML → a draft with low confidence and **no throw**.
7. `npx playwright test tests/e2e/research-run-detail.spec.ts` — two sources, adapter A throwing on every item: source A's panel shows `ABORTED` with ten failures and the first five errors; source B's panel shows `OK` with its full count; the run is `PARTIAL`, not `FAILED`.
8. Trip the same source three runs in a row → `circuit_open_until` set, a `WARNING` system log written naming adapter and version, and the next scheduled run performs zero fetches for that source only.
9. `node scripts/research/reextract.ts --source=fixture --since=2026-01-01 --dry-run` → reports the version count it would produce, with the fixture server's request log empty.
10. `grep -rEn "https?://(?!localhost|127\.0\.0\.1)" lib/scraper/adapters` → no matches.

**Exit criteria**

- [ ] The `SourceAdapter` contract exists exactly as specified, and `AdapterContext` grants no database, network or file-system access.
- [ ] `RawProductDraft` is strings-only; a parsed number in a draft fails validation.
- [ ] The `generic` adapter extracts from JSON-LD, microdata, RDFa, OpenGraph and configured selectors, recording provenance per field.
- [ ] `source-a` and `source-b` exist as placeholder folders per FEAT §27, with `supports()` false and no external host hard-coded anywhere in `lib/scraper/adapters/**`.
- [ ] A throwing adapter fails only its own items, then only its own source's run, then only its own source across runs — proved in a two-source e2e test.
- [ ] `research_product_versions` is append-only, deduplicated by content hash, and stamped with adapter key and version.
- [ ] Snapshot re-extraction runs with zero network traffic and writes new versions rather than mutating old ones.
- [ ] Every registered adapter has ≥ 3 golden fixtures including a malformed page, and passes the shared contract suite.
- [ ] No competitor image is fetched or stored; `imageUrls` remain strings.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `DATA_MODEL.md`; tests run = five unit suites and one e2e spec; next phase = 28.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 28 — Normalization + Validation

**Goal** — the strings Phase 27 extracted become comparable data, and the data is judged before it is
trusted. This phase implements three of the seven FEAT §23 stages: `NORMALIZED` (currency, units,
dimensions, availability and materials parsed into canonical types), `VALIDATED` (the FEAT §21
data-quality checks applied to scraped rows) and `MATCHED` (duplicate detection within a source, and
mapping to Rivya's taxonomy through the Phase 26 category map). Its governing principle is that a
value Rivya could not parse is recorded as *unparsed*, never as a guess — because every downstream
comparison, opportunity score and large-format decision inherits that first judgement.

**Depends on** — Phase 26 (category map, currency and extraction configuration), 27
(`research_product_versions`, drafts, provenance), 14 (`lib/catalog/validation.ts`, whose FEAT §21
rules are reused rather than re-derived), 23 (`research_search_documents` and the index-trigger
pattern, reused here for the *Scraped Products* provider).

**Scope**

- **Normalization is a pure module.** `lib/scraper/normalization/` takes a `RawProductDraft` plus its
  source configuration and returns a `NormalizedProduct` with a per-field `parse_state` of
  `PARSED · AMBIGUOUS · UNPARSED · ABSENT`. It performs no I/O and no database access, so every rule
  is unit-testable against a fixture table.
- **Currency.** The source's declared ISO-4217 currency is the default; a symbol or code in
  `priceText` overrides it only when unambiguous (`€`, `£`, `USD`); `$` alone is **ambiguous** and
  records `AMBIGUOUS` rather than assuming a country. Amounts are parsed to integer **minor units**
  with the source's configured decimal and thousands separators, so `1.234,56` and `1,234.56` both
  become `123456`. **No foreign-exchange conversion is ever performed**: comparing a price across
  currencies needs a dated rate Rivya does not hold, so Phase 31 compares within a currency and says
  so. A price range (`from X to Y`) stores `price_min_minor` and `price_max_minor` and sets
  `price_state = 'STARTING_FROM'`.
- **Price state mirrors the first-party vocabulary.** `FIXED · STARTING_FROM · REQUEST_QUOTE ·
  PRICE_ON_REQUEST · UNKNOWN`. Text such as "price on request", "enquire", "POA" maps to a quote
  state. **A quote-only row is never stored as `0`** — the same FEAT §21 rule that governs Rivya's own
  products, applied here as a database check.
- **Units and dimensions.** `parseDimensions()` handles the shapes a furniture site actually uses,
  and each returns millimetres as `integer` plus the original string:

  | Input shape | Example | Result |
  |---|---|---|
  | Triple with unit | `120 x 60 x 45 cm` | `{ length_mm: 1200, width_mm: 600, height_mm: 450 }` |
  | Labelled | `W 120cm · D 60cm · H 45cm` | labels win over position |
  | Imperial | `47" x 24" x 18"` | `25.4 mm/in`, rounded to the nearest mm |
  | Feet + inches | `4' 6"` | `1372` |
  | Diameter | `Ø 90 cm`, `dia. 90cm` | `{ diameter_mm: 900 }` |
  | Range | `120–140 cm` | `{ length_mm: 1200, length_mm_max: 1400 }`, `parse_state = 'PARSED'` |
  | Unitless | `120 x 60` | `AMBIGUOUS` — no unit is inferred from magnitude |
  | Prose | `seats six comfortably` | `UNPARSED`; the original string is retained |
  | Out of range | `1 200 x 60 x 45 cm` (12 000 mm) or `4 x 3 mm` | `UNPARSED`; `dimensions_mm` left null, the original string retained, `impossible_dimension` raised — an out-of-range value is never written |

  Canonical storage is millimetres for length and grams for mass. **Positional order is never assumed
  when labels are absent and the source has no configured order** — that case is `AMBIGUOUS`.
- **Materials, availability, lead time, variants, customization.** Each is normalised to a controlled
  token set plus the retained original text: materials against a keyword lexicon
  (`lib/scraper/normalization/lexicon.ts`) producing tokens like `oak`, `walnut`, `epoxy_resin`,
  `brass`; availability to `IN_STOCK · MADE_TO_ORDER · PREORDER · SOLD_OUT · UNKNOWN`; lead time to a
  day range where a number and a unit are both present, otherwise `UNPARSED`. The lexicon is data, not
  code, and is editable in Studio under `/studio/operations/data-quality`.
- **Validation applies FEAT §21 to scraped rows.** Every check produces a
  `research_validation_issues` row with `rule`, `severity` (`ERROR · WARNING · INFO`), `field` and
  `detail`. The rules, and what each does to the row:

  | Rule | Severity | Effect |
  |---|---|---|
  | `missing_title` | ERROR | Blocks promotion past `VALIDATED` |
  | `malformed_source_url` / `non_https_url` | ERROR | Blocks; the row is quarantined |
  | `price_quote_with_amount` (quote state carrying a number) | ERROR | Blocks — the mirror of the Rivya constraint |
  | `price_zero_or_negative` | ERROR | Blocks |
  | `impossible_dimension` (any axis < 10 mm or > 10 000 mm) | ERROR | Blocks. The normalizer writes `dimensions_mm = null` and `dimension_parse_state = 'UNPARSED'`, keeps the original string, and attaches the issue — so the row is retained and flagged, never refused by the database |
  | `dimension_ambiguous` | WARNING | Promotes, flagged; excluded from Phase 30's scale bands |
  | `currency_ambiguous` | WARNING | Promotes, flagged; excluded from price comparisons |
  | `duplicate_source_url_within_source` | ERROR | Blocks; the older row wins |
  | `missing_category_mapping` | WARNING | Promotes to `VALIDATED`, but never to `MATCHED` |
  | `image_url_unreachable_shape` | INFO | Informational only; no request is made to check |
  | `low_confidence_extraction` (< 3 fields with confidence 1) | WARNING | Promotes, flagged for review |

  A blocked row **stays at `VALIDATED` with `ERROR` issues attached** and is listed in the explorer's
  Issues view. It is never silently dropped, never deleted, and never quietly promoted on a later run
  unless the issue clears.

  **Where each rule is enforced, so that no rule is unreachable.** Every rule above is evaluated in
  `lib/scraper/validation/rules.ts` *before* the write, and the database constraints below are
  backstops against a hand-written `UPDATE`, not the enforcement point. `impossible_dimension` is the
  case where that distinction matters: `research_dimensions_sane` would refuse an out-of-range value
  outright and the normalizer would raise a database error instead of persisting a flagged row, so the
  normalizer never offers one — it nulls `dimensions_mm`, sets `dimension_parse_state = 'UNPARSED'`,
  retains the source string (which survives untouched in the version's `raw` regardless), and attaches
  the `ERROR`. The same holds against `research_price_state_coherent`: a quote state carrying an amount
  is written as the quote state with `price_min_minor`/`price_max_minor` null and
  `price_quote_with_amount` attached, and a zero or negative amount is written as
  `price_state = 'UNKNOWN'` with both amounts null and `price_zero_or_negative` attached. The extracted
  text survives untouched in the version's `raw` either way, so nothing is lost by refusing to store a
  value the row is not allowed to hold.
- **Matching.** Two independent jobs, both producing candidates rather than verdicts:
  1. *Duplicate detection within a source* — exact `source_external_id`, then exact normalised title +
     price, then trigram similarity on the normalised title above 0.85 combined with a dimension match
     within 5 %. A duplicate sets `duplicate_of_id` and `disposition = 'DUPLICATE'` only at
     confidence ≥ 0.95; anything lower becomes a `research_match_candidates` row for human review.
  2. *Taxonomy mapping* — `research_source_category_map` first (deterministic, human-authored), then a
     keyword rule against the category label. `matched_category_id`, `match_confidence` and
     `match_method` (`MAP · KEYWORD · MANUAL`) are recorded. **No mapping means no match**: the row
     stops at `VALIDATED`.
  Cross-source duplicate detection is deliberately out of scope; two sources listing similar objects
  is a comparison question (Phase 31), not a deduplication one.
- **Editor override is always available, always recorded, and split by column.** Under `research.write`
  a researcher can set `matched_category_id`, edit any normalised value, and dismiss a validation issue
  with a reason. Marking a row as a duplicate by hand, or clearing a duplicate flag, writes
  `disposition` and `duplicate_of_id` and is therefore a `research.confirm` action — a merchandiser's,
  not a researcher's — as is deciding a `research_match_candidates` row, because accepting one writes
  both columns. Every override, either side of that line, writes `override_by`, `override_at` and a
  `research_pipeline_events` row, and an overridden field is **never** recomputed by a later run —
  `normalized_overrides jsonb` records which keys are frozen.
- **Re-normalization without re-fetching.** `scripts/research/renormalize.ts --source=<slug>` re-runs
  the normalizer over stored versions with zero network traffic, respecting frozen override keys and
  reporting what changed. This is how a lexicon or parser fix is rolled out.
- **Explorer.** `/studio/research/explorer` becomes the working surface: filter by source, stage,
  disposition, issue severity, category, price state, currency and parse state; per-row drawer showing
  raw text beside normalised value beside the provenance strategy, with inline override controls.
- **Scraped products enter Studio search.** FEAT §18 lists *Scraped Products* among the twelve Studio
  search scopes, and this is the first phase in which a research row has a title worth indexing. An
  `after insert or update or delete` trigger on `research_products`, added in `0260` and following the
  Phase 23 pattern (`security definer`, one document row per entity), calls
  `refresh_research_search_document('research_product', id)` and writes one `research_search_documents`
  row with `visibility = 'STAFF'`, `title = coalesce(title_normalized, <current version's raw title>)`,
  `subtitle` = the source name, `status` = the row's `research_stage`, `keywords` = `material_tokens`
  plus `category_labels`, and `url_path = '/studio/research/explorer?row=<id>'`. The provider
  `components/studio/command/providers/research-products.ts` declares `research.read`, so the group is
  absent for `editor` — the only role without it. Nothing here becomes public: `research_search_documents`
  has no `anon` policy (I2) and the public `search_documents` cannot hold a research row by constraint
  (Phase 23).
- **Data-quality surface.** `/studio/operations/data-quality` gains a **Research** tab: issue counts by
  rule and severity, unmapped-category counts, parse-failure rates per source and per field, and the
  material lexicon editor. If an earlier phase already filled a Products tab on that page, this phase
  adds a tab beside it rather than replacing the page.

**Out of scope**

- Change detection and diffing between versions (Phase 29) — this phase normalizes each version, it
  does not compare them.
- Cross-source deduplication, price-architecture analysis and any comparison chart (Phase 31).
- Opportunity scoring (Phase 32) and visual similarity (Phase 33).
- Currency conversion, in any phase, without a dated rate source and an owner decision.
- Inferring a unit from a number's magnitude, a category from a price, or a material from an image.
- Any write to Rivya `products` (I4).

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0260_phase28_normalization.sql` | Normalised columns, issues, match candidates, lexicon, and the `research_search_documents` upsert trigger for `research_products` |
| Normalizer | `lib/scraper/normalization/{index.ts,currency.ts,units.ts,dimensions.ts,materials.ts,availability.ts,lexicon.ts}` | Pure; no I/O |
| Normalized schema | `lib/scraper/normalization/schema.ts` | Zod `NormalizedProduct` with per-field `parse_state` |
| Validators | `lib/scraper/validation/{rules.ts,run.ts}` | The eleven rules above; shares FEAT §21 predicates with `lib/catalog/validation.ts` |
| Matcher | `lib/scraper/workflows/match.ts` | Duplicate detection + taxonomy mapping; candidates, not verdicts |
| Stage workflow | `lib/scraper/workflows/promote.ts` | `RAW → NORMALIZED → VALIDATED → MATCHED`, one stage per pass, all events recorded |
| Re-normalization | `scripts/research/renormalize.ts` | Offline; respects frozen overrides; `--dry-run` |
| Explorer | `app/(studio)/studio/research/explorer/**` | Fills the D4 leaf |
| Data-quality tab | `app/(studio)/studio/operations/data-quality/**` | Research tab + lexicon editor |
| Search provider | `components/studio/command/providers/research-products.ts` | FEAT §18's *Scraped Products* group; declares `research.read`; reads `research_search_documents` |
| Isolation guard | `scripts/research/check-research-isolation.mjs` | Allowlist entry 2: `research_products.matched_category_id`, by constraint name. Exactly two entries after this phase; a third fails the guard and `npm run check` |
| Tests | `tests/unit/{normalize-currency,normalize-dimensions,normalize-materials,validation-rules,match-duplicates,renormalize-overrides}.test.ts`, `tests/e2e/research-explorer.spec.ts` | Fixture-table driven; the e2e spec also covers the *Scraped Products* palette group and its absence for `editor` |
| Docs | `docs/architecture/SCRAPER.md` (normalization + validation chapters incl. the dimension table), `docs/architecture/DATA_MODEL.md`, `docs/studio/STUDIO_GUIDE.md` | |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `research_products` (altered) | `+ title_normalized text`, `+ brand_text text`, `+ currency char(3)`, `+ price_state text`, `+ price_min_minor bigint`, `+ price_max_minor bigint`, `+ dimensions_mm jsonb`, `+ dimension_parse_state text`, `+ material_tokens text[]`, `+ availability text`, `+ lead_time_days_min int`, `+ lead_time_days_max int`, `+ variant_count int`, `+ image_urls text[]`, `+ category_labels text[]`, `+ matched_category_id uuid references categories on delete set null`, `+ match_confidence numeric(4,3)`, `+ match_method text`, `+ duplicate_of_id uuid references research_products`, `+ normalized_overrides jsonb default '{}'`, `+ override_by uuid`, `+ override_at timestamptz` | `matched_category_id` is the second and last allowlisted research→public FK, on the same reasoning as Phase 26's mapping table |
| `research_product_versions` (altered) | `+ normalized jsonb`, `+ normalizer_version text` | The version's own normalised snapshot; Phase 29 diffs these |
| `research_validation_issues` | `id`, `research_product_id`, `version_id`, `rule text not null`, `severity text check (severity in ('ERROR','WARNING','INFO'))`, `field text`, `detail text`, `is_dismissed bool default false`, `dismissed_by`, `dismissed_at`, `dismiss_reason text`, `detected_at` | `unique (research_product_id, version_id, rule, field)`; index `(severity, is_dismissed)` |
| `research_match_candidates` | `id`, `research_product_id`, `candidate_id uuid references research_products`, `method text`, `score numeric(4,3)`, `evidence jsonb`, `decided text check (decided in ('PENDING','ACCEPTED','REJECTED'))`, `decided_by`, `decided_at` | Human review of anything below the auto threshold |
| `research_material_lexicon` | `id`, `token text unique`, `patterns text[] not null`, `family text`, `is_enabled bool default true`, plus D5 common set | Data, not code; editable in Studio |

Two constraints worth naming, mirroring the Phase 03 products constraint so the two worlds fail the
same way. **Both are backstops against hand-written SQL, not the enforcement point**: the validation
rules above run inside the normalizer, before the write, and keep a bad row at `VALIDATED` with an
issue attached rather than letting an `INSERT` fail.

```sql
alter table research_products add constraint research_price_state_coherent check (
  (price_state = 'FIXED'         and price_min_minor is not null and price_min_minor > 0 and currency is not null)
  or (price_state = 'STARTING_FROM' and price_min_minor is not null and price_min_minor > 0 and currency is not null)
  or (price_state in ('REQUEST_QUOTE','PRICE_ON_REQUEST','UNKNOWN')
      and price_min_minor is null and price_max_minor is null)
);

-- backstop only. The normalizer never offers an out-of-range value: `impossible_dimension`
-- nulls `dimensions_mm`, sets `dimension_parse_state = 'UNPARSED'` and attaches an ERROR issue,
-- so this constraint fires for a hand-written UPDATE and for nothing else.
alter table research_products add constraint research_dimensions_sane check (
  dimensions_mm is null or (
    jsonb_typeof(dimensions_mm) = 'object'
    and not exists (select 1 from jsonb_each(dimensions_mm) kv
                    where (kv.value)::numeric < 10 or (kv.value)::numeric > 10000)
  )
);
```

RLS as Phase 25, with the column split stated once in the permission mapping at the top of this
document: `research.read` to select; `research.write` for every normalised-value edit,
`matched_category_id`, `normalized_overrides`, and dismissing a `research_validation_issues` row;
`research.confirm` for `disposition`, `duplicate_of_id`, any `stage` move, and any
`research_match_candidates` decision; service role for the pipeline's own writes; **no `anon` policy on
any table in this phase**.

**Studio surface** — **fills** `/studio/research/explorer`; **fills** the Research tab of
`/studio/operations/data-quality`; **extends** `/studio/research/dashboard` with issue and
parse-failure tiles and `/studio/research/runs/[id]` with per-run normalization outcomes.

**Public surface** — **None.**

**Media** — **None.** `image_urls` is `text[]`. No image is fetched, measured by download, cached or
written to `media_assets`.

**Risks**

| Risk | Mitigation |
|---|---|
| A guessed unit or currency propagates silently into every later comparison | `parse_state` is per field with an explicit `AMBIGUOUS` value; `$` alone and unitless dimensions are ambiguous by rule; ambiguous rows are excluded from price comparison and from scale bands, and the exclusion is shown as a coverage figure, not hidden |
| Foreign-exchange conversion appears as a "small convenience" | No conversion function exists in `lib/scraper/**`; a unit test asserts no FX rate literal or currency-conversion import is present, and `SCRAPER.md` records the decision and its trigger condition |
| A quote-only competitor row is stored as zero and skews every average | `price_quote_with_amount` catches it in the normalizer, which writes the quote state with null amounts and an `ERROR` issue; `research_price_state_coherent` rejects it at the database as a backstop, mirroring the Phase 03 rule for Rivya products |
| A validation rule and a database constraint cover the same condition, and the rule becomes unreachable because the write fails first | Every `ERROR` rule is evaluated in `lib/scraper/validation/rules.ts` before the write; constraints exist for hand-written SQL only. `tests/unit/validation-rules.test.ts` asserts that each `ERROR` rule yields a retained row at `VALIDATED` with an attached issue — never a raised database error |
| Re-normalization overwrites a researcher's manual correction | `normalized_overrides` freezes the corrected keys; `renormalize.ts` skips them and reports the count; `tests/unit/renormalize-overrides.test.ts` proves it |
| Auto-deduplication merges two genuinely different products | Auto-merge only at confidence ≥ 0.95 requiring title *and* dimension agreement; everything else becomes a reviewable candidate; a duplicate flag is always reversible and its reversal is audited |
| Rows failing validation vanish and the gap is never noticed | Blocked rows keep their stage and their issues, appear in the explorer's Issues view, and are counted on the dashboard and the data-quality tab |
| The material lexicon becomes a hard-coded list only an engineer can change | It is a table with a Studio editor; `renormalize.ts` applies changes to stored versions without a deploy |
| Rivya's own product validation and scraped-row validation drift apart | Both import the same FEAT §21 predicates from a shared module; a unit test asserts the rule-name sets overlap where the rules are the same |

**Verification**

1. `npm run db:migrate` — `0260` applies; types regenerate with no diff.
2. `npm run test:unit -- normalize-currency normalize-dimensions normalize-materials validation-rules match-duplicates renormalize-overrides` — green. `normalize-dimensions` runs the full table above plus at least twelve real-world malformed strings.
3. `psql -c "insert into research_products (…, price_state, price_min_minor) values (…, 'REQUEST_QUOTE', 0);"` → rejected by `research_price_state_coherent`.
4. Feed a fixture draft whose dimension text parses to 24 000 mm on the longest axis → the normalizer writes `dimensions_mm = null` and `dimension_parse_state = 'UNPARSED'`, retains the original string, attaches `impossible_dimension` at `ERROR`, and the row **stays at `VALIDATED`** and is not promoted; no database error is raised. Then, separately, `psql -c "update research_products set dimensions_mm = '{\"length_mm\": 99999}';"` → rejected by `research_dimensions_sane`, proving the constraint is the backstop the normalizer never reaches.
5. Feed a fixture draft with `priceText = '$1,299.00'` and a source currency of `INR` → `parse_state = 'AMBIGUOUS'`, a `currency_ambiguous` WARNING, the row promoted to `VALIDATED`, and the row absent from any price-comparison query.
6. Feed `120 x 60` with no unit → `dimension_ambiguous`, `dimensions_mm` null, the original string retained, and the row excluded from Phase 30's scale bands.
7. Feed a draft whose category label has no `research_source_category_map` row → the row reaches `VALIDATED` and stops; `matched_category_id` is null; the dashboard's unmapped count increments. Add the mapping, re-run promotion → the row reaches `MATCHED`.
8. Create two rows with the same normalised title and dimensions within 2 % → one is flagged `DUPLICATE` with `duplicate_of_id` set. Create two at 0.88 title similarity → a `research_match_candidates` row with `decided = 'PENDING'`, and **no** disposition change.
9. Override a normalised price in the explorer, then `node scripts/research/renormalize.ts --source=fixture` → the overridden field is unchanged, the report lists it as frozen, and a `research_pipeline_events` row records the override.
10. `npx playwright test tests/e2e/research-explorer.spec.ts` — filter by `severity=ERROR`, open a row drawer, assert raw text, normalised value and provenance all render; as `viewer`, override controls are absent and a direct POST is refused.
11. `grep -rn "exchangeRate\|convertCurrency\|fx_rate" lib/scraper` → no matches.
12. `node scripts/research/check-research-isolation.mjs` → exits 0 with exactly two allowlisted FKs (`research_source_category_map.category_id`, `research_products.matched_category_id`); `npm run check` passes on this branch. Add any further research→public foreign key and confirm the guard exits non-zero and names the offending constraint.
13. As `merchandiser`, open the command palette and type a normalised title → the *Scraped Products* group returns the row and links to its explorer drawer. As `editor` (no `research.read`), the group is absent from the endpoint's response body, not merely hidden in the UI. `psql -c "select count(*) from search_documents where entity_type like 'research%';"` → 0, and as `anon`, `select count(*) from research_search_documents;` → permission denied.

**Exit criteria**

- [ ] `NORMALIZED`, `VALIDATED` and `MATCHED` are reached only through `promote.ts`, one stage per pass, each transition recorded as a pipeline event.
- [ ] Every normalised field carries a `parse_state`; `AMBIGUOUS` and `UNPARSED` are first-class and visible, and nothing is inferred from magnitude.
- [ ] No currency conversion exists anywhere in `lib/scraper/**`.
- [ ] A quote-only scraped row cannot carry a price, enforced by a database constraint mirroring the Phase 03 rule.
- [ ] All eleven validation rules are implemented with the documented severities and blocking behaviour; blocked rows are retained, listed and counted.
- [ ] Unmapped categories stop a row at `VALIDATED`; nothing is defaulted to a category.
- [ ] Duplicate auto-merge requires ≥ 0.95 confidence on title *and* dimensions; everything else is a reviewable candidate; every duplicate flag is reversible and audited.
- [ ] Manual overrides freeze their fields against re-normalization, proved by test.
- [ ] The material lexicon is a Studio-editable table and a lexicon change can be rolled out with zero network traffic.
- [ ] `/studio/research/explorer` shows raw, normalised and provenance side by side with permission-gated override controls.
- [ ] `research_products.matched_category_id` is the **second and final** allowlisted research→public foreign key: the guard's allowlist names exactly two constraints, exits 0, and exits non-zero on a third.
- [ ] The D5 question of *Open question 4* is settled — a dated amendment records the two taxonomy references, or both are stored as slug text — before `0260` ships.
- [ ] Normalised-value edits, `matched_category_id` and issue dismissal require `research.write`; `disposition`, `duplicate_of_id`, stage moves and match-candidate decisions require `research.confirm`, proved per column in the RLS tests.
- [ ] Scraped products are findable in Studio search under `research.read` through `research_search_documents`, satisfying FEAT §18's *Scraped Products* scope, and appear in no public index.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `DATA_MODEL.md`, `STUDIO_GUIDE.md`; tests run = six unit suites and one e2e spec; next phase = 29.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 29 — Change Detection + Review

**Goal** — the research subsystem becomes useful over time rather than at a point in time. When a
previously discovered competitor product changes materially — price, title, stock, dimensions,
variants, materials, images, lead time, description, availability or customization (FEAT §24) — the
change is detected against a stored snapshot, classified by materiality, timestamped and queued for a
merchandiser. `/studio/research/changes` becomes the surface where a person decides what a change
means, using the nine FEAT §25 actions. The rule that shapes everything in this phase is FEAT §25's
last line: **changes are never automatically imported into Rivya products.** They are never
automatically imported into anything.

**Depends on** — Phase 27 (`research_product_versions` — diffing requires versions, not mutated rows),
28 (normalised values to diff, validation state, matching), 24 (the bulk engine, whose research
operations this phase enables), 23 (Studio search for the changes surface).

**Scope**

- **Diffing is version-to-version and field-by-field.** `lib/scraper/workflows/detect-changes.ts`
  compares a new `research_product_versions.normalized` payload with the previous version's and emits
  one `research_changes` row per changed field, carrying `before`, `after`, both version ids, the run
  id, the snapshot `storage_key` of each side, and `detected_at`. Nothing is diffed against a mutable
  current row, so a change record can always be reproduced from evidence.
- **Materiality is a stated rule, not a feeling.** Each field has a rule; the result is
  `MATERIAL · MINOR · NOISE`. `NOISE` changes are recorded but hidden by default and never counted in
  the dashboard's "changed" figure.

  | Field | MATERIAL when | MINOR when | NOISE |
  |---|---|---|---|
  | `price` | ≥ 5 % change in minor units, or any change of price **state** | < 5 % change | Formatting-only change with equal minor units |
  | `title` | Trigram similarity < 0.90 | 0.90–0.99 | Whitespace/case only |
  | `availability` | Any transition between the five tokens | — | Text change with the same token |
  | `dimensions_mm` | Any axis changes by ≥ 2 % or an axis appears/disappears | < 2 % | Parse-state change with equal values |
  | `variant_count` | Any change | — | — |
  | `material_tokens` | Any token added or removed | — | Reordering |
  | `image_urls` | Set membership changes (added/removed URLs) | — | Query-string or CDN-host-only change |
  | `lead_time_days_*` | Any change in the parsed range | — | Text change with the same range |
  | `description` | Trigram similarity < 0.80 | 0.80–0.95 | > 0.95 |
  | `customization` | Any change in the parsed token set | — | Text-only change |
  | `sku` | Any change | — | — |

  Thresholds live in `research_change_rules`, per source with a global default row, and are editable
  in Studio — so a source with noisy prices can be tuned without a deploy.
- **Change detection never changes a stage.** A row already at `SHORTLISTED` stays `SHORTLISTED` when
  its price moves; the change is attached to it and appears in the review queue. Only a person moves a
  row between `REVIEW`, `SHORTLISTED` and `CONFIRMED`.
- **The nine FEAT §25 actions, precisely defined.** Each is a `research_review_actions` row, an
  `audit_logs` row and a `research_pipeline_events` row where a stage moves. All nine require
  `research.confirm`.

  | Action | Effect | Reversible |
  |---|---|---|
  | Review | Marks the change acknowledged; row stage moves `MATCHED → REVIEW` if it was lower | Yes |
  | Ignore | `disposition = 'IGNORED'`; the change is closed and the row leaves the queue; future changes on the same field are still detected but auto-collapsed under the ignore reason | Yes |
  | Shortlist | Stage → `SHORTLISTED`; the row joins the Phase 35 shortlist | Yes |
  | Reject | `disposition = 'REJECTED'`; stage retained; requires a reason | Yes |
  | Mark Duplicate | Sets `duplicate_of_id` and `disposition = 'DUPLICATE'`; requires choosing the surviving row | Yes |
  | Confirm | Stage → `CONFIRMED`. **This means "confirmed as a research reference", nothing else.** It creates no product, no draft product, no media row and no CMS content | Yes |
  | Add Note | A `research_notes` row: author, body, timestamp; notes are never deleted, only superseded | Append-only |
  | Add Tag | A `research_product_tags` row from the `research_tags` vocabulary; free text is rejected | Yes |
  | Compare | Opens the row alongside up to three others in a read-only comparison drawer; **records nothing except an activity event** | n/a |

- **Never auto-import, enforced not asserted.** Four independent guarantees:
  1. No server action, script, SQL function or trigger in the repository writes to `products`,
     `product_media`, `product_specs`, `product_materials` or `media_assets` from a `research_*` read
     (I4, `check-research-isolation.mjs`).
  2. `CONFIRMED` is a research stage. `docs/project/BUSINESS_RULES.md` states in one sentence that a
     Rivya product is created only by an owner typing one or by the Phase 24 approved-import path,
     and that neither reads a research table.
  3. The Studio confirm dialog says exactly what confirming does and does not do, from seeded copy.
  4. `tests/unit/research-no-autoimport.test.ts` runs a full pipeline pass with changes on a
     `CONFIRMED` row and asserts `select count(*) from products` is unchanged and no `audit_logs` row
     with `entity_type = 'product'` was written.
- **Review queue.** `/studio/research/changes` lists changes filtered by source, field, materiality,
  age, disposition and tag, defaulting to `MATERIAL` and undecided. Each row opens a diff drawer:
  before and after values side by side, the two snapshot timestamps, a link to each stored snapshot,
  and the nine actions. Keyboard shortcuts (`j`/`k` to move, `s` shortlist, `i` ignore, `r` reject,
  `n` note) because this is a surface someone works through a hundred rows at a time.
- **Bulk review.** The Phase 24 research operations are enabled here — bulk shortlist, reject, mark
  duplicate, assign research tags, confirm (FEAT §20) — implemented as `lib/bulk/operations/research/`
  against the same engine, with the same preview, the same typed-count confirmation for bulk reject,
  the same per-item snapshots and the same 24-hour undo. No second bulk path is created.
- **Digest.** A daily summary written to `research_change_digests` and surfaced on
  `/studio/research/dashboard`: material changes by source and field, new products discovered,
  products that disappeared (`last_seen_at` older than two successful runs), and the oldest undecided
  change. It is a Studio surface, not an email; outbound notification is Phase 38's decision.

**Out of scope**

- Creating, drafting or pre-filling any Rivya product from a research row — permanently.
- The shortlist workspace and the confirmation workflow beyond the stage transition (Phase 35).
- Comparison charts, price-architecture analysis and opportunity scoring (Phases 31–32).
- Cross-source change correlation ("three sources raised prices this week") — a Phase 31 analytics
  question, not a detection one.
- Email, WhatsApp or push notification of changes (Phase 38).
- Automatic re-scraping triggered by a detected change.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0270_phase29_changes.sql` | Changes, rules, actions, notes, tags, digests |
| Detector | `lib/scraper/workflows/detect-changes.ts` | Version-to-version, field-by-field |
| Materiality | `lib/scraper/analytics/materiality.ts` | The rule table above, sourced from `research_change_rules` |
| Review actions | `lib/scraper/workflows/review-actions.ts` | The nine actions; permission-checked; fully audited |
| Bulk operations | `lib/bulk/operations/research/{shortlist,reject,mark-duplicate,assign-tags,confirm}.ts` | Enables the Phase 24 registrations |
| Changes surface | `app/(studio)/studio/research/changes/**` | Fills the D4 leaf; diff drawer; keyboard shortcuts |
| Compare drawer | `components/studio/research/CompareDrawer.tsx` | Up to four rows, read-only, records nothing |
| Digest job | `lib/scraper/workflows/digest.ts` | Run from the Phase 25 cron route |
| Autoimport guard | `scripts/research/check-no-autoimport.mjs` | Extends the isolation guard with the write-path assertions |
| Tests | `tests/unit/{change-detection,materiality-rules,review-actions,research-no-autoimport}.test.ts`, `tests/e2e/{research-changes,research-bulk-review}.spec.ts` | Diffing, thresholds, actions, the hard rule |
| Docs | `docs/architecture/SCRAPER.md` (change chapter incl. the materiality table), `docs/project/BUSINESS_RULES.md`, `docs/studio/STUDIO_GUIDE.md` | |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `research_changes` | `id`, `research_product_id`, `source_id`, `field text not null`, `change_kind text check (change_kind in ('ADDED','REMOVED','MODIFIED'))`, `materiality text check (materiality in ('MATERIAL','MINOR','NOISE'))`, `before jsonb`, `after jsonb`, `version_before_id`, `version_after_id`, `run_id`, `snapshot_before_key text`, `snapshot_after_key text`, `detected_at`, `decided_action text`, `decided_by`, `decided_at` | `unique (research_product_id, field, version_after_id)`; index `(materiality, decided_action, detected_at desc)` |
| `research_change_rules` | `id`, `source_id uuid null` (null = global default), `field text`, `material_threshold numeric`, `minor_threshold numeric`, `is_enabled bool default true`, plus D5 common set | `unique (source_id, field)`; one global row per field seeded with the table's defaults |
| `research_review_actions` | `id`, `research_product_id`, `change_id uuid null`, `action text check (action in ('REVIEW','IGNORE','SHORTLIST','REJECT','MARK_DUPLICATE','CONFIRM','NOTE','TAG','COMPARE'))`, `reason text`, `actor_user_id`, `actor_role`, `occurred_at`, `undone_by_action_id uuid` | Append-only; reversal is a new row, never an edit |
| `research_notes` | `id`, `research_product_id`, `body text not null`, `author_user_id`, `created_at`, `superseded_by uuid` | Never deleted |
| `research_tags` | `id`, `slug citext unique`, `label text`, `colour text`, `is_enabled bool`, plus D5 common set | Controlled vocabulary; free text rejected |
| `research_product_tags` | `(research_product_id, tag_id)` composite PK, `assigned_by`, `assigned_at` | |
| `research_change_digests` | `id`, `digest_date date unique`, `stats jsonb not null`, `generated_at` | One row per day |

RLS: `select` requires `research.read`; every write on `research_review_actions`, `research_notes` and
`research_product_tags` requires `research.confirm`; `research_change_rules` requires
`research.write`. `research_changes` is written by the service role only — a person decides, the
system detects.

**Studio surface** — **fills** `/studio/research/changes`. **Extends** `/studio/research/explorer`
with the action bar and the enabled bulk toolbar, `/studio/research/dashboard` with the digest and
oldest-undecided tiles, and `/studio/system/settings` with the change-rule threshold editor.

**Public surface** — **None.**

**Media** — **None.** An image change is detected as a change to the `image_urls` **set**. No image is
downloaded, hashed by content, thumbnailed, cached or compared visually — that is Phase 33, and even
there it is research-only.

**Risks**

| Risk | Mitigation |
|---|---|
| A future phase adds a "create Rivya product from this row" button because it seems obviously useful | Four independent guarantees above, one of which is a CI guard and one a test; `BUSINESS_RULES.md` states the rule in a single quotable sentence |
| The queue fills with noise and merchandisers stop reading it | Three-level materiality with per-source thresholds; `NOISE` hidden by default and excluded from counts; the digest surfaces the oldest undecided change so a stalled queue is visible |
| A diff cannot be reproduced because the row it compared against has since changed | Diffs are version-to-version and both snapshot keys are stored; the drawer links to both stored snapshots |
| `CONFIRMED` is read as "approved for the Rivya catalogue" | The confirm dialog's seeded copy states what it does and does not do; the stage is documented in `SCRAPER.md` and `BUSINESS_RULES.md`; no downstream code treats `CONFIRMED` as a product signal |
| Bulk reject destroys a week of review with one click | Bulk reject is destructive: `bulk.execute` + `destructive.execute`, typed row count, per-item snapshot, 24-hour undo, and a required reason applied to every item |
| An action is taken and nobody can tell who or why | `research_review_actions` is append-only with actor and role, mirrored into `audit_logs`; reversal is a new row, never an edit |
| Change thresholds get hard-coded and a noisy source cannot be tuned | Thresholds live in `research_change_rules` with a Studio editor and a per-source override |

**Verification**

1. `npm run db:migrate` — `0270` applies; types regenerate with no diff.
2. `npm run test:unit -- change-detection materiality-rules review-actions research-no-autoimport` — green.
3. Take a fixture product at version 1. Change the price by 3 % → a `MINOR` change. By 8 % → `MATERIAL`. Change `FIXED` to `REQUEST_QUOTE` at the same amount → `MATERIAL` regardless of percentage.
4. Change only whitespace in the title → `NOISE`, hidden by default, and the dashboard's changed count does not increment.
5. Remove one image URL and add another → one `MATERIAL` change of kind `MODIFIED` on `image_urls` with both sets in `before`/`after`. Change only a CDN query string → `NOISE`.
6. Lower the `price` material threshold for one source to 1 % in Studio, re-run detection on a stored version pair → the 3 % change is reclassified `MATERIAL` for that source only, with the global default unaffected.
7. `npx playwright test tests/e2e/research-changes.spec.ts` — as `merchandiser`, perform all nine actions; assert a `research_review_actions` row and an `audit_logs` row for each, that Compare writes only an activity event, and that Confirm moves the stage to `CONFIRMED`. As `researcher` (no `research.confirm`), every action control is absent and a direct POST is refused.
8. `psql -c "select count(*) from products;"` before and after step 7 → identical. `select count(*) from audit_logs where entity_type='product' and occurred_at > <t0>;` → 0.
9. `node scripts/research/check-no-autoimport.mjs` → exits 0. Add a `products` insert to `lib/scraper/workflows/review-actions.ts` and confirm it exits non-zero.
10. `npx playwright test tests/e2e/research-bulk-review.spec.ts` — bulk-shortlist 40 rows through the Phase 24 preview/confirm flow; bulk-reject 10 with a typed count and a reason; undo the reject within the window and assert all 10 return with their prior disposition and an audited undo operation.
11. Run the digest job twice for the same date → one `research_change_digests` row, updated not duplicated.

**Exit criteria**

- [ ] Changes are detected version-to-version across all eleven FEAT §24 fields, with both snapshot keys stored and a reproducible diff.
- [ ] Materiality is a per-source, Studio-editable rule with three levels; `NOISE` is hidden and uncounted.
- [ ] All nine FEAT §25 actions exist, require `research.confirm`, and write an append-only action row plus an audit row.
- [ ] Change detection never moves a stage; only a person does.
- [ ] `CONFIRMED` provably creates no product, no media row and no CMS content, proved by guard and by test.
- [ ] The four never-auto-import guarantees are all in place, including the CI guard and the `BUSINESS_RULES.md` sentence.
- [ ] Bulk review runs on the Phase 24 engine with preview, typed confirmation, per-item snapshots and undo — with no second bulk implementation.
- [ ] The daily digest is idempotent and surfaces the oldest undecided change.
- [ ] No image is downloaded, hashed or visually compared.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `BUSINESS_RULES.md`, `STUDIO_GUIDE.md`; tests run = four unit suites and two e2e specs; next phase = 30.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 30 — Large-Format Research Workspace

**Goal** — the research subsystem starts answering the question Rivya actually cares about. SEED §56
puts large-format furniture first in the content hierarchy and FEAT §49 asks whether large work
visually dominates; this phase gives the same priority to research. `/studio/research/large-format`
becomes a dedicated workspace over the subset of research products that are large by a stated,
editable rule: scale bands derived from parsed dimensions, honest coverage figures for the rows whose
dimensions could not be parsed, saved views, and a comparison surface that never pretends to know a
dimension it does not have.

**Depends on** — Phase 28 (`dimensions_mm`, `dimension_parse_state`, `matched_category_id`,
material tokens), 29 (dispositions, tags, notes, the review actions reused here), 26 (source
configuration and health), 24 (bulk engine for saved-view bulk actions).

**Scope**

- **A stated large-format rule, editable, versioned, overridable.** `research_large_format_rules`
  holds ordered rules; the first match wins; a row matching none is `UNKNOWN`, never small. The
  default rule set, seeded as data and freely editable:

  | Priority | Rule | Result |
  |---|---|---|
  | 10 | `dimension_parse_state <> 'PARSED'` | `scale_band = 'UNKNOWN'`, `is_large_format = null` |
  | 20 | Longest parsed axis ≥ 1800 mm | `LARGE` |
  | 30 | Longest axis ≥ 1200 mm **and** category in the mapped large-format set | `LARGE` |
  | 40 | Longest axis ≥ 1200 mm | `MID` |
  | 50 | Otherwise | `SMALL` |

  `is_large_format` is `true` only for `LARGE`. It is a **three-valued** field — true, false, unknown
  — and every count in this workspace reports the unknown bucket beside the other two.
- **Scale bands mirror the vocabulary Rivya already uses.** `scale_band` is
  `DINING · CONSOLE · COFFEE · SEATING · SIDE · MONUMENTAL · WALL · UNKNOWN`, derived from the matched
  category plus a height/length signature (for example: length ≥ 1600 mm and height 700–800 mm →
  `DINING`; height ≥ 2000 mm → `MONUMENTAL`). The band vocabulary deliberately matches the Higgsfield
  `largeformat-*` family names Rivya already uses internally, so a merchandiser reads one set of words
  across the whole system. **A band is a research classification and never appears publicly.**
- **Editor override, per row and permanent.** A researcher sets `is_large_format` or `scale_band` by
  hand — a `research.write` action, because a scale band is a classification and carries no disposition
  meaning; `large_format_source` records `RULE · EDITOR · UNKNOWN`, and an `EDITOR` value is never
  recomputed when rules change. Rule edits trigger a reclassification pass that reports how many rows
  moved band and skips every overridden row.
- **The workspace.** `/studio/research/large-format` shows, over the filtered subset:
  - a **coverage banner** first, before any chart: rows in scope, rows with parsed dimensions, rows
    `UNKNOWN`, and the percentage — because every figure below it is conditional on that coverage
    (FEAT §28: "do not manufacture unavailable analytics data; clearly state coverage");
  - a **band distribution** by source and by band, with the `UNKNOWN` bucket always drawn, never
    dropped to make the chart tidy;
  - a **dimension scatter** of longest axis against height for `PARSED` rows only, with the excluded
    count stated beneath;
  - a **price-by-band** summary that groups by currency and never mixes currencies (Phase 28's rule),
    with quote-only rows counted separately rather than excluded silently;
  - a **materials-by-band** breakdown from `material_tokens`;
  - a **grid and table view** with the Phase 29 action bar and the Phase 24 bulk toolbar, so a
    merchandiser can shortlist directly from here.
- **Saved views.** `research_saved_views` stores a named filter set (`surface`, `filters jsonb`,
  `sort`, `columns`, `is_shared`), so "large dining tables, one currency, in-stock, last 30 days" is a
  link a merchandiser can return to and share with the owner. Views are per-surface and reusable by
  Phases 31–35 rather than reinvented there.
- **Gap view, and its honesty rule.** A panel listing bands where research coverage is thin — few rows,
  stale sources, or high `UNKNOWN` share. It reports **research coverage**, and its heading says so.
  It does **not** compare against Rivya's own catalogue, does not compute an opportunity score and
  does not phrase anything as a market gap: Rivya has no published products yet, so any such
  comparison would be an artefact of an empty catalogue. Opportunity scoring is Phase 32, after there
  is something to compare against.
- **Reclassification without re-fetching.** `scripts/research/reclassify-scale.ts` re-runs the rules
  over stored rows with zero network traffic, honours overrides, and reports movements per band. Same
  pattern as Phases 27 and 28 — every derived value can be recomputed offline from stored evidence.
- **Search and dashboard.** Large-format counts join `/studio/research/dashboard`; the saved views
  register as command-palette entries under `research.read`.

**Out of scope**

- Any comparison between research rows and Rivya products, and any opportunity or gap score
  (Phases 31–32). This workspace describes what has been observed, nothing more.
- Visual similarity, image clustering and style classification (Phase 33).
- Product direction tooling and the shortlist workspace (Phases 34–35).
- Google Sheets export of these views (Phase 36).
- Inferring a dimension from a category, a price, an image or a product name. `UNKNOWN` stays
  `UNKNOWN`.
- Any public surface, badge, chart or export. Nothing here ever leaves Studio.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration | `supabase/migrations/0280_phase30_large_format.sql` | Scale columns, rules, saved views |
| Classifier | `lib/scraper/analytics/scale.ts` | Ordered rules, band signatures, three-valued output |
| Reclassify script | `scripts/research/reclassify-scale.ts` | Offline; honours overrides; `--dry-run` reports movements |
| Coverage helper | `lib/scraper/analytics/coverage.ts` | Returns `{ inScope, parsed, unknown, pct }` for every panel |
| Workspace | `app/(studio)/studio/research/large-format/**` | Fills the D4 leaf |
| Panels | `components/studio/research/{CoverageBanner,BandDistribution,DimensionScatter,PriceByBand,MaterialsByBand,GapPanel}.tsx` | Every panel takes a coverage prop and renders it |
| Saved views | `components/studio/research/SavedViews.tsx`, `lib/supabase/repositories/research/saved-views.ts` | Per-surface; shareable |
| Tests | `tests/unit/{scale-rules,scale-overrides,coverage-reporting}.test.ts`, `tests/e2e/research-large-format.spec.ts` | Rules, three-valued logic, coverage honesty |
| Docs | `docs/architecture/SCRAPER.md` (scale chapter incl. the rule table), `docs/studio/STUDIO_GUIDE.md`, `docs/architecture/DATA_MODEL.md` | |

**Database**

| Table | Key columns | Notes |
|---|---|---|
| `research_products` (altered) | `+ scale_band text check (scale_band in ('DINING','CONSOLE','COFFEE','SEATING','SIDE','MONUMENTAL','WALL','UNKNOWN'))`, `+ is_large_format boolean` (nullable — three-valued), `+ longest_axis_mm int`, `+ large_format_source text check (large_format_source in ('RULE','EDITOR','UNKNOWN'))`, `+ classified_at timestamptz`, `+ classified_rule_id uuid` | Index `(is_large_format, scale_band, source_id)`; `longest_axis_mm` is generated from `dimensions_mm` in the classifier, not by the database, so an override is possible |
| `research_large_format_rules` | `id`, `priority int not null`, `predicate jsonb not null`, `result_band text`, `result_is_large boolean`, `is_enabled bool default true`, `notes text`, plus D5 common set | `unique (priority)`; five default rows seeded as configuration, not content |
| `research_saved_views` | `id`, `surface text check (surface in ('explorer','large-format','changes','compare'))`, `name text not null`, `filters jsonb not null`, `sort jsonb`, `columns text[]`, `is_shared bool default false`, `owner_user_id`, plus D5 common set | `unique (owner_user_id, surface, name)`; shared views readable by anyone with `research.read` |

RLS as Phase 25, by column rather than by screen: `research.read` to select; `research.write` for
`research_large_format_rules`, for running a reclassification, and for the row-level `is_large_format`,
`scale_band` and `large_format_source` overrides — none of which carries a disposition meaning;
`research.confirm` only for `disposition`, `duplicate_of_id` and `stage`, none of which this phase
writes. `research_saved_views` rows are inserted and updated by their own `owner_user_id` under
`research.read`, and a shared view is readable by anyone with `research.read`. No `anon` policy.

**Studio surface** — **fills** `/studio/research/large-format`. **Extends**
`/studio/research/dashboard` with large-format and coverage tiles, `/studio/research/explorer` with
band and `is_large_format` filters and the saved-view control, and `/studio/system/settings` with the
scale-rule editor.

**Public surface** — **None.** `is_large_format` on a **research** row and `products.is_large_format`
on a **Rivya** row are different columns in different worlds; nothing joins them, and the isolation
guard proves it.

**Media** — **None.** The `largeformat-*` manifest families (`largeformat-dining` 5 — of which
`LARGEFORMAT-DINING-004` and `LARGEFORMAT-DINING-005` are videos — `largeformat-console` 4,
`largeformat-seating` 4, `largeformat-side` 3, `largeformat-coffee` 1, `largeformat-monumental` 1;
18 assets in total, 2 of them video, matching the manifest's `counts.by_page["large-format"]`) are
Rivya's own concept assets, bound by Phase 13 to the public Large Format experience. They are **not**
used here: this workspace displays no Rivya marketing media at all, and it displays no competitor
image beyond the Phase 27 URL rendered through the
authenticated non-caching proxy. The band vocabulary borrows those family *names* for consistency; it
borrows none of their assets.

**Risks**

| Risk | Mitigation |
|---|---|
| Rows with unparsed dimensions are treated as small and every distribution is wrong | `is_large_format` is three-valued; rule 10 sends unparsed rows to `UNKNOWN` before any threshold is applied; every panel renders the unknown bucket and the coverage banner sits above the charts |
| A chart implies market knowledge Rivya does not have | Coverage is stated on every panel; the gap view reports research coverage and says so in its heading; opportunity language is deliberately absent until Phase 32 |
| A rule change silently rewrites a researcher's manual classification | `large_format_source = 'EDITOR'` freezes the row; the reclassification pass skips and reports it; `tests/unit/scale-overrides.test.ts` proves it |
| Scale bands drift into public copy because they read like nice category names | The band vocabulary exists only in `research_*` columns and `components/studio/research/**`; `check-research-isolation.mjs` (I3) fails on any band token in `app/(site)/**` or `content/**` |
| Currency mixing produces a meaningless price-by-band chart | Price panels group by currency and refuse to aggregate across currencies (Phase 28's no-conversion rule); quote-only rows are counted in their own column rather than dropped |
| Saved views become per-person silos nobody else can reproduce | Views carry `is_shared` and are readable by anyone with `research.read`; the filter set is stored as data and is reproducible from the URL |
| The workspace becomes a second explorer with duplicated filtering code | It composes the Phase 28 explorer's query layer and the Phase 29 action bar; a unit test asserts the large-format page constructs no filter predicate of its own |

**Verification**

1. `npm run db:migrate` — `0280` applies; types regenerate with no diff; the five default rules are present.
2. `npm run test:unit -- scale-rules scale-overrides coverage-reporting` — green. `scale-rules` covers each of the five rules plus boundary values at 1199/1200/1799/1800 mm.
3. Insert a fixture row with `dimension_parse_state = 'AMBIGUOUS'` → `scale_band = 'UNKNOWN'`, `is_large_format is null`. Assert it is **not** counted as false in any panel.
4. Insert rows at 1150 mm, 1250 mm (mapped large-format category), 1250 mm (other category) and 2100 mm → `SMALL`, `LARGE`, `MID`, `LARGE` respectively.
5. Override one row to `LARGE` by hand, change rule 20's threshold to 2000 mm, run `node scripts/research/reclassify-scale.ts --dry-run` → the report lists rows moving band and lists the overridden row as skipped; the override survives a real run.
6. `npx playwright test tests/e2e/research-large-format.spec.ts` — the coverage banner renders above every chart with in-scope, parsed and unknown counts; the band distribution draws the `UNKNOWN` bucket; the scatter states its excluded count; the price panel renders one group per currency and never a combined total.
7. Save a view with four filters, reload from its URL, and open it as a second user with `research.read` when `is_shared` is true → identical result set; when false → not listed.
8. Shortlist five rows directly from the workspace via the Phase 29 action bar and the Phase 24 bulk toolbar → the same audit and undo behaviour as `/studio/research/changes`, with no new bulk code path.
9. `grep -rniE "dining|console|monumental" app/\(site\) content | grep -i "scale_band\|research"` → no matches; `node scripts/research/check-research-isolation.mjs` → exits 0.
10. `select count(*) from products;` before and after the entire e2e run → unchanged.

**Exit criteria**

- [ ] Large-format classification is an ordered, Studio-editable rule set whose first match wins, with a seeded default of five rules.
- [ ] `is_large_format` is three-valued and `UNKNOWN` is reported beside true and false in every count and chart.
- [ ] A row whose dimensions could not be parsed is never classified as small.
- [ ] Editor overrides are permanent against rule changes and are reported by the reclassification pass.
- [ ] Every panel renders a coverage figure; no panel drops the unknown bucket to look tidy.
- [ ] Price panels group by currency and never aggregate across currencies; quote-only rows are counted separately.
- [ ] The gap panel reports research coverage, uses no opportunity language, and makes no comparison with Rivya's catalogue.
- [ ] Scale bands exist only inside the research schema and Studio research components, proved by the isolation guard.
- [ ] Saved views are shareable, reproducible from a URL, and reusable by later phases.
- [ ] Reclassification runs offline with zero network traffic.
- [ ] `is_large_format`, `scale_band` and `large_format_source` overrides are `research.write` actions; this phase writes no `disposition`, no `duplicate_of_id` and no `stage`, and requires `research.confirm` for nothing it introduces.
- [ ] Phase-specific D9 evidence: docs updated = `SCRAPER.md`, `STUDIO_GUIDE.md`, `DATA_MODEL.md`; tests run = three unit suites and one e2e spec; next phase = 31.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## Cross-phase notes

**Migration ledger for this block.**

| Phase | Migrations | Subject |
|---|---|---|
| 23 | `0210`–`0213` | Search index, triggers, RLS, relations |
| 24 | `0220` | Bulk operations, items, imports, import rows |
| 25 | `0230`–`0233` | Research enums, core tables, RLS, queue |
| 26 | `0240` | Source configuration, patterns, mapping, schedules, health view |
| 27 | `0250` | Product versions, adapter runs |
| 28 | `0260` | Normalised columns, validation issues, match candidates, lexicon |
| 29 | `0270` | Changes, change rules, review actions, notes, tags, digests |
| 30 | `0280` | Scale columns, large-format rules, saved views |

**What is still empty at the end of Phase 30.** `products` has whatever the owner has typed — possibly
nothing. `research_sources` has whatever the owner has added and policy-approved — possibly nothing,
and the system is fully functional in that state, showing honest empty states rather than a
demonstration data set. No competitor is named anywhere in the repository. No price, dimension,
material, lead time or availability claim about Rivya appears anywhere in these eight phases: every
value they handle is either the owner's own entry or a third party's published string clearly labelled
as such.

**Three offline recomputation scripts, one pattern.** `reextract.ts` (Phase 27), `renormalize.ts`
(Phase 28) and `reclassify-scale.ts` (Phase 30) all take stored evidence, re-derive a layer, honour
human overrides and report what moved — with zero network traffic. Any future derived value in the
research subsystem should follow the same pattern: derive from stored evidence, never from a re-fetch,
and never over a human's correction.

**Isolation evidence, in one place.** A reviewer verifying the research boundary should run exactly
four things: `node scripts/research/check-research-isolation.mjs`,
`node scripts/research/check-no-autoimport.mjs`, `node scripts/search/check-search-scope.mjs`, and
`npm run test:unit -- research-isolation search-scope research-no-autoimport`. Together they cover
I1–I4, the public search scope and the never-auto-import rule. All four are wired into `npm run check`
and none is optional.

**Manifest position.** Phases 23–30 consume no new Higgsfield asset and generate none. Phase 23 reuses
the category hero bindings Phase 09 made; Phases 24–30 display no marketing media at all. The Phase 07
regeneration guard remains armed throughout (D6, FEAT §33), and the 250-asset manifest is untouched by
this block.

---

## Open questions for the canonical decisions

These are raised, not acted on — with one stated exception. **Open question 4 is a knowing divergence
from D5**: two research tables reference `categories`, D5 says scraped data never joins directly to
public product tables, and no dated amendment exists. Invariant I1, the Phase 26 note, and both phases'
exit criteria carry that dependency rather than hiding it, and the divergence must be resolved — by
amendment or by the slug-as-text alternative — before migration `0240` ships. Nothing else in this
document diverges from `CANONICAL-DECISIONS.md`.

1. **No cron secret in D8.** D8 fixes the environment-variable names and includes `REVALIDATE_SECRET`
   but nothing for scheduled invocation. Phase 25's cron route therefore authenticates on Vercel's
   `x-vercel-cron` header and returns 404 otherwise, which is weaker than a shared secret and untestable
   outside Vercel. Suggested amendment: add `CRON_SECRET` to D8's server-only list. Reusing
   `REVALIDATE_SECRET` was rejected as widening one secret's blast radius across two unrelated systems.
2. **Is the `lib/` domain list in D2 closed?** `PHASE-05-09.md` reads it as closed and routes Studio
   helpers into existing domains; `PHASE-10-15.md` then adds `lib/site/` and `lib/catalog/`. This
   document follows the later precedent with `lib/search/`, `lib/relations/` and `lib/bulk/`. One
   reading should be recorded in D2 so a reviewer is not forced to guess.
3. **`research.confirm` versus `research.write` for review actions.** FEAT §25 assigns the nine review
   actions to the merchandiser, who holds `research.confirm` but not `research.write` in the Phase 04
   matrix. This document therefore gates all nine on `research.confirm` — with the consequence that a
   **researcher can run the pipeline but cannot shortlist or reject a row**, which may not be intended.
   Suggested amendment: either grant `researcher` the `research.confirm` permission, or state in D5
   that disposition is deliberately a merchandising act. The split has a mirror image this document has
   had to resolve by column rather than by screen: a **merchandiser holds `research.confirm` but not
   `research.write`**, so under the permission mapping above they may shortlist, reject and confirm a
   row yet cannot correct its normalised price or set its category. Both halves follow from the same
   Phase 04 matrix; whichever way the intent is recorded, it should record both.
4. **Two allowlisted research→public foreign keys — the one knowing divergence in this document, and a
   blocker for Phase 26.** D5 says scraped data "never joins directly to public product tables".
   `research_source_category_map.category_id` (Phase 26) and `research_products.matched_category_id`
   (Phase 28) both reference `categories` — taxonomy, not products, and both written or configured by
   staff rather than scraped. `docs/architecture/SCRAPER.md` §13.2 and invariant I1 above already carry
   the exception and the isolation guard allowlists exactly these two constraints by name, failing on a
   third; `CANONICAL-DECISIONS.md` carries nothing. Required action before `0240` ships, one of two:
   (a) append a dated amendment **A2** to §Amendments recording the narrow taxonomy exception in D5's
   own terms — that scraped *values* never join to public tables, while a staff-authored taxonomy
   pointer with `on delete set null` may; or (b) direct the alternative — store the category *slug* as
   `citext` on both tables, accept the loss of referential integrity and of `on delete` behaviour, and
   keep the guard's allowlist empty. This document cannot amend the canonical decisions and does not
   choose on the owner's behalf.
5. **Two relation tables.** Phase 03 fixed `product_relations` on `source_product_id` and Phase 15
   indexes it, so Phase 23 adds `content_relations` for portfolio-, journal- and collection-sourced
   edges rather than generalising a shipped table. This leaves two structurally identical tables. If a
   single `entity_relations` is preferred, it should be decided before Phase 31 reads either of them.
6. **Where does `/studio/operations/data-quality` live?** FEAT §21's rules are implemented in Phase 14
   for first-party products, but no phase document claims the D4 page. Phase 28 fills its **Research**
   tab and adds beside any existing Products tab. Confirm which phase owns the page as a whole.
7. **`CONFIRMED` as a stage name.** FEAT §23's final pipeline stage reads, to a newcomer, as "approved
   for the catalogue" when it means "confirmed as a research reference". The name is kept because the
   requirement fixes it, but a note in D5 defining the seven stage values — and stating that none of
   them creates a Rivya product — would remove a standing misreading risk.
8. **Snapshot storage location.** D1 fixes Cloudinary as the media provider behind `MediaProvider`, but
   research HTML snapshots are evidence, not media, and must never be publicly deliverable. Phase 25
   writes them to a private object store outside the `MediaProvider` abstraction. Confirm that store
   (a private Supabase Storage bucket is the assumption) and record it in D6 so a later phase does not
   route them through Cloudinary.
