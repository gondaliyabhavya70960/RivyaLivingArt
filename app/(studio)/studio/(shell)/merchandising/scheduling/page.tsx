import type { Route } from 'next'
import Link from 'next/link'

import { Cluster } from '@/components/primitives/Cluster'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { DataTable } from '@/components/studio/DataTable'
import { PageHeader } from '@/components/studio/PageHeader'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { isLive } from '@/lib/cms/windowing'
import { listAllEntries, listSlots } from '@/lib/supabase/repositories/merchandising'
import { createClient } from '@/lib/supabase/server'
import type { MerchandisingEntry, MerchandisingSlot } from '@/lib/supabase/schemas'

/**
 * /studio/merchandising/scheduling — every slot and entry window, one month at a time.
 *
 * A TABLE, NOT A WIDGET. Rows are the eleven slots, columns are the days of the month, and each
 * cell is how many entries are live for that slot at the start of that day (UTC), coloured by
 * whether the count sits inside the slot's range. A GAP is a day the slot falls below `min_items`
 * and the surface shows its fallback; an OVERFLOW is a day more entries are live than `max_items`
 * shows. Both are computed with `isLive`, the same rule the resolver and RLS apply, so the calendar
 * predicts what the site will do rather than describing what somebody hoped.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: write anything. Windows are edited on the slot's owning screen —
 * the jump link goes there — because a second editor here would be the second place a slot is
 * edited from.
 *
 * READ UNDER `catalog.read`, like the rest of the group. Every role holds it.
 */
export const metadata = studioMetadata('/studio/merchandising/scheduling')

const ROUTE = '/studio/merchandising/scheduling'

type CellState = 'ok' | 'gap' | 'over'

function monthOf(param: string | undefined): { year: number; month: number } {
  const match = param === undefined ? null : /^(\d{4})-(\d{2})$/.exec(param)
  if (match !== null) {
    const year = Number(match[1])
    const month = Number(match[2])
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) return { year, month }
  }
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function shift(year: number, month: number, by: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + by, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

function liveCount(entries: readonly MerchandisingEntry[], at: Date): number {
  return entries.filter((entry) => isLive(entry, at)).length
}

function stateFor(slot: MerchandisingSlot, count: number): CellState {
  if (count < slot.min_items) return 'gap'
  if (count > slot.max_items) return 'over'
  return 'ok'
}

const CELL_CLASS: Record<CellState, string> = {
  ok: '',
  gap: 'bg-state-warning/15',
  over: 'bg-state-danger/15',
}

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermission('catalog.read')
  const client = await createClient()
  const params = await searchParams
  const raw = params.month
  const { year, month } = monthOf(Array.isArray(raw) ? raw[0] : raw)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const previous = shift(year, month, -1)
  const next = shift(year, month, 1)

  const [slots, entries] = await Promise.all([listSlots(client), listAllEntries(client)])
  const bySlot = new Map<string, MerchandisingEntry[]>()
  for (const entry of entries) {
    const list = bySlot.get(entry.slot_id) ?? []
    list.push(entry)
    bySlot.set(entry.slot_id, list)
  }

  const dayStarts = Array.from(
    { length: days },
    (_, index) => new Date(Date.UTC(year, month - 1, index + 1)),
  )
  const rows = slots.map((slot) => {
    const own = bySlot.get(slot.id) ?? []
    const cells = dayStarts.map((at) => {
      const count = liveCount(own, at)
      return { count, state: stateFor(slot, count) }
    })
    return {
      slot,
      cells,
      gapDays: cells.filter((cell) => cell.state === 'gap').length,
      overDays: cells.filter((cell) => cell.state === 'over').length,
    }
  })
  const warnings = rows.filter((row) => row.gapDays > 0 || row.overDays > 0)

  const monthStart = dayStarts[0] ?? new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 1))
  const inMonth = (iso: string | null) =>
    iso !== null && new Date(iso) >= monthStart && new Date(iso) < monthEnd
  const slotById = new Map(slots.map((slot) => [slot.id, slot]))
  const windows = entries
    .filter((entry) => inMonth(entry.publish_at) || inMonth(entry.unpublish_at))
    .map((entry) => ({ entry, slot: slotById.get(entry.slot_id) ?? null }))

  return (
    <StudioPage path={ROUTE}>
      <Stack gap={8}>
        <HelpText>{t('studio.merchandising.scheduling.help')}</HelpText>

        <Cluster gap={4} data-calendar-month={monthParam(year, month)}>
          <Link
            href={`${ROUTE}?month=${monthParam(previous.year, previous.month)}` as Route}
            className="underline underline-offset-4"
          >
            {t('studio.merchandising.scheduling.previous')}
          </Link>
          <Text as="span" size="sm">
            {t('studio.merchandising.scheduling.month')}: {monthParam(year, month)}
          </Text>
          <Link
            href={`${ROUTE}?month=${monthParam(next.year, next.month)}` as Route}
            className="underline underline-offset-4"
          >
            {t('studio.merchandising.scheduling.next')}
          </Link>
        </Cluster>

        <Surface level={1} className="overflow-x-auto" tabIndex={0}>
          <table className="w-full border-collapse text-left text-xs">
            <caption className="px-4 pt-4 pb-2 text-left">
              <Text size="2xs" uppercase tone="tertiary">
                {t('studio.merchandising.scheduling.caption')}
              </Text>
            </caption>
            <thead>
              <tr className="border-line border-b">
                <th scope="col" className="px-3 py-2">
                  <Text as="span" size="2xs" uppercase tone="tertiary">
                    {t('studio.merchandising.scheduling.colSlot')}
                  </Text>
                </th>
                {dayStarts.map((at) => (
                  <th key={at.toISOString()} scope="col" className="px-1 py-2 text-center">
                    <Text as="span" size="xs" tone="tertiary">
                      {at.getUTCDate()}
                    </Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ slot, cells }) => (
                <tr key={slot.id} className="border-line border-b" data-calendar-slot={slot.key}>
                  <th scope="row" className="px-3 py-2 font-normal whitespace-nowrap">
                    <Link
                      href={slot.owning_studio_route as Route}
                      className="underline underline-offset-4"
                    >
                      {slot.key}
                    </Link>
                  </th>
                  {cells.map((cell, index) => (
                    <td
                      key={index}
                      className={`px-1 py-2 text-center ${CELL_CLASS[cell.state]}`}
                      data-cell-state={cell.state}
                      title={t(
                        cell.state === 'gap'
                          ? 'studio.merchandising.scheduling.gap'
                          : cell.state === 'over'
                            ? 'studio.merchandising.scheduling.over'
                            : 'studio.merchandising.scheduling.ok',
                      )}
                    >
                      {cell.count}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>

        <Stack gap={3} data-calendar-warnings={warnings.length}>
          <PageHeader level={2} title={t('studio.merchandising.scheduling.warningsHeading')} />
          {warnings.length === 0 ? (
            <Text size="sm" tone="secondary">
              {t('studio.merchandising.scheduling.noWarnings')}
            </Text>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {warnings.map((row) => (
                <li key={row.slot.id} data-warning-slot={row.slot.key}>
                  <Link
                    href={row.slot.owning_studio_route as Route}
                    className="underline underline-offset-4"
                  >
                    {row.slot.key}
                  </Link>
                  {' — '}
                  {row.gapDays > 0
                    ? `${row.gapDays} ${t('studio.merchandising.scheduling.gapDays')}`
                    : null}
                  {row.gapDays > 0 && row.overDays > 0 ? ' · ' : null}
                  {row.overDays > 0
                    ? `${row.overDays} ${t('studio.merchandising.scheduling.overDays')}`
                    : null}
                </li>
              ))}
            </ul>
          )}
        </Stack>

        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.merchandising.scheduling.windowsHeading')} />
          <DataTable<{ entry: MerchandisingEntry; slot: MerchandisingSlot | null }>
            caption={t('studio.merchandising.scheduling.windowsCaption')}
            rows={windows}
            rowKey={({ entry }) => entry.id}
            empty={{
              reason: 'empty',
              heading: t('studio.merchandising.scheduling.windowsHeading'),
              body: t('studio.merchandising.scheduling.noWindows'),
            }}
            columns={[
              {
                id: 'slot',
                header: t('studio.merchandising.scheduling.colSlot'),
                cell: ({ slot }) => slot?.key ?? '—',
              },
              {
                id: 'entry',
                header: t('studio.merchandising.scheduling.colEntry'),
                cell: ({ entry }) => `${entry.entity_type} · ${entry.entity_id.slice(0, 8)}`,
              },
              {
                id: 'opens',
                header: t('studio.merchandising.scheduling.colOpens'),
                cell: ({ entry }) => entry.publish_at?.slice(0, 16) ?? '—',
              },
              {
                id: 'closes',
                header: t('studio.merchandising.scheduling.colCloses'),
                cell: ({ entry }) => entry.unpublish_at?.slice(0, 16) ?? '—',
              },
              {
                id: 'jump',
                header: t('studio.merchandising.scheduling.jump'),
                cell: ({ slot }) =>
                  slot === null ? null : (
                    <Link
                      href={slot.owning_studio_route as Route}
                      className="underline underline-offset-4"
                    >
                      {t('studio.merchandising.scheduling.jump')}
                    </Link>
                  ),
              },
            ]}
          />
        </Stack>
      </Stack>
    </StudioPage>
  )
}
