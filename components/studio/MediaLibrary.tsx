import { Badge } from '@/components/primitives/Badge'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { FilterBar } from '@/components/studio/FilterBar'
import { RelativeTime } from '@/components/studio/RelativeTime'
import { StatusPill } from '@/components/studio/StatusPill'
import { t } from '@/components/studio/strings'
import { MediaImage } from '@/components/patterns/MediaImage'
import { MediaFrame } from '@/components/primitives/MediaFrame'
import { posterUrlFor } from '@/lib/media/poster'
import { PRESET_MAP } from '@/lib/media/transform'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The table body shared by all six Media Manager sections.
 *
 * ONE COMPONENT, SIX ROUTES. FEAT §13's sections differ only in which rows they show: five are a
 * `kind` and the sixth (AI Assets, Phase 07) is `source = 'HIGGSFIELD'` across two kinds. Six
 * hand-written tables would drift — a column added to Images and forgotten on Videos — and the
 * drift would look like a deliberate difference to whoever found it.
 *
 * A THUMBNAIL IS NOT DECORATION HERE. It is how somebody recognises the asset they are looking
 * for, so it carries the row's real `alt_text` rather than `alt=""`: a screen-reader user
 * scanning this table needs the same identifying information as a sighted one.
 *
 * VIDEOS SHOW A POSTER, NOT A `MediaVideo`. Twenty autoplaying clips in a table is not a media
 * library, it is a browser tab that heats a laptop. `posterUrlFor` gives the same frame the public
 * site would use, which also means a wrong poster is visible here rather than only in production.
 */

export type MediaLibraryProps = {
  /** The current route, so the filter form submits back to itself. */
  path: string
  assets: readonly MediaAsset[]
  /** The public cloud name. Passed in because this is a Server Component in a shared module. */
  cloudName: string
  /** The search term currently applied, from `searchParams`. */
  search: string
}

/** Non-visual kinds have no thumbnail to show; a badge naming the kind is the honest substitute. */
const RENDERABLE = new Set(['IMAGE', 'BRAND', 'VIDEO'])

export function MediaLibrary({
  path,
  assets,
  cloudName,
  search,
}: MediaLibraryProps): React.ReactElement {
  const columns: readonly Column<MediaAsset>[] = [
    {
      id: 'preview',
      header: t('studio.media.colPreview'),
      cell: (asset) => (
        <div className="w-20">
          <MediaFrame ratio="1:1" fallbackLabel={asset.kind}>
            {renderPreview(asset, cloudName)}
          </MediaFrame>
        </div>
      ),
    },
    {
      id: 'name',
      header: t('studio.media.colName'),
      cell: (asset) => (
        <Stack gap={1}>
          <Text>{asset.title ?? asset.filename ?? asset.public_id}</Text>
          {/* The alt text is shown, not hidden behind a detail view. It is the field most likely
              to be wrong and least likely to be looked at, and a table that displays it is the
              cheapest review anybody will ever do of it. */}
          <Text size="sm" tone="tertiary">
            {asset.alt_text}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'folder',
      header: t('studio.media.colFolder'),
      cell: (asset) => (
        <Text size="sm" tone="secondary">
          {asset.folder}
        </Text>
      ),
    },
    {
      id: 'source',
      header: t('studio.media.colSource'),
      cell: (asset) => (
        // Neutral, always. A tone that marked HIGGSFIELD as a warning would editorialise about
        // provenance the business has decided is legitimate (D6's ladder puts it third of six).
        <Badge tone="neutral">{asset.source}</Badge>
      ),
    },
    {
      id: 'status',
      header: t('studio.media.colStatus'),
      cell: (asset) => <StatusPill status={asset.status} />,
    },
    {
      id: 'added',
      header: t('studio.media.colAdded'),
      cell: (asset) => <RelativeTime value={asset.created_at} />,
    },
  ]

  const filtered = search.trim() !== ''

  return (
    <Stack gap={4}>
      <FilterBar
        label={t('studio.media.searchLabel')}
        action={path}
        applyLabel={t('studio.media.searchAction')}
        activeCount={filtered ? 1 : 0}
        activeLabel={t('studio.media.searchLabel')}
      >
        <Field label={t('studio.media.searchLabel')} controlId="media-search">
          <Input id="media-search" name="q" defaultValue={search} />
        </Field>
      </FilterBar>

      <DataTable
        caption={t('studio.media.tableCaption')}
        columns={columns}
        rows={assets}
        rowKey={(asset) => asset.id}
        // Three different situations, three different messages. A table that says "No results"
        // for all of them teaches people their data has vanished when a filter is on.
        empty={
          filtered
            ? {
                reason: 'filtered',
                heading: t('studio.media.filteredHeading'),
                body: t('studio.media.filteredBody'),
              }
            : {
                reason: 'empty',
                heading: t('studio.media.emptyHeading'),
                body: t('studio.media.emptyBody'),
              }
        }
      />
    </Stack>
  )
}

function renderPreview(asset: MediaAsset, cloudName: string): React.ReactNode {
  if (!RENDERABLE.has(asset.kind)) return null

  if (asset.kind === 'VIDEO') {
    // NOT routed through MediaImage, and the reason is structural rather than stylistic.
    // MediaImage takes a MediaRef and a preset and builds the URL itself; a DERIVED poster is a
    // frame pulled out of the VIDEO namespace (`so_0`, delivered as .jpg), which a MediaRef with
    // `resourceType: 'image'` cannot express. `posterUrlFor` already made the decision — explicit
    // still or first frame — so re-deriving it here would resolve the same URL twice and get the
    // derived case wrong.
    const poster = posterUrlFor(
      cloudName,
      { publicId: asset.public_id, posterPublicId: asset.poster_public_id },
      PRESET_MAP.thumb,
    )
    return (
      // eslint-disable-next-line @next/next/no-img-element -- see MediaImage on why not next/image
      <img
        src={poster}
        alt={asset.alt_text}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full rounded-none object-cover"
      />
    )
  }

  return (
    <MediaImage
      cloudName={cloudName}
      media={{ publicId: asset.public_id, resourceType: 'image' }}
      preset="thumb"
      // A fixed 80px box in a table, so the CSS width is the whole answer — no viewport term.
      sizes="80px"
      alt={asset.alt_text}
    />
  )
}
