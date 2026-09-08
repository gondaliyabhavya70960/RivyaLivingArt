import type { ManifestAsset } from './manifest'
import { kindFor, resourceTypeFor } from './manifest'

/**
 * The Higgsfield migration, as pure functions.
 *
 * WHY THIS IS NOT IN THE SCRIPT. `scripts/media/migrate-higgsfield.ts` is CLI wiring: argument
 * parsing, a database connection, a Cloudinary client, console output. None of that can be unit
 * tested without a network and a database, and all of the DECISIONS — which assets to attempt,
 * what a row should contain, when a ledger entry counts as done — can be. So they live here, and
 * the script is the thin part.
 *
 * THE UPLOADER IS AN INTERFACE FOR THE SAME REASON. `tests/unit/higgsfield-migration.test.ts`
 * drives a fake through the whole run and asserts idempotency, resume behaviour and the
 * renumbering case against 250 real manifest rows, with nothing on the wire.
 */

/** What Cloudinary reports back about a stored asset. The row believes this, not the manifest. */
export type UploadedAsset = {
  readonly publicId: string
  readonly bytes: number
  readonly width: number | null
  readonly height: number | null
  readonly durationSeconds: number | null
  readonly format: string
}

export type UploadRequest = {
  readonly sourceUrl: string
  readonly publicId: string
  readonly resourceType: 'image' | 'video'
  readonly tags: readonly string[]
  /** `key=value|key=value`. Carries provenance onto the file itself, not only into the row. */
  readonly context: string
}

export interface AssetUploader {
  /**
   * Upload from a remote URL. Cloudinary fetches it server-side, which is why the machine running
   * this needs no route to the Higgsfield CDN — only to Cloudinary.
   *
   * MUST be called with `overwrite: false` semantics by the implementation: re-running the
   * migration may never replace bytes already stored under a manifest public id.
   */
  upload(request: UploadRequest): Promise<UploadedAsset>
  /** What is already stored under this id, or null. Lets a run resume without re-uploading. */
  probe(publicId: string, resourceType: 'image' | 'video'): Promise<UploadedAsset | null>
}

// --- the ledger ---------------------------------------------------------------------------------

/**
 * `data/higgsfield/migration-log.json`, keyed by `higgsfield_generation_id`.
 *
 * WHY THAT KEY AND NOT `rivya_asset_id`. The asset id is the business identity (D6) and it is what
 * the row is keyed on — but it is ALLOCATED BY THE MANIFEST BUILDER, and rebuilding the manifest
 * renumbers a family whose membership changed. `PROCESS-POUR-004` can legitimately become
 * `PROCESS-POUR-005`. The generation id cannot: it names the Higgsfield run that produced the
 * pixels, and no rebuild touches it.
 *
 * So a rebuild that renumbers a family must produce 250 SKIPS, not 250 re-uploads under new ids.
 * That is the property `tests/unit/higgsfield-migration.test.ts` asserts against a shifted fixture.
 */
export type LedgerEntry = {
  readonly rivyaAssetId: string
  readonly publicId: string
  readonly resourceType: 'image' | 'video'
  readonly uploadedAt: string
  readonly bytes: number
  /** Present when the upload failed. An entry with a failure is retried by a later run. */
  readonly error?: string
}

export type Ledger = {
  readonly manifestVersion: string
  /** Keyed by `higgsfield_generation_id`. */
  readonly entries: Record<string, LedgerEntry>
}

export const EMPTY_LEDGER: Ledger = { manifestVersion: '', entries: {} }

/** Done means uploaded without an error. A failed entry is not done and will be retried. */
export function isDone(ledger: Ledger, asset: ManifestAsset): boolean {
  const entry = ledger.entries[asset.higgsfield_generation_id]
  return entry !== undefined && entry.error === undefined
}

export function recordSuccess(
  ledger: Ledger,
  asset: ManifestAsset,
  uploaded: UploadedAsset,
  now: string,
): Ledger {
  return {
    manifestVersion: ledger.manifestVersion,
    entries: {
      ...ledger.entries,
      [asset.higgsfield_generation_id]: {
        rivyaAssetId: asset.rivya_asset_id,
        publicId: uploaded.publicId,
        resourceType: resourceTypeFor(asset),
        uploadedAt: now,
        bytes: uploaded.bytes,
      },
    },
  }
}

export function recordFailure(
  ledger: Ledger,
  asset: ManifestAsset,
  error: string,
  now: string,
): Ledger {
  return {
    manifestVersion: ledger.manifestVersion,
    entries: {
      ...ledger.entries,
      [asset.higgsfield_generation_id]: {
        rivyaAssetId: asset.rivya_asset_id,
        publicId: asset.cloudinary_public_id,
        resourceType: resourceTypeFor(asset),
        uploadedAt: now,
        bytes: 0,
        error,
      },
    },
  }
}

// --- planning a run -----------------------------------------------------------------------------

export type RunScope = {
  /** `--family=process-pour`. Absent means every family. */
  readonly family?: string
  /** `--limit=10`. Applied AFTER the family filter and after skips are removed. */
  readonly limit?: number
}

export type RunPlan = {
  /** Assets this run will attempt to upload. */
  readonly attempt: readonly ManifestAsset[]
  /** Assets the ledger already has, which this run will not touch. */
  readonly skip: readonly ManifestAsset[]
  /** What `--family=`/`--limit=` narrowed to, for the run record. */
  readonly requestedScope: string
}

/**
 * Decide what a run does, before it does any of it.
 *
 * `--limit` APPLIES AFTER SKIPS ARE REMOVED, and that ordering is the useful one: `--limit=10` on
 * a half-finished migration should upload ten MORE assets, not re-examine the first ten and
 * discover they are all done. The other reading makes the flag useless for exactly the case it
 * exists for.
 */
export function planRun(
  assets: readonly ManifestAsset[],
  ledger: Ledger,
  scope: RunScope = {},
): RunPlan {
  const inScope =
    scope.family === undefined ? assets : assets.filter((a) => a.family === scope.family)

  const skip = inScope.filter((a) => isDone(ledger, a))
  const pending = inScope.filter((a) => !isDone(ledger, a))
  const attempt = scope.limit === undefined ? pending : pending.slice(0, scope.limit)

  const parts: string[] = []
  if (scope.family !== undefined) parts.push(`family=${scope.family}`)
  if (scope.limit !== undefined) parts.push(`limit=${String(scope.limit)}`)

  return { attempt, skip, requestedScope: parts.length === 0 ? 'all' : parts.join(' ') }
}

// --- the row ------------------------------------------------------------------------------------

/**
 * The `media_assets` row an asset imports as. One place, so the field mapping in PHASE-05-09.md
 * §07 has exactly one implementation and a test can read it.
 */
export type MediaAssetImportRow = {
  rivya_asset_id: string
  provider: 'cloudinary'
  resource_type: 'image' | 'video'
  public_id: string
  folder: string
  filename: string
  kind: 'IMAGE' | 'VIDEO'
  source: 'HIGGSFIELD'
  alt_text: string
  is_ai_generated: true
  is_concept: true
  status: 'APPROVED'
  owner_verification: 'OWNER_VERIFICATION_REQUIRED'
  tags: string[]
  subject_tags: string[]
  aspect_ratio: string
  width: number | null
  height: number | null
  duration_s: number | null
  bytes: number
  mime_type: string
  higgsfield_generation_id: string
  higgsfield_model: string
  higgsfield_prompt: string
  manifest_version: string
}

/**
 * Map a manifest asset plus what Cloudinary reported into a row.
 *
 * DIMENSIONS COME FROM CLOUDINARY, NOT THE MANIFEST, and one canary is why. The manifest records
 * `LARGEFORMAT-DINING-004` as 768×1344 because that is what the generation REQUESTED; the stored
 * file is 1080×1920, and its duration is 6.041667s rather than the manifest's flat 6. Anything
 * sizing a slot from the manifest sizes it from a request nobody guaranteed was honoured.
 *
 * THE ASPECT RATIO LABEL DOES COME FROM THE MANIFEST, and that is not a contradiction. `9:16` is
 * the SLOT this asset was generated for — an editorial decision — while width and height are what
 * the file happens to be. For that canary the two agree (1080×1920 is 9:16); where they ever
 * disagree, the label is what a CMS slot matches on and the pixels are what the delivery URL uses.
 *
 * `status = 'APPROVED'`, NEVER `PUBLISHED`. These are concept assets: reviewed enough to bind to a
 * slot, not cleared for public delivery. Phase 06's RLS grants anon SELECT only where
 * `status = 'PUBLISHED'`, so an APPROVED asset is invisible to the public site until the Phase 08
 * publishing service promotes it explicitly. Importing them as PUBLISHED would put 250 unreviewed
 * AI images on the public API the moment the site had a page.
 */
export function toMediaAssetRow(
  asset: ManifestAsset,
  uploaded: UploadedAsset,
  manifestVersion: string,
): MediaAssetImportRow {
  return {
    rivya_asset_id: asset.rivya_asset_id,
    provider: 'cloudinary',
    resource_type: resourceTypeFor(asset),
    public_id: uploaded.publicId,
    folder: asset.cloudinary_folder,
    filename: asset.filename,
    kind: kindFor(asset),
    source: 'HIGGSFIELD',
    // The DRAFT. Left OWNER_VERIFICATION_REQUIRED until an editor rewrites it; Phase 09's exit
    // criteria require review of every alt text bound to a seeded slot.
    alt_text: asset.alt_text_draft,
    is_ai_generated: true,
    is_concept: true,
    status: 'APPROVED',
    owner_verification: 'OWNER_VERIFICATION_REQUIRED',
    // `page:` and `section:` are prefixed tags rather than columns because they are FILTERS on a
    // tracker, not properties of the asset — the same picture can be re-placed on another page
    // without becoming a different asset. The family is a bare tag: it is the asset's own lineage.
    tags: [asset.family, `page:${asset.page}`, `section:${asset.section}`],
    subject_tags: asset.subject_tags,
    aspect_ratio: asset.aspect_ratio,
    width: uploaded.width,
    height: uploaded.height,
    duration_s: uploaded.durationSeconds,
    bytes: uploaded.bytes,
    mime_type: `${resourceTypeFor(asset)}/${uploaded.format}`,
    higgsfield_generation_id: asset.higgsfield_generation_id,
    higgsfield_model: asset.higgsfield_model,
    higgsfield_prompt: asset.prompt,
    manifest_version: manifestVersion,
  }
}

/** The Cloudinary context string carrying provenance onto the file itself. */
export function contextFor(asset: ManifestAsset): string {
  return [
    `rivya_asset_id=${asset.rivya_asset_id}`,
    'is_ai_generated=true',
    'is_concept=true',
    'owner_verification=OWNER_VERIFICATION_REQUIRED',
    `source_variant=${asset.type === 'video' ? 'original' : 'min_webp'}`,
  ].join('|')
}

/** The tags Cloudinary carries, so the account is navigable without the database. */
export function cloudinaryTagsFor(asset: ManifestAsset): string[] {
  return ['rivya', 'higgsfield', 'ai-concept', asset.family]
}
