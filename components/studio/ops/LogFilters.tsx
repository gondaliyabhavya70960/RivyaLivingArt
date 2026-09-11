import { Input } from '@/components/primitives/Input'
import { Label } from '@/components/primitives/Label'
import { Select } from '@/components/primitives/Select'
import { FilterBar } from '@/components/studio/FilterBar'
import { t } from '@/components/studio/strings'
import { activeFilterCount } from '@/lib/logging/log-filters'
import { LOG_CHANNELS, LOG_LEVELS, type SystemLogFilter } from '@/lib/supabase/schemas/system-logs'

/**
 * The filters — Phase 38, RC-346. A GET form: the URL is the filter, so a colleague can be sent
 * the incident. Time range, level, channel, actor, workflow run, research source, entity type
 * and id, and free text over `event`.
 */

function Field({
  name,
  label,
  value,
  placeholder,
}: {
  name: string
  label: string
  value: string | undefined
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Input
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        size="sm"
        className="w-44"
      />
    </label>
  )
}

export function LogFilters({ filter }: { readonly filter: SystemLogFilter }) {
  return (
    <FilterBar
      label={t('studio.logs.filtersLabel')}
      action="/studio/operations/logs"
      applyLabel={t('studio.logs.apply')}
      activeCount={activeFilterCount(filter)}
      activeLabel={t('studio.logs.activeFilters')}
    >
      <label className="flex flex-col gap-1">
        <Label>{t('studio.logs.filterLevel')}</Label>
        <Select name="level" defaultValue={filter.level ?? ''}>
          <option value="">{t('studio.logs.any')}</option>
          {LOG_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1">
        <Label>{t('studio.logs.filterChannel')}</Label>
        <Select name="channel" defaultValue={filter.channel ?? ''}>
          <option value="">{t('studio.logs.any')}</option>
          {LOG_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </Select>
      </label>
      <Field
        name="from"
        label={t('studio.logs.filterFrom')}
        value={filter.from}
        placeholder="2026-09-11T00:00"
      />
      <Field
        name="to"
        label={t('studio.logs.filterTo')}
        value={filter.to}
        placeholder="2026-09-12T00:00"
      />
      <Field name="event" label={t('studio.logs.filterEvent')} value={filter.event} />
      <Field name="actor" label={t('studio.logs.filterActor')} value={filter.actorId} />
      <Field name="run" label={t('studio.logs.filterRun')} value={filter.workflowRunId} />
      <Field name="source" label={t('studio.logs.filterSource')} value={filter.researchSourceId} />
      <Field
        name="entity_type"
        label={t('studio.logs.filterEntityType')}
        value={filter.entityType}
      />
      <Field name="entity" label={t('studio.logs.filterEntity')} value={filter.entityId} />
    </FilterBar>
  )
}
