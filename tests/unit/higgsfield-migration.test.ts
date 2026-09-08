import { describe, expect, it } from 'vitest'

import {
  byFamily,
  kindFor,
  readManifest,
  resourceTypeFor,
  sourceUrlFor,
  type ManifestAsset,
} from '@/lib/media/manifest'
import {
  EMPTY_LEDGER,
  cloudinaryTagsFor,
  contextFor,
  isDone,
  planRun,
  recordFailure,
  recordSuccess,
  toMediaAssetRow,
  type AssetUploader,
  type Ledger,
  type UploadedAsset,
} from '@/lib/media/migration'

/**
 * The Higgsfield migration, driven end to end against the REAL 250-asset manifest with a fake
 * uploader and no database.
 *
 * WHY A FAKE RATHER THAN A MOCKED CLOUDINARY. The properties worth proving here are not "does the
 * SDK get called" — they are: a second run uploads nothing, a rebuilt manifest that renumbers a
 * family still uploads nothing, and a failed asset is retried while its neighbours are not. All
 * three are statements about the LEDGER and the plan, and a fake that counts uploads proves them
 * more directly than an assertion on a call argument.
 *
 * The real manifest is used rather than a fixture because the numbers in the phase document — 250,
 * 224 images, 26 videos, 24 families — are claims about that file, and a fixture would let it
 * drift out from under them.
 */

const manifest = readManifest()
const ASSETS = manifest.assets

/** Counts uploads and reports whatever Cloudinary would, deterministically. */
function fakeUploader(): AssetUploader & { uploads: string[] } {
  const uploads: string[] = []
  return {
    uploads,
    async upload(request) {
      uploads.push(request.publicId)
      return {
        publicId: request.publicId,
        bytes: 123456,
        width: request.resourceType === 'video' ? 1080 : 4800,
        height: request.resourceType === 'video' ? 1920 : 3584,
        durationSeconds: request.resourceType === 'video' ? 6.041667 : null,
        format: request.resourceType === 'video' ? 'mp4' : 'webp',
      }
    },
    async probe() {
      return null
    },
  }
}

/** Run the plan to completion against a fake, returning the ledger and the upload count. */
async function runMigration(
  assets: readonly ManifestAsset[],
  ledger: Ledger,
  uploader: AssetUploader & { uploads: string[] },
): Promise<{ ledger: Ledger; uploaded: number; skipped: number }> {
  const plan = planRun(assets, ledger)
  let next = ledger
  for (const asset of plan.attempt) {
    const result = await uploader.upload({
      sourceUrl: sourceUrlFor(asset),
      publicId: asset.cloudinary_public_id,
      resourceType: resourceTypeFor(asset),
      tags: cloudinaryTagsFor(asset),
      context: contextFor(asset),
    })
    next = recordSuccess(next, asset, result, '2026-09-08T00:00:00.000Z')
  }
  return { ledger: next, uploaded: plan.attempt.length, skipped: plan.skip.length }
}

describe('the manifest, as the phase document describes it', () => {
  it('holds 250 assets: 224 images and 26 videos across 24 families', () => {
    expect(ASSETS).toHaveLength(250)
    expect(ASSETS.filter((a) => a.type === 'image')).toHaveLength(224)
    expect(ASSETS.filter((a) => a.type === 'video')).toHaveLength(26)
    expect(byFamily(ASSETS).size).toBe(24)
    expect(manifest.manifest_version).toBe('rivya-hf-v1')
  })

  it('has no duplicate in any of the three identity fields', () => {
    // The migration relies on all three, for different reasons — the phase document's table. Any
    // duplicate here means a row the migration would either overwrite or double-insert.
    for (const field of [
      'rivya_asset_id',
      'cloudinary_public_id',
      'higgsfield_generation_id',
    ] as const) {
      expect(new Set(ASSETS.map((a) => a[field])).size, field).toBe(250)
    }
  })

  it('resolves an upload URL for every asset, images from the webp variant', () => {
    // The lesson a canary cost: the originals are 20 MB PNGs against a 10 MB image cap.
    for (const asset of ASSETS) {
      const url = sourceUrlFor(asset)
      if (asset.type === 'image') expect(url, asset.rivya_asset_id).toBe(asset.source_min_url)
      else expect(url, asset.rivya_asset_id).toBe(asset.source_url)
    }
  })

  it('refuses an image with no webp variant rather than falling back to the original', () => {
    const image = ASSETS.find((a) => a.type === 'image')
    expect(image).toBeDefined()
    // Silently uploading the PNG would fail at Cloudinary anyway, with a message about bytes
    // rather than about which asset.
    expect(() => sourceUrlFor({ ...(image as ManifestAsset), source_min_url: null })).toThrow(
      /source_min_url/,
    )
  })
})

describe('a full migration run', () => {
  it('attempts all 250 on a clean ledger and skips none', async () => {
    const uploader = fakeUploader()
    const result = await runMigration(ASSETS, EMPTY_LEDGER, uploader)

    expect(result.uploaded).toBe(250)
    expect(result.skipped).toBe(0)
    expect(uploader.uploads).toHaveLength(250)
    expect(new Set(uploader.uploads).size).toBe(250)
  })

  it('is idempotent: a second run uploads nothing and skips 250', async () => {
    const first = await runMigration(ASSETS, EMPTY_LEDGER, fakeUploader())

    const second = fakeUploader()
    const result = await runMigration(ASSETS, first.ledger, second)

    expect(result.uploaded).toBe(0)
    expect(result.skipped).toBe(250)
    expect(second.uploads).toHaveLength(0)
  })

  it('survives a manifest rebuild that renumbers a family', async () => {
    // The risk the phase document names. The ledger key is higgsfield_generation_id, which no
    // rebuild touches; rivya_asset_id is what a rebuild CAN change. If the ledger were keyed on
    // the asset id this would re-upload a whole family under new ids and double the library.
    const first = await runMigration(ASSETS, EMPTY_LEDGER, fakeUploader())

    const renumbered = ASSETS.map((a) =>
      a.family === 'process-pour'
        ? { ...a, rivya_asset_id: a.rivya_asset_id.replace(/(\d+)$/, (n) => String(Number(n) + 1)) }
        : a,
    )
    // The shift is real, or the test proves nothing.
    expect(
      renumbered.filter((a, i) => a.rivya_asset_id !== ASSETS[i]?.rivya_asset_id),
    ).toHaveLength(12)

    const second = fakeUploader()
    const result = await runMigration(renumbered, first.ledger, second)

    expect(result.uploaded).toBe(0)
    expect(result.skipped).toBe(250)
    expect(second.uploads).toHaveLength(0)
  })

  it('retries a failed asset and leaves its neighbours alone', async () => {
    const target = ASSETS[0] as ManifestAsset
    const withFailure = recordFailure(EMPTY_LEDGER, target, 'HTTP 504', '2026-09-08T00:00:00.000Z')

    expect(isDone(withFailure, target)).toBe(false)

    const plan = planRun(ASSETS, withFailure)
    // 250 attempted: the failure is not done, and nothing else has an entry at all.
    expect(plan.attempt).toHaveLength(250)
    expect(plan.attempt.map((a) => a.rivya_asset_id)).toContain(target.rivya_asset_id)
  })
})

describe('scoping a run', () => {
  it('narrows to one family', () => {
    const plan = planRun(ASSETS, EMPTY_LEDGER, { family: 'process-pour' })
    expect(plan.attempt).toHaveLength(12)
    expect(plan.requestedScope).toBe('family=process-pour')
  })

  it('applies --limit AFTER removing what is already done', async () => {
    // The useful reading: --limit=10 on a half-finished migration uploads ten MORE, rather than
    // re-examining the first ten and reporting they are done. The other reading makes the flag
    // useless for the case it exists for.
    const first = await runMigration(ASSETS.slice(0, 100), EMPTY_LEDGER, fakeUploader())

    const plan = planRun(ASSETS, first.ledger, { limit: 10 })
    expect(plan.attempt).toHaveLength(10)
    expect(plan.skip).toHaveLength(100)
    // None of the ten is one of the hundred already done.
    const done = new Set(ASSETS.slice(0, 100).map((a) => a.rivya_asset_id))
    for (const asset of plan.attempt) expect(done.has(asset.rivya_asset_id)).toBe(false)
  })

  it('reports the scope for the run record', () => {
    expect(planRun(ASSETS, EMPTY_LEDGER).requestedScope).toBe('all')
    expect(planRun(ASSETS, EMPTY_LEDGER, { family: 'wall-art', limit: 3 }).requestedScope).toBe(
      'family=wall-art limit=3',
    )
  })
})

describe('the row a manifest asset becomes', () => {
  const asset = ASSETS.find((a) => a.rivya_asset_id === 'PROCESS-STUDIO-001') as ManifestAsset
  const uploaded: UploadedAsset = {
    publicId: asset.cloudinary_public_id,
    bytes: 463180,
    width: 4800,
    height: 3584,
    durationSeconds: null,
    format: 'webp',
  }
  const row = toMediaAssetRow(asset, uploaded, manifest.manifest_version)

  it('carries the provenance that keeps concept media identifiable', () => {
    expect(row.source).toBe('HIGGSFIELD')
    expect(row.is_ai_generated).toBe(true)
    expect(row.is_concept).toBe(true)
    expect(row.owner_verification).toBe('OWNER_VERIFICATION_REQUIRED')
    expect(row.manifest_version).toBe('rivya-hf-v1')
  })

  it('is APPROVED and never PUBLISHED', () => {
    // Phase 06 RLS grants anon SELECT only where status = 'PUBLISHED'. Importing as PUBLISHED
    // would put 250 unreviewed AI images on the public API the moment the site had a page.
    expect(row.status).toBe('APPROVED')
  })

  it('takes dimensions from CLOUDINARY and the ratio label from the manifest', () => {
    // The manifest records what the generation REQUESTED; Cloudinary reports what was stored.
    const video = ASSETS.find((a) => a.rivya_asset_id === 'LARGEFORMAT-DINING-004') as ManifestAsset
    const probed: UploadedAsset = {
      publicId: video.cloudinary_public_id,
      bytes: 4609099,
      width: 1080,
      height: 1920,
      durationSeconds: 6.041667,
      format: 'mp4',
    }
    const videoRow = toMediaAssetRow(video, probed, manifest.manifest_version)

    expect(video.width).toBe(768) // what the manifest says the generation asked for
    expect(videoRow.width).toBe(1080) // what Cloudinary actually stored
    expect(videoRow.duration_s).toBe(6.041667) // not the manifest's flat 6
    expect(videoRow.aspect_ratio).toBe('9:16') // the SLOT label, which both agree on here
  })

  it('imports the draft alt text rather than inventing one', () => {
    expect(row.alt_text).toBe(asset.alt_text_draft)
    expect(row.alt_text.length).toBeGreaterThan(0)
  })

  it('tags page and section as filters, and the family bare', () => {
    expect(row.tags).toEqual(['process-studio', 'page:process', 'section:studio'])
  })

  it('gives every one of the 250 a non-empty alt text and a mime type', () => {
    for (const a of ASSETS) {
      const r = toMediaAssetRow(
        a,
        {
          publicId: a.cloudinary_public_id,
          bytes: 1,
          width: 1,
          height: 1,
          durationSeconds: null,
          format: 'webp',
        },
        manifest.manifest_version,
      )
      expect(r.alt_text.trim().length, a.rivya_asset_id).toBeGreaterThan(0)
      expect(r.mime_type, a.rivya_asset_id).toMatch(/^(image|video)\//)
      expect(r.kind, a.rivya_asset_id).toBe(kindFor(a))
    }
  })
})

describe('what travels onto the file itself', () => {
  const asset = ASSETS[0] as ManifestAsset

  it('writes provenance into the Cloudinary context', () => {
    // So the AI-concept provenance survives even for somebody looking at the Cloudinary account
    // with no access to this repository or the database.
    const context = contextFor(asset)
    expect(context).toContain(`rivya_asset_id=${asset.rivya_asset_id}`)
    expect(context).toContain('is_concept=true')
    expect(context).toContain('owner_verification=OWNER_VERIFICATION_REQUIRED')
  })

  it('records which source variant was uploaded', () => {
    const image = ASSETS.find((a) => a.type === 'image') as ManifestAsset
    const video = ASSETS.find((a) => a.type === 'video') as ManifestAsset
    expect(contextFor(image)).toContain('source_variant=min_webp')
    expect(contextFor(video)).toContain('source_variant=original')
  })

  it('tags the account so it is navigable without the database', () => {
    expect(cloudinaryTagsFor(asset)).toEqual(['rivya', 'higgsfield', 'ai-concept', asset.family])
  })

  it('never puts a raw prompt in the context', () => {
    // Context values are pipe-and-equals delimited; a prompt contains neither reliably, and a
    // prompt with a `|` would inject a second pair. The prompt belongs in the row, not the file.
    expect(contextFor(asset)).not.toContain(asset.prompt.slice(0, 20))
  })
})
