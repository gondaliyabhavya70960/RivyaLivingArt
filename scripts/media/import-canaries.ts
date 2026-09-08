#!/usr/bin/env node
/**
 * media:import-canaries — write the three Phase 06 canary rows.
 *
 * WHY THIS IS NOT A `content/seed/` MODULE. The seed runner matches on a `seed_key` column, and
 * `media_assets` has none. It does not need one: `rivya_asset_id` is already the D6 identity, is
 * already `citext unique`, and is what Phase 07's bulk import will key on for the other 247. Adding
 * a second identity column so this could reuse the runner would give one table two answers to
 * "which asset is this", which is exactly the drift D6 names the authoritative one to prevent.
 *
 * WHY IT IS NOT A MIGRATION. `db:check-migrations` refuses content inserts in `supabase/migrations`,
 * and it is right to: a migration is schema, and a row that can be re-imported is not.
 *
 * IDEMPOTENT, and on the same rule the content seed follows — never overwrite what a human typed.
 * `on conflict (rivya_asset_id) do update` rewrites only the PROVIDER-DERIVED columns (dimensions,
 * bytes, duration, mime) plus the provenance. It never touches `alt_text`, `title`, `caption`,
 * `tags` or `status`: those are an editor's, and re-running this after somebody improved the alt
 * text must not undo them.
 *
 * EVERY DIMENSION HERE WAS READ BACK FROM CLOUDINARY, NOT TAKEN FROM THE MANIFEST, and that
 * distinction cost a canary to learn. `LARGEFORMAT-DINING-004` is recorded in the manifest as
 * 768x1344 because that is what the generation REQUESTED; the stored file is 1080x1920. Its
 * duration is 6.041667s, not the manifest's flat 6. Anything sizing a slot from the manifest sizes
 * it from a request nobody guaranteed was honoured.
 *
 * Usage:
 *   npm run media:import-canaries -- --dry-run
 *   npm run media:import-canaries
 */
import pg from 'pg'

const DRY_RUN = process.argv.includes('--dry-run')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

type Canary = {
  rivyaAssetId: string
  publicId: string
  folder: string
  resourceType: 'image' | 'video' | 'raw'
  kind: 'IMAGE' | 'VIDEO'
  /** Read back from Cloudinary. See the header. */
  width: number
  height: number
  bytes: number
  mimeType: string
  aspectRatio: string
  durationSeconds: number | null
  higgsfieldGenerationId: string
  higgsfieldModel: string
  /**
   * Written here because the manifest carries `alt_text: null` for every asset — it records what
   * was GENERATED, not how the asset should be described. Each of these describes what is visible,
   * per SEED §43, and is derived from the generation prompt rather than invented: the prompt is
   * the most reliable statement of what the frame contains.
   *
   * None of them asserts a business fact. "A resin and timber dining table" describes a picture;
   * it does not claim Rivya has made one, which is what `is_concept` and the
   * OWNER_VERIFICATION_REQUIRED flag exist to keep straight (D10).
   */
  altText: string
}

const CANARIES: readonly Canary[] = [
  {
    rivyaAssetId: 'PROCESS-STUDIO-001',
    publicId: 'rivya/process/studio/process-studio-001-4x3',
    folder: 'rivya/process/studio',
    resourceType: 'image',
    kind: 'IMAGE',
    width: 4800,
    height: 3584,
    bytes: 463180,
    mimeType: 'image/webp',
    aspectRatio: '4:3',
    durationSeconds: null,
    higgsfieldGenerationId: '6040ceaf-8ae7-4bad-8de6-b9657875831b',
    higgsfieldModel: 'nano_banana_2',
    altText:
      'A studio tool wall photographed straight on: heat guns, notched spreaders, a digital ' +
      'scale, clamps and mixing sticks racked in order above a working bench, all visibly used.',
  },
  {
    rivyaAssetId: 'LARGEFORMAT-DINING-004',
    publicId: 'rivya/large-format/dining/largeformat-dining-004-9x16',
    folder: 'rivya/large-format/dining',
    resourceType: 'video',
    kind: 'VIDEO',
    // 1080x1920, NOT the manifest's 768x1344. See the header.
    width: 1080,
    height: 1920,
    bytes: 4609099,
    mimeType: 'video/mp4',
    aspectRatio: '9:16',
    // 6.041667, not the manifest's flat 6. Under MAX_AUTOPLAY_SECONDS either way, but the row
    // should say what the file is.
    durationSeconds: 6.041667,
    higgsfieldGenerationId: '02a61cde-e714-45c6-b7e5-f00c86e6869a',
    higgsfieldModel: 'cinematic_studio_3_0',
    altText:
      'A slow rising shot of a large live-edge dining table, a deep blue epoxy river running ' +
      'through natural walnut, in a tall daylit interior.',
  },
  {
    rivyaAssetId: 'LARGEFORMAT-MONUMENTAL-001',
    publicId: 'rivya/large-format/architectural/largeformat-monumental-001-21x9',
    folder: 'rivya/large-format/architectural',
    resourceType: 'image',
    kind: 'IMAGE',
    width: 6336,
    height: 2688,
    bytes: 344080,
    mimeType: 'image/webp',
    aspectRatio: '21:9',
    durationSeconds: null,
    higgsfieldGenerationId: '350adf43-96b6-4453-9d11-a0e09965b510',
    higgsfieldModel: 'cinematic_studio_2_5',
    altText:
      'An ultra-wide architectural lobby with a monumental freestanding resin and timber ' +
      'sculptural piece as its single statement, reflected faintly in a polished stone floor.',
  },
]

/**
 * `is_ai_generated` and `is_concept` are BOTH true on all three, and neither is negotiable.
 *
 * D6 requires the first. The second is what keeps a generated interior from being read as a
 * photograph of a room Rivya has furnished — `is_concept` never clears on any row, and
 * `owner_verification` is set so the D10 gate keeps these unpublishable until an owner decides
 * otherwise. It matches the Cloudinary context already written on each asset, so the two agree.
 */
const SQL = `
insert into media_assets (
  rivya_asset_id, provider, resource_type, public_id, folder, filename, kind, source,
  alt_text, is_ai_generated, is_concept, status, owner_verification,
  width, height, aspect_ratio, duration_s, bytes, mime_type,
  higgsfield_generation_id, higgsfield_model, manifest_version, migrated_at
) values (
  $1, 'cloudinary', $2, $3, $4, $5, $6, 'HIGGSFIELD',
  $7, true, true, 'DRAFT', 'OWNER_VERIFICATION_REQUIRED',
  $8, $9, $10, $11, $12, $13,
  $14, $15, $16, now()
)
on conflict (rivya_asset_id) do update set
  -- Provider-derived only. See the header: alt_text, title, caption, tags and status are an
  -- editor's and are never rewritten by a re-import.
  resource_type            = excluded.resource_type,
  public_id                = excluded.public_id,
  folder                   = excluded.folder,
  width                    = excluded.width,
  height                   = excluded.height,
  aspect_ratio             = excluded.aspect_ratio,
  duration_s               = excluded.duration_s,
  bytes                    = excluded.bytes,
  mime_type                = excluded.mime_type,
  higgsfield_generation_id = excluded.higgsfield_generation_id,
  higgsfield_model         = excluded.higgsfield_model,
  manifest_version         = excluded.manifest_version,
  migrated_at              = excluded.migrated_at
returning rivya_asset_id, (xmax = 0) as inserted
`

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()

  try {
    // One transaction. A half-applied canary set is worse than none, and this is the shape the
    // 247-asset run in Phase 07 needs to be resumable from.
    await client.query('begin')

    for (const c of CANARIES) {
      const filename = `${c.publicId.split('/').pop() ?? c.rivyaAssetId}.${c.mimeType.split('/')[1]}`
      const result = await client.query(SQL, [
        c.rivyaAssetId,
        c.resourceType,
        c.publicId,
        c.folder,
        filename,
        c.kind,
        c.altText,
        c.width,
        c.height,
        c.aspectRatio,
        c.durationSeconds,
        c.bytes,
        c.mimeType,
        c.higgsfieldGenerationId,
        c.higgsfieldModel,
        'rivya-v1',
      ])
      const row = result.rows[0] as { rivya_asset_id: string; inserted: boolean }
      console.log(`  ${row.inserted ? 'inserted' : 'updated '}  ${row.rivya_asset_id}`)
    }

    if (DRY_RUN) {
      await client.query('rollback')
      console.log('\n▸ --dry-run: rolled back, nothing written')
    } else {
      await client.query('commit')
      console.log(`\n✓ ${CANARIES.length} canary rows applied`)
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
