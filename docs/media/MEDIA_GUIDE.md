# MEDIA GUIDE — the media model, end to end

> **Standing.** Hand-written. Binding contract: `CANONICAL-DECISIONS.md` §D1, §D6.
> Schema of record: `docs/architecture/DATA_MODEL.md` §7.
> Seam and boundaries: `docs/architecture/ARCHITECTURE.md` §5.1.
> Provider specifics: `CLOUDINARY.md`. AI workflow: `HIGGSFIELD_GUIDE.md`.
>
> Media in Rivya is a **database entity with a provider behind it**, never a URL pasted into a
> field. This document is the whole model: the seam, the kinds, the metadata that is mandatory,
> how a slot is filled, how it is delivered, and what happens when it fails.

---

## 1. The one-paragraph model

A **media asset** is a row in `media_assets`. The row is the meaning: alt text, governance flags,
provenance, dimensions. **Cloudinary is only the origin of the bytes.** A **media slot** is a
declared position in the CMS — a page section's desktop hero, a category card, a video poster —
and a **binding** is a `media_usages` row joining the two. Components never hold a URL; they hold
a slot, resolve it to a row, and ask `lib/media` to build a URL string. No request for media
passes through the Rivya server: `lib/media/transform.ts` returns a string and the browser
fetches the bytes from the CDN.

```
CMS slot (content/media-slots.ts)
   └── media_usages  (context_type, context_id, slot_key, role, position)
          └── media_assets  ← the record of truth: alt_text, is_ai_generated, is_concept, …
                 └── MediaProvider.url(ref, spec) → a Cloudinary URL string
                        └── the browser fetches the bytes. The server never proxies them.
```

---

## 2. The `MediaProvider` seam

D1 fixes "Cloudinary behind a `MediaProvider` abstraction". The contract, fixed:

```ts
// lib/media/types.ts
interface MediaProvider {
  signUpload(input: SignUploadInput): Promise<SignedUpload>;
  url(ref: MediaRef, spec?: TransformSpec): string;
  videoUrl(ref: MediaRef, spec?: VideoTransformSpec): string;
  posterUrl(ref: MediaRef, spec?: TransformSpec): string;
  probe(ref: MediaRef): Promise<ProviderMetadata>;   // bytes, width, height, duration, format
  move(ref: MediaRef, folder: string): Promise<MediaRef>;
  destroy(ref: MediaRef): Promise<void>;             // requires media.delete + ConfirmDialog
}
```

| Module | Responsibility |
|---|---|
| `lib/media/index.ts` | `getMediaProvider()`. **The only module other code imports.** A provider swap touches one file |
| `lib/media/types.ts` | `MediaProvider`, `MediaRef`, `TransformSpec`, `VideoTransformSpec`, `SignedUpload` |
| `lib/media/providers/cloudinary.ts` | The only file permitted to `import 'cloudinary'` |
| `lib/media/folders.ts` | The literal folder allowlist and `assertFolder()`. A **security control**, so it is code, not a table |
| `lib/media/transform.ts` | Presets, `srcSet()`, `ratioCrop()`, the width ladder |
| `lib/media/poster.ts` | `posterFor(video)` — explicit `poster_public_id`, else a derived first frame |
| `lib/media/crop.ts` | `media_crops` → a `c_crop` prefix applied before the preset (Phase 43) |
| `lib/media/model.ts` | 3D metadata helpers |
| `lib/media/gaps.ts` | `computeGaps()` — declared slots minus bindings |
| `lib/media/duplicate-guard.ts` | Refuses an upload whose checksum already exists in the folder |

Enforcement: ESLint `no-restricted-imports` blocks `cloudinary` outside
`lib/media/providers/**`, and a module-graph unit test asserts it in CI.

**The abstraction's real job is containment, not portability.** Provider-shaped strings — public
IDs, transformation chains, signed URLs — never reach a component, and `CLOUDINARY_API_SECRET`
never leaves the server.

**What is deliberately *not* behind this seam:** research HTML snapshots. They are evidence, not
media — gzipped, hashed, written to a private Supabase Storage bucket, never publicly
deliverable, never in Cloudinary.

---

## 3. Asset kinds

One table, discriminated by `kind`, covering all six FEAT §13 Media Manager sections.

| `media_kind` | `resource_type` | Studio section | Formats | Today |
|---|---|---|---|---|
| `IMAGE` | `image` | Images · AI Assets | WebP, AVIF, PNG, JPEG source; AVIF/WebP delivery | 224 Higgsfield concept images |
| `VIDEO` | `video` | Videos · AI Assets | MP4 (H.264) source; `f_auto:video` delivery | 26 Higgsfield concept videos |
| `MODEL_3D` | `raw` | 3D Models | `GLB`, `GLTF` | **0** — none exists, none is generated |
| `DOCUMENT` | `raw` | Documents | PDF | **0** — owner-supplied care guides, spec sheets |
| `BRAND` | `image` | Brand Assets | SVG, PNG | **0** — owner-supplied, never generated |

`media_source` mirrors the D6 priority ladder exactly:
`REAL · USER_UPLOAD · HIGGSFIELD · RENDER · FALLBACK`.
All 250 catalogued assets are `HIGGSFIELD`. Nothing is `REAL` yet, and that is honest.

The AI Assets section is not a sixth `kind` — it is `source = 'HIGGSFIELD'` across `IMAGE` and
`VIDEO`, which is why the tracker at `/studio/media/higgsfield` filters rather than owns.

---

## 4. Metadata that is mandatory on every row

D6 fixes three. The schema makes two more non-negotiable in practice.

| Column | Rule | Enforced by |
|---|---|---|
| `alt_text` | Non-empty unless `is_decorative` | `check (is_decorative or (alt_text is not null and length(btrim(alt_text)) > 0))`; the uploader cannot save without it |
| `is_ai_generated` | `not null`. True for anything a model produced, in whole or in part | Column constraint |
| `is_concept` | `not null`. True for anything that is not a photograph of a real Rivya object | Column constraint; `product_media` trigger rejects `is_concept = true` |
| `owner_verification` | D5 enum. `OWNER_VERIFICATION_REQUIRED` on every AI asset until an owner clears it | `enforce_owner_verification_gate` |
| `status` | D5 enum. Public reads are restricted to `PUBLISHED` | RLS |

### 4.1 `is_ai_generated` and `is_concept` are different questions

They are frequently both true, and people therefore assume they are one flag. They are not.

| | `is_ai_generated` | `is_concept` |
|---|---|---|
| Asks | *How were these pixels made?* | *Does this depict a real Rivya object?* |
| True for | Any model output — including an AI upscale or background removal applied to a real photograph | Any image of an object Rivya has not made, however it was produced |
| False for | A photograph of a real table | A photograph of a real table |
| The awkward case | A real product photo with an AI-removed background: `is_ai_generated = true`, `is_concept = **false**` | A hand-drawn render of an unbuilt commission: `is_ai_generated = false`, `is_concept = **true**` |
| Consequence when true | Provenance only. Not disclosed in alt text (SEED §43) | **Hard consequence**: cannot attach to a product, cannot attach to a portfolio project, cannot carry a caption naming a price, dimension, specification, client or project |

`is_concept` is the flag that carries the business rule. Set it honestly and the rest of the
system enforces D10 without anyone remembering to.

---

## 5. Alt-text policy (SEED §43)

Alt text is content. It is seeded, editable in Studio, versioned like any other field, and it is
**never** generated at render time from a filename.

### 5.1 Banned outright

```
image 1 · image · hero · photo · picture · banner · img · asset · media · untitled
```

SEED §43 names `image 1`, `hero` and `photo`; the remaining seven are a Rivya extension in the
same spirit, enforced by `scripts/media/check-alt-text.mjs`. The linter rejects all ten and the
reviewer rejects anything in the same spirit.

### 5.2 The rules

| # | Rule | Why |
|---|---|---|
| 1 | Describe what is **visible**, in one sentence | Alt text substitutes for the image, not for the brief |
| 2 | ≤ 160 characters, one full stop, no trailing ellipsis | It is read aloud in full |
| 3 | Lead with the subject, not the framing | "A walnut dining table…", never "Ultra-wide editorial photograph of…" |
| 4 | No camera, lens or lighting vocabulary | "shallow depth of field" tells a blind visitor nothing |
| 5 | No hex codes, no prompt vocabulary | `#0A1A2F` is read aloud as letters |
| 6 | No business facts — no price, dimension, material specification, client or project | D10. Alt text is not a loophole |
| 7 | Do not announce AI generation | SEED §43 — the flags and the Studio banner do the disclosing |
| 8 | Decorative use sets `is_decorative = true` | Never a hand-typed `alt=""`; `MediaSlot` emits it |
| 9 | If the same asset means different things in two slots, override per slot | `page_sections.media_alt_override`, falling back to `media_assets.alt_text` |
| 10 | Video alt text describes the scene, not the motion | "A resin pour filling a shallow round mould", not "a slow-motion clip of…" |

Reference draft, from SEED §43:

> Sculptural resin dining table presented in a minimal architectural interior.

### 5.2a The same rules apply to a caption, and Phase 12 made them testable

A caption is alt text a sighted visitor also reads, so rule 6 binds it identically: it describes the
**material or the process in the frame** and never names a piece, a price, a dimension, a lead time,
a client or an award. `/about` and `/process` are where this bites, because every asset on both
pages is `is_concept = true` — AI-developed concept media — and a caption naming a delivered object
would be describing something that does not exist.

`tests/e2e/{about,process}.spec.ts` scan the whole rendered `<main>` for a currency symbol, a number
followed by `mm`, `cm`, `m`, `in` or `ft`, and the words *client*, *customer*, *award*, *warranty*
and *guarantee*. It is a blunt instrument by choice: it will occasionally object to an innocent
sentence, and a false objection costs a conversation while a missed one ships a claim nobody made.

### 5.3 The 250 imported drafts are not compliant

`alt_text_draft` in the manifest is the leading ~160 characters of the prompt.
**124 of 250 end in an ellipsis; 148 exceed 160 characters; 55 open with camera vocabulary.**
They are imported as drafts, held at `OWNER_VERIFICATION_REQUIRED`, and rewritten in Phase 43 —
assets bound to a published slot first. See `HIGGSFIELD_ASSET_STATUS.md` §6, DQ-1 to DQ-5.

`scripts/media/check-alt-text.mjs` fails on: prompt vocabulary, `#RRGGBB`, a trailing ellipsis,
the string "AI", and anything under 15 characters.

---

## 6. Slots, roles and bindings

A slot is declared in `content/media-slots.ts` — key, page, label, kind, desktop and mobile
ratios, the manifest families that could fill it, how many assets it needs, and whether an
unfillable one earns a generation brief or an honest empty state. A binding is a `media_usages`
row.

| Field | Vocabulary |
|---|---|
| `context_type` | `PAGE_SECTION · PRODUCT · CATEGORY · COLLECTION · PORTFOLIO · JOURNAL · GLOBAL · SEO` |
| `slot_key` | The registry key verbatim — `home.hero.video`, `collection.decor.hero`. Repeating slots take the index form `collection.decor.hero[0]`…`[3]` |
| `role` | `DESKTOP · MOBILE · POSTER · THUMBNAIL · GALLERY · OG` |
| Key | `unique (context_type, context_id, slot_key, role)` |

**Why `slot_key` carries the registry key rather than a short section-scoped name.** The
alternative — `media`, `card.3`, unique only within its context — was the original sketch, and it
would force `computeGaps()` to join through `page_sections` to learn which declared slot a binding
belongs to. That table does not exist until Phase 08, so the gap report could not run until Phase
08 shipped, which is the wrong way round: the gap list is what Phase 08 works *from*. Writing the
registry key makes the reverse index directly queryable, which is also what FEAT §17's "Missing
Media" card needs. The index form survives because
`(context_type, context_id, slot_key, role)` is unique — four cards in one role would otherwise
collide on one key — and `slotKeyOf()` strips it so they count against the one declared slot.

Maintained by the `sync_media_usages` trigger, never written by hand. It earns its keep three ways:

1. **"Missing Media"** on the Studio dashboard (FEAT §17) becomes computable rather than guessed.
2. **Deletion is safe** — a delete trigger refuses while any usage row references the asset, and
   the asset drawer lists the usages before offering the control.
3. **Concept placement is auditable** — every published slot holding a concept asset is one query.

### 6.1 Desktop and mobile are separate slots (D6)

Non-negotiable. `MediaSlot` chooses between them with `<picture>` and `source` at
`--rv-bp-md`, in markup, at server-render time — **never with JavaScript**, which would guarantee
either a layout shift or a double download.

An editor may bind the same asset to both roles where a card is genuinely the same shape at every
breakpoint. The two slots still exist. What is forbidden is *deriving* the mobile crop from the
desktop asset in code: a 21:9 hero letterboxed or centre-cropped to 9:16 is not a mobile hero.

Ratio by surface:

| Surface | Desktop | Mobile |
|---|---|---|
| Full-bleed page hero | 21:9 | 9:16 |
| Section hero / band | 16:9 | 4:5 |
| Category / collection hero | 16:9 | 4:5 |
| Card | 4:5 | 4:5 |
| Material tile set | 1:1 | 1:1 |
| Editorial inline | 3:2 | 3:4 |

---

## 7. Rendering

| Component | Registry | Environment | Job |
|---|---|---|---|
| `MediaSlot` | RC-213 | Server | Resolves a slot pair to rows, reserves the aspect box, emits `<picture>`, applies `--rv-media-veil` where text sits over media, renders the failure state |
| `MediaImage` | Phase 06 | Server | One image: preset, `srcset`, `sizes`, `alt`, `priority` |
| `MediaVideo` | Phase 06 | Client | One video: poster first, muted inline loop, reduced-motion and mobile fallbacks |
| `HeroMotion` | RC-214 | Client | Mounts the hero video **after** the still has painted, so the LCP element is always the image |

Rules that hold everywhere:

- **The aspect box is reserved before load.** CLS budget is 0.05 and media is the usual way to
  blow it.
- **The hero image is `priority`; everything else is lazy.** One `priority` image per route.
- **`sizes` is required.** `MediaImage` throws without it in development — a missing `sizes` makes
  `srcset` decorative and ships the widest candidate to a phone.
- **No component writes a Cloudinary URL.** `lib/media/transform.ts` builds every one.
- **No media round-trips the Rivya server.** A URL string is built; the browser fetches the bytes.

### 7.1 Responsive delivery

Width ladder for `srcSet()`:

```
320 · 480 · 640 · 768 · 1024 · 1280 · 1536 · 1920 · 2560
```

Capped at **2560 px** even though library masters reach 6336 px. Format is negotiated by the CDN
via `f_auto` — AVIF where the browser accepts it, WebP otherwise, the source format last.
Quality is `q_auto` at the tier the preset names. Full preset table: `CLOUDINARY.md` §5.

A Playwright assertion at the 390 px viewport checks that no delivered image exceeds 1024 px and
that the response `content-type` is `image/avif` or `image/webp`.

### 7.2 Video and posters

**Every video has a poster. There is no exception and no default state where a video area is
blank.**

`posterFor(video)` resolves in order:
1. `poster_public_id` on the row, if an editor chose a frame;
2. otherwise the video's own first frame delivered as an image (`so_0`) through the `hero` preset.

Inline video autoplays **only** when all of these hold:

| Condition | Why |
|---|---|
| `muted` and `playsInline` | Browsers refuse otherwise, and unmuted autoplay is hostile |
| duration ≤ 12 s | All 26 library videos are 5–10 s and qualify |
| `prefers-reduced-motion: no-preference` | Accessibility, non-negotiable |
| viewport ≥ 768 px | `HeroMotion` does not mount a `<video>` below 768 px at all |
| `navigator.connection.saveData` is not set | Respect the user's stated preference |

When any condition fails, **no `<video>` element mounts**. The poster renders with an explicit
play control. That is a complete experience, not a degraded one.

`preload="none"`, `loop`, no controls when decorative, `aria-hidden` when decorative.
No audio track is ever briefed or shipped.

### 7.3 3D models (FEAT §12–§14)

`kind = 'MODEL_3D'`, `resource_type = 'raw'`, `GLB` or `GLTF` only.

Metadata, exactly FEAT §13's list: `model_format`, `file_size_bytes`, `poly_count`,
`texture_count`, `model_thumbnail_id`, `model_poster_id`, `associated_product_id`,
`associated_project_id`, plus `viewer_settings jsonb`.
`check (kind <> 'MODEL_3D' or model_format is not null)`.
Variant labels live in `model_variant_labels` so the viewer's switcher shows words, not mesh
names; a label may reference a real `materials` row but never invents a specification.

Performance contract (FEAT §14):

- `components/three/**` is **dynamically imported**, client-only, behind an intent gate — a tap,
  a click, or an intersection. It never blocks first render.
- A **static poster** always exists and is what the page shows until the viewer mounts.
- Under `prefers-reduced-motion: reduce`, `saveData`, or a narrow viewport the poster is the
  whole experience and no WebGL context is created.
- The `3d_viewer` feature flag gates the entire surface.

**There are zero 3D models today, and none will be AI-generated.** A model has dimensions and a
form; that is a product specification, and inventing one is exactly what D10 forbids. The flag
stays off until the owner supplies a `GLB` of an object that exists.

---

## 8. Uploads

The browser uploads **directly to Cloudinary**. Bytes never pass through the Rivya server and
`CLOUDINARY_API_SECRET` never leaves it.

```
Studio (MediaUploader)
   → POST /api/media/sign        session · permission · folder allowlist · MIME allowlist · size cap · rate limit
   → short-lived signature
   → PUT direct to Cloudinary
   → POST back: create the media_assets row (alt text required before save)
```

| Constraint | Value |
|---|---|
| Session | Required. `app/api/media/sign` returns 401 without one |
| Permission | `media.write` |
| Folder | Must be in `lib/media/folders.ts`. Anything else → 422 |
| MIME | Per `kind`: image `webp/avif/png/jpeg`; video `mp4`; model `model/gltf-binary`, `model/gltf+json`; document `application/pdf` |
| Size ceiling | 25 MB image · 200 MB video · 50 MB model |
| Rate limit | Per user, per minute |
| Duplicate guard | `lib/media/duplicate-guard.ts` refuses a checksum already present in the folder |

Visitor reference-image uploads (SEED §22, the commission form) go through
`app/api/inquiries/upload-sign` — the same mechanism narrowed to one folder, no session,
rate-limited, and never publicly readable.

---

## 9. Failure — degrade, never collapse (SEED §47)

**A failed image is a layout event, not a blank page.** `MediaSlot` has already reserved the
aspect box, so nothing moves.

| Symptom | What the visitor sees | What the Studio sees | Recovery |
|---|---|---|---|
| A single image 404s or times out | The reserved box painted `--rv-surface-sunken`, with the seeded label **"Image temporarily unavailable"** at the correct ratio. Text, price state and CTAs are untouched | The asset drawer flags the failure | Automatic on next load |
| Cloudinary is unreachable | Every media box degrades the same way. **The page still renders, still reads, and the enquiry flow still works** | Uploads fail with a named reason; existing rows still list | Automatic |
| A video fails | Its poster shows. If the poster fails too, the fallback surface shows | — | Automatic |
| A 3D model fails | The poster shows with an explanatory line. No WebGL context is created | — | Automatic |

The fallback is **a token-painted surface, not a picture**: `--rv-surface-sunken` at the reserved
ratio with the SEED §47 label. There is no placeholder illustration, no "broken image" glyph, no
borrowed stock photograph. A neutral material-toned rectangle is honest; a substituted picture
is a small lie.

The label is seeded copy in `global_content` under `ERROR_COPY` and is editable in Studio like
any other string.

Two things that must never happen and are designed against:

1. **A layout must never collapse when media fails.** The box is reserved from the ratio, before
   the byte request is made.
2. **Media failure must never block conversion.** The enquiry form persists and the WhatsApp
   handoff runs regardless of whether a single image loaded.

---

## 10. Security and privacy

| Rule | Mechanism |
|---|---|
| `CLOUDINARY_API_SECRET` never reaches the browser | Signing happens server-side; the browser receives a signature and constraints, never the key |
| Uploads cannot escape their folder | `assertFolder()` against the code allowlist, checked server-side at signing time |
| Deletion cannot orphan a page | Trigger refuses while `media_usages` rows exist; requires `media.delete` and a `ConfirmDialog` |
| Public reads see only published media | RLS: anon `select` where `status = 'PUBLISHED'` |
| Visitor uploads are not public | Separate signing endpoint, separate folder, no session, rate-limited, never publicly readable |
| Competitor imagery is never republished | Research snapshots are private Supabase Storage, outside this seam entirely |
| Secrets never appear in logs | The log redactor strips credentialed URLs and JWT-shaped strings by pattern |

---

## 11. Where each concern is documented

| Change | Document to update (FEAT §43) |
|---|---|
| `lib/media/**`, `scripts/media/**` | This file, or `CLOUDINARY.md` |
| Folder taxonomy, presets, transformations, migration | `CLOUDINARY.md` |
| Prompts, recipes, generation gate, asset priority | `HIGGSFIELD_GUIDE.md` |
| Coverage, gaps, briefs | `HIGGSFIELD_MASTER_ASSET_PLAN.md` |
| Inventory counts, data quality, migration runs | `HIGGSFIELD_ASSET_STATUS.md` (generated) |
| `media_assets`, `media_usages`, `media_crops`, `model_variant_labels` | `docs/architecture/DATA_MODEL.md` |
| `MediaSlot`, `MediaImage`, `MediaVideo`, `HeroMotion` | `docs/design/COMPONENT_REGISTRY.md` |

Then CHANGELOG, PROJECT_STATE and SESSION-STATE as D9 requires.
