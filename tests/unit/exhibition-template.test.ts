import { describe, expect, it } from 'vitest'

import { EXHIBITION_TEMPLATE, exhibitionSections } from '@/content/templates/exhibition'
import { SECTION_RENDERERS } from '@/components/sections/registry'
import { isBuilt } from '@/lib/cms/registry'

/**
 * The exhibition template, and the one thing it must never do.
 *
 * A TEMPLATE THAT INSERTS AN UNBUILT BLOCK IS THE FAILURE THIS FILE EXISTS FOR. It would give an
 * editor a band that renders nothing on the public site — indistinguishable, from inside Studio,
 * from a band they have not filled in yet. That is why element 9 is absent rather than mapped to
 * `rich-text`, and why the assertion below is over the registry rather than over a list of names.
 */

describe('the exhibition template', () => {
  it('inserts only blocks that are BUILT and have a renderer', () => {
    for (const entry of EXHIBITION_TEMPLATE) {
      expect(isBuilt(entry.blockType), `${entry.blockType} is not BUILT`).toBe(true)
      expect(
        SECTION_RENDERERS[entry.blockType],
        `${entry.blockType} has no renderer`,
      ).not.toBeNull()
    }
  })

  it('follows FEAT §8 order, ascending and without repeating an element', () => {
    const numbers = EXHIBITION_TEMPLATE.map((entry) => entry.element)
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  /**
   * Element 9 is "Editorial copy" → `rich-text`, which is PLANNED. Amendment A14 records the
   * decision. This asserts the absence deliberately: a future edit that "completes" the template by
   * adding it back would pass the ordering test above and fail here, next to the reason.
   */
  it('omits element 9, because rich-text has no renderer', () => {
    expect(EXHIBITION_TEMPLATE.map((entry) => entry.element)).not.toContain(9)
    expect(EXHIBITION_TEMPLATE).toHaveLength(10)
    expect(SECTION_RENDERERS['rich-text']).toBeNull()
  })

  it('uses signature-media twice — once as a still, once as a film', () => {
    const bands = EXHIBITION_TEMPLATE.filter((entry) => entry.blockType === 'signature-media')
    expect(bands).toHaveLength(2)
    expect(bands.map((band) => band.payload?.['is_video'] ?? false)).toEqual([false, true])
  })

  it('produces a payload for every band that its own schema accepts', () => {
    const sections = exhibitionSections()
    expect(sections).toHaveLength(EXHIBITION_TEMPLATE.length)
    for (const section of sections) expect(section.payload).toBeTypeOf('object')
  })

  /**
   * D2 AND D10 FROM OPPOSITE DIRECTIONS. A template that pre-filled a heading would be marketing
   * copy written by this repository rather than by the owner, and on a collection nobody has
   * confirmed exists it would also be a claim about a collection that does not.
   */
  it('writes no copy at all', () => {
    for (const entry of EXHIBITION_TEMPLATE) {
      const payload = (entry.payload ?? {}) as Record<string, unknown>
      for (const value of Object.values(payload)) {
        expect(
          typeof value,
          `${entry.blockType} carries a string in its template payload`,
        ).not.toBe('string')
      }
    }
  })
})
