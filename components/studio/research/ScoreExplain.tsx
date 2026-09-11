import { Badge } from '@/components/primitives/Badge'
import { Cluster } from '@/components/primitives/Cluster'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import { totalFromComponents } from '@/lib/scraper/analytics/opportunity/score'
import type {
  OpportunityComponentRow,
  OpportunityScoreRow,
} from '@/lib/supabase/repositories/research/opportunity'

/**
 * RC-326 `ScoreExplain` — the component table that visibly sums to the stored total.
 *
 * IT RENDERS STORED ROWS AND NEVER RECOMPUTES. The footer reproduces the total from the components
 * with the same formula the writer used, so a reader can check the arithmetic on screen; if the
 * two ever differed, the stored score is what the row is ranked by and the footer is what
 * `opportunity-score.test.ts` asserts against.
 */
export function ScoreExplain({
  score,
  components,
  title,
}: {
  readonly score: OpportunityScoreRow
  readonly components: readonly OpportunityComponentRow[]
  readonly title: string
}) {
  const reproduced = totalFromComponents(
    components.map((component) => ({
      weight: component.weight,
      normalised: component.normalised === null ? null : Number(component.normalised),
      included: component.included,
    })),
    Number(score.completeness),
  )
  return (
    <Surface level={1} className="p-6" data-score-explain={score.id}>
      <Stack gap={4}>
        <PageHeader
          level={2}
          title={`${t('studio.research.oppExplainHeading')} — ${title}`}
          description={t('studio.research.oppExplainBody')}
        />
        <Cluster gap={2}>
          <Badge tone="neutral">{`${t('studio.research.oppVersion')} ${score.model_version}`}</Badge>
          <Badge
            tone={score.state === 'SCORED' ? 'neutral' : 'warning'}
            data-explain-state={score.state}
          >
            {score.state}
          </Badge>
          <Badge tone="neutral">{`${t('studio.research.oppConfidence')} ${String(score.confidence)}`}</Badge>
          <Badge tone="neutral">{`${t('studio.research.oppCompleteness')} ${String(score.completeness)}`}</Badge>
        </Cluster>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-explain-table="">
            <caption className="sr-only">{t('studio.research.oppExplainHeading')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('studio.research.oppSignal')}</th>
                <th scope="col" className="text-right">
                  {t('studio.research.oppWeight')}
                </th>
                <th scope="col" className="text-right">
                  {t('studio.research.oppNormalised')}
                </th>
                <th scope="col" className="text-right">
                  {t('studio.research.oppContribution')}
                </th>
                <th scope="col">{t('studio.research.oppInput')}</th>
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <tr
                  key={component.id}
                  data-explain-signal={component.signal_key}
                  data-explain-included={String(component.included)}
                >
                  <td>{component.signal_key}</td>
                  <td className="text-right tabular-nums">{String(component.weight)}</td>
                  <td className="text-right tabular-nums">
                    {component.included ? String(component.normalised) : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {component.included ? String(component.contribution) : '—'}
                  </td>
                  <td>
                    <Text size="xs" tone="secondary" as="span">
                      {component.included
                        ? (component.raw_input ?? '')
                        : `${t('studio.research.oppExcluded')}: ${component.exclusion_reason ?? ''}`}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t('studio.research.oppScore')}</th>
                <td
                  colSpan={3}
                  className="text-right tabular-nums"
                  data-explain-total={String(score.score)}
                >
                  {score.score === null ? '—' : String(score.score)}
                </td>
                <td>
                  <Text
                    size="xs"
                    tone="secondary"
                    as="span"
                    data-explain-reproduced={String(reproduced)}
                  >
                    {`${t('studio.research.oppReproduced')}: ${reproduced === null ? '—' : String(reproduced)}`}
                  </Text>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Stack>
    </Surface>
  )
}
