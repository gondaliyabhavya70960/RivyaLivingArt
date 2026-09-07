# CLOUDINARY — folders, naming, delivery and migration

> **Standing.** Hand-written. Binding contract: `CANONICAL-DECISIONS.md` §D1 (Cloudinary behind a
> `MediaProvider`), §D6 (folders follow the manifest's `cloudinary_folder`), §D8 (env var names).
> Model and rendering: `MEDIA_GUIDE.md`. Schema: `docs/architecture/DATA_MODEL.md` §7.
>
> Cloudinary is the **origin and CDN for bytes only**. It is never the record of truth — that is
> `media_assets`. Nothing outside `lib/media/providers/cloudinary.ts` may import the SDK, and no
> media request passes through the Rivya server.

---

## 1. Account and environment

| Variable | Scope | Used by |
|---|---|---|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public | URL building, client and server |
| `CLOUDINARY_API_KEY` | Server only | Signing, probe, move, destroy |
| `CLOUDINARY_API_SECRET` | Server only | Signing. **Never sent to a browser, never logged, never displayed** |

`Studio → System → Environment` reports **reachability only** — never a value, prefix or length
(D8, FEAT §29). The health probe is an unauthenticated `GET` of a known derived URL; a 200 means
reachable, anything else means degraded.

Unsigned upload presets are **disabled at the account level**. Every write is signed server-side.
Strict transformations are **on**: only transformation chains built by `lib/media/transform.ts`
resolve, so a hand-crafted URL cannot make the account derive arbitrary work.

---

## 2. Folder taxonomy

The 23 folders below are **taken verbatim from the manifest's distinct `cloudinary_folder`
values** (D6). They are not a proposal; they are already assigned to all 250 assets.

```
rivya/
├── collection/
│   ├── 3d-resin              13   img 13  vid  0
│   ├── decor                 18   img 17  vid  1
│   ├── gifts                 10   img 10  vid  0
│   ├── preservation          19   img 19  vid  0
│   └── wall-art              20   img 20  vid  0
├── interior                   5   img  5  vid  0
├── journal/
│   ├── editorial             19   img 16  vid  3
│   └── workshop               5   img  5  vid  0
├── large-format/
│   ├── architectural          1   img  1  vid  0
│   ├── coffee                 1   img  1  vid  0
│   ├── console                4   img  4  vid  0
│   ├── dining                 5   img  3  vid  2
│   ├── seating                4   img  4  vid  0
│   └── side                   3   img  3  vid  0
├── material                  39   img 33  vid  6
├── portfolio/
│   └── gallery                5   img  4  vid  1
└── process/
    ├── cure                   8   img  8  vid  0
    ├── finish                 8   img  8  vid  0
    ├── mould                 12   img 11  vid  1
    ├── pigment               13   img 11  vid  2
    ├── pour                  12   img  8  vid  4
    ├── studio                19   img 15  vid  4
    └── timber                 7   img  5  vid  2
                            ─────
                              250   img 224  vid 26
```

Note two folder names that do **not** mirror their family or page string, because the manifest
says so and the manifest wins:

- `wall-art` family → folder `rivya/collection/wall-art`, page `collection/wall-statement-art`
- `largeformat-monumental` family → folder `rivya/large-format/architectural`

Reserved and empty at the end of Phase 06:

```
rivya/product/<product-slug>     Phase 14 — owner-supplied product photography
rivya/models                     Phase 21 — GLB/GLTF, resource_type raw
rivya/documents                  care guides, spec sheets (PDF)
rivya/brand                      logo, wordmark, favicon, OG defaults — owner-supplied
```

New folders required only if a `HIGGSFIELD_MASTER_ASSET_PLAN.md` §6 brief is executed:

```
rivya/home/hero                  G1, G2, G6
rivya/commission                 G9
rivya/collection/furniture       G10
```

Briefs G11 and G12 need no new folder: `rivya/large-format/seating` and
`rivya/large-format/console` are already manifest folders.

### 2.1 The folder allowlist is code, not data

`lib/media/folders.ts` holds the literal list and `assertFolder()`. It is a **security control** —
it is what stops a signed upload landing anywhere it likes — so it is not a table an editor can
edit. There is no `media_folders` table.

The unit test asserts that **every distinct `cloudinary_folder` in the manifest appears in the
allowlist**. The allowlist is a superset (it also carries the reserved folders), so adding a new
folder for a brief is legal and does not weaken the assertion.

`media_assets.folder` mirrors the folder string. It is indexed, and it is what the Studio Media
Manager filters on.

---

## 3. Naming

| Level | Form | Example |
|---|---|---|
| Rivya asset ID — assets that exist | `<FAMILY-UPPER>-<NNN>` | `LARGEFORMAT-DINING-002` |
| Rivya asset ID — assets that are planned | `<PAGE>-<SECTION>[-<KIND>]-<NNN>` | `LARGE-DINING-CARD-001` |
| Filename | `<id lower-cased>-<ratio with x>.<ext>` | `largeformat-dining-002-21x9.webp` |
| Public ID | `<folder>/<filename without extension>` | `rivya/large-format/dining/largeformat-dining-002-21x9` |

The two ID forms share one namespace and must never collide — D6 amendment A1, enforced by
`scripts/media/check-asset-ids.py`. Ordinals count across image and video together.

The filename row is **one grammar for both allocators** — the asset ID lower-cased plus the ratio
— so a filename is always derivable from an ID. It diverges from D6's literal
`<page>-<section>-<variant>.<ext>` and from FEAT §35's examples, neither of which describes the
250 filenames that already exist. `HIGGSFIELD_MASTER_ASSET_PLAN.md` §3.3 records the divergence
and the dated D6 amendment it still needs; do not resolve it by renaming assets.

**A public ID never carries a file extension.** The extension is a delivery choice — `f_auto`
negotiates AVIF, WebP or the source format per request from one public ID.

**A public ID is immutable.** Cloudinary can rename, but a rename breaks every cached derivative
and every URL already in the wild. Treat a replacement as a new public ID and a new
`media_assets` row; archive the old row, never reuse the ID.

### 3.1 Uniqueness, and why the index still carries `resource_type`

All 250 `cloudinary_public_id` values are unique, as are all 250 `rivya_asset_id` and `filename`
values. That was not true of the first manifest build — images and videos were numbered with
separate counters, so 26 videos took a still's asset ID and six took its public ID with them. The
generator now shares one counter and asserts uniqueness before writing
(`HIGGSFIELD_ASSET_STATUS.md` §6, DQ-0).

The database index nevertheless stays:

```sql
unique (provider, resource_type, public_id)   -- deliberately NOT unique (public_id)
```

That is not a leftover. Cloudinary genuinely namespaces public IDs by resource type —
`image/upload/<id>` and `video/upload/<id>` are different objects — and the index should describe
Cloudinary's model rather than a property of one particular manifest build. A future asset set,
or an owner upload, may legitimately pair an image and a video under one name.

---

## 4. Upload paths — signed, server-side, always

There is exactly one way bytes enter Cloudinary, and the browser never holds a credential.

```
Studio (components/studio/MediaUploader.tsx)
  1. POST /api/media/sign
       ├── session required                       → 401 without one
       ├── permission media.write                 → 403 without it
       ├── folder ∈ lib/media/folders.ts          → 422 otherwise
       ├── MIME ∈ allowlist for the kind          → 422 otherwise
       ├── size ≤ ceiling for the kind            → 422 otherwise
       └── per-user rate limit                    → 429 otherwise
  2. ← { signature, timestamp, api_key, folder, public_id, constraints }
  3. PUT direct browser → Cloudinary
  4. POST back → probe() → insert media_assets (alt text required before save)
```

| Kind | MIME allowlist | Ceiling |
|---|---|---|
| `IMAGE` | `image/webp`, `image/avif`, `image/png`, `image/jpeg` | 25 MB |
| `VIDEO` | `video/mp4` | 200 MB |
| `MODEL_3D` | `model/gltf-binary`, `model/gltf+json` | 50 MB |
| `DOCUMENT` | `application/pdf` | 25 MB |
| `BRAND` | `image/svg+xml`, `image/png` | 5 MB |

Signature TTL is 10 minutes. `overwrite: false` on every upload — an accidental re-run cannot
replace an existing original.

Visitor reference images (SEED §22) use `app/api/inquiries/upload-sign`: the same mechanism,
narrowed to one folder, no session, rate-limited by IP hash, image and PDF only, 10 MB, and never
publicly readable.

**`CLOUDINARY_API_SECRET` exists in exactly two places: the server environment and
`lib/media/providers/cloudinary.ts`.** It is not in a client bundle, a log line, an error message,
the Environment page, or a Studio drawer.

---

## 5. Transformation presets

Named presets only. A component never writes a transformation chain; it names a preset.

| Preset | Surface | Chain |
|---|---|---|
| `thumb` | Studio table rows | `c_fill,g_auto,w_160,f_auto,q_auto:eco` |
| `card` | Product, collection, category and journal cards | `c_fill,g_auto,w_480,f_auto,q_auto:good` |
| `grid` | Gallery grids, lightbox thumbnails | `c_fill,g_auto,w_768,f_auto,q_auto:good` |
| `hero` | Section heroes and bands | `c_fill,g_auto,w_1600,f_auto,q_auto:good` |
| `hero-xl` | Full-bleed 21:9 heroes | `c_fill,g_auto,w_2560,f_auto,q_auto:good` |
| `og` | Social cards | `c_fill,g_auto,w_1200,h_630,f_jpg,q_auto:good` |

Width ladder for `srcSet()`:

```
320 · 480 · 640 · 768 · 1024 · 1280 · 1536 · 1920 · 2560
```

Capped at 2560 px although library masters reach 6336 px. Nobody needs 6336 px of a hero, and
serving it is the single easiest way to fail Core Web Vitals.

### 5.1 Ratio crops

`ratioCrop(ratio)` accepts exactly the eight D6 ratios and **throws** on anything else:

```
21:9 · 16:9 · 4:3 · 3:2 · 1:1 · 4:5 · 3:4 · 9:16
```

Where a `media_crops` row exists for `(asset, ratio)`, `lib/media/crop.ts` emits an explicit
`c_crop,x_,y_,w_,h_` **before** the preset chain, so the editor's chosen box wins over `g_auto`.
Where it does not, `c_fill,g_auto` handles it. Either a full box or a gravity — never a
half-specified crop, enforced by a check constraint.

### 5.2 Resolution fit is checked, never assumed

A slot's preset names a target width. Binding an asset whose long edge is below it means
upscaling, and Cloudinary will do it silently. It is reported as a gap instead.

| Threshold | Assets below it (of 250) |
|---|---|
| 1600 px (`hero`) | 14 images |
| 2560 px (`hero-xl`) | 120 assets — 94 images and all 26 videos |
| 1920 px (video hero) | 19 of 26 videos |

`scripts/media/build-coverage-report.ts` computes this per slot. **No asset is ever upscaled to
close a gap.**

### 5.3 Format policy

| Concern | Policy |
|---|---|
| Delivery format | `f_auto` on every image preset. AVIF where the browser accepts it, WebP otherwise, source format last. Never a hard-coded `.webp` in a URL |
| Exception | `og` pins `f_jpg` — social crawlers are unreliable with AVIF and WebP and an unrendered card is worse than a larger one |
| Quality | `q_auto:eco` for `thumb`; `q_auto:good` everywhere else. Never a fixed numeric quality |
| DPR | Handled by the `srcset` width ladder, not by `dpr_auto`. One mechanism, not two |
| Source format | Whatever the master is. **224 manifest sources are PNG** even though their target filenames end `.webp` — the filename is a delivery name. Upload the PNG master and let `f_auto` derive |
| Transparency | Preserved through AVIF/WebP. Never flattened onto an assumed background |
| Colour profile | sRGB. Strip everything else on ingest |
| Metadata | EXIF and IPTC are stripped on delivery. Owner-supplied photographs may carry GPS coordinates and must not leak them |

---

## 6. Video

| Concern | Policy |
|---|---|
| Delivery | `f_auto:video,q_auto,vc_auto` |
| Source | MP4 / H.264 |
| Poster | `poster_public_id` when an editor chose a frame; otherwise the video's own first frame as an image (`so_0`) through the `hero` preset. **Never absent** |
| Duration | 5–10 s in the current library; the autoplay gate caps at 12 s |
| Audio | None briefed, none shipped. Every inline video is muted |
| Autoplay | Only when muted, `playsInline`, ≤ 12 s, `prefers-reduced-motion: no-preference`, viewport ≥ 768 px, and `saveData` unset. Otherwise **no `<video>` element mounts** and the poster renders with a play control |
| `preload` | `none`. `HeroMotion` mounts the element after the still has painted, so the LCP element is always the image |
| Adaptive streaming | Not used. 26 clips of 5–10 s do not justify HLS packaging; progressive MP4 with `q_auto` is smaller end to end |

Delivered video resolutions in the library: 1344×768 ×8 · 1280×720 ×8 · 1920×1080 ×7 ·
768×1344 ×3. Only seven clips reach 1080p, which is why a full-bleed desktop hero video is a
`GENERATE_NEW` gap rather than a reuse (`HIGGSFIELD_MASTER_ASSET_PLAN.md` §6, G1).

---

## 7. Caching

| Layer | TTL | Invalidated by |
|---|---|---|
| Cloudinary derived asset | Effectively permanent — a derivative is a pure function of `(public_id, chain)` | Nothing. A new chain is a new object |
| Cloudinary CDN edge | `Cache-Control: max-age=31536000, immutable` | Nothing. Public IDs are immutable |
| Browser | As above | A changed URL, which means a changed public ID or preset |
| Next.js page cache | Route-dependent | `revalidatePath` / `revalidateTag` on publish, via `/api/revalidate` with `REVALIDATE_SECRET` |
| `media_assets` row | Request-scoped | Any Studio write |

**Media does not need invalidating, because media URLs do not change meaning.** What changes is
*which* asset a slot points at, and that is a database write plus a page revalidation. This is the
reason public IDs are immutable: it makes the whole caching story one sentence long.

Consequences to accept deliberately:

- **Replacing an image means a new public ID.** Re-uploading over the same ID leaves stale bytes
  cached at the edge and in browsers for a year. The uploader refuses it (`overwrite: false`).
- **Editing alt text needs no invalidation at Cloudinary** — alt text is not in the URL — but it
  does need a page revalidation, because it is rendered into the HTML.
- **`destroy()` is genuinely destructive.** It requires `media.delete`, a `ConfirmDialog`, and is
  blocked by trigger while any `media_usages` row references the asset.

---

## 8. Invalidation runbook

| Situation | Action |
|---|---|
| Wrong image bound to a slot | Rebind in Studio, publish the section. No Cloudinary action |
| Image is right, crop is wrong | Add or edit the `media_crops` row. New chain → new derivative → no invalidation |
| Asset must be withdrawn | Set `status = 'ARCHIVED'`. It stops being publicly readable via RLS. Only `destroy()` if it was uploaded in error and is bound nowhere |
| An asset was uploaded to the wrong folder | `provider.move()`, then update `media_assets.folder` and `public_id` in the same transaction. Old derivatives are orphaned; that is acceptable |
| Cloudinary is serving a stale derivative | It is not. Verify the URL your page actually emitted — a stale *page* cache is the far likelier cause |
| An account-level setting changed the derived output | Purge the affected derived assets from the Cloudinary console and revalidate the routes. Record it in `CHANGELOG.md` — this is the one case where invalidation is real work |

---

## 9. Migration runbook — the 250 Higgsfield assets

**Goal.** Move all 250 assets from the Higgsfield CDN origin
(`https://d8j0ntlcm91z4.cloudfront.net/user_3DhoW2nhI28P4KJAzGKTvXSsp9j/…`) into Cloudinary at
the folder and public ID the manifest already assigns, and write the matching `media_assets` rows
with full provenance. After this, **nothing on the public site references that CDN.**

Phase 07 owns this. **Phase 06 imports exactly the three named canaries in §9.2 and nothing
else; the remaining 247 rows, the migration script and its ledger are Phase 07 deliverables.**
That is the split `docs/architecture/DATA_MODEL.md` §7 and §12 already state, and the two
documents agree — §9.4's field mapping is likewise DATA_MODEL §7's mapping verbatim.

### 9.1 Preconditions

- [ ] Phase 06 complete: `MediaProvider`, `lib/media/folders.ts`, `media_assets`, `media_usages`.
- [ ] All 23 manifest folders present in the allowlist; the folder test passes.
- [ ] `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` reachable server-side; Environment page green.
- [ ] `supabase/migrations/0040_phase07_higgsfield.sql` applied (`higgsfield_migration_runs`).
- [ ] `data/higgsfield/asset-manifest.json` unmodified — `npm run manifest:verify` is green.

### 9.2 The three canaries (Phase 06)

Migrated by hand through the Studio uploader's import-by-URL path, to prove the pipeline before
247 more follow:

| Asset ID | Type | Ratio | Public ID |
|---|---|---|---|
| `PROCESS-STUDIO-001` | image | 4:3 · 4800×3584 | `rivya/process/studio/process-studio-001-4x3` |
| `LARGEFORMAT-DINING-004` | video | 9:16 · 768×1344 · 6 s | `rivya/large-format/dining/largeformat-dining-004-9x16` |
| `LARGEFORMAT-MONUMENTAL-001` | image | 21:9 · 6336×2688 | `rivya/large-format/architectural/largeformat-monumental-001-21x9` |

The video canary is deliberate: it is the only `resource_type` other than `image` in the run, so
it exercises the `(provider, resource_type, public_id)` write path. It no longer shares a public
ID with any image — DQ-0 renumbered the 26 videos and all 250 public IDs are now unique
(§3.1) — so the composite key is defence in depth here, not a collision test.

### 9.3 The script

```
scripts/media/migrate-higgsfield.ts

npm run media:migrate:higgsfield -- --dry-run
npm run media:migrate:higgsfield -- --family=material-macro
npm run media:migrate:higgsfield -- --limit=25
npm run media:migrate:higgsfield -- --resume
npm run media:migrate:higgsfield
```

Per asset, in order:

```
1.  Read the manifest row. The manifest is READ-ONLY input; the script never writes to it.
2.  Ledger check on higgsfield_generation_id (data/higgsfield/migration-log.json).
       already migrated → skip, count it, continue.
3.  GET source_url. Non-200 → record the HTTP status, mark FAILED, continue. Never abort the run.
4.  Verify the bytes: content-type matches `type`, and width/height match the manifest.
       mismatch → FAILED. The manifest's dimensions are the contract.
5.  Upload to Cloudinary:
       public_id     = cloudinary_public_id      (verbatim, no extension)
       folder        = cloudinary_folder         (verbatim)
       resource_type = image | video             (from `type`)
       overwrite     = false
       unique_filename = false
       invalidate    = false
6.  probe() the uploaded object → bytes, width, height, duration, format.
7.  Insert media_assets (field mapping in §9.4).
8.  Append to the ledger: generation id, public id, resource type, bytes, timestamp, run id.
9.  Increment the counters on the higgsfield_migration_runs row.
```

**Idempotency and resumability.** The ledger is keyed by `higgsfield_generation_id`. Asset IDs
are unique too, but an asset ID is an ordinal within a family and a manifest rebuild can
legitimately renumber it — one already has (`HIGGSFIELD_ASSET_STATUS.md` §6, DQ-0). A generation
id is minted by Higgsfield and never moves, so a ledger keyed on it survives a rebuild that a
ledger keyed on asset IDs would not. A second full run reports `skipped 250, migrated 0` and
writes nothing. `--resume` continues from the ledger.

### 9.4 Field mapping

| Manifest field | Destination | Note |
|---|---|---|
| `cloudinary_public_id` | `media_assets.public_id` | Verbatim — the manifest is authoritative (D6) |
| `cloudinary_folder` | `media_assets.folder` | Verbatim |
| `filename` | `media_assets.filename` | Unique across all 250; the human key |
| `rivya_asset_id` | `media_assets.rivya_asset_id` | Unique across all 250; the authoritative key (D6) |
| `type` | `resource_type` (`image`/`video`) **and** `kind` (`IMAGE`/`VIDEO`) | |
| `family` | `tags` (one entry) | |
| `subject_tags` | `subject_tags` | 14 `editorial` rows have an empty array — expected |
| `page`, `section` | `tags` as `page:<page>` and `section:<section>` | Drives tracker filters |
| `aspect_ratio`, `width`, `height`, `duration_s` | matching technical columns | |
| `prompt` | `higgsfield_prompt` | Provenance. **Never rewritten**, including `MATERIAL-MACRO-029`'s trailing operator note |
| `higgsfield_generation_id`, `higgsfield_model` | matching columns | The generation id is uniquely indexed where not null |
| `alt_text_draft` | `alt_text` | A **draft**. 124 are truncated; all 250 are rewritten in Phase 43 |
| `is_ai_generated`, `is_concept` | copied verbatim | Both `true` for all 250 |
| `source_url` | **not stored as a delivery URL** | Fetched once, kept as provenance only |
| `manifest_version` | `manifest_version` | `rivya-hf-v1` |
| — | `source = 'HIGGSFIELD'` | |
| — | `owner_verification = 'OWNER_VERIFICATION_REQUIRED'` | |
| — | `status = 'APPROVED'`, `migrated_at = now()` | **`APPROVED`, not `PUBLISHED`** — concept media becomes publicly readable only when the section using it is published |

The manifest's own `status` (`AVAILABLE_UNMIGRATED`) is manifest bookkeeping, not `content_status`.

### 9.5 Verification

```bash
# 1. Dry run changes nothing
npm run media:migrate:higgsfield -- --dry-run     # attempted 250, migrated 0, skipped 0, failed 0

# 2. Live run
npm run media:migrate:higgsfield                  # migrated 250, failed 0

# 3. Idempotency
npm run media:migrate:higgsfield                  # skipped 250, migrated 0

# 4. Counts
psql "$DATABASE_URL" -c "select resource_type, count(*) from media_assets
                         where source='HIGGSFIELD' group by 1"      -- image 224, video 26

# 5. Nothing collapsed on import — every asset ID landed as its own row
psql "$DATABASE_URL" -c "select rivya_asset_id, count(*) from media_assets
                         where source='HIGGSFIELD'
                         group by 1 having count(*) > 1"            -- 0 rows

# 6. …and so did every public ID, and every generation id
psql "$DATABASE_URL" -c "select public_id, count(*) from media_assets
                         group by 1 having count(*) > 1"            -- 0 rows
psql "$DATABASE_URL" -c "select count(*) from (select higgsfield_generation_id
                         from media_assets where source='HIGGSFIELD'
                         group by 1 having count(*) > 1) d"         -- 0

# 6b. Planned IDs never leaked into the migrated set
python scripts/media/check-asset-ids.py                             -- 0 collision(s)

# 7. Governance flags are universal
psql "$DATABASE_URL" -c "select count(*) from media_assets where source='HIGGSFIELD'
                         and (is_ai_generated is false or is_concept is false
                              or owner_verification <> 'OWNER_VERIFICATION_REQUIRED')"   -- 0

# 8. Alt text is present everywhere
psql "$DATABASE_URL" -c "select count(*) from media_assets where source='HIGGSFIELD'
                         and btrim(coalesce(alt_text,'')) = ''"     -- 0

# 9. The manifest was not touched
npm run manifest:verify && git diff --exit-code data/higgsfield/asset-manifest.json
```

Then in the Studio: `/studio/media/higgsfield` → Family `material-macro` returns 39 rows,
Page `process` returns 79, Type `video` returns 26.

### 9.6 Failure handling

| Failure | Behaviour | Recovery |
|---|---|---|
| A source URL 404s or expires mid-run | That asset is marked `FAILED` with its HTTP status; the run continues | `--resume`; if the origin is permanently gone, the asset is lost and its slot re-enters the gap analysis. **Do not regenerate it** — record it as a gap and rerun the decision gate |
| Cloudinary returns 4xx on upload | Recorded per asset with the response; the run continues | Fix the cause, `--resume` |
| A dimension mismatch | `FAILED`. The manifest is the contract, not the file | Investigate before overriding. A mismatch means the manifest and the origin have diverged |
| The run is interrupted | The ledger holds everything completed | `--resume` |
| The run exits non-zero | At least one asset failed; the summary names each one | Fix, `--resume`, re-verify |

### 9.7 After migration

- [ ] `HIGGSFIELD_ASSET_STATUS.md` regenerated — `npm run media:build-status`, then
      `git diff --exit-code` on it.
- [ ] `higgsfield_migration_runs` shows the dry run, the live run and the idempotency run.
- [ ] `data/higgsfield/migration-log.json` committed — it is how the next session knows what
      happened.
- [ ] **No code path anywhere references `d8j0ntlcm91z4.cloudfront.net`.** Grep the repo; it should
      appear only in the manifest, as provenance.
- [ ] The Higgsfield CDN is not in any CSP `img-src`, `media-src` or `connect-src` directive.

### 9.8 Migrating a v2 batch

If a `HIGGSFIELD_MASTER_ASSET_PLAN.md` §6 brief is ever executed:

1. `npm run media:assert-no-regen` passes.
2. Generation runs.
3. `scripts/media/build-higgsfield-manifest.py` **appends**, bumping `manifest_version` to
   `rivya-hf-v2`. The original 250 objects stay byte-identical; `git diff` on the manifest must
   show additions only.
4. `npm run manifest:verify`.
5. `python scripts/media/check-asset-ids.py` — the new IDs must not have borrowed a manifest
   family prefix (D6 A1).
6. Add any new folder to `lib/media/folders.ts` **before** the migration run.
7. `npm run media:migrate:higgsfield -- --resume` — the ledger skips the existing 250 and migrates
   only what is new.
8. An editor writes real alt text and binds the slot.

---

## 10. Operational limits worth knowing

| Concern | Reality | Consequence |
|---|---|---|
| Derived-asset generation is lazy | The first request for a chain generates it, then it is cached forever | The first visitor after a deploy that introduces a new preset pays a few hundred milliseconds. Warm the hero chains in the deploy smoke test |
| Storage counts originals **and** derivatives | 250 originals at up to 6336 px, times the width ladder, times two formats | The 2560 px cap and the six-preset limit are cost controls as much as performance ones |
| Transformation count is billable | Every new preset multiplies across the library | Adding a seventh preset is a decision, not a convenience. Justify it in `CHANGELOG.md` |
| Large source files slow ingest, not delivery | The 6336 px masters are ~10–20 MB each | Migration is I/O bound. Expect the 250-asset run to take minutes, not seconds; it is resumable for exactly this reason |
| `q_auto` decisions vary by content | A flat abstract macro compresses far harder than a detailed interior | Do not chase a fixed byte budget per image. Chase the LCP number |
