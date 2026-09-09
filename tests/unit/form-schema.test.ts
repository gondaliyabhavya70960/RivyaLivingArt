import { describe, expect, it } from 'vitest'

import {
  buildFormSchema,
  buildStepSchema,
  summariseAnswers,
  visibleSteps,
  type ResolvedForm,
} from '../../lib/cms/forms'
import type {
  CustomizationForm,
  CustomizationFormField,
  CustomizationFormStep,
} from '../../lib/supabase/schemas'

/**
 * The generated schema, against the rows it is generated from.
 *
 * THE RISK THIS COVERS, in the phase document's words: "form definitions and validation drift
 * apart". The mitigation is that there is only ONE description of the form — the rows — and
 * `buildFormSchema` derives the other. These tests assert the derivation, because a generator that
 * quietly ignored `is_required` would leave a form that asks for something and accepts nothing.
 *
 * NO DATABASE. Every fixture here is a row object, which is the point of `lib/cms/forms.ts` being
 * isomorphic and pure: the same function validates in the browser before a step advances and on the
 * server when Phase 20 persists, and both are exercised here without either.
 */

const now = '2026-01-01T00:00:00.000Z'

function step(over: Partial<CustomizationFormStep> = {}): CustomizationFormStep {
  return {
    id: 'step-1',
    form_id: 'form-1',
    key: 'dimensions',
    title: 'Approximate Dimensions',
    description: null,
    position: 1,
    is_enabled: true,
    is_required: false,
    created_at: now,
    updated_at: now,
    updated_by: null,
    seed_key: null,
    content_seed_version: null,
    seed_content_hash: null,
    seed_last_applied_at: null,
    owner_edited: false,
    ...over,
  }
}

function field(over: Partial<CustomizationFormField> = {}): CustomizationFormField {
  return {
    id: 'field-1',
    form_id: 'form-1',
    step_id: 'step-1',
    key: 'answer',
    label: 'Answer',
    help_text: null,
    placeholder: null,
    field_type: 'TEXT',
    options: [],
    validation: {},
    is_enabled: true,
    is_required: false,
    position: 1,
    include_in_whatsapp: true,
    created_at: now,
    updated_at: now,
    updated_by: null,
    seed_key: null,
    content_seed_version: null,
    seed_content_hash: null,
    seed_last_applied_at: null,
    owner_edited: false,
    ...over,
  }
}

const form: CustomizationForm = {
  id: 'form-1',
  slug: 'test-form',
  name: 'Test form',
  kind: 'CUSTOM',
  description: null,
  intro_heading: null,
  intro_body: null,
  submit_label_key: 'CTA.send_an_enquiry',
  is_default: false,
  status: 'PUBLISHED',
  owner_verification: 'NOT_REQUIRED',
  fact_classification: 'EDITORIAL_COPY',
  published_at: now,
  published_by: null,
  created_at: now,
  updated_at: now,
  updated_by: null,
  seed_key: null,
  content_seed_version: null,
  seed_content_hash: null,
  seed_last_applied_at: null,
  owner_edited: false,
}

const resolved = (steps: ResolvedForm['steps']): ResolvedForm => ({ form, steps })

describe('optionality', () => {
  /**
   * AN EMPTY STRING IS NOT AN ANSWER, and this is the case that breaks a naive generator. An HTML
   * form posts `""` for a text input nobody filled in, so an optional field would fail its own
   * validation on the commonest possible input.
   */
  it('accepts an empty string for an optional field', () => {
    const schema = buildStepSchema({ step: step(), fields: [field()] })
    expect(schema.safeParse({ answer: '' }).success).toBe(true)
    expect(schema.safeParse({}).success).toBe(true)
  })

  it('refuses an empty string for a required field', () => {
    const schema = buildStepSchema({ step: step(), fields: [field({ is_required: true })] })
    expect(schema.safeParse({ answer: '' }).success).toBe(false)
    expect(schema.safeParse({ answer: 'a real answer' }).success).toBe(true)
  })

  /** An unticked checkbox posts nothing at all, which must read as "not ticked", not as "missing". */
  it('treats an unticked optional checkbox as unanswered', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [field({ field_type: 'CHECKBOX' })],
    })
    expect(schema.safeParse({ answer: false }).success).toBe(true)
    expect(schema.safeParse({}).success).toBe(true)
  })

  it('requires a required checkbox to be ticked', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [field({ field_type: 'CHECKBOX', is_required: true })],
    })
    expect(schema.safeParse({ answer: false }).success).toBe(false)
    expect(schema.safeParse({ answer: true }).success).toBe(true)
  })

  /** A disabled field is not asked, so it is not validated — that is what disabling means. */
  it('ignores a disabled field even when it is marked required', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [field({ is_enabled: false, is_required: true })],
    })
    expect(schema.safeParse({}).success).toBe(true)
  })
})

describe('field types', () => {
  it('accepts only the options a choice field actually carries', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [
        field({
          field_type: 'SELECT',
          is_required: true,
          options: [
            { value: 'round', label: 'Round' },
            { value: 'oval', label: 'Oval' },
          ],
        }),
      ],
    })
    expect(schema.safeParse({ answer: 'round' }).success).toBe(true)
    // The values travel as strings in a form payload. Without the enum, ANY string would be
    // accepted and would end up in the brief as though the visitor had chosen it.
    expect(schema.safeParse({ answer: 'hexagonal' }).success).toBe(false)
  })

  it('takes a dimension as an amount and a chosen unit', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [field({ field_type: 'DIMENSION', is_required: true })],
    })
    expect(schema.safeParse({ answer: { amount: 2400, unit: 'mm' } }).success).toBe(true)
    // "2400" on its own is meaningless, which is why DIMENSION is not a NUMBER.
    expect(schema.safeParse({ answer: 2400 }).success).toBe(false)
    expect(schema.safeParse({ answer: { amount: 2400, unit: 'furlongs' } }).success).toBe(false)
  })

  it('applies the editor-typed bounds to a number', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [field({ field_type: 'NUMBER', is_required: true, validation: { min: 1, max: 10 } })],
    })
    expect(schema.safeParse({ answer: 5 }).success).toBe(true)
    expect(schema.safeParse({ answer: 11 }).success).toBe(false)
  })

  it('caps uploads at the editor-typed file count', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [field({ field_type: 'FILE', validation: { maxFiles: 2 } })],
    })
    const file = (n: number) => ({ publicId: `p${n}`, filename: `f${n}.jpg` })
    expect(schema.safeParse({ answer: [file(1), file(2)] }).success).toBe(true)
    expect(schema.safeParse({ answer: [file(1), file(2), file(3)] }).success).toBe(false)
  })

  it('validates an email and is permissive about a phone number', () => {
    const schema = buildStepSchema({
      step: step(),
      fields: [
        field({ id: 'e', key: 'email', field_type: 'CONTACT_EMAIL', is_required: true }),
        field({ id: 'p', key: 'phone', field_type: 'CONTACT_PHONE', is_required: true }),
      ],
    })
    expect(schema.safeParse({ email: 'a@b.co', phone: '+91 98765 43210' }).success).toBe(true)
    expect(schema.safeParse({ email: 'not-an-email', phone: '+91 98765 43210' }).success).toBe(
      false,
    )
    // A phone field that refused a real Indian mobile would be worse than one that accepts noise.
    expect(schema.safeParse({ email: 'a@b.co', phone: '(079) 2630-1234' }).success).toBe(true)
  })
})

describe('the whole form', () => {
  const contact = step({ id: 'step-2', key: 'contact', title: 'Contact Details', position: 2 })

  /**
   * ONE FLAT OBJECT KEYED BY FIELD KEY, not one nested per step. Field keys are unique per form, and
   * a flat payload survives an editor MOVING a field between steps — one of the six things SEED §33
   * says they may do. Nesting by step would make a saved draft unreadable the moment the form was
   * reorganised.
   */
  it('is one flat object across every enabled step', () => {
    const schema = buildFormSchema(
      resolved([
        { step: step(), fields: [field({ key: 'width', is_required: true })] },
        {
          step: contact,
          fields: [field({ id: 'n', key: 'full_name', step_id: 'step-2', is_required: true })],
        },
      ]),
    )
    expect(schema.safeParse({ width: '2m', full_name: 'A name' }).success).toBe(true)
    expect(schema.safeParse({ width: '2m' }).success).toBe(false)
  })

  it('drops a disabled step from the sequence entirely', () => {
    const steps = resolved([
      { step: step({ is_enabled: false }), fields: [field({ is_required: true })] },
      { step: contact, fields: [] },
    ])
    expect(visibleSteps(steps).map((entry) => entry.step.key)).toEqual(['contact'])
    expect(buildFormSchema(steps).safeParse({}).success).toBe(true)
  })
})

describe('the review summary', () => {
  it('lists an option by its label, never its stored value', () => {
    const lines = summariseAnswers(
      resolved([
        {
          step: step(),
          fields: [
            field({
              field_type: 'SELECT',
              options: [{ value: 'round', label: 'Round' }],
            }),
          ],
        },
      ]),
      { answer: 'round' },
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]?.value).toBe('Round')
  })

  /** A review listing eight empty rows tells a visitor only that the form was long. */
  it('omits every unanswered field', () => {
    const lines = summariseAnswers(
      resolved([{ step: step(), fields: [field(), field({ id: 'b', key: 'b' })] }]),
      { answer: 'said something', b: '' },
    )
    expect(lines.map((line) => line.fieldKey)).toEqual(['answer'])
  })

  it('renders a dimension with its unit and an upload by filename', () => {
    const lines = summariseAnswers(
      resolved([
        {
          step: step(),
          fields: [
            field({ id: 'd', key: 'width', field_type: 'DIMENSION' }),
            field({ id: 'f', key: 'refs', field_type: 'FILE' }),
          ],
        },
      ]),
      {
        width: { amount: 2400, unit: 'mm' },
        refs: [{ publicId: 'x', filename: 'room.jpg' }],
      },
    )
    expect(lines.map((line) => line.value)).toEqual(['2400 mm', 'room.jpg'])
  })

  /** BR-F4b: the review screen states no total, and there is nothing to compute one from. */
  it('carries no field that could hold money', () => {
    const lines = summariseAnswers(resolved([{ step: step(), fields: [field()] }]), {
      answer: 'anything',
    })
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual([
        'fieldKey',
        'includeInWhatsApp',
        'label',
        'stepKey',
        'stepTitle',
        'value',
      ])
    }
  })
})
