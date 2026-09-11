import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Select } from '@/components/primitives/Select'
import { Text } from '@/components/primitives/Text'
import { t, type StudioStringKey } from '@/components/studio/strings'

import type { FilterOption } from './ExplorerFilters'

/**
 * The change queue's filters, as a plain GET form.
 *
 * THE SAME ARGUMENT AS `ExplorerFilters`, AND THE SAME SHAPE: a filter set that lives in the URL is
 * one somebody can bookmark and paste into a message. "Material price changes on this source,
 * undecided" is a link rather than a set of instructions, and it keeps the whole queue a Server
 * Component.
 *
 * THE DEFAULTS ARE THE ONES THE PHASE DOCUMENT NAMES: `MATERIAL` and undecided. They are expressed
 * as the absent value rather than as a pre-selected option, because a filter that reads "All" while
 * showing a subset is the control that makes people distrust the screen. The select shows
 * `Material` selected, because that is what is applied.
 */

export interface ChangeFilterValues {
  readonly source: string
  readonly field: string
  readonly materiality: string
  readonly decided: string
  readonly age: string
}

function FilterSelect({
  name,
  labelKey,
  value,
  options,
  allLabel,
}: {
  readonly name: string
  readonly labelKey: StudioStringKey
  readonly value: string
  readonly options: readonly FilterOption[]
  readonly allLabel?: string
}) {
  return (
    <label className="flex min-w-40 flex-col gap-1">
      <Text size="xs" as="span" tone="secondary">
        {t(labelKey)}
      </Text>
      <Select name={name} defaultValue={value} data-filter={name}>
        <option value="">{allLabel ?? t('studio.research.filterAll')}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}

export function ChangeFilters({
  values,
  sources,
  fields,
}: {
  readonly values: ChangeFilterValues
  readonly sources: readonly FilterOption[]
  readonly fields: readonly FilterOption[]
}) {
  return (
    <form method="get" data-testid="change-filters">
      <Cluster gap={3} align="end">
        <FilterSelect
          name="source"
          labelKey="studio.research.filterSource"
          value={values.source}
          options={sources}
        />
        <FilterSelect
          name="field"
          labelKey="studio.research.filterField"
          value={values.field}
          options={fields}
        />
        <FilterSelect
          name="materiality"
          labelKey="studio.research.filterMateriality"
          value={values.materiality}
          options={[
            { value: 'MATERIAL', label: 'Material' },
            { value: 'MINOR', label: 'Minor' },
            // NOISE IS OFFERED BY NAME AND IS NEVER THE DEFAULT. Somebody auditing what the
            // classifier discarded needs to see it; nobody should meet it by accident.
            { value: 'NOISE', label: 'Noise' },
          ]}
          allLabel="Material and minor"
        />
        <FilterSelect
          name="decided"
          labelKey="studio.research.filterDecided"
          value={values.decided}
          options={[
            { value: 'UNDECIDED', label: 'Not yet decided' },
            { value: 'DECIDED', label: 'Decided' },
          ]}
        />
        <FilterSelect
          name="age"
          labelKey="studio.research.filterAge"
          value={values.age}
          options={[
            { value: '1', label: 'Today' },
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
          ]}
          allLabel="Any time"
        />
        <Button type="submit" variant="secondary">
          {t('studio.research.apply')}
        </Button>
      </Cluster>
    </form>
  )
}
