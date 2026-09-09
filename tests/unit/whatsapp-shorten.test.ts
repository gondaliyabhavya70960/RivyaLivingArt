import { describe, expect, it } from 'vitest'

import {
  MAX_ENCODED_URL_LENGTH,
  PROTECTED_TOKEN,
  dropEmptyTokenLines,
  normaliseE164,
  renderTemplate,
  resolveWhatsAppNumber,
  shorten,
} from '@/lib/whatsapp'
import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * The five-level shortening ladder, one rung at a time, and the number resolution beneath it.
 *
 * EACH RUNG IS TESTED BY MAKING THE MESSAGE TOO LONG IN EXACTLY ONE WAY. A single "here is a huge
 * payload, assert it fits" test proves the ladder terminates and nothing about the order, which is
 * the part that matters: the order is a judgement about what a studio can afford to lose, and a
 * regression that cut the visitor's notes before the reference URLs would still pass a
 * fits-in-the-budget assertion.
 *
 * THE REFERENCE CODE IS ASSERTED AT EVERY RUNG. It is what ties the message to the row that was
 * persisted first, which is the whole D1 guarantee — a message that fits and cannot be traced back
 * is worse than one that does not fit.
 */

/** A stand-in for the seeded template: one labelled line per token, which is what SEED §36 is. */
const BODY = [
  'New enquiry from the Rivya website.',
  'Piece: {{product_or_project}}',
  'Name: {{customer_name}}',
  'Phone: {{phone}}',
  'City: {{city}}',
  'Details:',
  '{{customization_summary}}',
  'Notes: {{notes}}',
  'References: {{reference_urls}}',
  'Enquiry: {{inquiry_id}}',
].join('\n')

const BASE = {
  product_or_project: 'Console Table',
  customer_name: 'A Visitor',
  phone: '+91 98250 12345',
  city: 'Surat',
  customization_summary: '',
  notes: '',
  reference_urls: '',
  inquiry_id: 'RIV-2026-000123',
}

const render = (values: Record<string, string>) => renderTemplate('inquiry', BODY, values)

function run(values: Record<string, string>, limit: number) {
  return shorten('inquiry', values, render, 40, limit, BODY)
}

describe('the shortening ladder', () => {
  it('does not fire at all when the message already fits', () => {
    const result = run(BASE, MAX_ENCODED_URL_LENGTH)
    expect(result.level).toBeNull()
    expect(result.overLimit).toBe(false)
    // Level 1 has not run, so the empty lines are still there — which is what "did not fire" means.
    expect(result.message).toContain('Notes: ')
  })

  it('level 1 drops a line whose tokens all resolved to empty, and keeps one that did not', () => {
    // Just tight enough that the empty labels have to go and nothing else does: the message fits
    // untouched at 271 encoded characters and with the empty lines dropped at 235.
    const result = run(BASE, 250)
    expect(result.level).toBe(1)
    expect(result.message).not.toContain('Notes:')
    expect(result.message).not.toContain('References:')
    expect(result.message).toContain('City: Surat')
    expect(result.message).toContain(BASE.inquiry_id)
  })

  it('level 1 leaves a line alone when only SOME of its tokens are empty', () => {
    const body = 'Where: {{city}} — {{notes}}'
    const rendered = renderTemplate('inquiry', body, { city: 'Surat', notes: '' })
    expect(dropEmptyTokenLines(body, { city: 'Surat', notes: '' }, rendered)).toContain('Surat')
  })

  it('level 2 keeps eight summary items and says how many more there are', () => {
    const items = Array.from({ length: 30 }, (_, i) => `Question ${i + 1}: an answer`).join('\n')
    const result = run({ ...BASE, customization_summary: items }, 700)

    expect(result.level).toBe(2)
    expect(result.message).toContain('Question 8: an answer')
    expect(result.message).not.toContain('Question 9: an answer')
    expect(result.message).toContain('…and 22 more')
    // The sentence that admits something was left out must say where to find it.
    expect(result.message).toContain(`…and 22 more (enquiry ${BASE.inquiry_id})`)
  })

  it('level 3 truncates the notes on a word boundary, and only after the summary was capped', () => {
    const notes = 'The client wants something quiet for a hallway. '.repeat(30)
    const result = run({ ...BASE, notes }, 800)

    expect(result.level).toBe(3)
    const kept = result.values['notes'] ?? ''
    expect(kept.length).toBeLessThanOrEqual(302)
    expect(kept.endsWith('…')).toBe(true)
    // A word boundary, not a character count: the cut must not land inside a word.
    expect(kept.slice(0, -1).endsWith(' ')).toBe(false)
    expect(notes.startsWith(kept.slice(0, -1))).toBe(true)
  })

  it('level 4 replaces the reference URLs with a count that names the enquiry', () => {
    const urls = Array.from(
      { length: 5 },
      (_, i) => `https://res.cloudinary.test/rivya/inquiries/incoming/abcdef/reference-${i}.jpg`,
    ).join(' ')
    const notes = 'A short note.'
    const result = run({ ...BASE, reference_urls: urls, notes }, 500)

    expect(result.level).toBe(4)
    expect(result.message).toContain(`5 reference images attached (enquiry ${BASE.inquiry_id})`)
    expect(result.message).not.toContain('res.cloudinary.test')
  })

  it('level 5 keeps the essentials and nothing else, still without inventing a word', () => {
    const result = run(
      {
        ...BASE,
        customization_summary: Array.from(
          { length: 60 },
          (_, i) => `Q${i}: ${'a'.repeat(60)}`,
        ).join('\n'),
        notes: 'n'.repeat(2000),
        reference_urls: 'https://example.test/a.jpg '.repeat(20),
      },
      200,
    )

    expect(result.level).toBe(5)
    // The greeting survives because it has no token to empty — every word still comes from the body.
    expect(result.message).toContain('New enquiry from the Rivya website.')
    expect(result.message).toContain('Piece: Console Table')
    expect(result.message).toContain('Name: A Visitor')
    expect(result.message).toContain('City: Surat')
    expect(result.message).toContain(BASE.inquiry_id)
    expect(result.message).not.toContain('Notes:')
    expect(result.message).not.toContain('References:')
  })

  /**
   * The phase document's own verification: a sixty-field brief with five references must fit, still
   * parse, and still carry the reference code.
   */
  it('brings a sixty-field brief with five references inside the budget', () => {
    const summary = Array.from(
      { length: 60 },
      (_, i) => `Question number ${i + 1}: a reasonably wordy answer about the piece`,
    ).join('\n')
    const urls = Array.from(
      { length: 5 },
      (_, i) => `https://res.cloudinary.test/rivya/inquiries/incoming/abcdef/reference-${i}.jpg`,
    ).join(' ')

    const result = run(
      {
        ...BASE,
        customization_summary: summary,
        notes: 'The hallway is narrow and the light comes from one side only. '.repeat(20),
        reference_urls: urls,
      },
      MAX_ENCODED_URL_LENGTH,
    )

    expect(result.overLimit).toBe(false)
    expect(result.level).not.toBeNull()
    expect(40 + encodeURIComponent(result.message).length).toBeLessThanOrEqual(
      MAX_ENCODED_URL_LENGTH,
    )
    expect(result.message).toContain(BASE.inquiry_id)
    expect(result.values[PROTECTED_TOKEN]).toBe(BASE.inquiry_id)
  })

  it('still returns a link when every rung has been spent', () => {
    // A budget nothing can meet. The link is built anyway: refusing one would block a conversion
    // over formatting, and the reference code is still in the message.
    const result = run({ ...BASE, notes: 'x'.repeat(5000) }, 60)
    expect(result.overLimit).toBe(true)
    expect(result.level).toBe(5)
    expect(result.message).toContain(BASE.inquiry_id)
  })
})

// -------------------------------------------------------------------------------------------------

function contentRow(overrides: Partial<GlobalContent>): GlobalContent {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    group_key: 'CONTACT',
    key: 'whatsapp_number',
    value: '+91 98250 12345',
    description: null,
    is_enabled: true,
    status: 'PUBLISHED',
    owner_verification: 'VERIFIED',
    fact_classification: 'VERIFIED_BUSINESS_FACT',
    published_at: null,
    published_by: null,
    seed_key: null,
    content_seed_version: null,
    seed_content_hash: null,
    seed_last_applied_at: null,
    owner_edited: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  } as GlobalContent
}

describe('resolving the studio number', () => {
  it('reduces a typed number to digits with its country code', () => {
    expect(normaliseE164('+91 98250 12345')).toBe('919825012345')
    expect(normaliseE164('0091-98250-12345')).toBe('919825012345')
  })

  it('refuses a number too short or too long to reach anybody', () => {
    expect(normaliseE164('12345')).toBeNull()
    expect(normaliseE164('9'.repeat(20))).toBeNull()
    expect(normaliseE164('')).toBeNull()
    expect(normaliseE164(null)).toBeNull()
  })

  it('prefers a VERIFIED published row over the environment', () => {
    expect(resolveWhatsAppNumber([contentRow({})], '910000000000')).toBe('919825012345')
  })

  /**
   * The rule this test exists for: an unverified phone number is worse than none, because a
   * customer will ring it. A row awaiting the owner's confirmation does not merely lose to the
   * environment variable — it does not count at all.
   */
  it('ignores a row the owner has not verified, and falls back to the environment', () => {
    const unverified = contentRow({ owner_verification: 'OWNER_VERIFICATION_REQUIRED' })
    expect(resolveWhatsAppNumber([unverified], '+91 90000 00000')).toBe('919000000000')
  })

  it('ignores a disabled or unpublished row for the same reason', () => {
    expect(resolveWhatsAppNumber([contentRow({ is_enabled: false })], '910000000000')).toBe(
      '910000000000',
    )
    expect(resolveWhatsAppNumber([contentRow({ status: 'DRAFT' })], '910000000000')).toBe(
      '910000000000',
    )
  })

  it('returns null when neither source resolves, which is a state and not an error', () => {
    expect(resolveWhatsAppNumber([], undefined)).toBeNull()
    expect(resolveWhatsAppNumber([contentRow({ value: 'not a number' })], null)).toBeNull()
  })
})
