import type { Route } from 'next'
import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { EmptyState } from '@/components/studio/EmptyState'
import { HiggsfieldAssetDrawer, type DrawerAsset } from '@/components/studio/HiggsfieldAssetDrawer'
import { StatCard } from '@/components/studio/StatCard'
import { t } from '@/components/studio/strings'
import type { GapReport, SlotState, SlotStatus } from '@/lib/media/gaps'
import type { ManifestAsset } from '@/lib/media/manifest'

/**
 * /studio/media/higgsfield — what exists, what it belongs to, and what is missing.
 *
 * THREE TABS, THREE QUESTIONS, and they are separate because the answers come from different
 * places. Inventory is the manifest joined against `media_assets` ("has this been migrated?").
 * Families groups the same 250 by generation family ("how deep is our coverage of pouring?").
 * Gaps is the slot registry joined against `media_usages` ("what does the site declare that
 * nothing can fill?") — the only tab whose input is a document rather than an asset.
 *
 * THE TABS ARE LINKS, NOT `patterns/Tabs`, and that is a deliberate departure from RC-203. Three
 * reasons, in order of weight: the Gaps tab must have its own URL for the phase's verification
 * step and for the e2e test to navigate to; rendering all three panels' children so a client
 * widget can toggle them would push 250 inventory rows into the RSC payload for a reader who
 * wanted the six-row gap list; and a control that changes the URL is navigation, so marking it up
 * with `role="tab"` would tell a screen reader it stays on the page when it does not. They are
 * therefore a `<nav>` of links carrying `aria-current`, which is the honest markup for what they
 * do. RC-203 remains correct for in-page panels — this surface is not one.
 *
 * THE CONCEPT BANNER IS ON EVERY TAB AND IS NOT DISMISSIBLE. All 250 assets carry
 * `is_concept = true`; they are art direction for work that has not been photographed. An owner
 * who forgot that could send a client a render of a table nobody has built, which is precisely the
 * fabricated business fact D10 exists to prevent. Putting the warning on the page rather than on
 * each row means it cannot be scrolled past on the way to the first asset.
 */

export const TRACKER_TABS = ['inventory', 'families', 'gaps'] as const
export type TrackerTab = (typeof TRACKER_TABS)[number]

export function isTrackerTab(value: unknown): value is TrackerTab {
  return typeof value === 'string' && (TRACKER_TABS as readonly string[]).includes(value)
}

const TAB_LABEL: Record<TrackerTab, () => string> = {
  inventory: () => t('studio.higgsfield.tabInventory'),
  families: () => t('studio.higgsfield.tabFamilies'),
  gaps: () => t('studio.higgsfield.tabGaps'),
}

/**
 * Slot state to badge tone.
 *
 * GAP IS `danger` AND THIN IS `warning`, not the reverse and not both the same. A gap means a
 * surface has nothing to show and would ship blank; a thin family means it would ship, repeating
 * one image. The first blocks a launch and the second embarrasses it, so they must not look alike.
 * Every badge renders its own word as well, so the distinction survives greyscale (WCAG 1.4.1).
 */
const SLOT_TONE: Record<SlotState, BadgeTone> = {
  FILLED: 'success',
  COVERED: 'info',
  THIN: 'warning',
  GAP: 'danger',
}

const SLOT_LABEL: Record<SlotState, () => string> = {
  FILLED: () => t('studio.higgsfield.slotFilled'),
  COVERED: () => t('studio.higgsfield.slotCovered'),
  THIN: () => t('studio.higgsfield.slotThin'),
  GAP: () => t('studio.higgsfield.slotGap'),
}

/** What a reader should do about a slot, in one sentence. */
function needsLabel(status: SlotStatus): string {
  switch (status.state) {
    case 'FILLED':
      return t('studio.higgsfield.needsNothing')
    case 'COVERED':
      return t('studio.higgsfield.needsBinding')
    case 'THIN':
      return t('studio.higgsfield.needsThin')
    case 'GAP':
      // The one branch that is not about quantity. An EMPTY_STATE gap must never read as work to
      // be done: generating for it would fabricate delivered work.
      return status.slot.resolution === 'EMPTY_STATE'
        ? t('studio.higgsfield.needsEmptyState')
        : t('studio.higgsfield.needsGeneration')
  }
}

function ConceptBanner() {
  return (
    // `role="note"` rather than `alert`: it is standing context, not something that just happened,
    // and an alert would interrupt a screen reader on every tab change.
    <Surface
      level={1}
      role="note"
      className="border-state-warning bg-state-warning-soft border p-4"
    >
      <Text size="sm">{t('studio.higgsfield.conceptBanner')}</Text>
    </Surface>
  )
}

function TabNav({ path, tab, label }: { path: string; tab: TrackerTab; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="border-line flex list-none flex-wrap gap-1 border-b p-0">
        {TRACKER_TABS.map((id) => {
          const active = id === tab
          return (
            <li key={id}>
              <Link
                href={`${path}?tab=${id}` as Route}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'border-ink-accent text-ink -mb-px inline-block border-b-2 px-3 py-2'
                    : 'text-ink-secondary hover:text-ink -mb-px inline-block border-b-2 border-transparent px-3 py-2'
                }
              >
                {TAB_LABEL[id]()}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

type InventoryRow = {
  asset: ManifestAsset
  migrated: boolean
  href: string
}

function InventoryPanel({ rows }: { rows: readonly InventoryRow[] }) {
  const columns: readonly Column<InventoryRow>[] = [
    {
      id: 'asset',
      header: t('studio.higgsfield.colAsset'),
      // The id is the link to the drawer: it is the row's identity, so it is the row's control.
      cell: (row) => (
        <Link href={row.href as Route} className="font-mono">
          {row.asset.rivya_asset_id}
        </Link>
      ),
    },
    { id: 'family', header: t('studio.higgsfield.colFamily'), cell: (row) => row.asset.family },
    { id: 'page', header: t('studio.higgsfield.colPage'), cell: (row) => row.asset.page },
    { id: 'ratio', header: t('studio.higgsfield.colRatio'), cell: (row) => row.asset.aspect_ratio },
    {
      id: 'state',
      header: t('studio.higgsfield.colState'),
      cell: (row) => (
        <Badge tone={row.migrated ? 'success' : 'warning'}>
          {row.migrated
            ? t('studio.higgsfield.stateMigrated')
            : t('studio.higgsfield.stateUnmigrated')}
        </Badge>
      ),
    },
  ]

  return (
    <DataTable
      caption={t('studio.higgsfield.inventoryCaption')}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.asset.rivya_asset_id}
      empty={{
        reason: 'empty',
        heading: t('studio.higgsfield.emptyHeading'),
        body: t('studio.higgsfield.emptyBody'),
      }}
    />
  )
}

type FamilyRow = {
  family: string
  count: number
  migrated: number
  pages: string
  ratios: string
}

function FamiliesPanel({ rows }: { rows: readonly FamilyRow[] }) {
  const columns: readonly Column<FamilyRow>[] = [
    { id: 'family', header: t('studio.higgsfield.colFamily'), cell: (row) => row.family },
    {
      id: 'count',
      header: t('studio.higgsfield.colCount'),
      numeric: true,
      // Migrated over total, so a family half-imported is visible without a second column.
      cell: (row) => `${String(row.migrated)} / ${String(row.count)}`,
    },
    { id: 'page', header: t('studio.higgsfield.colPage'), cell: (row) => row.pages },
    { id: 'ratio', header: t('studio.higgsfield.colRatio'), cell: (row) => row.ratios },
  ]

  return (
    <DataTable
      caption={t('studio.higgsfield.familiesCaption')}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.family}
      empty={{
        reason: 'empty',
        heading: t('studio.higgsfield.emptyHeading'),
        body: t('studio.higgsfield.emptyBody'),
      }}
    />
  )
}

function GapsPanel({ report }: { report: GapReport }) {
  const columns: readonly Column<SlotStatus>[] = [
    {
      id: 'slot',
      header: t('studio.higgsfield.colSlot'),
      cell: (row) => (
        <Stack gap={1}>
          <Text size="sm">{row.slot.label}</Text>
          <Text size="xs" tone="tertiary" className="font-mono">
            {row.slot.key}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'state',
      header: t('studio.higgsfield.colState'),
      cell: (row) => <Badge tone={SLOT_TONE[row.state]}>{SLOT_LABEL[row.state]()}</Badge>,
    },
    {
      id: 'count',
      header: t('studio.higgsfield.colCount'),
      numeric: true,
      cell: (row) => String(row.candidateCount),
    },
    {
      id: 'needs',
      header: t('studio.higgsfield.colNeeds'),
      cell: (row) => (
        <Stack gap={1}>
          <Text size="sm">{needsLabel(row)}</Text>
          {row.missingRatios.length > 0 ? (
            <Text size="xs" tone="tertiary">
              {`${t('studio.higgsfield.missingRatios')} ${row.missingRatios.join(', ')}`}
            </Text>
          ) : null}
        </Stack>
      ),
    },
  ]

  return (
    <Stack gap={6}>
      {/* One table per page rather than one table with a page column: the question this tab
          answers is "what is missing from /contact", and a reader scanning for a route should not
          have to filter a 26-row table to find its two entries. The route is the caption. */}
      {report.pages.map((page) => (
        <Stack key={page.page} gap={2}>
          <Heading level={3} size="display-xs">
            {page.page}
          </Heading>
          <DataTable
            caption={`${t('studio.higgsfield.gapsCaption')} — ${page.page}`}
            columns={columns}
            rows={page.slots}
            rowKey={(row) => row.slot.key}
            empty={{
              reason: 'empty',
              heading: t('studio.higgsfield.emptyHeading'),
              body: t('studio.higgsfield.emptyBody'),
            }}
          />
        </Stack>
      ))}

      {report.orphanFamilies.length > 0 ? (
        <Surface level={1} className="p-4">
          <Stack gap={2}>
            <Heading level={3} size="display-xs">
              {t('studio.higgsfield.orphanHeading')}
            </Heading>
            <Text size="sm" tone="secondary">
              {t('studio.higgsfield.orphanBody')}
            </Text>
            <div className="flex flex-wrap gap-2">
              {report.orphanFamilies.map((f) => (
                <Badge key={f.family} tone="neutral">
                  {`${f.family} · ${String(f.assetCount)}`}
                </Badge>
              ))}
            </div>
          </Stack>
        </Surface>
      ) : null}
    </Stack>
  )
}

export function HiggsfieldTracker({
  path,
  tab,
  assets,
  report,
  migratedGenerationIds,
  selected,
}: {
  path: string
  tab: TrackerTab
  assets: readonly ManifestAsset[]
  report: GapReport
  /** `higgsfield_generation_id` values already carrying a `media_assets` row. */
  migratedGenerationIds: ReadonlySet<string>
  selected: DrawerAsset | null
}) {
  const isMigrated = (asset: ManifestAsset): boolean =>
    migratedGenerationIds.has(asset.higgsfield_generation_id)

  const migratedCount = assets.filter(isMigrated).length

  const inventory: InventoryRow[] = assets.map((asset) => ({
    asset,
    migrated: isMigrated(asset),
    href: `${path}?tab=${tab}&asset=${encodeURIComponent(asset.rivya_asset_id)}`,
  }))

  const grouped = new Map<string, ManifestAsset[]>()
  for (const asset of assets) {
    const list = grouped.get(asset.family)
    if (list) list.push(asset)
    else grouped.set(asset.family, [asset])
  }
  const families: FamilyRow[] = [...grouped.entries()]
    .map(([family, list]) => ({
      family,
      count: list.length,
      migrated: list.filter(isMigrated).length,
      pages: [...new Set(list.map((a) => a.page))].join(', '),
      ratios: [...new Set(list.map((a) => a.aspect_ratio))].join(', '),
    }))
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family))

  if (assets.length === 0) {
    return (
      <EmptyState
        reason="empty"
        heading={t('studio.higgsfield.emptyHeading')}
        body={t('studio.higgsfield.emptyBody')}
      />
    )
  }

  return (
    <Stack gap={6}>
      <ConceptBanner />

      <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <StatCard
            label={t('studio.higgsfield.cardTotal')}
            value={assets.length}
            unavailableLabel={t('studio.card.unavailable')}
            unreadableLabel={t('studio.card.unreadable')}
          />
        </li>
        <li>
          <StatCard
            label={t('studio.higgsfield.cardMigrated')}
            value={migratedCount}
            unavailableLabel={t('studio.card.unavailable')}
            unreadableLabel={t('studio.card.unreadable')}
          />
        </li>
        <li>
          <StatCard
            label={t('studio.higgsfield.cardPending')}
            value={assets.length - migratedCount}
            unavailableLabel={t('studio.card.unavailable')}
            unreadableLabel={t('studio.card.unreadable')}
          />
        </li>
        <li>
          <StatCard
            label={t('studio.higgsfield.cardGaps')}
            value={report.totals.gap}
            unavailableLabel={t('studio.card.unavailable')}
            unreadableLabel={t('studio.card.unreadable')}
          />
        </li>
      </ul>

      <TabNav path={path} tab={tab} label={t('studio.nav.media.higgsfield')} />

      {tab === 'inventory' ? <InventoryPanel rows={inventory} /> : null}
      {tab === 'families' ? <FamiliesPanel rows={families} /> : null}
      {tab === 'gaps' ? <GapsPanel report={report} /> : null}

      <HiggsfieldAssetDrawer asset={selected} returnTo={`${path}?tab=${tab}`} />
    </Stack>
  )
}
