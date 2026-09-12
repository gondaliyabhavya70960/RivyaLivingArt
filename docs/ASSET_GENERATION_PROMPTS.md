---
doc: ASSET_GENERATION_PROMPTS
status: CURRENT
owning_phase: 43
last_reviewed: 2026-09-12
owner_verification: OWNER_VERIFICATION_REQUIRED
---

# Asset generation prompts — the image brief book

> **What this is.** One ChatGPT-compatible prompt per image the site needs and no library asset may
> supply, with the exact place each image goes. The owner generates the image after launch, uploads
> it to Cloudinary, and pastes the URL into the entry; Phase 43's intake script
> (`scripts/media/register-external-asset.ts`) registers and binds it. Until then every entry reads
> `Cloudinary Status: WAITING_FOR_UPLOAD`. Added to D7 by amendment A31; governed by amendment A36.
>
> **What every image here is.** A **concept visualisation** of a placeholder product — not a
> photograph of a piece Rivya has made. It is registered `is_ai_generated = true, is_concept = true`
> and may be bound to a product only once the product page and card render the seeded
> "concept visualisation" label (Phase 43, migration `0411`). A piece that does not look right is
> changed or removed, as the owner said; nothing here is a claim about inventory.

## Rules for every prompt

| Rule | Why |
|---|---|
| The four-token palette clause is copied verbatim into every prompt | It is the single reason the 250-asset library reads as one library (HIGGSFIELD_GUIDE §2.1) |
| The negative block `RIVYA-NEG-V2` is copied verbatim into every prompt | It excludes text, logos, price tags, faces, badges — every way an image could assert a fact |
| No price, dimension, material name, lead time, award or claim appears in any prompt | D10 and CLAUDE.md; the demo copy carries none either (`tests/unit/demo-content.test.ts`) |
| No people, no faces, no hands | House rule, and a person in a room is a claim about a delivered project |
| Ask for the ratio in the prompt as well as in the tool | HIGGSFIELD_GUIDE §2.7 — it visibly improves composition |
| Minimum sizes: 4:5 hero **2048 × 2560**; 16:9 scene **2560 × 1440** | The delivery ladder (`hero` `w_1600`, cards up to `w_1280`) never upscales |
| Filename `<page>-<section>-<nnn>-<ratio>.png`; folder `rivya/product/<slug>` | D6 naming; the product folder prefix Phase 14 mints per slug (`lib/media/folders.ts`) |
| Asset IDs `PRODUCT-HERO-NNN` / `PRODUCT-SCENE-NNN` | The planned-asset form; never a manifest family prefix (`scripts/media/check-asset-ids.py`) |

**What is deliberately not here.** Category heroes and journal covers — the library already binds
them (`content/seed/media-bindings.ts`), and D6 forbids regenerating what the manifest holds. The
homepage hero and the large-format cards are the Phase 43 gap briefs G1–G12 in
`HIGGSFIELD_MASTER_ASSET_PLAN.md` §6 (G5 held). Portfolio projects and testimonials are DRAFT
placeholders behind the evidence gates and get no imagery. Brand marks are owner-supplied.

**How to use an entry.** Paste the *Prompt* into ChatGPT (image generation), set the ratio and size
the entry states, keep the *Negative requirements* in the prompt, save the result under *Filename*,
upload it to the Cloudinary folder in *Exact placement*, then replace `TO_BE_PROVIDED` with the
delivered URL and `WAITING_FOR_UPLOAD` with `UPLOADED`. The intake script does the rest.

## Index

| Asset ID | Product | Ratio | Placement |
|---|---|---|---|
| `PRODUCT-HERO-001` | Live-Edge Dining Table, River Channel (`live-edge-dining-table-river-channel`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-002` | Dining Table, Full-Pour Surface (`dining-table-full-pour-surface`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-003` | Coffee Table, Shallow Basin (`coffee-table-shallow-basin`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-004` | Centre Table, Circular Pour (`centre-table-circular-pour`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-005` | Console Table, Narrow Span (`console-table-narrow-span`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-006` | Console Table, Sculptural Base (`console-table-sculptural-base`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-007` | Desk, Single Slab (`desk-single-slab`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-008` | Side Tables, Matched Pair (`side-table-pair`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-009` | Bench, Entryway (`bench-entryway`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-010` | Monumental Table, Long Span (`monumental-table-long-span`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-011` | Wall Panel, Horizon Band (`wall-panel-horizon-band`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-012` | Wall Panel, Vertical Drop (`wall-panel-vertical-drop`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-013` | Wall Triptych, Sequence (`wall-triptych-sequence`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-014` | Wall Relief, Layered Depth (`wall-relief-layered-depth`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-015` | Wall Piece, Circular Format (`wall-piece-circular-format`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-016` | Lattice Object, 3D + Resin (`three-d-form-lattice-object`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-017` | Parametric Vessel (`three-d-form-parametric-vessel`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-018` | Desk Object, Fabricated Form (`three-d-form-desk-object`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-019` | Architectural Study, Cast (`three-d-form-architectural-model`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-020` | Varmala Preservation, Framed (`preservation-varmala-frame`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-021` | Varmala Preservation, Solid Block (`preservation-varmala-block`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-022` | Keepsake, Small Format (`preservation-keepsake-small-format`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-023` | Keepsake Set (`preservation-keepsake-set`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-024` | Form Study I (`collectible-form-study-one`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-025` | Form Study II (`collectible-form-study-two`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-026` | Material Panel (`collectible-material-panel`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-027` | Form Study III (`collectible-form-study-three`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-028` | Serving Tray (`decor-tray-serving`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-029` | Coaster Set (`decor-coaster-set`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-030` | Catch-All Bowl (`decor-catch-all-bowl`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-031` | Bookends, Matched Pair (`decor-bookends-pair`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-032` | Desk Piece (`gift-desk-piece`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-033` | Paperweight (`gift-paperweight`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-034` | Ring Dish (`gift-ring-dish`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-HERO-035` | Keepsake Box (`gift-keepsake-box`) | 4:5 | `products.hero_media_id` |
| `PRODUCT-SCENE-001` | Live-Edge Dining Table, River Channel (`live-edge-dining-table-river-channel`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-002` | Dining Table, Full-Pour Surface (`dining-table-full-pour-surface`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-003` | Coffee Table, Shallow Basin (`coffee-table-shallow-basin`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-004` | Centre Table, Circular Pour (`centre-table-circular-pour`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-005` | Console Table, Narrow Span (`console-table-narrow-span`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-006` | Console Table, Sculptural Base (`console-table-sculptural-base`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-007` | Desk, Single Slab (`desk-single-slab`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-008` | Side Tables, Matched Pair (`side-table-pair`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-009` | Bench, Entryway (`bench-entryway`) | 16:9 | `product_media` role `gallery` |
| `PRODUCT-SCENE-010` | Monumental Table, Long Span (`monumental-table-long-span`) | 16:9 | `product_media` role `gallery` |

35 product heroes and 10 room scenes: 45 entries.

## Product heroes — 4:5, one per demo product

The hero is the image the product page and every card lead with. Furniture and wall pieces are
shown as a finished piece in a quiet room (Recipe B); objects are shown as a still life on the
library's seasoned dark teak tabletop or matte charcoal stone ground (Recipe A), so they sit beside
the existing macros without a visible seam.

### PRODUCT-HERO-001 · Live-Edge Dining Table, River Channel — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-001` |
| Asset name | Live-Edge Dining Table, River Channel — hero |
| Required for | Product page hero and every product card for `live-edge-dining-table-river-channel` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-001-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `live-edge-dining-table-river-channel`; Cloudinary folder `rivya/product/live-edge-dining-table-river-channel`; public ID `rivya/product/live-edge-dining-table-river-channel/product-hero-001-4x5` |
| Purpose | Concept visualisation of “Live-Edge Dining Table, River Channel”: A dining table built around one continuous resin channel between two live edges. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a long live-edge dining table seen from a low three-quarter angle, one continuous channel of deep sapphire-to-ocean translucent resin running the full length between two dark timber edges, the room behind it dim and out of focus, the upper third of the frame calm and near-empty. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-002 · Dining Table, Full-Pour Surface — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-002` |
| Asset name | Dining Table, Full-Pour Surface — hero |
| Required for | Product page hero and every product card for `dining-table-full-pour-surface` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-002-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `dining-table-full-pour-surface`; Cloudinary folder `rivya/product/dining-table-full-pour-surface`; public ID `rivya/product/dining-table-full-pour-surface/product-hero-002-4x5` |
| Purpose | Concept visualisation of “Dining Table, Full-Pour Surface”: A dining surface where the resin surrounds the timber rather than sitting beside it. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a dining table whose entire top is one deep pour of ocean-blue resin with a single dark timber slab suspended inside it, light entering from one side so the depth reads through the surface, quiet room behind. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-003 · Coffee Table, Shallow Basin — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-003` |
| Asset name | Coffee Table, Shallow Basin — hero |
| Required for | Product page hero and every product card for `coffee-table-shallow-basin` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-003-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `coffee-table-shallow-basin`; Cloudinary folder `rivya/product/coffee-table-shallow-basin`; public ID `rivya/product/coffee-table-shallow-basin/product-hero-003-4x5` |
| Purpose | Concept visualisation of “Coffee Table, Shallow Basin”: A coffee table designed for the view straight down onto it. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait shot from directly above at a slight tilt, a low coffee table whose surface is a shallow basin of translucent sapphire resin over dark timber, movement and depth concentrated at the centre where the eye lands, low sofa edge softly out of focus. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-004 · Centre Table, Circular Pour — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-004` |
| Asset name | Centre Table, Circular Pour — hero |
| Required for | Product page hero and every product card for `centre-table-circular-pour` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-004-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `centre-table-circular-pour`; Cloudinary folder `rivya/product/centre-table-circular-pour`; public ID `rivya/product/centre-table-circular-pour/product-hero-004-4x5` |
| Purpose | Concept visualisation of “Centre Table, Circular Pour”: A circular centre table for a seating arrangement approached from every side. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a round centre table with a single circular pour of deep ocean resin and dark timber read from a seated height, no front edge, a calm sitting room dissolving into shadow around it. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-005 · Console Table, Narrow Span — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-005` |
| Asset name | Console Table, Narrow Span — hero |
| Required for | Product page hero and every product card for `console-table-narrow-span` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-005-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `console-table-narrow-span`; Cloudinary folder `rivya/product/console-table-narrow-span`; public ID `rivya/product/console-table-narrow-span/product-hero-005-4x5` |
| Purpose | Concept visualisation of “Console Table, Narrow Span”: A long, shallow console developed for a specific wall. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a long shallow console table against a plain plaster wall in a hallway, one narrow band of sapphire resin set into dark timber along its length, a single soft window light from the left, generous empty wall above. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-006 · Console Table, Sculptural Base — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-006` |
| Asset name | Console Table, Sculptural Base — hero |
| Required for | Product page hero and every product card for `console-table-sculptural-base` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-006-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `console-table-sculptural-base`; Cloudinary folder `rivya/product/console-table-sculptural-base`; public ID `rivya/product/console-table-sculptural-base/product-hero-006-4x5` |
| Purpose | Concept visualisation of “Console Table, Sculptural Base”: A console where the base is developed as part of the composition, not as support. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a console whose sculpted timber base is the subject — a folded, carved form carrying a thin dark top with a thread of champagne-gold resin — against a deep ocean wall, one soft key light. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-007 · Desk, Single Slab — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-007` |
| Asset name | Desk, Single Slab — hero |
| Required for | Product page hero and every product card for `desk-single-slab` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-007-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `desk-single-slab`; Cloudinary folder `rivya/product/desk-single-slab`; public ID `rivya/product/desk-single-slab/product-hero-007-4x5` |
| Purpose | Concept visualisation of “Desk, Single Slab”: A desk built from a single slab, with resin used to stabilise rather than decorate. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a writing desk made from one continuous dark timber slab, resin used only to fill and stabilise a natural void near one edge, a quiet study with a single window, nothing on the desk. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-008 · Side Tables, Matched Pair — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-008` |
| Asset name | Side Tables, Matched Pair — hero |
| Required for | Product page hero and every product card for `side-table-pair` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-008-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `side-table-pair`; Cloudinary folder `rivya/product/side-table-pair`; public ID `rivya/product/side-table-pair/product-hero-008-4x5` |
| Purpose | Concept visualisation of “Side Tables, Matched Pair”: A pair of side tables cut and cast so the two tops relate to each other. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, two matching small side tables set a hand's width apart so the timber grain continues from one top to the other across a thin line of sapphire resin, a low armchair edge out of focus behind. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-009 · Bench, Entryway — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-009` |
| Asset name | Bench, Entryway — hero |
| Required for | Product page hero and every product card for `bench-entryway` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-009-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `bench-entryway`; Cloudinary folder `rivya/product/bench-entryway`; public ID `rivya/product/bench-entryway/product-hero-009-4x5` |
| Purpose | Concept visualisation of “Bench, Entryway”: A bench developed for the narrow proportion and hard use of an entrance. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a long low entryway bench in dark timber with a shallow resin channel along its seat, read standing up from the doorway, plaster wall and a slice of floor, morning light from one side. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-010 · Monumental Table, Long Span — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-010` |
| Asset name | Monumental Table, Long Span — hero |
| Required for | Product page hero and every product card for `monumental-table-long-span` (Furniture) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-010-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `monumental-table-long-span`; Cloudinary folder `rivya/product/monumental-table-long-span`; public ID `rivya/product/monumental-table-long-span/product-hero-010-4x5` |
| Purpose | Concept visualisation of “Monumental Table, Long Span”: A table at architectural scale, developed with the room rather than for it. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a monumental dining table at architectural scale in a double-height room, a single dark timber top of extraordinary length with one deep ocean resin seam, tall diffuse daylight from above, the room built around it. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-011 · Wall Panel, Horizon Band — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-011` |
| Asset name | Wall Panel, Horizon Band — hero |
| Required for | Product page hero and every product card for `wall-panel-horizon-band` (Wall Statement Art) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-011-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `wall-panel-horizon-band`; Cloudinary folder `rivya/product/wall-panel-horizon-band`; public ID `rivya/product/wall-panel-horizon-band/product-hero-011-4x5` |
| Purpose | Concept visualisation of “Wall Panel, Horizon Band”: A wall panel built around one horizontal band of colour and depth. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a large wall panel hung at eye line in a dim room, one horizontal band of translucent sapphire resin crossing a dark matte ground from edge to edge, raking light from the left, the wall around it calm and empty. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-012 · Wall Panel, Vertical Drop — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-012` |
| Asset name | Wall Panel, Vertical Drop — hero |
| Required for | Product page hero and every product card for `wall-panel-vertical-drop` (Wall Statement Art) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-012-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `wall-panel-vertical-drop`; Cloudinary folder `rivya/product/wall-panel-vertical-drop`; public ID `rivya/product/wall-panel-vertical-drop/product-hero-012-4x5` |
| Purpose | Concept visualisation of “Wall Panel, Vertical Drop”: A vertical panel developed for a wall with more height than width. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a tall narrow wall panel in a stairwell, a single vertical drop of deep ocean resin falling through a dark ground, read from top to bottom, one soft light from above. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-013 · Wall Triptych, Sequence — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-013` |
| Asset name | Wall Triptych, Sequence — hero |
| Required for | Product page hero and every product card for `wall-triptych-sequence` (Wall Statement Art) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-013-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `wall-triptych-sequence`; Cloudinary folder `rivya/product/wall-triptych-sequence`; public ID `rivya/product/wall-triptych-sequence/product-hero-013-4x5` |
| Purpose | Concept visualisation of “Wall Triptych, Sequence”: Three panels cast together so the movement continues across the gaps. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, three tall wall panels hung with a hand's width between them, one continuous movement of sapphire resin crossing all three and interrupted by the gaps, a plain dark wall, quiet room. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-014 · Wall Relief, Layered Depth — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-014` |
| Asset name | Wall Relief, Layered Depth — hero |
| Required for | Product page hero and every product card for `wall-relief-layered-depth` (Wall Statement Art) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-014-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `wall-relief-layered-depth`; Cloudinary folder `rivya/product/wall-relief-layered-depth`; public ID `rivya/product/wall-relief-layered-depth/product-hero-014-4x5` |
| Purpose | Concept visualisation of “Wall Relief, Layered Depth”: A relief panel with real depth, developed for a wall that receives changing light. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a wall relief built from layered translucent resin at different depths over dark timber, afternoon light crossing it so the layers cast soft internal shadows, the wall otherwise bare. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-015 · Wall Piece, Circular Format — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-015` |
| Asset name | Wall Piece, Circular Format — hero |
| Required for | Product page hero and every product card for `wall-piece-circular-format` (Wall Statement Art) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-015-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `wall-piece-circular-format`; Cloudinary folder `rivya/product/wall-piece-circular-format`; public ID `rivya/product/wall-piece-circular-format/product-hero-015-4x5` |
| Purpose | Concept visualisation of “Wall Piece, Circular Format”: A circular wall piece for a space that does not want a rectangle. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a large circular wall piece on a plain dark wall, a single deep pour of ocean resin with champagne-gold veining read as one point, no top edge, soft directional light. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-016 · Lattice Object, 3D + Resin — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-016` |
| Asset name | Lattice Object, 3D + Resin — hero |
| Required for | Product page hero and every product card for `three-d-form-lattice-object` (3D Resin) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-016-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `three-d-form-lattice-object`; Cloudinary folder `rivya/product/three-d-form-lattice-object`; public ID `rivya/product/three-d-form-lattice-object/product-hero-016-4x5` |
| Purpose | Concept visualisation of “Lattice Object, 3D + Resin”: An object whose internal geometry is developed digitally and then cast. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a cast resin object holding a fine digitally-printed lattice inside clear-to-sapphire resin, the structure magnified by the material, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-017 · Parametric Vessel — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-017` |
| Asset name | Parametric Vessel — hero |
| Required for | Product page hero and every product card for `three-d-form-parametric-vessel` (3D Resin) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-017-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `three-d-form-parametric-vessel`; Cloudinary folder `rivya/product/three-d-form-parametric-vessel`; public ID `rivya/product/three-d-form-parametric-vessel/product-hero-017-4x5` |
| Purpose | Concept visualisation of “Parametric Vessel”: A vessel whose surface is generated parametrically and finished by hand. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a tall vessel whose surface is a parametric ripple profile, translucent deep ocean resin with a hand-finished matte rim, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-018 · Desk Object, Fabricated Form — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-018` |
| Asset name | Desk Object, Fabricated Form — hero |
| Required for | Product page hero and every product card for `three-d-form-desk-object` (3D Resin) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-018-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `three-d-form-desk-object`; Cloudinary folder `rivya/product/three-d-form-desk-object`; public ID `rivya/product/three-d-form-desk-object/product-hero-018-4x5` |
| Purpose | Concept visualisation of “Desk Object, Fabricated Form”: A desk-scale object built with the same digital-to-cast process as the larger work. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a palm-sized cast object of clear resin with a printed geometric core, read at arm's length, shallow depth of field, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-019 · Architectural Study, Cast — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-019` |
| Asset name | Architectural Study, Cast — hero |
| Required for | Product page hero and every product card for `three-d-form-architectural-model` (3D Resin) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-019-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `three-d-form-architectural-model`; Cloudinary folder `rivya/product/three-d-form-architectural-model`; public ID `rivya/product/three-d-form-architectural-model/product-hero-019-4x5` |
| Purpose | Concept visualisation of “Architectural Study, Cast”: A cast study of an architectural form, developed at model scale. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a matte charcoal stone ground, an architectural study cast as a solid block of translucent ocean resin with a dense internal structure, read as an object not a drawing, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-020 · Varmala Preservation, Framed — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-020` |
| Asset name | Varmala Preservation, Framed — hero |
| Required for | Product page hero and every product card for `preservation-varmala-frame` (Preservation) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-020-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `preservation-varmala-frame`; Cloudinary folder `rivya/product/preservation-varmala-frame`; public ID `rivya/product/preservation-varmala-frame/product-hero-020-4x5` |
| Purpose | Concept visualisation of “Varmala Preservation, Framed”: A wall-mounted preservation of wedding garlands. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait, a framed wall preservation of wedding garland flowers set in clear resin, deep reds and marigold read through the surface, a dark frame on a plain wall, soft directional light, no people, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-021 · Varmala Preservation, Solid Block — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-021` |
| Asset name | Varmala Preservation, Solid Block — hero |
| Required for | Product page hero and every product card for `preservation-varmala-block` (Preservation) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-021-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `preservation-varmala-block`; Cloudinary folder `rivya/product/preservation-varmala-block`; public ID `rivya/product/preservation-varmala-block/product-hero-021-4x5` |
| Purpose | Concept visualisation of “Varmala Preservation, Solid Block”: A preservation cast as a solid object to be held and moved. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a solid clear resin block holding wedding garland flowers, turned slightly so the depth reads, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-022 · Keepsake, Small Format — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-022` |
| Asset name | Keepsake, Small Format — hero |
| Required for | Product page hero and every product card for `preservation-keepsake-small-format` (Preservation) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-022-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `preservation-keepsake-small-format`; Cloudinary folder `rivya/product/preservation-keepsake-small-format`; public ID `rivya/product/preservation-keepsake-small-format/product-hero-022-4x5` |
| Purpose | Concept visualisation of “Keepsake, Small Format”: A small-format preservation for one flower, one fragment, one moment. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a matte charcoal stone ground, a single small clear resin keepsake holding one flower, shallow depth of field, generous empty ground around it, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-023 · Keepsake Set — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-023` |
| Asset name | Keepsake Set — hero |
| Required for | Product page hero and every product card for `preservation-keepsake-set` (Preservation) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-023-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `preservation-keepsake-set`; Cloudinary folder `rivya/product/preservation-keepsake-set`; public ID `rivya/product/preservation-keepsake-set/product-hero-023-4x5` |
| Purpose | Concept visualisation of “Keepsake Set”: A set of small preservations made from one occasion. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, four small matching clear resin keepsakes from one set of flowers arranged in a loose row, read as a group, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-024 · Form Study I — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-024` |
| Asset name | Form Study I — hero |
| Required for | Product page hero and every product card for `collectible-form-study-one` (Collectible Design) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-024-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `collectible-form-study-one`; Cloudinary folder `rivya/product/collectible-form-study-one`; public ID `rivya/product/collectible-form-study-one/product-hero-024-4x5` |
| Purpose | Concept visualisation of “Form Study I”: A studio study, made to test a direction rather than to answer a commission. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a matte charcoal stone ground, a flat studio study of dark timber and deep ocean resin read from above, the movement inside the pour the subject, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-025 · Form Study II — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-025` |
| Asset name | Form Study II — hero |
| Required for | Product page hero and every product card for `collectible-form-study-two` (Collectible Design) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-025-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `collectible-form-study-two`; Cloudinary folder `rivya/product/collectible-form-study-two`; public ID `rivya/product/collectible-form-study-two/product-hero-025-4x5` |
| Purpose | Concept visualisation of “Form Study II”: A companion study, developed from the same starting point in a different direction. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a matte charcoal stone ground, a companion studio study of dark timber and sapphire resin taken in a different direction, read from above, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-026 · Material Panel — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-026` |
| Asset name | Material Panel — hero |
| Required for | Product page hero and every product card for `collectible-material-panel` (Collectible Design) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-026-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `collectible-material-panel`; Cloudinary folder `rivya/product/collectible-material-panel`; public ID `rivya/product/collectible-material-panel/product-hero-026-4x5` |
| Purpose | Concept visualisation of “Material Panel”: A panel developed to show what the material does at close range. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 tight editorial portrait macro, a material panel where dark timber meets deep ocean resin, the meeting line and the movement inside the pour filling the frame, matte finish, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-027 · Form Study III — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-027` |
| Asset name | Form Study III — hero |
| Required for | Product page hero and every product card for `collectible-form-study-three` (Collectible Design) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-027-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `collectible-form-study-three`; Cloudinary folder `rivya/product/collectible-form-study-three`; public ID `rivya/product/collectible-form-study-three/product-hero-027-4x5` |
| Purpose | Concept visualisation of “Form Study III”: A third study, turned upright so the pour is read against gravity. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a matte charcoal stone ground, an upright studio study standing on its end so a pour of deep ocean resin is read top to bottom against dark timber, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-028 · Serving Tray — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-028` |
| Asset name | Serving Tray — hero |
| Required for | Product page hero and every product card for `decor-tray-serving` (Decor) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-028-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `decor-tray-serving`; Cloudinary folder `rivya/product/decor-tray-serving`; public ID `rivya/product/decor-tray-serving/product-hero-028-4x5` |
| Purpose | Concept visualisation of “Serving Tray”: A tray developed for daily use rather than for display. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a rectangular serving tray of dark timber with a shallow sapphire resin surface and low timber rim, empty, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-029 · Coaster Set — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-029` |
| Asset name | Coaster Set — hero |
| Required for | Product page hero and every product card for `decor-coaster-set` (Decor) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-029-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `decor-coaster-set`; Cloudinary folder `rivya/product/decor-coaster-set`; public ID `rivya/product/decor-coaster-set/product-hero-029-4x5` |
| Purpose | Concept visualisation of “Coaster Set”: A set of coasters made from material left by a larger piece. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, four round coasters cut from one dark timber and deep ocean resin offcut, stacked loosely, the same colour direction across all four, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-030 · Catch-All Bowl — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-030` |
| Asset name | Catch-All Bowl — hero |
| Required for | Product page hero and every product card for `decor-catch-all-bowl` (Decor) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-030-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `decor-catch-all-bowl`; Cloudinary folder `rivya/product/decor-catch-all-bowl`; public ID `rivya/product/decor-catch-all-bowl/product-hero-030-4x5` |
| Purpose | Concept visualisation of “Catch-All Bowl”: A shallow bowl developed for keys, post and whatever a day leaves by the door. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a shallow catch-all bowl of dark timber with a deep ocean resin composition in its base, empty, seen from slightly above, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-031 · Bookends, Matched Pair — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-031` |
| Asset name | Bookends, Matched Pair — hero |
| Required for | Product page hero and every product card for `decor-bookends-pair` (Decor) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-031-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `decor-bookends-pair`; Cloudinary folder `rivya/product/decor-bookends-pair`; public ID `rivya/product/decor-bookends-pair/product-hero-031-4x5` |
| Purpose | Concept visualisation of “Bookends, Matched Pair”: A pair of bookends cut from a single cast so the two halves belong together. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a pair of solid bookends cut from one block of dark timber and sapphire resin so the movement reads across both, set a book's width apart with nothing between them, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-032 · Desk Piece — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-032` |
| Asset name | Desk Piece — hero |
| Required for | Product page hero and every product card for `gift-desk-piece` (Gifts) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-032-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `gift-desk-piece`; Cloudinary folder `rivya/product/gift-desk-piece`; public ID `rivya/product/gift-desk-piece/product-hero-032-4x5` |
| Purpose | Concept visualisation of “Desk Piece”: A small desk object suitable as a gift. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a small finished desk object of dark timber and deep ocean resin, complete in itself, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-033 · Paperweight — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-033` |
| Asset name | Paperweight — hero |
| Required for | Product page hero and every product card for `gift-paperweight` (Gifts) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-033-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `gift-paperweight`; Cloudinary folder `rivya/product/gift-paperweight`; public ID `rivya/product/gift-paperweight/product-hero-033-4x5` |
| Purpose | Concept visualisation of “Paperweight”: A solid paperweight built around a single internal composition. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a matte charcoal stone ground, a solid domed paperweight of clear resin with a single internal composition of sapphire and champagne-gold veining, read from the side, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-034 · Ring Dish — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-034` |
| Asset name | Ring Dish — hero |
| Required for | Product page hero and every product card for `gift-ring-dish` (Gifts) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-034-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `gift-ring-dish`; Cloudinary folder `rivya/product/gift-ring-dish`; public ID `rivya/product/gift-ring-dish/product-hero-034-4x5` |
| Purpose | Concept visualisation of “Ring Dish”: A shallow dish for a ring, a watch or a pair of earrings at the end of the day. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 tight editorial portrait still life on a seasoned dark teak tabletop, a small shallow ring dish of dark timber with a deep ocean resin surface, empty, read at arm's length, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-HERO-035 · Keepsake Box — hero

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-HERO-035` |
| Asset name | Keepsake Box — hero |
| Required for | Product page hero and every product card for `gift-keepsake-box` (Gifts) |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2048 × 2560 px (long edge ≥ 2560) |
| Ratio | 4:5 |
| Filename | `product-hero-035-4x5.png` |
| Exact placement | `products.hero_media_id` on the product with slug `gift-keepsake-box`; Cloudinary folder `rivya/product/gift-keepsake-box`; public ID `rivya/product/gift-keepsake-box/product-hero-035-4x5` |
| Purpose | Concept visualisation of “Keepsake Box”: A small box whose lid carries the piece and whose body stays plain. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Vertical 4:5 editorial portrait still life on a seasoned dark teak tabletop, a small lidded box with a plain dark timber body and a lid carrying one composition of sapphire resin and champagne-gold veining, closed, no other object in frame, no people, no hands, no finished piece other than the subject — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

## Room scenes — 16:9, one per furniture piece

A second image for the ten furniture pieces: the piece in a room, for the product page gallery and
the wide card the large-format surfaces use. Recipe B throughout; the upper third of the frame is
kept calm so the image survives a headline.

### PRODUCT-SCENE-001 · Live-Edge Dining Table, River Channel — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-001` |
| Asset name | Live-Edge Dining Table, River Channel — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `live-edge-dining-table-river-channel` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-001-16x9.png` |
| Exact placement | `product_media` row for the product with slug `live-edge-dining-table-river-channel`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/live-edge-dining-table-river-channel`; public ID `rivya/product/live-edge-dining-table-river-channel/product-scene-001-16x9` |
| Purpose | Concept visualisation of “Live-Edge Dining Table, River Channel” in a room: A single channel of resin running the length of the top. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a dining room with a long live-edge table carrying one deep sapphire resin channel down its length, six quiet dark chairs, tall diffuse daylight from one window, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-002 · Dining Table, Full-Pour Surface — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-002` |
| Asset name | Dining Table, Full-Pour Surface — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `dining-table-full-pour-surface` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-002-16x9.png` |
| Exact placement | `product_media` row for the product with slug `dining-table-full-pour-surface`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/dining-table-full-pour-surface`; public ID `rivya/product/dining-table-full-pour-surface/product-scene-002-16x9` |
| Purpose | Concept visualisation of “Dining Table, Full-Pour Surface” in a room: Timber suspended within a single continuous pour. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a dining room with a full-pour ocean-blue resin table holding a dark timber slab inside its surface, low evening light raking across the top, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-003 · Coffee Table, Shallow Basin — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-003` |
| Asset name | Coffee Table, Shallow Basin — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `coffee-table-shallow-basin` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-003-16x9.png` |
| Exact placement | `product_media` row for the product with slug `coffee-table-shallow-basin`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/coffee-table-shallow-basin`; public ID `rivya/product/coffee-table-shallow-basin/product-scene-003-16x9` |
| Purpose | Concept visualisation of “Coffee Table, Shallow Basin” in a room: A low table read from above. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a sitting room with a low coffee table of dark timber and shallow sapphire resin between two quiet sofas, soft window light, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-004 · Centre Table, Circular Pour — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-004` |
| Asset name | Centre Table, Circular Pour — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `centre-table-circular-pour` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-004-16x9.png` |
| Exact placement | `product_media` row for the product with slug `centre-table-circular-pour`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/centre-table-circular-pour`; public ID `rivya/product/centre-table-circular-pour/product-scene-004-16x9` |
| Purpose | Concept visualisation of “Centre Table, Circular Pour” in a room: A round top for a room with no obvious front. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a round centre table with a circular deep ocean pour at the middle of a seating arrangement approached from every side, calm lamplight, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-005 · Console Table, Narrow Span — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-005` |
| Asset name | Console Table, Narrow Span — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `console-table-narrow-span` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-005-16x9.png` |
| Exact placement | `product_media` row for the product with slug `console-table-narrow-span`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/console-table-narrow-span`; public ID `rivya/product/console-table-narrow-span/product-scene-005-16x9` |
| Purpose | Concept visualisation of “Console Table, Narrow Span” in a room: For a hallway, a landing or behind a sofa. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a long hallway with a narrow console of dark timber and one sapphire band set against a plaster wall, morning light from the far end, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-006 · Console Table, Sculptural Base — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-006` |
| Asset name | Console Table, Sculptural Base — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `console-table-sculptural-base` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-006-16x9.png` |
| Exact placement | `product_media` row for the product with slug `console-table-sculptural-base`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/console-table-sculptural-base`; public ID `rivya/product/console-table-sculptural-base/product-scene-006-16x9` |
| Purpose | Concept visualisation of “Console Table, Sculptural Base” in a room: The structure carries as much of the idea as the top. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a reception space with a console whose sculpted timber base is the piece, thin dark top with a thread of champagne-gold resin, deep ocean wall behind, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-007 · Desk, Single Slab — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-007` |
| Asset name | Desk, Single Slab — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `desk-single-slab` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-007-16x9.png` |
| Exact placement | `product_media` row for the product with slug `desk-single-slab`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/desk-single-slab`; public ID `rivya/product/desk-single-slab/product-scene-007-16x9` |
| Purpose | Concept visualisation of “Desk, Single Slab” in a room: A working surface with one continuous grain. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a quiet study with a single-slab dark timber desk beneath one tall window, resin filling one natural void near the edge, nothing on the desk, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-008 · Side Tables, Matched Pair — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-008` |
| Asset name | Side Tables, Matched Pair — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `side-table-pair` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-008-16x9.png` |
| Exact placement | `product_media` row for the product with slug `side-table-pair`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/side-table-pair`; public ID `rivya/product/side-table-pair/product-scene-008-16x9` |
| Purpose | Concept visualisation of “Side Tables, Matched Pair” in a room: Two pieces developed together. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, a sitting room with two matching side tables either side of a low armchair, the timber grain continuing across a thin line of sapphire resin, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-009 · Bench, Entryway — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-009` |
| Asset name | Bench, Entryway — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `bench-entryway` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-009-16x9.png` |
| Exact placement | `product_media` row for the product with slug `bench-entryway`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/bench-entryway`; public ID `rivya/product/bench-entryway/product-scene-009-16x9` |
| Purpose | Concept visualisation of “Bench, Entryway” in a room: A seat that is also the first thing seen. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Wide editorial photograph, cinematic wide hero still, an entrance hall with a long low dark timber bench carrying a shallow resin channel, plaster walls, a slice of daylight from the door, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.

### PRODUCT-SCENE-010 · Monumental Table, Long Span — room scene

| Field | Value |
|---|---|
| Asset ID | `PRODUCT-SCENE-010` |
| Asset name | Monumental Table, Long Span — room scene |
| Required for | Product page gallery (first gallery image) and the wide card for `monumental-table-long-span` |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1440 px (long edge ≥ 2560) |
| Ratio | 16:9 |
| Filename | `product-scene-010-16x9.png` |
| Exact placement | `product_media` row for the product with slug `monumental-table-long-span`, role `gallery`, sort_order 10; Cloudinary folder `rivya/product/monumental-table-long-span`; public ID `rivya/product/monumental-table-long-span/product-scene-010-16x9` |
| Purpose | Concept visualisation of “Monumental Table, Long Span” in a room: Large-format work for a room built around it. |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = NOT_REQUIRED` (it asserts nothing), alt text drafted by the owner from the *Purpose* line |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
Ultra-wide architectural editorial photograph reframed to 16:9, a double-height room built around one monumental dark timber table with a single deep ocean resin seam, tall diffuse daylight, monastic calm, generous negative space, the upper third of the frame calm and near-empty as a headline safe area, no people. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. No people, no text, no neon, no heavy gold. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; no material named in any visible label; nothing
that reads as a showroom, a shop or a delivered commission.


---

## Site heroes — Phase 43's only two GENERATE_NEW dispositions

The Phase 43 coverage report resolves **26 declared media slots**: fifteen reuse an existing asset,
six re-crop one, three are honestly empty, and **two** cannot be served by anything in the
250-asset library. Those two are here, and nothing else in this phase earns a brief.

**Why only two.** The phase's central economy is re-crop before regenerate, and it worked: adding
the right manifest families to six slots in `content/media-slots.ts` — `material-macro` to the
collection landing and contact surfaces, `gallery-scene` to collectible design, `interior-lifestyle`
and `process-studio` to commissions, the five `largeformat-*` families to furniture — took the brief
count from ten to two. Marking `/faq` and `/search` as honest empty states removed two more.

**Why these two are genuinely missing.** Zero videos in the manifest carry `page = home`, and the
seven 1920 × 1080 videos that exist are process, macro or gallery subjects. Upscaling a 1280 px
process clip into a full-bleed hero is visibly worse than generating at the right size, and the
poster is the largest-contentful-paint element on the site's most important page.

| Asset ID | Slot | Ratio | Placement |
|---|---|---|---|
| `HOME-HERO-VIDEO-001` | `home.hero.video` | 16:9 | `rivya/home/hero`, family `home-hero-video` |
| `HOME-HERO-POSTER-001` | `home.hero.poster` | 21:9 | `rivya/home/hero`, family `home-hero-poster` |

**The poster must be a frame of the video.** If the two are generated independently the mount
produces a visible jump: the poster shows while the video loads, and a different composition
snapping into place is worse than no poster at all. Generate the video first, export a frame, and
use that frame as the poster — or generate the poster from a still taken out of the video.

### HOME-HERO-VIDEO-001 · Home hero, moving

| Field | Value |
|---|---|
| Asset ID | `HOME-HERO-VIDEO-001` |
| Asset name | Home hero, moving |
| Required for | The `/` hero. It is the first thing anybody sees of Rivya |
| File type | MP4, H.264, no audio track |
| Dimensions (minimum) | 1920 × 1080 px; 2560 × 1440 preferred |
| Ratio | 16:9 |
| Duration | 6–10 seconds, seamless loop |
| Filename | `home-hero-video-001-16x9.mp4` |
| Exact placement | Slot `home.hero.video` on `/`; Cloudinary folder `rivya/home/hero`; public ID `rivya/home/hero/home-hero-video-001-16x9` |
| Manifest family | `home-hero-video` — the planned ID prefix, lower-cased, so the Python builder mints exactly `HOME-HERO-VIDEO-001` (D6 amendment A1) |
| Purpose | Concept visualisation: a large resin-and-timber table in a quiet room, with one slow movement — light travelling across the resin — and nothing else |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = OWNER_VERIFICATION_REQUIRED` |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
A slow six-second locked-off shot of a long resin-and-timber table in a quiet, dim room, one continuous channel of deep sapphire-to-ocean translucent resin running between two dark timber edges; the only movement is daylight travelling slowly across the resin surface from left to right, so the channel brightens and settles. The room stays still: no people, no hands, no objects moved, no camera motion. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic. Seamless loop: the last frame must match the first. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial realism; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

No price tag, ruler, tape measure or dimension cue; nothing that reads as a showroom, a shop or a
delivered commission; no visible brand mark of any kind.

### HOME-HERO-POSTER-001 · Home hero, still

| Field | Value |
|---|---|
| Asset ID | `HOME-HERO-POSTER-001` |
| Asset name | Home hero, still |
| Required for | The `/` hero poster — the largest-contentful-paint element on the site's most important page |
| File type | PNG (or JPEG at quality 92+), sRGB |
| Dimensions (minimum) | 2560 × 1097 px (21:9, long edge ≥ 2560) |
| Ratio | 21:9 |
| Filename | `home-hero-poster-001-21x9.png` |
| Exact placement | Slot `home.hero.poster` on `/`; Cloudinary folder `rivya/home/hero`; public ID `rivya/home/hero/home-hero-poster-001-21x9` |
| Manifest family | `home-hero-poster` — the planned ID prefix, lower-cased, so the builder mints exactly `HOME-HERO-POSTER-001` |
| Purpose | The still behind the hero video while it loads, and the whole hero for anybody whose browser or preference refuses the video |
| Provenance flags at intake | `is_ai_generated = true`, `is_concept = true`, `owner_verification = OWNER_VERIFICATION_REQUIRED` |
| Cloudinary Status | WAITING_FOR_UPLOAD |
| Cloudinary URL | TO_BE_PROVIDED |

**Prompt**

```
An ultra-wide 21:9 still of a long resin-and-timber table in a quiet, dim room, one continuous channel of deep sapphire-to-ocean translucent resin running the full length between two dark timber edges, seen from a low three-quarter angle; the left two-thirds of the frame carries the table and the right third is calm, near-empty room, so a headline can sit over it. This must be the same room, table and light as HOME-HERO-VIDEO-001 — ideally a frame taken out of it. Quiet luxury, deep ocean, obsidian, sapphire and muted champagne gold, photorealistic timber and resin, resin like deep glass never plastic, realistic proportions. — palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen; cool shadows; editorial product-photography realism; no text, no logos, no watermarks, no faces. Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

**Negative requirements** (`RIVYA-NEG-V2`, verbatim, in the prompt)

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade, HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible brand marks, price tags or labels, showroom or retail signage, recognisable human faces, award or certification badges.
```

The right third must stay quiet: a headline and a call to action are rendered over it in the page,
and a busy right edge makes the type unreadable at every width. No price tag, ruler or dimension
cue; nothing that reads as a showroom or a delivered commission.

### Mobile

Neither brief has a mobile variant, and that is a decision rather than an omission.
`home.hero.poster`'s mobile ratio is 9:16 and `LARGEFORMAT-DINING-001` (1536 × 2752, prompted "for
a mobile hero") already serves it — the coverage report reads the slot as re-croppable for exactly
that reason. `HeroMotion` does not mount below 768 px at all, so there is no mobile video slot to
fill.

### After the images exist

```
npm run media:register-external -- \
  --asset-id=HOME-HERO-POSTER-001 \
  --url='<the Cloudinary URL>' \
  --folder=rivya/home/hero \
  --alt='<one sentence describing what the picture shows>' \
  --apply
```

It refuses a URL outside this project's own Cloudinary cloud, registers the row as
`is_ai_generated = true, is_concept = true`, and leaves it DRAFT for an editor to bind and to write
real alt text against while the picture is in front of them.

---

*Generated once from `scripts/demo/content.ts` on 2026-09-11 (Phase 35b) and maintained by hand from
here: the owner edits the two status lines of each entry, and a later phase appends entries for new
placeholders. Regenerating this file would erase the URLs pasted into it.*
