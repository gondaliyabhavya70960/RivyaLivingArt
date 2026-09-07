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
| Seed identity | every seeded row carries `seed_key text` and `content_seed_version text` |
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
7. `psql "$DATABASE_URL" -c "select count(*) from activity_events"` as the anon role — expect a
   permission error, proving RLS.

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
- `media_assets` covering the six FEAT §13 Media Manager sections — Images, Videos, 3D Models,
  Documents, AI Assets, Brand Assets — as one table discriminated by `kind`, plus the 3D metadata
  field list from FEAT §13.
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
| Migration | `supabase/migrations/0030_phase06_media.sql` | Enums, `media_assets`, `media_usages`, RLS |
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

`media_kind` enum: `IMAGE · VIDEO · MODEL_3D · DOCUMENT · BRAND`.
`media_source` enum: `REAL · USER_UPLOAD · HIGGSFIELD · RENDER · FALLBACK` (mirrors the D6
asset-priority ladder).

`media_assets` — identity: `id`, `provider`, `resource_type` (`image|video|raw`), `public_id`,
`folder`, `filename`, `rivya_asset_id`, `kind`, `source`.
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

Constraints that matter: `unique (provider, resource_type, public_id)` — **not** `unique
(public_id)`, because six manifest `cloudinary_public_id` values are shared by an image/video
pair (for example `rivya/collection/decor/decor-001-16x9`), which Cloudinary keeps apart by
resource type. `unique (higgsfield_generation_id) where higgsfield_generation_id is not null`.
`check (kind <> 'MODEL_3D' or model_format is not null)`.
`check (char_length(trim(alt_text)) > 0)`.

`media_usages` — `id`, `media_id fk`, `context_type` (`PAGE_SECTION|PRODUCT|CATEGORY|
COLLECTION|PORTFOLIO|JOURNAL|GLOBAL|SEO`), `context_id uuid`, `slot_key text`,
`role` (`DESKTOP|MOBILE|POSTER|THUMBNAIL|GALLERY|OG`), `position int`, `created_at`,
`created_by`. `unique (context_type, context_id, slot_key, role)`.

RLS: public (anon) may `SELECT` `media_assets` only where `status = 'PUBLISHED'` (D5); staff
reads require `media:read`; writes require `media:upload`/`media:edit`; `DELETE` requires
`media:delete` and is additionally blocked by trigger when a `media_usages` row references the
asset.

**Studio surface** — fills `/studio/media/all`, `/images`, `/videos`, `/models`, `/documents`,
`/brand`. Each is a filtered `DataTable` over `media_assets` with a detail drawer exposing alt
text, tags, governance flags, usage list (from `media_usages`) and, for `MODEL_3D`, the FEAT §13
metadata block. `/studio/media/higgsfield` still renders the Phase 07 stub.

**Public surface** — None. `app/api/media/sign` is Studio-only and rejects unauthenticated calls.

**Media** — Three canary assets from the manifest, used solely to prove the pipeline end to end,
migrated by hand through the Studio uploader's "import by URL" path:
`PROCESS-STUDIO-001` (image, 4:3, family `process-studio`), `LARGEFORMAT-DINING-001` (video,
9:16, 6 s, family `largeformat-dining`) and `LARGEFORMAT-MONUMENTAL-001` (image, 21:9, family
`largeformat-monumental`). The remaining 247 wait for Phase 07. Nothing is generated.

**Risks**

| Risk | Mitigation |
|---|---|
| Cloudinary types leak across the codebase and defeat the abstraction | ESLint `no-restricted-imports` blocks `cloudinary` outside `lib/media/providers/**`; a unit test greps the built module graph |
| Signed uploads become an open upload endpoint | Endpoint requires session + `media:upload`, restricts `folder` to `lib/media/folders.ts`, restricts MIME to an allowlist, caps at 25 MB image / 200 MB video / 50 MB model, and rate-limits per user |
| `public_id` uniqueness assumed and the six image/video pairs collide on import | Unique index is `(provider, resource_type, public_id)`; a Phase 06 unit test asserts the six known manifest pairs insert cleanly |
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
4. Import the three canaries; assert `LARGEFORMAT-DINING-001` stores `duration_s = 6`, renders a
   derived poster, and that `PROCESS-STUDIO-001` and its video-side namesakes do not conflict.
5. Open `/studio/media/models`, create a `MODEL_3D` row without `model_format` → the check
   constraint rejects it.
6. Attempt to delete an asset that has a `media_usages` row → refused with a readable message.
7. Playwright at 390 px on a page rendering `MediaImage`: assert the chosen `srcset` candidate is
   ≤ 1024 px and the response `content-type` is `image/avif` or `image/webp`.

**Exit criteria**

- [ ] Cloudinary is imported in exactly one file; lint rule enforces it.
- [ ] All 23 manifest folders exist in `lib/media/folders.ts` and match the manifest exactly (asserted by test).
- [ ] Sign endpoint rejects: no session, wrong role, disallowed folder, disallowed MIME, oversize.
- [ ] Every one of the six FEAT §13 Media Manager sections has a working Studio page over real data.
- [ ] 3D metadata fields from FEAT §13 all exist and are editable in the model drawer.
- [ ] Videos render posters with no layout shift; reduced-motion suppresses autoplay.
- [ ] `media_usages` is written by at least one real path and readable in the asset drawer.
- [ ] Three canary assets are live in Cloudinary and in `media_assets` with `is_ai_generated = true`, `is_concept = true`, `owner_verification = OWNER_VERIFICATION_REQUIRED`.
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
- Idempotency and resumability: the ledger is keyed by `higgsfield_generation_id`, which is unique
  across all 250 rows. `rivya_asset_id` is **not** unique — 26 ids are shared by an image/video
  pair — so identity is `(rivya_asset_id, type)` and the migration key is the generation id.
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
| `rivya_asset_id` | `media_assets.rivya_asset_id` (non-unique by design) |
| `filename` | `media_assets.filename` (unique across the 250; useful as a human key) |
| `family`, `subject_tags` | `tags` (family) and `subject_tags` |
| `page`, `section` | `media_assets.tags` as `page:<page>` / `section:<section>`; drives tracker filters |
| `aspect_ratio`, `width`, `height`, `duration_s` | matching technical columns |
| `source_url` | fetched by the uploader; **not** stored as a delivery URL |
| `higgsfield_generation_id`, `higgsfield_model`, `prompt` | `higgsfield_generation_id`, `higgsfield_model`, `higgsfield_prompt` |
| `alt_text_draft` | `alt_text` (draft), with `owner_verification = OWNER_VERIFICATION_REQUIRED` |
| `is_ai_generated`, `is_concept` | copied verbatim; both `true` for all 250 |
| `manifest_version` | `media_assets.manifest_version = 'rivya-hf-v1'` |
| — | `source = 'HIGGSFIELD'`, `status = 'APPROVED'`, `migrated_at = now()` |

Assets are seeded `APPROVED`, not `PUBLISHED`: they are concept media and only become publicly
readable when an editor publishes the section that uses them (Phase 08 status workflow, D5 RLS).

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
| The 26 shared `rivya_asset_id` values collapse into one row | Identity is `(rivya_asset_id, type)`; the DB unique index is `(provider, resource_type, public_id)`; a unit test migrates the six colliding public-id pairs and asserts 12 distinct rows |
| A Higgsfield CDN URL expires mid-migration | `--resume` continues from the ledger; failures are recorded per asset with the HTTP status; the run summary lists them and exits non-zero |
| Someone regenerates an asset that already exists | `assert-no-regeneration.ts` runs in CI over `HIGGSFIELD_MASTER_ASSET_PLAN.md` and fails if any brief's target matches a manifest `rivya_asset_id` or `family`+`section` already at target count; the tracker has no generate control |
| Draft alt text ships as final and reads like a prompt | Alt text imported as draft, flagged `OWNER_VERIFICATION_REQUIRED`; the Gaps tab counts unreviewed alt text; Phase 09 exit criteria requires review of every alt text bound to a seeded slot |
| Concept media is read as a real delivered project | Persistent banner, `is_concept = true` on every row, portfolio stays an empty state, and no seeded copy describes these images as completed work (D10) |

**Verification**

1. `npm run media:migrate:higgsfield -- --dry-run` — reports `attempted 250, migrated 0,
   skipped 0, failed 0` and writes nothing.
2. `npm run media:migrate:higgsfield` — completes with `migrated 250, failed 0`.
3. Re-run the same command — reports `skipped 250, migrated 0`; `select count(*) from
   media_assets where source = 'HIGGSFIELD'` still returns 250.
4. `psql "$DATABASE_URL" -c "select count(*) from media_assets where source='HIGGSFIELD' and
   resource_type='video'"` → 26; images → 224.
5. `psql "$DATABASE_URL" -c "select public_id, count(*) from media_assets group by 1 having
   count(*) > 1"` → six rows, each with count 2 and two distinct `resource_type` values.
6. Open `/studio/media/higgsfield`; filter Family = `material-macro` → 39 rows; Page = `process`
   → 79 rows; Type = video → 26 rows.
7. Open the Gaps tab; assert `/`, `/collection`, `/collection/furniture`,
   `/collection/collectible-design`, `/custom-commissions`, `/contact` and `/faq` all appear.
8. `npm run media:assert-no-regen` — passes; then add a brief for `WALL-ART-001` to the master
   plan and re-run — it fails with a non-zero exit and names the offending asset.
9. `npm run media:build-status && git diff --exit-code docs/media/HIGGSFIELD_ASSET_STATUS.md` —
   the generated document is up to date.

**Exit criteria**

- [ ] All 250 manifest assets exist in Cloudinary under their manifest `cloudinary_public_id`.
- [ ] All 250 have `media_assets` rows with `is_ai_generated = true`, `is_concept = true`, `source = 'HIGGSFIELD'`, `manifest_version = 'rivya-hf-v1'` and non-empty draft alt text.
- [ ] The migration is provably idempotent (a second full run changes nothing).
- [ ] The 26 duplicate `rivya_asset_id` pairs and the 6 duplicate `cloudinary_public_id` pairs are all present and distinct.
- [ ] The tracker shows every FEAT §34 column and offers no regeneration control anywhere.
- [ ] `computeGaps()` returns the gap list above, and the master plan carries a brief for each.
- [ ] `data/higgsfield/asset-manifest.json` is byte-identical to its pre-phase state.
- [ ] `assert-no-regeneration.ts` is wired into CI.
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
| Publishing service | `lib/cms/publishing.ts` | Transition guard, revision write, revalidation |
| Revision service | `lib/cms/revisions.ts` | `snapshot()`, `listRevisions()`, `restore()` |
| Schedule cron | `app/api/cron/content-schedule/route.ts` | `REVALIDATE_SECRET`-guarded; runs every 5 min |
| Preview entry | `app/api/preview/route.ts` | Signed token → `draftMode().enable()` → redirect to path |
| Pages editor | `app/(studio)/studio/content/pages/page.tsx`, `[pageId]/page.tsx` | List + block editor |
| Global editor | `app/(studio)/studio/content/pages/global/page.tsx` | Reserved page id for global content |
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

**Database**

| Table | Key columns |
|---|---|
| `pages` | `id`, `slug unique`, `path unique`, `kind` (`PAGE·CATEGORY·SYSTEM`), `title`, `status`, `publish_at`, `unpublish_at`, `seo_entry_id`, `is_system bool`, `seed_key`, `content_seed_version`, `owner_edited bool default false`, `created_at`, `updated_at`, `updated_by`, `published_at`, `published_by` |
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
`/studio/content/faqs`. `/studio/content/pages/global` is the reserved system page that edits
`global_content` (CTA library, commerce and action labels, announcement bar, empty states, form
copy, Studio helper text) — see *Open questions* on the D4 route map.
`/studio/content/{portfolio,journal,testimonials}` remain stubs pointing at Phases 17–18.

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

**Exit criteria**

- [ ] Every block in the catalogue table has schema + renderer + editor, and the registry test proves it.
- [ ] Every SEED §5 field is present on `page_sections` and editable in Studio.
- [ ] All five D5 statuses are reachable and all illegal transitions are refused at both service and database level.
- [ ] Fact classification and owner-verification are set-able per section and per field, and block publishing when required.
- [ ] Revision history records every mutation and can restore, including media bindings.
- [ ] Scheduling publishes and unpublishes automatically and revalidates the public path.
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
- Category, journal-category and customization-form-template taxonomy — but **no products**
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
| Runner | `scripts/seed-content.ts` | `npm run seed:content`, `-- --dry-run`, `-- --only=homepage`, `-- --report` |
| Media binding map | `content/seed/media-bindings.ts` | `seed_key` → `rivya_asset_id` + `type` + role (desktop/mobile) |
| Inventory generator | `scripts/content/build-content-inventory.ts` | Writes the SEED §54 table from the database |
| Inventory | `docs/content/INITIAL_CONTENT_INVENTORY.md` | Generated; committed; regenerated on every seed |
| Migration | `supabase/migrations/0070_phase09_seed_guards.sql` | `owner_edited` trigger hardening, `content_seed_version` index |
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
| `commissions.ts` | Hero, who it is for, starting points, what to share, four-step how-it-works, CTA (§15); three customization form templates (§33–35) | 6 sections, 3 form templates |
| `process.ts` | Hero plus steps 01–07 (§16) | 8 sections |
| `portfolio.ts` | Landing hero (§17) + portfolio empty state (§28) | 2 sections, zero projects |
| `journal.ts` | Landing hero (§18), nine categories (§19), ten article drafts (§20), blog empty state (§29) | 1 section, 9 categories, 10 `DRAFT` articles |
| `contact.ts` | Hero, contact details, contact form schema (§21–22) | 3 sections, 7 fields, 8 enquiry types |
| `faq.ts` | Ten FAQ entries (§23) | 10 rows |
| `seo.ts` | Site name, title template, default description, social title/description (§41); keyword themes (§42); social defaults (§44) | 1 global entry + per-page overrides for 13 paths |
| `commerce-labels.ts` | Ten price labels (§30), seven action labels (§31), thirteen CTA labels (§7) | 30 rows |
| `studio-help.ts` | Login copy (§38), dashboard welcome and quick actions (§39), editor helper copy (§40) | ≥ 5 helper strings, 8 quick actions |

Idempotency contract (SEED §4), stated precisely:

1. Every seeded row carries a stable `seed_key` (`home.hero`, `nav.header.collection.furniture`,
   `global.cta.commission_a_piece`, `faq.01`, …) and `content_seed_version = 'rivya-v1'`.
2. The runner connects with the service role and writes with `updated_by = NULL`. The Phase 08
   `set_owner_edited` trigger sets `owner_edited = true` only when `updated_by IS NOT NULL`, so a
   human edit is self-marking and the seed never has to guess.
3. Per row: **insert** when no row with that `seed_key` exists; **update** only when
   `owner_edited = false` **and** the stored `content_seed_version` differs from the module's;
   **skip** otherwise. Never delete, never reorder rows a human has reordered.
4. `--dry-run` prints the insert/update/skip decision for every row and writes nothing.
5. `--report` writes the run summary to `activity_events` and regenerates the inventory document.
6. A row that a human has published is never demoted back to `DRAFT` by the seed.

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
Migration `0070` adds `create index on page_sections (seed_key)`, the same on the other seeded
tables, and tightens `set_owner_edited` so it cannot be bypassed by a direct SQL update.

**Studio surface** — creates no new route. It fills `/studio/content/pages` (20 pages),
`/studio/content/homepage`, `/studio/content/navigation`, `/studio/content/footer`,
`/studio/content/seo`, `/studio/content/faqs`, `/studio/content/pages/global` and the Studio
helper strings that Phase 05 rendered from constants — those constants are deleted in this phase
and replaced by `global_content` lookups.

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
| `/journal` | `editorial`, `workshop-session` | 24 |
| `/portfolio` | `gallery-scene` — landing atmosphere only, never labelled as a project | 5 |

Unbound by design, recorded as gaps in the Phase 07 Gaps tab and in the inventory: the homepage
hero video and poster, `/collection` landing, `/collection/furniture`,
`/collection/collectible-design`, `/custom-commissions`, `/contact`, `/faq`, `/search`, and the
mobile ratio for `/large-format` architectural. No placeholder image is substituted; the section
renders its copy without media until the owner supplies one.

**Risks**

| Risk | Mitigation |
|---|---|
| A re-seed overwrites owner edits in production | Three independent guards: `owner_edited` trigger, version comparison, and a runner refusal to update any row whose `status = 'PUBLISHED'`; `tests/unit/seed-modules.test.ts` seeds, edits, re-seeds and asserts the edit survives |
| Seeded draft copy is mistaken for verified fact | Every capability claim carries `OWNER_VERIFICATION_REQUIRED`; Phase 08 refuses to publish those sections; the inventory lists every flag |
| The seed quietly invents a product to fill a grid | No seed module may write to catalog tables; `tests/unit/seed-modules.test.ts` asserts the runner's table allowlist and fails if a module targets a product table |
| Empty slots get filled with stock or placeholder imagery | Media binding map may only reference `rivya_asset_id` values present in the manifest; unresolved bindings fail the run rather than falling back |
| Positioning drifts to gifts/décor because those families have plenty of assets | SEED §56 priority order is encoded in `collections.ts` and asserted by a test on category `position`: furniture, collectible-design, 3d-resin, wall-statement-art, preservation, decor, gifts |
| Copy lands in the database but is not reachable in Studio | `tests/e2e/seed-editability.spec.ts` walks the inventory and asserts each row's Studio location renders an editable control |

**Verification**

1. `npm run seed:content -- --dry-run` on an empty database — reports inserts only, writes nothing.
2. `npm run seed:content` — completes; `select count(*) from pages` = 20 (13 paths + 7 categories);
   `select count(*) from page_sections where seed_key is not null` matches the module totals.
3. Re-run `npm run seed:content` — every row reports `skip`; no `updated_at` changes.
4. Edit the homepage hero heading in Studio as an editor; re-run the seed; assert the heading is
   unchanged and `owner_edited = true`.
5. `select count(*) from faqs` = 10; `select count(*) from global_content where "group" = 'CTA'`
   = 13; `= 'COMMERCE_LABEL'` = 10; `= 'ACTION_LABEL'` = 7; journal categories = 9; journal drafts
   = 10 and all `status = 'DRAFT'`.
6. `select count(*) from page_sections where owner_verification = 'OWNER_VERIFICATION_REQUIRED'`
   > 0, and every row in the policy table above is present.
7. Attempt to publish the About "scale" section as admin without verifying → refused (Phase 08).
8. `grep -rn "lorem\|Coming Soon\|TBD" content/seed/` → no matches (SEED §55).
9. `npm run content:inventory && git diff --exit-code docs/content/INITIAL_CONTENT_INVENTORY.md` —
   the generated inventory is current, and every row has a Studio location.
10. `npx playwright test tests/e2e/seed-editability.spec.ts` — every seeded field is editable at
    its stated Studio location.

**Exit criteria — SEED §57 definition of done**

- [ ] Homepage has finished first-pass copy (13 sections)
- [ ] About has finished first-pass copy (5 sections)
- [ ] Large Format has finished first-pass copy
- [ ] Collection landing has copy
- [ ] Every one of the seven categories has copy
- [ ] Custom Commissions page has copy
- [ ] Process page has copy (hero + 7 steps)
- [ ] Portfolio landing has safe copy and an empty state — no invented projects
- [ ] Journal landing has copy; 9 categories and 10 `DRAFT` articles seeded
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
      run reports zero writes and changes no `updated_at`.
- [ ] Re-running the seed after an owner edit leaves the edited row untouched — proven by a test
      that edits a seeded heading, re-seeds, and asserts the edit survives (SEED §4).
- [ ] `content_seed_version = "rivya-v1"` is recorded, and the seed refuses to run against a
      database stamped with a newer version.
- [ ] Every item in SEED §57's definition of done is seeded: homepage, About, Large Format,
      Collection landing, all seven categories, Custom Commissions, Process, Portfolio landing,
      Journal landing, Contact, the ten FAQs, navigation, footer, CTA library, commerce labels,
      inquiry messages, both WhatsApp templates, SEO defaults, the three empty states, and Studio
      helper copy.
- [ ] No lorem ipsum, no "Coming Soon" on a primary page, and no fabricated product, project,
      price, dimension, testimonial or capability claim anywhere in the seed (SEED §55, D10).
- [ ] Every statement asserting real business capability carries `OWNER_VERIFICATION_REQUIRED`,
      and none of those rows is `PUBLISHED`.
- [ ] Portfolio seeds **zero** projects and renders the SEED §28 empty state instead.
- [ ] The ten journal articles are seeded `DRAFT`; none is published by the seed.
- [ ] Every seeded field resolves to a Studio control, and
      `docs/content/INITIAL_CONTENT_INVENTORY.md` reports the achieved percentage against SEED
      §54's 100% target, naming any shortfall.
- [ ] Every media binding in the seed resolves to a real `rivya_asset_id` in the manifest or is
      explicitly marked `GAP`; `python3 scripts/media/check-asset-ids.py` exits 0.
- [ ] No public component contains a marketing string literal — enforced by the lint rule from
      Phase 08.

## Open questions for the canonical decisions

These are raised, not acted on. Nothing above diverges from `CANONICAL-DECISIONS.md`.

1. **D6 asset identity — RESOLVED.** This document was written against a manifest in which 26
   `rivya_asset_id` values were shared by an image/video pair, because the generator numbered
   images and videos with separate counters. That was a defect, not a modelling choice: the ID is
   the authoritative key. `scripts/media/build-higgsfield-manifest.py` now shares one counter
   namespace and asserts uniqueness before writing, so all 250 IDs are distinct and
   `rivya_asset_id` alone is a key. `higgsfield_generation_id` remains the migration key, since it
   is stable across a manifest rebuild. See CANONICAL-DECISIONS amendment A1.
2. **D4 global content route.** SEED §7 places the CTA library at
   `Website → Global Content → CTA Library`, which has no leaf in the D4 map. Phase 08 mounts it
   at `/studio/content/pages/global` (a reserved page id, not a new route segment) rather than
   adding `/studio/content/global`. Suggested amendment: either bless the reserved id or add the
   leaf.
3. **`Place Order` label.** SEED §31 seeds a `Place Order` action label while D1 forbids checkout.
   Phase 09 seeds it disabled and routes it to the inquiry flow. Confirm this is the intent, or
   drop the label.
4. **Newsletter.** SEED §25 is conditional. Phase 09 seeds the copy `DRAFT` and disabled, and
   builds no capture endpoint. Confirm whether a newsletter is in scope at all.
5. **Analytics route.** D4 lists `analytics` under `/studio` as an overview concern, not a route
   segment. Phase 05 renders it as a tab on `/studio`. Confirm.
