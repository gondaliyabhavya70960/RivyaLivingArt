import { describe, expect, it } from 'vitest'

import { buildPayload, toFormValues } from '@/components/studio/content/section-form-values'
import { categoryGridBlock } from '@/content/blocks/category-grid'
import { dividerBlock } from '@/content/blocks/divider'
import { heroBlock } from '@/content/blocks/hero'
import { statementBlock } from '@/content/blocks/statement'
import type { AnyBlockModule } from '@/lib/cms/block-module'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * `buildPayload` is where a form value becomes a payload, and every conversion in it is silently
 * wrong in a different way if it is missed: an unchecked checkbox sends nothing at all, a select
 * of numbers sends strings, and a JSON textarea sends whatever the editor typed.
 */

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

const block = (module: unknown) => module as AnyBlockModule

describe('booleans', () => {
  it('reads a present checkbox as true', () => {
    const payload = buildPayload(
      block(heroBlock),
      form({ 'payload.is_video': 'on' }),
      heroBlock.defaults,
    )
    expect(payload.is_video).toBe(true)
  })

  /**
   * THE CASE THAT BREAKS A NAIVE IMPLEMENTATION. An unchecked checkbox sends nothing, so reading
   * "absent" as "leave it alone" makes a toggle impossible to turn OFF — it would latch on at the
   * first save and never come back.
   */
  it('reads an absent checkbox as false, not as unchanged', () => {
    const payload = buildPayload(block(heroBlock), form({}), {
      ...heroBlock.defaults,
      is_video: true,
    })
    expect(payload.is_video).toBe(false)
  })
})

describe('selects', () => {
  it('coerces back to a number when the current value is one', () => {
    const payload = buildPayload(
      block(categoryGridBlock),
      form({ 'payload.columns': '4' }),
      categoryGridBlock.defaults,
    )
    expect(payload.columns).toBe(4)
    // And it still parses against the block's own schema, which wants the literal union.
    expect(categoryGridBlock.schema.safeParse(payload).success).toBe(true)
  })

  it('leaves a string-valued select as a string', () => {
    const payload = buildPayload(
      block(dividerBlock),
      form({ 'payload.spacing': 'loose', 'payload.rule': 'on' }),
      dividerBlock.defaults,
    )
    expect(payload.spacing).toBe('loose')
    expect(dividerBlock.schema.safeParse(payload).success).toBe(true)
  })
})

describe('json fields', () => {
  it('parses valid JSON', () => {
    const cards = [{ title: 'Wall art', description: '', href: '/w', media_index: null }]
    const payload = buildPayload(
      block(categoryGridBlock),
      form({ 'payload.cards': JSON.stringify(cards), 'payload.columns': '3' }),
      categoryGridBlock.defaults,
    )
    expect(payload.cards).toEqual(cards)
  })

  /**
   * A typo in the JSON box must not destroy work. Keeping the old value means the save either
   * succeeds unchanged or fails against the block's schema for a reason the editor can read —
   * never "your cards are gone and it saved".
   */
  it('keeps the previous value when the JSON does not parse', () => {
    const existing = {
      ...categoryGridBlock.defaults,
      cards: [{ title: 'Kept', description: '', href: '', media_index: null }],
    }
    const payload = buildPayload(
      block(categoryGridBlock),
      form({ 'payload.cards': '[{"title": "broken"', 'payload.columns': '3' }),
      existing,
    )
    expect(payload.cards).toEqual(existing.cards)
  })
})

describe('numbers', () => {
  it('parses a numeric entry', () => {
    const payload = buildPayload(
      block(heroBlock),
      form({ 'payload.scrim': '75' }),
      heroBlock.defaults,
    )
    expect(payload.scrim).toBe(75)
  })

  it('keeps the old value rather than writing NaN', () => {
    const payload = buildPayload(block(heroBlock), form({ 'payload.scrim': 'quite dark' }), {
      ...heroBlock.defaults,
      scrim: 40,
    })
    expect(payload.scrim).toBe(40)
  })
})

describe('keys the editor does not render', () => {
  /**
   * A payload can hold keys with no control — `media` on a block whose repeater is not built, or
   * a key seeded ahead of its field. Rebuilding the payload from scratch would delete them on the
   * first save, silently.
   */
  it('preserves them', () => {
    const existing = { ...dividerBlock.defaults, seeded_extra: 'do not lose me' }
    const payload = buildPayload(
      block(dividerBlock),
      form({ 'payload.spacing': 'tight', 'payload.rule': 'on' }),
      existing,
    )
    expect(payload.seeded_extra).toBe('do not lose me')
  })

  it('starts from an empty object when the current payload is not one', () => {
    expect(buildPayload(block(statementBlock), form({}), null)).toEqual({})
    expect(buildPayload(block(statementBlock), form({}), 'nonsense')).toEqual({})
  })
})

describe('toFormValues', () => {
  const section = {
    id: 's1',
    page_id: 'p1',
    block_type: 'hero',
    position: 0,
    is_visible: true,
    theme: 'BONE',
    layout_variant: 'contained',
    eyebrow: null,
    heading: 'A heading',
    heading_highlight: null,
    body: null,
    supporting: null,
    cta_label: null,
    cta_url: null,
    cta_secondary_label: null,
    cta_secondary_url: null,
    media_desktop_id: null,
    media_mobile_id: null,
    media_alt_override: null,
    media_slot_key: null,
    payload: { is_video: true },
    field_classifications: {},
    publish_at: null,
    unpublish_at: null,
    schedule_state: 'PENDING',
    schedule_attempts: 0,
    schedule_error: null,
    schedule_last_attempt_at: null,
    status: 'DRAFT',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: 'NOT_REQUIRED',
  } as unknown as PageSection

  it('carries the row across without inventing anything', () => {
    const values = toFormValues(section)
    expect(values.heading).toBe('A heading')
    expect(values.theme).toBe('BONE')
    expect(values.payload).toEqual({ is_video: true })
  })

  /** A null payload column would make every payload field read `undefined`; `{}` reads as empty. */
  it('turns a null payload into an empty object', () => {
    const values = toFormValues({ ...section, payload: null } as unknown as PageSection)
    expect(values.payload).toEqual({})
  })
})
