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
| Distinct `rivya_asset_id` values | **224** — 26 IDs are shared by an image/video pair | `rivya-hf-v1` |
| Distinct `filename` values | **250** — unique, usable as a human key | `rivya-hf-v1` |
| Distinct `cloudinary_public_id` values | **244** — 6 shared by an image/video pair, kept apart by `resource_type` | `rivya-hf-v1` |
| Families | 24 | `rivya-hf-v1` |
| Cloudinary folders | 23, all under `rivya/` | `rivya-hf-v1` |
| Migrated to Cloudinary | **0 of 250** — every row reads `AVAILABLE_UNMIGRATED` | pre-Phase-07 |
| Bound to a CMS slot | **0 of 250** — every row reads `used_in_cms: false`, `cms_placement: null` | pre-Phase-09 |
| `is_ai_generated` / `is_concept` | **250 / 250** true on both | fixed |
| `owner_verification` | **250 / 250** `OWNER_VERIFICATION_REQUIRED` | fixed |
| Alt text approved by an editor | **0 of 250** — all values are `alt_text_draft` | pre-Phase-43 |
| Products attached | **0** — and the `product_media` trigger rejects `is_concept = true` outright | permanent |
| Collections attached | **0** — collection concepts are `DRAFT_COLLECTION_CONCEPT` (SEED §9) | pre-Phase-16 |
| 3D models · brand marks · product photographs | **0 of each** — none is in scope for AI generation | permanent |

**Read the two zero rows carefully.** *Migrated 0* and *bound 0* are the true state of the ledger
before Phase 07 and Phase 09 run. They are not a defect; they are the starting line, and the
generator will move them.

---

## 2. Column definitions *(hand-written)*

| FEAT §34 column | Source | Notes |
|---|---|---|
| **Asset ID** | `rivya_asset_id` | Authoritative identity (D6), but **not unique alone** — pair it with **Type** |
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

All 250 currently read `AVAILABLE_UNMIGRATED`.

---

## 3. Per-family summary *(generated)*

Counts are `counts.by_family` verbatim. Ratios list every aspect ratio the family actually
contains. "Max long edge" is the largest of `width`/`height` in the family and decides which
Cloudinary preset the family can fill (`hero` needs 1600 px, `hero-xl` needs 2560 px).

| Family | n | Img | Vid | Ratios present | Max long edge | Folder | Purpose |
|---|---|---|---|---|---|---|---|
| `material-macro` | 39 | 33 | 6 | 21:9, 16:9, 1:1, 4:5, 3:4, 9:16 | 6336 | `rivya/material` | `MATERIAL_STORY` |
| `wall-art` | 20 | 20 | 0 | 21:9, 16:9, 3:2, 4:5, 3:4 | 6336 | `rivya/collection/wall-art` | `CATEGORY_GALLERY` |
| `editorial` | 19 | 16 | 3 | 16:9, 3:2, 1:1, 4:5, 3:4, 9:16 | 5504 | `rivya/journal/editorial` | `EDITORIAL_COVER` |
| `process-studio` | 19 | 15 | 4 | 16:9, 4:3, 3:2, 4:5, 3:4 | 5504 | `rivya/process/studio` | `PROCESS_STORY` |
| `decor` | 18 | 17 | 1 | 16:9, 3:2, 4:5, 3:4, 9:16 | 5504 | `rivya/collection/decor` | `CATEGORY_GALLERY` |
| `preservation-varmala` | 15 | 15 | 0 | 16:9, 3:2, 4:5, 3:4 | 5056 | `rivya/collection/preservation` | `CATEGORY_GALLERY` |
| `process-pigment` | 13 | 11 | 2 | 16:9, 4:5, 3:4, 9:16 | 4608 | `rivya/process/pigment` | `PROCESS_STORY` |
| `three-d-resin` | 13 | 13 | 0 | 16:9, 4:5, 3:4 | 5504 | `rivya/collection/3d-resin` | `CATEGORY_GALLERY` |
| `process-mould` | 12 | 11 | 1 | 16:9, 4:5, 3:4 | 5504 | `rivya/process/mould` | `PROCESS_STORY` |
| `process-pour` | 12 | 8 | 4 | 16:9, 4:5, 9:16 | 5504 | `rivya/process/pour` | `PROCESS_STORY` |
| `gifts` | 10 | 10 | 0 | 16:9, 3:2, 4:5, 3:4 | 5056 | `rivya/collection/gifts` | `CATEGORY_GALLERY` |
| `process-cure` | 8 | 8 | 0 | 16:9, 4:5, 9:16 | 5504 | `rivya/process/cure` | `PROCESS_STORY` |
| `process-finish` | 8 | 8 | 0 | 16:9, 4:3, 4:5 | 4608 | `rivya/process/finish` | `PROCESS_STORY` |
| `process-timber` | 7 | 5 | 2 | 16:9, 3:2, 4:5 | 4608 | `rivya/process/timber` | `PROCESS_STORY` |
| `gallery-scene` | 5 | 4 | 1 | 21:9, 16:9, 4:5 | 3168 | `rivya/portfolio/gallery` | `EXHIBITION_ATMOSPHERE` |
| `interior-lifestyle` | 5 | 5 | 0 | 16:9, 3:2, 4:5 | 4608 | `rivya/interior` | `INTERIOR_CONTEXT` |
| `largeformat-dining` | 5 | 3 | 2 | 21:9, 16:9, 9:16 | 6336 | `rivya/large-format/dining` | `LARGE_FORMAT_SUBJECT` |
| `workshop-session` | 5 | 5 | 0 | 16:9 | 5504 | `rivya/journal/workshop` | `EDITORIAL_COVER` |
| `largeformat-console` | 4 | 4 | 0 | 16:9, 3:2 | 5504 | `rivya/large-format/console` | `LARGE_FORMAT_SUBJECT` |
| `largeformat-seating` | 4 | 4 | 0 | 4:5 | 4608 | `rivya/large-format/seating` | `LARGE_FORMAT_SUBJECT` |
| `preservation-keepsake` | 4 | 4 | 0 | 16:9, 1:1, 4:5 | 4608 | `rivya/collection/preservation` | `CATEGORY_GALLERY` |
| `largeformat-side` | 3 | 3 | 0 | 16:9, 4:5 | 4608 | `rivya/large-format/side` | `LARGE_FORMAT_SUBJECT` |
| `largeformat-coffee` | 1 | 1 | 0 | 3:2 | 2528 | `rivya/large-format/coffee` | `LARGE_FORMAT_SUBJECT` |
| `largeformat-monumental` | 1 | 1 | 0 | 21:9 | 6336 | `rivya/large-format/architectural` | `LARGE_FORMAT_SUBJECT` |
| **Total** | **250** | **224** | **26** | 8 ratios | 6336 | 23 folders | 7 purposes |

Distribution facts the generator also asserts:

| Cut | Values |
|---|---|
| By type | image 224 · video 26 |
| By aspect ratio | 16:9 121 · 4:5 50 · 3:4 21 · 3:2 16 · 9:16 16 · 1:1 13 · 21:9 9 · 4:3 4 |
| By page | `process` 79 · `about` 39 · `journal` 24 · `collection/wall-statement-art` 20 · `collection/preservation` 19 · `collection/decor` 18 · `large-format` 18 · `collection/3d-resin` 13 · `collection/gifts` 10 · `home` 5 · `portfolio` 5 |
| By model | `nano_banana_2` 114 · `seedream_v5_pro` 61 · `cinematic_studio_2_5` 34 · `recraft_v4_1` 15 · `seedance_2_5` 11 · `cinematic_studio_3_0` 11 · `seedance_2_0` 4 |
| Video durations | 5 s ×5 · 6 s ×15 · 8 s ×4 · 10 s ×2 |
| Video resolutions | 1920×1080 ×7 · 1344×768 ×8 · 1280×720 ×8 · 768×1344 ×3 |

---

## 4. Per-asset inventory *(generated — worked example)*

> The generator emits **all 250 rows**. Reproduced below are **14 real rows copied exactly from
> the manifest**, chosen to exercise every awkward case the generator has to handle:
> the three Phase 06 canaries, both members of two `rivya_asset_id` collision pairs, a shared
> `cloudinary_public_id` pair, all three prompt recipes, and both media types.
> Do not hand-add rows here. Run `npm run media:build-status`.

Each asset occupies two lines: **(a) identity and placement**, **(b) provenance and governance**.
The pair `(Asset ID, Type)` joins them.

### 4a. Identity and placement

| Asset ID | Type | Product | Collection | Page | Purpose | Used? | Cloudinary location | CMS placement |
|---|---|---|---|---|---|---|---|---|
| `PROCESS-STUDIO-001` | image | — | — | `process` | `PROCESS_STORY` | no | `rivya/process/studio/process-studio-001-4x3` | — |
| `LARGEFORMAT-DINING-001` | image | — | — | `large-format` | `LARGE_FORMAT_SUBJECT` | no | `rivya/large-format/dining/largeformat-dining-001-9x16` | — |
| `LARGEFORMAT-DINING-001` | video | — | — | `large-format` | `LARGE_FORMAT_SUBJECT` | no | `rivya/large-format/dining/largeformat-dining-001-9x16` | — |
| `LARGEFORMAT-DINING-002` | image | — | — | `large-format` | `LARGE_FORMAT_SUBJECT` | no | `rivya/large-format/dining/largeformat-dining-002-21x9` | — |
| `LARGEFORMAT-DINING-002` | video | — | — | `large-format` | `LARGE_FORMAT_SUBJECT` | no | `rivya/large-format/dining/largeformat-dining-002-16x9` | — |
| `LARGEFORMAT-MONUMENTAL-001` | image | — | — | `large-format` | `LARGE_FORMAT_SUBJECT` | no | `rivya/large-format/architectural/largeformat-monumental-001-21x9` | — |
| `MATERIAL-MACRO-009` | image | — | — | `about` | `MATERIAL_STORY` | no | `rivya/material/material-macro-009-21x9` | — |
| `MATERIAL-MACRO-016` | image | — | — | `about` | `MATERIAL_STORY` | no | `rivya/material/material-macro-016-1x1` | — |
| `WALL-ART-008` | image | — | — | `collection/wall-statement-art` | `CATEGORY_GALLERY` | no | `rivya/collection/wall-art/wall-art-008-21x9` | — |
| `THREE-D-RESIN-001` | image | — | — | `collection/3d-resin` | `CATEGORY_GALLERY` | no | `rivya/collection/3d-resin/three-d-resin-001-3x4` | — |
| `PRESERVATION-VARMALA-001` | image | — | — | `collection/preservation` | `CATEGORY_GALLERY` | no | `rivya/collection/preservation/preservation-varmala-001-4x5` | — |
| `GALLERY-SCENE-002` | image | — | — | `portfolio` | `EXHIBITION_ATMOSPHERE` | no | `rivya/portfolio/gallery/gallery-scene-002-21x9` | — |
| `INTERIOR-LIFESTYLE-002` | image | — | — | `home` | `INTERIOR_CONTEXT` | no | `rivya/interior/interior-lifestyle-002-3x2` | — |
| `PROCESS-PIGMENT-002` | video | — | — | `process` | `PROCESS_STORY` | no | `rivya/process/pigment/process-pigment-002-9x16` | — |

### 4b. Provenance and governance

Prompt is truncated to 120 characters; the full string lives in `media_assets.higgsfield_prompt`
and in the Studio asset drawer. **Source** is `higgsfield` and **Higgsfield?** is `yes` on all 250.

| Asset ID | Type | Ratio · px · dur | Model | Generation ID | Prompt (truncated) | Status |
|---|---|---|---|---|---|---|
| `PROCESS-STUDIO-001` | image | 4:3 · 4800×3584 | `nano_banana_2` | `6040ceaf-8ae7-4bad-8de6-b9657875831b` | `A studio tool wall photographed straight on: heat guns, notched spreaders, a digital scale, clamps and mixing st…` | `AVAILABLE_UNMIGRATED` |
| `LARGEFORMAT-DINING-001` | image | 9:16 · 1536×2752 | `cinematic_studio_2_5` | `d4874f69-3690-4327-a2be-9f93f964b472` | `Vertical editorial photograph for a mobile hero: a large live-edge resin dining table with deep ocean blue river…` | `AVAILABLE_UNMIGRATED` |
| `LARGEFORMAT-DINING-001` | video | 9:16 · 768×1344 · 6 s | `cinematic_studio_3_0` | `02a61cde-e714-45c6-b7e5-f00c86e6869a` | `Vertical cinematic: a large live-edge resin dining table with a deep ocean blue epoxy river through natural waln…` | `AVAILABLE_UNMIGRATED` |
| `LARGEFORMAT-DINING-002` | image | 21:9 · 6336×2688 | `cinematic_studio_2_5` | `3dad704e-d177-49af-8722-5ee9ca44e885` | `Ultra-wide architectural editorial photograph: a large live-edge resin dining table with a deep ocean blue epoxy…` | `AVAILABLE_UNMIGRATED` |
| `LARGEFORMAT-DINING-002` | video | 16:9 · 1344×768 · 8 s | `cinematic_studio_3_0` | `fac0659a-8201-4392-b74c-45498bc55945` | `Slow cinematic dolly toward a large live-edge resin dining table, deep ocean blue epoxy river meeting natural wa…` | `AVAILABLE_UNMIGRATED` |
| `LARGEFORMAT-MONUMENTAL-001` | image | 21:9 · 6336×2688 | `cinematic_studio_2_5` | `350adf43-96b6-4453-9d11-a0e09965b510` | `Ultra-wide architectural lobby, editorial photograph: a monumental freestanding resin and timber sculptural piec…` | `AVAILABLE_UNMIGRATED` |
| `MATERIAL-MACRO-009` | image | 21:9 · 6336×2688 | `cinematic_studio_2_5` | `119c8cea-b601-4cc6-bf78-f4751b30fb6a` | `Ultra-wide abstract macro: deep ocean blue resin in slow frozen flow, white mineral veils suspended mid-bloom, f…` | `AVAILABLE_UNMIGRATED` |
| `MATERIAL-MACRO-016` | image | 1:1 · 4096×4096 | `nano_banana_2` | `d03baefc-51f1-4c10-81d6-fc36271339d6` | `One of four material macros shot on an identical matte charcoal-neutral stone ground under identical light, same…` | `AVAILABLE_UNMIGRATED` |
| `WALL-ART-008` | image | 21:9 · 6336×2688 | `nano_banana_2` | `99598b9a-43c0-48f4-8289-4decf062ec50` | `A very wide, low resin panel, a single soft horizontal gradient running from deep-ocean blue at the top to a war…` | `AVAILABLE_UNMIGRATED` |
| `THREE-D-RESIN-001` | image | 3:4 · 3584×4800 | `nano_banana_2` | `5e95cfae-84c0-4fd9-b7db-b76c095f0156` | `One frame from a six-part collection series, all shot in a single session on the same seasoned dark teak tabletop…` | `AVAILABLE_UNMIGRATED` |
| `PRESERVATION-VARMALA-001` | image | 4:5 · 3712×4608 | `nano_banana_2` | `6306c12d-ec00-461d-b8f3-6e2e95d16ab9` | `A fresh marigold-and-rose wedding varmala coiled on a seasoned dark teak workbench, still bright, blotting paper…` | `AVAILABLE_UNMIGRATED` |
| `GALLERY-SCENE-002` | image | 21:9 · 3168×1344 | `cinematic_studio_2_5` | `f9c6343b-0a3b-42be-bd2a-6190476027fb` | `Wide shot of a dark midnight-blue gallery room with handcrafted resin objects displayed on stone plinths of vary…` | `AVAILABLE_UNMIGRATED` |
| `INTERIOR-LIFESTYLE-002` | image | 3:2 · 2528×1696 | `cinematic_studio_2_5` | `fad87622-b632-4b62-b29a-3624823f2e23` | `Editorial interior photograph, Japandi style: a resin and oak dining table with a clear smoky epoxy seam, low wa…` | `AVAILABLE_UNMIGRATED` |
| `PROCESS-PIGMENT-002` | video | 9:16 · 768×1344 · 6 s | `cinematic_studio_3_0` | `af5ff1de-2f11-4f87-a133-9e4f60165e3f` | `Vertical macro for mobile: deep ocean blue resin flowing with white pigment veils blooming upward, upper third c…` | `AVAILABLE_UNMIGRATED` |

### 4c. What the worked example proves

| Case | Rows that exercise it |
|---|---|
| Phase 06 canaries — three named assets migrated by hand before the bulk run | `PROCESS-STUDIO-001` (image), `LARGEFORMAT-DINING-001` (video), `LARGEFORMAT-MONUMENTAL-001` (image) |
| `rivya_asset_id` shared by an image and a video | `LARGEFORMAT-DINING-001`, `LARGEFORMAT-DINING-002` — four rows, two IDs |
| Same ID, **different** ratio and public ID | `LARGEFORMAT-DINING-002` image is 21:9; the video is 16:9 |
| Same ID, **same** ratio and public ID, kept apart by `resource_type` | `LARGEFORMAT-DINING-001` — both are `…/largeformat-dining-001-9x16`, one `image`, one `video` |
| Recipe A (palette-limited workshop grammar) | `PROCESS-STUDIO-001`, `MATERIAL-MACRO-016`, `WALL-ART-008`, `THREE-D-RESIN-001`, `PRESERVATION-VARMALA-001` |
| Recipe B (quiet-luxury interior grammar) | `LARGEFORMAT-DINING-001/002` images, `LARGEFORMAT-MONUMENTAL-001`, `MATERIAL-MACRO-009`, `INTERIOR-LIFESTYLE-002` |
| Recipe D/E (video and atelier prose) | `LARGEFORMAT-DINING-001/002` videos, `PROCESS-PIGMENT-002`, `GALLERY-SCENE-002` |
| Highest-resolution masters in the library | the five 6336 × 2688 21:9 rows |
| Lowest-resolution video | `LARGEFORMAT-DINING-001` at 768 × 1344 |

---

## 5. Coverage *(generated by `scripts/media/build-coverage-report.ts`, Phase 43)*

Until Phase 43 runs there are no declared slots to join against, so this section carries the
**projected** coverage derived from the manifest alone. The full slot-by-slot decision, with one
of the four dispositions per slot, is in `HIGGSFIELD_MASTER_ASSET_PLAN.md` §4–§6.

| Public surface | Manifest coverage today | Projected disposition |
|---|---|---|
| `/` hero video | 0 videos carry `page = home`; the 7 videos at 1920×1080 are process, macro or gallery subjects | `GENERATE_NEW` — `HOME-HERO-VIDEO-001` |
| `/` hero poster, desktop | `LARGEFORMAT-DINING-002` (21:9, 6336×2688) fits as an interim still | `GENERATE_NEW` — must match the video frame — `HOME-HERO-POSTER-001` |
| `/` hero poster, mobile | `LARGEFORMAT-DINING-001` (9:16, 1536×2752), prompted "for a mobile hero" | `REUSE_FROM_FAMILY` |
| `/collection` landing hero | no asset carries `page = collection`; four 21:9 `material-macro` masters at 6336 px fit | `REUSE_FROM_FAMILY` |
| `/collection/furniture` | no `furniture` family; 18 `largeformat-*` assets are the category's own subject | `REUSE_FROM_FAMILY` |
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
| DQ-1 | Draft alt text is truncated prompt output | **124 of 250** `alt_text_draft` values end in `…` | Unusable as published alt text; a screen reader hears a sentence stop mid-clause | Phase 43 alt-text queue rewrites all 250; `scripts/media/check-alt-text.mjs` rejects a trailing ellipsis |
| DQ-2 | Draft alt text is too long | **148 of 250** exceed 160 characters; longest is 180; mean 139 | Alt text is read aloud in full; 180 characters is a paragraph, not a label | Rewrite to one sentence describing what is visible (SEED §43) |
| DQ-3 | Draft alt text opens with camera vocabulary | **55 of 250** begin with `Vertical`, `Ultra-wide`, `Wide shot`, `Extreme macro`, `Macro`, `Square`, `Close`, `Abstract`, `Editorial`, `Photorealistic`, `Slow`, `Cinematic` or `One frame` | Describes the photograph, not the object. A blind visitor learns the lens, not the table | Rewrite; the linter rejects the opening vocabulary |
| DQ-4 | Draft alt text contains hex colour codes | e.g. `PROCESS-POUR-007` — `…deep midnight-blue backdrop (#0A1A2F) flowing into royal blue depths (#1E4FD8),…` | Hex codes read aloud as letter salad | Rewrite; the linter rejects `#RRGGBB` |
| DQ-5 | Some draft alt text describes the *series*, not the *frame* | `THREE-D-RESIN-001` reads "A six-part collection series, all shot in a single session on the same seasoned dark teak tabletop…"; `MATERIAL-MACRO-016` reads "Material macros shot on an identical matte charcoal-neutral stone ground…" | The alt text describes a production method, not an image | Rewrite from the `Frame:` clause of the prompt, which is the part that describes the picture |
| DQ-6 | `editorial` is a catch-all family | **14 of 19** `editorial` assets have an empty `subject_tags` array — the only 14 empty arrays in the manifest | Family filters in the tracker under-return; these assets are hard to find by subject | Add `subject_tags` in the v2 builder pass. Do **not** rename the family — the ID would change |
| DQ-7 | Two `largeformat-*` assets are subject-mismatched | `LARGEFORMAT-SIDE-003` is a desk with 3D-printed organisers (a `three-d-resin` subject); `LARGEFORMAT-CONSOLE-004` is a resin wall panel above a console (a `wall-art` subject) | Placed by family they would land on the wrong page | Place by subject; record the correction in `subject_tags`, never by renaming the asset |
| DQ-8 | Eight `largeformat-*` assets show unfinished blanks | `LARGEFORMAT-SEATING-001…004`, `-SIDE-001`, `-002`, `-CONSOLE-001`, `-002` — each prompt says "no finished piece in frame" or equivalent | If placed in a finished-object card they read as a half-built product | Restrict them to making, material and commission contexts. Recorded in the plan §1.1a |
| DQ-9 | Near-duplicate prompts inside families | `MATERIAL-MACRO-016`/`-010`, `-017`/`-021`, `-018`/`-019`, `-020`/`-022`, `THREE-D-RESIN-002`/`-003`, `LARGEFORMAT-CONSOLE-001`/`-002` and others share a prompt verbatim | Two near-identical images in one grid look like a mistake | Bind one of each pair; keep the other as a swap candidate. Never both in the same section |
| DQ-10 | Five prompt recipes coexist | Recipe A 114 · C 55+6 · E 9 · B 20 · loose atelier prose 20 · video 26 | The library has three different colour temperaments; mixing them inside one section is visible | Bind within one recipe per section. `HIGGSFIELD_GUIDE.md` §2 records which family uses which |
| DQ-11 | Source files are PNG, target filenames say `.webp` | 224 `source_url` values end `.png`; 224 `filename` values end `.webp` | The filename is a *delivery* name, not a source name | Upload the PNG master; Cloudinary derives WebP/AVIF via `f_auto`. See `CLOUDINARY.md` §10 |
| DQ-12 | One prompt carries an operator instruction | `MATERIAL-MACRO-029` ends "…add mirror in the center place so that look nice" | Harmless to the asset; noise in the tracker and in any prompt-similarity search | Leave the prompt untouched — it is generation provenance. Never rewrite history in the manifest |

---

## 7. Migration ledger *(generated after Phase 07 runs)*

Populated from `higgsfield_migration_runs` and `data/higgsfield/migration-log.json`.
The log is keyed by `higgsfield_generation_id`, which is unique across all 250 rows —
`rivya_asset_id` is not, and must never be used as a migration key.

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
