import { describe, expect, it } from 'vitest'

import { contentHash, hashRowSubset } from '../../../scripts/seed/hash'

/**
 * The hash that decides whether a row is still the seed's to write.
 *
 * Two failure modes, both silent, both tested here:
 *   unstable hash  -> every row looks owner-edited, and the seed quietly stops applying
 *   coarse hash    -> a real owner edit looks untouched, and the seed overwrites it
 */
describe('contentHash', () => {
  it('does not depend on key order', () => {
    // A seed module author reordering two lines must not make every row in the module look edited.
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }))
  })

  it('changes when any value changes', () => {
    expect(contentHash({ name: 'Furniture' })).not.toBe(contentHash({ name: 'Owner Edit' }))
  })

  it('distinguishes a number from the same digits as a string', () => {
    expect(contentHash({ sort_order: 10 })).not.toBe(contentHash({ sort_order: '10' }))
  })

  it('distinguishes null from a missing key', () => {
    expect(contentHash({ a: 1, b: null })).not.toBe(contentHash({ a: 1 }))
  })

  it('is stable across calls', () => {
    expect(contentHash({ slug: 'furniture' })).toBe(contentHash({ slug: 'furniture' }))
  })
})

describe('hashRowSubset', () => {
  const fields = ['name', 'slug', 'sort_order']

  it('matches the record hash for a row nobody has touched', () => {
    // This equality IS the owner-edit test. If it ever stops holding for an untouched row, the
    // seed becomes a no-op and nothing says so.
    const record = { name: 'Furniture', slug: 'furniture', sort_order: 10 }
    const row = { ...record, id: 'uuid', status: 'DRAFT', created_at: 'ts', updated_by: null }
    expect(hashRowSubset(row, fields)).toBe(contentHash(record))
  })

  it('ignores columns outside the seeded field set', () => {
    // An editor publishing a row, or the updated_at trigger firing, must not read as an edit to
    // the seeded content.
    const base = { name: 'Furniture', slug: 'furniture', sort_order: 10 }
    const draft = { ...base, status: 'DRAFT', updated_at: 'a' }
    const published = { ...base, status: 'PUBLISHED', updated_at: 'b' }
    expect(hashRowSubset(draft, fields)).toBe(hashRowSubset(published, fields))
  })

  it('detects an edit to a seeded column', () => {
    const before = { name: 'Furniture', slug: 'furniture', sort_order: 10 }
    const after = { ...before, name: 'Owner Edit' }
    expect(hashRowSubset(after, fields)).not.toBe(hashRowSubset(before, fields))
  })
})
