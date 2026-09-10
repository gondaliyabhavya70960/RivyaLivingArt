import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { PageHeader } from '@/components/studio/PageHeader'
import { t, type StudioStringKey } from '@/components/studio/strings'

/**
 * The explorer's filters, as a plain GET form.
 *
 * NO CLIENT JAVASCRIPT, AND IT IS NOT AN AUSTERITY MEASURE. A filter set that lives in the URL is
 * one somebody can bookmark, paste into a message and send to a colleague — "the rows with errors
 * on this source" is a link rather than a set of instructions. It also makes the whole explorer a
 * Server Component, which is what lets the row list be a database query rather than a payload.
 *
 * THE `row` PARAMETER SURVIVES A FILTER CHANGE ONLY WHEN IT IS ABSENT FROM THIS FORM, so it does
 * not appear here: re-filtering while a drawer is open should close the drawer, because the row
 * behind it may not be in the new set and a drawer over an empty table is a screen nobody can leave.
 */

export interface FilterOption {
  readonly value: string
  readonly label: string
}

export interface ExplorerFilterValues {
  readonly source: string
  readonly stage: string
  readonly severity: string
  readonly priceState: string
  readonly currency: string
  readonly parseState: string
  readonly disposition: string
  readonly q: string
}

function FilterSelect({
  name,
  labelKey,
  value,
  options,
}: {
  readonly name: string
  readonly labelKey: StudioStringKey
  readonly value: string
  readonly options: readonly FilterOption[]
}) {
  return (
    <label className="flex min-w-40 flex-col gap-1">
      <Text size="xs" as="span" tone="secondary">
        {t(labelKey)}
      </Text>
      <Select name={name} defaultValue={value} data-filter={name}>
        <option value="">{t('studio.research.filterAll')}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}

const STAGES: readonly FilterOption[] = [
  { value: 'RAW', label: 'RAW' },
  { value: 'NORMALIZED', label: 'NORMALIZED' },
  { value: 'VALIDATED', label: 'VALIDATED' },
  { value: 'MATCHED', label: 'MATCHED' },
  { value: 'REVIEW', label: 'REVIEW' },
  { value: 'SHORTLISTED', label: 'SHORTLISTED' },
  { value: 'CONFIRMED', label: 'CONFIRMED' },
]

const SEVERITIES: readonly FilterOption[] = [
  { value: 'ERROR', label: 'ERROR' },
  { value: 'WARNING', label: 'WARNING' },
  { value: 'INFO', label: 'INFO' },
]

const PRICE_STATES: readonly FilterOption[] = [
  { value: 'FIXED', label: 'FIXED' },
  { value: 'STARTING_FROM', label: 'STARTING_FROM' },
  { value: 'REQUEST_QUOTE', label: 'REQUEST_QUOTE' },
  { value: 'PRICE_ON_REQUEST', label: 'PRICE_ON_REQUEST' },
  { value: 'UNKNOWN', label: 'UNKNOWN' },
]

const PARSE_STATES: readonly FilterOption[] = [
  { value: 'PARSED', label: 'PARSED' },
  { value: 'AMBIGUOUS', label: 'AMBIGUOUS' },
  { value: 'UNPARSED', label: 'UNPARSED' },
  { value: 'ABSENT', label: 'ABSENT' },
]

const DISPOSITIONS: readonly FilterOption[] = [
  { value: 'NONE', label: 'NONE' },
  { value: 'IGNORED', label: 'IGNORED' },
  { value: 'REJECTED', label: 'REJECTED' },
  { value: 'DUPLICATE', label: 'DUPLICATE' },
]

export function ExplorerFilters({
  values,
  sources,
  currencies,
}: {
  readonly values: ExplorerFilterValues
  readonly sources: readonly FilterOption[]
  readonly currencies: readonly FilterOption[]
}) {
  return (
    <Surface level={1} className="p-4">
      <form method="get" action="/studio/research/explorer">
        <Stack gap={3}>
          <PageHeader level={2} title={t('studio.research.filtersHeading')} />
          <Cluster gap={3} align="end">
            <FilterSelect
              name="source"
              labelKey="studio.research.filterSource"
              value={values.source}
              options={sources}
            />
            <FilterSelect
              name="stage"
              labelKey="studio.research.filterStage"
              value={values.stage}
              options={STAGES}
            />
            <FilterSelect
              name="severity"
              labelKey="studio.research.filterSeverity"
              value={values.severity}
              options={SEVERITIES}
            />
            <FilterSelect
              name="price_state"
              labelKey="studio.research.filterPriceState"
              value={values.priceState}
              options={PRICE_STATES}
            />
            <FilterSelect
              name="currency"
              labelKey="studio.research.filterCurrency"
              value={values.currency}
              options={currencies}
            />
            <FilterSelect
              name="parse_state"
              labelKey="studio.research.filterParseState"
              value={values.parseState}
              options={PARSE_STATES}
            />
            <FilterSelect
              name="disposition"
              labelKey="studio.research.filterDisposition"
              value={values.disposition}
              options={DISPOSITIONS}
            />
            <label className="flex min-w-48 flex-col gap-1">
              <Text size="xs" as="span" tone="secondary">
                {t('studio.research.filterTitle')}
              </Text>
              <Input name="q" defaultValue={values.q} data-filter="q" />
            </label>
            <Button type="submit" variant="secondary" size="sm">
              {t('studio.research.apply')}
            </Button>
          </Cluster>
        </Stack>
      </form>
    </Surface>
  )
}
