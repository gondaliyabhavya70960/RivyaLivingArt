# PHASES 05–09 — Studio, Media, Assets, CMS, Content Seed

> Binding parent: `docs/architecture/CANONICAL-DECISIONS.md`. Where this document and the
> canonical decisions differ, the canonical decisions win and this document is wrong.
> Source specifications: `docs/requirements/01-ADVANCED-FEATURE-EXPANSION.md` (cited as
> *FEAT §n*) and `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` (cited as *SEED §n*).

This block of phases turns the database and auth foundation (Phases 03–04) into an operating
Studio, a governed media pipeline, a migrated asset library, an editable page-block CMS and a
fully seeded first-pass website. Nothing public renders until Phase 10; everything public that
Phase 10 will render is authored, stored and editable by the end of Phase 09.

## Conventions used by all five phases

| Convention | Value |
|---|---|
| Migration numbering | Phase 05 → `0020–0029`, 06 → `0030–0039`, 07 → `0040–0049`, 08 → `0050–0069`, 09 → `0070–0079` |
| Migration filename | `supabase/migrations/<nnnn>_<phase>_<subject>.sql` |
| Permission string | `<resource>:<action>` — e.g. `content:publish`, `media:upload` |
| Studio route group | `app/(studio)/studio/**` per D2; public group untouched by 05–09 |
| Seed identity | Phase 03 (`0007_seed_bookkeeping.sql`) already ships `seed_key text unique`, `seed_version text`, `seed_content_hash text`, `seed_last_applied_at timestamptz` on every seedable table. Migration `0070` renames `seed_version` → `content_seed_version` (the name SEED §4 fixes), keeps `seed_content_hash`, and adds `owner_edited bool not null default false`. See *Phase 09 — idempotency contract* for the single rule that uses all four |
| Server actions | co-located `actions.ts` next to the route; every action re-checks permission |
| Zod boundary | request body, form payload, seed module and manifest are all Zod-parsed (D1) |

### Shared D9 completion checklist

Every phase below inherits all ten points of D9 and is **not COMPLETE** until each is true:

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

## PHASE 05 — Studio Foundation

**Goal** — Rivya gains an authenticated internal workspace. After this phase a signed-in staff
member lands on `/studio`, sees only the navigation their role permits, can reach every route in
the D4 map without hitting a 404, can open a global command palette from anywhere, can read a
live activity feed of who changed what, and sees a dashboard of counts drawn from tables that
actually exist. No product, media or content editing happens yet: this phase builds the shell,
the primitives, the permission plumbing and the honest empty states that the next thirty phases
mount their features into.

**Depends on** — Phase 02 (design system tokens and primitives), Phase 03 (database and typed
data layer), Phase 04 (Supabase Auth, roles, RBAC helpers, RLS).

**Scope**

- Studio shell: `app/(studio)/studio/layout.tsx` with sidebar, top bar, breadcrumb trail, user
  menu, role badge, deployment-environment badge, skip link and `<main>` landmark.
- A single declarative navigation manifest, `lib/auth/studio-nav.ts`, that reproduces the D4
  route map exactly and is the only source of navigation truth.
- Role-aware navigation: groups and leaves are filtered by the permissions of the session role;
  filtering is presentation only — every route additionally calls `requirePermission()` on the
  server before rendering (D4: "every page re-checks permission server-side").
- Route stubs for **every** D4 leaf so navigation never dead-ends. A stub renders `StudioPage`
  with the phase that will fill it, drawn from `lib/auth/studio-nav.ts` metadata.
- Studio primitives in `components/studio/` (D2), built on Phase 02 `components/primitives`.
- Global command palette (`⌘K` / `Ctrl-K`): route jumping in this phase, plus a provider
  registry so later phases register entity search without touching the palette.
- Activity feed: `activity_events` table, `logActivity()` writer, and the Activity tab on
  `/studio`.
- Dashboard cards from FEAT §17 driven by a card registry with per-role visibility; a card whose
  backing table does not yet exist renders a `Not available until Phase NN` state rather than a
  number (FEAT §17: "do not overload every role with irrelevant metrics"; D10: never fabricate).
- Studio chrome copy is seeded later (SEED §38–§40); Phase 05 renders it from
  `components/studio/strings.ts` constants that Phase 09 deletes in favour of `global_content`
  lookups. D2 fixes the `lib/` domain list, so Studio helpers map onto existing domains rather
  than a new `lib/studio/`: activity into `lib/logging/`, dashboard metrics into `lib/analytics/`,
  navigation and permissions into `lib/auth/`, and Studio-only UI registries into
  `components/studio/`.

**Out of scope**

- Any create/update/delete of catalog, content, media or research records.
- Cross-entity search results in the palette (registry exists, providers land in Phases 06–23).
- Analytics charts — the `/studio` Analytics tab is a stub until Phase 37.
- Studio user administration screens — role management UI is Phase 38; Phase 04 supplies roles.
- Public site chrome of any kind.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Studio shell | `app/(studio)/studio/layout.tsx` | Server component; calls `requirePermission('studio:access')` |
| Overview page | `app/(studio)/studio/page.tsx` | Tabs: Overview · Analytics · Activity (D4) |
| Studio error/empty boundaries | `app/(studio)/studio/{loading,error,not-found}.tsx` | Uses SEED §46 copy shape |
| Navigation manifest | `lib/auth/studio-nav.ts` | Typed `StudioNavGroup[]`, one entry per D4 leaf |
| Permission helpers | `lib/auth/permissions.ts` | `can(role, perm)`, `requirePermission(perm)`, `assertRole()` |
| Activity writer | `lib/logging/activity.ts` | `logActivity({ action, entityType, entityId, summary })` |
| Dashboard card registry | `lib/analytics/dashboard-cards.ts` | Card id, label, roles, query, availability phase |
| Command registry | `components/studio/command/registry.ts` | `registerCommandProvider()`; route provider included |
| Studio search endpoint | `app/api/studio/search/route.ts` | POST, Zod body, permission-scoped, 20-result cap |
| Studio primitives | `components/studio/*.tsx` | See primitive table below |
| Migration | `supabase/migrations/0020_phase05_studio_activity.sql` | `activity_events`, `studio_preferences` |
| Studio guide | `docs/studio/STUDIO_GUIDE.md` | Navigation map, roles, primitives, stub policy |
| Nav unit test | `tests/unit/studio-nav.test.ts` | Manifest ↔ filesystem ↔ D4 parity |
| RBAC e2e | `tests/e2e/studio-rbac.spec.ts` | Route access matrix per role |

Studio primitives (`components/studio/`), each with a Storybook-free usage example in the guide:

| Primitive | Purpose |
|---|---|
| `StudioPage` | Title, description, breadcrumb, actions slot, permission gate, stub notice |
| `PageHeader` · `Toolbar` | Consistent header/action alignment |
| `DataTable` | Column defs, sort, pagination, empty state, row selection hook for Phase 24 |
| `FilterBar` | URL-synced filters (`searchParams` are the state) |
| `StatCard` | Value, delta, hint, unavailable state |
| `StatusPill` | Renders the D5 status enum and `owner_verification` enum |
| `EmptyState` | Heading, body, action; never the words "Coming Soon" (SEED §55) |
| `ConfirmDialog` | Required for every destructive action (FEAT §20) |
| `DrawerForm` · `FormField` | Server-action forms with Zod error mapping |
| `PermissionGate` | Client-side hiding only; never the sole guard |
| `RelativeTime` · `ActorChip` | Activity and audit rendering |
| `CommandPalette` | `⌘K` overlay, keyboard-navigable, provider-driven |

**Database**

| Table | Columns |
|---|---|
| `activity_events` | `id uuid pk`, `actor_id uuid null` (fk `auth.users`), `actor_role text`, `action text`, `entity_type text`, `entity_id uuid null`, `entity_label text`, `summary text`, `metadata jsonb default '{}'`, `occurred_at timestamptz default now()` |
| `studio_preferences` | `id uuid pk`, `user_id uuid unique`, `sidebar_collapsed bool default false`, `pinned_routes text[] default '{}'`, `dashboard_card_order text[] default '{}'`, `created_at`, `updated_at`, `updated_by` |

`activity_events` is an append-only log, not content, so it is a documented exemption from the
D5 rule that content-bearing tables carry `status`/`updated_by`; it has no `UPDATE` or `DELETE`
policy at all. RLS: staff with `activity:view` may `SELECT`; only the service role may `INSERT`.
Indexes: `(occurred_at desc)`, `(entity_type, entity_id)`, `(actor_id, occurred_at desc)`.

**Studio surface** — creates the whole D4 tree. Filled now: `/studio` (Overview and Activity
tabs). Stubbed with an owning-phase notice: every leaf under `/studio/catalog`,
`/studio/merchandising`, `/studio/content`, `/studio/media`, `/studio/inquiries`,
`/studio/research`, `/studio/operations`, `/studio/system`.

| Nav group | Owner | Admin | Editor | Merchandiser | Researcher | Viewer |
|---|---|---|---|---|---|---|
| Overview | full | full | full | full | full | read |
| Catalog | full | full | — | full | — | read |
| Merchandising | full | full | — | full | — | read |
| Content | full | full | full | — | — | read |
| Media | full | full | full | full | — | read |
| Inquiries | full | full | — | full | — | read |
| Research | full | full | — | read | full | read |
| Operations | full | full | — | — | — | — |
| System | full | partial | — | — | — | — |

`System → Users` and `System → Feature Flags` are owner-only; admin sees the rest of System.

**Public surface** — None.

**Media** — None. The Studio uses design-system tokens and brand marks only; no asset from
`data/higgsfield/asset-manifest.json` is consumed in this phase.

**Risks**

| Risk | Mitigation |
|---|---|
| Navigation drifts away from D4 as later phases add pages | `tests/unit/studio-nav.test.ts` asserts the manifest's leaf set equals a literal copy of the D4 list and that each leaf resolves to a `page.tsx` on disk; the test fails the build on drift |
| Role filtering mistaken for security | Every route module begins with `await requirePermission(...)`; `tests/e2e/studio-rbac.spec.ts` requests each route directly as each role and asserts non-200 for the denied set |
| Dashboard cards invent numbers before their tables exist | Card registry declares `availableFromPhase`; the renderer shows the unavailable state unless the table is present, and a unit test asserts no card queries a non-existent relation |
| Command palette grows into a search engine before Phase 23 | Palette ships route-jump only; providers are a registry with a documented contract and a 20-result, 200 ms budget per provider |
| Activity feed becomes a firehose nobody reads | `action` is a controlled vocabulary in `lib/logging/activity.ts`; the feed defaults to the last 50 events and filters by entity type and actor |

**Verification**

1. `npx supabase db reset && npx supabase db push` — migration `0020` applies from clean.
2. `npm run test:unit -- studio-nav` — manifest/filesystem/D4 parity passes.
3. `npx playwright test tests/e2e/studio-rbac.spec.ts` — for each of the six D5 roles, every D4
   route returns 200 where the matrix above allows and redirects to `/studio` with a denial
   notice where it does not.
4. Sign in as `editor`; assert the sidebar shows Overview, Content, Media only, and that
   navigating directly to `/studio/research/sources` is refused server-side.
5. Press `⌘K` on `/studio/media/all`; type `journ`; assert `Content → Journal` is the first
   result and `Enter` navigates there.
6. Run any server action that calls `logActivity()` (a `studio_preferences` write is enough);
   assert a row appears in `activity_events` and in the Activity tab within one reload.
7. ~~`psql "$DATABASE_URL" -c "select count(*) from activity_events"` as the anon role — expect a
   permission error, proving RLS.~~ **CORRECTED — this step cannot pass as written, and is replaced
   by `tests/unit/rls/phase05.test.ts`.**

   There is no permission error. RLS denial is ZERO ROWS, not an exception: Supabase grants `anon`
   full DML on every table in `public`, so the grant is present and the policy simply matches
   nothing. Run as written, the command returns `0`, and someone then has to decide whether that
   counts as a pass.

   Worse, `0` on an empty table is the same `0`. The step as written is satisfied identically by a
   correctly-locked table, an empty table, and a table with RLS switched off — the vacuous pass
   this project has already been bitten by once (`DATA_MODEL` §1.5, and the Phase 04 harness note).

   The replacement seeds a row as the table owner FIRST and proves it is visible, so a role seeing
   zero means refused rather than absent. It also covers what the original could not: that all six
   staff roles CAN read the feed, that a suspended one cannot, that a staff insert is refused
   (the feed is readable by every role, so a forged "editor published X" would land in the record
   colleagues read), and that update and delete are refused at the privilege level.

**Exit criteria**

- [ ] Every D4 leaf resolves; no stub renders a bare 404 or an empty page.
- [ ] `lib/auth/studio-nav.ts` is the only place any Studio route path is written down.
- [ ] All six roles verified against the access matrix, in e2e, not by inspection.
- [ ] All twelve primitives exist, are used by at least the Overview page, and are documented in `docs/studio/STUDIO_GUIDE.md`.
- [ ] Every FEAT §17 card is present in the registry with an owning phase; none displays a number it cannot source.
- [ ] Command palette is reachable by keyboard, closes on `Esc`, traps focus, and is announced to screen readers.
- [ ] `activity_events` insert path is service-role only; feed reads are permission-gated.
- [ ] Visual QA matrix (FEAT §45) passes for the shell at 1920/1440/1280/1024/768/430/390/360.
- [ ] Phase-specific D9 evidence: docs updated = `STUDIO_GUIDE.md`, `DATA_MODEL.md`; tests run = `test:unit`, `studio-rbac.spec.ts`; next phase = 06; known issues logged in `docs/SESSION-STATE.md`.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 06 — Cloudinary Media Architecture

**Goal** — Rivya gains one governed way to store, describe and deliver every non-code asset.
After this phase, media is a first-class database entity rather than a URL pasted into a field:
uploads are signed server-side and folder-constrained, delivery is responsive and format-negotiated,
videos have posters, 3D models carry the metadata a viewer will need in Phase 21, and every asset
records `alt_text`, `is_ai_generated` and `is_concept` as D6 requires. Cloudinary is reachable
only through `lib/media/`; no other module imports the Cloudinary SDK.

**Depends on** — Phase 03 (database), Phase 04 (RBAC), Phase 05 (Studio shell and primitives).

**Scope**

- `MediaProvider` interface and Cloudinary implementation; provider selected once in
  `lib/media/index.ts` so a future provider swap touches one file (D1: "Cloudinary behind a
  `MediaProvider` abstraction").
- Folder scheme taken from the manifest's `cloudinary_folder` values (23 folders, all under
  `rivya/`) plus the folders no AI asset occupies yet: products, brand, documents, models.
- Signed direct uploads: the browser never sees `CLOUDINARY_API_SECRET`; the sign endpoint
  enforces session, permission, folder allowlist, MIME allowlist and byte ceiling.
- Responsive transformation policy: named presets, `f_auto`/`q_auto`, DPR handling, a fixed
  width ladder, and the eight D6 ratios as crop targets.
- Video policy: adaptive format, derived poster frames, muted inline loop rules, reduced-motion
  and mobile fallbacks (FEAT §14, §46).
- `media_assets` extended to cover the six FEAT §13 Media Manager sections — Images, Videos,
  3D Models, Documents, AI Assets, Brand Assets — as one table, plus the 3D metadata field list
  from FEAT §13. Five of the six sections are a `kind` (`IMAGE·VIDEO·MODEL_3D·DOCUMENT·BRAND`);
  **AI Assets is not a kind** but a filter on `source = 'HIGGSFIELD'` across `IMAGE` and `VIDEO`,
  which is why its page is a Phase 07 deliverable and the enum has no AI value.
- The table itself is **not created here**. Phase 03 migration `0005_media_registry.sql` already
  created `media_assets` ("Phase 06 extends") and `0002_enums.sql` already created `media_kind`.
  Migration `0030` alters both; the exact deltas are in *Database* below.
- `media_usages` reverse index: which slot, on which entity, uses which asset. This is what makes
  "Missing Media" (FEAT §17) and Phase 07 gap detection computable rather than guessed.
- Studio Media Manager: `/studio/media/{all,images,videos,models,documents,brand}` filled.
  `/studio/media/higgsfield` remains a stub until Phase 07.
- `MediaImage` and `MediaVideo` render patterns so no page ever hand-writes a Cloudinary URL.

**Out of scope**

- Migrating the 250 Higgsfield assets — Phase 07. Phase 06 migrates three named canaries only.
- The 3D viewer itself (`components/three/`) — Phase 21; Phase 06 only stores model metadata.
- Bulk media operations (tag, move, archive in batches) — Phase 24.
- AI auto-tagging, background removal, or any new generation. No asset is created in this phase.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Provider contract | `lib/media/types.ts` | `MediaProvider`, `MediaRef`, `TransformSpec`, `SignedUpload` |
| Provider selector | `lib/media/index.ts` | `getMediaProvider()`; the only export other modules use |
| Cloudinary impl | `lib/media/providers/cloudinary.ts` | Only file importing `cloudinary` |
| Folder registry | `lib/media/folders.ts` | Literal allowlist + `assertFolder()`; generated check against manifest |
| Transform policy | `lib/media/transform.ts` | Presets, `srcSet()`, `ratioCrop()`, width ladder |
| Poster policy | `lib/media/poster.ts` | `posterFor(video)`: explicit `poster_public_id` else derived frame |
| Sign endpoint | `app/api/media/sign/route.ts` | POST, Zod, `media:upload`, returns signature + constraints |
| Upload client | `components/studio/MediaUploader.tsx` | Direct-to-Cloudinary, progress, alt-text required before save |
| Render patterns | `components/patterns/MediaImage.tsx`, `MediaVideo.tsx` | Server-first; `MediaVideo` client-only |
| Media Studio pages | `app/(studio)/studio/media/{all,images,videos,models,documents,brand}/page.tsx` | `DataTable` + detail drawer |
| Migration | `supabase/migrations/0030_phase06_media.sql` | **Alters** the Phase 03 `media_assets` registry and the Phase 03 `media_kind` enum; **creates** `media_source` and `media_usages`; RLS |
| Media docs | `docs/media/MEDIA_GUIDE.md`, `docs/media/CLOUDINARY.md` | Folder tree, presets, naming, provider contract |
| Provider tests | `tests/unit/media-transform.test.ts` | URL building, ratio crops, srcset, poster derivation |
| Upload e2e | `tests/e2e/media-upload.spec.ts` | Signed upload happy path + rejection paths |

The provider contract, fixed:

```ts
interface MediaProvider {
  signUpload(input: SignUploadInput): Promise<SignedUpload>;
  url(ref: MediaRef, spec?: TransformSpec): string;
  videoUrl(ref: MediaRef, spec?: VideoTransformSpec): string;
  posterUrl(ref: MediaRef, spec?: TransformSpec): string;
  probe(ref: MediaRef): Promise<ProviderMetadata>;   // bytes, width, height, duration, format
  move(ref: MediaRef, folder: string): Promise<MediaRef>;
  destroy(ref: MediaRef): Promise<void>;             // requires media:delete + ConfirmDialog
}
```

Folder tree (the first 23 are asserted equal to the distinct `cloudinary_folder` values in the
manifest; the remainder are reserved and empty at the end of this phase):

```
rivya/collection/{3d-resin,decor,gifts,preservation,wall-art}
rivya/interior
rivya/journal/{editorial,workshop}
rivya/large-format/{architectural,coffee,console,dining,seating,side}
rivya/material
rivya/portfolio/gallery
rivya/process/{cure,finish,mould,pigment,pour,studio,timber}
rivya/product/<product-slug>        reserved — Phase 14
rivya/models                        reserved — Phase 21 (GLB/GLTF, resource_type raw)
rivya/documents                     reserved — care guides, spec sheets
rivya/brand                         reserved — logo, wordmark, favicon, OG defaults
```

Transformation policy:

| Preset | Use | Transformation |
|---|---|---|
| `thumb` | Studio table rows | `c_fill,g_auto,w_160,f_auto,q_auto:eco` |
| `card` | Product/collection cards | `c_fill,g_auto,w_480,f_auto,q_auto:good` |
| `grid` | Gallery grids | `c_fill,g_auto,w_768,f_auto,q_auto:good` |
| `hero` | Section heroes | `c_fill,g_auto,w_1600,f_auto,q_auto:good` |
| `hero-xl` | Full-bleed 21:9 heroes | `c_fill,g_auto,w_2560,f_auto,q_auto:good` |
| `og` | Social cards | `c_fill,g_auto,w_1200,h_630,f_jpg,q_auto:good` |

Width ladder for `srcSet()`: `320, 480, 640, 768, 1024, 1280, 1536, 1920, 2560`. Delivery is
capped at 2560 px even though manifest sources reach 6336 px wide. Ratio crops are restricted to
the eight D6 ratios (21:9, 16:9, 4:3, 3:2, 1:1, 4:5, 3:4, 9:16); any other ratio throws.
Desktop and mobile are separate slots (D6) — `MediaImage` never crops one source into both.

Video policy: delivery `f_auto:video,q_auto,vc_auto`; poster is `poster_public_id` when set,
otherwise the first frame of the video resource delivered as an image (`so_0`) through the
`hero` preset. Inline video autoplays only when muted, `playsInline`, under 12 s, and
`prefers-reduced-motion: no-preference`; otherwise the poster renders with an explicit play
control. Manifest videos run 5–10 s at 768–1920 px wide, so all 26 qualify on duration.

**Database**

Migration `0030` is an **alter**, not a create. Phase 03 shipped `media_assets` in
`0005_media_registry.sql` annotated "(Phase 06 extends)", and `media_kind` in `0002_enums.sql`.
Recreating either would drop the Phase 03 `rivya_asset_id` unique constraint and duplicate the
enum, so `0030` does the following and nothing more:

| Step | Statement (shape) | Why |
|---|---|---|
| Rename `provider_public_id` | `alter table media_assets rename column provider_public_id to public_id` | Phase 06/07 and `lib/media/` use the Cloudinary term `public_id` throughout; one name, not two |
| Rename `storage_folder` | `alter table media_assets rename column storage_folder to folder` | Matches the manifest field `cloudinary_folder` and `lib/media/folders.ts` |
| Extend `media_kind` | `alter type media_kind add value if not exists '…'` for each of `IMAGE·VIDEO·MODEL_3D·DOCUMENT·BRAND` | The enum is owned by `0002_enums.sql`; `0030` only guarantees the five canonical values exist |
| Create `media_source` | `create type media_source as enum ('REAL','USER_UPLOAD','HIGGSFIELD','RENDER','FALLBACK')` | New in this phase; mirrors the D6 asset-priority ladder |
| Retype `source` | `alter table media_assets alter column source type media_source using source::media_source` | Phase 03 declared it `text`; the table is empty at this point (Phase 03: "`media_assets` is created empty"), so the cast cannot fail |
| Add columns | the descriptive, technical, governance, 3D and provenance columns listed below | Phase 03 shipped the D6 minimum only |
| **Retain** | `rivya_asset_id citext unique` exactly as `0005` created it | Correct: all 250 manifest `rivya_asset_id` values are distinct (verified — `[.assets[].rivya_asset_id] \| unique \| length` = 250). `0030` must not drop or weaken it |

`media_assets` after `0030` — identity: `id`, `rivya_asset_id citext unique`, `provider`,
`resource_type` (`image|video|raw`), `public_id`, `folder`, `filename`, `kind`, `source`.
Descriptive: `alt_text` (not null, non-empty — SEED §43), `title`, `caption`, `tags text[]`,
`subject_tags text[]`.
Technical: `mime_type`, `bytes`, `width`, `height`, `aspect_ratio`, `duration_s`,
`poster_public_id`, `checksum`.
Governance: `is_ai_generated bool not null`, `is_concept bool not null`,
`owner_verification` (D5 enum), `status` (D5 enum), `created_at`, `updated_at`, `updated_by`,
`uploaded_by`.
3D (FEAT §13): `model_format` (`GLB|GLTF`), `file_size_bytes`, `poly_count`, `texture_count`,
`model_thumbnail_id uuid`, `model_poster_id uuid`, `associated_product_id uuid null`,
`associated_project_id uuid null`.
Higgsfield provenance (populated in Phase 07): `higgsfield_generation_id`, `higgsfield_model`,
`higgsfield_prompt`, `manifest_version`, `migrated_at`.

Constraints that matter:

- `unique (rivya_asset_id)` — inherited from `0005`, unchanged. The Rivya asset ID is the
  authoritative key (D6), and the manifest generator asserts uniqueness before writing
  (`scripts/media/build-higgsfield-manifest.py` numbers images and videos from one shared counter
  namespace, per amendment A1).
- `unique (provider, resource_type, public_id)` rather than `unique (public_id)`. **All 250
  manifest `cloudinary_public_id` values are distinct today**, so a plain unique index on
  `public_id` would also hold. The wider key is chosen for forward compatibility only: Cloudinary
  namespaces `image` and `video` resources separately, so a future poster/clip pair uploaded under
  one public id is legal at the provider and must remain insertable here without a migration. No
  current row depends on the extra column.
- `unique (higgsfield_generation_id) where higgsfield_generation_id is not null`.
- `check (kind <> 'MODEL_3D' or model_format is not null)`.
- `check (char_length(trim(alt_text)) > 0)`.

`media_usages` — `id`, `media_id fk`, `context_type` (`PAGE_SECTION|PRODUCT|CATEGORY|
COLLECTION|PORTFOLIO|JOURNAL|GLOBAL|SEO`), `context_id uuid`, `slot_key text`,
`role` (`DESKTOP|MOBILE|POSTER|THUMBNAIL|GALLERY|OG`), `created_at`, `created_by`.
`unique (context_type, context_id, slot_key, role)`.

**One row per slot per role, and `slot_key` carries the index.** There is deliberately no
`position` column. A repeating media slot — a `GALLERY` role, or the per-card media of a
`category-grid`, or the per-step media of `process-steps` — mints one `slot_key` per item in the
generated indexed form `<slot>[<n>]`, zero-based: `gallery[0]`, `gallery[1]`, `cards[3].media`,
`steps[2].media`. Ordering is a property of the block's `payload`, which is the only thing that
may reorder items; `media_usages` is a reverse index, so its correct grain is the slot, not the
sequence. Consequences, all of them intended:

- The Phase 08 `sync_media_usages` trigger deletes every row for a context and rewrites the full
  set on each save, so a reorder cannot strand a row or collide on the unique key.
- `content/media-slots.ts` (Phase 07) declares a repeating slot once, as `gallery[]`; `computeGaps()`
  counts a repeating slot as unfilled only when it has **zero** rows, and as thin when it has fewer
  rows than the block's declared minimum.
- "Missing Media" (FEAT §17) reads `slot_key` directly and needs no join to recover which item of a
  gallery is empty.

RLS: public (anon) may `SELECT` `media_assets` only where `status = 'PUBLISHED'` (D5); staff
reads require `media:read`; writes require `media:upload`/`media:edit`; `DELETE` requires
`media:delete` and is additionally blocked by trigger when a `media_usages` row references the
asset. Nothing else grants anon read, so an asset bound to a section must reach `PUBLISHED`
before that section can render it publicly — Phase 08's publishing service performs that
promotion; see *Phase 07 — asset status on migration* and *Phase 08 — publishing service*.
`media_usages` is readable with `media:read` or `content:read` and written only by the Phase 08
trigger and the Studio media picker.

**Studio surface** — fills `/studio/media/all`, `/images`, `/videos`, `/models`, `/documents`,
`/brand`. Each is a filtered `DataTable` over `media_assets` with a detail drawer exposing alt
text, tags, governance flags, usage list (from `media_usages`) and, for `MODEL_3D`, the FEAT §13
metadata block. `/studio/media/higgsfield` still renders the Phase 07 stub.

**Public surface** — None. `app/api/media/sign` is Studio-only and rejects unauthenticated calls.

**Media** — Three canary assets from the manifest, used solely to prove the pipeline end to end,
migrated by hand through the Studio uploader's "import by URL" path. One image at each end of the
width range and the one video shape the poster policy has to survive:

| Rivya asset ID | Type | Ratio | Source dimensions | Proves |
|---|---|---|---|---|
| `PROCESS-STUDIO-001` | image | 4:3 | 4800 × 3584 | The 2560 px delivery cap and the width ladder on an oversize original |
| `LARGEFORMAT-MONUMENTAL-001` | image | 21:9 | — | The `hero-xl` preset and the widest D6 ratio |
| `LARGEFORMAT-DINING-004` | video | 9:16 | 768 × 1344, 6 s | `duration_s`, derived poster (`so_0`), and the muted-inline autoplay rule |

`LARGEFORMAT-DINING-004` is the video canary because it is the only 9:16 six-second video in the
`largeformat-dining` family; `LARGEFORMAT-DINING-001` in the same family is a 9:16 **image**
(1536 × 2752, `duration_s: null`) and would not exercise the video path at all. The remaining 247
assets wait for Phase 07. Nothing is generated.

**Risks**

| Risk | Mitigation |
|---|---|
| Cloudinary types leak across the codebase and defeat the abstraction | ESLint `no-restricted-imports` blocks `cloudinary` outside `lib/media/providers/**`; a unit test greps the built module graph |
| Signed uploads become an open upload endpoint | Endpoint requires session + `media:upload`, restricts `folder` to `lib/media/folders.ts`, restricts MIME to an allowlist, caps at 25 MB image / 200 MB video / 50 MB model, and rate-limits per user |
| `0030` recreates the Phase 03 registry and silently drops its `rivya_asset_id unique` constraint | `0030` contains no `create table media_assets` and no `create type media_kind`; a unit test asserts `pg_constraint` still holds a unique constraint on `media_assets (rivya_asset_id)` after every migration replays from clean, and CI greps `0030` for `create table media_assets` |
| A future poster/clip pair sharing one Cloudinary public id needs a migration to insert | The unique key is already `(provider, resource_type, public_id)`; a unit test inserts an `image` and a `video` row under one synthetic public id and asserts both persist. No manifest row exercises this — all 250 public ids are distinct — so the test uses fixtures, not manifest data |
| Full-resolution originals delivered to phones | Width ladder caps at 2560; `MediaImage` requires `sizes`; a Playwright assertion checks no delivered image exceeds 2560 px at the 390 px viewport |
| Alt text left blank and never revisited | `alt_text` is `not null` with a non-empty check; the uploader cannot save without it |
| Deleting an in-use asset silently breaks a page | Delete trigger refuses while `media_usages` rows exist; the drawer shows usages before offering delete, behind `ConfirmDialog` |

**Verification**

1. `npx supabase db push` then `npm run test:unit -- media-transform` — presets, srcset, ratio
   crop rejection for a non-D6 ratio, and poster derivation all pass.
2. `curl -X POST $NEXT_PUBLIC_SITE_URL/api/media/sign -d '{"folder":"rivya/etc"}'` with no
   session → 401; with an editor session and a folder outside the allowlist → 422.
3. Upload a JPEG through `/studio/media/images`; assert a `media_assets` row with correct
   `width`, `height`, `bytes`, `aspect_ratio` and a non-empty `alt_text`, and that the file lands
   in the requested folder in Cloudinary.
4. Import the three canaries. Assert `LARGEFORMAT-DINING-004` stores `resource_type = 'video'`,
   `duration_s = 6`, `aspect_ratio = '9:16'` and renders a derived `so_0` poster; assert
   `PROCESS-STUDIO-001` (4800 px wide) delivers no candidate above 2560 px; assert all three rows
   carry `is_ai_generated = true` and `is_concept = true`.
5. `psql "$DATABASE_URL" -c "select conname from pg_constraint where conrelid =
   'media_assets'::regclass and contype = 'u'"` — the Phase 03 unique constraint on
   `rivya_asset_id` is still listed after `0030`, alongside `(provider, resource_type, public_id)`.
6. Open `/studio/media/models`, create a `MODEL_3D` row without `model_format` → the check
   constraint rejects it.
7. Attempt to delete an asset that has a `media_usages` row → refused with a readable message.
8. Playwright at 390 px on a page rendering `MediaImage`: assert the chosen `srcset` candidate is
   ≤ 1024 px and the response `content-type` is `image/avif` or `image/webp`.

**Exit criteria**

- [ ] Cloudinary is imported in exactly one file; lint rule enforces it.
- [ ] All 23 manifest folders exist in `lib/media/folders.ts` and match the manifest exactly (asserted by test).
- [ ] Sign endpoint rejects: no session, wrong role, disallowed folder, disallowed MIME, oversize.
- [ ] Five FEAT §13 sections — Images, Videos, 3D Models, Documents, Brand — plus the `/all` view render, filter and paginate correctly; a section with no rows renders its `EmptyState`, not a blank table. The sixth section, AI Assets (`/studio/media/higgsfield`), is delivered in Phase 07 and renders the Phase 07 stub here.
- [ ] Migration `0030` alters the Phase 03 registry: no `create table media_assets`, no `create type media_kind`, and `media_assets (rivya_asset_id)` is still unique after a clean replay.
- [ ] 3D metadata fields from FEAT §13 all exist and are editable in the model drawer.
- [ ] Videos render posters with no layout shift; reduced-motion suppresses autoplay.
- [ ] `media_usages` is written by at least one real path, uses the indexed `slot_key` form for a repeating slot, and is readable in the asset drawer.
- [ ] Three canary assets (`PROCESS-STUDIO-001`, `LARGEFORMAT-MONUMENTAL-001`, `LARGEFORMAT-DINING-004`) are live in Cloudinary and in `media_assets` with `is_ai_generated = true`, `is_concept = true`, `owner_verification = OWNER_VERIFICATION_REQUIRED`.
- [ ] Phase-specific D9 evidence: docs updated = `MEDIA_GUIDE.md`, `CLOUDINARY.md`, `DATA_MODEL.md`; tests run = `media-transform`, `media-upload.spec.ts`; next phase = 07.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 07 — Higgsfield Asset Audit + Initial Asset Plan

**Goal** — the 250 already-generated Higgsfield assets stop being an external CDN dependency and
become Rivya's own governed library. The audit half of this phase is already done: the manifest
at `data/higgsfield/asset-manifest.json` (`manifest_version: rivya-hf-v1`, 250 assets, 224 images
and 26 videos across 24 families) was produced by `scripts/media/build-higgsfield-manifest.py`.
What remains is migration into Cloudinary and the database, a Studio tracker that makes the
inventory legible and editable, and a gap report that names every CMS slot with no asset behind
it — so that Phases 09–20 can see exactly what is missing without anyone regenerating what already
exists.

**Depends on** — Phase 05 (Studio shell), Phase 06 (`MediaProvider`, folders, `media_assets`,
`media_usages`).

**Scope**

- Migration script moving all 250 assets from their Higgsfield CDN `source_url` into the
  Cloudinary folder and public id the manifest already assigns, and inserting the matching
  `media_assets` rows with full provenance.
- Idempotency and resumability. Three manifest fields are unique across all 250 rows, and the
  migration relies on all three, for different reasons:

  | Field | Unique? | Role |
  |---|---|---|
  | `higgsfield_generation_id` | yes (250/250) | **The migration key.** The ledger and the resume logic are keyed by it because it is stable across a manifest rebuild — renumbering a family changes `rivya_asset_id`, but not the generation that produced the pixels |
  | `rivya_asset_id` | yes (250/250) | The authoritative business key (D6). Maps 1:1 onto the Phase 03 `rivya_asset_id citext unique` column with no composite and no disambiguator |
  | `cloudinary_public_id` | yes (250/250) | The provider address. Inserted as `public_id`; the wider `(provider, resource_type, public_id)` index is forward compatibility, not a manifest requirement |

  Verify before writing the script, not after: `jq '[.assets[].rivya_asset_id] | unique | length'`
  and the same over `.cloudinary_public_id` and `.higgsfield_generation_id` each return `250`.
- The manifest is treated as read-only input. Runtime status lives in `media_assets`; migration
  progress lives in `data/higgsfield/migration-log.json`. The Python builder is never re-run as
  part of this phase.
- Studio Higgsfield tracker at `/studio/media/higgsfield` with the FEAT §34 inventory columns.
- Gap detection: a declared slot registry joined against `media_usages`, producing the list of
  CMS slots that no asset fills, grouped by page.
- Regeneration guard: a script and a UI rule that make "generate this again" impossible for
  anything already in the manifest (D6, FEAT §33, manifest `policy.rules[4]`).
- Regenerated documentation: `docs/media/HIGGSFIELD_ASSET_STATUS.md` (machine-written inventory)
  and `docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md` (hand-written briefs for gaps **only**).

**Out of scope**

- Generating any new asset. The master plan writes briefs; it does not call Higgsfield.
- Binding assets to CMS sections — that is Phase 09, using this phase's tracker and gap list.
- Alt-text finalisation: `alt_text_draft` is imported as a draft and stays
  `OWNER_VERIFICATION_REQUIRED` until an editor rewrites it.
- Product photography, brand assets and 3D models — none exist in the manifest.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Migration script | `scripts/media/migrate-higgsfield.ts` | `--dry-run`, `--family=`, `--limit=`, `--resume`; idempotent |
| Migration ledger | `data/higgsfield/migration-log.json` | Keyed by `higgsfield_generation_id`; committed |
| Regeneration guard | `scripts/media/assert-no-regeneration.ts` | Fails if a requested brief matches a manifest asset |
| ID-collision guard | `scripts/media/check-asset-ids.py` | **Already exists.** Wired into CI and into the migration script's preflight in this phase, per D6/A1: a gap ID may never reuse a manifest family prefix |
| Slot registry | `content/media-slots.ts` | Declared CMS media slots: page, section, slot key, ratios |
| Gap engine | `lib/media/gaps.ts` | `computeGaps()` → unfilled slots + thin families |
| Tracker page | `app/(studio)/studio/media/higgsfield/page.tsx` | Tabs: Inventory · Families · Gaps |
| Asset drawer | `components/studio/HiggsfieldAssetDrawer.tsx` | Prompt, model, generation id, placement, no regenerate control |
| Status doc generator | `scripts/media/build-asset-status.ts` | Writes `docs/media/HIGGSFIELD_ASSET_STATUS.md` |
| Asset status | `docs/media/HIGGSFIELD_ASSET_STATUS.md` | Generated; never hand-edited |
| Master asset plan | `docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md` | Briefs for gaps only, each marked `NEW_GENERATION_REQUIRED` |
| Higgsfield guide | `docs/media/HIGGSFIELD_GUIDE.md` | Priority ladder, naming, governance, tracker usage |
| Migration audit table | `supabase/migrations/0040_phase07_higgsfield.sql` | `higgsfield_migration_runs` |
| Tests | `tests/unit/higgsfield-migration.test.ts`, `tests/e2e/higgsfield-tracker.spec.ts` | Idempotency, key collisions, tracker filters |

Migration mapping, field by field:

| Manifest field | Destination |
|---|---|
| `cloudinary_public_id`, `cloudinary_folder` | `media_assets.public_id`, `.folder` (unchanged; the manifest is authoritative — D6) |
| `type` | `resource_type` (`image`/`video`) and `kind` (`IMAGE`/`VIDEO`) |
| `rivya_asset_id` | `media_assets.rivya_asset_id` — the Phase 03 `citext unique` column, used as-is; all 250 values are distinct |
| `filename` | `media_assets.filename` (also unique across the 250; a human-readable secondary key, never the identity — D6) |
| `family`, `subject_tags` | `tags` (family) and `subject_tags` |
| `page`, `section` | `media_assets.tags` as `page:<page>` / `section:<section>`; drives tracker filters |
| `aspect_ratio`, `width`, `height`, `duration_s` | matching technical columns |
| `source_url` | fetched by the uploader; **not** stored as a delivery URL |
| `higgsfield_generation_id`, `higgsfield_model`, `prompt` | `higgsfield_generation_id`, `higgsfield_model`, `higgsfield_prompt` |
| `alt_text_draft` | `alt_text` (draft), with `owner_verification = OWNER_VERIFICATION_REQUIRED` |
| `is_ai_generated`, `is_concept` | copied verbatim; both `true` for all 250 |
| `manifest_version` | `media_assets.manifest_version = 'rivya-hf-v1'` |
| — | `source = 'HIGGSFIELD'`, `status = 'APPROVED'`, `migrated_at = now()` |

**Asset status on migration.** Assets are seeded `APPROVED`, not `PUBLISHED`. They are concept
media: reviewed enough to bind to a slot, not yet cleared for public delivery. The Phase 06 RLS
rule grants anon `SELECT` on `media_assets` only where `status = 'PUBLISHED'` (D5), so an
`APPROVED` asset is invisible to the public site until something promotes it. That promotion is
**not** implicit and it is not a side effect of `page_sections.status` changing — it is an
explicit step in `lib/cms/publishing.ts` (Phase 08):

> When a `page_sections` row transitions to `PUBLISHED`, in the same transaction, every
> `media_assets` row reached through that section's `media_usages` rows whose `status` is
> `APPROVED` is promoted to `PUBLISHED`, with `updated_by` set to the publishing actor and one
> `activity_events` row per promotion. An asset still in `DRAFT`, `REVIEW` or `ARCHIVED` is **not**
> auto-promoted: the publish is refused and the error names the offending `rivya_asset_id`, exactly
> as it is refused for an unverified owner-verification claim.

Unpublishing a section does **not** demote its assets — an asset may be bound to several sections,
and silently pulling it from under another published page would break that page. An asset is
demoted only by an explicit `Unpublish` action in the Media Manager, which is refused while any
`PUBLISHED` section still references it (the same guard shape as the delete trigger).

Without this rule Phase 09 would seed and publish sections whose media rows are unreadable by
anon, and Phase 10 would render copy with a missing image and no error anywhere.

Gap detection, from the manifest as it stands. These are facts derived from the manifest's
`by_page` and `cloudinary_folder` distributions, not assumptions:

| Public surface | Manifest coverage | Gap |
|---|---|---|
| `/` hero (video + poster) | 0 assets with `page = home` are video; 5 `interior-lifestyle` stills only | `HOME-HERO-VIDEO-001`, `HOME-HERO-POSTER-001` |
| `/collection` landing | 0 assets — the manifest has per-category pages only | collection landing hero |
| `/collection/furniture` | no family maps to `collection/furniture` | category hero + cards |
| `/collection/collectible-design` | no family maps to `collection/collectible-design` | category hero + cards |
| `/custom-commissions` | 0 assets | hero + supporting |
| `/contact`, `/faq`, `/search` | 0 assets | hero or neutral surface |
| `/large-format` coffee tables | `largeformat-coffee` = 1 asset | thin; needs desktop + mobile ratios |
| `/large-format` architectural | `largeformat-monumental` = 1 asset (21:9) | thin; no 4:5 mobile variant |
| Journal article covers | 24 `editorial`/`workshop-session` assets for 10 seeded drafts (SEED §20) | covered |
| Portfolio projects | 5 `gallery-scene` assets, atmosphere only | no project media — empty state stands (D10) |

Well-covered surfaces, for contrast: `process` (79 assets across 7 families), `about`
(39 `material-macro`), `collection/wall-statement-art` (20), `collection/decor` (18),
`collection/preservation` (19), `collection/3d-resin` (13), `collection/gifts` (10).

**Database** — one new table, `higgsfield_migration_runs`: `id uuid pk`, `started_at`,
`finished_at`, `manifest_version`, `requested_scope text`, `attempted int`, `migrated int`,
`skipped int`, `failed int`, `dry_run bool`, `run_by uuid`, `log jsonb`. No changes to
`media_assets` beyond populating columns Phase 06 declared. RLS: readable with `media:read`,
insertable by service role only.

**Studio surface** — fills `/studio/media/higgsfield`. **Inventory** tab: `DataTable` with the
FEAT §34 columns — Asset ID, Type, Family, Page, Section, Purpose, Source, Higgsfield model,
Prompt (truncated, full in drawer), Status, Used?, Cloudinary location, CMS placement — filterable
by family, page, aspect ratio, migration status and used/unused. **Families** tab: the 24 families
with counts, image/video split and available ratios. **Gaps** tab: `computeGaps()` output grouped
by page with a "Copy brief to master plan" action. Every view carries the banner: *"Concept media.
Never presented as completed, delivered Rivya work."* (manifest `policy.rules[0]`, SEED §40.)

**Public surface** — None.

**Media** — all 24 families, all 250 assets: `decor` 18, `editorial` 19, `gallery-scene` 5,
`gifts` 10, `interior-lifestyle` 5, `largeformat-coffee` 1, `largeformat-console` 4,
`largeformat-dining` 5, `largeformat-monumental` 1, `largeformat-seating` 4, `largeformat-side` 3,
`material-macro` 39, `preservation-keepsake` 4, `preservation-varmala` 15, `process-cure` 8,
`process-finish` 8, `process-mould` 12, `process-pigment` 13, `process-pour` 12, `process-studio`
19, `process-timber` 7, `three-d-resin` 13, `wall-art` 20, `workshop-session` 5.

**Risks**

| Risk | Mitigation |
|---|---|
| Re-running the script duplicates assets or overwrites Cloudinary originals | Ledger keyed by `higgsfield_generation_id`; upload uses `overwrite: false` with the manifest public id; a second run reports 250 skipped and writes no rows |
| A future manifest rebuild renumbers a family and the migration re-imports assets under new IDs | The ledger key is `higgsfield_generation_id`, which survives renumbering; `rivya_asset_id` is updated in place on a matched generation id rather than inserted afresh. A unit test rebuilds a fixture manifest with a shifted family counter and asserts the run reports 250 skips and zero inserts |
| A planned (GAP) asset ID minted in this phase collides with a manifest family prefix | `python3 scripts/media/check-asset-ids.py` runs **before** `media:migrate:higgsfield` and in CI, per D6 as amended by A1; it fails on any gap ID of the form `<FAMILY>-<NNN>` and requires the `<PAGE>-<SECTION>[-<KIND>]-<NNN>` form instead |
| A Higgsfield CDN URL expires mid-migration | `--resume` continues from the ledger; failures are recorded per asset with the HTTP status; the run summary lists them and exits non-zero |
| Someone regenerates an asset that already exists | `assert-no-regeneration.ts` runs in CI over `HIGGSFIELD_MASTER_ASSET_PLAN.md` and fails if any brief's target matches a manifest `rivya_asset_id` or `family`+`section` already at target count; the tracker has no generate control |
| Draft alt text ships as final and reads like a prompt | Alt text imported as draft, flagged `OWNER_VERIFICATION_REQUIRED`; the Gaps tab counts unreviewed alt text; Phase 09 exit criteria requires review of every alt text bound to a seeded slot |
| Concept media is read as a real delivered project | Persistent banner, `is_concept = true` on every row, portfolio stays an empty state, and no seeded copy describes these images as completed work (D10) |

**Verification**

1. `python3 scripts/media/check-asset-ids.py` — exits 0. D6 (as amended by A1) requires this
   **before any media migration** and in CI: it fails if any planned/GAP asset ID written into
   `docs/**` reuses a manifest family prefix, which would collide the moment that family grows.
   Run it first; a failing run blocks every step below.
2. `npm run media:migrate:higgsfield -- --dry-run` — reports `attempted 250, migrated 0,
   skipped 0, failed 0` and writes nothing.
3. `npm run media:migrate:higgsfield` — completes with `migrated 250, failed 0`.
4. Re-run the same command — reports `skipped 250, migrated 0`; `select count(*) from
   media_assets where source = 'HIGGSFIELD'` still returns 250.
5. `psql "$DATABASE_URL" -c "select count(*) from media_assets where source='HIGGSFIELD' and
   resource_type='video'"` → 26; images → 224.
6. Identity holds — three queries, all of which must return **zero rows**:
   `select public_id, count(*) from media_assets group by 1 having count(*) > 1`;
   `select rivya_asset_id, count(*) from media_assets group by 1 having count(*) > 1`;
   `select higgsfield_generation_id, count(*) from media_assets where higgsfield_generation_id is
   not null group by 1 having count(*) > 1`. The manifest has no duplicate in any of the three, so
   any row returned means the migration invented one.
7. Open `/studio/media/higgsfield`; filter Family = `material-macro` → 39 rows; Page = `process`
   → 79 rows; Type = video → 26 rows.
8. Open the Gaps tab; assert `/`, `/collection`, `/collection/furniture`,
   `/collection/collectible-design`, `/custom-commissions`, `/contact` and `/faq` all appear.
9. `npm run media:assert-no-regen` — passes; then add a brief for `WALL-ART-001` to the master
   plan and re-run — it fails with a non-zero exit and names the offending asset.
10. `npm run media:build-status && git diff --exit-code docs/media/HIGGSFIELD_ASSET_STATUS.md` —
    the generated document is up to date.

**Exit criteria**

- [ ] All 250 manifest assets exist in Cloudinary under their manifest `cloudinary_public_id`.
- [ ] All 250 have `media_assets` rows with `is_ai_generated = true`, `is_concept = true`, `source = 'HIGGSFIELD'`, `manifest_version = 'rivya-hf-v1'` and non-empty draft alt text.
- [ ] The migration is provably idempotent (a second full run changes nothing).
- [ ] `media_assets` holds 250 `HIGGSFIELD` rows with 250 distinct `rivya_asset_id`, 250 distinct `public_id` and 250 distinct `higgsfield_generation_id` values — no duplicate in any of the three, matching the manifest exactly.
- [ ] All 250 are `status = 'APPROVED'`, `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`, and **none** is `PUBLISHED` — promotion happens only through the Phase 08 publishing service.
- [ ] The tracker shows every FEAT §34 column and offers no regeneration control anywhere.
- [ ] `computeGaps()` returns the gap list above, and the master plan carries a brief for each.
- [ ] `data/higgsfield/asset-manifest.json` is byte-identical to its pre-phase state.
- [ ] Both asset guards are wired into CI and into `npm run check`: `scripts/media/assert-no-regeneration.ts` (nothing in the manifest is ever regenerated — D6, FEAT §33, manifest `policy.rules[4]`) and `python3 scripts/media/check-asset-ids.py` (no planned ID reuses a manifest family prefix — D6 as amended by A1, which also requires it before any media migration).
- [ ] Phase-specific D9 evidence: docs updated = `HIGGSFIELD_GUIDE.md`, `HIGGSFIELD_ASSET_STATUS.md`, `HIGGSFIELD_MASTER_ASSET_PLAN.md`, `MEDIA_GUIDE.md`; tests run = `higgsfield-migration`, `higgsfield-tracker.spec.ts`; next phase = 08.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 08 — CMS / Editable Content System

**Goal** — Rivya's website copy stops living in code. This phase builds the page-block model: a
page is an ordered list of typed blocks, each block is a Zod-validated schema with a renderer in
`components/sections/` and an editor form in Studio, and each block carries the SEED §5 field set
plus governance metadata — status, fact classification, owner-verification flag, revision history
and schedule. After this phase an editor can add, reorder, hide, edit, preview, schedule, publish
and unpublish any section of any page without a deploy, and can see exactly what changed, when
and by whom. Nothing is seeded yet; Phase 09 fills it.

**Depends on** — Phase 03, 04, 05 (Studio primitives), 06 (media picker and `media_usages`).

**Scope**

- Page-block data model: `pages`, `page_sections`, `content_revisions`, plus the singleton-ish
  content tables the seed needs — `navigation_items`, `global_content`, `seo_entries`, `faqs`.
- Block registry `lib/cms/registry.ts`: block type → Zod schema (`content/blocks/<type>.ts`) →
  renderer (`components/sections/<Type>.tsx`, 1:1 per D2) → Studio editor → defaults → declared
  media slots → allowed page kinds. Registering a block is one file plus one registry line.
- SEED §5 section fields on every block: eyebrow, heading, heading highlight, body, supporting
  copy, CTA label, CTA URL, secondary CTA, desktop media, mobile media, media alt override,
  visibility, order, theme, layout variant, publish/unpublish schedule.
- Status workflow across the D5 enum with explicit transitions and permissions.
- Fact classification (D5, SEED §3) at block level with per-field overrides, and the
  `owner_verification` flag (D5, SEED §2) surfaced in every editor.
- Revision history (SEED §53): every mutation appends an immutable snapshot; any revision can be
  restored, which itself appends a revision.
- Scheduling (SEED §52): `publish_at` / `unpublish_at` honoured by a cron route that also
  revalidates affected paths.
- Preview (SEED §52): draft-mode preview of an unpublished page at its real public path.
- Page resolver `lib/cms/resolve.ts` — the single server API Phase 10 will call.

**Out of scope**

- Writing any copy — Phase 09. Phase 08 ships an empty CMS with a complete editor.
- Public rendering of pages — Phase 10 onward. Renderers exist and are unit-tested in isolation.
- Portfolio, journal and testimonial *domain* tables (projects, articles, authors) — Phases 17,
  18 and their editors. Phase 08 delivers their landing-page blocks and the generic engine only.
- Product content — Phases 14–15. Products are not `pages`.
- Localisation, A/B variants, personalisation.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Block schemas | `content/blocks/<type>.ts` | One file per block; exports `schema`, `defaults`, `mediaSlots` |
| Block registry | `lib/cms/registry.ts` | Type-safe map; `getBlock(type)`; exhaustive at compile time |
| Renderers | `components/sections/<Type>.tsx` | 1:1 with block types (D2); render `section.*`, never literals |
| Studio editors | `components/studio/blocks/<Type>Editor.tsx` | Generated from the shared field set + block extras |
| Page resolver | `lib/cms/resolve.ts` | `resolvePage(path, { draft })` → ordered, visible, in-window blocks |
| Publishing service | `lib/cms/publishing.ts` | Transition guard, bound-media promotion, revision write, revalidation |
| Revision service | `lib/cms/revisions.ts` | `snapshot()`, `listRevisions()`, `restore()` |
| Schedule cron | `app/api/cron/content-schedule/route.ts` | `REVALIDATE_SECRET`-guarded; runs every 5 min; calls the same `publishSection()` as a manual publish, so scheduled publishes promote bound media identically |
| Preview entry | `app/api/preview/route.ts` | Signed token → `draftMode().enable()` → redirect to path |
| Pages editor | `app/(studio)/studio/content/pages/page.tsx`, `[pageId]/page.tsx` | List + block editor. `[pageId]` accepts a uuid **or** a `pages.slug`, so a reserved system page is reachable by a stable, human-typable path |
| Global content editor | *(no new file)* — the `pages` row `slug = 'global'`, `kind = 'SYSTEM'` rendered by `[pageId]/page.tsx` | The `global_content` editor is a mode of the existing block editor, keyed off `kind = 'SYSTEM'`. **No `pages/global/page.tsx`**: a static segment there would both add a Studio leaf D4 does not list and shadow the `[pageId]` dynamic segment |
| Other content editors | `app/(studio)/studio/content/{homepage,navigation,footer,seo,faqs}/page.tsx` | Thin wrappers over the same engine |
| Migrations | `supabase/migrations/0050_phase08_cms.sql`, `0051_phase08_cms_rls.sql` | Tables, enums, triggers, policies |
| Content guide | `docs/content/CONTENT_GUIDE.md` | Block catalogue, field meanings, workflow, who may publish |
| Data model update | `docs/architecture/DATA_MODEL.md` | CMS section |
| Tests | `tests/unit/cms-registry.test.ts`, `tests/unit/cms-resolve.test.ts`, `tests/e2e/cms-workflow.spec.ts` | Parity, windowing, full editorial workflow |

Block catalogue (each has a schema, a renderer and an editor; source column cites SEED):

| Block type | Source | Primary use |
|---|---|---|
| `hero` | §10-01, §11, §12, §13, §15, §16, §17, §18, §21 | Page opener; desktop + mobile media, two CTAs |
| `manifesto` | §10-02 | Long-form brand statement with CTA |
| `category-grid` | §10-03 | Cards: title, description, CTA, media slot each |
| `selected-works` | §10-04 | Curated entity references; empty state when none |
| `material-story` | §10-05 | Editorial + macro media |
| `material-palette` | §10-06 | Four labelled material cards (Resin, Wood, Fabricated Form, Finish) |
| `commission-cta` | §10-07, §15 CTA | Commission prompt band |
| `three-d-resin` | §10-08 | 3D + resin narrative; optional model slot (Phase 21) |
| `portfolio-strip` | §10-09 | Project references; empty state by default (D10) |
| `process-steps` | §10-10, §16 | Numbered steps, each with copy and media slot |
| `secondary-objects` | §10-11 | Décor / gifts / preservation cross-links |
| `journal-strip` | §10-12 | Latest articles; empty state when none |
| `final-cta` | §10-13 | Closing conversion band |
| `statement` | §11 philosophy, closing | Eyebrow + heading + body |
| `scale-statement` | §11 scale | Scale narrative with 21:9 media |
| `category-intro` | §12, §14 | Category framing copy |
| `category-list` | §12, §13 order | Ordered named categories with descriptions |
| `customization-note` | §12 customization | Customization framing; `OWNER_VERIFICATION_REQUIRED` by default |
| `checklist` | §15 who it is for, what to share | Titled list items |
| `numbered-steps` | §15 how it works | Four-step commission flow |
| `faq-list` | §23 | Renders `faqs` filtered by category |
| `contact-details` | §21 | Phone, WhatsApp, email, location — all `OWNER_VERIFICATION_REQUIRED` |
| `contact-form` | §22 | Field set and enquiry types; submits to Phase 20 |
| `empty-state` | §27, §28, §29 | Reusable empty surface |
| `rich-text` · `media-split` · `quote` · `divider` | generic | Editor-composable fallbacks |

Status workflow — allowed transitions and the permission each requires:

| From | To | Permission |
|---|---|---|
| `DRAFT` | `REVIEW` | `content:write` |
| `REVIEW` | `DRAFT`, `APPROVED` | `content:review` |
| `APPROVED` | `PUBLISHED`, `DRAFT` | `content:publish` |
| `PUBLISHED` | `ARCHIVED`, `DRAFT` (unpublish) | `content:publish` |
| `ARCHIVED` | `DRAFT` | `content:write` |

Any other transition is rejected by `lib/cms/publishing.ts` and by a DB trigger, so an API caller
cannot skip review. Publishing a section whose `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`
is refused with a message naming the field; the editor must either set `VERIFIED` (owner/admin
only) or remove the claim.

**Bound media are promoted with the section.** The Phase 06 RLS rule gives anon `SELECT` on
`media_assets` only where `status = 'PUBLISHED'`, and Phase 07 migrates all 250 Higgsfield assets
as `APPROVED`. Publishing a section therefore has a second, explicit half, performed by
`publishSection()` in the same transaction as the status write and repeated verbatim by the
schedule cron:

| Bound asset's status | On section → `PUBLISHED` |
|---|---|
| `APPROVED` | Promoted to `PUBLISHED`; `updated_by` = the publishing actor; one `activity_events` row per promotion (`action: 'media.publish.cascade'`) |
| `PUBLISHED` | Left alone |
| `DRAFT` · `REVIEW` · `ARCHIVED` | **The publish is refused**, with the offending `rivya_asset_id` values named in the error — the same refusal shape as an unverified owner-verification claim. Media that has not been reviewed never reaches the public site as a side effect of publishing copy |

The set of bound assets is read from `media_usages` for that section (`context_type =
'PAGE_SECTION'`), which is exactly what `sync_media_usages` maintains, so `media_desktop_id`,
`media_mobile_id` and every `payload` media reference are covered by one query.

Unpublishing is deliberately asymmetric: `PUBLISHED → DRAFT` or `→ ARCHIVED` does **not** demote
any asset, because an asset may be bound to several sections and demoting it would break the
others without warning. An asset is demoted only by an explicit `Unpublish` in the Media Manager,
which `lib/cms/publishing.ts` refuses while any `PUBLISHED` section still references it — the same
guard shape as the Phase 06 delete trigger.

**Database**

| Table | Key columns |
|---|---|
| `pages` | `id`, `slug citext unique`, `path unique null`, `kind` (`PAGE·CATEGORY·SYSTEM`), `title`, `status`, `publish_at`, `unpublish_at`, `seo_entry_id`, `is_system bool`, `seed_key`, `content_seed_version`, `owner_edited bool default false`, `created_at`, `updated_at`, `updated_by`, `published_at`, `published_by`; `check (kind = 'SYSTEM' or path is not null)` |
| `page_sections` | `id`, `page_id fk`, `block_type text`, `position int`, `is_visible bool`, `theme text`, `layout_variant text`, `eyebrow`, `heading`, `heading_highlight`, `body`, `supporting`, `cta_label`, `cta_url`, `cta_secondary_label`, `cta_secondary_url`, `media_desktop_id fk media_assets`, `media_mobile_id fk media_assets`, `media_alt_override`, `payload jsonb` (block-specific, Zod-validated), `fact_classification`, `field_classifications jsonb`, `owner_verification`, `status`, `publish_at`, `unpublish_at`, `seed_key`, `content_seed_version`, `owner_edited`, audit columns |
| `content_revisions` | `id`, `entity_type`, `entity_id`, `revision_no int`, `action` (`CREATE·UPDATE·STATUS_CHANGE·RESTORE·DELETE`), `snapshot jsonb`, `change_summary`, `created_at`, `created_by`; `unique (entity_type, entity_id, revision_no)`; append-only |
| `navigation_items` | `id`, `menu` (`HEADER·FOOTER·MOBILE·CATEGORY`), `parent_id`, `label`, `href`, `position`, `is_visible`, `target`, `status`, `seed_key`, audit columns |
| `global_content` | `id`, `group` (`CTA·COMMERCE_LABEL·ACTION_LABEL·EMPTY_STATE·FORM_COPY·ANNOUNCEMENT·WHATSAPP_TEMPLATE·STUDIO_HELP·SEO_DEFAULT·SOCIAL·NEWSLETTER`), `key`, `label`, `value text`, `description`, `is_enabled bool`, `fact_classification`, `owner_verification`, `status`, `seed_key`, audit columns; `unique (group, key)` |
| `seo_entries` | `id`, `scope` (`GLOBAL·PATH·ENTITY`), `path`, `entity_type`, `entity_id`, `title`, `description`, `social_title`, `social_description`, `og_media_id`, `canonical_url`, `robots`, `status`, `seed_key`, audit columns |
| `faqs` | `id`, `question`, `answer`, `category`, `position`, `status`, `owner_verification`, `fact_classification`, `seed_key`, audit columns |

Triggers: `set_updated_at`; `write_revision` (after insert/update on `pages`, `page_sections`,
`navigation_items`, `global_content`, `faqs`); `set_owner_edited` (sets `owner_edited = true`
whenever `updated_by is not null`, which is how the Phase 09 seed distinguishes its own writes
from a human's); `enforce_status_transition`; `sync_media_usages` (maintains `media_usages` rows
for `media_desktop_id`, `media_mobile_id` and `payload` media references).

RLS: anon may `SELECT` where `status = 'PUBLISHED'` and the schedule window is open (D5); staff
reads require `content:read`; writes require `content:write`; status transitions require the
permissions in the table above. `content_revisions` is insert-only via trigger, `SELECT` for
`content:read`, no `UPDATE`/`DELETE` policy.

**Studio surface** — fills `/studio/content/pages` (list + `[pageId]` block editor with drag
reorder, per-section status pill, media picker, revision drawer, preview button),
`/studio/content/homepage` (the homepage pinned into the same editor),
`/studio/content/navigation`, `/studio/content/footer`, `/studio/content/seo`,
`/studio/content/faqs`. `/studio/content/{portfolio,journal,testimonials}` remain stubs pointing
at Phases 17–18.

Global content — the CTA library, commerce and action labels, announcement bar, empty states, form
copy and Studio helper text — is edited at **`/studio/content/pages/global`**, which is the
existing `[pageId]` dynamic segment resolving a reserved row, not a new route leaf:

- `resolveStudioPage(param)` in `lib/cms/resolve.ts` looks the parameter up by `id` when it parses
  as a uuid and by `pages.slug` otherwise. The reserved row is `slug = 'global'`, `kind = 'SYSTEM'`,
  `is_system = true`, `path = null` (`pages.path` is nullable and `check (kind = 'SYSTEM' or path is
  not null)` keeps every non-system page addressable). `lib/cms/resolve.ts` ignores rows with a null
  `path` when resolving a public request, so a system page can never be served to the site.
- There is **no** `app/(studio)/studio/content/pages/global/page.tsx`. A static `global` segment
  would take precedence over `[pageId]` in the App Router and would add a Studio route leaf the D4
  map does not list. Reaching the same URL through the dynamic segment keeps the D4 `content/pages`
  leaf as the only leaf, and keeps `lib/auth/studio-nav.ts` the single place a Studio path is
  written down (Phase 05 exit criterion) — the nav manifest carries one deep-link entry to
  `/studio/content/pages/global` under Content.
- `kind = 'SYSTEM'` switches the block editor into `global_content` mode: grouped key/value rows
  with `is_enabled`, fact classification and owner-verification, rather than an ordered block list.

This is a route **path** SEED §7 asks for (`Website → Global Content → CTA Library`) served by a
D4 route **segment** that already exists. See *Open questions* for the suggested D4 clarification.

**Public surface** — None rendered. Two API routes exist: `app/api/preview/route.ts` (signed,
staff-only, sets draft mode) and `app/api/cron/content-schedule/route.ts` (secret-guarded).

**Media** — None consumed. Blocks declare media slots; Phase 09 binds Phase 07 assets to them.

**Risks**

| Risk | Mitigation |
|---|---|
| A block renderer and its schema drift apart | `tests/unit/cms-registry.test.ts` asserts every registry type has a schema file, a `components/sections/` renderer and an editor, and that `payload` fixtures parse |
| Copy creeps back into JSX | ESLint rule forbidding string literals over 25 characters in `components/sections/**` JSX text nodes; code review checklist item; SEED §1 quoted in `CONTENT_GUIDE.md` |
| `payload jsonb` becomes an unvalidated dumping ground | Every write goes through `parseBlockPayload(type, payload)`; a DB check constraint requires `payload` to be an object; a nightly job re-parses all rows and reports failures |
| Scheduled publish fires but the page stays stale | The cron route revalidates each affected path with `REVALIDATE_SECRET` and writes an `activity_events` row per transition; the e2e test asserts the public path changes |
| Restoring a revision loses the media binding | Snapshots include media ids; `restore()` re-runs `sync_media_usages`; a unit test restores a revision and asserts usages match |
| Publishing an unverified business claim | Trigger refuses `PUBLISHED` while `owner_verification = 'OWNER_VERIFICATION_REQUIRED'`; only owner/admin may set `VERIFIED` |
| A section publishes but its media stays `APPROVED`, so the public page renders copy with no image and no error | `publishSection()` promotes bound `APPROVED` assets to `PUBLISHED` in the same transaction and refuses the publish outright for `DRAFT`/`REVIEW`/`ARCHIVED` assets; `tests/e2e/cms-workflow.spec.ts` publishes a section with a Phase 06 canary bound and asserts the asset is anon-readable afterwards |
| The cascade promotes media an editor never reviewed | Only `APPROVED` cascades. `DRAFT` and `REVIEW` block the publish with the `rivya_asset_id` named, so promotion is always downstream of a human approval in the Media Manager |

**Verification**

1. `npx supabase db push && npm run test:unit -- cms-registry cms-resolve` — registry parity and
   resolver windowing (hidden, unpublished, future `publish_at`, past `unpublish_at`) pass.
2. `npx playwright test tests/e2e/cms-workflow.spec.ts` — create page → add three blocks →
   reorder → set media → save draft → preview → submit for review → approve → publish →
   unpublish → restore revision 2, each step asserted.
3. As `editor`, attempt `APPROVED → PUBLISHED` → refused; as `admin`, it succeeds.
4. Set a section `owner_verification = OWNER_VERIFICATION_REQUIRED` and publish → refused, with
   the field named in the error.
5. Set `publish_at = now() + 2 minutes`; call the cron route with the correct secret after the
   window opens; assert `status` moves to `PUBLISHED`, the path is revalidated, and an
   `activity_events` row exists. Call it without the secret → 401.
6. `select count(*) from content_revisions where entity_id = '<section>'` increases by exactly one
   per mutation; `update content_revisions set snapshot = '{}'` as staff → denied.
7. Bind a media asset to a section, then attempt to delete that asset in `/studio/media` → refused
   by the Phase 06 usage guard, proving `sync_media_usages` wrote the row.
8. Media promotion, end to end. Bind the `PROCESS-STUDIO-001` canary (`status = 'APPROVED'`) to a
   section and publish it; assert the `media_assets` row is now `PUBLISHED`, an
   `activity_events` row with `action = 'media.publish.cascade'` exists, and
   `select id from media_assets where id = '<asset>'` succeeds **as the anon role**. Then set a
   second bound asset to `DRAFT` and publish again → refused, with that asset's `rivya_asset_id`
   in the message. Finally unpublish the section and assert the first asset is still `PUBLISHED`.
9. Bind a three-image gallery to one section; assert `media_usages` holds three rows with
   `slot_key` values `gallery[0]`, `gallery[1]`, `gallery[2]` and `role = 'GALLERY'`, that none
   violates `unique (context_type, context_id, slot_key, role)`, and that reordering the payload
   then saving still yields exactly three rows.
10. Open `/studio/content/pages/global`; assert it renders the `global_content` editor from the
    reserved `slug = 'global'` row through `[pageId]`, that `find app/\(studio\)/studio/content/pages
    -name page.tsx` lists only `page.tsx` and `[pageId]/page.tsx`, and that requesting the public
    path for a `kind = 'SYSTEM'` row is a 404.

**Exit criteria**

- [ ] Every block in the catalogue table has schema + renderer + editor, and the registry test proves it.
- [ ] Every SEED §5 field is present on `page_sections` and editable in Studio.
- [ ] All five D5 statuses are reachable and all illegal transitions are refused at both service and database level.
- [ ] Fact classification and owner-verification are set-able per section and per field, and block publishing when required.
- [ ] Revision history records every mutation and can restore, including media bindings.
- [ ] Publishing a section promotes its bound `APPROVED` media to `PUBLISHED` in the same transaction and refuses outright on `DRAFT`/`REVIEW`/`ARCHIVED` media, so no published section can reference an asset the anon role cannot read.
- [ ] Unpublishing a section demotes no asset; an explicit media unpublish is refused while any `PUBLISHED` section references the asset.
- [ ] `/studio/content/pages/global` resolves through `[pageId]`; no `pages/global/page.tsx` exists, and the D4 leaf set is unchanged.
- [ ] Scheduling publishes and unpublishes automatically, applies the same media promotion as a manual publish, and revalidates the public path.
- [ ] Preview renders unpublished content at the real path for staff only.
- [ ] `lib/cms/resolve.ts` is the single read path; no route queries `page_sections` directly.
- [ ] `docs/content/CONTENT_GUIDE.md` documents every block, field and transition.
- [ ] Phase-specific D9 evidence: docs updated = `CONTENT_GUIDE.md`, `DATA_MODEL.md`, `STUDIO_GUIDE.md`; tests run = `cms-registry`, `cms-resolve`, `cms-workflow.spec.ts`; next phase = 09.
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

## PHASE 09 — Initial Website Content Seed

**Goal** — the empty CMS becomes a coherent draft Rivya Living Art website. This phase writes
every page, section, navigation item, label, empty state, FAQ, SEO default, WhatsApp template and
Studio helper string from `docs/requirements/02-INITIAL-CONTENT-SEED-SYSTEM.md` into Supabase as
`content_seed_version = "rivya-v1"`, binds the Phase 07 assets to the slots that have one, records
the slots that do not, and flags every statement that asserts real business capability as
`OWNER_VERIFICATION_REQUIRED`. No lorem ipsum, no "Coming Soon", no invented products, prices,
dimensions, projects, testimonials or capabilities. Re-running the seed is safe forever after.

**Depends on** — Phase 06 (media), Phase 07 (migrated assets, gap list), Phase 08 (CMS engine and
every table this phase writes into).

**Scope**

- Seed modules under `content/seed/`, one per SEED §51 file, plus a runner and a report.
- Idempotency contract: natural `seed_key`, version stamp, `owner_edited` guard, dry-run mode.
- Media pairing (FEAT §36): every seeded section that declares a media slot is bound to a real
  migrated asset where the manifest has one; where it does not, the slot is left null and the gap
  is recorded, never filled with a placeholder image.
- Owner-verification flags on every capability claim (D10, SEED §32, §38, §55).
- Category taxonomy. The journal-category, journal-article and customization-form-template copy is
  **authored** here, in `journal.ts` and `commissions.ts`, but its target tables do not exist until
  Phases 18 and 19, so those records are reported `deferred` and written when their owning phase
  re-applies the module — see *the `deferred` outcome* below. No product rows in any case
  (SEED §32: live products come from owner entry, approved import or the confirmed-product
  workflow, never the seed).
- `docs/content/INITIAL_CONTENT_INVENTORY.md`, generated with the SEED §54 columns.

**Out of scope**

- Any product row, price, dimension, material specification, lead time or availability.
- Any portfolio project or testimonial. Portfolio and testimonials ship as seeded **empty states**.
- Publishing. Everything seeds at `DRAFT` except global labels and Studio helper copy; journal
  article drafts stay `DRAFT` explicitly (SEED §20). The owner publishes.
- Newsletter capture (SEED §25 makes it optional) — copy is seeded `DRAFT` and disabled; no
  subscription endpoint is built.
- Public rendering — Phase 10.

**Deliverables**

| Artefact | Path | Notes |
|---|---|---|
| Seed types | `content/seed/types.ts` | `SeededPage`, `SeededSection`, `SeededGlobal`, all Zod |
| Seed modules | `content/seed/{global,navigation,homepage,about,large-format,collections,commissions,process,portfolio,journal,contact,faq,seo,commerce-labels,studio-help}.ts` | Exactly the SEED §51 file list |
| Seed index | `content/seed/index.ts` | Ordered module list; the runner never hard-codes a page |
| Runner | `scripts/seed-content.ts` | Extends the Phase 03 runner. Flags: `--dry-run`, `--only=<module>`, `--report`, `--force` (Phase 03; `--force` is only legal with `--only`). Adds the fourth per-record outcome `deferred` and the module-level `requiresTables: string[]` declaration that drives it |
| Media binding map | `content/seed/media-bindings.ts` | `seed_key` → `rivya_asset_id` + `type` + role (desktop/mobile) |
| Inventory generator | `scripts/content/build-content-inventory.ts` | Writes the SEED §54 table from the database |
| Inventory | `docs/content/INITIAL_CONTENT_INVENTORY.md` | Generated; committed; regenerated on every seed |
| Migration | `supabase/migrations/0070_phase09_seed_guards.sql` | Renames Phase 03's `seed_version` → `content_seed_version`, adds `owner_edited`, adds `content_seed_runs.deferred_count`, hardens the `set_owner_edited` trigger, indexes `seed_key` and `content_seed_version` |
| Content guide update | `docs/content/CONTENT_GUIDE.md` | Seed contract, re-seed rules, verification workflow |
| Tests | `tests/unit/seed-modules.test.ts`, `tests/e2e/seed-editability.spec.ts` | Schema validity, idempotency, Studio editability |

Seed module contents and target counts, all taken from the specification:

| Module | Writes | Target |
|---|---|---|
| `global.ts` | Brand name, descriptor, statement, introduction (§6); announcement bar (§9); search copy (§26); empty states (§27–29); error pages (§45–47); inquiry success (§48); form errors (§49); WhatsApp templates (§36–37) | 1 announcement, 3 empty states, 3 error surfaces, 2 WhatsApp templates |
| `navigation.ts` | Header menu (§8) and its Collection children; footer columns (§24) | 9 top-level, 7 category children, 4 footer columns (4 + 4 + 3 links + contact) |
| `homepage.ts` | `/` sections 01–13 (§10) | 13 sections |
| `about.ts` | Hero, philosophy, scale, bespoke, closing (§11) | 5 sections |
| `large-format.ts` | Hero, category intro, six categories, customization, CTA (§12) | 5 sections, 6 category entries |
| `collections.ts` | `/collection` hero and order (§13); the seven category pages (§14, D3 order) | 2 landing sections, 7 category pages |
| `commissions.ts` | Hero, who it is for, starting points, what to share, four-step how-it-works, CTA (§15); three customization form templates (§33–35) | 6 sections written. The 3 form templates are authored here and reported **`deferred`** — `customization_forms*` arrive in Phase 19 migration `0170` |
| `process.ts` | Hero plus steps 01–07 (§16) | 8 sections |
| `portfolio.ts` | Landing hero (§17) + portfolio empty state (§28) | 2 sections, zero projects |
| `journal.ts` | Landing hero (§18), nine categories (§19), ten article drafts (§20), blog empty state (§29) | 1 section + the empty state written. The 9 categories and 10 article drafts are authored here and reported **`deferred`** — `journal_categories` / `journal_articles` arrive in Phase 18 migration `0160` |
| `contact.ts` | Hero, contact details, contact form schema (§21–22) | 3 sections, 7 fields, 8 enquiry types |
| `faq.ts` | Ten FAQ entries (§23) | 10 rows |
| `seo.ts` | Site name, title template, default description, social title/description (§41); keyword themes (§42); social defaults (§44) | 1 global entry + per-page overrides for 13 paths |
| `commerce-labels.ts` | Ten price labels (§30), seven action labels (§31), thirteen CTA labels (§7) | 30 rows |
| `studio-help.ts` | Login copy (§38), dashboard welcome and quick actions (§39), editor helper copy (§40) | ≥ 5 helper strings, 8 quick actions |

Idempotency contract (SEED §4) — **one mechanism, stated once.** Phase 03 shipped the columns, the
hash rule and `content_seed_runs`; Phase 08 added the `owner_edited` trigger; this phase reconciles
them into a single rule rather than a second, competing one.

*Columns, after migration `0070`:*

| Column | Origin | Purpose |
|---|---|---|
| `seed_key text unique` | Phase 03 `0007` | Stable natural key: `home.hero`, `nav.header.collection.furniture`, `global.cta.commission_a_piece`, `faq.01`, … |
| `content_seed_version text` | Phase 03 `0007` as `seed_version`; **renamed by `0070`** | The name SEED §4 fixes (`content_seed_version = "rivya-v1"`). One name across the codebase, so the runner compiles against one schema |
| `seed_content_hash text` | Phase 03 `0007` | **Retained, not dropped.** `sha256` over the seedable field values at last write. This is the only guard that catches an edit made outside the app — a direct `psql` update, a restore, a bulk import — because such a write sets no `updated_by` and so never fires the trigger. Phase 03 verification 5 depends on exactly this |
| `seed_last_applied_at timestamptz` | Phase 03 `0007` | When the seed last wrote the row |
| `owner_edited bool not null default false` | **new in `0070`** | Fast, trigger-maintained flag for edits made *through* Studio. The Phase 08 `set_owner_edited` trigger sets it when `updated_by IS NOT NULL` |

`owner_edited` and `seed_content_hash` are not alternatives; they cover two different attack
surfaces and the rule below treats either as decisive.

*The rule, per record:*

1. The runner connects with the service role and writes with `updated_by = NULL`, so its own writes
   never set `owner_edited`. A human edit is self-marking; the seed never has to guess.
2. **`deferred`** — if the module declares `requiresTables` and any of them is absent from the
   database, the record is neither written nor failed: it is reported `deferred`, counted, and
   listed by `seed_key` in the run report. Nothing is inserted and no error is raised. The record is
   written later, unchanged, when the phase that creates the table re-runs
   `npm run seed:content -- --only=<module>`. In Phases 05–09 this applies to exactly two modules:
   `journal.ts` (`requiresTables: ['journal_categories','journal_articles']`, resolved in Phase 18)
   and `commissions.ts` (`requiresTables: ['customization_forms','customization_form_steps',
   'customization_form_fields']`, resolved in Phase 19). The copy lives in one module and is never
   duplicated to work around table ordering.
3. **`insert`** — no row with that `seed_key` exists. Write it, stamp
   `content_seed_version = 'rivya-v1'`, store the hash, set `seed_last_applied_at`.
4. **`skip`** — the row exists and either `owner_edited = true` **or** the hash of its current
   seedable fields differs from `seed_content_hash`. Count as `skipped_owner_edited` and list the
   `seed_key` in the report. Also skip unconditionally when `status = 'PUBLISHED'` — a human has
   shipped it.
5. **`update`** — the row exists, is not owner-edited by either test, is not `PUBLISHED`, and either
   the stored `content_seed_version` differs from the module's **or** the computed hash differs from
   `seed_content_hash` (the module's copy changed within one version). Rewrite the seedable fields,
   store the new hash.
6. Never delete. Never reorder rows a human has reordered. Never demote a row a human has published
   back to `DRAFT`.
7. `--dry-run` performs the whole decision (including `requiresTables` probing) and prints the
   `insert` / `update` / `skip` / `deferred` verdict per record, writing nothing.
8. The Phase 03 escape hatch survives unchanged: `--force --only=<module>` overwrites owner-edited
   rows in that module only, and every forced write is listed in the run report.
9. **Bookkeeping is written twice, deliberately, at two grains.** Every invocation writes one
   `content_seed_runs` row (Phase 03 `0007`) with the per-outcome counts — `0070` adds
   `deferred_count int not null default 0` to that table for the fourth outcome. `--report`
   additionally writes a single human-readable summary into `activity_events` so the run is visible
   in the Studio Activity tab, and regenerates
   `docs/content/INITIAL_CONTENT_INVENTORY.md`. `content_seed_runs` is the machine record;
   `activity_events` is the notification. Neither replaces the other.

Owner-verification policy — what is flagged `OWNER_VERIFICATION_REQUIRED` on seed:

| Seeded content | Why |
|---|---|
| Contact phone, WhatsApp number, email, location (§21) | Real business contact details; the seed has none |
| All ten FAQ answers (§23) | They touch process, timelines, delivery and customization capability |
| About — scale and bespoke sections (§11) | Assert what Rivya can physically make |
| Large Format — customization section (§12) | Asserts customization capability |
| Process steps 01–07 (§16) | Describe an actual production process |
| Category descriptions that imply capability (§14) | Preservation, 3D + resin, large format |
| 3D + resin customization form template (§35) | Explicitly required by the specification |
| Every Higgsfield-backed media binding | Concept media (Phase 07); already flagged on the asset |
| Commission starting points and "what to share" (§15) | Imply an offered service scope |

Everything else seeds `BRAND_COPY`, `EDITORIAL_COPY`, `SEO_COPY` or `LEGAL_COPY` with
`owner_verification = NOT_REQUIRED`. Two labels need care: `Place Order` (§31) is seeded with
`is_enabled = false` and a helper note, because there is no checkout (D1 business rules) — when
enabled it resolves to the inquiry + WhatsApp flow, never a cart; `Ready Stock` (§30) is seeded
`OWNER_VERIFICATION_REQUIRED` because it asserts availability.

**Database** — no new tables. Writes into `pages`, `page_sections`, `navigation_items`,
`global_content`, `seo_entries`, `faqs` (all Phase 08) and reads `media_assets` (Phase 06/07).
`journal_categories`, `journal_articles` and the `customization_forms*` tables are **not** written
here and are not expected to exist: their records are `deferred` (Phases 18 and 19).

Migration `0070_phase09_seed_guards.sql`:

| Change | Detail |
|---|---|
| Rename | `alter table <t> rename column seed_version to content_seed_version` on every seedable table, so the Phase 03 column and the SEED §4 name are one column |
| Add | `owner_edited bool not null default false` on every seedable table, plus the Phase 08 `set_owner_edited` trigger where it is not already attached |
| Add | `deferred_count int not null default 0` on `content_seed_runs` |
| Index | `create index on <t> (seed_key)` and `create index on <t> (content_seed_version)` for each seeded table |
| Harden | `set_owner_edited` becomes `security definer` and fires on every `UPDATE` regardless of client, so a direct SQL update cannot bypass it. The `seed_content_hash` comparison remains the backstop for writes that legitimately carry no `updated_by` |

**Studio surface** — creates no new route. It fills `/studio/content/pages` (20 pages),
`/studio/content/homepage`, `/studio/content/navigation`, `/studio/content/footer`,
`/studio/content/seo`, `/studio/content/faqs`, `/studio/content/pages/global` (the reserved
`slug = 'global'` system page, reached through the Phase 08 `[pageId]` segment) and the Studio
helper strings that Phase 05 rendered from constants — those constants are deleted in this phase
and replaced by `global_content` lookups. `/studio/content/journal` stays the Phase 18 stub: the
journal copy exists in `content/seed/journal.ts` but its rows are `deferred` until Phase 18
creates the tables, so there is nothing to list here yet.

**Public surface** — None rendered. Thirteen `pages` rows are created whose `path` values match
D3: `/`, `/about`, `/process`, `/large-format`, `/collection`, `/custom-commissions`,
`/portfolio`, `/journal`, `/contact`, `/faq`, `/search`, `/privacy`, `/terms`, plus one
`CATEGORY` page per D3 seeded category (7) — 20 rows in total.

**Media** — binds already-migrated Phase 07 assets by page:

| Page | Families bound | Assets |
|---|---|---|
| `/` | `interior-lifestyle` (+ `material-macro`, `largeformat-*` for category cards) | 5 direct |
| `/about` | `material-macro` | 39 |
| `/large-format` | `largeformat-dining/coffee/console/seating/side/monumental` | 18 |
| `/process` | `process-studio/timber/mould/pigment/pour/cure/finish` | 79 |
| `/collection/3d-resin` | `three-d-resin` | 13 |
| `/collection/decor` | `decor` | 18 |
| `/collection/gifts` | `gifts` | 10 |
| `/collection/preservation` | `preservation-varmala`, `preservation-keepsake` | 19 |
| `/collection/wall-statement-art` | `wall-art` | 20 |
| `/journal` | `editorial`, `workshop-session` | 24 available; only the landing hero binds in this phase. The per-article cover bindings ride with the `deferred` article records and are applied in Phase 18 |
| `/portfolio` | `gallery-scene` — landing atmosphere only, never labelled as a project | 5 |

Unbound by design, recorded as gaps in the Phase 07 Gaps tab and in the inventory: the homepage
hero video and poster, `/collection` landing, `/collection/furniture`,
`/collection/collectible-design`, `/custom-commissions`, `/contact`, `/faq`, `/search`, and the
mobile ratio for `/large-format` architectural. No placeholder image is substituted; the section
renders its copy without media until the owner supplies one.

**Risks**

| Risk | Mitigation |
|---|---|
| A re-seed overwrites owner edits in production | Four independent guards, all in the one contract above: the `owner_edited` trigger (edits through Studio), the `seed_content_hash` comparison (edits by direct SQL, which set no `updated_by`), the `content_seed_version` comparison, and a runner refusal to update any row whose `status = 'PUBLISHED'`. `tests/unit/seed-modules.test.ts` seeds, edits through Studio, re-seeds and asserts the edit survives — then repeats it with a raw SQL update to prove the hash guard independently |
| A `deferred` record is quietly lost instead of applied later | `deferred` is a counted outcome, not a skip: the record's `seed_key` appears in the run report and `content_seed_runs.deferred_count`, and `tests/unit/seed-modules.test.ts` asserts that the union of applied + deferred `seed_key`s equals the full module output, so nothing can fall between the two |
| The same copy is duplicated into a Phase 18/19 seed module to dodge the ordering problem | `tests/unit/seed-modules.test.ts` asserts `seed_key` uniqueness across **all** modules in `content/seed/index.ts`, so a second module cannot restate a journal or commissions record |
| Seeded draft copy is mistaken for verified fact | Every capability claim carries `OWNER_VERIFICATION_REQUIRED`; Phase 08 refuses to publish those sections; the inventory lists every flag |
| The seed quietly invents a product to fill a grid | No seed module may write to catalog tables; `tests/unit/seed-modules.test.ts` asserts the runner's table allowlist and fails if a module targets a product table |
| Empty slots get filled with stock or placeholder imagery | Media binding map may only reference `rivya_asset_id` values present in the manifest; unresolved bindings fail the run rather than falling back |
| Positioning drifts to gifts/décor because those families have plenty of assets | SEED §56 priority order is encoded in `collections.ts` and asserted by a test on category `position`: furniture, collectible-design, 3d-resin, wall-statement-art, preservation, decor, gifts |
| Copy lands in the database but is not reachable in Studio | `tests/e2e/seed-editability.spec.ts` walks the inventory and asserts each row's Studio location renders an editable control |

**Verification**

1. `npm run seed:content -- --dry-run` on an empty database — reports `insert` and `deferred`
   verdicts only, zero `update`, zero `skip`, and writes nothing.
2. `npm run seed:content` — completes with exit code 0; `select count(*) from pages` = 20
   (13 paths + 7 categories); `select count(*) from page_sections where seed_key is not null`
   matches the module totals; `select count(*) from content_seed_runs` = 1.
3. Re-run `npm run seed:content` — every previously written row reports `skip` and every deferred
   record reports `deferred` again; no `updated_at` changes anywhere.
4. Edit the homepage hero heading in Studio as an editor; re-run the seed; assert the heading is
   unchanged and `owner_edited = true`.
5. `select count(*) from faqs` = 10; `select count(*) from global_content where "group" = 'CTA'`
   = 13; `= 'COMMERCE_LABEL'` = 10; `= 'ACTION_LABEL'` = 7. No journal or customization-form counts
   are asserted here — those tables do not exist yet.
6. The deferral is real, not a silent drop. `npm run seed:content -- --report` reports
   `deferred 22` — nine journal categories, ten journal article drafts and three customization form
   templates — and names each `seed_key`; `select deferred_count from content_seed_runs order by
   started_at desc limit 1` returns the same number. `to_regclass('public.journal_articles')` is
   still `null`, and the run exit code is 0. Phase 18 verification 1 and Phase 19 verification 1
   (`PHASE-16-22.md`) assert the counts once the tables land.
7. `select count(*) from page_sections where owner_verification = 'OWNER_VERIFICATION_REQUIRED'`
   > 0, and every row in the policy table above is present.
8. Attempt to publish the About "scale" section as admin without verifying → refused (Phase 08).
9. `grep -rn "lorem\|Coming Soon\|TBD" content/seed/` → no matches (SEED §55).
10. `npm run content:inventory && git diff --exit-code docs/content/INITIAL_CONTENT_INVENTORY.md` —
    the generated inventory is current, and every row has a Studio location.
11. `npx playwright test tests/e2e/seed-editability.spec.ts` — every seeded field is editable at
    its stated Studio location.
12. A seeded section publishes with its media readable. Publish the `/about` hero as admin (after
    verifying it) and assert the bound `material-macro` asset moved `APPROVED → PUBLISHED` and is
    readable as the anon role — the Phase 08 promotion rule, exercised on real seeded data.

**Exit criteria — SEED §57 definition of done**

- [ ] Homepage has finished first-pass copy (13 sections)
- [ ] About has finished first-pass copy (5 sections)
- [ ] Large Format has finished first-pass copy
- [ ] Collection landing has copy
- [ ] Every one of the seven categories has copy
- [ ] Custom Commissions page has copy. The 3 customization form templates (§33–35) are **authored in `content/seed/commissions.ts` and reported `deferred`** — `customization_forms*` are created in Phase 19 migration `0170`, which re-applies the module and asserts the templates
- [ ] Process page has copy (hero + 7 steps)
- [ ] Portfolio landing has safe copy and an empty state — no invented projects
- [ ] Journal landing has copy and the §29 empty state. The 9 categories and 10 article drafts are **authored in `content/seed/journal.ts` and reported `deferred`** — `journal_categories` and `journal_articles` are created in Phase 18, which re-applies the module and asserts the counts (`PHASE-16-22.md`, Phase 18)
- [ ] Contact has copy, contact details and the §22 form schema
- [ ] FAQ has 10 initial entries
- [ ] Navigation is seeded (header, mobile, category children)
- [ ] Footer is seeded (brand statement + 4 columns)
- [ ] CTAs are seeded (13 labels)
- [ ] Store UI labels are seeded (10 price + 7 action labels)
- [ ] Inquiry messages are seeded (success, error, upload error)
- [ ] WhatsApp templates are seeded (both §36 and §37, with the exact token names)
- [ ] SEO defaults are seeded (site name, title template, description, social copy)
- [ ] Empty states are seeded (collection, portfolio, journal, search, 404, 500, media failure)
- [ ] Studio helper copy is seeded and Phase 05 constants are deleted
- [ ] All content is stored in the CMS/database — no marketing copy remains in JSX (SEED §1)
- [ ] All content is editable in Studio, proven by `seed-editability.spec.ts`
- [ ] Every record whose target table does not yet exist is reported `deferred` — never failed, never silently dropped — and its `seed_key` appears in the run report and in `content_seed_runs.deferred_count`
- [ ] All media requirements have asset IDs, either bound or recorded as a named gap
- [ ] All Higgsfield requirements have briefs in `HIGGSFIELD_MASTER_ASSET_PLAN.md` — for gaps only
- [ ] No fictional product, project, price, dimension, testimonial or capability is presented
- [ ] Owner-verification flags exist on every row in the policy table
- [ ] The seed is idempotent and re-run-safe against owner edits
- [ ] Phase-specific D9 evidence: docs updated = `CONTENT_GUIDE.md`, `INITIAL_CONTENT_INVENTORY.md`, `DATA_MODEL.md`; tests run = `seed-modules`, `seed-editability.spec.ts`; next phase = 10 (Public Website Foundation).
- [ ] All ten points of the **Shared D9 completion checklist** verified and recorded.

---

**Exit criteria**

Plus the ten-point phase completion contract in `CANONICAL-DECISIONS.md` D9.

- [ ] `npm run seed:content` completes against an empty database and is **idempotent**: a second
      run reports zero writes and changes no `updated_at`. `deferred` records report `deferred` on
      every run until their owning phase creates the table, and never fail the run.
- [ ] Re-running the seed after an owner edit leaves the edited row untouched — proven by a test
      that edits a seeded heading, re-seeds, and asserts the edit survives (SEED §4).
- [ ] `content_seed_version = "rivya-v1"` is recorded, and the seed refuses to run against a
      database stamped with a newer version.
- [ ] Every item in SEED §57's definition of done is **authored** in `content/seed/`: homepage,
      About, Large Format, Collection landing, all seven categories, Custom Commissions, Process,
      Portfolio landing, Journal landing, Contact, the ten FAQs, navigation, footer, CTA library,
      commerce labels, inquiry messages, both WhatsApp templates, SEO defaults, the three empty
      states, and Studio helper copy. Every one of those is also **written** in this phase except
      the journal taxonomy and article drafts (Phase 18) and the three customization form templates
      (Phase 19), which are `deferred` because their tables do not exist yet.
- [ ] No lorem ipsum, no "Coming Soon" on a primary page, and no fabricated product, project,
      price, dimension, testimonial or capability claim anywhere in the seed (SEED §55, D10).
- [ ] Every statement asserting real business capability carries `OWNER_VERIFICATION_REQUIRED`,
      and none of those rows is `PUBLISHED`.
- [ ] Portfolio seeds **zero** projects and renders the SEED §28 empty state instead.
- [ ] The ten journal article records are authored `DRAFT` and reported `deferred` in this phase;
      Phase 18 writes them and asserts `count(*) filter (where status='PUBLISHED') = 0`. The seed
      publishes no article at any point.
- [ ] Every seeded field resolves to a Studio control, and
      `docs/content/INITIAL_CONTENT_INVENTORY.md` reports the achieved percentage against SEED
      §54's 100% target, naming any shortfall.
- [ ] Every media binding in the seed resolves to a real `rivya_asset_id` in the manifest or is
      explicitly marked `GAP`; `python3 scripts/media/check-asset-ids.py` exits 0.
- [ ] No public component contains a marketing string literal — enforced by the lint rule from
      Phase 08.

## Open questions for the canonical decisions

These are raised, not acted on. No phase above diverges from `CANONICAL-DECISIONS.md`. Items 1 and
2 record where an earlier draft of this document did diverge and how it was brought back into line;
items 3–6 are genuinely open and want an owner decision.

1. **D6 asset identity — WITHDRAWN, no amendment sought.** An earlier draft of this document
   claimed that 26 `rivya_asset_id` values and six `cloudinary_public_id` values were each shared
   by an image/video pair, and proposed amending D6 to make identity a composite. That claim was
   false and has been removed everywhere it appeared. The manifest is unambiguous — all 250
   `rivya_asset_id`, all 250 `cloudinary_public_id`, all 250 `higgsfield_generation_id` and all 250
   `filename` values are distinct (`jq '[.assets[].rivya_asset_id] | unique | length'` → `250`; the
   number 26 is the video **count**, not a duplicate count). D6's "the Rivya asset ID is
   authoritative, not the filename" stands exactly as written and needs no amendment. The Phase 03
   `rivya_asset_id citext unique` column is correct; `higgsfield_generation_id` remains the
   migration key only because it survives a manifest rebuild that renumbers a family. Amendment A1
   already covers the one real ID hazard — gap IDs colliding with manifest family prefixes — and is
   enforced by `scripts/media/check-asset-ids.py` in Phase 07.
2. **D4 global content route — resolved without amendment; confirm the reading.** SEED §7 places
   the CTA library at `Website → Global Content → CTA Library`, which has no leaf in the D4 map. An
   earlier draft added `app/(studio)/studio/content/pages/global/page.tsx`, which would have been a
   new static route segment (and would have shadowed `[pageId]`). Phase 08 now reaches global
   content through the **existing** `[pageId]` dynamic segment resolving a reserved `pages` row
   (`slug = 'global'`, `kind = 'SYSTEM'`, `path = null`), so the D4 leaf set is untouched and no
   amendment is required. Confirm that a reserved system-page row is an acceptable way to serve a
   SEED §7 concept that D4 does not name; if not, the alternative is to amend D4 to add
   `/studio/content/global` as a tenth Content leaf.
3. **`deferred` seed outcome — which phase owns the runner change.** `PHASE-16-22.md` (*Cross-phase
   decisions*, item 3) lists the `deferred` outcome and `requiresTables` as a **Phase 16**
   deliverable. It has to exist earlier than that: `journal.ts` and `commissions.ts` ship in Phase
   09 and would otherwise fail the run against tables that do not exist until Phases 18 and 19.
   This document therefore places the runner change in Phase 09 and treats Phase 16 as reusing it
   for `content/seed/collection-concepts.ts`. Confirm this ordering, or move those records into
   Phase 18/19 seed modules — which would duplicate copy across modules and is the worse option.
4. **`Place Order` label.** SEED §31 seeds a `Place Order` action label while D1 forbids checkout.
   Phase 09 seeds it disabled and routes it to the inquiry flow. Confirm this is the intent, or
   drop the label.
5. **Newsletter.** SEED §25 is conditional. Phase 09 seeds the copy `DRAFT` and disabled, and
   builds no capture endpoint. Confirm whether a newsletter is in scope at all.
6. **Analytics route.** D4 lists `analytics` under `/studio` as an overview concern, not a route
   segment. Phase 05 renders it as a tab on `/studio`. Confirm.
