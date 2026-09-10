import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import { EmptyState } from '@/components/studio/EmptyState'
import { PageHeader } from '@/components/studio/PageHeader'
import { t } from '@/components/studio/strings'
import { URL_PATTERN_KINDS } from '@/lib/scraper/core/source-schema'
import type { StudioFormAction } from '@/components/studio/form-state'

/**
 * The URL patterns of one source: what a product page looks like, and what must never be fetched.
 *
 * SERVER-RENDERED, and every control is a form that posts to a Server Action. There is no client
 * state here because there is nothing to keep: adding a pattern re-renders the list, and a form
 * that works with JavaScript off is the same form that works while a deploy is mid-flight.
 *
 * EXCLUDE IS DRAWN DIFFERENTLY BECAUSE IT BEHAVES DIFFERENTLY. It wins over every other kind
 * whatever the priority column says, so showing it in the same neutral grey as a PRODUCT rule
 * would suggest an ordering that does not exist. The matcher's rule is in
 * `lib/scraper/core/url-patterns.ts`; this is the half a person reads.
 */

export interface UrlPatternRow {
  readonly id: string
  readonly kind: string
  readonly pattern: string
  readonly is_regex: boolean
  readonly priority: number
  readonly notes: string | null
}

export function UrlPatternEditor({
  sourceId,
  patterns,
  canWrite,
  canDelete,
  saveAction,
  deleteAction,
}: {
  readonly sourceId: string
  readonly patterns: readonly UrlPatternRow[]
  readonly canWrite: boolean
  readonly canDelete: boolean
  readonly saveAction: StudioFormAction
  readonly deleteAction: StudioFormAction
}) {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.patternsHeading')} />
        <Text tone="secondary">{t('studio.research.patternsBody')}</Text>

        {patterns.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noPatterns')}
            body={t('studio.research.noPatternsBody')}
          />
        ) : (
          <div className="border-line overflow-x-auto border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t('studio.research.patternsHeading')}</caption>
              <thead className="bg-surface-raised">
                <tr>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.patternKind')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.patternValue')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.patternPriority')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    <span className="sr-only">{t('studio.research.remove')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((row) => (
                  <tr key={row.id} className="border-line border-t" data-pattern-id={row.id}>
                    <td className="p-2">
                      <Badge tone={row.kind === 'EXCLUDE' ? 'danger' : 'neutral'}>{row.kind}</Badge>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {row.pattern}
                      {row.is_regex ? (
                        <span className="text-ink-tertiary ml-2">(regex)</span>
                      ) : null}
                    </td>
                    <td className="p-2">{row.priority}</td>
                    <td className="p-2 text-right">
                      {canDelete ? (
                        <ActionForm action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="source_id" value={sourceId} />
                          <Button type="submit" variant="quiet" size="sm">
                            {t('studio.research.remove')}
                          </Button>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canWrite ? (
          <ActionForm action={saveAction}>
            <Stack gap={3}>
              <input type="hidden" name="source_id" value={sourceId} />
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.patternKind')}
                </Text>
                <Select name="kind">
                  {URL_PATTERN_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.patternValue')}
                </Text>
                <Input name="pattern" className="font-mono" />
              </label>
              <label className="flex items-center gap-2">
                <Checkbox name="is_regex" />
                <Text size="sm" as="span">
                  {t('studio.research.patternIsRegex')}
                </Text>
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.patternPriority')}
                </Text>
                <Input name="priority" type="number" defaultValue="0" />
              </label>
              <div>
                <Button type="submit" variant="secondary">
                  {t('studio.research.add')}
                </Button>
              </div>
            </Stack>
          </ActionForm>
        ) : null}
      </Stack>
    </Surface>
  )
}
