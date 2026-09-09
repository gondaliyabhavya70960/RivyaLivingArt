'use client'

import * as React from 'react'

import { Checkbox } from '@/components/primitives/Checkbox'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Radio } from '@/components/primitives/Radio'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Heading } from '@/components/primitives/Heading'
import { Text } from '@/components/primitives/Text'
import { Textarea } from '@/components/primitives/Textarea'
import { DIMENSION_UNITS, fieldOptions, fieldValidation } from '@/lib/cms/forms'
import type { UploadedReference } from '@/lib/cms/forms'
import type { CustomizationFormField } from '@/lib/supabase/schemas'

import { ReferenceUpload } from './ReferenceUpload'
import type { ConfiguratorCopy, ConfiguratorStep, UploadLimits } from './types'

/**
 * One screen of the brief: a step's heading and its enabled fields.
 *
 * EVERY LABEL COMES FROM A ROW. There is not one question in this file — `field.label`,
 * `field.help_text`, `field.placeholder` and every option's text are read from
 * `customization_form_fields`, which is the whole point of the phase: changing what the form asks is
 * an editorial act with no deploy. What IS in this file is how a field TYPE renders, which is code.
 *
 * THE REQUIRED MARKER IS A WORD, NOT AN ASTERISK. `Field` refuses to mark a field required without
 * the word to mark it with, and the word comes from `global_content` — an asterisk is not announced
 * by every screen reader and means nothing to a first-time visitor.
 *
 * MOST FIELDS ARE OPTIONAL, SO THE OPTIONAL ONES ARE MARKED TOO. The FEAT §15 sequence has three
 * required steps out of eleven; marking only the required ones would leave a visitor guessing what
 * they are allowed to skip on a form whose whole posture is "tell us what you know".
 *
 * NO FIELD RENDERS A PRICE, AND NO FIELD TYPE EXISTS THAT COULD. `form_field_type` has fourteen
 * members and none of them is a currency input; `validation` is constrained by the database to an
 * allowlist of Zod keys with no money in it. `no-pricing.test.ts` reads this directory.
 */

export interface ConfiguratorStepProps {
  readonly entry: ConfiguratorStep
  readonly answers: Readonly<Record<string, unknown>>
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (key: string, value: unknown) => void
  readonly copy: ConfiguratorCopy
  readonly uploadLimits: UploadLimits
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** A dimension answer, split for the two controls that edit it. */
function asDimension(value: unknown): { amount: string; unit: string } {
  if (value !== null && typeof value === 'object') {
    const record = value as { amount?: unknown; unit?: unknown }
    return {
      amount: typeof record.amount === 'number' ? String(record.amount) : '',
      unit: typeof record.unit === 'string' ? record.unit : DIMENSION_UNITS[0],
    }
  }
  return { amount: '', unit: DIMENSION_UNITS[0] }
}

function asReferences(value: unknown): readonly UploadedReference[] {
  return Array.isArray(value) ? (value as UploadedReference[]) : []
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function ConfiguratorStepView({
  entry,
  answers,
  errors,
  onChange,
  copy,
  uploadLimits,
}: ConfiguratorStepProps) {
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Heading level={2}>{entry.step.title}</Heading>
        {entry.step.description === null ? null : (
          <Text tone="secondary">{entry.step.description}</Text>
        )}
      </Stack>

      <Stack gap={5}>
        {entry.fields.map((field) => (
          <FieldView
            key={field.id}
            field={field}
            value={answers[field.key]}
            error={errors[field.key]}
            onChange={onChange}
            copy={copy}
            uploadLimits={uploadLimits}
          />
        ))}
      </Stack>
    </Stack>
  )
}

interface FieldViewProps {
  readonly field: CustomizationFormField
  readonly value: unknown
  readonly error: string | undefined
  readonly onChange: (key: string, value: unknown) => void
  readonly copy: ConfiguratorCopy
  readonly uploadLimits: UploadLimits
}

function FieldView({ field, value, error, onChange, copy, uploadLimits }: FieldViewProps) {
  const rules = fieldValidation(field)
  const options = fieldOptions(field)
  const help = field.help_text ?? (field.is_required ? undefined : copy.optional)
  const marker = field.is_required
    ? ({ required: true, requiredLabel: copy.required } as const)
    : ({ required: false } as const)

  const common = {
    label: field.label,
    help,
    error,
    ...marker,
  }

  switch (field.field_type) {
    case 'TEXTAREA':
      return (
        <Field {...common}>
          <Textarea
            name={field.key}
            value={asString(value)}
            placeholder={field.placeholder ?? undefined}
            rows={5}
            maxLength={rules.maxLength}
            onChange={(event) => {
              onChange(field.key, event.target.value)
            }}
          />
        </Field>
      )

    case 'SELECT':
    case 'COLOUR_DIRECTION':
      return (
        <Field {...common}>
          <Select
            name={field.key}
            value={asString(value)}
            onChange={(event) => {
              onChange(field.key, event.target.value)
            }}
          >
            {/* An empty first option, so a select with no answer is distinguishable from one whose
                answer happens to be the first choice. Its text is the field's own placeholder or
                nothing — never an invented "Please select". */}
            <option value="">{field.placeholder ?? ''}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      )

    case 'RADIO': {
      const selected = asString(value)
      return (
        <Field {...common} role="radiogroup">
          <Stack gap={2}>
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Radio
                  name={field.key}
                  value={option.value}
                  checked={selected === option.value}
                  onChange={() => {
                    onChange(field.key, option.value)
                  }}
                />
                {option.label}
              </label>
            ))}
          </Stack>
        </Field>
      )
    }

    case 'MULTISELECT': {
      const selected = asStringArray(value)
      return (
        <Field {...common} role="group">
          <Stack gap={2}>
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  name={field.key}
                  value={option.value}
                  checked={selected.includes(option.value)}
                  onChange={(event) => {
                    onChange(
                      field.key,
                      event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value),
                    )
                  }}
                />
                {option.label}
              </label>
            ))}
          </Stack>
        </Field>
      )
    }

    case 'CHECKBOX':
      return (
        <Field {...common}>
          <Checkbox
            name={field.key}
            checked={value === true}
            onChange={(event) => {
              onChange(field.key, event.target.checked)
            }}
          />
        </Field>
      )

    case 'NUMBER':
      return (
        <Field {...common}>
          <Input
            name={field.key}
            type="number"
            inputMode="decimal"
            value={typeof value === 'number' ? String(value) : asString(value)}
            placeholder={field.placeholder ?? undefined}
            min={rules.min}
            max={rules.max}
            step={rules.step}
            onChange={(event) => {
              const raw = event.target.value
              onChange(field.key, raw === '' ? '' : Number(raw))
            }}
          />
        </Field>
      )

    case 'DIMENSION': {
      const dimension = asDimension(value)
      return (
        <Field {...common}>
          {/* Two controls, one answer. The unit is CHOSEN rather than typed: "8 feet" and "2.4m"
              written into a text box are two strings nobody can compare, and the unit is part of
              what the visitor means rather than a suffix on it. */}
          <div className="flex gap-2">
            <Input
              name={`${field.key}__amount`}
              type="number"
              inputMode="decimal"
              value={dimension.amount}
              placeholder={field.placeholder ?? undefined}
              min={rules.min}
              max={rules.max}
              aria-label={field.label}
              onChange={(event) => {
                const raw = event.target.value
                onChange(field.key, raw === '' ? '' : { amount: Number(raw), unit: dimension.unit })
              }}
            />
            <Select
              name={`${field.key}__unit`}
              value={dimension.unit}
              // The unit select's own name. Not seeded: a unit is a symbol, not editorial copy,
              // and the group is already named by the field's label above.
              aria-label={field.label}
              onChange={(event) => {
                onChange(
                  field.key,
                  dimension.amount === ''
                    ? ''
                    : { amount: Number(dimension.amount), unit: event.target.value },
                )
              }}
            >
              {DIMENSION_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      )
    }

    case 'FILE':
      return (
        <Field {...common}>
          <ReferenceUpload
            fieldKey={field.key}
            value={asReferences(value)}
            onChange={(next) => {
              onChange(field.key, next)
            }}
            limits={{
              maxFiles: rules.maxFiles ?? uploadLimits.maxFiles,
              maxBytes: uploadLimits.maxBytes,
            }}
            copy={copy}
          />
        </Field>
      )

    case 'CONTACT_EMAIL':
      return (
        <Field {...common}>
          <Input
            name={field.key}
            type="email"
            autoComplete="email"
            value={asString(value)}
            placeholder={field.placeholder ?? undefined}
            onChange={(event) => {
              onChange(field.key, event.target.value)
            }}
          />
        </Field>
      )

    case 'CONTACT_PHONE':
      return (
        <Field {...common}>
          <Input
            name={field.key}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={asString(value)}
            placeholder={field.placeholder ?? undefined}
            onChange={(event) => {
              onChange(field.key, event.target.value)
            }}
          />
        </Field>
      )

    case 'CONTACT_NAME':
    case 'CITY':
    case 'TEXT':
      return (
        <Field {...common}>
          <Input
            name={field.key}
            type="text"
            // `name` and `address-level2` are the two autofill hints that genuinely help here.
            // A visitor typing their own name and city into a form should not have to.
            autoComplete={
              field.field_type === 'CONTACT_NAME'
                ? 'name'
                : field.field_type === 'CITY'
                  ? 'address-level2'
                  : 'off'
            }
            value={asString(value)}
            placeholder={field.placeholder ?? undefined}
            maxLength={rules.maxLength}
            onChange={(event) => {
              onChange(field.key, event.target.value)
            }}
          />
        </Field>
      )
  }
}
