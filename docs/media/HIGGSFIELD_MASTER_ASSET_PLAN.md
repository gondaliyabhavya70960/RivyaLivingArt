# HIGGSFIELD MASTER ASSET PLAN

> **Standing.** Hand-written. Owned by Phase 07, re-decided by Phase 43.
> Binding contract: `docs/architecture/CANONICAL-DECISIONS.md` §D6.
> Source of fact: `data/higgsfield/asset-manifest.json` (`manifest_version: rivya-hf-v1`).
> Companion ledger (machine-generated): `docs/media/HIGGSFIELD_ASSET_STATUS.md`.
>
> This document does three things and nothing else:
> 1. states the **asset-priority hierarchy** and the decision gate that applies it;
> 2. states the **naming and addressing standard**;
> 3. maps **every CMS media slot** to an existing manifest asset, a re-crop, an honest
>    empty state, or — only where all four gate answers are "no" — a **generation brief**.
>
> It never calls Higgsfield. It writes briefs. Generation happens in Phase 43, and only
> after `npm run media:assert-no-regen` passes.

---

## 1. What already exists

250 assets are already generated and catalogued. They are the library. Nothing here may be
regenerated (D6; manifest `policy.rules[4]`; FEAT §33).

| Fact | Value |
|---|---|
| Total | **250** — 224 images, 26 videos |
| Families | **24** |
| Cloudinary folders | **23**, all under `rivya/` |
| Aspect ratios present | 16:9 (121) · 4:5 (50) · 3:4 (21) · 3:2 (16) · 9:16 (16) · 1:1 (13) · 21:9 (9) · 4:3 (4) |
| Generation models | `nano_banana_2` (114) · `seedream_v5_pro` (61) · `cinematic_studio_2_5` (34) · `recraft_v4_1` (15) · `seedance_2_5` (11) · `cinematic_studio_3_0` (11) · `seedance_2_0` (4) |
| Migration status | all 250 `AVAILABLE_UNMIGRATED`; origin is the Higgsfield CDN, not Cloudinary |
| Owner verification | all 250 `OWNER_VERIFICATION_REQUIRED` |
| Governance flags | all 250 `is_ai_generated = true`, `is_concept = true` |
| 3D models · product photography · brand marks · portfolio project media | **0 of each** |

Family counts, verbatim from `counts.by_family`:

| Family | n | Family | n | Family | n |
|---|---|---|---|---|---|
| `material-macro` | 39 | `process-mould` | 12 | `preservation-keepsake` | 4 |
| `wall-art` | 20 | `gifts` | 10 | `largeformat-seating` | 4 |
| `editorial` | 19 | `process-cure` | 8 | `largeformat-side` | 3 |
| `process-studio` | 19 | `process-finish` | 8 | `largeformat-coffee` | 1 |
| `decor` | 18 | `process-timber` | 7 | `largeformat-monumental` | 1 |
| `preservation-varmala` | 15 | `gallery-scene` | 5 | | |
| `process-pigment` | 13 | `interior-lifestyle` | 5 | | |
| `three-d-resin` | 13 | `largeformat-dining` | 5 | | |
| `process-pour` | 12 | `workshop-session` | 5 | | |
| | | `largeformat-console` | 4 | | |

Page counts, verbatim from `counts.by_page`: `process` 79 · `about` 39 · `journal` 24 ·
`collection/wall-statement-art` 20 · `collection/preservation` 19 · `collection/decor` 18 ·
`large-format` 18 · `collection/3d-resin` 13 · `collection/gifts` 10 · `home` 5 · `portfolio` 5.

> **`page` is generation intent, not a binding.** The manifest's `page` field records the brief the
> asset was generated under. It does **not** restrict where the asset may be placed. Seven of the
> nine 21:9 assets sit under `about` (4), `collection/wall-statement-art` (2) and `portfolio` (1) —
> and several of them are the correct answer for a hero on a different route entirely. Coverage below is decided by subject
> and ratio, never by the `page` string.

### 1.1 Two library facts that change where assets can be placed

Both are read from the prompts, not assumed.

**a. Eight of the eighteen `largeformat-*` assets show an unfinished blank, not a finished piece.**
`LARGEFORMAT-SEATING-001…004`, `LARGEFORMAT-SIDE-001`, `-002`, `LARGEFORMAT-CONSOLE-001` and
`-002` all carry an explicit exclusion in their prompt — "no legs or frame attached, no finished
chair anywhere in shot", "no finished piece in frame", "no finished legs, no interior". They are
**process** photographs wearing a furniture family name. They belong in making, material and
commission contexts. They must not be placed in a slot that reads as a finished object
(homepage Signature Collections cards, Selected Works, any product-adjacent surface).

**b. Two `largeformat-*` assets are subject-mismatched to their family.**
`LARGEFORMAT-SIDE-003` is a desk with 3D-printed organisers (a `three-d-resin` subject) and
`LARGEFORMAT-CONSOLE-004` is a resin wall panel above a console (a `wall-art` subject). Place by
subject; the family string is a generation label, not a placement instruction. Recorded as a
data-quality note in `HIGGSFIELD_ASSET_STATUS.md` §6.

---

## 2. Asset-priority hierarchy (D6 · FEAT §33)

```
1. Verified real Rivya product media          ← owner-supplied; always wins
2. Existing approved user-provided asset      ← owner-supplied
3. Existing approved Higgsfield asset         ← THE 250 IN THE MANIFEST
4. Existing suitable Rivya project/render     ← none exist today
5. Generate new Higgsfield asset              ← only after the gate below
6. Temporary technical fallback               ← SEED §47 surface, never a picture
```

### 2.1 The decision gate

Four questions, asked in this order, **answered in writing per slot** in the coverage tables
below. Only four "no" answers permit a generation brief.

| # | Question | If yes → |
|---|---|---|
| Q1 | Is there real Rivya media for this slot? | bind it; `source = 'REAL'` |
| Q2 | Is there an approved owner-supplied asset? | bind it; `source = 'USER_UPLOAD'` |
| Q3 | Is there a manifest asset whose **subject and ratio** fit? | `REUSE_FROM_FAMILY` |
| Q4 | Can a manifest asset be re-cropped to the ratio **without destroying its subject**? | `RECROP_EXISTING` |
| — | All four "no" | `GENERATE_NEW` — write a brief in §6 |
| — | The honest answer is nothing at all | `LEAVE_EMPTY` — bind the seeded empty state (D10) |

Q4 has two failure modes and both must be checked:

- **Resolution fit** — the asset, after any crop, must still meet the target width of the preset
  the slot actually delivers through. The measure is the source's **width**, which is what
  `CLOUDINARY.md` §5.2 and `HIGGSFIELD_ASSET_STATUS.md` §5.1 count.
- **Subject survival** — a crop that removes the thing the picture is about is not a crop.
  An ultra-wide monumental lobby cropped to 4:5 keeps pixels and loses the subject.

**Target width by slot role**, so no row in §4 has to argue the point:

| Slot role | Preset | Target width | Note |
|---|---|---|---|
| Full-bleed page hero — desktop 21:9 | `hero-xl` | **2560 px** | 6336 px is the library's own master width for this role |
| Full-bleed page hero — mobile 9:16 | `hero` | **1440 px** (min 1440 × 2560) | A 9:16 slot renders at viewport width and the `srcSet` ladder never asks it for more than its 1536 step. This is the figure brief G6 already carries; a 9:16 asset is never delivered through a landscape `hero-xl` chain |
| Section hero, band, category hero — desktop and mobile | `hero` | **1600 px** | |
| Gallery grid | `grid` | **768 px** | |
| Card — product, collection, category, journal | `card` | **480 px** | |
| Video hero — desktop 16:9 | — | **1920 × 1080** | |

Fourteen of the 224 images are below 1600 px wide and seven are below 1600 px on their long edge
(`CLOUDINARY.md` §5.2). The seven are the five 896 × 1152 assets `DECOR-009`, `-010`,
`MATERIAL-MACRO-024`, `-025`, `PRESERVATION-VARMALA-009`, plus `PROCESS-STUDIO-009`
(1216 × 896) and `PRESERVATION-VARMALA-008` (1280 × 832). **They are `card`- and `grid`-eligible
only.** Where §4 binds one, the row names the ceiling preset in the verdict; none of them is bound
to a hero, a category hero or a band.

### 2.2 Four things that are never generated, in any phase

| Never generated | Why | Disposition |
|---|---|---|
| Brand marks — logo, wordmark, favicon, default OG card | An organisation's identity is a fact about the business, not concept media, and an AI mark carries unresolved provenance | `OWNER_VERIFICATION_REQUIRED`; interim is the typographic wordmark built from design tokens, no image |
| Product photography | A picture of a product Rivya has not made is a fabricated product (D10). The `product_media` trigger blocks concept attachment outright | Owner-supplied only |
| 3D models (`GLB`/`GLTF`) | A model has dimensions, a form and an implied specification. That is a product claim | `LEAVE_EMPTY`; the `3d_viewer` flag stays off until the owner supplies a GLB of a real object |
| Portfolio project media | A project image asserts a delivered project (D10, SEED §28) | `LEAVE_EMPTY`; the seeded empty state stands |

---

## 3. Naming and addressing standard

### 3.1 Rivya asset ID — the authoritative identity

**Two allocators mint into one namespace, and they must never collide (D6, amendment A1).**

| Allocator | Form | Mints | Example |
|---|---|---|---|
| `scripts/media/build-higgsfield-manifest.py` | `<FAMILY-UPPERCASE>-<NNN>` | assets that **exist** | `MATERIAL-MACRO-016`, `LARGEFORMAT-DINING-005` |
| This document, §6 | `<PAGE>-<SECTION>[-<KIND>]-<NNN>` | assets that are **planned** | `HOME-HERO-VIDEO-001`, `LARGE-COFFEE-CARD-001` |

The ordinal is zero-padded to three digits, counted **across image and video together**, and is
**never reused** — not after an archive, not after a failed migration.

**A planned ID may never borrow a manifest family prefix.** `LARGEFORMAT-DINING-004` looks like a
free slot today only if you count images; the family allocator mints it the moment the family
grows, and in this repository it already had. Planned IDs therefore use the SEED §50
page-section form, which the family allocator cannot produce.

```
scripts/media/check-asset-ids.py     # exit 1 on any gap ID reusing a family prefix.
                                     # CI, and before any media migration.
```

The rule reaches further than the ID string. **A planned asset also carries a planned `family`.**
If a brief for a portrait dining-table card declared `family: largeformat-dining`, the manifest
generator would mint it the next free ordinal in that family on the next build, and the two
allocators would be back in the same namespace. A planned asset's family is therefore its own ID
prefix in lower case (`large-dining-card`), and it keeps that family after generation. The
**Cloudinary folder** is unaffected — a folder is a delivery taxonomy, not an ID namespace, so a
planned large-format card still lands in `rivya/large-format/dining` beside its siblings.

Note that `check-asset-ids.py` scans prose as well as tables and cannot tell a cautionary example
from a real plan. Do not spell out a colliding ID anywhere in `docs/`, even to explain why it is
wrong — describe it instead.

### 3.2 Identity, uniqueness and keys

| Key | Uniqueness | Used for |
|---|---|---|
| `rivya_asset_id` | **unique across all 250** | CMS bindings, the ledger, every human reference. D6: authoritative |
| `filename` | unique across all 250 | The readable key in a table or a `git` diff |
| `cloudinary_public_id` | unique across all 250 | Delivery |
| `higgsfield_generation_id` | unique across all 250 | **The migration key** — stable across a manifest rebuild, which an ordinal is not |

> **This was not always true.** The first manifest build numbered images and videos with separate
> counters, so 26 videos were minted the same ID as a still in their family — 224 IDs for 250
> assets, and six `cloudinary_public_id` values shared by an image/video pair. The generator now
> shares one counter and asserts uniqueness before writing. The 26 videos were renumbered; **no
> image ID changed**, and every `higgsfield_generation_id` is untouched, which is precisely why
> the generation id and not the asset id is the migration key.

The database index stays `unique (provider, resource_type, public_id)` rather than
`unique (public_id)`. That is defence in depth, not a workaround: Cloudinary genuinely namespaces
public IDs by resource type, and the index should describe Cloudinary's model rather than a
property of one particular manifest build.

### 3.3 Filename — the human key, not the identity

**One grammar covers both allocators**: the asset ID, lower-cased, then the ratio with `x` for
the colon. The filename is therefore always derivable from the ID and never has to be looked up.

```
<rivya_asset_id lower-cased>-<ratio-with-x>.<ext>

MATERIAL-MACRO-009        →  material-macro-009-21x9.webp
LARGEFORMAT-DINING-004    →  largeformat-dining-004-9x16.mp4
LARGE-DINING-CARD-001     →  large-dining-card-001-4x5.webp     (planned, §6 G3)
HOME-HERO-VIDEO-001       →  home-hero-video-001-16x9.mp4       (planned, §6 G1)
```

All 250 existing filenames are produced by this rule and every §6 brief follows it. All 250 are
unique. `CLOUDINARY.md` §3 states the same rule. `filename` is the useful human key in a table or
a `git` diff; `rivya_asset_id` is what CMS bindings and the ledger refer to. D6: *"the Rivya asset
ID is authoritative, not the filename."*

> **This diverges from D6's literal wording, and the divergence is recorded rather than silent.**
> D6 fixes the filename form as `<page>-<section>-<variant>.<ext>`, and FEAT §35's examples are
> `home-hero-main-video.mp4`, `home-hero-main-poster.webp`, `furniture-signature-hero.webp`.
> Neither describes the 250 filenames that already exist; neither carries the ordinal or the
> ratio; and applying either would mean renaming assets D6 forbids regenerating or renumbering.
> The grammar above is what the library, the manifest generator and `CLOUDINARY.md` §3 all
> actually use.
>
> **Required action, and it is not this document's to take:** append a dated amendment to
> `CANONICAL-DECISIONS.md` §D6 recording `<rivya_asset_id lower-cased>-<ratio-with-x>.<ext>` as the
> filename grammar and stating that it supersedes `<page>-<section>-<variant>.<ext>`. Until that
> amendment lands, D6 wins on paper and this section is the open item; §8 carries it as a change-
> control row.

Reserved forms for **owner-supplied** media in later phases, where no manifest asset ID exists and
FEAT §35's page-section shape is the right one:

```
product-<slug>-hero.webp · product-<slug>-detail-<nn>.webp · product-<slug>-lifestyle-<nn>.webp
product-<slug>-video-<nn>.mp4 · product-<slug>-model.glb
portfolio-<slug>-hero.webp · journal-<slug>-cover.webp
```

### 3.4 Cloudinary public ID

```
<cloudinary_folder>/<filename without extension>
```

Never hand-typed. Never edited after upload — a Cloudinary public ID is immutable in practice;
a replacement is a new public ID and a new row (see `CLOUDINARY.md` §8).

### 3.5 Ratio discipline

Eight ratios exist and no ninth is permitted (D6): `21:9 · 16:9 · 4:3 · 3:2 · 1:1 · 4:5 · 3:4 · 9:16`.
`lib/media/transform.ts::ratioCrop()` throws on anything else.

**Desktop and mobile are separate CMS slots.** A slot declares role `DESKTOP` and role `MOBILE`
in `media_usages`; an editor may bind the same asset to both where a card is the same shape at
every breakpoint, but the slot pair always exists and `MediaSlot` always chooses with
`<picture>`/`source`, never with JavaScript.

Ratio by surface, as used throughout §4 and §5:

| Surface | Desktop | Mobile |
|---|---|---|
| Full-bleed page hero | 21:9 | 9:16 |
| Section hero / band | 16:9 | 4:5 |
| Category / collection hero | 16:9 | 4:5 |
| Card (product, collection, category, journal) | 4:5 | 4:5 |
| Material tile set | 1:1 | 1:1 |
| Editorial inline | 3:2 | 3:4 |
| Social card (`og`) | 16:9 source → `w_1200,h_630` | same |

---

## 4. Coverage map — public pages

Legend for **Verdict**: `COVERED` = a manifest asset fits as-is · `RECROP` = fits after a
`media_crops` box · `GAP` = a §6 brief · `EMPTY` = an honest empty state · `OWNER` = owner-supplied.

Slot keys are `media_usages.slot_key` values, scoped to the `page_sections` row; roles are
`DESKTOP` / `MOBILE` / `POSTER` / `OG` unless stated.

### 4.1 `/` — Homepage (SEED §10, sections 01–13)

| Section | Slot | Desktop (ratio · asset) | Mobile (ratio · asset) | Verdict |
|---|---|---|---|---|
| 01 Hero | `video` | 16:9 · **GAP → `HOME-HERO-VIDEO-001`** | none — `HeroMotion` does not mount below 768 px | `GAP` |
| 01 Hero | `media` (poster) | 21:9 · **GAP → `HOME-HERO-POSTER-001`**; interim `LARGEFORMAT-DINING-002` (image, 6336×2688) | 9:16 · `LARGEFORMAT-DINING-001` (image, 1536×2752) | `GAP` desktop · `COVERED` mobile (9:16 mobile-hero preset, min 1440 × 2560 — §2.1; its 1536 px width is one of the 14 below `hero`'s 1600 px, so it is never delivered through a landscape `hero`/`hero-xl` chain) |
| 02 Manifesto | `media` | 16:9 · `MATERIAL-MACRO-012` (5504×3072) | 4:5 · `MATERIAL-MACRO-013` (3712×4608) | `COVERED` |
| 03 Signature Collections · Tables | `card.1` | 4:5 · **GAP → `LARGE-DINING-CARD-001`** | same | `GAP` |
| 03 · Sculptural Furniture | `card.2` | 4:5 · **GAP → `LARGE-SEATING-CARD-001`** | same | `GAP` (§6 G11). `LARGEFORMAT-SEATING-001` is 4:5 and the right subject family, but it is a workshop blank (§1.1a) and may not stand in a finished-object card. No interim — the slot renders its empty state |
| 03 · 3D + Resin | `card.3` | 4:5 · `THREE-D-RESIN-005` (1856×2304) | same | `COVERED` |
| 03 · Statement Art | `card.4` | 4:5 · `WALL-ART-001` (3712×4608) | same | `COVERED` |
| 03 · Architectural Pieces | `card.5` | 4:5 · **GAP → `LARGE-ARCHITECTURAL-CARD-001`**, held | same | `GAP` (held — §6 G5) |
| 04 Selected Works | — | no media slot — renders published products or the editorial fallback | — | `EMPTY` by design (SEED §10) |
| 05 Material Story | `video` | 16:9 · `MATERIAL-MACRO-036` (video, 1344×768, 10 s) | 9:16 · `PROCESS-PIGMENT-013` (video, 768×1344, 6 s) | `COVERED` |
| 05 Material Story | `media` (poster) | 21:9 · `MATERIAL-MACRO-011` (6336×2688) | 9:16 · `MATERIAL-MACRO-003` (image, 3072×5504) | `COVERED` |
| 06 Material Palette · Resin | `card.1` | 1:1 · `MATERIAL-MACRO-018` (4096×4096) | same | `COVERED` |
| 06 · Wood | `card.2` | 1:1 · `MATERIAL-MACRO-020` (4096×4096) | same | `COVERED` |
| 06 · Fabricated Form | `card.3` | 1:1 · recrop `THREE-D-RESIN-002` 16:9→1:1 (→3072×3072) | same | `RECROP` (optional brief G7) |
| 06 · Finish | `card.4` | 1:1 · recrop `PROCESS-FINISH-001` 4:5→1:1 (→3712×3712) | same | `RECROP` (optional brief G8) |
| 07 Custom Commission | `media` | 16:9 · recrop `INTERIOR-LIFESTYLE-002` 3:2→16:9 (→2528×1422) | 4:5 · `INTERIOR-LIFESTYLE-003` (1856×2304) | `RECROP` |
| 08 3D + Resin | `media` | 16:9 · `THREE-D-RESIN-002` (5504×3072) | 3:4 · `THREE-D-RESIN-001` (3584×4800) | `COVERED` |
| 09 Portfolio | `media` | 21:9 · `GALLERY-SCENE-002` (3168×1344) | 4:5 · `GALLERY-SCENE-001` (1856×2304) | `COVERED` |
| 10 Process · 01 Understand | `card.1` | 4:5 · `PROCESS-MOULD-003` (3712×4608) | same | `COVERED` |
| 10 · 02 Develop | `card.2` | 4:5 · `PROCESS-PIGMENT-001` (3712×4608) | same | `COVERED` |
| 10 · 03 Make | `card.3` | 4:5 · `PROCESS-POUR-005` (3712×4608) | same | `COVERED` |
| 10 · 04 Finish | `card.4` | 4:5 · `PROCESS-FINISH-002` (3712×4608) | same | `COVERED` |
| 10 · 05 Deliver | `card.5` | 4:5 · `PROCESS-CURE-004` (3712×4608) | same | `COVERED` |
| 11 Secondary Objects · Preservation | `card.1` | 4:5 · `PRESERVATION-VARMALA-001` (3712×4608) | same | `COVERED` |
| 11 · Décor | `card.2` | 4:5 · `DECOR-009` (896×1152) | same | `COVERED` (card preset only; not hero-eligible) |
| 11 · Personalised Pieces | `card.3` | 4:5 · `GIFTS-003` (3712×4608) | same | `COVERED` |
| 11 · Gifts | `card.4` | 4:5 · recrop `GIFTS-004` 16:9→4:5 (→922×1152) | same | `RECROP` |
| 12 Journal | `media` | 16:9 · `EDITORIAL-008` (5504×3072) | 3:4 · `EDITORIAL-007` (3584×4800) | `COVERED` |
| 13 Final CTA | `media` | 21:9 · `MATERIAL-MACRO-015` (6336×2688) | 9:16 · `MATERIAL-MACRO-004` (3072×5504) | `COVERED` |
| page | `og` | 16:9 · `MATERIAL-MACRO-012` via `og` preset | — | `COVERED` (interim; final branded card is `OWNER`) |

### 4.2 `/about` (SEED §11)

| Section | Slot | Desktop | Mobile | Verdict |
|---|---|---|---|---|
| Hero | `media` | 21:9 · `MATERIAL-MACRO-009` (6336×2688) | 9:16 · `MATERIAL-MACRO-002` (3072×5504) | `COVERED` |
| Philosophy | `media` | 16:9 · `MATERIAL-MACRO-014` (5504×3072) | 4:5 · `MATERIAL-MACRO-023` (3712×4608) | `COVERED` |
| Scale | `media` | 21:9 · `LARGEFORMAT-MONUMENTAL-001` (6336×2688) | 4:5 · `LARGEFORMAT-SEATING-002` (3712×4608) | `COVERED`. The mobile asset is a §1.1a workshop blank and is bound **deliberately**: this band is a making-and-material context on an About page, not a finished-object card, which is the one placement §1.1a permits |
| Bespoke | `media` | 16:9 · `PROCESS-STUDIO-005` (5504×3072) | 4:5 · `PROCESS-STUDIO-006` (3712×4608) | `COVERED` |
| Closing | `video` | 16:9 · `MATERIAL-MACRO-038` (video, 1344×768, 8 s) | — | `COVERED` |
| Closing | `media` (poster) | 16:9 · `MATERIAL-MACRO-026` (2752×1536) | 4:5 · `MATERIAL-MACRO-013` (3712×4608) | `COVERED` |

`about` is the best-supplied page in the library: 39 `material-macro` assets across six ratios,
including three 21:9 at 6336 px (`MATERIAL-MACRO-009`, `-011`, `-015`), a fourth 21:9 at 3168 px
(`MATERIAL-MACRO-027`), and four 9:16 at 3072 px.

### 4.3 `/large-format` (SEED §12)

| Section | Slot | Desktop | Mobile | Verdict |
|---|---|---|---|---|
| Hero | `video` | 16:9 · `LARGEFORMAT-DINING-005` (video, 1344×768, 8 s) | — | `COVERED` |
| Hero | `media` (poster) | 21:9 · `LARGEFORMAT-MONUMENTAL-001` (6336×2688) | 9:16 · `LARGEFORMAT-DINING-001` (image, 1536×2752) | `COVERED` (mobile clears the 9:16 mobile-hero minimum 1440 × 2560 — §2.1; at 1536 px wide it is below `hero`'s 1600 px and is never delivered through a landscape chain) |
| Category intro | `media` | 16:9 · `LARGEFORMAT-DINING-003` (2048×1152) | 3:2 · `LARGEFORMAT-CONSOLE-003` (2528×1696) | `COVERED` |
| Dining & Statement Tables | `card.1` | 4:5 · **GAP → `LARGE-DINING-CARD-001`** | same | `GAP` (§6 G3) |
| Coffee & Centre Tables | `card.2` | 4:5 · **GAP → `LARGE-COFFEE-CARD-001`** | same | `GAP` (§6 G4) |
| Consoles & Side Pieces | `card.3` | 4:5 · **GAP → `LARGE-CONSOLE-CARD-001`** | same | `GAP` (§6 G12). Every 4:5 asset in `largeformat-side` and `largeformat-console` is a workshop blank (§1.1a). No interim — the slot renders its empty state |
| Conference & Commercial Tables | `card.4` | — | — | `EMPTY` — copy is `OWNER_VERIFICATION_REQUIRED` (SEED §12); no image may assert an unverified capability |
| Sculptural Seating | `card.5` | 4:5 · **GAP → `LARGE-SEATING-CARD-001`** | same | `GAP` (§6 G11) — the same brief as the homepage `card.2`. All four `largeformat-seating` assets are workshop blanks (§1.1a). No interim |
| Architectural & Statement | `card.6` | 4:5 · **GAP → `LARGE-ARCHITECTURAL-CARD-001`**, held | same | `GAP`, held (§6 G5) |
| Customization | `media` | 16:9 · `PROCESS-MOULD-002` (5504×3072) | 4:5 · `PROCESS-MOULD-004` (3712×4608) | `COVERED` |
| CTA | `media` | 21:9 · `MATERIAL-MACRO-027` (3168×1344) | 4:5 · `MATERIAL-MACRO-023` (3712×4608) | `COVERED`. `MATERIAL-MACRO-024` reads as the obvious mobile match but is 896 × 1152 — `card`/`grid` ceiling, below the band's `hero` 1600 px (§2.1) |

### 4.4 `/collection` — landing (SEED §13)

| Section | Slot | Desktop | Mobile | Verdict |
|---|---|---|---|---|
| Hero | `media` | 21:9 · `MATERIAL-MACRO-011` (6336×2688) | 9:16 · `MATERIAL-MACRO-005` (3072×5504) | `COVERED` |
| Card · Furniture | `card.1` | 4:5 · **GAP → `FURNITURE-HERO-002`** | same | `GAP` (§6 G10). `LARGEFORMAT-SEATING-004` is 4:5 but is a workshop blank (§1.1a); G10's 4:5 variant is the category's own finished-furniture portrait and serves this card and the `/collection/furniture` mobile hero. No interim |
| Card · Collectible Design | `card.2` | 4:5 · `GALLERY-SCENE-001` (1856×2304) | same | `COVERED` |
| Card · 3D + Resin | `card.3` | 3:4 · `THREE-D-RESIN-001` (3584×4800) | same | `COVERED` |
| Card · Wall & Statement Art | `card.4` | 4:5 · `WALL-ART-011` (3712×4608) | same | `COVERED` |
| Card · Preservation | `card.5` | 4:5 · `PRESERVATION-VARMALA-003` (3712×4608) | same | `COVERED` |
| Card · Décor | `card.6` | 3:4 · `DECOR-005` (3584×4800) | same | `COVERED` |
| Card · Gifts | `card.7` | 3:4 · `GIFTS-001` (3584×4800) | same | `COVERED` |

> Phase 07's projected gap list named `/collection` as uncovered because no asset carries
> `page = collection`. Re-decided here on subject and ratio: an ultra-wide material band is a
> correct collection-landing hero and requires no generation. `Q3 = yes` → `REUSE_FROM_FAMILY`.

### 4.5 `/collection/[category]` — seven category pages (SEED §14)

| Category | Hero desktop (16:9) | Hero mobile (4:5) | Gallery supply | Verdict |
|---|---|---|---|---|
| `furniture` | recrop `LARGEFORMAT-COFFEE-001` 3:2→16:9 (→2528×1422) | **GAP → `FURNITURE-HERO-002`** | 18 `largeformat-*`, but 8 are workshop blanks (§1.1a) and 5 of the remaining 10 are already bound on `/large-format` | `RECROP` desktop · `GAP` mobile (§6 G10, now Tier 1). `LARGEFORMAT-CONSOLE-001` and `-SEATING-001` are the two assets the family offers at these ratios and both are workshop blanks — a category hero is a finished-object surface |
| `collectible-design` | `GALLERY-SCENE-003` (2688×1536) | `GALLERY-SCENE-001` (1856×2304) | 5 `gallery-scene` | `COVERED` |
| `3d-resin` | `THREE-D-RESIN-002` (5504×3072) | `THREE-D-RESIN-005` (1856×2304) | 13 `three-d-resin` (10×16:9, 2×3:4, 1×4:5) | `COVERED` |
| `wall-statement-art` | `WALL-ART-008` (21:9, 6336×2688 — full-bleed) | `WALL-ART-012` (3712×4608) | 20 `wall-art` (10×16:9, 2×21:9, 2×3:2, 1×3:4, 5×4:5) | `COVERED` |
| `preservation` | `PRESERVATION-VARMALA-007` (2688×1536) | `PRESERVATION-VARMALA-004` (1856×2304) | 19 (`preservation-varmala` 15 + `preservation-keepsake` 4) | `COVERED`. `PRESERVATION-VARMALA-009` is the family's other 4:5 candidate but is 896 × 1152 — `card`/`grid` ceiling, below the category hero's `hero` 1600 px (§2.1) |
| `decor` | `DECOR-013` (2048×1152) | `DECOR-002` (3:4, 3584×4800) | 18 `decor` (6×16:9, 6×3:4, 2×4:5, 2×9:16, 1×3:2, 1 video) | `COVERED` |
| `gifts` | `GIFTS-005` (2048×1152) | `GIFTS-003` (3712×4608) | 10 `gifts` (7×16:9, 1×3:2, 1×3:4, 1×4:5) | `COVERED` |

`furniture` and `collectible-design` have no family of their own. They are filled from
`largeformat-*` and `gallery-scene` respectively — those are *their own* subject matter, not
another category's image, which is the distinction Phase 43's exit criterion draws. `furniture`
is the one category where that supply does not reach: of its 18 `largeformat-*` assets, eight are
workshop blanks that §1.1a bars from a finished-object surface, and every 4:5 asset in the group
is one of the eight. That is why G10 is blocking rather than optional.

### 4.6 `/custom-commissions` (SEED §15)

| Section | Slot | Desktop | Mobile | Verdict |
|---|---|---|---|---|
| Hero | `media` | 16:9 · recrop `INTERIOR-LIFESTYLE-002` 3:2→16:9 (→2528×1422) | 4:5 · `INTERIOR-LIFESTYLE-003` (1856×2304) | `RECROP`; optional brief G9 |
| Who it is for | `media` | 16:9 · `INTERIOR-LIFESTYLE-005` (2048×1152) | 3:2 · `INTERIOR-LIFESTYLE-004` (2528×1696) | `COVERED` |
| Starting points | — | no media — a nine-option list | — | n/a |
| What to share | `media` | 4:3 · `PROCESS-STUDIO-001` (4800×3584) | 4:5 · `PROCESS-STUDIO-008` (3712×4608) | `COVERED` |
| How it works (4 steps) | — | no media — numbered steps | — | n/a |
| CTA | `media` | 21:9 · `MATERIAL-MACRO-009` (6336×2688) | 4:5 · recrop `MATERIAL-MACRO-014` 16:9→4:5 (→2458×3072) | `COVERED` desktop · `RECROP` mobile. `MATERIAL-MACRO-025` is the family's other 4:5 candidate but is 896 × 1152 — `card`/`grid` ceiling (§2.1). An abstract resin macro is the one subject class a crop cannot destroy, so Q4 passes on both tests |

The hero is deliberately a **re-crop, not a generation**: Q4 passes on both tests
(2528 px ≥ the `hero` preset's 1600 px, and a serene resin-and-oak interior survives a 3:2→16:9
crop intact). Brief G9 exists only if an editor judges the borrowed interior too generic for the
site's primary conversion page — that is an editorial call, not a coverage failure.

### 4.7 `/process` (SEED §16)

| Section | Slot | Desktop | Mobile | Verdict |
|---|---|---|---|---|
| Hero | `video` | 16:9 · `PROCESS-STUDIO-019` (video, 1920×1080, 6 s) | 9:16 · `PROCESS-PIGMENT-013` (video, 768×1344, 6 s) | `COVERED` |
| Hero | `media` (poster) | 21:9 · recrop `PROCESS-STUDIO-005` 16:9→21:9 (→5504×2359) | 9:16 · `PROCESS-POUR-001` (3072×5504) | `RECROP` |
| 01 Brief | `media` | 16:9 · `PROCESS-STUDIO-013` (2048×1152) | 4:5 · `PROCESS-STUDIO-006` (3712×4608) | `COVERED`. `PROCESS-STUDIO-009` is the closer subject but is 1216 × 896 — below the band's `hero` 1600 px (§2.1) and `card`/`grid`-eligible only |
| 02 Material direction | `media` | 16:9 · `PROCESS-PIGMENT-008` (2048×1152) | 4:5 · `PROCESS-PIGMENT-003` (1856×2304) | `COVERED` |
| 03 Form development | `media` | 16:9 · `PROCESS-MOULD-005` (5504×3072) | 3:4 · `PROCESS-MOULD-009` (3584×4800) | `COVERED` |
| 04 Fabrication | `media` | 16:9 · `THREE-D-RESIN-003` (5504×3072) | 3:4 · `THREE-D-RESIN-004` (3584×4800) | `COVERED` |
| 05 Resin work | `video` | 16:9 · `PROCESS-POUR-011` (video, 1920×1080, 6 s) | — | `COVERED` |
| 05 Resin work | `media` (poster) | 16:9 · `PROCESS-POUR-007` (2688×1536) | 9:16 · `PROCESS-POUR-002` (3072×5504) | `COVERED` |
| 06 Finishing | `media` | 4:3 · `PROCESS-FINISH-005` (2400×1792) | 4:5 · `PROCESS-FINISH-003` (3712×4608) | `COVERED` |
| 07 Final review | `media` | 16:9 · `PROCESS-CURE-006` (2048×1152) | 9:16 · `PROCESS-CURE-002` (3072×5504) | `COVERED` |

79 assets across seven `process-*` families. This is the most over-supplied page in the site.

### 4.8 `/portfolio` and `/portfolio/[slug]` (SEED §17, §28)

| Section | Slot | Desktop | Mobile | Verdict |
|---|---|---|---|---|
| Landing hero | `media` | 21:9 · `GALLERY-SCENE-002` (3168×1344) | 4:5 · `GALLERY-SCENE-001` (1856×2304) | `COVERED` |
| Project grid | — | — | — | `EMPTY` — the seeded SEED §28 empty state |
| `/portfolio/[slug]` | all slots | — | — | `EMPTY` / `OWNER` |

**No concept asset may be bound to a portfolio project.** The five `gallery-scene` assets are
atmosphere for the landing band only; they depict a generic gallery, not a Rivya project. The
portfolio archive stays empty until the owner has a verified project (D10, SEED §17).

### 4.9 `/journal`, `/journal/[slug]`, `/journal/category/[slug]` (SEED §18–§20)

| Surface | Slot | Desktop | Mobile | Verdict |
|---|---|---|---|---|
| Landing hero | `media` | 16:9 · `EDITORIAL-009` (5504×3072) | 3:4 · `EDITORIAL-010` (3584×4800) | `COVERED` |
| Landing band | `video` | 16:9 · `EDITORIAL-018` (video, 1280×720, 6 s) | 9:16 · `EDITORIAL-017` (video, 768×1344, 6 s) | `COVERED` |
| Article covers ×10 seeded drafts | `media` | 16:9 · `EDITORIAL-011…016`, `EDITORIAL-003`, `WORKSHOP-SESSION-001…005` | 3:4/4:5 · `EDITORIAL-007`, `-010`, `-001`, `-002` | `COVERED` — 24 candidates for 10 drafts |
| Category headers ×9 | `media` | 16:9 · drawn from `editorial`, `workshop-session`, `process-*`, `material-macro` | 4:5 · same families | `COVERED` |

Category-to-family mapping, so no editor has to guess:

| Journal category | Family to draw from |
|---|---|
| Resin Furniture | `largeformat-*` |
| Collectible Design | `gallery-scene` |
| Materials | `material-macro` |
| 3D Printing | `three-d-resin` |
| Studio Process | `process-studio` |
| Custom Projects | `interior-lifestyle` |
| Interior Art | `wall-art` |
| Preservation | `preservation-varmala`, `preservation-keepsake` |
| Care & Education | `workshop-session` |

### 4.10 `/contact`, `/faq`, `/search`, `/privacy`, `/terms`, 404, 500 (SEED §21, §23, §26, §45–§47)

| Route | Slot | Decision | Verdict |
|---|---|---|---|
| `/contact` | `media` | 16:9 · `MATERIAL-MACRO-030` (2048×1152) · mobile 4:5 · `MATERIAL-MACRO-013` (3712×4608) | `COVERED` |
| `/faq` | — | Typographic header. An FAQ page does not need a picture and a borrowed material band adds nothing | `EMPTY` |
| `/search` | — | Results, empty state and placeholder are copy (SEED §26). No media slot | `EMPTY` |
| `/privacy`, `/terms` | — | `LEGAL_COPY` only | `EMPTY` |
| 404 (SEED §45) | — | Typographic. Copy is seeded; a picture would soften a wayfinding failure | `EMPTY` |
| 500 (SEED §46) | — | Typographic | `EMPTY` |
| Media-failure fallback (SEED §47) | — | **Not an image.** `MediaSlot` paints `--rv-surface-sunken` at the reserved ratio with the seeded label "Image temporarily unavailable" | `EMPTY` by design |

### 4.11 `/product/[slug]` and `/collections/[slug]`

| Surface | Decision | Verdict |
|---|---|---|
| Product hero, gallery, detail, lifestyle, video, 3D model | Owner-supplied. The `product_media` trigger **rejects any asset with `is_concept = true`** outright | `OWNER` |
| `/collections/[slug]` — the ten `DRAFT_COLLECTION_CONCEPT` names (FEAT §9) | Only `Ocean`, `Midnight`, `Clear` and `Geode` have a truthful match in a library built on deep ocean, obsidian, sapphire and champagne. `Aurora`, `Earth`, `Monsoon`, `Forest`, `Botanical` and `Bespoke` have no matching asset and must not borrow a blue one — the concept name would then describe a picture that contradicts it | 4 `COVERED`, 6 `EMPTY` |

Collection-concept bindings where they are truthful:

| Concept | Desktop 21:9 | Mobile 9:16 |
|---|---|---|
| Ocean | `MATERIAL-MACRO-015` (6336×2688) | `MATERIAL-MACRO-002` (3072×5504) |
| Midnight | `WALL-ART-013` (6336×2688) | `MATERIAL-MACRO-004` (3072×5504) |
| Clear | `MATERIAL-MACRO-009` (6336×2688) | `MATERIAL-MACRO-003` (3072×5504) |
| Geode | `WALL-ART-008` (6336×2688) | `DECOR-003` (3072×5504) |

---

## 5. Coverage map — global, CMS and Studio surfaces

| Surface | Slot | Decision | Verdict |
|---|---|---|---|
| Announcement bar (SEED §9) | — | Copy and CTA only | n/a |
| Main navigation, mega menu (SEED §8) | `card.1…7` | The seven category cards from §4.4 | `COVERED` for six. `card.1` Furniture follows §4.4 and stays a `GAP` until G10's 4:5 variant exists; the mega-menu tile renders its empty state, it does not borrow a blank |
| Footer (SEED §24) | — | Copy, columns and links only | n/a |
| Global brand content (SEED §6) | `logo`, `wordmark`, `favicon` | **Never generated** (§2.2). Interim: typographic wordmark from design tokens, no image request | `OWNER` |
| SEO defaults (SEED §41, §44) | `og` | Interim `MATERIAL-MACRO-012` through the `og` preset. Final branded card is owner-supplied | `COVERED` interim · `OWNER` final |
| Empty states (SEED §27–§29) | — | Copy only; no illustration. An empty state that is honest does not need decorating | `EMPTY` |
| Inquiry success (SEED §48) | — | Copy only | n/a |
| Studio login (SEED §38) | `media` | 4:5 · `PROCESS-STUDIO-008` (3712×4608) as a side panel; optional, behind a Studio setting | `COVERED` |
| Studio helper copy (SEED §40) | — | Copy only | n/a |
| 3D viewer poster / thumbnail (FEAT §12–§14) | — | No model exists; the `3d_viewer` flag is off | `EMPTY` |
| Documents (care guides, spec sheets) | — | Owner-supplied PDFs into `rivya/documents` | `OWNER` |

---

## 6. GAP TABLE — briefs for Phase 43

Every brief below has all four decision-gate answers recorded as "no". Nothing here may be
generated until `npm run media:assert-no-regen` passes for its target ID.

**Tier 1 — blocking.** No existing asset can serve the slot at any crop.
**Tier 2 — optional.** A re-crop already serves the slot; generation buys set continuity or
editorial distinctiveness only. Generate these only if a human decides the re-crop is not good
enough, and record that decision.

| # | Target ID | Tier | Slot | Ratio D/M | Folder | Why nothing existing fits |
|---|---|---|---|---|---|---|
| G1 | `HOME-HERO-VIDEO-001` | 1 | `/` hero video | 16:9 / — | `rivya/home/hero` | Zero videos carry `page = home`. The seven 1920×1080 videos are all process, macro or gallery subjects; the homepage must lead with large-format furniture (SEED §56). The two `largeformat-dining` videos are 1344 px and 768 px — a full-bleed 1920 px hero would upscale visibly |
| G2 | `HOME-HERO-POSTER-001` | 1 | `/` hero poster, desktop | 21:9 / — | `rivya/home/hero` | The poster is the LCP element and must be **frame-identical to G1**, or the video mount produces a visible jump. `LARGEFORMAT-DINING-002` (6336×2688) is the correct interim binding and is not a substitute once G1 exists |
| G3 | `LARGE-DINING-CARD-001` | 1 | Homepage Signature Collections · Tables; `/large-format` Dining card | 4:5 / 4:5 | `rivya/large-format/dining` | No portrait table asset exists. All three dining stills are landscape (16:9, 21:9) or a 9:16 interior. A portrait crop of a long table removes its length, which is the subject. The 4:5 assets that do exist in `largeformat-*` are workshop blanks (§1.1a) and cannot sit in a finished-object card |
| G4 | `LARGE-COFFEE-CARD-001` | 1 | `/large-format` Coffee & Centre Tables card | 4:5 / 4:5 | `rivya/large-format/coffee` | The family has exactly one asset, `LARGEFORMAT-COFFEE-001` at 3:2. Cropping 3:2→4:5 yields 1357×1696 — enough pixels, but it removes the low horizontal proportion that is what makes a coffee table read as one |
| G5 | `LARGE-ARCHITECTURAL-CARD-001` | 1 · **HELD** | Homepage Architectural card; `/large-format` Architectural card | 4:5 / 4:5 | `rivya/large-format/architectural` | The family has exactly one asset, at 21:9. The subject *is* the ultra-wide space and its negative space; a 4:5 crop keeps 2150×2688 px and destroys the picture. **Do not generate until the owner verifies architectural/spatial capability** — SEED §12 marks the copy `OWNER_VERIFICATION_REQUIRED`, and an image would assert the capability faster than the words |
| G6 | `HOME-HERO-POSTER-002` | 2 | `/` hero poster, mobile | 9:16 / — | `rivya/home/hero` | `LARGEFORMAT-DINING-001` (1536×2752) was prompted "for a mobile hero" and clears the 9:16 mobile-hero minimum of 1440 × 2560 (§2.1). Its 1536 px width is below `hero`'s 1600 px, so it serves this 9:16 slot and no landscape one. Generate only for scene continuity with G1/G2, or to lift the mobile hero above every preset width |
| G7 | `HOME-MATERIAL-FABRICATED-001` | 2 | Homepage Material Palette · Fabricated Form | 1:1 / 1:1 | `rivya/material` | A 16:9→1:1 recrop of `THREE-D-RESIN-002` fits. Generate only to keep the four-tile set shot in one session, as `MATERIAL-MACRO-016…022` were |
| G8 | `HOME-MATERIAL-FINISH-001` | 2 | Homepage Material Palette · Finish | 1:1 / 1:1 | `rivya/material` | A 4:5→1:1 recrop of `PROCESS-FINISH-001` fits. Same continuity argument as G7 |
| G9 | `COMMISSION-HERO-001` | 2 | `/custom-commissions` hero | 16:9 / 4:5 | `rivya/commission` | A 3:2→16:9 recrop of `INTERIOR-LIFESTYLE-002` fits at 2528×1422. Generate only if an editor judges a borrowed Japandi interior too generic for the primary conversion page |
| G10 | `FURNITURE-HERO-001` · `FURNITURE-HERO-002` | 1 | `/collection/furniture` hero; `/collection` landing Furniture card; mega-menu Furniture tile | 16:9 / 4:5 | `rivya/collection/furniture` | The category's only 4:5 supply is the eight workshop blanks §1.1a bars from a finished-object surface, so the 4:5 role (`-002`) has nothing to bind. The 21:9 role (`-001`) is Tier 2 on its own — a 3:2→16:9 recrop of `LARGEFORMAT-COFFEE-001` serves the desktop hero at 2528×1422 — and is generated with `-002` so the two roles are one scene |
| G11 | `LARGE-SEATING-CARD-001` | 1 | Homepage Signature Collections · Sculptural Furniture `card.2`; `/large-format` Sculptural Seating `card.5` | 4:5 / 4:5 | `rivya/large-format/seating` | All four `largeformat-seating` assets are 4:5 and all four are workshop blanks — a seat blank in its mould, a bench plank on trestles, "no legs or frame attached, no finished chair anywhere in shot" (§1.1a, DQ-8). There is no finished seat in the library at any ratio, so Q4 has nothing to crop |
| G12 | `LARGE-CONSOLE-CARD-001` | 1 | `/large-format` Consoles & Side Pieces `card.3` | 4:5 / 4:5 | `rivya/large-format/console` | The seven `largeformat-console` and `largeformat-side` assets split three ways: four are workshop blanks (§1.1a), `LARGEFORMAT-SIDE-003` is a desk of 3D-printed organisers and `LARGEFORMAT-CONSOLE-004` a wall panel (both subject-mismatched, DQ-7), leaving one finished console at 3:2 — `LARGEFORMAT-CONSOLE-003`, already bound to the `/large-format` category intro, and a 3:2→4:5 crop of a long console removes its length, which is the subject |

**Folders that do not yet exist** and must be added to `lib/media/folders.ts` before any of these
uploads: `rivya/home/hero` (G1, G2, G6), `rivya/commission` (G9), `rivya/collection/furniture`
(G10). G11 and G12 need no new folder — `rivya/large-format/seating` and
`rivya/large-format/console` are already manifest folders. The Phase 06 folder test asserts that
every manifest folder appears in the allowlist; the allowlist is a superset, so additions are
legal without weakening the assertion.

> **Product imagery lives elsewhere.** The briefs below are the site's own slots (heroes, cards,
> landing). Prompts for the demo catalogue's product images — a concept visualisation per
> placeholder product, never a library asset — are in `docs/ASSET_GENERATION_PROMPTS.md`
> (Phase 35b, amendment A36) under planned IDs `PRODUCT-HERO-NNN` / `PRODUCT-SCENE-NNN`.

### 6.1 Full briefs

All prompts use the house grammar defined in `HIGGSFIELD_GUIDE.md` §2. Palette clause and
negative block are quoted verbatim from the existing library and must not be paraphrased.

**Shared palette clause (Recipe A tail — appears verbatim in 114 existing assets):**

```
— palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne
gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen;
cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos,
no watermarks, no faces.
```

**Shared negative block (`RIVYA-NEG-V1` — appears verbatim in 46 existing assets):**

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade,
HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background.
```

**`RIVYA-NEG-V2` — the V1 block plus five content-integrity exclusions. Use V2 for every brief
below.** V2 extends V1; it never replaces it.

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade,
HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible
brand marks, price tags or labels, showroom or retail signage, recognisable human faces,
award or certification badges.
```

---

#### G1 · `HOME-HERO-VIDEO-001`

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | video |
| Planned family (see §3.1) | `home-hero-video` — the full planned ID prefix, lower-cased |
| Page · section | `home` · `hero` |
| Slot · role | `video` · `DESKTOP` |
| Aspect ratio | 16:9 |
| Minimum resolution | 1920 × 1080 |
| Duration | 8–10 s, seamless loop, locked-off or one slow move |
| Cloudinary folder | `rivya/home/hero` |
| Cloudinary public ID | `rivya/home/hero/home-hero-video-001-16x9` |
| Filename | `home-hero-video-001-16x9.mp4` |
| Suggested model | `cinematic_studio_3_0` (all four 8–10 s library videos use it) |
| Gate | Q1 no · Q2 no · Q3 no (no `home` video; no furniture video ≥1920) · Q4 no (cannot upscale) |

**Prompt**

```
Slow cinematic dolly, one unbroken move, toward a large live-edge resin dining table: a deep
ocean blue epoxy river running through natural walnut, set in a tall serene architectural
interior with rammed-earth walls and soft morning side-light from the left. The camera settles
with the table centred and the upper third of the frame calm and near-empty as a headline safe
area. No people, no movement other than the camera. Quiet luxury, mineral-neutral palette,
photorealistic physical materials, resin reading as deep glass never plastic, realistic furniture
proportions. Loopable.
```

**Negative prompt** — `RIVYA-NEG-V2`.

**Alt text (draft, §43-compliant)**
> A long walnut dining table with a deep blue resin river runs through a quiet daylit room with
> rammed-earth walls.

---

#### G2 · `HOME-HERO-POSTER-001`

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image |
| Planned family (see §3.1) | `home-hero-poster` — the full planned ID prefix, lower-cased |
| Page · section | `home` · `hero` |
| Slot · role | `media` · `DESKTOP` (poster for G1) |
| Aspect ratio | 21:9 |
| Minimum resolution | 2560 × 1097 — target 6336 × 2688 to match the library's other 21:9 masters |
| Cloudinary folder | `rivya/home/hero` |
| Cloudinary public ID | `rivya/home/hero/home-hero-poster-001-21x9` |
| Filename | `home-hero-poster-001-21x9.webp` |
| Suggested model | `cinematic_studio_2_5` — used for 3 of the 7 6336 × 2688 21:9 masters (`MATERIAL-MACRO-009`, `LARGEFORMAT-DINING-002`, `LARGEFORMAT-MONUMENTAL-001`); the other four (`WALL-ART-008`, `-013`, `MATERIAL-MACRO-011`, `-015`) use `nano_banana_2` |
| Gate | Q1 no · Q2 no · Q3 no · Q4 no (must be frame-identical to G1) |
| Interim binding until generated | `LARGEFORMAT-DINING-002` (image, 21:9, 6336 × 2688) |

**Prompt**

```
Ultra-wide architectural editorial photograph, the first frame of a slow dolly: a large live-edge
resin dining table with a deep ocean blue epoxy river through natural walnut, centred in an
organic-modern interior with rammed-earth walls, tall windows and soft morning side-light, eight
quiet chairs, generous negative space, the upper third calm and near-empty as a headline safe
area. Quiet luxury, mineral-neutral palette, photorealistic physical materials, resin like deep
glass never plastic, realistic furniture proportions. No people, no text, no logos, no neon, no
heavy gold, no generic showroom look.
```

**Negative prompt** — `RIVYA-NEG-V2`.

**Alt text (draft)**
> A long walnut dining table with a deep blue resin river, centred in a rammed-earth room under
> tall windows.

---

#### G3 · `LARGE-DINING-CARD-001`

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image |
| Planned family (see §3.1) | `large-dining-card` — **not** `largeformat-dining` |
| Page · section | `large-format` · `dining-tables` |
| Slot · role | `card.1` · `DESKTOP` and `MOBILE` |
| Aspect ratio | 4:5 |
| Minimum resolution | 1600 × 2000 — target 3712 × 4608 |
| Cloudinary folder | `rivya/large-format/dining` |
| Cloudinary public ID | `rivya/large-format/dining/large-dining-card-001-4x5` |
| Filename | `large-dining-card-001-4x5.webp` |
| Suggested model | `nano_banana_2` (all 3712 × 4608 masters) |
| Gate | Q1 no · Q2 no · Q3 no (no portrait table) · Q4 no (portrait crop removes the table's length) |

**Prompt**

```
Portrait editorial photograph looking along the length of a finished live-edge resin dining
table: seasoned walnut with a deep ocean blue resin river receding into the frame, the near
corner sharp and the far end falling into soft focus, a single tall window out of frame casting
one soft directional key from the left, the room reduced to shadow so the table is the only
subject, no chairs pulled out, no people — palette limited to deep ocean #08283A, obsidian
#080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm
rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism;
shallow depth of field; no text, no logos, no watermarks, no faces.
```

**Negative prompt** — `RIVYA-NEG-V2`.

**Alt text (draft)**
> A walnut dining table seen along its length, a deep blue resin river running away from the
> viewer into shadow.

---

#### G4 · `LARGE-COFFEE-CARD-001`

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image |
| Planned family (see §3.1) | `large-coffee-card` — **not** `largeformat-coffee` |
| Page · section | `large-format` · `coffee-tables` |
| Slot · role | `card.2` · `DESKTOP` and `MOBILE` |
| Aspect ratio | 4:5 |
| Minimum resolution | 1600 × 2000 — target 3712 × 4608 |
| Cloudinary folder | `rivya/large-format/coffee` |
| Cloudinary public ID | `rivya/large-format/coffee/large-coffee-card-001-4x5` |
| Filename | `large-coffee-card-001-4x5.webp` |
| Suggested model | `nano_banana_2` |
| Gate | Q1 no · Q2 no · Q3 no (family = 1 asset, 3:2 only) · Q4 no (crop removes the low proportion) |

**Prompt**

```
Portrait editorial photograph taken from low and close: a round resin coffee table with a deep
ocean blue cast surface and a solid walnut base, standing alone on a wool rug, the frame tall
enough to show the full height of the base and the empty air above the tabletop, one shaft of
late afternoon light raking across the resin, the room behind reduced to shadow, no people —
palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne
gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen;
cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos,
no watermarks, no faces.
```

**Negative prompt** — `RIVYA-NEG-V2`.

**Alt text (draft)**
> A round coffee table with a deep blue resin top and walnut base, lit from one side on a wool
> rug.

---

#### G5 · `LARGE-ARCHITECTURAL-CARD-001` — **HELD**

> **Do not generate until the owner confirms architectural / spatial-installation capability.**
> SEED §12 marks the *Architectural & Statement Pieces* copy `OWNER_VERIFICATION_REQUIRED`.
> A photograph asserts a capability faster and more convincingly than a sentence does; producing
> one before the words are verified inverts the safeguard. The slot renders its empty state until
> the flag clears, and this brief is executed in the same session as the copy approval.

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image |
| Planned family (see §3.1) | `large-architectural-card` — **not** `largeformat-monumental` |
| Page · section | `large-format` · `architectural` |
| Slot · role | `card.6` · `DESKTOP` and `MOBILE`; homepage `card.5` |
| Aspect ratio | 4:5 |
| Minimum resolution | 1600 × 2000 — target 3712 × 4608 |
| Cloudinary folder | `rivya/large-format/architectural` |
| Cloudinary public ID | `rivya/large-format/architectural/large-architectural-card-001-4x5` |
| Filename | `large-architectural-card-001-4x5.webp` |
| Gate | Q1 no · Q2 no · Q3 no (family = 1 asset, 21:9 only) · Q4 no (portrait crop destroys the scale) |
| Release gate | `owner_verification` on the `/large-format` architectural section = `VERIFIED` |

**Prompt**

```
Tall portrait architectural photograph: a monumental freestanding resin and timber sculptural
piece standing floor to near-ceiling in a quiet lobby, the full height of the object in frame
with a person's height of empty space beside it for scale, polished stone floor reflecting it
faintly, tall diffuse daylight from above, monastic calm, vast negative space, no people —
palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne
gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen;
cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos,
no watermarks, no faces.
```

**Negative prompt** — `RIVYA-NEG-V2`.

**Alt text (draft)**
> A tall freestanding resin and timber sculpture standing alone in a quiet stone-floored lobby.

---

#### G6 · `HOME-HERO-POSTER-002` — Tier 2

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image · 9:16 · min 1440 × 2560 |
| Planned family (see §3.1) | `home-hero-poster` — shared with G2, which is the same ID prefix |
| Cloudinary folder | `rivya/home/hero` |
| Cloudinary public ID | `rivya/home/hero/home-hero-poster-002-9x16` |
| Filename | `home-hero-poster-002-9x16.webp` |
| Gate | Q1 no · Q2 no · **Q3 yes, at the mobile-hero target only** — `LARGEFORMAT-DINING-001` is 1536 × 2752 and prompted "for a mobile hero": it clears the 9:16 mobile-hero minimum of 1440 × 2560 (§2.1), and its 1536 px width is **below `hero`'s 1600 px**, which makes it one of the 14 sub-`hero` images and eligible for this 9:16 slot and no landscape one · Q4 n/a |
| Generate only if | An editor requires the mobile hero to be the same scene as G1/G2, or wants a mobile hero that also clears the landscape presets |

**Prompt**

```
Vertical editorial photograph for a mobile hero, same room and same light as the desktop hero:
a large live-edge resin dining table with a deep ocean blue river through walnut in a tall serene
architectural interior with rammed-earth walls, soft morning side-light, the upper third of the
frame calm and near-empty as headline safe area. Quiet luxury, photorealistic materials never
plastic, realistic proportions. No people, no text, no neon, no heavy gold.
```

**Negative prompt** — `RIVYA-NEG-V2`.
**Alt text (draft)** — *A walnut dining table with a deep blue resin river, seen upright in a tall
daylit room.*

---

#### G7 · `HOME-MATERIAL-FABRICATED-001` — Tier 2

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image · 1:1 · min 2048 × 2048, target 4096 × 4096 |
| Planned family (see §3.1) | `home-material-fabricated` — the full planned ID prefix, lower-cased |
| Cloudinary folder | `rivya/material` |
| Cloudinary public ID | `rivya/material/home-material-fabricated-001-1x1` |
| Filename | `home-material-fabricated-001-1x1.webp` |
| Gate | Q1 no · Q2 no · Q3 no (no 1:1 fabricated-form macro) · **Q4 yes** (recrop `THREE-D-RESIN-002`) |
| Generate only if | The four-tile Material Palette set must be shot in one session, as `MATERIAL-MACRO-016…022` were |

**Prompt** — uses the identical-session preamble found verbatim in `MATERIAL-MACRO-016…022`:

```
One of four material macros shot on an identical matte charcoal-neutral stone ground under
identical light, same magnification, same lens, same framing, so the four tile together as one
set. Frame: extreme macro of the stepped layer lines of a translucent blue 3D-printed lattice,
each deposited layer resolved at the lit edge, the geometry falling into soft focus behind —
palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne
gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen;
cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos,
no watermarks, no faces.
```

**Negative prompt** — `RIVYA-NEG-V2`.
**Alt text (draft)** — *Close view of the stepped print layers on a translucent blue 3D-printed
lattice.*

---

#### G8 · `HOME-MATERIAL-FINISH-001` — Tier 2

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image · 1:1 · min 2048 × 2048, target 4096 × 4096 |
| Planned family (see §3.1) | `home-material-finish` — the full planned ID prefix, lower-cased |
| Cloudinary folder | `rivya/material` |
| Cloudinary public ID | `rivya/material/home-material-finish-001-1x1` |
| Filename | `home-material-finish-001-1x1.webp` |
| Gate | Q1 no · Q2 no · Q3 no (no 1:1 finish macro) · **Q4 yes** (recrop `PROCESS-FINISH-001`) |
| Generate only if | Set continuity with G7 and `MATERIAL-MACRO-016…022` |

**Prompt**

```
One of four material macros shot on an identical matte charcoal-neutral stone ground under
identical light, same magnification, same lens, same framing, so the four tile together as one
set. Frame: extreme macro of a finished surface transition where matte-sanded walnut meets
polished clear resin, the polish holding one soft specular highlight and the timber holding none
— palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne
gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen;
cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos,
no watermarks, no faces.
```

**Negative prompt** — `RIVYA-NEG-V2`.
**Alt text (draft)** — *Close view of a finished edge where matte-sanded walnut meets polished
clear resin.*

---

#### G9 · `COMMISSION-HERO-001` — Tier 2

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image · 16:9 desktop min 1600 × 900 (target 5504 × 3072); 4:5 mobile as `COMMISSION-HERO-002` |
| Planned family (see §3.1) | `commission-hero` — the full planned ID prefix, lower-cased; `-002` shares it |
| Cloudinary folder | `rivya/commission` |
| Cloudinary public ID | `rivya/commission/commission-hero-001-16x9` |
| Filename | `commission-hero-001-16x9.webp` |
| Gate | Q1 no · Q2 no · Q3 no (no `commission` family) · **Q4 yes** (recrop `INTERIOR-LIFESTYLE-002` 3:2→16:9 at 2528 × 1422) |
| Generate only if | An editor judges the borrowed Japandi interior too generic for the primary conversion page |

**Prompt**

```
Editorial photograph of a commission in development, no finished piece: a large sheet of tracing
paper with a hand-drawn table elevation weighted flat on a dark teak bench, a folded tape
measure, two timber offcuts and a small tray of cured resin swatches laid out beside it, a
printed photograph of an empty room resting at the edge of frame, warm lamp raking from the left,
no people — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted
champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no
plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no
text, no logos, no watermarks, no faces.
```

> The prompt says "a hand-drawn table elevation" and the negative block excludes text: the drawing
> must read as a drawing, never as legible dimensions. A legible dimension in a hero image is a
> fabricated product specification (D10).

**Negative prompt** — `RIVYA-NEG-V2`.
**Alt text (draft)** — *A hand-drawn table elevation weighted flat on a dark bench beside timber
offcuts and cured resin swatches.*

---

#### G10 · `FURNITURE-HERO-001` · `FURNITURE-HERO-002` — Tier 1

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image · 16:9 desktop min 1600 × 900 (target 5504 × 3072) — a category hero, not a full-bleed page hero (§3.5); 4:5 mobile as `FURNITURE-HERO-002`, min 1600 × 2000 (target 3712 × 4608) |
| Planned family (see §3.1) | `furniture-hero` — the full planned ID prefix, lower-cased; both variants share it |
| Slot · role | `/collection/furniture` hero `DESKTOP` (`-001`) and `MOBILE` (`-002`); `/collection` landing `card.1` and the mega-menu Furniture tile also bind `-002` |
| Cloudinary folder | `rivya/collection/furniture` |
| Cloudinary public ID | `rivya/collection/furniture/furniture-hero-001-16x9` · `…/furniture-hero-002-4x5` |
| Filename | `furniture-hero-001-16x9.webp` · `furniture-hero-002-4x5.webp` |
| Suggested model | `nano_banana_2` (all 3712 × 4608 and 5504 × 3072 masters) |
| Gate | Q1 no · Q2 no · **Q3 no** — the only `largeformat-*` assets at these ratios are `LARGEFORMAT-CONSOLE-001` (16:9) and `LARGEFORMAT-SEATING-001` (4:5), and both are §1.1a workshop blanks that may not stand on a category hero or a category card · **Q4 no for 4:5** — no finished furniture asset survives a portrait crop (the length of a table or a console *is* the subject; §6 G3, G12) |
| Desktop interim until generated | recrop `LARGEFORMAT-COFFEE-001` 3:2→16:9 (→2528×1422). That crop passes both Q4 tests, which is why `-001` alone would be Tier 2; it is generated with `-002` so the two roles are one scene |
| Mobile interim | **none.** The slot renders its empty state (D10) rather than borrow a half-built blank |

**Prompt**

```
Wide editorial photograph of three finished resin-and-timber furniture pieces standing together
in one quiet room — a low table, a console and a bench — spaced far apart across the frame with
large calm negative space between them, soft morning side-light, mineral-neutral walls, no
styling props, no people. Quiet luxury, mineral neutrals with natural wood, photorealistic
materials, resin like deep glass never plastic, realistic furniture proportions. No people, no
text, no logos, no neon, no heavy gold, no generic showroom look.
```

**Negative prompt** — `RIVYA-NEG-V2`.
**Alt text (draft)** — *A low table, a console and a bench in resin and timber, standing far apart
in one quiet daylit room.*

**Prompt · `FURNITURE-HERO-002` (4:5)** — the same room, the same light, one piece instead of three:

```
Portrait editorial photograph of a single finished resin-and-timber console standing against a
mineral-neutral wall in the same quiet room and the same morning side-light as the wide frame,
the full height of the piece in view with calm empty wall above it, a bench just visible falling
out of focus behind, no styling props, no people. Quiet luxury, mineral neutrals with
natural wood, photorealistic materials, resin like deep glass never plastic, realistic furniture
proportions. No text, no logos, no neon, no heavy gold, no generic showroom look.
```

**Negative prompt** — `RIVYA-NEG-V2`.
**Alt text (draft)** — *A finished resin and timber console standing against a plain wall in a
quiet daylit room.*

---

#### G11 · `LARGE-SEATING-CARD-001` — Tier 1

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image |
| Planned family (see §3.1) | `large-seating-card` — **not** `largeformat-seating` |
| Page · section | `large-format` · `seating` |
| Slot · role | `/large-format` `card.5` and homepage `card.2`, `DESKTOP` and `MOBILE` |
| Aspect ratio | 4:5 |
| Minimum resolution | 1600 × 2000 — target 3712 × 4608 |
| Cloudinary folder | `rivya/large-format/seating` |
| Cloudinary public ID | `rivya/large-format/seating/large-seating-card-001-4x5` |
| Filename | `large-seating-card-001-4x5.webp` |
| Suggested model | `nano_banana_2` (all 3712 × 4608 masters) |
| Gate | Q1 no · Q2 no · **Q3 no** — all four `largeformat-seating` assets are 4:5 at 3712 × 4608 and all four are workshop blanks whose prompts say "no legs or frame attached, no finished chair anywhere in shot" (§1.1a, DQ-8) · **Q4 no** — there is no finished seat in the library at any ratio to crop |
| Interim | **none.** Both slots render their empty state until this is generated |

**Prompt**

```
Portrait editorial photograph of one finished sculptural chair, complete and standing on its own
legs on a polished stone floor: laminated walnut shell with a single thin sapphire resin seam
following the curve of the seat, the whole piece in frame with calm empty space above it, one
soft directional key from a tall window out of frame, the room behind reduced to shadow, no
people — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted
champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no
plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no
text, no logos, no watermarks, no faces.
```

> The word **finished** is load-bearing. This brief exists only because the library's four seating
> assets are mid-build: a blank in its mould reads as a half-made product on a card that says
> *Sculptural Seating* (DQ-8). A mould, a clamp, a trestle or a bare edge in frame fails the brief.

**Negative prompt** — `RIVYA-NEG-V2`, plus the words `mould, clamp, trestle, workbench,
unfinished edge, masking tape`.

**Alt text (draft)**
> A curved walnut chair with a thin blue resin seam along the seat, standing alone on a stone
> floor.

---

#### G12 · `LARGE-CONSOLE-CARD-001` — Tier 1

| Field | Value |
|---|---|
| Status | `NEW_GENERATION_REQUIRED` |
| Type | image |
| Planned family (see §3.1) | `large-console-card` — **not** `largeformat-console` or `largeformat-side` |
| Page · section | `large-format` · `consoles` |
| Slot · role | `/large-format` `card.3`, `DESKTOP` and `MOBILE` |
| Aspect ratio | 4:5 |
| Minimum resolution | 1600 × 2000 — target 3712 × 4608 |
| Cloudinary folder | `rivya/large-format/console` |
| Cloudinary public ID | `rivya/large-format/console/large-console-card-001-4x5` |
| Filename | `large-console-card-001-4x5.webp` |
| Suggested model | `nano_banana_2` |
| Gate | Q1 no · Q2 no · **Q3 no** — every 4:5 asset across `largeformat-console` and `largeformat-side` is a workshop blank (§1.1a); of the rest, `LARGEFORMAT-SIDE-003` and `LARGEFORMAT-CONSOLE-004` are subject-mismatched (DQ-7) and `LARGEFORMAT-CONSOLE-003` is the one finished console, at 3:2, already bound to the `/large-format` category intro · **Q4 no** — a 3:2→4:5 crop of a long console removes its length, which is the subject, exactly as in G3 |
| Interim | **none.** The slot renders its empty state |

**Prompt**

```
Portrait editorial photograph of a finished console table standing against a lime-plaster wall,
seen slightly along its length so the full run of the top recedes into the frame: alternating
bands of teak and clear sapphire resin, slim tapered legs on a stone floor, one small round side
table of the same materials placed beside it, calm empty wall above, one soft directional key
from the left, no styling props, no people — palette limited to deep ocean #08283A, obsidian
#080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm
rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism;
shallow depth of field; no text, no logos, no watermarks, no faces.
```

**Negative prompt** — `RIVYA-NEG-V2`, plus the words `clamp, workbench, masking tape, resin dam,
unfinished edge`.

**Alt text (draft)**
> A console table of teak and blue resin bands standing against a plaster wall, a small round side
> table beside it.

---

## 7. Recorded `LEAVE_EMPTY` and `OWNER` decisions

Every one of these is a decision, not an omission. Each names the condition that would reopen it.

| Surface | Disposition | Reopen when |
|---|---|---|
| Brand logo, wordmark, favicon, app icons | `OWNER` | The owner uploads them via `/studio/media/brand` |
| Default branded OG card | `OWNER` | As above; interim `MATERIAL-MACRO-012` through the `og` preset stands |
| All product media | `OWNER` | The owner enters a real product with real photography |
| All 3D models | `LEAVE_EMPTY` | The owner supplies a `GLB` of an object that exists; then the `3d_viewer` flag opens |
| Portfolio projects | `LEAVE_EMPTY` | The owner has a verified delivered project |
| `/large-format` Conference & Commercial card | `LEAVE_EMPTY` | `owner_verification = VERIFIED` on that section's copy |
| `/large-format` Architectural card | `LEAVE_EMPTY` → brief G5 | `owner_verification = VERIFIED` on that section's copy |
| Homepage `card.2`; `/large-format` `card.3` and `card.5`; `/collection` Furniture card and its mega-menu tile; `/collection/furniture` mobile hero | `LEAVE_EMPTY` → briefs G10, G11, G12 | Those briefs are generated. Until then no §1.1a workshop blank stands in as a finished object — that is the "half-built product" failure DQ-8 names |
| Collection concepts Aurora, Earth, Monsoon, Forest, Botanical, Bespoke | `LEAVE_EMPTY` | The owner confirms the concept, at which point a brief is written for it |
| `/faq`, `/search`, `/privacy`, `/terms`, 404, 500 | `LEAVE_EMPTY` | Never — these pages are better without a picture |
| Media-failure fallback (SEED §47) | `LEAVE_EMPTY` | Never — it is a token-painted surface, not an image |

---

## 8. Change control

| Change | Required action |
|---|---|
| A new CMS slot appears | Add it to `content/media-slots.ts`, then run the gate and add a row to §4 or §5 |
| A gap is closed by generation | The Python builder appends to the manifest, bumping `manifest_version` to `rivya-hf-v2`; the original 250 objects stay **byte-identical**; `npm run manifest:verify` proves it |
| A gap is closed by re-crop | A `media_crops` row is written from the Studio crop editor; §4 verdict changes to `RECROP` with the ratio recorded. No manifest change |
| A brief is added here | Both guards must pass in CI before merge: `npm run media:assert-no-regen` (the target must not already exist) and `python scripts/media/check-asset-ids.py` (the planned ID must not reuse a manifest family prefix — D6 A1) |
| An existing asset is judged unusable | It is archived, never regenerated. Its ID is never reused |
| This document and the manifest disagree | The manifest wins. Correct this file |
| This document and `CANONICAL-DECISIONS.md` disagree | D6 wins. Correct this file, or amend D6 by dated amendment |
| **Open: the filename grammar (§3.3)** | D6's literal `<page>-<section>-<variant>.<ext>` describes none of the 250 filenames that exist. A dated amendment to D6 recording `<rivya_asset_id lower-cased>-<ratio-with-x>.<ext>` is required, and only the owner of `CANONICAL-DECISIONS.md` may append it. Until then D6 wins on paper and §3.3 is a recorded divergence, not a silent one |
