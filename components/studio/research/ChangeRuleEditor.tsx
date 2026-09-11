import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { PageHeader } from '@/components/studio/PageHeader'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import { CHANGE_FIELDS } from '@/lib/scraper/analytics/materiality'
import type { ChangeRuleRow } from '@/lib/supabase/repositories/research/change-rules'

import type { FilterOption } from './ExplorerFilters'

/**
 * The materiality thresholds, edited as data.
 *
 * THIS EDITOR IS THE REASON THE THRESHOLDS ARE A TABLE, and the argument is the lexicon's one step
 * along. A source with noisy prices — a shop that reprices daily by a few pence, a CDN that
 * rewrites every image URL — will flood the review queue, and the person who notices is the person
 * reading the queue, not a developer. If the only fix is a pull request, the fix does not happen
 * and the queue is abandoned instead. So the numbers are rows, tuned here, per source.
 *
 * A DRAFT OVERRIDE CHANGES NOTHING UNTIL IT IS PUBLISHED. `readChangeRules` reads only PUBLISHED
 * rows, which means somebody can prepare a threshold, look at it beside the default, and turn it on
 * when they mean to — rather than every keystroke re-classifying a queue a colleague is working
 * through.
 *
 * DISABLING A FIELD IS OFFERED BESIDE TUNING IT, AND THEY ARE DIFFERENT ACTS. A high threshold says
 * "tell me only about big moves"; `is_enabled = false` says "stop showing me this field at all",
 * and the detector then records the movement as NOISE rather than not looking — so turning it back
 * on re-classifies what happened in between rather than starting from the next fetch.
 */

const GLOBAL = '__global__'

function describe(rule: ChangeRuleRow, sourceNames: ReadonlyMap<string, string>): string {
  return rule.source_id === null
    ? t('studio.research.thresholdEverySource')
    : (sourceNames.get(rule.source_id) ?? rule.source_id)
}

export function ChangeRuleEditor({
  rules,
  sources,
  canWrite,
  saveAction,
}: {
  readonly rules: readonly ChangeRuleRow[]
  readonly sources: readonly FilterOption[]
  readonly canWrite: boolean
  readonly saveAction: StudioFormAction
}) {
  const sourceNames = new Map(sources.map((source) => [source.value, source.label]))

  return (
    <Surface level={1} className="p-6" data-change-rule-editor="">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.thresholdsHeading')} />

        <ul className="list-none" data-change-rules="">
          {rules.map((rule) => (
            <li key={rule.id} className="border-line border-t py-3">
              <Cluster gap={2} align="center">
                <Badge tone="neutral">{rule.field}</Badge>
                <Text size="sm" tone="secondary">
                  {describe(rule, sourceNames)}
                </Text>
                <Text size="sm">
                  {rule.material_threshold === null
                    ? t('studio.research.thresholdAnyChange')
                    : `${t('studio.research.thresholdMaterial')} ${String(rule.material_threshold)}`}
                </Text>
                {rule.is_enabled ? null : (
                  <Badge tone="warning">{t('studio.research.thresholdOff')}</Badge>
                )}
                {rule.status === 'PUBLISHED' ? null : <Badge tone="info">{rule.status}</Badge>}
              </Cluster>
            </li>
          ))}
        </ul>

        {canWrite ? (
          <ActionForm action={saveAction}>
            <Cluster gap={3} align="end">
              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.filterField')}
                </Text>
                <Select name="field" required>
                  {CHANGE_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.filterSource')}
                </Text>
                <Select name="source_id" defaultValue={GLOBAL}>
                  {/* THE DEFAULT ROW IS OFFERED BY NAME rather than as an empty option, because
                      "Every source" is a real choice somebody makes deliberately and an empty
                      select reads as an omission. */}
                  <option value={GLOBAL}>{t('studio.research.thresholdEverySource')}</option>
                  {sources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.thresholdMaterial')}
                </Text>
                <Input name="material_threshold" inputMode="decimal" placeholder="0.05" />
              </label>

              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.thresholdMinor')}
                </Text>
                <Input name="minor_threshold" inputMode="decimal" />
              </label>

              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.statusLabel')}
                </Text>
                <Select name="status" defaultValue="DRAFT">
                  <option value="DRAFT">{t('studio.research.statusDraft')}</option>
                  <option value="PUBLISHED">{t('studio.research.statusPublished')}</option>
                </Select>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" name="is_enabled" value="true" defaultChecked />
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.thresholdDetectField')}
                </Text>
              </label>

              <Button type="submit" variant="secondary" size="sm">
                {t('studio.research.apply')}
              </Button>
            </Cluster>
          </ActionForm>
        ) : (
          <Text size="sm" tone="secondary">
            {t('studio.system.flags.readOnlyNote')}
          </Text>
        )}
      </Stack>
    </Surface>
  )
}
