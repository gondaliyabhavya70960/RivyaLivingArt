import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * PERSIST, THEN REDIRECT — never the reverse (D1, SEED §49), proved by forcing the write to fail.
 *
 * THIS IS THE MOST IMPORTANT TEST IN PHASE 20 and it is worth saying why in full. The rule is not
 * "try to save first". It is that a WhatsApp handoff must be IMPOSSIBLE without a persisted row,
 * because the failure it prevents is silent: the visitor is handed to WhatsApp, types a message to
 * a studio that has no record of them, and everybody believes an enquiry happened. Nothing logs it,
 * nothing raises, and the enquiry simply is not there.
 *
 * THREE MECHANISMS ENFORCE IT AND EACH IS TESTED SOMEWHERE DIFFERENT. `buildHandoffUrl`'s required
 * `inquiryId` is a compile-time guarantee, asserted in `whatsapp-template.test.ts`. The
 * discriminated union is a type-level one, asserted by the compiler on every call site. What is
 * left is the runtime: does the action, when the insert throws, return an object with NO URL on it
 * at all? That is this file.
 *
 * THE MOCKS REPLACE THE DATABASE AND NOTHING ELSE. The action's own control flow — the order of the
 * rate limit, the spam signals, the insert, and the message — runs for real, because that order IS
 * the thing under test.
 */

const createInquiry = vi.fn<(...args: unknown[]) => Promise<void>>()
const inquiryReferenceCode = vi.fn<(...args: unknown[]) => Promise<string>>()
const attachInquiryReferences = vi.fn<(...args: unknown[]) => Promise<number>>()
const recordInquiryHandoff = vi.fn<(...args: unknown[]) => Promise<boolean>>()
const consume = vi.fn<(...args: unknown[]) => Promise<{ allowed: boolean }>>()

vi.mock('server-only', () => ({}))

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'vitest', referer: 'https://x' }),
}))

vi.mock('@/lib/supabase/repositories/inquiries', () => ({
  createInquiry: (...args: unknown[]) => createInquiry(...args),
  inquiryReferenceCode: (...args: unknown[]) => inquiryReferenceCode(...args),
  attachInquiryReferences: (...args: unknown[]) => attachInquiryReferences(...args),
  recordInquiryHandoff: (...args: unknown[]) => recordInquiryHandoff(...args),
}))

vi.mock('@/lib/security/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/rate-limit')>()),
  consume: (...args: unknown[]) => consume(...args),
}))

vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/supabase/repositories/products', () => ({
  getProductBySlug: async (_client: unknown, slug: string) =>
    slug === 'console-table' ? { id: 'p-1', title: 'Console Table' } : null,
}))
vi.mock('@/lib/supabase/repositories/customization-forms', () => ({
  getFormById: async () => null,
}))

const getSiteChrome = vi.fn<() => Promise<unknown>>()

const chrome = {
  strings: new Map([
    [
      'WHATSAPP_TEMPLATE.inquiry',
      'New enquiry.\nPiece: {{product_or_project}}\nName: {{customer_name}}\nPhone: {{phone}}\nCity: {{city}}\nNotes: {{notes}}\nEnquiry: {{inquiry_id}}',
    ],
  ]),
  contact: {
    phone: null,
    whatsapp: '+91 98250 12345',
    email: null,
    locationUrl: null,
    locationLabel: null,
  },
  contactVerified: true,
}
vi.mock('@/lib/site/chrome', () => ({ getSiteChrome: () => getSiteChrome() }))

const { submitInquiry } = await import('@/app/(site)/_actions/submit-inquiry')

const GOOD = {
  kind: 'GENERAL' as const,
  name: 'A Visitor',
  phone: '+91 98250 12345',
  city: 'Surat',
  message: 'I am after something for a hallway.',
  elapsedMs: 20_000,
}

beforeEach(() => {
  vi.clearAllMocks()
  consume.mockResolvedValue({ allowed: true })
  createInquiry.mockResolvedValue(undefined)
  inquiryReferenceCode.mockResolvedValue('RIV-2026-000007')
  attachInquiryReferences.mockResolvedValue(0)
  recordInquiryHandoff.mockResolvedValue(true)
  getSiteChrome.mockResolvedValue(chrome)
})

describe('submitInquiry', () => {
  it('returns a URL only after the row was written', async () => {
    const result = await submitInquiry(GOOD)

    expect(createInquiry).toHaveBeenCalledOnce()
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.referenceCode).toBe('RIV-2026-000007')
    expect(result.whatsappUrl).toContain('https://wa.me/919825012345')
    // The message carries the code, which is what makes the handoff traceable to the row.
    expect(decodeURIComponent(result.whatsappUrl ?? '')).toContain('RIV-2026-000007')
  })

  it('PRODUCES NO URL WHEN THE INSERT FAILS, and nothing that could be navigated to', async () => {
    createInquiry.mockRejectedValueOnce(new Error('the database said no'))

    const result = await submitInquiry(GOOD)

    expect(result).toEqual({ ok: false, code: 'save_failed' })
    // Not "is null" — the property does not exist on this member of the union at all.
    expect('whatsappUrl' in result).toBe(false)
    expect('referenceCode' in result).toBe(false)
    // And nothing downstream ran: no reference code was asked for, no handoff was recorded.
    expect(inquiryReferenceCode).not.toHaveBeenCalled()
    expect(recordInquiryHandoff).not.toHaveBeenCalled()
  })

  it('saves the enquiry and offers no link when no number resolves', async () => {
    getSiteChrome.mockResolvedValueOnce({
      ...chrome,
      contact: { ...chrome.contact, whatsapp: null },
    })

    const result = await submitInquiry(GOOD)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.referenceCode).toBe('RIV-2026-000007')
    expect(result.whatsappUrl).toBeNull()
    // The row says so rather than pretending the visitor was handed off.
    expect(recordInquiryHandoff).toHaveBeenCalledWith({}, expect.any(String), 'UNAVAILABLE', null)
  })

  /**
   * An unverified number is worse than none, because a customer will ring it. The section still
   * renders in the footer — an editor must see their own work — but the handoff will not use it.
   */
  it('refuses to dial a number the owner has not verified', async () => {
    getSiteChrome.mockResolvedValueOnce({ ...chrome, contactVerified: false })

    const result = await submitInquiry(GOOD)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.whatsappUrl).toBeNull()
  })

  it('refuses a payload that names a column the policy exists to pin', async () => {
    const result = await submitInquiry({ ...GOOD, pipeline_status: 'WON' })

    expect(result).toEqual({ ok: false, code: 'invalid', fields: expect.any(Array) })
    expect(createInquiry).not.toHaveBeenCalled()
  })

  it('refuses a PRODUCT enquiry that names no product at all', async () => {
    const result = await submitInquiry({ ...GOOD, kind: 'PRODUCT' })
    expect(result.ok).toBe(false)
    expect(createInquiry).not.toHaveBeenCalled()
  })

  it('files a PRODUCT enquiry against the piece its slug names', async () => {
    const result = await submitInquiry({ ...GOOD, kind: 'PRODUCT', productSlug: 'console-table' })

    expect(result.ok).toBe(true)
    expect(createInquiry).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ kind: 'PRODUCT', product_id: 'p-1' }),
    )
  })

  /**
   * A stale link — a piece withdrawn between the visitor opening the page and pressing send —
   * must not lose the enquiry. The column constraint refuses PRODUCT with no product, so the kind
   * gives way and the studio still gets the name, the number and whatever was typed.
   */
  it('files a product enquiry whose slug no longer resolves as a general one', async () => {
    const result = await submitInquiry({ ...GOOD, kind: 'PRODUCT', productSlug: 'withdrawn' })

    expect(result.ok).toBe(true)
    expect(createInquiry).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ kind: 'GENERAL', product_id: null }),
    )
  })

  it('consumes the rate limit before it looks at the spam signals', async () => {
    consume.mockResolvedValueOnce({ allowed: false })
    // Trips the honeypot too. A flood must still cost its sender their allowance, so the limit is
    // consumed first and its refusal is what comes back.
    const result = await submitInquiry({ ...GOOD, website: 'https://spam.test' })

    expect(result).toEqual({ ok: false, code: 'rate_limited' })
    expect(consume).toHaveBeenCalledOnce()
    expect(createInquiry).not.toHaveBeenCalled()
  })

  it('writes nothing for a filled honeypot, and says only what a genuine failure says', async () => {
    const result = await submitInquiry({ ...GOOD, website: 'https://spam.test' })

    expect(result).toEqual({ ok: false, code: 'save_failed' })
    expect(createInquiry).not.toHaveBeenCalled()
  })

  it('writes nothing for a form completed faster than a person can read it', async () => {
    const result = await submitInquiry({ ...GOOD, elapsedMs: 900 })

    expect(result).toEqual({ ok: false, code: 'save_failed' })
    expect(createInquiry).not.toHaveBeenCalled()
  })

  /**
   * Once the row exists the enquiry has ARRIVED. Everything after it is bookkeeping, and a failure
   * in bookkeeping must never tell the visitor their brief was lost when it was not.
   */
  it('still succeeds when the bookkeeping after the insert fails', async () => {
    attachInquiryReferences.mockRejectedValueOnce(new Error('cloudinary is down'))
    recordInquiryHandoff.mockRejectedValueOnce(new Error('and so is the counter'))

    const result = await submitInquiry({
      ...GOOD,
      references: [{ publicId: 'rivya/inquiries/incoming/a/b', filename: 'b.jpg' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.referenceCode).toBe('RIV-2026-000007')
    expect(result.attachments).toBe(0)
  })
})
