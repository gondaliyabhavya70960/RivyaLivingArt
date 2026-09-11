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
import { SCALE_BANDS } from '@/lib/scraper/analytics/scale'
import type { ScaleRuleRow } from '@/lib/supabase/repositories/research/scale'

/**
 * The ordered scale rules, edited as data.
 *
 * THE ORDER IS THE INTERFACE. These rules are read top to bottom and the first match wins, so the
 * editor renders them in priority order and shows the number — a merchandiser asking "why is this
 * banded UNKNOWN" should be able to read the list and find rule 10 catching it, rather than
 * reverse-engineering a score.
 *
 * THE PREDICATE IS RENDERED IN WORDS, NOT AS JSON. The stored shape is a closed vocabulary of three
 * keys; showing `{"minLongestAxisMm":1800}` would invite somebody to edit the JSON, and a rule
 * engine that evaluated arbitrary jsonb from a form would be the shape of an injection. So the form
 * has one field per key and the object is assembled server-side.
 *
 * A DRAFT RULE CLASSIFIES NOTHING until it is published — which is what lets somebody prepare a
 * threshold, read it beside the ones in force, and turn it on when they mean to.
 */

/** What an empty predicate matches, which is what a fallthrough rule is. */
const EVERYTHING = 'everything'

function describePredicate(predicate: unknown): string {
  if (predicate === null || typeof predicate !== 'object' || Array.isArray(predicate)) {
    return EVERYTHING
  }
  const raw = predicate as Record<string, unknown>
  const parts: string[] = []
  if (raw['parseState'] === 'NOT_PARSED') parts.push('dimensions not parsed')
  if (typeof raw['minLongestAxisMm'] === 'number') {
    parts.push(`longest axis ≥ ${String(raw['minLongestAxisMm'])} mm`)
  }
  if (raw['categoryInLargeFormatSet'] === true) parts.push('in a mapped category')
  return parts.length === 0 ? EVERYTHING : parts.join(' and ')
}

export function ScaleRuleEditor({
  rules,
  canWrite,
  saveAction,
}: {
  readonly rules: readonly ScaleRuleRow[]
  readonly canWrite: boolean
  readonly saveAction: StudioFormAction
}) {
  return (
    <Surface level={1} className="p-6" data-scale-rule-editor="">
      <Stack gap={5}>
        <Stack gap={1}>
          <PageHeader level={2} title={t('studio.research.scaleRulesHeading')} />
          <Text size="xs" tone="secondary">
            {t('studio.research.scaleRuleOrder')}
          </Text>
        </Stack>

        <ul className="list-none" data-scale-rules="">
          {rules.map((rule) => (
            <li key={rule.id} className="border-line border-t py-3" data-scale-rule={rule.id}>
              <Cluster gap={2} align="center">
                <Badge tone="neutral">{String(rule.priority)}</Badge>
                <Text size="sm">{describePredicate(rule.predicate)}</Text>
                <Text size="sm" tone="secondary">
                  {'→ '}
                  {rule.result_band ?? t('studio.research.scaleRuleFromSignature')}
                  {rule.result_is_large === null
                    ? ''
                    : rule.result_is_large
                      ? `, ${t('studio.research.tallyLarge')}`
                      : `, ${t('studio.research.tallyNotLarge')}`}
                </Text>
                {rule.is_enabled ? null : (
                  <Badge tone="warning">{t('studio.research.thresholdOff')}</Badge>
                )}
                {rule.status === 'PUBLISHED' ? null : <Badge tone="info">{rule.status}</Badge>}
              </Cluster>
              {rule.notes === null ? null : (
                <Text size="xs" tone="secondary">
                  {rule.notes}
                </Text>
              )}
            </li>
          ))}
        </ul>

        {canWrite ? (
          <ActionForm action={saveAction}>
            <Cluster gap={3} align="end">
              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.scaleRulePriority')}
                </Text>
                <Input name="priority" inputMode="numeric" required />
              </label>

              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.scaleRuleMinAxis')}
                </Text>
                <Input name="min_longest_axis_mm" inputMode="numeric" placeholder="1800" />
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" name="category_in_large_format_set" value="true" />
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.scaleRuleMappedCategory')}
                </Text>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" name="not_parsed" value="true" />
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.scaleRuleNotParsed')}
                </Text>
              </label>

              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.filterBand')}
                </Text>
                <Select name="result_band" defaultValue="">
                  <option value="">{t('studio.research.scaleRuleFromSignature')}</option>
                  {SCALE_BANDS.map((band) => (
                    <option key={band} value={band}>
                      {band}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="flex flex-col gap-1">
                <Text size="xs" tone="secondary" as="span">
                  {t('studio.research.largeFormatHeading')}
                </Text>
                <Select name="result_is_large" defaultValue="">
                  <option value="">{t('studio.research.tallyUnknown')}</option>
                  <option value="true">{t('studio.research.tallyLarge')}</option>
                  <option value="false">{t('studio.research.tallyNotLarge')}</option>
                </Select>
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
                  {t('studio.research.scaleRuleEnabled')}
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
