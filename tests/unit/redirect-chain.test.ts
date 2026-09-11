import { describe, expect, it } from 'vitest'

import { chainedRedirects, normaliseRedirectPath, validateRedirect } from '@/lib/seo/redirect-rules'

/**
 * Loops, chains and self-redirects, refused at write time — Phase 39.
 */
const existing = [
  { id: 'r1', from_path: '/product/old-table', to_path: '/product/wave-table' },
  { id: 'r2', from_path: '/journal/old-post', to_path: '/journal/new-post' },
]

describe('validateRedirect', () => {
  it('accepts a plain move', () => {
    expect(validateRedirect(existing, { from_path: '/about-us', to_path: '/about' })).toEqual({
      ok: true,
    })
  })

  it('refuses a self-redirect', () => {
    const v = validateRedirect(existing, { from_path: '/a', to_path: '/a' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('self')
  })

  it('refuses a loop: a → b beside b → a', () => {
    const v = validateRedirect(existing, {
      from_path: '/product/wave-table',
      to_path: '/product/old-table',
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('loop')
  })

  it('refuses a chain whose target is already a source', () => {
    const v = validateRedirect(existing, { from_path: '/x', to_path: '/product/old-table' })
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.code).toBe('chain')
      expect(v.message).toContain('/product/wave-table')
    }
  })

  it('refuses a chain whose source is already a target', () => {
    const v = validateRedirect(existing, {
      from_path: '/product/wave-table',
      to_path: '/product/wave-table-ii',
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('chain')
  })

  it('refuses a duplicate source and names the existing target', () => {
    const v = validateRedirect(existing, { from_path: '/product/old-table', to_path: '/elsewhere' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('duplicate')
  })

  it('lets a row be edited without conflicting with itself', () => {
    expect(
      validateRedirect(existing, {
        id: 'r1',
        from_path: '/product/old-table',
        to_path: '/product/wave-table-ii',
      }),
    ).toEqual({ ok: true })
  })

  it('refuses a malformed path with the field named', () => {
    const v = validateRedirect(existing, { from_path: '/Has Spaces', to_path: '/ok' })
    expect(v.ok).toBe(false)
    if (!v.ok && v.code === 'shape') expect(v.field).toBe('from_path')
  })

  it('normalises case, trailing slash and query before comparing', () => {
    expect(normaliseRedirectPath('/Product/Old-Table/?x=1#y')).toBe('/product/old-table')
    const v = validateRedirect(existing, { from_path: '/PRODUCT/old-table/', to_path: '/z' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('duplicate')
  })
})

describe('chainedRedirects', () => {
  it('is empty on a table the rules produced', () => {
    expect(chainedRedirects(existing)).toEqual([])
  })
  it('names the row whose target is a source', () => {
    const rows = [...existing, { id: 'r3', from_path: '/z', to_path: '/product/old-table' }]
    expect(chainedRedirects(rows).map((r) => r.id)).toEqual(['r3'])
  })
})
