import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import {
  HiggsfieldTracker,
  isTrackerTab,
  type TrackerTab,
} from '@/components/studio/HiggsfieldTracker'
import type { DrawerAsset } from '@/components/studio/HiggsfieldAssetDrawer'
import { requirePermission } from '@/lib/auth/require'
import { computeGaps } from '@/lib/media/gaps'
import { buildInventory, parseInventoryFilters } from '@/lib/media/inventory'
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

  // Three columns, not whole rows. `id` is what `media_usages.media_id` points at, the generation
  // id is the migration key, and `rivya_asset_id` is what the manifest is keyed by — joining the
  // three in memory over 250 rows is cheaper than a view and keeps the query readable.
  const { data: assetRows } = await client
    .from('media_assets')
    .select('id, rivya_asset_id, higgsfield_generation_id')
    .not('higgsfield_generation_id', 'is', null)

  const rows = assetRows ?? []
  const migratedGenerationIds = new Set(
    rows.map((row) => row.higgsfield_generation_id).filter((id): id is string => id !== null),
  )
  // `rivya_asset_id` is nullable on `media_assets` — an uploaded asset has no manifest id. A row
  // without one cannot be matched to a manifest entry, so it is dropped rather than keyed on null.
  const assetIdByMediaId = new Map(
    rows
      .filter((row): row is typeof row & { rivya_asset_id: string } => row.rivya_asset_id !== null)
      .map((row) => [row.id, row.rivya_asset_id]),
  )

  const { data: usageRows } = await client.from('media_usages').select('media_id, slot_key')
  const usages = usageRows ?? []

  // FEAT §34's "Used?" and "CMS placement", from `media_usages` rather than from the manifest's
  // own `used_in_cms`/`cms_placement` fields — those are false and null on all 250 and always
  // will be, because the manifest records what was generated, not what the CMS does with it.
  const slotKeysByAssetId = new Map<string, string[]>()
  for (const usage of usages) {
    const assetId = assetIdByMediaId.get(usage.media_id)
    if (assetId === undefined) continue
    const list = slotKeysByAssetId.get(assetId)
    if (list) list.push(usage.slot_key)
    else slotKeysByAssetId.set(assetId, [usage.slot_key])
  }

  const entries = buildInventory(MANIFEST.assets, migratedGenerationIds, slotKeysByAssetId)

  const report = computeGaps({
    assets: MANIFEST.assets,
    bindings: usages.map((u) => ({ slot_key: u.slot_key })),
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
        entries={entries}
        report={report}
        filters={parseInventoryFilters(params)}
        selected={selected}
      />
    </StudioPage>
  )
}
