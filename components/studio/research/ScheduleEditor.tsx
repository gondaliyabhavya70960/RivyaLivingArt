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
import { SCHEDULE_JOB_TYPES } from '@/lib/scraper/core/source-schema'
import type { StudioFormAction } from '@/components/studio/form-state'

/**
 * When each kind of job runs against this source.
 *
 * THE SIX-HOUR FLOOR IS STATED HERE AND ENFORCED IN THE DATABASE, and the copy says which. An
 * operator who reads "six hours is the shortest interval this system will accept" and then finds a
 * five-minute expression refused has been told the truth twice; one who reads a limit the form
 * enforces and a server action does not has been told it once, in the place that does not decide.
 *
 * UTC IS NOT A CHOICE ON THIS FORM. The scheduler evaluates every cron field in UTC, so a timezone
 * control would offer a setting it ignores. The column exists — FEAT §26 field 19 names it — and
 * the CHECK refuses anything else, which is better than storing a lie.
 */

export interface ScheduleRow {
  readonly id: string
  readonly job_type: string
  readonly cron_expression: string
  readonly timezone: string
  readonly is_enabled: boolean
  readonly next_run_at: string | null
}

export function ScheduleEditor({
  sourceId,
  schedules,
  canWrite,
  canDelete,
  saveAction,
  deleteAction,
}: {
  readonly sourceId: string
  readonly schedules: readonly ScheduleRow[]
  readonly canWrite: boolean
  readonly canDelete: boolean
  readonly saveAction: StudioFormAction
  readonly deleteAction: StudioFormAction
}) {
  return (
    <Surface level={1} className="p-6">
      <Stack gap={5}>
        <PageHeader level={2} title={t('studio.research.schedulesHeading')} />
        <Text tone="secondary">{t('studio.research.schedulesBody')}</Text>

        {schedules.length === 0 ? (
          <EmptyState
            reason="empty"
            heading={t('studio.research.noSchedules')}
            body={t('studio.research.noSchedulesBody')}
          />
        ) : (
          <div className="border-line overflow-x-auto border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t('studio.research.schedulesHeading')}</caption>
              <thead className="bg-surface-raised">
                <tr>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.scheduleJobType')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.scheduleCron')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    {t('studio.research.scheduleEnabled')}
                  </th>
                  <th scope="col" className="p-2 text-left">
                    <span className="sr-only">{t('studio.research.remove')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((row) => (
                  <tr key={row.id} className="border-line border-t" data-schedule-id={row.id}>
                    <td className="p-2">{row.job_type}</td>
                    <td className="p-2 font-mono text-xs">
                      {row.cron_expression}
                      <span className="text-ink-tertiary ml-2">{row.timezone}</span>
                    </td>
                    <td className="p-2">
                      {row.is_enabled ? (
                        <Badge tone="success">{t('studio.research.scheduleEnabled')}</Badge>
                      ) : (
                        <Text size="sm" tone="tertiary" as="span">
                          —
                        </Text>
                      )}
                    </td>
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
                  {t('studio.research.scheduleJobType')}
                </Text>
                <Select name="job_type">
                  {SCHEDULE_JOB_TYPES.map((jobType) => (
                    <option key={jobType} value={jobType}>
                      {jobType}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <Text size="sm" as="span">
                  {t('studio.research.scheduleCron')}
                </Text>
                <Input name="cron_expression" defaultValue="0 */12 * * *" className="font-mono" />
              </label>
              <label className="flex items-center gap-2">
                <Checkbox name="is_enabled" />
                <Text size="sm" as="span">
                  {t('studio.research.scheduleEnabled')}
                </Text>
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
