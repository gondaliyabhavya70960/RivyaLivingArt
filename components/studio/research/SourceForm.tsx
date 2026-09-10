'use client'

import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { useActionState, useState } from 'react'

import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Divider } from '@/components/primitives/Divider'
import { Field } from '@/components/primitives/Field'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import {
  SelectField,
  TextAreaField,
  TextField,
  errorFor,
  type FieldIssue,
} from '@/components/studio/FormField'
import { IDLE_FORM_STATE, formIssues, type StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import {
  ANALYTICS_LEAGUES,
  COLLECTION_MODES,
  IMAGE_EXTRACTION_MODES,
  SOURCE_TYPES,
} from '@/lib/scraper/core/source-schema'

/**
 * FEAT §26's source fields, on one form.
 *
 * A CLIENT COMPONENT FOR EXACTLY ONE REASON, and it is worth naming because every other Studio form
 * in this repository is server-rendered: the ADAPTER OVERRIDE has to appear the moment somebody
 * chooses an adapter that does not claim to support the website they typed, and disappear again
 * when they choose one that does. A server round trip for that would mean the warning arrives after
 * a failed save, which is the sequence that teaches people to tick past warnings.
 *
 * THE OVERRIDE IS A TICK RATHER THAN A SILENT ACCEPT, and the server re-checks it. `supports()` is
 * an adapter's own claim, not a fact — a site the generic adapter refuses may still be readable, and
 * the person configuring it may know that. What must not happen is the decision being made by
 * nobody, so the tick is required and it lands in the audit row.
 *
 * THE EXTRACTION CONFIGURATION IS THREE JSON TEXTAREAS AND THAT IS DELIBERATE AT THIS PHASE. Their
 * shape belongs to the Phase 27 adapter that reads them; a rendered builder here would be a builder
 * for selectors no adapter consumes yet. Each is validated by its own Zod schema on save, so a
 * malformed blob is refused with the field named rather than stored.
 */

export interface AdapterOption {
  readonly key: string
  readonly version: string
  readonly capabilities: readonly string[]
}

export interface SourceFormValues {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly base_url: string
  readonly region: string | null
  readonly currency: string | null
  readonly source_type: string | null
  readonly analytics_league: string | null
  readonly collection_mode: string
  readonly adapter_key: string
  readonly image_extraction_mode: string
  readonly price_extraction: unknown
  readonly sku_extraction: unknown
  readonly attribute_extraction: unknown
  readonly rate_limit_rpm: number
  readonly request_delay_ms: number
  readonly concurrency: number
  readonly notes: string | null
  readonly readiness: string
}

const REGIONS = ['GLOBAL', 'IN', 'AE', 'GB', 'US', 'SG', 'AU', 'DE', 'FR', 'IT', 'JP'] as const

/** ISO-4217 codes offered as a convenience. Any valid alpha-3 is accepted by the schema. */
const CURRENCIES = ['INR', 'AED', 'GBP', 'USD', 'EUR', 'SGD', 'AUD', 'JPY'] as const

function blank(label: string): { value: string; label: string } {
  return { value: '', label }
}

function options(values: readonly string[]): readonly { value: string; label: string }[] {
  return values.map((value) => ({ value, label: value }))
}

function pretty(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return fallback
  }
}

export function SourceForm({
  action,
  adapters,
  source,
  canWrite = true,
}: {
  readonly action: StudioFormAction
  readonly adapters: readonly AdapterOption[]
  /** Null when the form creates a source rather than editing one. */
  readonly source: SourceFormValues | null
  readonly canWrite?: boolean
}): React.ReactElement {
  const [state, submit, pending] = useActionState(action, IDLE_FORM_STATE)
  const issues: readonly FieldIssue[] = formIssues(state)
  const formError = errorFor(issues, '_form')

  const [baseUrl, setBaseUrl] = useState(source?.base_url ?? 'https://')
  const [adapterKey, setAdapterKey] = useState(source?.adapter_key ?? 'generic')

  /*
   * THE CLIENT'S COPY OF `supports()`, AND IT IS DELIBERATELY THE WEAKER ONE. A descriptor's real
   * predicate is a function and cannot cross the server boundary, so what is checked here is the
   * only part that is data: whether the address is an http(s) URL at all. The server re-runs the
   * genuine `supports()` before it writes, so this decides when to SHOW the tick, never whether the
   * save is allowed.
   */
  const looksSupported = /^https?:\/\/[^\s/]+/i.test(baseUrl.trim())
  const showOverride = !looksSupported && baseUrl.trim() !== '' && baseUrl.trim() !== 'https://'

  const adapter = adapters.find((entry) => entry.key === adapterKey) ?? adapters[0]

  return (
    <form action={submit}>
      <Stack gap={6}>
        {source === null ? null : <input type="hidden" name="id" value={source.id} />}
        {source === null ? null : <input type="hidden" name="readiness" value={source.readiness} />}

        {formError === undefined ? null : (
          <Text tone="secondary" data-form-error="">
            {formError}
          </Text>
        )}
        {state.status === 'saved' ? (
          <Text tone="secondary" data-form-saved="">
            {t('studio.research.sourceSaved')}
          </Text>
        ) : null}

        <TextField
          name="name"
          label={t('studio.research.sourceName')}
          issues={issues}
          defaultValue={source?.name ?? ''}
          required
          requiredLabel={t('studio.users.requiredLabel')}
        />
        <TextField
          name="slug"
          label={t('studio.research.sourceSlug')}
          help={t('studio.research.sourceSlugHelp')}
          issues={issues}
          defaultValue={source?.slug ?? ''}
          required
          requiredLabel={t('studio.users.requiredLabel')}
        />
        <Field
          label={t('studio.research.sourceBaseUrl')}
          help={t('studio.research.sourceBaseUrlHelp')}
          error={errorFor(issues, 'baseUrl') ?? errorFor(issues, 'base_url')}
          controlId="base_url"
          required
          requiredLabel={t('studio.users.requiredLabel')}
        >
          <Input
            id="base_url"
            name="base_url"
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </Field>

        <SelectField
          name="region"
          label={t('studio.research.sourceRegion')}
          issues={issues}
          defaultValue={source?.region ?? ''}
          options={[blank('—'), ...options(REGIONS)]}
        />
        <SelectField
          name="currency"
          label={t('studio.research.sourceCurrency')}
          help={t('studio.research.sourceCurrencyHelp')}
          issues={issues}
          defaultValue={source?.currency ?? ''}
          options={[blank('—'), ...options(CURRENCIES)]}
        />
        <SelectField
          name="source_type"
          label={t('studio.research.sourceType')}
          issues={issues}
          defaultValue={source?.source_type ?? ''}
          options={[blank('—'), ...options(SOURCE_TYPES)]}
        />
        <SelectField
          name="analytics_league"
          label={t('studio.research.sourceLeague')}
          help={t('studio.research.sourceLeagueHelp')}
          issues={issues}
          defaultValue={source?.analytics_league ?? ''}
          options={[blank('—'), ...options(ANALYTICS_LEAGUES)]}
        />
        <SelectField
          name="collection_mode"
          label={t('studio.research.sourceCollectionMode')}
          issues={issues}
          defaultValue={source?.collection_mode ?? 'SEED_URLS'}
          options={options(COLLECTION_MODES)}
        />

        <Divider />

        <Field
          label={t('studio.research.sourceAdapter')}
          help={t('studio.research.sourceAdapterHelp')}
          error={errorFor(issues, 'adapter_key') ?? errorFor(issues, 'adapterKey')}
          controlId="adapter_key"
        >
          <Select
            id="adapter_key"
            name="adapter_key"
            value={adapterKey}
            onChange={(event) => setAdapterKey(event.target.value)}
          >
            {adapters.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {`${entry.key} · ${entry.version}`}
              </option>
            ))}
          </Select>
        </Field>
        {adapter === undefined ? null : (
          <Text size="sm" tone="tertiary" data-adapter-capabilities="">
            {adapter.capabilities.join(' · ')}
          </Text>
        )}
        {showOverride ? (
          <Stack gap={2} data-adapter-warning="">
            <Text size="sm" tone="secondary">
              {t('studio.research.adapterUnsupported')}
            </Text>
            <label className="flex items-center gap-2">
              <Checkbox name="adapter_override" />
              <Text size="sm" as="span">
                {t('studio.research.adapterOverride')}
              </Text>
            </label>
          </Stack>
        ) : null}

        <SelectField
          name="image_extraction_mode"
          label={t('studio.research.sourceImageMode')}
          help={t('studio.research.sourceImageModeHelp')}
          issues={issues}
          defaultValue={source?.image_extraction_mode ?? 'NONE'}
          options={options(IMAGE_EXTRACTION_MODES)}
        />

        <Divider />

        <Text tone="secondary">{t('studio.research.extractionBody')}</Text>
        <TextAreaField
          name="price_extraction"
          label={t('studio.research.priceExtraction')}
          issues={issues}
          rows={6}
          defaultValue={pretty(source?.price_extraction, '{\n  "strategy": "NONE"\n}')}
        />
        <TextAreaField
          name="sku_extraction"
          label={t('studio.research.skuExtraction')}
          issues={issues}
          rows={6}
          defaultValue={pretty(source?.sku_extraction, '{\n  "strategy": "NONE"\n}')}
        />
        <TextAreaField
          name="attribute_extraction"
          label={t('studio.research.attributeExtraction')}
          issues={issues}
          rows={8}
          defaultValue={pretty(source?.attribute_extraction, '[]')}
        />

        <Divider />

        <TextField
          name="rate_limit_rpm"
          label={t('studio.research.rateLimit')}
          issues={issues}
          defaultValue={String(source?.rate_limit_rpm ?? 20)}
        />
        <TextField
          name="request_delay_ms"
          label={t('studio.research.requestDelay')}
          help={t('studio.research.politenessBody')}
          issues={issues}
          defaultValue={String(source?.request_delay_ms ?? 3000)}
        />
        <TextField
          name="concurrency"
          label={t('studio.research.concurrency')}
          issues={issues}
          defaultValue={String(source?.concurrency ?? 1)}
        />
        <TextAreaField
          name="notes"
          label={t('studio.research.sourceNotes')}
          help={t('studio.research.sourceNotesHelp')}
          issues={issues}
          rows={4}
          defaultValue={source?.notes ?? ''}
        />

        {canWrite ? (
          <div>
            <Button type="submit" variant="primary" loading={pending}>
              {t('studio.research.save')}
            </Button>
          </div>
        ) : null}
      </Stack>
    </form>
  )
}
