import { readFileSync } from 'node:fs'

import { z } from 'zod'

/**
 * Reading `data/higgsfield/asset-manifest.json`.
 *
 * THE MANIFEST IS READ-ONLY INPUT, EVERYWHERE. Phase 07's exit criteria require it to be
 * byte-identical to its pre-phase state, and nothing in this module or anything importing it ever
 * writes to it. Runtime status lives in `media_assets`; migration progress lives in the ledger.
 * The Python builder that produces it is not re-run as part of this phase.
 *
 * ZOD, EVEN THOUGH THE FILE IS COMMITTED. It is committed, but it is also REGENERATED — by
 * `scripts/media/build-higgsfield-manifest.py`, which is a different language with its own idea of
 * what a field is called. A rebuild that renames `alt_text_draft` or drops `source_min_url` should
 * fail here, loudly, naming the field — not three layers later as `undefined` written into a
 * `not null` column. That is the trust boundary the house style means.
 *
 * WHICH URL TO UPLOAD FROM IS NOT A DETAIL — see `sourceUrlFor`. Getting it wrong is what the
 * first Phase 06 canary cost, and the manifest's own shape is the evidence: `source_min_url` holds
 * a URL on exactly the 224 images and is null on all 26 videos.
 */

/** D6's eight, as the manifest spells them. */
const aspectRatio = z.enum(['21:9', '16:9', '4:3', '3:2', '1:1', '4:5', '3:4', '9:16'])

export const manifestAssetSchema = z.object({
  rivya_asset_id: z.string().min(1),
  filename: z.string().min(1),
  type: z.enum(['image', 'video']),
  family: z.string().min(1),
  subject_tags: z.array(z.string()),
  page: z.string().min(1),
  section: z.string().min(1),
  cloudinary_folder: z.string().min(1),
  cloudinary_public_id: z.string().min(1),
  aspect_ratio: aspectRatio,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration_s: z.number().positive().nullable(),
  source: z.literal('higgsfield'),
  higgsfield_generation_id: z.string().min(1),
  higgsfield_model: z.string().min(1),
  source_url: z.string().url(),
  /**
   * `null` on all 26 videos, a URL on all 224 images.
   *
   * NULLABLE, NOT OPTIONAL. The first version of this schema had it `.optional()`, on the
   * assumption that the Python builder omits the key rather than writing null. It does not — the
   * key is present on all 250 and explicitly null on the videos. The schema failed on its very
   * first run against the real file and named `assets.224.source_min_url`, which is the whole
   * reason for parsing a committed file at all.
   */
  source_min_url: z.string().url().nullable(),
  prompt: z.string().min(1),
  /**
   * Non-empty on all 250. It is a DRAFT — imported into `alt_text` and left
   * `OWNER_VERIFICATION_REQUIRED` until an editor rewrites it. `.min(1)` because the column it
   * lands in is `not null` and non-empty, so an empty draft would fail at the constraint with a
   * message that names the column rather than the manifest.
   */
  alt_text_draft: z.string().min(1),
  is_ai_generated: z.literal(true),
  is_concept: z.literal(true),
  owner_verification: z.literal('OWNER_VERIFICATION_REQUIRED'),
  status: z.string().min(1),
  used_in_cms: z.boolean(),
  cms_placement: z.string().nullable(),
})

export type ManifestAsset = z.infer<typeof manifestAssetSchema>

export const manifestSchema = z.object({
  manifest_version: z.string().min(1),
  assets: z.array(manifestAssetSchema).min(1),
})

export type Manifest = z.infer<typeof manifestSchema>

export const MANIFEST_PATH = 'data/higgsfield/asset-manifest.json'

/**
 * `is_ai_generated`, `is_concept` and `owner_verification` are `z.literal` above rather than
 * `z.boolean()`/`z.string()`, and that is deliberate.
 *
 * All 250 carry the same value for each, and they are the three fields that keep concept media
 * from being read as delivered work (D10). If a rebuild ever produced an asset with
 * `is_concept: false`, the honest outcome is a loud parse failure naming the asset — not a silent
 * import of a row that claims Rivya photographed something it generated.
 */
export function parseManifest(value: unknown, source: string = MANIFEST_PATH): Manifest {
  const parsed = manifestSchema.safeParse(value)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new Error(
      `${source} does not match the expected shape: ` +
        `${first?.path.join('.') ?? '(root)'} — ${first?.message ?? 'unknown issue'}. ` +
        `${parsed.error.issues.length} issue(s) total. The manifest is read-only input; ` +
        'if the builder changed, lib/media/manifest.ts is what needs updating, not the file.',
    )
  }
  return parsed.data
}

/**
 * Read and validate the manifest from disk. CLI and test paths only.
 *
 * THE STUDIO MUST NOT USE THIS, and the split above is what gives it an alternative. A Server
 * Component running on Vercel has no reliable working directory and Next.js does not trace a
 * `readFileSync` on a runtime-computed path into the serverless bundle — the page would build
 * clean and then 500 in production with ENOENT, which is the worst place to discover it. The
 * Studio statically imports the JSON (so the bundler includes it) and calls `parseManifest`; a
 * script that already has a filesystem calls this.
 */
export function readManifest(path: string = MANIFEST_PATH): Manifest {
  return parseManifest(JSON.parse(readFileSync(path, 'utf8')), path)
}

/**
 * The URL an asset should be uploaded FROM.
 *
 * IMAGES USE `source_min_url`, AND THIS IS THE LESSON A CANARY COST. The Higgsfield originals are
 * 4800×3584-class PNGs running past 20 MB, and the Cloudinary Free plan caps an image at 10 MB —
 * `PROCESS-STUDIO-001` was rejected outright with "File size too large. Got 21796736. Maximum is
 * 10485760." The `_min.webp` variant is NOT a downscale: same 4800×3584 pixels, webp-compressed to
 * 463 KB. A 47× reduction with no loss of resolution.
 *
 * VIDEOS HAVE NO SUCH VARIANT AND NEED NONE. All 26 carry `source_min_url: null`, and the largest
 * uploaded from its original at 4.6 MB against a 100 MB video cap.
 *
 * So the rule is not "prefer the smaller URL" — it is "images have a webp variant and must use it;
 * videos do not and must not be expected to have one". A missing `source_min_url` on an IMAGE is
 * therefore an error worth raising rather than a fallback worth taking: silently uploading the
 * 20 MB PNG would fail at Cloudinary anyway, and the message there names bytes rather than the
 * asset.
 */
export function sourceUrlFor(asset: ManifestAsset): string {
  if (asset.type === 'video') return asset.source_url

  if (asset.source_min_url === null) {
    throw new Error(
      `${asset.rivya_asset_id} is an image with no source_min_url. The original is a PNG that ` +
        'exceeds the 10 MB image cap; see docs/media/CLOUDINARY.md on the Phase 06 canaries. ' +
        'Rebuild the manifest rather than uploading source_url.',
    )
  }
  return asset.source_min_url
}

/** Cloudinary's namespace for an asset. A video is not reachable under `image/upload`. */
export function resourceTypeFor(asset: ManifestAsset): 'image' | 'video' {
  return asset.type
}

/** The `media_kind` an asset imports as. The manifest holds only images and videos. */
export function kindFor(asset: ManifestAsset): 'IMAGE' | 'VIDEO' {
  return asset.type === 'video' ? 'VIDEO' : 'IMAGE'
}

/** Assets grouped by `family`, in manifest order. Used by the Families tab and the status doc. */
export function byFamily(assets: readonly ManifestAsset[]): Map<string, ManifestAsset[]> {
  const families = new Map<string, ManifestAsset[]>()
  for (const asset of assets) {
    const list = families.get(asset.family)
    if (list === undefined) families.set(asset.family, [asset])
    else list.push(asset)
  }
  return families
}
