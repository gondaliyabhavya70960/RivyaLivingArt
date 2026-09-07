# HIGGSFIELD GUIDE — how the AI media workflow is used

> **Standing.** Hand-written. Binding contract: `CANONICAL-DECISIONS.md` §D6.
> Facts about the library come from `data/higgsfield/asset-manifest.json`.
> Plan: `HIGGSFIELD_MASTER_ASSET_PLAN.md`. Ledger: `HIGGSFIELD_ASSET_STATUS.md`.
> Delivery: `CLOUDINARY.md`. Model and rendering: `MEDIA_GUIDE.md`.
>
> This guide is for the person who is about to write a prompt, review an image, or bind an asset
> to a page. It answers four questions: *may I generate at all*, *what does a Rivya prompt look
> like*, *who approves it*, and *what may this image never be used to say*.

---

## 1. The rule that comes before every other rule

**AI concept media is never presented as completed, delivered Rivya work.**

Manifest `policy.rules[0]`, SEED §40, D10. Every one of the 250 assets carries
`is_ai_generated = true` and `is_concept = true`, and every one is
`OWNER_VERIFICATION_REQUIRED`. That is not decoration on the row; it is the reason the row is
allowed to exist.

What follows from it, concretely:

| Never | Because |
|---|---|
| Attach a concept asset to a product | The image would be product photography of a product that does not exist. The `product_media` trigger rejects `is_concept = true` outright |
| Attach a concept asset to a portfolio project | The image would assert a delivered project (D10). Portfolio stays an empty state |
| Write a caption naming a price, dimension, material specification, lead time, client or project | Those are business facts. A picture cannot verify them |
| Say "our workshop", "our table", "a piece we made" beside a concept image | The image shows a rendered concept, not a Rivya object |
| Generate a logo, wordmark, favicon, or brand OG card | An identity mark is a fact about the business |
| Generate a 3D model | A model carries dimensions and form — that is a product specification |
| Generate product photography | Same |

What is allowed, and is the whole point of the library: **material, process, atmosphere and
category storytelling.** Resin behaving like resin. A bench with tools on it. A wide abstract
band of colour behind a headline. Those describe a practice, not an inventory.

Every Studio surface that lists these assets carries the banner:

> *Concept media. Never presented as completed, delivered Rivya work.*

---

## 2. House prompt grammar

The grammar below is **extracted from the 250 prompts that already exist**, not invented. Counts
are exact. When you write a new brief, pick the recipe the target family already uses — mixing
recipes inside one section is visible on the page, because the three image recipes have three
different colour temperaments.

### 2.0 The palette, as the prompts actually name it

| Token | Hex | Named in | Design-system token |
|---|---|---|---|
| deep ocean | `#08283A` | 114 prompts | `--rv-color-ocean` |
| obsidian | `#080A0E` | 114 prompts | `--rv-color-obsidian` |
| sapphire | `#164E6B` | 114 prompts | `--rv-color-sapphire` |
| muted champagne gold | `#B89B63` | 114 prompts | `--rv-color-champagne` |
| metallic gold | `#D4AF37` | 70 prompts | `--rv-ink-accent` (dark scheme) |
| royal / sapphire bright | `#0F52BA` | 61 prompts | `--rv-color-sapphire-bright` |
| ocean (blog variant) | `#0E3A53` | 61 prompts | — |
| midnight | `#0A1A2F` | 9 prompts | — |
| electric blue | `#1E4FD8` | 3 prompts | — |
| ivory | `#FAF9F5` | 2 prompts | `--rv-color-bone` |

The four-token core (`#08283A`, `#080A0E`, `#164E6B`, `#B89B63`) is the canonical Rivya palette
and is what `docs/design/DESIGN_SYSTEM.md` builds its primitives from. **New briefs use the
four-token core.** The `#0E3A53`/`#0F52BA`/`#D4AF37` and `#0A1A2F`/`#1E4FD8` sets are earlier
sessions kept for provenance; do not start a new asset in them.

### 2.1 Recipe A — workshop / studio grammar · **114 assets** · use for all new briefs

The strictest and most consistent recipe in the library. Structure:

```
<SUBJECT: one concrete scene, stated in plain nouns and verbs>,
<EXPLICIT EXCLUSION: what must NOT be in frame, e.g. "no finished piece in frame", "no people">
— palette limited to deep ocean #08283A, obsidian #080A0E, sapphire #164E6B and muted champagne
gold #B89B63; single soft directional key with warm rim fill; matte surfaces, no plastic sheen;
cool shadows; editorial product-photography realism; shallow depth of field; no text, no logos,
no watermarks, no faces.
```

The clause after the em dash is **fixed text**. Copy it; never paraphrase it. It is the single
strongest reason the library reads as one library.

46 of the 114 add the explicit negative block (§3) after it. **All new briefs add it.**

Series variants — used where several frames must tile or sit in one row — open with a
session-continuity preamble, then a `Frame:` clause:

```
One of four material macros shot on an identical matte charcoal-neutral stone ground under
identical light, same magnification, same lens, same framing, so the four tile together as one
set. Frame: <this frame's subject> — <fixed palette clause>
```

```
One frame from a six-part collection series, all shot in a single session on the same seasoned
dark teak tabletop, same single soft directional key from upper left with a warm champagne rim,
same camera height, same lens, same cool shadow falloff. Frame: <this frame's subject> —
<fixed palette clause>
```

Real examples in this recipe: `PROCESS-STUDIO-001`, `MATERIAL-MACRO-016…022`,
`THREE-D-RESIN-001`, `WALL-ART-008`, `PRESERVATION-VARMALA-001`, `WORKSHOP-SESSION-002`,
`LARGEFORMAT-SEATING-001`.

### 2.2 Recipe B — editorial interior grammar · **20 assets** · use for interiors and heroes

Used for every finished-piece-in-a-room photograph in the library. Structure:

```
<ORIENTATION AND FRAMING> <ROOM STYLE>, editorial photograph: <SUBJECT> <in/against
ARCHITECTURAL CONTEXT>, <LIGHT>, <NEGATIVE-SPACE INSTRUCTION>.
Quiet luxury, <palette words>, photorealistic <materials>, resin like deep glass never plastic,
realistic proportions. No people, no text, no neon, no heavy gold.
```

The closing sentence pair is near-fixed. The eighteen variants of it differ only in which nouns
they list. Note the two clauses that do real work and must survive editing:

- **`resin like deep glass never plastic`** — without it the model produces toy-shine acrylic.
- **`generous negative space` / `the upper third of the frame calm and near-empty as headline
  safe area`** — this is what makes an image usable behind a headline. Every hero brief states it.

Real examples: `LARGEFORMAT-DINING-002`, `LARGEFORMAT-MONUMENTAL-001`, `INTERIOR-LIFESTYLE-002`,
`MATERIAL-MACRO-009`, `LARGEFORMAT-COFFEE-001`.

### 2.3 Recipe C — journal / blog grammar · **61 assets** · legacy, do not extend

```
<SUBJECT, one sentence>. Photorealistic editorial photography for a luxury handcrafted resin-art
studio blog, deep ocean-blue resin tones (#0e3a53, #0f52ba) with metallic gold (#d4af37) accents,
soft studio light, shallow depth of field, premium Indian craft context, no text, no watermark.
```

55 assets use exactly this tail; 6 more use a product-photography sibling of it. It runs warmer
and more gold than the four-token core and produces the library's `2048 × 1152` tier. It is a
perfectly good recipe and its output is in use — but new briefs use Recipe A or B so the site
converges rather than diverges. Real examples: `THREE-D-RESIN-006…013`, `GIFTS-004…010`,
`EDITORIAL-011…016`, `LARGEFORMAT-DINING-003`.

### 2.4 Recipe E — midnight film-still grammar · **9 assets** · legacy, do not extend

Lower-case, comma-chained, `#0A1A2F` midnight ground with `#D4AF37` gold flake and `#FAF9F5`
ivory highlights, "luxury product film still", explicit "dark negative space on the left half for
headline text". Real examples: `PROCESS-POUR-007`, `PRESERVATION-VARMALA-007…009`, `DECOR-009`,
`-010`, `MATERIAL-MACRO-024`, `-025`, `PROCESS-STUDIO-009`.

### 2.5 Loose atelier prose · **20 assets** · unformalised

Twenty images sit in none of the four: single-sentence prose ending in a mood word and an ad-hoc
negative (`no text, no people` / `no faces, no text`). They are good pictures with no reusable
grammar. Real examples: `GALLERY-SCENE-002`, `-003`, `WALL-ART-017`, `PROCESS-PIGMENT-005…007`,
`PROCESS-STUDIO-010…012`, `MATERIAL-MACRO-026…028`, `DECOR-011`, `PROCESS-FINISH-006`,
`PROCESS-MOULD-011`, `THREE-D-RESIN-005`. **Do not use this as a template.** Anything worth
keeping from it belongs in Recipe A or B.

### 2.6 Video grammar · **26 assets**

```
<CAMERA MOVE or "Extreme macro" / "Extreme slow-motion macro">: <SUBJECT>, <LIGHT>,
<SAFE-AREA INSTRUCTION if it is a hero>. Loopable. | Seamless loop. | seamless <n>s loop.
```

Rules the existing videos observe, and every new one must:

| Rule | Evidence |
|---|---|
| One move only — a dolly, a push-in, a rise, or locked-off | Every 26 prompts name at most one move |
| 5–10 s | Durations are 5 s ×5, 6 s ×15, 8 s ×4, 10 s ×2 |
| Loopable, stated in the prompt | 14 of 26 say `Loopable` / `Seamless loop` outright |
| No faces, hands only where people appear | `PROCESS-STUDIO-001`: "craftsman's hands only, no face" |
| Vertical variants declare the safe area | `PROCESS-PIGMENT-002`: "upper third calm and dark as headline safe area" |
| No audio is briefed, ever | The site plays every inline video muted |

**Six video prompts in the library are bookkeeping stubs, not briefs.** Three pairs, each a
lower-resolution re-render of an earlier clip, carry a one-line label instead of a prompt:

| Pair | Stub text |
|---|---|
| `PROCESS-STUDIO-002` / `-003` | `Workshop bench dolly (720p variant 2)` / `(720p variant)` |
| `MATERIAL-MACRO-001` / `-006` | `Gold leaf settling on sapphire resin (720p variant 2)` / `(720p variant)` |
| `EDITORIAL-002` / `-003` | `Sapphire resin pour, high angle (720p variant 2)` / `(720p variant)` |

Treat their `higgsfield_prompt` as provenance, not as a model to copy — and note that all six are
1280 × 720, which is below the 1920 × 1080 a hero video needs.

### 2.7 Ratio discipline in the prompt itself

Ask for the ratio in the prompt, not only in the generation parameters. The library's own
prompts do this and it visibly improves composition:

| Ratio | Phrase used in the library |
|---|---|
| 21:9 | `Ultra-wide architectural editorial photograph` · `Ultra-wide abstract macro` |
| 9:16 | `Vertical editorial photograph for a mobile hero` · `Vertical macro for mobile` |
| 4:5 | `editorial portrait` · `Atmospheric macro, portrait` |
| 3:4 | `Vertical still life` |
| 1:1 | `A tight square macro` · `Square atmospheric still life` |
| 16:9 | `cinematic wide hero still` · `Close editorial photograph` |

Only the eight D6 ratios exist: `21:9 · 16:9 · 4:3 · 3:2 · 1:1 · 4:5 · 3:4 · 9:16`.
Desktop and mobile are separate CMS slots and, for heroes, separate generations — a 21:9 hero
cropped to 9:16 is not a mobile hero, it is a mistake with the right dimensions.

Minimum long edge by target preset, so a brief never produces an asset that cannot fill its slot:

| Slot | Preset | Minimum long edge to brief |
|---|---|---|
| Full-bleed page hero | `hero-xl` `w_2560` | **2560 px** — target 6336 px to match the library's 21:9 masters |
| Section hero / band | `hero` `w_1600` | **1600 px** |
| Gallery grid | `grid` `w_768` | **768 px** |
| Card | `card` `w_480` | **480 px** |
| Video hero | — | **1920 × 1080** |

---

## 3. Negative-prompt boilerplate

### 3.1 `RIVYA-NEG-V1` — the existing block, verbatim in 46 assets

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade,
HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background.
```

### 3.2 `RIVYA-NEG-V2` — V1 plus five content-integrity exclusions. **Use V2 for every new brief.**

```
Exclude entirely: text, watermark, signature, logo, plastic toy sheen, teal-orange grade,
HDR halo, extra fingers, glitter overload, stock-photo smile, cluttered background, visible
brand marks, price tags or labels, showroom or retail signage, recognisable human faces,
award or certification badges.
```

Why each of the five additions exists:

| Addition | The failure it prevents |
|---|---|
| visible brand marks | An invented mark on a Rivya-adjacent object reads as Rivya's identity |
| price tags or labels | A number in a picture is a price claim (D10) |
| showroom or retail signage | Implies a retail presence that has not been verified |
| recognisable human faces | Identifiable people in synthetic media are an unresolved rights problem |
| award or certification badges | Fabricated credentials — explicitly forbidden by FEAT §38 and D10 |

The four-token palette clause in Recipe A already carries inline negatives
(`no text, no logos, no watermarks, no faces`). V2 is additional, not a replacement — the model
weights inline and trailing exclusions differently and both earn their place.

### 3.3 Per-subject exclusions that must be stated in the positive prompt

The library does this and it works better than a trailing negative:

- `no finished piece in frame` — for making and process subjects
- `no legs or frame attached, no finished chair anywhere in shot` — `LARGEFORMAT-SEATING-001`
- `entirely abstract — no horizon features, no sun disc, no literal scenery` — `WALL-ART-008`
- `framed from chest height downward so every face is out of frame above the top edge` — `WORKSHOP-SESSION-002`
- `shot close enough that no edge of the panel is visible` — `MATERIAL-MACRO-006`

---

## 4. Before you generate anything: the gate

D6's priority ladder is not advisory. Answer all four, in order, in writing, on the slot's row in
`HIGGSFIELD_MASTER_ASSET_PLAN.md` §4 or §6.

```
Q1  Is there real Rivya media for this slot?                          yes → bind it, stop
Q2  Is there an approved owner-supplied asset?                        yes → bind it, stop
Q3  Is there a manifest asset whose SUBJECT and RATIO fit?            yes → REUSE_FROM_FAMILY, stop
Q4  Can a manifest asset be re-cropped to the ratio without
    destroying its subject, and still meet the preset width?          yes → RECROP_EXISTING, stop
    all four no                                                            → GENERATE_NEW
    nothing honest to show                                                 → LEAVE_EMPTY
```

Then, and only then:

```
1.  Write the brief into HIGGSFIELD_MASTER_ASSET_PLAN.md §6.1 — target ID, family, page,
    section, slot key and role, desktop and mobile ratio, minimum long edge, Cloudinary folder
    and public ID, filename, prompt, RIVYA-NEG-V2, draft alt text, and the four gate answers.
2.  npm run media:assert-no-regen        # fails if the target already exists. CI runs it too.
3.  Generate.
4.  scripts/media/build-higgsfield-manifest.py appends the new rows and bumps manifest_version
    to rivya-hf-v2. The original 250 objects stay byte-identical.
5.  npm run manifest:verify              # proves step 4 changed nothing it should not have.
6.  npm run media:migrate:higgsfield     # Cloudinary + media_assets, is_ai_generated = true,
                                         # is_concept = true, OWNER_VERIFICATION_REQUIRED.
7.  An editor writes real alt text (§6) and binds the slot.
```

**Never** regenerate anything already in the manifest. That is the one prohibition with a script
behind it, a CI gate behind the script, and no override.

---

## 5. Review and approval

Four gates. An asset that fails any of them is not bound; it is not "fixed" by regenerating.

### Gate 1 — Technical (the migration script, automatic)

| Check | Fail action |
|---|---|
| Aspect ratio is one of D6's eight | Reject the upload |
| Long edge meets the target slot's preset width | Report as a gap, do not bind |
| Video is 5–10 s and has a poster | Reject |
| `higgsfield_generation_id` is not already in the ledger | Skip — this is the idempotency guard |
| `alt_text` is non-empty | Database check constraint rejects the row |

### Gate 2 — Creative (a human, in the Studio asset drawer)

| Check | Look for |
|---|---|
| Palette | Does it sit in the four-token core, or has the model drifted warm/teal? |
| Material honesty | Does resin read as deep glass, or as plastic? This is the library's most common failure |
| Proportion | Are furniture proportions believable at human scale? |
| Negative space | Is there a calm region for the headline the slot actually carries? |
| Set consistency | Placed next to its siblings in the real grid, does it look like the same shoot? |
| Artefacts | Hands, edges, repeated textures, warped straight lines, phantom text |

### Gate 3 — Content integrity (an editor, against D10 / FEAT §38)

| Check | Fail action |
|---|---|
| Does the image assert a capability the owner has not verified? | Hold the asset; hold the section; do not publish |
| Does any accompanying copy name a price, dimension, material spec, lead time, client or project? | Rewrite the copy |
| Is it about to be attached to a product or a portfolio project? | Refuse — the trigger will refuse too |
| Is the alt text a description of the image, or of the prompt? | Rewrite (§6) |

### Gate 4 — Owner verification

`owner_verification` moves `OWNER_VERIFICATION_REQUIRED → VERIFIED` only by an owner or admin
action, recorded in `audit_log`. Until then the asset may be **migrated and bound** but the
section that uses it may not be **published** — the D5 status workflow enforces the second half.

---

## 6. Alt text for concept media

Full policy: `MEDIA_GUIDE.md` §5. The Higgsfield-specific parts:

**All 250 `alt_text_draft` values are drafts and 124 of them are truncated mid-sentence.**
They are the first 160-odd characters of the prompt with an ellipsis. They are not alt text.
Every one is rewritten in Phase 43.

Rewrite rules:

| Rule | Wrong | Right |
|---|---|---|
| Describe the object, not the photograph | "Ultra-wide architectural editorial photograph: a large live-edge resin dining table…" | "A long walnut dining table with a deep blue resin river, centred in a rammed-earth room." |
| One sentence, ≤ 160 characters | 180-character prompt fragment | one clause, one full stop |
| No camera or lighting vocabulary | "shallow depth of field", "single soft directional key", "cinematic" | omit entirely |
| No hex codes | "deep midnight-blue backdrop (#0A1A2F)" | "a deep blue background" |
| No trailing ellipsis | "…blotting paper and a pair of trimming scissors laid beside it, the garland…" | finish the sentence |
| No production method | "A six-part collection series, all shot in a single session…" | describe *this* frame |
| Do not announce AI | "AI-generated image of a resin table" | the visible content only (SEED §43) |
| Decorative use sets a flag, not an empty string | `alt=""` typed by hand | `is_decorative = true`; `MediaSlot` emits `alt=""` |

`scripts/media/check-alt-text.mjs` enforces the first six mechanically: it fails on prompt
vocabulary, `#RRGGBB`, a trailing ellipsis, the string "AI", and anything under 15 characters.

> Alt text does **not** need to announce that an image is AI-generated. `is_ai_generated` and
> `is_concept` are governance metadata for Rivya and for the Studio, and the banner does the
> disclosing where disclosure belongs. SEED §43 states this explicitly.

---

## 7. The Studio tracker

`/studio/media/higgsfield`, filled in Phase 07, extended in Phase 43.

| Tab | Shows | Acts |
|---|---|---|
| **Inventory** | All 250 rows with the FEAT §34 columns; filters on family, page, ratio, type, migration status, used/unused | Open drawer, edit alt text, edit tags, bind to a slot |
| **Families** | 24 families with counts, image/video split, ratios present, max long edge | Filter the inventory |
| **Gaps** | `computeGaps()` output grouped by page | "Copy brief to master plan" |
| **Coverage** (Phase 43) | Every declared slot, its disposition, its bound asset, ratio fit, resolution fit | Change a disposition, open the crop editor |
| **Concept Placement** (Phase 43) | Every concept asset bound to a published slot | Audit; unbind |

**There is no generate control on any tab.** That is deliberate and permanent. Generation runs
from a script, after a written brief, after the guard passes.

The asset drawer shows the full prompt, the model, the generation id and the Higgsfield CDN
`source_url` as provenance. `source_url` is **never** a delivery URL — the public site serves
from Cloudinary only.

---

## 8. Quick reference

| Question | Answer |
|---|---|
| How many assets exist? | 250 — 224 images, 26 videos, 24 families, 23 folders |
| Can I regenerate one? | No. Not for any reason. `assert-no-regeneration.ts` is in CI |
| What is an asset's identity? | `(rivya_asset_id, type)`. The ID alone is not unique — 26 are shared by an image/video pair |
| What is the migration key? | `higgsfield_generation_id` — unique across all 250 |
| Which ratios may I ask for? | 21:9, 16:9, 4:3, 3:2, 1:1, 4:5, 3:4, 9:16. Nothing else |
| Which recipe for a new brief? | A for making and material; B for interiors and heroes. Never C or E |
| Which negative prompt? | `RIVYA-NEG-V2`, always |
| Can I put a concept image on a product page? | No. The database will refuse before you can |
| Can I generate a logo? | No. Brand marks are owner-supplied, permanently |
| Can I generate a 3D model? | No. A model is a product specification |
| Is the draft alt text usable? | No. All 250 are rewritten in Phase 43 |
| Where does the public site load these from? | Cloudinary. Never the Higgsfield CDN |
