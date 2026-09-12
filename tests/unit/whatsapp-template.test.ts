import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildDirectContactUrl,
  buildHandoffUrl,
  COMMISSION_TOKENS,
  INQUIRY_TOKENS,
  MAX_ENCODED_URL_LENGTH,
  PROTECTED_TOKEN,
  renderTemplate,
  shorten,
  tokensIn,
  WhatsAppTemplateError,
} from '@/lib/whatsapp'

/**
 * The WhatsApp module, which is where a D1 business rule is enforced in code:
 * "an inquiry must be persisted before any WhatsApp redirect".
 *
 * THE TYPE-LEVEL GUARANTEE IS ASSERTED HERE TOO. `buildHandoffUrl` requires a non-optional
 * `inquiryId`, so a caller with no persisted row does not compile — and a guarantee that is never
 * tested is one that quietly becomes optional the first time someone widens the type to fix an
 * unrelated error. The `@ts-expect-error` below fails the build if the parameter ever becomes
 * optional, which is the only way to test a compile-time rule from inside a test file.
 */

const SEED_INQUIRY = [
  'Hello Rivya Living Art,',
  '',
  'I would like to enquire about:',
  '',
  'Product / Project: {{product_or_project}}',
  'Name: {{customer_name}}',
  'Phone: {{phone}}',
  'City: {{city}}',
  '',
  'Requirements:',
  '{{customization_summary}}',
  '',
  'Notes:',
  '{{notes}}',
  '',
  'Reference:',
  '{{reference_urls}}',
  '',
  'Inquiry ID:',
  '{{inquiry_id}}',
].join('\n')

beforeEach(() => {
  // The builders read the number from the environment, and no test may depend on a real one.
  process.env['NEXT_PUBLIC_WHATSAPP_NUMBER'] = '+91 70960 36250'
})

describe('the seeded templates', () => {
  it('uses only tokens the inquiry template declares', () => {
    const declared = new Set<string>(INQUIRY_TOKENS)
    for (const token of tokensIn(SEED_INQUIRY)) expect(declared.has(token)).toBe(true)
  })

  it('declares every token SEED §36 supplies a value for', () => {
    expect([...INQUIRY_TOKENS].sort()).toEqual(
      [
        'city',
        'customer_name',
        'customization_summary',
        'inquiry_id',
        'notes',
        'phone',
        'product_or_project',
        'reference_urls',
      ].sort(),
    )
  })

  it('gives the commission template its own token set', () => {
    // §37 asks for a project type, dimensions and a material direction, and has no product.
    expect(COMMISSION_TOKENS).toContain('project_type')
    expect(COMMISSION_TOKENS).not.toContain('product_or_project')
  })

  it('protects the inquiry id in both templates', () => {
    expect(INQUIRY_TOKENS).toContain(PROTECTED_TOKEN)
    expect(COMMISSION_TOKENS).toContain(PROTECTED_TOKEN)
  })
})

describe('renderTemplate', () => {
  it('substitutes declared tokens', () => {
    const message = renderTemplate('inquiry', SEED_INQUIRY, {
      customer_name: 'Asha',
      inquiry_id: 'INQ-1',
    })
    expect(message).toContain('Name: Asha')
    expect(message).toContain('INQ-1')
  })

  it('leaves an unsupplied optional token empty rather than refusing', () => {
    // A visitor who wrote no notes is the ordinary case; refusing would block a real enquiry.
    const message = renderTemplate('inquiry', SEED_INQUIRY, { customer_name: 'Asha' })
    expect(message).not.toContain('{{notes}}')
    expect(message).toContain('Notes:\n\n')
  })

  it('refuses a token the template declares but the allowlist does not', () => {
    // The failure this prevents: an editor renames a token in Studio and the message ships with
    // raw braces in it, to a customer.
    expect(() => renderTemplate('inquiry', 'Hello {{customer_nane}}', {})).toThrow(
      WhatsAppTemplateError,
    )
  })

  it('refuses a value whose key is not a token of this template', () => {
    // The failure this prevents: a caller spreads a database row into the values object, and every
    // column in it becomes a candidate for substitution.
    expect(() =>
      renderTemplate('inquiry', SEED_INQUIRY, { project_type: 'from the other template' }),
    ).toThrow(WhatsAppTemplateError)
  })
})

describe('shorten', () => {
  /*
   * PHASE 20 REPLACED THE TWO-STEP LADDER WITH FIVE RUNGS, and the full ladder is exercised in
   * `whatsapp-shorten.test.ts`. What stays here is the property Phase 10 built this module for and
   * Phase 20 did not change: the reference code survives everything.
   */
  const render = (values: Record<string, string>) =>
    `${values['customization_summary'] ?? ''}|${values['notes'] ?? ''}|${values['inquiry_id'] ?? ''}`

  it('leaves a short message untouched, and says so with a null level', () => {
    const result = shorten('inquiry', { notes: 'short', inquiry_id: 'INQ-1' }, render, 40)
    expect(result.overLimit).toBe(false)
    expect(result.level).toBeNull()
  })

  it('never shortens or drops the inquiry id', () => {
    const result = shorten(
      'inquiry',
      { customization_summary: 'x'.repeat(4000), notes: 'y'.repeat(4000), inquiry_id: 'INQ-42' },
      render,
      40,
      120,
    )
    expect(result.values[PROTECTED_TOKEN]).toBe('INQ-42')
    expect(result.message).toContain('INQ-42')
  })
})

describe('buildHandoffUrl', () => {
  it('builds a wa.me link with the number reduced to digits', () => {
    const { url } = buildHandoffUrl({
      inquiryId: 'INQ-1',
      template: 'inquiry',
      body: SEED_INQUIRY,
      values: { customer_name: 'Asha' },
    })
    expect(url.startsWith('https://wa.me/917096036250?text=')).toBe(true)
  })

  it('sets the inquiry id from the parameter, not from the values', () => {
    // A caller that spreads a form object must not be able to reference a different row than the
    // one it just wrote.
    const { message } = buildHandoffUrl({
      inquiryId: 'INQ-REAL',
      template: 'inquiry',
      body: SEED_INQUIRY,
      values: { inquiry_id: 'INQ-FORGED' } as Record<string, string>,
    })
    expect(message).toContain('INQ-REAL')
    expect(message).not.toContain('INQ-FORGED')
  })

  it('keeps a very long enquiry under the URL cap', () => {
    const { url, level } = buildHandoffUrl({
      inquiryId: 'INQ-1',
      template: 'inquiry',
      body: SEED_INQUIRY,
      values: {
        customization_summary: 'A very detailed requirement. '.repeat(200),
        notes: 'And some notes. '.repeat(200),
        reference_urls: 'https://example.test/reference-image.jpg '.repeat(40),
      },
    })
    expect(url.length).toBeLessThanOrEqual(MAX_ENCODED_URL_LENGTH)
    expect(level).not.toBeNull()
    // The id survives every step, because it is what ties the message to the persisted row.
    expect(decodeURIComponent(url)).toContain('INQ-1')
  })

  it('cannot be called without a persisted inquiry id', () => {
    // @ts-expect-error inquiryId is required: this is the D1 rule expressed as a type, and this
    // line fails the build if it ever becomes optional.
    expect(() => buildHandoffUrl({ template: 'inquiry', body: SEED_INQUIRY, values: {} })).toThrow()
  })

  it('refuses a blank inquiry id at runtime, not only at compile time', () => {
    // The type stops a TypeScript caller. This stops everything else — and without it the message
    // renders with an empty Inquiry ID and reaches the customer looking entirely normal.
    expect(() =>
      buildHandoffUrl({ inquiryId: '   ', template: 'inquiry', body: SEED_INQUIRY, values: {} }),
    ).toThrow(/already been persisted/u)
  })
})

describe('buildDirectContactUrl', () => {
  it('carries the greeting and no enquiry data', () => {
    const url = buildDirectContactUrl({ source: 'footer', greeting: 'Hello Rivya Living Art,' })
    expect(decodeURIComponent(url ?? '')).toContain('Hello Rivya Living Art,')
    expect(url).not.toContain('inquiry')
  })

  it('does not put the source in the message', () => {
    // `source` constrains the call sites; a customer must never receive an internal identifier.
    const url = buildDirectContactUrl({ source: 'announcement', greeting: 'Hello,' })
    expect(decodeURIComponent(url ?? '')).not.toContain('announcement')
  })

  it('prefers the number it is given over the environment', () => {
    const url = buildDirectContactUrl({
      source: 'contact-page',
      greeting: 'Hello,',
      number: '+91 90000 00000',
    })
    expect(url).toContain('wa.me/919000000000')
  })

  /**
   * THE ONE THAT MATTERS, AND IT IS ABOUT AN OUTAGE RATHER THAN A LINK.
   *
   * This used to read the variable through `requiredEnv` and THROW. The footer renders a direct
   * contact link on every page as soon as the `contact-details` section is published, so in an
   * environment with no number the first publication of that section turned every route into a 500
   * — a content action taking the whole site down. Phase 45 found it by publishing the section in a
   * local harness. Null is now the answer, and the caller renders no link.
   */
  it('returns null rather than throwing when no number resolves anywhere', () => {
    const saved = process.env['NEXT_PUBLIC_WHATSAPP_NUMBER']
    delete process.env['NEXT_PUBLIC_WHATSAPP_NUMBER']
    try {
      expect(buildDirectContactUrl({ source: 'footer', greeting: 'Hello,' })).toBeNull()
    } finally {
      process.env['NEXT_PUBLIC_WHATSAPP_NUMBER'] = saved
    }
  })

  /** A number too short to be an international one is not a number somebody can be reached on. */
  it('returns null for a number E.164 refuses', () => {
    expect(
      buildDirectContactUrl({ source: 'footer', greeting: 'Hello,', number: '12345' }),
    ).toBeNull()
  })
})
