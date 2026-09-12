import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InquiryForm } from '@/components/patterns/InquiryForm'
import type { InquiryCopy } from '@/components/patterns/InquiryForm/types'
import { ProductInquiryRail } from '@/components/patterns/ProductInquiryRail'
import { siteStrings } from '@/lib/cms/strings'
import type { GlobalContent } from '@/lib/supabase/schemas'

/**
 * SIX AFFORDANCES, SIX DESTINATIONS (FEAT §49 question 6).
 *
 * The audit found six named affordances resolving to ONE form reached by two URLs:
 * `ProductInquiryRail` returned the identical `/contact?product=<slug>&type=product` for "Ask About
 * This Piece" and "Request a Quote", and `type` was read by nothing — so `QUOTE` and `CONSULTATION`
 * were real enum values with real schemas, real WhatsApp templates and two Studio inbox views that
 * could never receive a row.
 *
 * These assert both ends of the contract, because either half alone is silent: a rail writing a
 * `type` the form does not accept would fall back to the general form, and a form reading a `type`
 * no rail writes would never see one.
 */
const LABELS: GlobalContent[] = [
  ['ask_about_this_piece', 'Ask About This Piece'],
  ['request_a_quote', 'Request a Quote'],
  ['customize_this_piece', 'Customize This Piece'],
].map(
  ([key, value]) =>
    ({
      id: `ACTION_LABEL-${key}`,
      group_key: 'ACTION_LABEL',
      key,
      label: null,
      value,
      description: null,
      is_enabled: true,
    }) as GlobalContent,
)

const COPY: InquiryCopy = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  city: 'City',
  enquiryType: 'Enquiry type',
  message: 'Message',
  required: 'Required',
  submit: 'Send',
  sending: 'Sending',
  successHeading: 'Thank you',
  successBody: 'We will be in touch',
  reference: 'Reference {{code}}',
  continueToWhatsApp: 'Continue on WhatsApp',
  savedWithoutWhatsApp: 'Saved',
  errorGeneric: 'Something went wrong',
  errorSave: 'We could not save that',
  errorTooMany: 'Too many attempts',
}

/** Put the form on a URL, the way a visitor arriving from a rail would be. */
function at(search: string): void {
  window.history.replaceState({}, '', `/contact${search}`)
}

afterEach(() => {
  at('')
  vi.restoreAllMocks()
})

describe('the product rail', () => {
  it('sends each affordance somewhere different', () => {
    render(
      <ProductInquiryRail slug="resin-dining-table" isCustomizable strings={siteStrings(LABELS)} />,
    )

    const href = (label: string) => screen.getByRole('link', { name: label }).getAttribute('href')

    expect(href('Ask About This Piece')).toBe('/contact?product=resin-dining-table&type=product')
    expect(href('Request a Quote')).toBe('/contact?product=resin-dining-table&type=quote')
    expect(href('Customize This Piece')).toBe('/custom-commissions?product=resin-dining-table')

    // The finding, stated as an assertion: no two affordances may share a destination.
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((value): value is string => value !== null)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('carries the piece on every destination', () => {
    render(<ProductInquiryRail slug="wall-panel" isCustomizable strings={siteStrings(LABELS)} />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toContain('product=wall-panel')
    }
  })
})

describe('the contact form reads the affordance it was reached from', () => {
  const renderForm = () =>
    render(
      <InquiryForm
        kind="GENERAL"
        copy={COPY}
        enquiryTypes={['Furniture', 'Wall art']}
        action={async () => ({
          ok: true,
          referenceCode: 'RV-1',
          whatsappUrl: null,
          attachments: 0,
        })}
      />,
    )

  it('files a quote when the quote rail sent the visitor', () => {
    // The row `/studio/inquiries/quote` could never receive before this.
    at('?product=resin-dining-table&type=quote')
    renderForm()
    expect(document.querySelector('[data-inquiry-form]')?.getAttribute('data-inquiry-form')).toBe(
      'QUOTE',
    )
  })

  it('files a consultation, which names no piece', () => {
    at('?type=consultation')
    renderForm()
    expect(document.querySelector('[data-inquiry-form]')?.getAttribute('data-inquiry-form')).toBe(
      'CONSULTATION',
    )
  })

  it('keeps Phase 15 behaviour: a bare product is a product enquiry', () => {
    at('?product=resin-dining-table')
    renderForm()
    expect(document.querySelector('[data-inquiry-form]')?.getAttribute('data-inquiry-form')).toBe(
      'PRODUCT',
    )
  })

  it('ignores a type it does not recognise rather than erroring', () => {
    // A query string is untrusted input. An unknown value gets the ordinary form; the server
    // re-validates against the Zod union regardless.
    at('?type=../../etc/passwd')
    renderForm()
    expect(document.querySelector('[data-inquiry-form]')?.getAttribute('data-inquiry-form')).toBe(
      'GENERAL',
    )
  })

  it('lets a section mounted as a specific kind keep it', () => {
    at('?type=quote')
    render(
      <InquiryForm
        kind="COMMISSION"
        copy={COPY}
        enquiryTypes={[]}
        action={async () => ({
          ok: true,
          referenceCode: 'RV-2',
          whatsappUrl: null,
          attachments: 0,
        })}
      />,
    )
    // Only the GENERAL contact band is open to being told what it is — every rail points at it.
    expect(document.querySelector('[data-inquiry-form]')?.getAttribute('data-inquiry-form')).toBe(
      'COMMISSION',
    )
  })

  it('drops the type picker once the URL has answered', () => {
    at('?type=quote')
    renderForm()
    expect(document.querySelector('select[name="enquiry_type"]')).toBeNull()
  })

  it('keeps the type picker on a plain contact visit', () => {
    at('')
    renderForm()
    expect(document.querySelector('select[name="enquiry_type"]')).not.toBeNull()
  })
})

/**
 * THE STICKY SUBMIT ROW (§7.10), specified in Phase 02 and not built until the editorial redesign.
 *
 * §19.1 question 7 measured what its absence cost: at 390px the two product calls to action sat at
 * y = 997 and 1053 of a 1928px document — below the fold, outside the thumb zone on every phone,
 * and reachable only by scrolling past the piece they are about.
 *
 * The geometry itself needs a browser, so these assert the two halves a unit CAN see: that the
 * surfaces carry the class, and that the class means what §7.10 says it means.
 */
describe('the sticky conversion row', () => {
  it('is on the product rail', () => {
    render(<ProductInquiryRail slug="a-piece" isCustomizable strings={siteStrings(LABELS)} />)
    expect(document.querySelector('[data-inquiry-rail]')?.className).toContain('rv-sticky-actions')
  })

  it('is on the enquiry form submit row', () => {
    at('')
    render(
      <InquiryForm
        kind="GENERAL"
        copy={COPY}
        enquiryTypes={[]}
        action={async () => ({
          ok: true,
          referenceCode: 'RV-3',
          whatsappUrl: null,
          attachments: 0,
        })}
      />,
    )
    const submit = document.querySelector('button[type="submit"]')
    expect(submit?.closest('.rv-sticky-actions')).not.toBeNull()
  })

  it('is mobile-first, and releases at the md breakpoint', () => {
    // §5.2 forbids `max-width` queries, so sticky is the base state and 768px is the opt-out. A
    // `max-width` rule here would work in a browser and break the one convention the whole
    // responsive system rests on.
    const css = readFileSync(join(process.cwd(), 'app', 'styles', 'base.css'), 'utf8')
    const rule = css.slice(css.indexOf('.rv-sticky-actions'))
    expect(rule).toContain('position: sticky')
    expect(rule).toContain('env(safe-area-inset-bottom')
    expect(rule).toMatch(/@media \(min-width: 768px\)/)
    expect(rule).not.toMatch(/max-width/)
  })

  it('takes its ground and its edge from tokens, so it works in all three schemes', () => {
    const css = readFileSync(join(process.cwd(), 'app', 'styles', 'base.css'), 'utf8')
    const rule = css.slice(css.indexOf('.rv-sticky-actions'))
    expect(rule).toContain('var(--rv-surface-raised)')
    expect(rule).toContain('var(--rv-line-subtle)')
  })
})
