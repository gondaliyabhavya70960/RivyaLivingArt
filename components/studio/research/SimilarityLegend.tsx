import { Badge } from '@/components/primitives/Badge'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import {
  BAND_DEFINITIONS,
  PRECISION_NOT_YET_MEASURED,
  precisionFor,
} from '@/lib/scraper/analytics/similarity/bands'

/**
 * RC-329 `SimilarityLegend` — the band table, verbatim, INCLUDING the "does not mean" column.
 *
 * Rendered above the first result and never behind a tooltip or a disclosure: the risk the phase
 * document names first is a WEAK pair read as evidence that two products are the same, and the
 * column that prevents that reading has to be on screen when the pairs are. A unit test asserts
 * every "does not mean" sentence reaches the markup.
 *
 * PRECISION IS A MEASUREMENT OR IT IS ABSENT. Beside each band: the measured precision with its
 * sample size and date when one exists, and `PRECISION NOT YET MEASURED` when it does not.
 */
export function SimilarityLegend() {
  return (
    <Surface level={1} className="p-6" data-similarity-legend="">
      <Stack gap={3}>
        <Heading level={2} size="display-xs">
          {t('studio.research.simLegendHeading')}
        </Heading>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="pr-4 pb-2 font-medium">{t('studio.research.simLegendBand')}</th>
                <th className="pr-4 pb-2 font-medium">{t('studio.research.simLegendMethod')}</th>
                <th className="pr-4 pb-2 font-medium">{t('studio.research.simLegendThreshold')}</th>
                <th className="pr-4 pb-2 font-medium">{t('studio.research.simLegendMeans')}</th>
                <th className="pb-2 font-medium">{t('studio.research.simLegendDoesNotMean')}</th>
              </tr>
            </thead>
            <tbody>
              {BAND_DEFINITIONS.map((definition) => {
                const measured = precisionFor(definition.band)
                return (
                  <tr
                    key={definition.band}
                    className="border-line border-t align-top"
                    data-band-row={definition.band}
                  >
                    <td className="py-2 pr-4">
                      <Stack gap={1}>
                        <Badge tone="neutral">{definition.band}</Badge>
                        {measured === null ? (
                          <Text size="xs" tone="secondary" as="span" data-precision="unmeasured">
                            {PRECISION_NOT_YET_MEASURED}
                          </Text>
                        ) : (
                          <Text size="xs" tone="secondary" as="span" data-precision="measured">
                            {`${String(Math.round(measured.precision * 100))}% on ${String(measured.sampleSize)} pairs, ${measured.sampledOn}`}
                          </Text>
                        )}
                      </Stack>
                    </td>
                    <td className="py-2 pr-4">
                      <Text size="sm" as="span">
                        {definition.method}
                      </Text>
                    </td>
                    <td className="py-2 pr-4">
                      <Text size="sm" as="span">
                        {definition.threshold}
                      </Text>
                    </td>
                    <td className="py-2 pr-4">
                      <Text size="sm" as="span">
                        {definition.means}
                      </Text>
                    </td>
                    <td className="py-2" data-does-not-mean={definition.band}>
                      <Text size="sm" as="span" tone="secondary">
                        {definition.doesNotMean}
                      </Text>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Text size="xs" tone="secondary">
          {t('studio.research.simPrecisionNote')}
        </Text>
      </Stack>
    </Surface>
  )
}
