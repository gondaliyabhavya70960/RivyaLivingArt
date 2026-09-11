import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { CoverageBadge } from '@/components/studio/research/CoverageBadge'
import { t } from '@/components/studio/strings'
import type { ObservedFigure } from '@/lib/scraper/analytics/direction/capture'
import { formatFigure } from '@/lib/scraper/analytics/direction/export'

/**
 * RC-332 `ObservedFigures` — numbers only, each with its `CoverageBadge` and the words
 * "observed in competitor research".
 *
 * THE DISTINCT PANEL IS THE POINT. A brief renders two visually different column types: the
 * intended sections are Rivya's own prose, and these are figures copied from research snapshots.
 * The label sits on every row, on screen and in print, so a printed median cannot be read as a
 * specification. Nothing here is a Rivya figure, and there is no field for one.
 */
export function ObservedFigures({
  figures,
  print = false,
}: {
  readonly figures: readonly (ObservedFigure & { readonly capturedAt: string })[]
  readonly print?: boolean
}) {
  return (
    <Surface level={print ? 0 : 1} className={print ? '' : 'p-6'} data-observed-figures="">
      <Stack gap={3}>
        <Heading level={2} size="display-xs">
          {t('studio.research.dirObservedHeading')}
        </Heading>
        <Text size="xs" tone="secondary">
          {t('studio.research.dirObservedHelp')}
        </Text>
        {figures.length === 0 ? (
          <Text size="sm" tone="secondary" data-observed-empty="">
            {t('studio.research.dirObservedEmpty')}
          </Text>
        ) : (
          <ul className="m-0 list-none p-0">
            {figures.map((figure) => (
              <li
                key={`${figure.capturedAt} ${figure.key}`}
                className="border-line border-t py-2"
                data-observed-figure={figure.key}
              >
                <Stack gap={1}>
                  <Cluster gap={2}>
                    <Text size="sm" as="span">
                      {figure.label}
                    </Text>
                    <Text size="sm" as="span" data-observed-value="">
                      {formatFigure(figure)}
                    </Text>
                    <Badge tone="neutral" data-observed-label="">
                      {t('studio.research.dirObservedLabel')}
                    </Badge>
                  </Cluster>
                  <CoverageBadge coverage={figure.coverage} />
                </Stack>
              </li>
            ))}
          </ul>
        )}
      </Stack>
    </Surface>
  )
}
