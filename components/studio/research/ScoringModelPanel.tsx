import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import type { StudioFormAction } from '@/components/studio/form-state'
import { PageHeader } from '@/components/studio/PageHeader'
import { ActivateModelButton } from '@/components/studio/research/ActivateModelButton'
import { t } from '@/components/studio/strings'
import { MODEL_V1, weightsOf, type ScoringModel } from '@/lib/scraper/analytics/opportunity/model'
import type { RankMovement } from '@/lib/scraper/analytics/opportunity/rank'

/**
 * RC-327 `ScoringModelPanel` — versions, the diff, activation. Owner and admin only; the page
 * mounts it for nobody else, and the actions check again.
 *
 * THE DIFF RENDERS BEFORE THE BUTTON. A draft's weights beside the active model's, and the count
 * of rows that would move by more than ten places, so activation is a decision made with the
 * consequence in view rather than discovered the next morning.
 */
export function ScoringModelPanel({
  models,
  diffs,
  actions,
  activateAction,
}: {
  readonly models: readonly ScoringModel[]
  /** The rank-movement diff for every DRAFT, against the active model. */
  readonly diffs: ReadonlyMap<string, RankMovement>
  readonly actions: { readonly createDraft: StudioFormAction }
  readonly activateAction: (form: FormData) => Promise<void>
}) {
  const active = models.find((model) => model.lifecycle === 'ACTIVE') ?? null
  const activeWeights = active === null ? null : weightsOf(active)
  return (
    <Surface level={1} className="p-6" data-scoring-model-panel="">
      <Stack gap={5}>
        <PageHeader
          level={2}
          title={t('studio.research.oppModelsHeading')}
          description={t('studio.research.oppModelsBody')}
        />

        <Stack gap={3}>
          {models.map((model) => {
            const weights = weightsOf(model)
            const diff = diffs.get(model.id)
            return (
              <Surface
                key={model.id}
                level={2}
                className="p-4"
                data-model={model.version}
                data-model-lifecycle={model.lifecycle}
              >
                <Stack gap={2}>
                  <Cluster gap={2}>
                    <Text size="sm" as="span">{`${model.version} — ${model.name}`}</Text>
                    <Badge
                      tone={
                        model.lifecycle === 'ACTIVE'
                          ? 'info'
                          : model.lifecycle === 'DRAFT'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {model.lifecycle}
                    </Badge>
                    <Badge tone="neutral">{`min confidence ${String(model.minConfidence)}`}</Badge>
                  </Cluster>
                  <div className="overflow-x-auto">
                    <table className="text-xs" data-model-weights="">
                      <caption className="sr-only">{t('studio.research.oppWeight')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('studio.research.oppSignal')}</th>
                          <th scope="col" className="text-right">
                            {t('studio.research.oppWeight')}
                          </th>
                          {activeWeights !== null && model.lifecycle === 'DRAFT' ? (
                            <th scope="col" className="text-right">
                              {active?.version ?? ''}
                            </th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.keys(weights) as (keyof typeof weights)[]).map((key) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td className="text-right tabular-nums">{String(weights[key])}</td>
                            {activeWeights !== null && model.lifecycle === 'DRAFT' ? (
                              <td className="text-right tabular-nums">
                                {String(activeWeights[key])}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {model.lifecycle === 'DRAFT' ? (
                    <Stack gap={2} data-model-diff={model.version}>
                      {diff === undefined ? null : (
                        <Text
                          size="xs"
                          tone="secondary"
                          data-diff-moved={String(diff.movedMoreThan)}
                        >
                          {`${t('studio.research.oppDiffHeading')}: ${String(diff.movedMoreThan)} ${t('studio.research.oppDiffMoved')} ${String(diff.threshold)} ${t('studio.research.oppDiffPlaces')} ${String(diff.ranked)} ${t('studio.research.oppDiffRanked')}`}
                        </Text>
                      )}
                      <ActivateModelButton
                        modelId={model.id}
                        action={activateAction}
                        labels={{
                          button: t('studio.research.oppActivate'),
                          title: t('studio.research.oppActivateTitle'),
                          body: t('studio.research.oppActivateBody'),
                          confirm: t('studio.research.oppActivate'),
                          cancel: t('studio.content.section.cancelLabel'),
                          close: t('studio.content.section.closeLabel'),
                        }}
                      />
                    </Stack>
                  ) : null}
                </Stack>
              </Surface>
            )
          })}
        </Stack>

        <Surface level={2} className="p-4" data-new-draft="">
          <Stack gap={3}>
            <PageHeader
              level={3}
              title={t('studio.research.oppNewDraft')}
              description={t('studio.research.oppDiffBody')}
            />
            <ActionForm action={actions.createDraft}>
              <Stack gap={3}>
                <Cluster gap={3} align="end">
                  <label className="flex min-w-40 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.oppDraftVersion')}
                    </Text>
                    <Input name="version" required />
                  </label>
                  <label className="flex min-w-56 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.oppDraftName')}
                    </Text>
                    <Input name="name" />
                  </label>
                  <label className="flex min-w-40 flex-col gap-1">
                    <Text size="xs" tone="secondary" as="span">
                      {t('studio.research.oppDraftMinConfidence')}
                    </Text>
                    <Input name="min_confidence" defaultValue="0.5" />
                  </label>
                </Cluster>
                <Text size="xs" tone="secondary">
                  {t('studio.research.oppDraftWeights')}
                </Text>
                <Cluster gap={3} align="end">
                  {MODEL_V1.map((signal) => (
                    <label key={signal.key} className="flex min-w-40 flex-col gap-1">
                      <Text size="xs" tone="secondary" as="span">
                        {signal.key}
                      </Text>
                      <Input
                        name={`weight_${signal.key}`}
                        defaultValue={String(activeWeights?.[signal.key] ?? signal.weight)}
                      />
                    </label>
                  ))}
                </Cluster>
                <Button type="submit" variant="secondary" data-save-draft="">
                  {t('studio.research.oppSaveDraft')}
                </Button>
              </Stack>
            </ActionForm>
          </Stack>
        </Surface>
      </Stack>
    </Surface>
  )
}
