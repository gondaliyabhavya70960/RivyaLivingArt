import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import { formatMinor } from '@/components/studio/research/ParseStatePill'
import type { ExplorerRow } from '@/lib/supabase/repositories/research/explorer'

/**
 * Up to four research rows side by side, read-only.
 *
 * **IT RECORDS NOTHING ABOUT THE ROWS IT SHOWS.** The phase document says so and the reason is
 * worth keeping in front of whoever changes this next: comparison is how somebody makes up their
 * mind, and a tool that recorded a verdict for looking would make people avoid looking. The only
 * thing written when this opens is an activity event saying a comparison happened, and that is
 * written by the Server Action, not from here.
 *
 * FOUR, BECAUSE THAT IS WHAT FITS AND WHAT A PERSON HOLDS. A comparison of nine rows is a
 * spreadsheet, and Phase 31 builds the spreadsheet. This is "are these three the same table as
 * that one" — the question somebody asks with the queue open.
 *
 * THE ROWS ARE NOT ALIGNED BY FIELD ACROSS A GRID, they are four columns of the same shape. A grid
 * transposed by field reads better for two rows and becomes unreadable at four, and the comparison
 * being made here is between whole products rather than between individual figures.
 */

const MAX_COMPARE = 4

function Line({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <Text size="2xs" tone="secondary" as="span" uppercase>
        {label}
      </Text>
      <Text size="sm" className="break-words">
        {value}
      </Text>
    </div>
  )
}

function dimensionSummary(value: unknown): string {
  if (value === null || typeof value !== 'object') return '—'
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return '—'
  return entries.map(([axis, mm]) => `${axis.replace(/_mm$/u, '')} ${String(mm)}`).join(' · ')
}

export function CompareDrawer({
  rows,
  sourceNames,
}: {
  readonly rows: readonly ExplorerRow[]
  readonly sourceNames: ReadonlyMap<string, string>
}) {
  const shown = rows.slice(0, MAX_COMPARE)

  return (
    <Surface level={1} className="p-6" data-compare-drawer="">
      <Stack gap={4}>
        <Stack gap={1}>
          <PageHeader level={2} title={t('studio.research.compareHeading')} />
          <Text size="xs" tone="secondary">
            {t('studio.research.compareRecords')}
          </Text>
        </Stack>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((row) => (
            <Stack key={row.id} gap={2} data-compare-column={row.id}>
              <Text size="sm">{row.title_normalized ?? row.source_url}</Text>
              <Badge tone="neutral">{sourceNames.get(row.source_id) ?? row.source_id}</Badge>
              <Line
                label="price"
                value={formatMinor(row.price_min_minor, row.currency) ?? row.price_state ?? '—'}
              />
              <Line label="measurements" value={dimensionSummary(row.dimensions_mm)} />
              <Line
                label="materials"
                value={
                  row.material_tokens === null || row.material_tokens.length === 0
                    ? '—'
                    : row.material_tokens.join(', ')
                }
              />
              <Line label="availability" value={row.availability ?? '—'} />
              <Line label="stage" value={row.stage} />
            </Stack>
          ))}
        </div>
      </Stack>
    </Surface>
  )
}
