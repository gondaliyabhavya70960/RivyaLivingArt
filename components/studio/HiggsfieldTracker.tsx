import type { Route } from 'next'
import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { Field } from '@/components/primitives/Field'
import { Select } from '@/components/primitives/Select'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { EmptyState } from '@/components/studio/EmptyState'
import { FilterBar } from '@/components/studio/FilterBar'
import { HiggsfieldAssetDrawer, type DrawerAsset } from '@/components/studio/HiggsfieldAssetDrawer'
import { StatCard } from '@/components/studio/StatCard'
import { t } from '@/components/studio/strings'
import type { GapReport, SlotState, SlotStatus } from '@/lib/media/gaps'
import {
  activeFilterCount,
  filterInventory,
  inventoryFacets,
  type InventoryEntry,
  type InventoryFilters,
} from '@/lib/media/inventory'
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

/** FEAT §34 truncates the prompt in the table and shows it in full in the drawer. */
const PROMPT_PREVIEW = 90

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit).trimEnd()}…`
}

function InventoryFilterBar({
  path,
  tab,
  filters,
  facets,
  label,
}: {
  path: string
  tab: TrackerTab
  filters: InventoryFilters
  facets: ReturnType<typeof inventoryFacets>
  label: string
}) {
  // Six selects and no text input: every one of these fields is an enumeration the manifest
  // already fixes, and a free-text family box would let somebody type a family that cannot exist
  // and read the empty table as a missing asset.
  const choices: {
    name: string
    label: string
    value: string
    options: readonly { value: string; label: string }[]
  }[] = [
    {
      name: 'type',
      label: t('studio.higgsfield.filterType'),
      value: filters.type ?? '',
      options: [
        { value: 'image', label: t('studio.higgsfield.typeImage') },
        { value: 'video', label: t('studio.higgsfield.typeVideo') },
      ],
    },
    {
      name: 'family',
      label: t('studio.higgsfield.colFamily'),
      value: filters.family ?? '',
      options: facets.families.map((f) => ({ value: f, label: f })),
    },
    {
      name: 'page',
      label: t('studio.higgsfield.colPage'),
      value: filters.page ?? '',
      options: facets.pages.map((p) => ({ value: p, label: p })),
    },
    {
      name: 'ratio',
      label: t('studio.higgsfield.colRatio'),
      value: filters.ratio ?? '',
      options: facets.ratios.map((r) => ({ value: r, label: r })),
    },
    {
      name: 'migrated',
      label: t('studio.higgsfield.colState'),
      value: filters.migrated === undefined ? '' : filters.migrated ? 'yes' : 'no',
      options: [
        { value: 'yes', label: t('studio.higgsfield.stateMigrated') },
        { value: 'no', label: t('studio.higgsfield.stateUnmigrated') },
      ],
    },
    {
      name: 'used',
      label: t('studio.higgsfield.colUsed'),
      value: filters.used === undefined ? '' : filters.used ? 'yes' : 'no',
      options: [
        { value: 'yes', label: t('studio.higgsfield.usedYes') },
        { value: 'no', label: t('studio.higgsfield.usedNo') },
      ],
    },
  ]

  return (
    <FilterBar
      label={label}
      action={path}
      applyLabel={t('studio.higgsfield.filterApply')}
      activeCount={activeFilterCount(filters)}
      activeLabel={t('studio.higgsfield.filterActive')}
    >
      {/* The tab rides along as a hidden field: submitting the form must not throw the reader
          back to Inventory when they filtered from somewhere else, and GET rebuilds the whole
          query string from the form's fields alone. */}
      <input type="hidden" name="tab" value={tab} />
      {choices.map((choice) => (
        <Field key={choice.name} label={choice.label}>
          <Select name={choice.name} defaultValue={choice.value}>
            <option value="">{t('studio.higgsfield.filterAll')}</option>
            {choice.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ))}
    </FilterBar>
  )
}

function InventoryPanel({
  path,
  tab,
  entries,
  filters,
  facets,
}: {
  path: string
  tab: TrackerTab
  entries: readonly InventoryEntry[]
  filters: InventoryFilters
  facets: ReturnType<typeof inventoryFacets>
}) {
  const rows = filterInventory(entries, filters)
  const filtered = activeFilterCount(filters) > 0

  /**
   * FEAT §34's thirteen columns.
   *
   * TWO OF ITS NAMES DO NOT SURVIVE INTACT, and the substitution is the phase document's, not an
   * abbreviation of mine: §34 asks for "Product" and "Collection", and no Higgsfield asset has
   * either — nothing is bound to a product until Phase 09, and rendering two permanently blank
   * columns would be worse than useless. Family and Section carry the same "what is this of"
   * question against data that exists.
   */
  const columns: readonly Column<InventoryEntry>[] = [
    {
      id: 'asset',
      header: t('studio.higgsfield.colAsset'),
      // The id is the row's identity, so it is the row's control.
      cell: (row) => (
        <Link
          href={
            `${path}?${new URLSearchParams({ tab, asset: row.asset.rivya_asset_id }).toString()}` as Route
          }
          className="font-mono whitespace-nowrap"
        >
          {row.asset.rivya_asset_id}
        </Link>
      ),
    },
    {
      id: 'type',
      header: t('studio.higgsfield.colType'),
      cell: (row) =>
        row.asset.type === 'video'
          ? t('studio.higgsfield.typeVideo')
          : t('studio.higgsfield.typeImage'),
    },
    { id: 'family', header: t('studio.higgsfield.colFamily'), cell: (row) => row.asset.family },
    { id: 'page', header: t('studio.higgsfield.colPage'), cell: (row) => row.asset.page },
    { id: 'section', header: t('studio.higgsfield.colSection'), cell: (row) => row.asset.section },
    {
      id: 'purpose',
      header: t('studio.higgsfield.colPurpose'),
      cell: (row) =>
        row.purpose === null ? (
          // A family the §2.1 vocabulary does not cover. Said plainly rather than left blank: a
          // blank cell reads as missing data, this reads as the defect it is.
          <Text size="xs" tone="tertiary">
            {t('studio.higgsfield.purposeNone')}
          </Text>
        ) : (
          <Text size="xs" className="font-mono whitespace-nowrap">
            {row.purpose}
          </Text>
        ),
    },
    { id: 'source', header: t('studio.higgsfield.colSource'), cell: (row) => row.asset.source },
    {
      id: 'model',
      header: t('studio.higgsfield.colModel'),
      cell: (row) => row.asset.higgsfield_model,
    },
    {
      id: 'prompt',
      header: t('studio.higgsfield.colPrompt'),
      cell: (row) => (
        <Text size="xs" tone="secondary" className="max-w-prose">
          {truncate(row.asset.prompt, PROMPT_PREVIEW)}
        </Text>
      ),
    },
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
    {
      id: 'used',
      header: t('studio.higgsfield.colUsed'),
      cell: (row) =>
        row.slotKeys.length > 0 ? t('studio.higgsfield.usedYes') : t('studio.higgsfield.usedNo'),
    },
    {
      id: 'location',
      header: t('studio.higgsfield.colLocation'),
      cell: (row) => (
        <Text size="xs" className="font-mono">
          {row.asset.cloudinary_public_id}
        </Text>
      ),
    },
    {
      id: 'placement',
      header: t('studio.higgsfield.colPlacement'),
      cell: (row) =>
        row.slotKeys.length === 0 ? (
          <Text size="xs" tone="tertiary">
            {t('studio.higgsfield.placementNone')}
          </Text>
        ) : (
          <Text size="xs" className="font-mono">
            {row.slotKeys.join(', ')}
          </Text>
        ),
    },
  ]

  return (
    <Stack gap={4}>
      <InventoryFilterBar
        path={path}
        tab={tab}
        filters={filters}
        facets={facets}
        label={t('studio.higgsfield.filterLabel')}
      />
      <DataTable
        caption={t('studio.higgsfield.inventoryCaption')}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.asset.rivya_asset_id}
        empty={{
          // Two different empties. "No assets match this filter" tells a reader to clear it;
          // "the manifest is empty" tells them to rebuild it. Collapsing them sends people
          // looking for the wrong problem.
          reason: filtered ? 'filtered' : 'empty',
          heading: filtered
            ? t('studio.higgsfield.filteredHeading')
            : t('studio.higgsfield.emptyHeading'),
          body: filtered ? t('studio.higgsfield.filteredBody') : t('studio.higgsfield.emptyBody'),
        }}
      />
    </Stack>
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
  entries,
  report,
  filters,
  selected,
}: {
  path: string
  tab: TrackerTab
  assets: readonly ManifestAsset[]
  /** The manifest joined against `media_assets` and `media_usages`. See lib/media/inventory.ts. */
  entries: readonly InventoryEntry[]
  report: GapReport
  filters: InventoryFilters
  selected: DrawerAsset | null
}) {
  const migratedByAssetId = new Map(entries.map((e) => [e.asset.rivya_asset_id, e.migrated]))
  const isMigrated = (asset: ManifestAsset): boolean =>
    migratedByAssetId.get(asset.rivya_asset_id) ?? false

  const migratedCount = entries.filter((e) => e.migrated).length
  const facets = inventoryFacets(assets)

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

      {tab === 'inventory' ? (
        <InventoryPanel path={path} tab={tab} entries={entries} filters={filters} facets={facets} />
      ) : null}
      {tab === 'families' ? <FamiliesPanel rows={families} /> : null}
      {tab === 'gaps' ? <GapsPanel report={report} /> : null}

      <HiggsfieldAssetDrawer asset={selected} returnTo={`${path}?tab=${tab}`} />
    </Stack>
  )
}
