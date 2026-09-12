---
doc: HIGGSFIELD_ASSET_STATUS
status: CURRENT
owning_phase: 07
last_reviewed: 2026-09-12
owner_verification: NOT_REQUIRED
---

# HIGGSFIELD ASSET STATUS — live inventory ledger

> **Standing.** The per-asset rows in §4 are **generated, never hand-edited**.
> Generator: `scripts/media/build-asset-status.ts` (`npm run media:build-status`).
> Input: `data/higgsfield/asset-manifest.json` (`rivya-hf-v1`) joined against `media_assets`
> and `media_usages`. CI runs the generator and fails on a diff.
> Hand-written sections are §1, §5, §6, §7 and §8 and are marked as such.
>
> Inventory columns are fixed by **FEAT §34**: Asset ID · Type · Product · Collection · Page ·
> Purpose · Source · Higgsfield? · Prompt · Status · Used? · Cloudinary location · CMS placement.
>
> Companion plan (hand-written): `docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md`.
> Studio equivalent: `/studio/media/higgsfield` → Inventory · Families · Gaps · Coverage.

---

## 1. Ledger at a glance *(hand-written)*

| Measure | Value | As of |
|---|---|---|
| Assets catalogued | **250** (224 image · 26 video) | `rivya-hf-v1` |
| Distinct `rivya_asset_id` values | **250** — unique. Restored by the duplicate-ID fix, §6 DQ-0 | `rivya-hf-v1` |
| Distinct `filename` values | **250** — unique, usable as a human key | `rivya-hf-v1` |
| Distinct `cloudinary_public_id` values | **250** — unique. Same fix | `rivya-hf-v1` |
| Families | 24 | `rivya-hf-v1` |
| Cloudinary folders | 23, all under `rivya/` | `rivya-hf-v1` |
| Migrated to Cloudinary | **250 of 250** — every row reads `MIGRATED`; 0 failed | Phase 07 run, replayed |
| Bound to a CMS slot | **0 of 250** — every row reads `used_in_cms: false`, `cms_placement: null` | pre-Phase-09 |
| `is_ai_generated` / `is_concept` | **250 / 250** true on both | fixed |
| `owner_verification` | **250 / 250** `OWNER_VERIFICATION_REQUIRED` | fixed |
| Alt text approved by an editor | **0 of 250** — all values are `alt_text_draft` | pre-Phase-43 |
| Products attached | **0** — and the `product_media` trigger rejects `is_concept = true` outright | permanent |
| Collections attached | **0** — collection concepts are `DRAFT_COLLECTION_CONCEPT` (FEAT §9) | pre-Phase-16 |
| 3D models · brand marks · product photographs | **0 of each** — none is in scope for AI generation | permanent |

**Read the remaining zero rows carefully.** *Bound 0* is the true state of the ledger before
Phase 09 binds a slot; it is not a defect but the starting line. *Migrated* is no longer one of
them: all 250 assets are in Cloudinary at their manifest public IDs, `media_assets` holds 250 rows
and `data/higgsfield/migration-log.json` records every one.

The uploads did not run from this sandbox — it cannot open a connection to `api.cloudinary.com` at
all — so they were made through the Cloudinary MCP server with the parameters
`scripts/media/migrate-higgsfield.ts` would have sent, and the recorded responses were fed back
through that script's real planner, row mapping and ledger rules via `--from-results`. 231 assets
were newly uploaded and 19 were adopted as already present under their manifest public ID.

---

## 2. Column definitions *(hand-written)*

| FEAT §34 column | Source | Notes |
|---|---|---|
| **Asset ID** | `rivya_asset_id` | Authoritative identity (D6), unique across all 250. The **migration** key is still `higgsfield_generation_id` — it survives a manifest rebuild, an ordinal does not |
| **Type** | `type` | `image` \| `video`. Maps to `media_assets.resource_type` and `.kind` |
| **Product** | `product_media` join | Always empty for these 250 and always will be — concept media cannot attach to a product |
| **Collection** | `collections` join | Empty until Phase 16 binds a `DRAFT_COLLECTION_CONCEPT` |
| **Page** | `page` | Generation intent, **not** a placement restriction (see the plan, §1) |
| **Purpose** | derived from `family` + `section` | Controlled vocabulary in §2.1 |
| **Source** | `source` | `higgsfield` for all 250 → `media_assets.source = 'HIGGSFIELD'` |
| **Higgsfield?** | `higgsfield_generation_id`, `higgsfield_model` | Present on all 250; the generation id is the migration key |
| **Prompt** | `prompt` | Truncated to 120 chars in the table; full text in the Studio drawer and in `media_assets.higgsfield_prompt` |
| **Status** | manifest `status`, then `media_assets.status` | Manifest vocabulary in §2.2 — it is *not* the D5 content status |
| **Used?** | `media_usages` count | `used_in_cms` in the manifest is bookkeeping; the database join is the truth after Phase 09 |
| **Cloudinary location** | `cloudinary_folder` + `cloudinary_public_id` | Assigned in the manifest, occupied only after Phase 07 migration |
| **CMS placement** | `media_usages` (`context_type`, `context_id`, `slot_key`, `role`) | `null` until an editor binds it |

### 2.1 Purpose vocabulary

| Purpose | Families |
|---|---|
| `MATERIAL_STORY` | `material-macro` |
| `PROCESS_STORY` | `process-cure`, `process-finish`, `process-mould`, `process-pigment`, `process-pour`, `process-studio`, `process-timber` |
| `CATEGORY_GALLERY` | `decor`, `gifts`, `three-d-resin`, `wall-art`, `preservation-keepsake`, `preservation-varmala` |
| `LARGE_FORMAT_SUBJECT` | `largeformat-coffee`, `largeformat-console`, `largeformat-dining`, `largeformat-monumental`, `largeformat-seating`, `largeformat-side` |
| `INTERIOR_CONTEXT` | `interior-lifestyle` |
| `EXHIBITION_ATMOSPHERE` | `gallery-scene` |
| `EDITORIAL_COVER` | `editorial`, `workshop-session` |

### 2.2 Status vocabulary

The manifest's `status` field is **manifest bookkeeping**, not `content_status` (D5). Mapping:

| Manifest `status` | Meaning | `media_assets.status` after import |
|---|---|---|
| `AVAILABLE_UNMIGRATED` | Exists on the Higgsfield CDN; not yet in Cloudinary | — (row does not exist yet) |
| `MIGRATED` | In Cloudinary at its manifest public ID, `media_assets` row written | `APPROVED` |
| `BOUND` | At least one `media_usages` row references it | `APPROVED` |
| `PUBLISHED` | The section that uses it is published | `PUBLISHED` |
| `ARCHIVED` | Withdrawn from use; the ID is never reused | `ARCHIVED` |
| `FAILED` | Migration attempted and failed; the run log holds the HTTP status | — |

All 250 currently read `MIGRATED`. The Status column in §4 is derived from
`data/higgsfield/migration-log.json`, not from the manifest's own `status` field — the manifest
builder writes `AVAILABLE_UNMIGRATED` on every asset at generation time and never revisits it, so
that field says what was true when the asset was generated, not what is true now.

---

## 3. Per-family summary *(generated)*

Counts come from the manifest. Ratios list every aspect ratio the family actually contains, in
descending frequency. "Max long edge" is the largest of `width`/`height` in the family and decides
which Cloudinary preset the family can fill (`hero` needs 1600 px, `hero-xl` needs 2560 px).

<!-- BEGIN GENERATED: family-summary -->

| Family | n | Img | Vid | Ratios present | Max long edge | Folder | Purpose |
|---|---|---|---|---|---|---|---|
| `material-macro` | 39 | 33 | 6 | 16:9, 1:1, 21:9, 4:5, 9:16, 3:4 | 6336 | `rivya/material` | `MATERIAL_STORY` |
| `wall-art` | 20 | 20 | 0 | 16:9, 4:5, 21:9, 3:2, 3:4 | 6336 | `rivya/collection/wall-art` | `CATEGORY_GALLERY` |
| `editorial` | 19 | 16 | 3 | 16:9, 3:2, 3:4, 4:5, 1:1, 9:16 | 5504 | `rivya/journal/editorial` | `EDITORIAL_COVER` |
| `process-studio` | 19 | 15 | 4 | 16:9, 4:3, 4:5, 3:2, 3:4 | 5504 | `rivya/process/studio` | `PROCESS_STORY` |
| `decor` | 18 | 17 | 1 | 16:9, 3:4, 4:5, 9:16, 3:2 | 5504 | `rivya/collection/decor` | `CATEGORY_GALLERY` |
| `preservation-varmala` | 15 | 15 | 0 | 16:9, 4:5, 3:2, 3:4 | 5056 | `rivya/collection/preservation` | `CATEGORY_GALLERY` |
| `process-pigment` | 13 | 11 | 2 | 16:9, 4:5, 3:4, 9:16 | 4608 | `rivya/process/pigment` | `PROCESS_STORY` |
| `three-d-resin` | 13 | 13 | 0 | 16:9, 3:4, 4:5 | 5504 | `rivya/collection/3d-resin` | `CATEGORY_GALLERY` |
| `process-mould` | 12 | 11 | 1 | 16:9, 4:5, 3:4 | 5504 | `rivya/process/mould` | `PROCESS_STORY` |
| `process-pour` | 12 | 8 | 4 | 16:9, 9:16, 4:5 | 5504 | `rivya/process/pour` | `PROCESS_STORY` |
| `gifts` | 10 | 10 | 0 | 16:9, 3:2, 3:4, 4:5 | 5056 | `rivya/collection/gifts` | `CATEGORY_GALLERY` |
| `process-cure` | 8 | 8 | 0 | 16:9, 4:5, 9:16 | 5504 | `rivya/process/cure` | `PROCESS_STORY` |
| `process-finish` | 8 | 8 | 0 | 4:5, 16:9, 4:3 | 4608 | `rivya/process/finish` | `PROCESS_STORY` |
| `process-timber` | 7 | 5 | 2 | 3:2, 16:9, 4:5 | 4608 | `rivya/process/timber` | `PROCESS_STORY` |
| `gallery-scene` | 5 | 4 | 1 | 16:9, 21:9, 4:5 | 3168 | `rivya/portfolio/gallery` | `EXHIBITION_ATMOSPHERE` |
| `interior-lifestyle` | 5 | 5 | 0 | 3:2, 4:5, 16:9 | 4608 | `rivya/interior` | `INTERIOR_CONTEXT` |
| `largeformat-dining` | 5 | 3 | 2 | 16:9, 9:16, 21:9 | 6336 | `rivya/large-format/dining` | `LARGE_FORMAT_SUBJECT` |
| `workshop-session` | 5 | 5 | 0 | 16:9 | 5504 | `rivya/journal/workshop` | `EDITORIAL_COVER` |
| `largeformat-console` | 4 | 4 | 0 | 16:9, 3:2 | 5504 | `rivya/large-format/console` | `LARGE_FORMAT_SUBJECT` |
| `largeformat-seating` | 4 | 4 | 0 | 4:5 | 4608 | `rivya/large-format/seating` | `LARGE_FORMAT_SUBJECT` |
| `preservation-keepsake` | 4 | 4 | 0 | 16:9, 1:1, 4:5 | 4608 | `rivya/collection/preservation` | `CATEGORY_GALLERY` |
| `largeformat-side` | 3 | 3 | 0 | 4:5, 16:9 | 4608 | `rivya/large-format/side` | `LARGE_FORMAT_SUBJECT` |
| `largeformat-coffee` | 1 | 1 | 0 | 3:2 | 2528 | `rivya/large-format/coffee` | `LARGE_FORMAT_SUBJECT` |
| `largeformat-monumental` | 1 | 1 | 0 | 21:9 | 6336 | `rivya/large-format/architectural` | `LARGE_FORMAT_SUBJECT` |
| **Total** | **250** | **224** | **26** | 8 ratios | 6336 | 23 folders | 7 purposes |

<!-- END GENERATED: family-summary -->

Distribution across the whole library:

<!-- BEGIN GENERATED: distribution -->

| Cut | Values |
|---|---|
| By type | image 224 · video 26 |
| By aspect ratio | `16:9` 121 · `4:5` 50 · `3:4` 21 · `3:2` 16 · `9:16` 16 · `1:1` 13 · `21:9` 9 · `4:3` 4 |
| By page | `process` 79 · `about` 39 · `journal` 24 · `collection/wall-statement-art` 20 · `collection/preservation` 19 · `collection/decor` 18 · `large-format` 18 · `collection/3d-resin` 13 · `collection/gifts` 10 · `home` 5 · `portfolio` 5 |
| By model | `nano_banana_2` 114 · `seedream_v5_pro` 61 · `cinematic_studio_2_5` 34 · `recraft_v4_1` 15 · `cinematic_studio_3_0` 11 · `seedance_2_5` 11 · `seedance_2_0` 4 |
| By purpose | `CATEGORY_GALLERY` 80 · `PROCESS_STORY` 79 · `MATERIAL_STORY` 39 · `EDITORIAL_COVER` 24 · `LARGE_FORMAT_SUBJECT` 18 · `EXHIBITION_ATMOSPHERE` 5 · `INTERIOR_CONTEXT` 5 |
| Video durations | `6 s` 15 · `5 s` 5 · `8 s` 4 · `10 s` 2 |
| Video resolutions | `1280×720` 8 · `1344×768` 8 · `1920×1080` 7 · `768×1344` 3 |

<!-- END GENERATED: distribution -->

---

## 4. Per-asset inventory *(generated)*

> All 250 rows, sorted by Asset ID. Do not hand-edit — run `npm run media:build-status`.
>
> **Two columns are manifest bookkeeping, not the live answer.** `Used?` and `CMS placement` are
> the manifest's own `used_in_cms` and `cms_placement` fields, which are `false` and `null` on all
> 250 and will stay so: the manifest records what was generated, not what the CMS does with it.
> The live answer joins `media_usages` and is in the Studio at `/studio/media/higgsfield`. This
> generator is deliberately database-free so that CI can regenerate the document byte-identically
> (verification step 10 is `npm run media:build-status && git diff --exit-code`).
>
> `Product` and `Collection` from the FEAT §34 column list are omitted rather than rendered empty:
> no concept asset can attach to a product (the `product_media` trigger rejects `is_concept = true`)
> and no collection is bound until Phase 16, so both would be 250 blank cells for the life of the
> document. `Family` and `Section` answer the same "what is this of" question against data that
> exists.

<!-- BEGIN GENERATED: asset-inventory -->

| Asset ID | Type | Family | Page | Section | Purpose | Source | Model | Ratio | Pixels | Prompt (first 100 chars) | Status | Used? | Cloudinary location | CMS placement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `DECOR-001` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A resin coaster, a domed paperweight and a slim pen rest arranged in a loose diagonal across a dark… | `MIGRATED` | no | `rivya/collection/decor/decor-001-16x9` | — |
| `DECOR-002` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | A round resin pooja thali with a poured sapphire and champagne swirl through its base, two small unl… | `MIGRATED` | no | `rivya/collection/decor/decor-002-3x4` | — |
| `DECOR-003` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A long shared workshop table set with pour cups and moulds under warm pendant light, reframed to a t… | `MIGRATED` | no | `rivya/collection/decor/decor-003-9x16` | — |
| `DECOR-004` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A long shared workshop table set with pour cups and moulds under warm pendant light, reframed to a t… | `MIGRATED` | no | `rivya/collection/decor/decor-004-9x16` | — |
| `DECOR-005` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/decor/decor-005-3x4` | — |
| `DECOR-006` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/decor/decor-006-3x4` | — |
| `DECOR-007` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/decor/decor-007-3x4` | — |
| `DECOR-008` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/decor/decor-008-3x4` | — |
| `DECOR-009` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `recraft_v4_1` | 4:5 | 896×1152 | macro product photography, oval gold-leaf geode resin serving tray with polished agate-style rings,… | `MIGRATED` | no | `rivya/collection/decor/decor-009-4x5` | — |
| `DECOR-010` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `recraft_v4_1` | 4:5 | 896×1152 | macro product photography, teardrop resin pendant necklace with deep blue translucent resin and susp… | `MIGRATED` | no | `rivya/collection/decor/decor-010-4x5` | — |
| `DECOR-011` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | A handcrafted deep-blue resin serving tray with gold flake edges resting on a dark marble console be… | `MIGRATED` | no | `rivya/collection/decor/decor-011-3x2` | — |
| `DECOR-012` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 3:4 | 1328×1760 | An elegant resin tablescape set — round serving tray, matching coasters and napkin rings in deep oce… | `MIGRATED` | no | `rivya/collection/decor/decor-012-3x4` | — |
| `DECOR-013` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A styled console vignette — resin tray, vase, candle holder — balanced with books and linen. Photore… | `MIGRATED` | no | `rivya/collection/decor/decor-013-16x9` | — |
| `DECOR-014` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A bespoke resin serving board and vase gift set with a linen ribbon in a new home's entryway. Photor… | `MIGRATED` | no | `rivya/collection/decor/decor-014-16x9` | — |
| `DECOR-015` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Hands gently polishing a glossy ocean-blue resin serving tray with a soft cloth. Photorealistic edit… | `MIGRATED` | no | `rivya/collection/decor/decor-015-16x9` | — |
| `DECOR-016` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A curated flat-lay of varied resin gifts — bookmark, coaster, pendant, desk tray — wrapped with ribb… | `MIGRATED` | no | `rivya/collection/decor/decor-016-16x9` | — |
| `DECOR-017` | image | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Rows of identical handcrafted resin coaster gift boxes being packed in tissue paper on a studio tabl… | `MIGRATED` | no | `rivya/collection/decor/decor-017-16x9` | — |
| `DECOR-018` | video | `decor` | collection/decor | gallery | `CATEGORY_GALLERY` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Extreme macro: a bar of soft warm light sweeping across a deeply polished resin surface revealing mi… | `MIGRATED` | no | `rivya/collection/decor/decor-018-16x9` | — |
| `EDITORIAL-001` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A finished resin tabletop tilted up at an angle under a single raking key light so every ripple in t… | `MIGRATED` | no | `rivya/journal/editorial/editorial-001-4x5` | — |
| `EDITORIAL-002` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A finished resin tabletop tilted up at an angle under a single raking key light so every ripple in t… | `MIGRATED` | no | `rivya/journal/editorial/editorial-002-4x5` | — |
| `EDITORIAL-003` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `cinematic_studio_2_5` | 16:9 | 2752×1536 | Ultra-wide editorial photograph composed as a social share card: a single flagship live-edge black w… | `MIGRATED` | no | `rivya/journal/editorial/editorial-003-16x9` | — |
| `EDITORIAL-004` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Editorial photograph: tall studio window light falling across several resin pieces resting on trestl… | `MIGRATED` | no | `rivya/journal/editorial/editorial-004-3x2` | — |
| `EDITORIAL-005` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Editorial photograph: a bespoke consultation table from above at a shallow angle — pencil sketches o… | `MIGRATED` | no | `rivya/journal/editorial/editorial-005-3x2` | — |
| `EDITORIAL-006` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `cinematic_studio_2_5` | 1:1 | 2048×2048 | Still life, square editorial photograph: pigment jars in deep ocean blues, a brass mixing tool, resi… | `MIGRATED` | no | `rivya/journal/editorial/editorial-006-1x1` | — |
| `EDITORIAL-007` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/journal/editorial/editorial-007-3x4` | — |
| `EDITORIAL-008` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Abstract dark navy and midnight blue fluid resin slowly swirling with soft golden luminescence deep… | `MIGRATED` | no | `rivya/journal/editorial/editorial-008-16x9` | — |
| `EDITORIAL-009` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Abstract dark navy and midnight blue fluid resin slowly swirling with soft golden luminescence deep… | `MIGRATED` | no | `rivya/journal/editorial/editorial-009-16x9` | — |
| `EDITORIAL-010` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/journal/editorial/editorial-010-3x4` | — |
| `EDITORIAL-011` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A teakwood-and-resin wedding photo frame with an LED glow edge on a bedside table. Photorealistic ed… | `MIGRATED` | no | `rivya/journal/editorial/editorial-011-16x9` | — |
| `EDITORIAL-012` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A resin frame being wrapped in bubble wrap and foam corners inside a sturdy box. Photorealistic edit… | `MIGRATED` | no | `rivya/journal/editorial/editorial-012-16x9` | — |
| `EDITORIAL-013` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | An ornate ocean-blue resin engagement ring tray with gold detailing, rings placed at center, floral… | `MIGRATED` | no | `rivya/journal/editorial/editorial-013-16x9` | — |
| `EDITORIAL-014` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A crystal-clear resin block held up to sunlight showing perfect clarity, window light streaming. Pho… | `MIGRATED` | no | `rivya/journal/editorial/editorial-014-16x9` | — |
| `EDITORIAL-015` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Elegant resin event mementos — medallions and mini plaques — arranged on a conference welcome table.… | `MIGRATED` | no | `rivya/journal/editorial/editorial-015-16x9` | — |
| `EDITORIAL-016` | image | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Lit tea-lights in ocean-blue resin holders with gold rims, festive bokeh background. Photorealistic… | `MIGRATED` | no | `rivya/journal/editorial/editorial-016-16x9` | — |
| `EDITORIAL-017` | video | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `cinematic_studio_3_0` | 9:16 | 768×1344 | Vertical abstract background: ink-dark and deep ocean blue resin drifting in very slow folds, faint… | `MIGRATED` | no | `rivya/journal/editorial/editorial-017-9x16` | — |
| `EDITORIAL-018` | video | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Sapphire resin pour, high angle (720p variant 2). | `MIGRATED` | no | `rivya/journal/editorial/editorial-018-16x9` | — |
| `EDITORIAL-019` | video | `editorial` | journal | editorial | `EDITORIAL_COVER` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Sapphire resin pour, high angle (720p variant). | `MIGRATED` | no | `rivya/journal/editorial/editorial-019-16x9` | — |
| `GALLERY-SCENE-001` | image | `gallery-scene` | portfolio | gallery | `EXHIBITION_ATMOSPHERE` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Gallery-like interior, editorial portrait orientation: a small sculptural resin side table with laye… | `MIGRATED` | no | `rivya/portfolio/gallery/gallery-scene-001-4x5` | — |
| `GALLERY-SCENE-002` | image | `gallery-scene` | portfolio | gallery | `EXHIBITION_ATMOSPHERE` | higgsfield | `cinematic_studio_2_5` | 21:9 | 3168×1344 | Wide shot of a dark midnight-blue gallery room with handcrafted resin objects displayed on stone pli… | `MIGRATED` | no | `rivya/portfolio/gallery/gallery-scene-002-21x9` | — |
| `GALLERY-SCENE-003` | image | `gallery-scene` | portfolio | gallery | `EXHIBITION_ATMOSPHERE` | higgsfield | `recraft_v4_1` | 16:9 | 2688×1536 | Wide shot of a dark gallery wall at night with three framed abstract resin artworks in deep sapphire… | `MIGRATED` | no | `rivya/portfolio/gallery/gallery-scene-003-16x9` | — |
| `GALLERY-SCENE-004` | image | `gallery-scene` | portfolio | gallery | `EXHIBITION_ATMOSPHERE` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A single extraordinary one-of-one resin art object on a pedestal, gallery lighting. Photorealistic e… | `MIGRATED` | no | `rivya/portfolio/gallery/gallery-scene-004-16x9` | — |
| `GALLERY-SCENE-005` | video | `gallery-scene` | portfolio | gallery | `EXHIBITION_ATMOSPHERE` | higgsfield | `seedance_2_0` | 16:9 | 1920×1080 | A polished rectangular resin art block standing in a dark gallery, very slow push-in, caustic light… | `MIGRATED` | no | `rivya/portfolio/gallery/gallery-scene-005-16x9` | — |
| `GIFTS-001` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | An open square gift box lined with dark charcoal cloth holding three small resin keepsakes — a coast… | `MIGRATED` | no | `rivya/collection/gifts/gifts-001-3x4` | — |
| `GIFTS-002` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:2 | 5056×3392 | Eight identical resin-and-teak desk pieces laid out in one even row across a long dark bench for a b… | `MIGRATED` | no | `rivya/collection/gifts/gifts-002-3x2` | — |
| `GIFTS-003` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | Gloved hands drawing a muted champagne ribbon into a knot around a small wrapped keepsake box on a d… | `MIGRATED` | no | `rivya/collection/gifts/gifts-003-4x5` | — |
| `GIFTS-004` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A festive Navratri home vignette with resin diyas and accents kept in brand blue and gold. Photoreal… | `MIGRATED` | no | `rivya/collection/gifts/gifts-004-16x9` | — |
| `GIFTS-005` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Delicate resin rakhi keepsakes with embedded threads and gold flake in a gift tray. Photorealistic e… | `MIGRATED` | no | `rivya/collection/gifts/gifts-005-16x9` | — |
| `GIFTS-006` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A gift-wrapped large frame being handed over, corner of a preserved varmala visible through the pape… | `MIGRATED` | no | `rivya/collection/gifts/gifts-006-16x9` | — |
| `GIFTS-007` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A modern resin milestone award trophy with embedded gold flake, on a spotlit shelf. Photorealistic e… | `MIGRATED` | no | `rivya/collection/gifts/gifts-007-16x9` | — |
| `GIFTS-008` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Resin ornaments and small gift pieces in blue and gold beside festive lights and wrapped presents. P… | `MIGRATED` | no | `rivya/collection/gifts/gifts-008-16x9` | — |
| `GIFTS-009` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A premium Diwali corporate gift box with resin diyas and a gold-flecked tray, rangoli-lit backdrop.… | `MIGRATED` | no | `rivya/collection/gifts/gifts-009-16x9` | — |
| `GIFTS-010` | image | `gifts` | collection/gifts | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A corporate desk set — resin tray and pen holder with an engraved blank logo plate area — on an exec… | `MIGRATED` | no | `rivya/collection/gifts/gifts-010-16x9` | — |
| `INTERIOR-LIFESTYLE-001` | image | `interior-lifestyle` | home | interior | `INTERIOR_CONTEXT` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A stack of wooden flower presses clamped under cast-iron weights on a studio shelf, small dated pape… | `MIGRATED` | no | `rivya/interior/interior-lifestyle-001-4x5` | — |
| `INTERIOR-LIFESTYLE-002` | image | `interior-lifestyle` | home | interior | `INTERIOR_CONTEXT` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Editorial interior photograph, Japandi style: a resin and oak dining table with a clear smoky epoxy… | `MIGRATED` | no | `rivya/interior/interior-lifestyle-002-3x2` | — |
| `INTERIOR-LIFESTYLE-003` | image | `interior-lifestyle` | home | interior | `INTERIOR_CONTEXT` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Softened brutalist interior, editorial portrait: a sculptural resin chair with a translucent smoky s… | `MIGRATED` | no | `rivya/interior/interior-lifestyle-003-4x5` | — |
| `INTERIOR-LIFESTYLE-004` | image | `interior-lifestyle` | home | interior | `INTERIOR_CONTEXT` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Modern Mediterranean room, editorial photograph: a low resin and olive-wood bench beneath an arched… | `MIGRATED` | no | `rivya/interior/interior-lifestyle-004-3x2` | — |
| `INTERIOR-LIFESTYLE-005` | image | `interior-lifestyle` | home | interior | `INTERIOR_CONTEXT` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A resin wall clock near a rain-streaked window, monsoon mood, cozy Indian home interior. Photorealis… | `MIGRATED` | no | `rivya/interior/interior-lifestyle-005-16x9` | — |
| `LARGEFORMAT-COFFEE-001` | image | `largeformat-coffee` | large-format | coffee-tables | `LARGE_FORMAT_SUBJECT` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Warm minimalist living room, editorial photograph: a round resin coffee table with deep ocean blue s… | `MIGRATED` | no | `rivya/large-format/coffee/largeformat-coffee-001-3x2` | — |
| `LARGEFORMAT-CONSOLE-001` | image | `largeformat-console` | large-format | consoles | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A long narrow console-table plank, alternating bands of teak and sapphire resin, clamped edge to edg… | `MIGRATED` | no | `rivya/large-format/console/largeformat-console-001-16x9` | — |
| `LARGEFORMAT-CONSOLE-002` | image | `largeformat-console` | large-format | consoles | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A long narrow console-table plank, alternating bands of teak and sapphire resin, clamped edge to edg… | `MIGRATED` | no | `rivya/large-format/console/largeformat-console-002-16x9` | — |
| `LARGEFORMAT-CONSOLE-003` | image | `largeformat-console` | large-format | consoles | `LARGE_FORMAT_SUBJECT` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Modern tropical entryway, editorial photograph: a long resin console table with teak grain flowing i… | `MIGRATED` | no | `rivya/large-format/console/largeformat-console-003-3x2` | — |
| `LARGEFORMAT-CONSOLE-004` | image | `largeformat-console` | large-format | consoles | `LARGE_FORMAT_SUBJECT` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A large ocean-wave resin wall panel above a console table, interior styling context. Photorealistic… | `MIGRATED` | no | `rivya/large-format/console/largeformat-console-004-16x9` | — |
| `LARGEFORMAT-DINING-001` | image | `largeformat-dining` | large-format | dining-tables | `LARGE_FORMAT_SUBJECT` | higgsfield | `cinematic_studio_2_5` | 9:16 | 1536×2752 | Vertical editorial photograph for a mobile hero: a large live-edge resin dining table with deep ocea… | `MIGRATED` | no | `rivya/large-format/dining/largeformat-dining-001-9x16` | — |
| `LARGEFORMAT-DINING-002` | image | `largeformat-dining` | large-format | dining-tables | `LARGE_FORMAT_SUBJECT` | higgsfield | `cinematic_studio_2_5` | 21:9 | 6336×2688 | Ultra-wide architectural editorial photograph: a large live-edge resin dining table with a deep ocea… | `MIGRATED` | no | `rivya/large-format/dining/largeformat-dining-002-21x9` | — |
| `LARGEFORMAT-DINING-003` | image | `largeformat-dining` | large-format | dining-tables | `LARGE_FORMAT_SUBJECT` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A walnut river table with a deep ocean-blue resin channel in a warm Indian living room. Photorealist… | `MIGRATED` | no | `rivya/large-format/dining/largeformat-dining-003-16x9` | — |
| `LARGEFORMAT-DINING-004` | video | `largeformat-dining` | large-format | dining-tables | `LARGE_FORMAT_SUBJECT` | higgsfield | `cinematic_studio_3_0` | 9:16 | 768×1344 | Vertical cinematic: a large live-edge resin dining table with a deep ocean blue epoxy river through… | `MIGRATED` | no | `rivya/large-format/dining/largeformat-dining-004-9x16` | — |
| `LARGEFORMAT-DINING-005` | video | `largeformat-dining` | large-format | dining-tables | `LARGE_FORMAT_SUBJECT` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Slow cinematic dolly toward a large live-edge resin dining table, deep ocean blue epoxy river meetin… | `MIGRATED` | no | `rivya/large-format/dining/largeformat-dining-005-16x9` | — |
| `LARGEFORMAT-MONUMENTAL-001` | image | `largeformat-monumental` | large-format | architectural | `LARGE_FORMAT_SUBJECT` | higgsfield | `cinematic_studio_2_5` | 21:9 | 6336×2688 | Ultra-wide architectural lobby, editorial photograph: a monumental freestanding resin and timber scu… | `MIGRATED` | no | `rivya/large-format/architectural/largeformat-monumental-001-21x9` | — |
| `LARGEFORMAT-SEATING-001` | image | `largeformat-seating` | large-format | sculptural-seating | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A single curved chair-seat blank, laminated timber and a thin sapphire resin seam, still resting ins… | `MIGRATED` | no | `rivya/large-format/seating/largeformat-seating-001-4x5` | — |
| `LARGEFORMAT-SEATING-002` | image | `largeformat-seating` | large-format | sculptural-seating | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A long bench-seat plank, a single sapphire resin river running down the centre of the timber, restin… | `MIGRATED` | no | `rivya/large-format/seating/largeformat-seating-002-4x5` | — |
| `LARGEFORMAT-SEATING-003` | image | `largeformat-seating` | large-format | sculptural-seating | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A long bench-seat plank, a single sapphire resin river running down the centre of the timber, restin… | `MIGRATED` | no | `rivya/large-format/seating/largeformat-seating-003-4x5` | — |
| `LARGEFORMAT-SEATING-004` | image | `largeformat-seating` | large-format | sculptural-seating | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A single curved chair-seat blank, laminated timber and a thin sapphire resin seam, still resting ins… | `MIGRATED` | no | `rivya/large-format/seating/largeformat-seating-004-4x5` | — |
| `LARGEFORMAT-SIDE-001` | image | `largeformat-side` | large-format | side-pieces | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A small round side-table blank on a bench, one layer of resin already cured to a pale sapphire disc,… | `MIGRATED` | no | `rivya/large-format/side/largeformat-side-001-4x5` | — |
| `LARGEFORMAT-SIDE-002` | image | `largeformat-side` | large-format | side-pieces | `LARGE_FORMAT_SUBJECT` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A small round side-table blank on a bench, one layer of resin already cured to a pale sapphire disc,… | `MIGRATED` | no | `rivya/large-format/side/largeformat-side-002-4x5` | — |
| `LARGEFORMAT-SIDE-003` | image | `largeformat-side` | large-format | side-pieces | `LARGE_FORMAT_SUBJECT` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A tidy home-office desk with custom 3D-printed organizer, headphone stand and cable holders in matte… | `MIGRATED` | no | `rivya/large-format/side/largeformat-side-003-16x9` | — |
| `MATERIAL-MACRO-001` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | Extreme macro of a single preserved marigold floret suspended in cured clear resin, every petal edge… | `MIGRATED` | no | `rivya/material/material-macro-001-1x1` | — |
| `MATERIAL-MACRO-002` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A close macro texture of poured resin catching a single soft key light, reframed to a tall vertical… | `MIGRATED` | no | `rivya/material/material-macro-002-9x16` | — |
| `MATERIAL-MACRO-003` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A close macro texture of poured resin catching a single soft key light, reframed to a tall vertical… | `MIGRATED` | no | `rivya/material/material-macro-003-9x16` | — |
| `MATERIAL-MACRO-004` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A wide macro texture band of poured resin under a single soft key light, reframed to a tall vertical… | `MIGRATED` | no | `rivya/material/material-macro-004-9x16` | — |
| `MATERIAL-MACRO-005` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A wide macro texture band of poured resin under a single soft key light, reframed to a tall vertical… | `MIGRATED` | no | `rivya/material/material-macro-005-9x16` | — |
| `MATERIAL-MACRO-006` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | A tight square macro of a large abstract resin pour, obsidian and deep sapphire swirling together ar… | `MIGRATED` | no | `rivya/material/material-macro-006-1x1` | — |
| `MATERIAL-MACRO-007` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | A tight square macro of a large abstract resin pour, obsidian and deep sapphire swirling together ar… | `MIGRATED` | no | `rivya/material/material-macro-007-1x1` | — |
| `MATERIAL-MACRO-008` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 16:9 | 2752×1536 | Cinematic 4k macro top-down view of liquid deep sapphire blue epoxy resin flowing across raw dark te… | `MIGRATED` | no | `rivya/material/material-macro-008-16x9` | — |
| `MATERIAL-MACRO-009` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `cinematic_studio_2_5` | 21:9 | 6336×2688 | Ultra-wide abstract macro: deep ocean blue resin in slow frozen flow, white mineral veils suspended… | `MIGRATED` | no | `rivya/material/material-macro-009-21x9` | — |
| `MATERIAL-MACRO-010` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-010-1x1` | — |
| `MATERIAL-MACRO-011` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 21:9 | 6336×2688 | Extreme macro of a cured resin surface, one champagne gold vein running through deep sapphire, dense… | `MIGRATED` | no | `rivya/material/material-macro-011-21x9` | — |
| `MATERIAL-MACRO-012` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Cinematic 4k macro top-down view of liquid deep sapphire blue epoxy resin flowing across raw dark te… | `MIGRATED` | no | `rivya/material/material-macro-012-16x9` | — |
| `MATERIAL-MACRO-013` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | One frame from a four-part material story shot in a single session, same lens, same single soft key… | `MIGRATED` | no | `rivya/material/material-macro-013-4x5` | — |
| `MATERIAL-MACRO-014` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Cinematic 4k macro top-down view of liquid deep sapphire blue epoxy resin flowing across raw dark te… | `MIGRATED` | no | `rivya/material/material-macro-014-16x9` | — |
| `MATERIAL-MACRO-015` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 21:9 | 6336×2688 | Extreme macro of a cured resin surface, one champagne gold vein running through deep sapphire, dense… | `MIGRATED` | no | `rivya/material/material-macro-015-21x9` | — |
| `MATERIAL-MACRO-016` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-016-1x1` | — |
| `MATERIAL-MACRO-017` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-017-1x1` | — |
| `MATERIAL-MACRO-018` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-018-1x1` | — |
| `MATERIAL-MACRO-019` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-019-1x1` | — |
| `MATERIAL-MACRO-020` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-020-1x1` | — |
| `MATERIAL-MACRO-021` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-021-1x1` | — |
| `MATERIAL-MACRO-022` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 1:1 | 4096×4096 | One of four material macros shot on an identical matte charcoal-neutral stone ground under identical… | `MIGRATED` | no | `rivya/material/material-macro-022-1x1` | — |
| `MATERIAL-MACRO-023` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | One frame from a four-part material story shot in a single session, same lens, same single soft key… | `MIGRATED` | no | `rivya/material/material-macro-023-4x5` | — |
| `MATERIAL-MACRO-024` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `recraft_v4_1` | 4:5 | 896×1152 | extreme macro cinematography still, liquid epoxy resin mid-pour swirling deep sapphire and royal blu… | `MIGRATED` | no | `rivya/material/material-macro-024-4x5` | — |
| `MATERIAL-MACRO-025` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `recraft_v4_1` | 4:5 | 896×1152 | macro product photography, set of round ocean-wave resin coasters, deep midnight-blue backdrop (#0A1… | `MIGRATED` | no | `rivya/material/material-macro-025-4x5` | — |
| `MATERIAL-MACRO-026` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `cinematic_studio_2_5` | 16:9 | 2752×1536 | Abstract extreme macro of cured resin surface: deep sapphire and midnight blue marbling with delicat… | `MIGRATED` | no | `rivya/material/material-macro-026-16x9` | — |
| `MATERIAL-MACRO-027` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `cinematic_studio_2_5` | 21:9 | 3168×1344 | Extreme macro of liquid epoxy resin mid-pour, deep sapphire blue translucent liquid surface with thi… | `MIGRATED` | no | `rivya/material/material-macro-027-21x9` | — |
| `MATERIAL-MACRO-028` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `recraft_v4_1` | 16:9 | 2688×1536 | Extreme macro photograph of a polished resin art surface: deep translucent layers of sapphire and mi… | `MIGRATED` | no | `rivya/material/material-macro-028-16x9` | — |
| `MATERIAL-MACRO-029` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedream_v5_pro` | 3:4 | 1328×1760 | A luxurious oval vanity mirror framed in ocean-blue resin with gold leaf inclusions, standing on a d… | `MIGRATED` | no | `rivya/material/material-macro-029-3x4` | — |
| `MATERIAL-MACRO-030` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A dramatic macro of layered ocean-wave resin with white cell lacing and gold geode veining. Photorea… | `MIGRATED` | no | `rivya/material/material-macro-030-16x9` | — |
| `MATERIAL-MACRO-031` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A pristine resin ocean-wave art piece being dusted with a soft brush, care products nearby. Photorea… | `MIGRATED` | no | `rivya/material/material-macro-031-16x9` | — |
| `MATERIAL-MACRO-032` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedream_v5_pro` | 3:4 | 1328×1760 | A pair of sculptural handcrafted resin vases, ocean-blue translucent gradient with gold veining, one… | `MIGRATED` | no | `rivya/material/material-macro-032-3x4` | — |
| `MATERIAL-MACRO-033` | image | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedream_v5_pro` | 3:4 | 1328×1760 | A luxurious oval vanity mirror framed in ocean-blue resin with gold leaf inclusions, standing on a d… | `MIGRATED` | no | `rivya/material/material-macro-033-3x4` | — |
| `MATERIAL-MACRO-034` | video | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Gold leaf settling on sapphire resin (720p variant 2). | `MIGRATED` | no | `rivya/material/material-macro-034-16x9` | — |
| `MATERIAL-MACRO-035` | video | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedance_2_0` | 16:9 | 1920×1080 | Extreme macro of a curing resin surface resembling ocean waves from above: layered translucent sapph… | `MIGRATED` | no | `rivya/material/material-macro-035-16x9` | — |
| `MATERIAL-MACRO-036` | video | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Abstract slow cinematic background: deep ocean blue and ink-dark resin drifting in slow laminar fold… | `MIGRATED` | no | `rivya/material/material-macro-036-16x9` | — |
| `MATERIAL-MACRO-037` | video | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1920×1080 | Extreme slow-motion macro of champagne-gold leaf settling onto a wet sapphire resin surface, a singl… | `MIGRATED` | no | `rivya/material/material-macro-037-16x9` | — |
| `MATERIAL-MACRO-038` | video | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Extreme macro of deep ocean blue resin flowing and folding like a sea seen from above, white pigment… | `MIGRATED` | no | `rivya/material/material-macro-038-16x9` | — |
| `MATERIAL-MACRO-039` | video | `material-macro` | about | material-palette | `MATERIAL_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Gold leaf settling on sapphire resin (720p variant). | `MIGRATED` | no | `rivya/material/material-macro-039-16x9` | — |
| `PRESERVATION-KEEPSAKE-001` | image | `preservation-keepsake` | collection/preservation | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A sealed rectangular preservation block curing on a levelled bench under one warm work lamp, a full… | `MIGRATED` | no | `rivya/collection/preservation/preservation-keepsake-001-4x5` | — |
| `PRESERVATION-KEEPSAKE-002` | image | `preservation-keepsake` | collection/preservation | gallery | `CATEGORY_GALLERY` | higgsfield | `cinematic_studio_2_5` | 1:1 | 2048×2048 | Square atmospheric still life: a small clear resin keepsake block holding preserved petals, resting… | `MIGRATED` | no | `rivya/collection/preservation/preservation-keepsake-002-1x1` | — |
| `PRESERVATION-KEEPSAKE-003` | image | `preservation-keepsake` | collection/preservation | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A wedding invitation card and dried rose petals suspended in a clear resin block keepsake, anniversa… | `MIGRATED` | no | `rivya/collection/preservation/preservation-keepsake-003-16x9` | — |
| `PRESERVATION-KEEPSAKE-004` | image | `preservation-keepsake` | collection/preservation | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A baby's tiny handprint and footprint cast in a resin keepsake frame with a soft gold blank letterin… | `MIGRATED` | no | `rivya/collection/preservation/preservation-keepsake-004-16x9` | — |
| `PRESERVATION-VARMALA-001` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A fresh marigold-and-rose wedding varmala coiled on a seasoned dark teak workbench, still bright, bl… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-001-4x5` | — |
| `PRESERVATION-VARMALA-002` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:2 | 5056×3392 | One garland photographed twice on the same dark teak ground under the same single key light: on the… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-002-3x2` | — |
| `PRESERVATION-VARMALA-003` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | Marigold and rose petals separated from a garland and graded by size in neat rows across cream blott… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-003-4x5` | — |
| `PRESERVATION-VARMALA-004` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Atmospheric macro, portrait: marigold and rose petals suspended mid-drift in perfectly clear resin,… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-004-4x5` | — |
| `PRESERVATION-VARMALA-005` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-005-3x4` | — |
| `PRESERVATION-VARMALA-006` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-006-3x4` | — |
| `PRESERVATION-VARMALA-007` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `recraft_v4_1` | 16:9 | 2688×1536 | emotional cinematic wide still, elegant hands gently lowering a red and marigold flower garland into… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-007-16x9` | — |
| `PRESERVATION-VARMALA-008` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `recraft_v4_1` | 3:2 | 1280×832 | emotional luxury still life, clear resin keepsake block preserving a red and marigold flower garland… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-008-3x2` | — |
| `PRESERVATION-VARMALA-009` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `recraft_v4_1` | 4:5 | 896×1152 | macro product photography, clear resin keepsake block preserving red and marigold wedding garland fl… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-009-4x5` | — |
| `PRESERVATION-VARMALA-010` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A phone photographing a varmala under good window light on a plain backdrop, teaching composition. P… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-010-16x9` | — |
| `PRESERVATION-VARMALA-011` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A pristine preserved varmala frame under bright honest light, a magnifying glass resting beside it.… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-011-16x9` | — |
| `PRESERVATION-VARMALA-012` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Three varmala preservation frames of increasing size leaning on a wall, one with LED backlight. Phot… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-012-16x9` | — |
| `PRESERVATION-VARMALA-013` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Dried wedding flowers beside a fresh resin casting in progress, hopeful warm light. Photorealistic e… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-013-16x9` | — |
| `PRESERVATION-VARMALA-014` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A wedding varmala carefully laid flat in a breathable paper-lined box, gentle morning light. Photore… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-014-16x9` | — |
| `PRESERVATION-VARMALA-015` | image | `preservation-varmala` | collection/preservation | hero | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A preserved wedding varmala of marigolds and roses cast in a large clear resin frame with a gold fra… | `MIGRATED` | no | `rivya/collection/preservation/preservation-varmala-015-16x9` | — |
| `PROCESS-CURE-001` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A dedicated cure room seen from the doorway: a steel rack of levelled shelves holding filled moulds… | `MIGRATED` | no | `rivya/process/cure/process-cure-001-4x5` | — |
| `PROCESS-CURE-002` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A dark studio interior with a work bench of curing large-format moulds under one warm lamp, reframed… | `MIGRATED` | no | `rivya/process/cure/process-cure-002-9x16` | — |
| `PROCESS-CURE-003` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A dark studio interior with a work bench of curing large-format moulds under one warm lamp, reframed… | `MIGRATED` | no | `rivya/process/cure/process-cure-003-9x16` | — |
| `PROCESS-CURE-004` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | One frame from a four-part material story shot in a single session, same lens, same single soft key… | `MIGRATED` | no | `rivya/process/cure/process-cure-004-4x5` | — |
| `PROCESS-CURE-005` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | One frame from a four-part material story shot in a single session, same lens, same single soft key… | `MIGRATED` | no | `rivya/process/cure/process-cure-005-4x5` | — |
| `PROCESS-CURE-006` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A planner calendar beside wrapped resin gifts and a curing piece, wedding-season styling. Photoreali… | `MIGRATED` | no | `rivya/process/cure/process-cure-006-16x9` | — |
| `PROCESS-CURE-007` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A curing resin piece under a dust cover with an hourglass beside it, patient studio stillness. Photo… | `MIGRATED` | no | `rivya/process/cure/process-cure-007-16x9` | — |
| `PROCESS-CURE-008` | image | `process-cure` | process | cure | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A studio workbench with a sketch, pigment swatches, a curing resin piece and a shipping box arranged… | `MIGRATED` | no | `rivya/process/cure/process-cure-008-16x9` | — |
| `PROCESS-FINISH-001` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A cured resin tabletop mid wet-sand, a sanding block resting at an angle on its surface, a thin film… | `MIGRATED` | no | `rivya/process/finish/process-finish-001-4x5` | — |
| `PROCESS-FINISH-002` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A foam polishing pad mid-pass across a large resin surface, a mirror-bright arc of finished gloss tr… | `MIGRATED` | no | `rivya/process/finish/process-finish-002-4x5` | — |
| `PROCESS-FINISH-003` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A cured resin tabletop mid wet-sand, a sanding block resting at an angle on its surface, a thin film… | `MIGRATED` | no | `rivya/process/finish/process-finish-003-4x5` | — |
| `PROCESS-FINISH-004` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A foam polishing pad mid-pass across a large resin surface, a mirror-bright arc of finished gloss tr… | `MIGRATED` | no | `rivya/process/finish/process-finish-004-4x5` | — |
| `PROCESS-FINISH-005` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 4:3 | 2400×1792 | Close editorial photograph: a craftsman's hands only, no face, sanding the live edge of a walnut and… | `MIGRATED` | no | `rivya/process/finish/process-finish-005-4x3` | — |
| `PROCESS-FINISH-006` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `recraft_v4_1` | 4:3 | 2432×1792 | Close-up of hands in dark cotton sleeves polishing a small round resin artwork with a soft cloth, gl… | `MIGRATED` | no | `rivya/process/finish/process-finish-006-4x3` | — |
| `PROCESS-FINISH-007` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A flat-lay of resin studio tools — torch, mixing cups, pigments, gloves, heat gun — on a dark workbe… | `MIGRATED` | no | `rivya/process/finish/process-finish-007-16x9` | — |
| `PROCESS-FINISH-008` | image | `process-finish` | process | finish | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A half-polished resin coaster showing before-and-after gloss contrast, polishing compound nearby. Ph… | `MIGRATED` | no | `rivya/process/finish/process-finish-008-16x9` | — |
| `PROCESS-MOULD-001` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | One pair of gloved hands tipping a mixing cup into a small mould in the centre of frame while three… | `MIGRATED` | no | `rivya/process/mould/process-mould-001-4x5` | — |
| `PROCESS-MOULD-002` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A wide shallow mould part-filled with clear resin on a dark bench, preserved marigold petals arrange… | `MIGRATED` | no | `rivya/process/mould/process-mould-002-16x9` | — |
| `PROCESS-MOULD-003` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A round coffee-table blank in raw formwork, sapphire-tinted resin filling a live-edge seam down its… | `MIGRATED` | no | `rivya/process/mould/process-mould-003-4x5` | — |
| `PROCESS-MOULD-004` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A round coffee-table blank in raw formwork, sapphire-tinted resin filling a live-edge seam down its… | `MIGRATED` | no | `rivya/process/mould/process-mould-004-4x5` | — |
| `PROCESS-MOULD-005` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Hands in black nitrile gloves arranging marigold and rose petals inside an empty silicone mould on a… | `MIGRATED` | no | `rivya/process/mould/process-mould-005-16x9` | — |
| `PROCESS-MOULD-006` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A single empty, freshly demoulded silicone mould lying on a pale warm stone ground, soft light, a lo… | `MIGRATED` | no | `rivya/process/mould/process-mould-006-16x9` | — |
| `PROCESS-MOULD-007` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A single empty, freshly demoulded silicone mould lying on a pale warm stone ground, soft light, a lo… | `MIGRATED` | no | `rivya/process/mould/process-mould-007-16x9` | — |
| `PROCESS-MOULD-008` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Hands in black nitrile gloves arranging marigold and rose petals inside an empty silicone mould on a… | `MIGRATED` | no | `rivya/process/mould/process-mould-008-16x9` | — |
| `PROCESS-MOULD-009` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/process/mould/process-mould-009-3x4` | — |
| `PROCESS-MOULD-010` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/process/mould/process-mould-010-3x4` | — |
| `PROCESS-MOULD-011` | image | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Close-up of an artisan's hands placing dried red rose and marigold wedding-garland petals into a cir… | `MIGRATED` | no | `rivya/process/mould/process-mould-011-4x5` | — |
| `PROCESS-MOULD-012` | video | `process-mould` | process | mould | `PROCESS_STORY` | higgsfield | `seedance_2_0` | 16:9 | 1920×1080 | Artisan hands in a dark workshop at night pouring glossy blue resin from a steel cup into a round si… | `MIGRATED` | no | `rivya/process/mould/process-mould-012-16x9` | — |
| `PROCESS-PIGMENT-001` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A glass mixing jug of clear epoxy resin on a scale, a stir stick lifting a ribbon of deep sapphire p… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-001-4x5` | — |
| `PROCESS-PIGMENT-002` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A glass mixing jug of clear epoxy resin on a scale, a stir stick lifting a ribbon of deep sapphire p… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-002-4x5` | — |
| `PROCESS-PIGMENT-003` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Portrait abstract for social: deep ocean blue resin folds with fine white pigment lace, glassy depth… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-003-4x5` | — |
| `PROCESS-PIGMENT-004` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 16:9 | 2752×1536 | Abstract macro photograph: a thin champagne-warm veil of pigment folded into obsidian-dark resin, on… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-004-16x9` | — |
| `PROCESS-PIGMENT-005` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Still life of resin art supplies: glass jars of shimmering mica pigment powders in blues and golds,… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-005-4x5` | — |
| `PROCESS-PIGMENT-006` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `recraft_v4_1` | 3:4 | 1792×2432 | Vertical still life on a dark stone table: small glass jars of sapphire blue resin pigment, a brush,… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-006-3x4` | — |
| `PROCESS-PIGMENT-007` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `recraft_v4_1` | 16:9 | 2688×1536 | Small evening resin-art workshop scene: a long dark wooden table set with individual work mats, mold… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-007-16x9` | — |
| `PROCESS-PIGMENT-008` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Four material swatch squares — resin, glass, acrylic, wood — lined up under studio light. Photoreali… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-008-16x9` | — |
| `PROCESS-PIGMENT-009` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A composition of wedding keepsakes — invitation, haldi-stained cloth swatch, bangles — arranged for… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-009-16x9` | — |
| `PROCESS-PIGMENT-010` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Macro of pigment dishes and ink drops swirling into ocean-blue resin, gold mica shimmer. Photorealis… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-010-16x9` | — |
| `PROCESS-PIGMENT-011` | image | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A designer's moodboard with fabric swatches, pigment dishes and rough sketches for a resin commissio… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-011-16x9` | — |
| `PROCESS-PIGMENT-012` | video | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Extreme macro: mineral pigment dispersing through wet clear resin during a pour, slow blooming cloud… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-012-16x9` | — |
| `PROCESS-PIGMENT-013` | video | `process-pigment` | process | pigment | `PROCESS_STORY` | higgsfield | `cinematic_studio_3_0` | 9:16 | 768×1344 | Vertical macro for mobile: deep ocean blue resin flowing with white pigment veils blooming upward, u… | `MIGRATED` | no | `rivya/process/pigment/process-pigment-013-9x16` | — |
| `PROCESS-POUR-001` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | Deep sapphire resin pouring in one unbroken ribbon into a shallow round mould against a matte obsidi… | `MIGRATED` | no | `rivya/process/pour/process-pour-001-9x16` | — |
| `PROCESS-POUR-002` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A single frame of sapphire resin mid-pour into a shallow mould against a matte black backdrop, refra… | `MIGRATED` | no | `rivya/process/pour/process-pour-002-9x16` | — |
| `PROCESS-POUR-003` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | A single frame of sapphire resin mid-pour into a shallow mould against a matte black backdrop, refra… | `MIGRATED` | no | `rivya/process/pour/process-pour-003-9x16` | — |
| `PROCESS-POUR-004` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 9:16 | 3072×5504 | Deep sapphire resin pouring in one unbroken ribbon into a shallow round mould against a matte obsidi… | `MIGRATED` | no | `rivya/process/pour/process-pour-004-9x16` | — |
| `PROCESS-POUR-005` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | One frame from a four-part material story shot in a single session, same lens, same single soft key… | `MIGRATED` | no | `rivya/process/pour/process-pour-005-4x5` | — |
| `PROCESS-POUR-006` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | One frame from a four-part material story shot in a single session, same lens, same single soft key… | `MIGRATED` | no | `rivya/process/pour/process-pour-006-4x5` | — |
| `PROCESS-POUR-007` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `recraft_v4_1` | 16:9 | 2688×1536 | cinematic wide hero still, macro liquid epoxy resin mid-pour cascading like a slow ocean wave, deep… | `MIGRATED` | no | `rivya/process/pour/process-pour-007-16x9` | — |
| `PROCESS-POUR-008` | image | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A step-by-step studio scene: flower drying racks, silica trays and a frame mid-pour. Photorealistic… | `MIGRATED` | no | `rivya/process/pour/process-pour-008-16x9` | — |
| `PROCESS-POUR-009` | video | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Extreme slow-motion macro of deep sapphire resin pouring in one unbroken ribbon into a shallow round… | `MIGRATED` | no | `rivya/process/pour/process-pour-009-16x9` | — |
| `PROCESS-POUR-010` | video | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `seedance_2_0` | 16:9 | 1920×1080 | Extreme macro slow-motion: liquid epoxy in deep sapphire pouring onto black glass, fine metallic gol… | `MIGRATED` | no | `rivya/process/pour/process-pour-010-16x9` | — |
| `PROCESS-POUR-011` | video | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1920×1080 | Extreme slow-motion macro of sapphire resin pouring in one unbroken ribbon into a wide shallow mould… | `MIGRATED` | no | `rivya/process/pour/process-pour-011-16x9` | — |
| `PROCESS-POUR-012` | video | `process-pour` | process | pour | `PROCESS_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Extreme slow-motion macro of deep sapphire epoxy pouring in one unbroken continuous ribbon into a sh… | `MIGRATED` | no | `rivya/process/pour/process-pour-012-16x9` | — |
| `PROCESS-STUDIO-001` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:3 | 4800×3584 | A studio tool wall photographed straight on: heat guns, notched spreaders, a digital scale, clamps a… | `MIGRATED` | no | `rivya/process/studio/process-studio-001-4x3` | — |
| `PROCESS-STUDIO-002` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A long rectangular slab destined to become a dining table, resin poured into a live-edge timber void… | `MIGRATED` | no | `rivya/process/studio/process-studio-002-16x9` | — |
| `PROCESS-STUDIO-003` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A long rectangular slab destined to become a dining table, resin poured into a live-edge timber void… | `MIGRATED` | no | `rivya/process/studio/process-studio-003-16x9` | — |
| `PROCESS-STUDIO-004` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 16:9 | 2752×1536 | Dark premium artisan atelier, wide editorial photograph: a long timber workbench holding a half-fini… | `MIGRATED` | no | `rivya/process/studio/process-studio-004-16x9` | — |
| `PROCESS-STUDIO-005` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | The interior of a dark artisan resin studio at night, a single warm work lamp over a bench of curing… | `MIGRATED` | no | `rivya/process/studio/process-studio-005-16x9` | — |
| `PROCESS-STUDIO-006` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | Artisan hands in black nitrile gloves using a precision heat gun to draw fine wave patterns across d… | `MIGRATED` | no | `rivya/process/studio/process-studio-006-4x5` | — |
| `PROCESS-STUDIO-007` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | The interior of a dark artisan resin studio at night, a single warm work lamp over a bench of curing… | `MIGRATED` | no | `rivya/process/studio/process-studio-007-16x9` | — |
| `PROCESS-STUDIO-008` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | Artisan hands in black nitrile gloves using a precision heat gun to draw fine wave patterns across d… | `MIGRATED` | no | `rivya/process/studio/process-studio-008-4x5` | — |
| `PROCESS-STUDIO-009` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `recraft_v4_1` | 4:3 | 1216×896 | artisan craft process still, gloved hands tilting a wooden mold with freshly poured translucent deep… | `MIGRATED` | no | `rivya/process/studio/process-studio-009-4x3` | — |
| `PROCESS-STUDIO-010` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 16:9 | 2752×1536 | Bright porcelain-toned artisan studio table by a large window, soft ivory daylight, handmade resin c… | `MIGRATED` | no | `rivya/process/studio/process-studio-010-16x9` | — |
| `PROCESS-STUDIO-011` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Macro of a small artisan torch flame passing over a freshly poured resin surface, tiny bubbles risin… | `MIGRATED` | no | `rivya/process/studio/process-studio-011-3x2` | — |
| `PROCESS-STUDIO-012` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `recraft_v4_1` | 16:9 | 2688×1536 | Artisan resin studio at night: wooden workbench with silicone molds, jars of blue pigment, gold leaf… | `MIGRATED` | no | `rivya/process/studio/process-studio-012-16x9` | — |
| `PROCESS-STUDIO-013` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A single artisan workbench with one piece in progress, neat rows of shipping boxes blurred far behin… | `MIGRATED` | no | `rivya/process/studio/process-studio-013-16x9` | — |
| `PROCESS-STUDIO-014` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A master artisan's hands leveling a large ocean-resin pour, tools and torch nearby, honest workshop… | `MIGRATED` | no | `rivya/process/studio/process-studio-014-16x9` | — |
| `PROCESS-STUDIO-015` | image | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `seedream_v5_pro` | 3:4 | 1328×1760 | A resin-art workshop scene — gloved artisan hands pouring glossy ocean-blue resin from a cup onto a… | `MIGRATED` | no | `rivya/process/studio/process-studio-015-3x4` | — |
| `PROCESS-STUDIO-016` | video | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Dark premium artisan atelier: craftsman's hands only, no face, sanding the live edge of a resin and… | `MIGRATED` | no | `rivya/process/studio/process-studio-016-16x9` | — |
| `PROCESS-STUDIO-017` | video | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Workshop bench dolly (720p variant 2). | `MIGRATED` | no | `rivya/process/studio/process-studio-017-16x9` | — |
| `PROCESS-STUDIO-018` | video | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1280×720 | Workshop bench dolly (720p variant). | `MIGRATED` | no | `rivya/process/studio/process-studio-018-16x9` | — |
| `PROCESS-STUDIO-019` | video | `process-studio` | process | studio | `PROCESS_STORY` | higgsfield | `seedance_2_5` | 16:9 | 1920×1080 | Slow smooth dolly along a long workshop bench set with pour cups, pigment jars and curing moulds und… | `MIGRATED` | no | `rivya/process/studio/process-studio-019-16x9` | — |
| `PROCESS-TIMBER-001` | image | `process-timber` | process | timber | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A rough-sawn timber slab clamped to a workshop bench, a hand plane mid-stroke along its edge, pale s… | `MIGRATED` | no | `rivya/process/timber/process-timber-001-4x5` | — |
| `PROCESS-TIMBER-002` | image | `process-timber` | process | timber | `PROCESS_STORY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A rough-sawn timber slab clamped to a workshop bench, a hand plane mid-stroke along its edge, pale s… | `MIGRATED` | no | `rivya/process/timber/process-timber-002-4x5` | — |
| `PROCESS-TIMBER-003` | image | `process-timber` | process | timber | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Use the reference image as the exact base. Keep the camera position, lens, framing, lighting directi… | `MIGRATED` | no | `rivya/process/timber/process-timber-003-3x2` | — |
| `PROCESS-TIMBER-004` | image | `process-timber` | process | timber | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Editorial photograph, camera at standing height looking slightly down at a 30 degree angle, 50mm len… | `MIGRATED` | no | `rivya/process/timber/process-timber-004-3x2` | — |
| `PROCESS-TIMBER-005` | image | `process-timber` | process | timber | `PROCESS_STORY` | higgsfield | `cinematic_studio_2_5` | 3:2 | 2528×1696 | Editorial photograph, camera at standing height looking slightly down at a 30 degree angle, 50mm len… | `MIGRATED` | no | `rivya/process/timber/process-timber-005-3x2` | — |
| `PROCESS-TIMBER-006` | video | `process-timber` | process | timber | `PROCESS_STORY` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Extreme macro tracking along a live edge where teak grain meets clear resin, light shifting so resin… | `MIGRATED` | no | `rivya/process/timber/process-timber-006-16x9` | — |
| `PROCESS-TIMBER-007` | video | `process-timber` | process | timber | `PROCESS_STORY` | higgsfield | `cinematic_studio_3_0` | 16:9 | 1344×768 | Cinematic material story in one slow move: raw walnut grain, clear resin advancing across the timber… | `MIGRATED` | no | `rivya/process/timber/process-timber-007-16x9` | — |
| `THREE-D-RESIN-001` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-001-3x4` | — |
| `THREE-D-RESIN-002` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Macro of an FDM 3D print head laying translucent blue filament layer by layer onto a build plate, wa… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-002-16x9` | — |
| `THREE-D-RESIN-003` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | Macro of an FDM 3D print head laying translucent blue filament layer by layer onto a build plate, wa… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-003-16x9` | — |
| `THREE-D-RESIN-004` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:4 | 3584×4800 | One frame from a six-part collection series, all shot in a single session on the same seasoned dark… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-004-3x4` | — |
| `THREE-D-RESIN-005` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Modern 3D printer mid-print of a translucent geometric sculptural vase, glowing blue LED light from… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-005-4x5` | — |
| `THREE-D-RESIN-006` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A kids' room shelf with a personalized 3D-printed cloud lamp and star hooks, soft pastel-blue palett… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-006-16x9` | — |
| `THREE-D-RESIN-007` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A detailed custom figurine on a turntable beside reference photos, studio macro. Photorealistic edit… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-007-16x9` | — |
| `THREE-D-RESIN-008` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A 3D printer mid-print of a decorative vase, glowing print bed, workshop ambience. Photorealistic ed… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-008-16x9` | — |
| `THREE-D-RESIN-009` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Two house nameplates side by side — one crisp 3D-printed, one glossy cast resin with gold flake — mo… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-009-16x9` | — |
| `THREE-D-RESIN-010` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A hybrid art piece: white 3D-printed geometric lattice partially embedded in glossy ocean-blue resin… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-010-16x9` | — |
| `THREE-D-RESIN-011` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Close-up of three 3D-printing material samples — matte PLA, glossy PETG and translucent resin print… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-011-16x9` | — |
| `THREE-D-RESIN-012` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A detailed 3D-printed architectural scale model of a modern building displayed on an executive desk,… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-012-16x9` | — |
| `THREE-D-RESIN-013` | image | `three-d-resin` | collection/3d-resin | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | An assortment of intricate 3D-printed gift objects — geometric lamp, custom figurine, lattice bowl —… | `MIGRATED` | no | `rivya/collection/3d-resin/three-d-resin-013-16x9` | — |
| `WALL-ART-001` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A rectangular resin-and-teak plaque blank standing on edge against a matte obsidian wall, its poured… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-001-4x5` | — |
| `WALL-ART-002` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A calm, unstyled bedroom — a plain bed, muted linen, neutral walls — with one large abstract resin w… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-002-16x9` | — |
| `WALL-ART-003` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A spare study — a plain desk, one chair, a bare bookshelf, neutral walls — with one large abstract r… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-003-16x9` | — |
| `WALL-ART-004` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A spare study — a plain desk, one chair, a bare bookshelf, neutral walls — with one large abstract r… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-004-16x9` | — |
| `WALL-ART-005` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A plain dining room — a bare table, simple chairs, neutral walls — with one large abstract resin wal… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-005-16x9` | — |
| `WALL-ART-006` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A plain dining room — a bare table, simple chairs, neutral walls — with one large abstract resin wal… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-006-16x9` | — |
| `WALL-ART-007` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A calm, unstyled bedroom — a plain bed, muted linen, neutral walls — with one large abstract resin w… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-007-16x9` | — |
| `WALL-ART-008` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 21:9 | 6336×2688 | A very wide, low resin panel, a single soft horizontal gradient running from deep-ocean blue at the… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-008-21x9` | — |
| `WALL-ART-009` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A quiet, unstyled living room — a low sofa, a plain rug, muted grey walls, warm wood floor — with on… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-009-16x9` | — |
| `WALL-ART-010` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A quiet, unstyled living room — a low sofa, a plain rug, muted grey walls, warm wood floor — with on… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-010-16x9` | — |
| `WALL-ART-011` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A large abstract resin wall panel leaning unmounted against a bare obsidian studio wall, deep sapphi… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-011-4x5` | — |
| `WALL-ART-012` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 4:5 | 3712×4608 | A large abstract resin wall panel leaning unmounted against a bare obsidian studio wall, deep sapphi… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-012-4x5` | — |
| `WALL-ART-013` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 21:9 | 6336×2688 | A very wide, low resin panel, a single soft horizontal gradient running from deep-ocean blue at the… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-013-21x9` | — |
| `WALL-ART-014` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:2 | 5056×3392 | A large resin panel built from many thin layered pours, the palest sapphire at the top deepening thr… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-014-3x2` | — |
| `WALL-ART-015` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `nano_banana_2` | 3:2 | 5056×3392 | A large resin panel built from many thin layered pours, the palest sapphire at the top deepening thr… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-015-3x2` | — |
| `WALL-ART-016` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Gallery wall, editorial portrait: a very large abstract resin wall artwork in deep ocean blues with… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-016-4x5` | — |
| `WALL-ART-017` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `cinematic_studio_2_5` | 4:5 | 1856×2304 | Dark contemporary gallery wall with three framed ocean-resin art panels in deep blues with fine gold… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-017-4x5` | — |
| `WALL-ART-018` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | A backlit lithophane panel glowing warmly revealing a portrait relief, dark room. Photorealistic edi… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-018-16x9` | — |
| `WALL-ART-019` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 16:9 | 2048×1152 | Two wall pieces side by side — a minimal thin-line resin panel and a bold geode-style statement piec… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-019-16x9` | — |
| `WALL-ART-020` | image | `wall-art` | collection/wall-statement-art | gallery | `CATEGORY_GALLERY` | higgsfield | `seedream_v5_pro` | 3:4 | 1328×1760 | Playful premium kids-room resin decor — a cloud-and-stars name plaque and small night-light in soft… | `MIGRATED` | no | `rivya/collection/wall-art/wall-art-020-3x4` | — |
| `WORKSHOP-SESSION-001` | image | `workshop-session` | journal | workshop | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | An evening private workshop: four seats along one end of a long table under two warm pendant lamps,… | `MIGRATED` | no | `rivya/journal/workshop/workshop-session-001-16x9` | — |
| `WORKSHOP-SESSION-002` | image | `workshop-session` | journal | workshop | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A small group of four people seated along one side of a craft studio table, warm ambient light, thei… | `MIGRATED` | no | `rivya/journal/workshop/workshop-session-002-16x9` | — |
| `WORKSHOP-SESSION-003` | image | `workshop-session` | journal | workshop | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A long dark studio table set for eight places with mixing cups, folded gloves, pigment jars and empt… | `MIGRATED` | no | `rivya/journal/workshop/workshop-session-003-16x9` | — |
| `WORKSHOP-SESSION-004` | image | `workshop-session` | journal | workshop | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A small group of four people seated along one side of a craft studio table, warm ambient light, thei… | `MIGRATED` | no | `rivya/journal/workshop/workshop-session-004-16x9` | — |
| `WORKSHOP-SESSION-005` | image | `workshop-session` | journal | workshop | `EDITORIAL_COVER` | higgsfield | `nano_banana_2` | 16:9 | 5504×3072 | A long dark studio table set for eight places with mixing cups, folded gloves, pigment jars and empt… | `MIGRATED` | no | `rivya/journal/workshop/workshop-session-005-16x9` | — |

<!-- END GENERATED: asset-inventory -->

---


## 5. Coverage *(generated by `scripts/media/build-coverage-report.ts`, Phase 43)*

### 5.0 Slot by slot, against the declared registry *(generated)*

Every slot in `content/media-slots.ts` joined against the 250 manifest assets, with the disposition
the DATA supports. It is a proposal: an editor overrides it by binding, cropping or leaving a slot
empty, and the override is visible as a difference between this table and what the Studio shows.

<!-- BEGIN GENERATED: coverage -->

**26 declared slots.** REUSE_FROM_FAMILY 15 · RECROP_EXISTING 6 · GENERATE_NEW 2 · LEAVE_EMPTY 3.

The last column is the decision gate, in D6 order: real Rivya media · approved owner asset ·
existing manifest family · re-croppable. The first two print `—` because they are facts about
the business rather than about the library — see this script’s header.

| Slot | Page | Kind | Ratios (desktop/mobile) | Candidates | Native at each ratio | Widest | Resolution fit | Proposed | Why | Decision gate |
|---|---|---|---|---|---|---|---|---|---|---|
| `home.hero.video` | / | VIDEO | 16:9 / 9:16 | 0 | 0 / 0 | — | — | **GENERATE_NEW** | no manifest family can fill this slot, so questions 3 and 4 are both no | — · — · no · n/a |
| `home.hero.poster` | / | IMAGE | 21:9 / 9:16 | 0 | 0 / 0 | — | — | **GENERATE_NEW** | no manifest family can fill this slot, so questions 3 and 4 are both no | — · — · no · n/a |
| `home.intro` | / | IMAGE | 16:9 / 4:5 | 5 | 1 / 2 | 3712px | FITS (needs 768px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (5) · — |
| `collection.landing.hero` | /collection | IMAGE | 21:9 / 4:5 | 39 | 4 / 4 | 6336px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (39) · — |
| `collection.furniture.hero` | /collection/furniture | IMAGE | 16:9 / 4:5 | 17 | 6 / 6 | 6336px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (17) · — |
| `collection.collectible-design.hero` | /collection/collectible-design | IMAGE | 16:9 / 4:5 | 5 | 3 / 1 | 3168px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (5) · — |
| `collection.3d-resin.hero` | /collection/3d-resin | IMAGE | 16:9 / 4:5 | 13 | 10 / 1 | 5504px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (13) · — |
| `collection.wall-statement-art.hero` | /collection/wall-statement-art | IMAGE | 16:9 / 4:5 | 20 | 10 / 5 | 6336px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (20) · — |
| `collection.preservation.hero` | /collection/preservation | IMAGE | 16:9 / 4:5 | 19 | 9 / 5 | 5056px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (19) · — |
| `collection.decor.hero` | /collection/decor | IMAGE | 16:9 / 4:5 | 18 | 7 / 2 | 5504px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (18) · — |
| `collection.gifts.hero` | /collection/gifts | IMAGE | 16:9 / 4:5 | 10 | 7 / 1 | 5056px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (10) · — |
| `large-format.architectural` | /large-format | IMAGE | 21:9 / 4:5 | 1 | 1 / 0 | 6336px | FITS (needs 768px) | **RECROP_EXISTING** | candidates hold the desktop ratio natively but not the other | — · — · yes (1) · — |
| `large-format.coffee` | /large-format | IMAGE | 16:9 / 4:5 | 1 | 0 / 0 | 2528px | FITS (needs 768px) | **RECROP_EXISTING** | candidates exist at sufficient resolution but hold neither declared ratio natively | — · — · yes (1) · — |
| `large-format.dining` | /large-format | IMAGE | 16:9 / 4:5 | 5 | 2 / 0 | 6336px | FITS (needs 768px) | **RECROP_EXISTING** | candidates hold the desktop ratio natively but not the other | — · — · yes (5) · — |
| `large-format.seating` | /large-format | IMAGE | 16:9 / 4:5 | 4 | 0 / 4 | 3712px | FITS (needs 768px) | **RECROP_EXISTING** | candidates hold the mobile ratio natively but not the other | — · — · yes (4) · — |
| `large-format.console` | /large-format | IMAGE | 16:9 / 4:5 | 4 | 3 / 0 | 5504px | FITS (needs 768px) | **RECROP_EXISTING** | candidates hold the desktop ratio natively but not the other | — · — · yes (4) · — |
| `large-format.side` | /large-format | IMAGE | 16:9 / 4:5 | 3 | 1 / 2 | 3712px | FITS (needs 768px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (3) · — |
| `about.hero` | /about | IMAGE | 16:9 / 4:5 | 39 | 13 / 4 | 6336px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (39) · — |
| `process.sections` | /process | IMAGE | 4:3 / 4:5 | 79 | 4 / 21 | 5504px | FITS (needs 768px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (79) · — |
| `journal.cover` | /journal | IMAGE | 16:9 / 4:5 | 24 | 16 / 2 | 5504px | FITS (needs 768px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (24) · — |
| `portfolio.project` | /portfolio | IMAGE | 4:3 / 4:5 | 0 | 0 / 0 | — | — | **LEAVE_EMPTY** | the slot is declared EMPTY_STATE: filling it would assert a business fact nobody has confirmed | — · — · no · n/a |
| `custom-commissions.hero` | /custom-commissions | IMAGE | 21:9 / 4:5 | 5 | 0 / 2 | 3712px | FITS (needs 2560px) | **RECROP_EXISTING** | candidates hold the mobile ratio natively but not the other | — · — · yes (5) · — |
| `custom-commissions.supporting` | /custom-commissions | IMAGE | 4:3 / 4:5 | 26 | 2 / 4 | 5504px | FITS (needs 768px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (26) · — |
| `contact.hero` | /contact | IMAGE | 16:9 / 4:5 | 39 | 13 / 4 | 6336px | FITS (needs 2560px) | **REUSE_FROM_FAMILY** | candidates hold both declared ratios natively | — · — · yes (39) · — |
| `faq.hero` | /faq | IMAGE | 16:9 / 4:5 | 0 | 0 / 0 | — | — | **LEAVE_EMPTY** | the slot is declared EMPTY_STATE: filling it would assert a business fact nobody has confirmed | — · — · no · n/a |
| `search.empty` | /search | IMAGE | 16:9 / 4:5 | 0 | 0 / 0 | — | — | **LEAVE_EMPTY** | the slot is declared EMPTY_STATE: filling it would assert a business fact nobody has confirmed | — · — · no · n/a |

<!-- END GENERATED: coverage -->

### 5.1 The reading behind those rows *(hand-written, Phase 07, kept)*

Phase 07 produced this **projected** coverage before most slots existed. It is kept because it
carries the reasoning — which specific asset was considered for which surface, and why it was or
was not enough — that a generated table has no room for. Where the two disagree, §5.0 is what the
registry and the manifest actually say today.

| Public surface | Manifest coverage today | Projected disposition |
|---|---|---|
| `/` hero video | 0 videos carry `page = home`; the 7 videos at 1920×1080 are process, macro or gallery subjects | `GENERATE_NEW` — `HOME-HERO-VIDEO-001` |
| `/` hero poster, desktop | `LARGEFORMAT-DINING-002` (21:9, 6336×2688) fits as an interim still | `GENERATE_NEW` — must match the video frame — `HOME-HERO-POSTER-001` |
| `/` hero poster, mobile | `LARGEFORMAT-DINING-001` (9:16, 1536×2752), prompted "for a mobile hero". It clears the 9:16 mobile-hero minimum of 1440 × 2560 but is one of the 14 images below `hero`'s 1600 px width, so it is mobile-hero-eligible only | `REUSE_FROM_FAMILY` |
| `/collection` landing hero | no asset carries `page = collection`; three 21:9 `material-macro` masters at 6336 px (`MATERIAL-MACRO-009`, `-011`, `-015`) fit. `MATERIAL-MACRO-027` is the family's fourth 21:9 but is 3168 px — it clears `hero-xl` and is not a 6336 px master | `REUSE_FROM_FAMILY` |
| `/collection/furniture` hero, desktop | no `furniture` family; of the 18 `largeformat-*` assets, 8 are workshop blanks (DQ-8). `LARGEFORMAT-COFFEE-001` (2528×1696) crops 3:2→16:9 | `RECROP_EXISTING` |
| `/collection/furniture` hero, mobile — and the `/collection` Furniture card | every 4:5 asset in `largeformat-*` is one of the 8 workshop blanks | `GENERATE_NEW` — `FURNITURE-HERO-002` |
| `/large-format` seating card, 4:5, and homepage Sculptural Furniture card | all 4 `largeformat-seating` assets are 4:5 workshop blanks; no finished seat exists at any ratio | `GENERATE_NEW` — `LARGE-SEATING-CARD-001` |
| `/large-format` consoles & side card, 4:5 | every 4:5 asset in `largeformat-console` and `largeformat-side` is a workshop blank; the one finished console is 3:2 and a portrait crop removes its length | `GENERATE_NEW` — `LARGE-CONSOLE-CARD-001` |
| `/collection/collectible-design` | no family; 5 `gallery-scene` assets are the category's own subject | `REUSE_FROM_FAMILY` |
| `/custom-commissions` hero | no `commission` family; `INTERIOR-LIFESTYLE-002` (2528×1696) crops 3:2→16:9 | `RECROP_EXISTING` |
| `/process` hero, 21:9 | no `process-*` asset is 21:9; `PROCESS-STUDIO-005` (5504×3072) crops 16:9→21:9 | `RECROP_EXISTING` |
| `/large-format` dining card, 4:5 | no portrait table asset; the 4:5 `largeformat-*` assets are workshop blanks | `GENERATE_NEW` — `LARGE-DINING-CARD-001` |
| `/large-format` coffee card, 4:5 | family = 1 asset, 3:2 only | `GENERATE_NEW` — `LARGE-COFFEE-CARD-001` |
| `/large-format` architectural card, 4:5 | family = 1 asset, 21:9 only | `GENERATE_NEW`, **held** pending owner verification |
| `/large-format` conference card | — | `LEAVE_EMPTY` pending owner verification (SEED §12) |
| `/contact` | 0 assets; `material-macro` supplies both ratios | `REUSE_FROM_FAMILY` |
| `/faq`, `/search`, `/privacy`, `/terms`, 404, 500 | 0 assets | `LEAVE_EMPTY` — typographic by design |
| Journal article covers | 24 `editorial` + `workshop-session` assets for 10 seeded drafts (SEED §20) | `REUSE_FROM_FAMILY` |
| Portfolio projects | 0 project assets; 5 `gallery-scene` atmosphere stills | `LEAVE_EMPTY` (D10) |
| Product media | 0 | `OWNER` — permanent |
| Brand marks and the default OG card | 0 | `OWNER` — permanent |
| 3D models | 0 | `LEAVE_EMPTY` — permanent |

### 5.1 Resolution fit against the Cloudinary presets

Computed from `width`/`height`. This is the constraint that decides whether a family can fill a
hero at all.

| Threshold | Assets below it | Consequence |
|---|---|---|
| 1600 px wide (`hero` preset) | **14 images** | Cannot fill a section hero without upscaling |
| 2560 px wide (`hero-xl` preset) | **120 assets** — 94 images and all 26 videos | Cannot fill a full-bleed 21:9 hero |
| 1920 px wide (video hero) | **19 of 26 videos** | Only 7 videos are 1920 × 1080; the rest are 768–1344 px |
| Long edge ≥ 2560 px | **131 of 224 images** clear it | The usable pool for full-bleed work |

**No asset is ever upscaled to close a gap.** Upscaling a 1280 px source into a 2560 px hero is
visibly worse than binding nothing; the slot is reported as a gap instead (Phase 43 risk table).

---

## 6. Data quality *(hand-written — findings, not defects to hide)*

Each finding is measured from the manifest, names its consequence, and names its fix. None of
them justifies regenerating anything.

| # | Finding | Measure | Consequence | Fix |
|---|---|---|---|---|
| DQ-0 · **FIXED** | The manifest generator numbered images and videos with separate counters, so a video was minted the same `rivya_asset_id` as a still in its family | **26 of 250** IDs were shared by an image/video pair — 224 IDs for 250 assets — and **6** `cloudinary_public_id` values with them | The asset ID is the authoritative key (D6). A collision there is a correctness defect, not a cosmetic one: any ledger, binding or Studio filter keyed on it would silently merge two assets | Fixed at source. `build-higgsfield-manifest.py` now shares one counter across both types and asserts uniqueness before writing; the 26 videos were renumbered and **no image ID changed**. `check-asset-ids.py` keeps the planned-ID allocator out of the same namespace (D6, amendment A1) |
| DQ-1 | Draft alt text is truncated prompt output | **124 of 250** `alt_text_draft` values end in `…` | Unusable as published alt text; a screen reader hears a sentence stop mid-clause | Phase 43 alt-text queue rewrites all 250; `scripts/media/check-alt-text.mjs` rejects a trailing ellipsis |
| DQ-2 | Draft alt text is too long | **148 of 250** exceed 160 characters; longest is 180; mean 139 | Alt text is read aloud in full; 180 characters is a paragraph, not a label | Rewrite to one sentence describing what is visible (SEED §43) |
| DQ-3 | Draft alt text opens with camera vocabulary | **55 of 250** begin with `Vertical`, `Ultra-wide`, `Wide shot`, `Extreme macro`, `Macro`, `Square`, `Close`, `Abstract`, `Editorial`, `Photorealistic`, `Slow`, `Cinematic` or `One frame` | Describes the photograph, not the object. A blind visitor learns the lens, not the table | Rewrite; the linter rejects the opening vocabulary |
| DQ-4 | Draft alt text contains hex colour codes | e.g. `PROCESS-POUR-007` — `…deep midnight-blue backdrop (#0A1A2F) flowing into royal blue depths (#1E4FD8),…` | Hex codes read aloud as letter salad | Rewrite; the linter rejects `#RRGGBB` |
| DQ-5 | Some draft alt text describes the *series*, not the *frame* | `THREE-D-RESIN-001` reads "A six-part collection series, all shot in a single session on the same seasoned dark teak tabletop…"; `MATERIAL-MACRO-016` reads "Material macros shot on an identical matte charcoal-neutral stone ground…" | The alt text describes a production method, not an image | Rewrite from the `Frame:` clause of the prompt, which is the part that describes the picture |
| DQ-6 | `editorial` is a catch-all family | **14 of 19** `editorial` assets have an empty `subject_tags` array — the only 14 empty arrays in the manifest | Family filters in the tracker under-return; these assets are hard to find by subject | Add `subject_tags` in the v2 builder pass. Do **not** rename the family — the ID would change |
| DQ-7 | Two `largeformat-*` assets are subject-mismatched | `LARGEFORMAT-SIDE-003` is a desk with 3D-printed organisers (a `three-d-resin` subject); `LARGEFORMAT-CONSOLE-004` is a resin wall panel above a console (a `wall-art` subject) | Placed by family they would land on the wrong page | Place by subject; record the correction in `subject_tags`, never by renaming the asset |
| DQ-8 | Eight `largeformat-*` assets show unfinished blanks | `LARGEFORMAT-SEATING-001…004`, `-SIDE-001`, `-002`, `-CONSOLE-001`, `-002` — each prompt says "no finished piece in frame" or equivalent | If placed in a finished-object card they read as a half-built product. The bite is that **every 4:5 asset in the `largeformat-*` group is one of these eight**, so the finished-object cards on `/`, `/large-format` and `/collection` have no portrait supply at all | Restrict them to making, material and commission contexts (plan §1.1a). The four card and category-hero slots they were covering are `GENERATE_NEW`: plan §6 G10, G11, G12 |
| DQ-9 | Near-duplicate prompts inside families | `MATERIAL-MACRO-016`/`-010`, `-017`/`-021`, `-018`/`-019`, `-020`/`-022`, `THREE-D-RESIN-002`/`-003`, `LARGEFORMAT-CONSOLE-001`/`-002` and others share a prompt verbatim | Two near-identical images in one grid look like a mistake | Bind one of each pair; keep the other as a swap candidate. Never both in the same section |
| DQ-10 | Five prompt recipes coexist | Recipe A 114 · C 55+6 · E 9 · B 20 · loose atelier prose 20 · video 26 | The library has three different colour temperaments; mixing them inside one section is visible | Bind within one recipe per section. `HIGGSFIELD_GUIDE.md` §2 records which family uses which |
| DQ-11 | Source files are PNG, target filenames say `.webp` | 224 `source_url` values end `.png`; 224 `filename` values end `.webp` | The filename is a *delivery* name, not a source name | Upload the PNG master; Cloudinary derives WebP/AVIF via `f_auto`. See `CLOUDINARY.md` §10 |
| DQ-14 | **`/large-format`'s Conference & Commercial Tables grouping has no photograph at all** | The `large-format` bucket holds 18 assets across `largeformat-dining` (5), `-console` (4), `-side` (3), `-seating` (4), `-coffee` (1) and `-monumental` (1). None depicts a conference or commercial table | The grouping renders as a **text-only card**, which `CategoryListSection` treats as a first-class layout rather than a fallback: no reserved grey box, no borrowed image from a neighbouring family | Left unfilled. Borrowing a dining image would be the exact failure the regeneration guard exists to prevent — a photograph of one thing captioned as another. The brief is in `HIGGSFIELD_MASTER_ASSET_PLAN.md`; generating it needs the owner's approval under D6. The grouping is also `OWNER_VERIFICATION_REQUIRED`, so it is off the page at launch either way |
| DQ-13 | **The library holds no 21:9 video at all** | **26 videos: 23 at 16:9, 3 at 9:16, none at 21:9** — counted from the manifest, where 9 of the 224 stills ARE 21:9. The homepage hero's desktop still is 21:9 (`LARGEFORMAT-DINING-002`) and the only desktop clip that suits it is 16:9 (`LARGEFORMAT-DINING-005`) | Phase 11's hero plays the 16:9 clip inside the 21:9 box with `object-fit: cover`, centre-anchored, losing roughly a quarter of its height. Never letterboxed — bars read as a broken asset — and never used as the poster, which stays the 21:9 still | Accepted as an interim, not disguised: the still is the LCP element and the clip is decorative, gated and post-paint (`HeroMotion`, RC-214). Filling it is a new generation and needs the owner's approval under D6. Recorded as a slot gap in `content/media-slots.ts` (`home.hero.video`, `resolution: 'GENERATE'`), whose own comment reasons about the same pixels |
| DQ-12 | One prompt carries an operator instruction | `MATERIAL-MACRO-029` ends "…add mirror in the center place so that look nice" | Harmless to the asset; noise in the tracker and in any prompt-similarity search | Leave the prompt untouched — it is generation provenance. Never rewrite history in the manifest |

---

## 7. Migration ledger *(generated after Phase 07 runs)*

Populated from `higgsfield_migration_runs` and `data/higgsfield/migration-log.json`.
The log is keyed by `higgsfield_generation_id`. Asset IDs are unique too, since the fix in
§6 DQ-0 — but an asset ID is an **ordinal within a family**, and a manifest rebuild can legitimately
renumber it, as one already has. A generation id is minted by Higgsfield and never moves. That is
why it, and not the asset id, keys the ledger.

| Run | Started | Scope | Attempted | Migrated | Skipped | Failed | Dry run | By |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

*No run recorded. Expected first entries: a `--dry-run` over `ALL` reporting `attempted 250,
migrated 0`; then a live run reporting `migrated 250, failed 0`; then a repeat run reporting
`skipped 250, migrated 0`, which is the idempotency proof.*

---

## 8. Concept placement *(generated, Phase 43)*

Every concept asset bound to a **published** slot, so the owner can see at a glance exactly where
AI media appears on the public site. Empty today because nothing is bound.

| Asset ID | Type | Bound to | Slot · role | Section status | Owner verification |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

**Invariants this table exists to police.** A row here that violates any of these is a defect:

- No concept asset may appear against a `PRODUCT` context — the `product_media` trigger rejects it.
- No concept asset may appear against a `PORTFOLIO` context — portfolio stays an empty state (D10).
- No caption or alt text on a bound concept asset may name a product, price, dimension, material
  specification, client, project, lead time or delivery.
- Every Studio view that lists these assets carries the banner
  *"Concept media. Never presented as completed, delivered Rivya work."*
  (manifest `policy.rules[0]`, SEED §40.)

---

## 9. Regeneration guard *(hand-written)*

```
npm run media:assert-no-regen        # scripts/media/assert-no-regeneration.ts, wired into CI
```

It reads every brief in `HIGGSFIELD_MASTER_ASSET_PLAN.md` §6 and fails, non-zero, if a brief's
target matches an existing `rivya_asset_id` or an already-satisfied `family` + `section` pair.
The Studio Higgsfield tracker has **no generate control anywhere**, by design.

`data/higgsfield/asset-manifest.json` has exactly one writer:
`scripts/media/build-higgsfield-manifest.py`. `npm run manifest:verify` re-runs it and fails on
any diff. Hand-editing the manifest to close a gap is the one failure mode that would make every
count in this document a lie.
