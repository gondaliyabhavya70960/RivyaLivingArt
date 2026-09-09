import { z } from 'zod'

import type {
  CustomizationForm,
  CustomizationFormField,
  CustomizationFormStep,
} from '@/lib/supabase/schemas'

/**
 * Turn a stored form definition into the Zod schema a submission is validated against.
 *
 * THIS FILE IS THE REASON THE FORM CAN BE EDITED AT ALL. FEAT §15 says every step is configurable
 * from Studio; the phase document's risk table names the way that goes wrong — "form definitions and
 * validation drift apart" — and the mitigation is that there is only ONE description of the form.
 * The rows say what is asked; this generates what is accepted. A hand-written schema per template
 * would be a second description, correct on the day it was written and wrong the first time an
 * editor renamed a field or made one optional.
 *
 * IT IS ISOMORPHIC ON PURPOSE. No `server-only` import: the configurator validates a step in the
 * browser before advancing, and Phase 20 will validate the whole payload again on the server. Both
 * must apply the same rules, which they do by running the same generator over the same rows.
 *
 * NOTHING HERE PRICES ANYTHING, and `no-pricing.test.ts` greps this file for the vocabulary. The
 * `validation` column is constrained by the database to a fixed allowlist of Zod keys, so there is
 * no key a surcharge could arrive under; this module refuses to read one either way.
 */

/** The vocabulary `customization_form_fields.validation` is allowed to contain (migration 0170). */
export const fieldValidationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    /** A JavaScript regular expression source, applied to a text answer. */
    pattern: z.string().optional(),
    /** MIME types an upload field accepts, narrowing the endpoint's own allowlist. */
    accept: z.array(z.string()).optional(),
    maxFiles: z.number().int().positive().optional(),
    maxBytes: z.number().int().positive().optional(),
  })
  .strict()

export type FieldValidation = z.infer<typeof fieldValidationSchema>

export const fieldOptionSchema = z.object({ value: z.string().min(1), label: z.string().min(1) })
export type FieldOption = z.infer<typeof fieldOptionSchema>

/**
 * The units a DIMENSION answer may carry.
 *
 * A DIMENSION IS NOT A NUMBER, which is why it has its own field type. "2400" is meaningless and
 * "2400 mm" typed into a text box cannot be validated, compared or read back reliably — a visitor
 * writing `8 feet` and one writing `2.4m` would produce two strings nobody can use. The unit is
 * part of the answer and is chosen, not typed.
 *
 * WHAT THIS IS NOT is a statement about what Rivya can make. The phase document puts bounds
 * explicitly out of scope — "no maximum span 3200 mm" — so no default minimum or maximum exists
 * here. A ceiling appears only where the owner types one into `validation`.
 */
export const DIMENSION_UNITS = ['mm', 'cm', 'm', 'in', 'ft'] as const
export type DimensionUnit = (typeof DIMENSION_UNITS)[number]

export const dimensionAnswerSchema = z.object({
  amount: z.number().positive(),
  unit: z.enum(DIMENSION_UNITS),
})

/**
 * One reference the visitor uploaded, as the configurator holds it.
 *
 * THE BYTES NEVER PASS THROUGH THE SERVER. `app/api/inquiries/upload-sign` issues a signature, the
 * browser uploads straight to the media provider, and what comes back is a provider public_id and
 * the original filename.
 *
 * `publicId`, NOT `assetId`, AND THE DIFFERENCE IS THE PHASE BOUNDARY. There is no `media_assets`
 * row yet: the signature cannot know the public_id the upload will end up with, so a row minted at
 * signing time would name an asset that may never exist. Phase 20 persists the inquiry and turns
 * these references into rows — `source = 'USER_UPLOAD'`, `status = 'DRAFT'`, alt text from the
 * filename — after checking each public_id really is under `rivya/inquiries/incoming/`. Until then
 * an abandoned upload is a provider object with no row, which is what the 30-day orphan purge is
 * for.
 */
export const uploadedReferenceSchema = z.object({
  publicId: z.string().min(1),
  filename: z.string().min(1),
})

export type UploadedReference = z.infer<typeof uploadedReferenceSchema>

/** A step with its own fields, which is the shape every function here takes. */
export interface FormStepWithFields {
  readonly step: CustomizationFormStep
  readonly fields: readonly CustomizationFormField[]
}

/** A whole form, resolved. The repository returns this; nothing here queries anything. */
export interface ResolvedForm {
  readonly form: CustomizationForm
  readonly steps: readonly FormStepWithFields[]
}

/** Enabled steps, in order, each carrying only its enabled fields. */
export function visibleSteps(form: ResolvedForm): readonly FormStepWithFields[] {
  return form.steps
    .filter((entry) => entry.step.is_enabled)
    .map((entry) => ({
      step: entry.step,
      fields: entry.fields.filter((field) => field.is_enabled),
    }))
}

export function fieldOptions(field: CustomizationFormField): readonly FieldOption[] {
  const parsed = z.array(fieldOptionSchema).safeParse(field.options)
  // A malformed option list is refused at the write by `enforce_form_field_shape()`, so reaching
  // here means the row was written before that trigger existed or around it. An empty list renders
  // a control with no choices, which the publish gate already refuses — so the visitor sees the
  // question without options rather than a page that failed to render.
  return parsed.success ? parsed.data : []
}

export function fieldValidation(field: CustomizationFormField): FieldValidation {
  const parsed = fieldValidationSchema.safeParse(field.validation ?? {})
  return parsed.success ? parsed.data : {}
}

/** A permissive international phone shape: digits, spaces and the punctuation people actually type. */
const PHONE = /^[+()\-.\s\d]{7,24}$/

function applyTextRules(base: z.ZodString, rules: FieldValidation): z.ZodString {
  let schema = base
  if (rules.minLength !== undefined) schema = schema.min(rules.minLength)
  if (rules.maxLength !== undefined) schema = schema.max(rules.maxLength)
  if (rules.pattern !== undefined) {
    try {
      schema = schema.regex(new RegExp(rules.pattern))
    } catch {
      // An editor typed something that is not a regular expression. Ignoring it accepts more than
      // intended; throwing would take the whole public form down over one field's help text. The
      // Studio builder validates the pattern before saving, which is where this is caught for real.
    }
  }
  return schema
}

function applyNumberRules(base: z.ZodNumber, rules: FieldValidation): z.ZodNumber {
  let schema = base
  if (rules.min !== undefined) schema = schema.min(rules.min)
  if (rules.max !== undefined) schema = schema.max(rules.max)
  return schema
}

/**
 * The schema for one field, before optionality is applied.
 *
 * A CHOICE FIELD'S SCHEMA IS BUILT FROM ITS OWN OPTIONS, so an answer that is not on the list is
 * refused — which matters more than it looks. The values travel as strings in a form payload, and
 * without this any string at all would be accepted and would end up in the brief as though the
 * visitor had chosen it.
 */
function baseFieldSchema(field: CustomizationFormField): z.ZodTypeAny {
  const rules = fieldValidation(field)
  const values = fieldOptions(field).map((option) => option.value)

  switch (field.field_type) {
    case 'TEXTAREA':
    case 'TEXT':
    case 'CITY':
    case 'CONTACT_NAME':
      return applyTextRules(z.string().trim().min(1), rules)

    case 'CONTACT_EMAIL':
      return z.string().trim().pipe(z.email())

    case 'CONTACT_PHONE':
      return applyTextRules(z.string().trim().regex(PHONE), rules)

    case 'NUMBER':
      return applyNumberRules(z.number(), rules)

    case 'DIMENSION':
      return dimensionAnswerSchema.extend({
        amount: applyNumberRules(z.number().positive(), rules),
      })

    case 'SELECT':
    case 'RADIO':
    case 'COLOUR_DIRECTION':
      // `z.enum` needs at least one member. A published form cannot have an enabled choice field
      // with no options — `enforce_form_publishable()` refuses it — so this branch is the draft
      // case, and refusing every answer is the honest reading of "there is nothing to choose".
      return values.length > 0 ? z.enum(values as [string, ...string[]]) : z.never()

    case 'MULTISELECT': {
      const member = values.length > 0 ? z.enum(values as [string, ...string[]]) : z.never()
      let schema = z.array(member).min(1)
      if (rules.max !== undefined) schema = schema.max(rules.max)
      if (rules.min !== undefined) schema = schema.min(rules.min)
      return schema
    }

    case 'CHECKBOX':
      // Required means "must be ticked", which is what a consent-shaped question needs.
      return z.literal(true)

    case 'FILE': {
      let schema = z.array(uploadedReferenceSchema).min(1)
      if (rules.maxFiles !== undefined) schema = schema.max(rules.maxFiles)
      return schema
    }
  }
}

/**
 * Optionality, and the one subtlety in this file.
 *
 * AN EMPTY STRING IS NOT AN ANSWER. An HTML form posts `""` for a text input nobody filled in, and
 * an unticked checkbox posts nothing at all — so an optional field would otherwise fail its own
 * validation on the commonest possible input. `z.preprocess` turns the empty cases into `undefined`
 * before the field's schema sees them, which is also what makes `.optional()` mean what it says.
 *
 * A REQUIRED FIELD GETS THE SAME TREATMENT and then fails, deliberately: "Required" reads better
 * than whatever a bare string schema says about a zero-length value.
 */
function withOptionality(schema: z.ZodTypeAny, field: CustomizationFormField): z.ZodTypeAny {
  const emptied = z.preprocess((value) => {
    if (value === '' || value === null) return undefined
    if (Array.isArray(value) && value.length === 0) return undefined
    if (value === false && field.field_type === 'CHECKBOX') return undefined
    return value
  }, schema.optional())

  if (!field.is_required) return emptied

  return emptied.refine((value) => value !== undefined, { message: 'Required' })
}

/** The schema for one step's answers. Used by the configurator to validate before advancing. */
export function buildStepSchema(entry: FormStepWithFields): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of entry.fields) {
    if (!field.is_enabled) continue
    shape[field.key] = withOptionality(baseFieldSchema(field), field)
  }
  return z.object(shape)
}

/**
 * The schema for the whole brief.
 *
 * ONE FLAT OBJECT KEYED BY FIELD KEY, not one nested per step. Field keys are unique per form —
 * `unique (form_id, key)` in the migration — and a flat payload survives an editor MOVING a field
 * from one step to another, which is one of the six things SEED §33 says they may do. Nesting by
 * step would make a saved draft in `sessionStorage` unreadable the moment the form was reorganised.
 */
export function buildFormSchema(form: ResolvedForm): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const entry of visibleSteps(form)) {
    for (const field of entry.fields) {
      shape[field.key] = withOptionality(baseFieldSchema(field), field)
    }
  }
  return z.object(shape)
}

export interface AnswerSummaryLine {
  readonly stepKey: string
  readonly stepTitle: string
  readonly fieldKey: string
  readonly label: string
  /** Already rendered for display. An option's LABEL, never its stored value. */
  readonly value: string
  readonly includeInWhatsApp: boolean
}

/** How one answer reads to a human. Option values become their labels; anything else is text. */
function renderAnswer(field: CustomizationFormField, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null

  const labelFor = (raw: string): string =>
    fieldOptions(field).find((option) => option.value === raw)?.label ?? raw

  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (field.field_type === 'FILE') {
      const parsed = z.array(uploadedReferenceSchema).safeParse(value)
      return parsed.success ? parsed.data.map((file) => file.filename).join(', ') : null
    }
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(labelFor)
      .join(', ')
  }

  if (field.field_type === 'DIMENSION') {
    const parsed = dimensionAnswerSchema.safeParse(value)
    return parsed.success ? `${parsed.data.amount} ${parsed.data.unit}` : null
  }

  if (typeof value === 'boolean') return value ? field.label : null
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return labelFor(value)
  return null
}

/**
 * The brief as a human reads it — the review screen here, the WhatsApp message in Phase 20.
 *
 * UNANSWERED FIELDS ARE ABSENT, NOT BLANK. A review screen listing eight empty rows tells the
 * visitor nothing except that the form was long; the point of the screen is to show what they
 * actually said before they send it.
 *
 * IT RETURNS NO TOTAL, NO ESTIMATE AND NO PRICE, and there is nothing to compute one from — no
 * field carries a number that means money, because no column exists to hold one.
 */
export function summariseAnswers(
  form: ResolvedForm,
  answers: Readonly<Record<string, unknown>>,
): readonly AnswerSummaryLine[] {
  const lines: AnswerSummaryLine[] = []

  for (const entry of visibleSteps(form)) {
    for (const field of entry.fields) {
      const rendered = renderAnswer(field, answers[field.key])
      if (rendered === null) continue
      lines.push({
        stepKey: entry.step.key,
        stepTitle: entry.step.title,
        fieldKey: field.key,
        label: field.label,
        value: rendered,
        includeInWhatsApp: field.include_in_whatsapp,
      })
    }
  }

  return lines
}
