import type { Route } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/primitives/Badge'
import { Heading } from '@/components/primitives/Heading'
import { HelpText } from '@/components/primitives/HelpText'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { DataTable, type Column } from '@/components/studio/DataTable'
import { t } from '@/components/studio/strings'
import { altTextWarnings } from '@/lib/media/alt-text-quality'

/**
 * WHOSE ALT TEXT STILL NEEDS A PERSON — Phase 43, RC-360.
 *
 * THE ORDER IS THE FEATURE. 250 assets is a list nobody works through end to end, so the queue puts
 * the ones that MATTER first: assets bound to a published page, then assets whose imported draft
 * was cut off mid-sentence, then everything else. An alphabetical list of 250 would have somebody
 * spend their first hour on an unbound macro texture while a broken sentence sat on the homepage.
 *
 * A SERVER COMPONENT. It renders a table and links to the asset page; nothing here is interactive,
 * and the editing happens on `/studio/media/all/[assetId]` where the picture is large enough to
 * write about. Making this a client island to host an inline field would put 250 rows of state in
 * a browser to save one navigation.
 *
 * THE WARNINGS ARE THE SAME FOUR the asset page shows, from the same pure function, so the queue
 * and the editor cannot disagree about which rows are finished.
 */

export interface AltTextQueueRow {
  readonly id: string
  readonly label: string
  readonly rivyaAssetId: string | null
  readonly altText: string
  readonly isDecorative: boolean
  /** How many published slots this asset is bound to. Zero means nobody sees it yet. */
  readonly boundCount: number
}

/**
 * Bound first, then broken, then the rest.
 *
 * WITHIN EACH BAND, MOST WARNINGS FIRST, so the worst sentence in the band is the next one somebody
 * meets. Ties fall back to the asset id, which keeps the order stable between renders — a queue
 * that reshuffles on refresh is a queue somebody loses their place in.
 */
export function orderQueue(rows: readonly AltTextQueueRow[]): AltTextQueueRow[] {
  return [...rows].sort((a, b) => {
    if (a.boundCount > 0 !== b.boundCount > 0) return a.boundCount > 0 ? -1 : 1
    const aTruncated = altTextWarnings(a.altText).includes('TRUNCATED')
    const bTruncated = altTextWarnings(b.altText).includes('TRUNCATED')
    if (aTruncated !== bTruncated) return aTruncated ? -1 : 1
    const byWarnings = altTextWarnings(b.altText).length - altTextWarnings(a.altText).length
    if (byWarnings !== 0) return byWarnings
    return (a.rivyaAssetId ?? a.id).localeCompare(b.rivyaAssetId ?? b.id)
  })
}

export function AltTextQueue({ rows }: { readonly rows: readonly AltTextQueueRow[] }) {
  const ordered = orderQueue(rows)

  const columns: readonly Column<AltTextQueueRow>[] = [
    {
      id: 'asset',
      header: t('studio.media.altQueue.colAsset'),
      cell: (row) => (
        <Stack gap={1}>
          <Link
            href={`/studio/media/all/${row.id}` as Route}
            className="underline underline-offset-4"
          >
            {row.label}
          </Link>
          <Text size="sm" tone="tertiary">
            {row.rivyaAssetId ?? row.id}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'bound',
      header: t('studio.media.altQueue.colBound'),
      cell: (row) =>
        row.boundCount > 0 ? (
          <Badge tone="info">{String(row.boundCount)}</Badge>
        ) : (
          <Text size="sm" tone="tertiary">
            —
          </Text>
        ),
    },
    {
      id: 'warnings',
      header: t('studio.media.altQueue.colWarnings'),
      cell: (row) => {
        const warnings = altTextWarnings(row.altText)
        if (row.isDecorative) return <Badge tone="neutral">decorative</Badge>
        if (warnings.length === 0) {
          return (
            <Text size="sm" tone="secondary">
              {t('studio.media.altQueue.clear')}
            </Text>
          )
        }
        return (
          <div className="flex flex-wrap gap-1">
            {warnings.map((warning) => (
              // `warning` rather than `danger`: none of these blocks anything, and a red badge on
              // advice teaches people that red means "ignore".
              <Badge key={warning} tone="warning">
                {warning}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'text',
      header: t('studio.media.altQueue.colText'),
      cell: (row) => (
        <Text size="sm" tone="secondary">
          {row.altText}
        </Text>
      ),
    },
  ]

  return (
    <Stack gap={4} data-alt-queue="">
      <Stack gap={1}>
        <Heading level={2} size="display-xs">
          {t('studio.media.altQueue.heading')}
        </Heading>
        <HelpText>{t('studio.media.altQueue.body')}</HelpText>
      </Stack>
      <DataTable
        caption={t('studio.media.altQueue.heading')}
        columns={columns}
        rows={ordered}
        rowKey={(row) => row.id}
        empty={{
          reason: 'empty',
          heading: t('studio.media.altQueue.heading'),
          body: t('studio.media.altQueue.empty'),
        }}
      />
    </Stack>
  )
}
