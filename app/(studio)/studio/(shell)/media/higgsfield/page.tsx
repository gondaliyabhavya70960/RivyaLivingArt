import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import {
  HiggsfieldTracker,
  isTrackerTab,
  type TrackerTab,
} from '@/components/studio/HiggsfieldTracker'
import type { DrawerAsset } from '@/components/studio/HiggsfieldAssetDrawer'
import { requirePermission } from '@/lib/auth/require'
import { computeGaps } from '@/lib/media/gaps'
import { parseManifest, type ManifestAsset } from '@/lib/media/manifest'
import { createClient } from '@/lib/supabase/server'
import manifestJson from '@/data/higgsfield/asset-manifest.json'

/**
 * /studio/media/higgsfield — the Higgsfield tracker.
 *
 * THE MANIFEST IS A STATIC IMPORT, NOT A FILE READ. `readManifest()` uses `readFileSync` on a
 * working-directory-relative path, which Next.js does not trace into a serverless bundle — the
 * page would build clean and then 500 with ENOENT in production. Importing the JSON makes the
 * bundler responsible for shipping it, and `parseManifest` still validates it against the same
 * Zod schema, so a malformed manifest fails loudly here exactly as it does in the CLI. The 469 KB
 * lands in the server bundle only; nothing in it reaches the browser.
 *
 * TWO QUERIES, AND BOTH TOLERATE AN EMPTY TABLE. Before the migration runs, `media_assets` holds
 * no Higgsfield rows and `media_usages` holds none at all — the tracker's whole job at that point
 * is to say so. Neither absence is an error state.
 */
export const metadata = studioMetadata('/studio/media/higgsfield')

const PATH = '/studio/media/higgsfield'

/** The manifest, parsed once per server process rather than on every request. */
const MANIFEST = parseManifest(manifestJson)

function toDrawerAsset(asset: ManifestAsset, migrated: boolean): DrawerAsset {
  return {
    rivyaAssetId: asset.rivya_asset_id,
    family: asset.family,
    page: asset.page,
    aspectRatio: asset.aspect_ratio,
    model: asset.higgsfield_model,
    generationId: asset.higgsfield_generation_id,
    publicId: asset.cloudinary_public_id,
    width: asset.width,
    height: asset.height,
    prompt: asset.prompt,
    altTextDraft: asset.alt_text_draft,
    migrated,
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // First line of the body. `proxy.ts` decides authentication and nothing else, and this page is
  // reachable by a role holding `studio.access` without `media.read`.
  await requirePermission('media.read')

  const params = await searchParams
  const tab: TrackerTab = isTrackerTab(params.tab) ? params.tab : 'inventory'
  const assetParam = typeof params.asset === 'string' ? params.asset : null

  const client = await createClient()

  // Only the one column is selected: this is a membership test over 250 ids, and pulling whole
  // rows to build a Set of one field would move a megabyte to answer a boolean.
  const { data: migratedRows } = await client
    .from('media_assets')
    .select('higgsfield_generation_id')
    .not('higgsfield_generation_id', 'is', null)

  const migratedGenerationIds = new Set(
    (migratedRows ?? [])
      .map((row) => row.higgsfield_generation_id)
      .filter((id): id is string => id !== null),
  )

  const { data: usageRows } = await client.from('media_usages').select('slot_key')

  const report = computeGaps({
    assets: MANIFEST.assets,
    bindings: usageRows ?? [],
  })

  // An `?asset=` naming nothing real resolves to null, which closes the drawer rather than
  // throwing. A stale link in somebody's messages should not 500 the page.
  const found =
    assetParam === null ? undefined : MANIFEST.assets.find((a) => a.rivya_asset_id === assetParam)
  const selected =
    found === undefined
      ? null
      : toDrawerAsset(found, migratedGenerationIds.has(found.higgsfield_generation_id))

  return (
    <StudioPage path={PATH}>
      <HiggsfieldTracker
        path={PATH}
        tab={tab}
        assets={MANIFEST.assets}
        report={report}
        migratedGenerationIds={migratedGenerationIds}
        selected={selected}
      />
    </StudioPage>
  )
}
