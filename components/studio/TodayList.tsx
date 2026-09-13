import type { Route } from 'next'
import Link from 'next/link'
import * as React from 'react'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { MetricCount } from '@/lib/supabase/repositories/metrics'

/**
 * The Overview's answer to the one question §8 says `/studio` exists to answer: what needs a human
 * today.
 *
 * IT IS A LIST OF LINKS, NOT A GRID OF NUMBERS, AND THAT IS THE DIFFERENCE FROM `StatCard`. The
 * registry grid below it measures the business — how many products, how many assets — and those
 * figures are worth knowing and are not work. Every row here is a queue with somebody's name on it,
 * so each row goes somewhere: reading "3" and then hunting through a fifty-leaf sidebar for where
 * to clear it is the defect §3.5 named on the other screens.
 *
 * A FAILED QUERY RENDERS UNREADABLE, NEVER `0`. §12's rule, and this is the screen it was written
 * for. `MetricCount` is `number | null` precisely so the two cannot collapse: a zero here is a
 * promise that somebody looked and found nothing, and a list that makes that promise after a failed
 * read teaches its reader to stop trusting the promise. The row still links — you can always go and
 * look yourself — but it makes no claim about what you will find.
 *
 * EVERY ROW IS GATED ON THE PERMISSION THAT LETS YOU CLEAR IT, not on the one that lets you see the
 * number. A reader who cannot action a queue does not need it on their morning screen; §8's
 * checklist puts it the other way round and means the same thing. Visibility is not authorisation
 * either way — the counts run under RLS as the signed-in user, so a hidden row was never a leak.
 *
 * NO CHARTS. The guide's §9 is explicit for this phase: nothing that mixes currencies, nothing that
 * compares an empty catalogue to scraped prices. Four counts and four links is the whole surface.
 */

export type TodayRow = {
  /** Stable id for the key and for the test hook. */
  readonly id: string
  /** Resolved copy from `strings.ts`. Never a literal at the call site. */
  readonly label: string
  /** `null` means the query failed — rendered as unreadable, never as zero. */
  readonly count: MetricCount
  /** A Studio route the manifest already declares. This component adds none and resolves none. */
  readonly href: string
  /** Optional expansion — the verification row's per-surface breakdown, for instance. */
  readonly detail?: React.ReactNode
}

export function TodayList({ rows }: { readonly rows: readonly TodayRow[] }): React.ReactElement {
  /*
   * "Everything is clear" is only sayable when every row actually READ its table. One `null` among
   * them and the honest statement is nothing at all: the reader would be told they are done on the
   * strength of a query that never answered.
   */
  const allClear = rows.length > 0 && rows.every((row) => row.count === 0)

  return (
    <Surface level={1} className="p-4" data-today-list="">
      <Stack gap={3}>
        <Heading level={2} size="display-xs">
          {t('studio.today.heading')}
        </Heading>

        {rows.length === 0 ? (
          <Text size="sm" tone="secondary" data-today-no-rows="">
            {t('studio.today.noRows')}
          </Text>
        ) : (
          <ul aria-label={t('studio.today.listLabel')} className="m-0 flex list-none flex-col p-0">
            {rows.map((row) => (
              <li key={row.id} data-today-row={row.id}>
                <Row row={row} />
              </li>
            ))}
          </ul>
        )}

        {allClear ? (
          <Text size="sm" tone="secondary" data-today-all-clear="">
            {t('studio.today.allClear')}
          </Text>
        ) : null}
      </Stack>
    </Surface>
  )
}

function Row({ row }: { readonly row: TodayRow }): React.ReactElement {
  return (
    <Stack gap={1} className="border-line border-b py-1 last:border-b-0">
      {/*
       * `min-h-11` rather than the `rv-hit-44` overlay: these rows stack flush against each other,
       * so a 44px overlay on a shorter row would reach into its neighbours and steal their taps.
       * The row IS the target — A53 fixed the same defect in the public drawer the same way.
       */}
      <Link
        href={row.href as Route}
        className="flex min-h-11 items-center justify-between gap-4 rounded-sm px-1"
      >
        <Text as="span" size="sm">
          {row.label}
        </Text>
        <Count count={row.count} />
      </Link>
      {row.detail}
    </Stack>
  )
}

/**
 * The three states a count can be in, kept in one place so no caller can invent a fourth.
 *
 * The figure is grouped `en-IN`, as `StatCard` does: this Studio's readers read 1,00,000.
 */
function Count({ count }: { readonly count: MetricCount }): React.ReactElement {
  if (count === null) {
    return (
      <Text as="span" size="xs" tone="secondary" data-today-count-unreadable="">
        {t('studio.card.unreadable')}
      </Text>
    )
  }
  if (count === 0) {
    return (
      <Text as="span" size="xs" tone="tertiary" data-today-count-clear="">
        {t('studio.today.clear')}
      </Text>
    )
  }
  return (
    <Text as="span" size="sm" data-today-count={String(count)}>
      {count.toLocaleString('en-IN')}
    </Text>
  )
}
