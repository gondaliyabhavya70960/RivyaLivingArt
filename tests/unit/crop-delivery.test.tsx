import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MediaImage } from '@/components/patterns/MediaImage'
import { cropsByRatio, cropSegment, type MediaCropRow } from '@/lib/media/crop'

/**
 * THE CROP REACHES THE VISITOR — §19.1 questions 3 and 7.
 *
 * `CropEditor` has written focal points to `media_crops` since Phase 43, `lib/media/crop.ts` has
 * turned a row into a `c_crop` component, and `imageUrl` has accepted one as its fourth argument.
 * `cropsForAssets` — the bulk loader whose own header says "THE PUBLIC RENDERER READS THROUGH THE
 * ANON POLICY" — had **no callers anywhere in the repository**. Every crop an editor made was
 * written, readable, and never delivered.
 *
 * THE BUG THIS WOULD ACTUALLY HAVE is the srcset. A crop on the `src` alone looks correct in every
 * screenshot and every manual check, because the `src` is what a developer inspects — and then a
 * browser picks a rung and shows a different region of the photograph. So the rung assertion below
 * matters more than the `src` one.
 */
const CROP: MediaCropRow = {
  media_asset_id: 'a',
  aspect_ratio: '4:5',
  x: 100,
  y: 200,
  width: 800,
  height: 1000,
  gravity: null,
} as MediaCropRow

const MEDIA = { publicId: 'rivya/thing', resourceType: 'image' } as const

function urls(cropSegmentValue: string | null): { src: string; rungs: string[] } {
  const { container } = render(
    <MediaImage
      cloudName="rivya-test"
      media={MEDIA}
      preset="card"
      sizes="100vw"
      alt="A thing"
      ratio="4:5"
      cropSegment={cropSegmentValue}
    />,
  )
  const img = container.querySelector('img')
  return {
    src: img?.getAttribute('src') ?? '',
    /*
     * SPLIT ON COMMA-SPACE, NOT COMMA. A `c_crop` component is itself comma-separated
     * (`c_crop,h_1000,w_800,…`) with no spaces, while `srcset` joins its candidates with `', '`.
     * Splitting on a bare comma tears every URL into pieces and the assertion below then fails
     * against a fragment — which is exactly how this test first read as a bug in the component.
     */
    rungs: (img?.getAttribute('srcset') ?? '')
      .split(', ')
      .map((rung) => rung.trim())
      .filter((rung) => rung !== ''),
  }
}

describe('crop delivery', () => {
  const segment = cropSegment(CROP)

  it('produces a sorted c_crop component from a stored row', () => {
    expect(segment).toBe('c_crop,h_1000,w_800,x_100,y_200')
  })

  it('puts the crop on the src', () => {
    expect(urls(segment).src).toContain('c_crop,h_1000,w_800,x_100,y_200')
  })

  it('puts the crop on EVERY srcset rung, not just the src', () => {
    const { rungs } = urls(segment)
    expect(rungs.length).toBeGreaterThan(1)
    for (const rung of rungs) {
      expect(rung, `rung without the crop: ${rung}`).toContain('c_crop,h_1000,w_800,x_100,y_200')
    }
  })

  it('keeps every rung the same picture at a different size', () => {
    // The widths must differ and the crop must not. A srcset whose candidates crop differently is
    // a layout that changes subject as the browser picks.
    const { rungs } = urls(segment)
    const widths = new Set(rungs.map((rung) => rung.split(' ')[1]))
    expect(widths.size).toBe(rungs.length)
  })

  it('delivers the master untouched when no editor chose a crop', () => {
    const { src, rungs } = urls(null)
    expect(src).not.toContain('c_crop')
    for (const rung of rungs) expect(rung).not.toContain('c_crop')
  })

  it('indexes crops by the ratio a renderer asks for', () => {
    const map = cropsByRatio([CROP, { ...CROP, aspect_ratio: '21:9' } as MediaCropRow])
    expect([...map.keys()].sort()).toEqual(['21:9', '4:5'])
  })
})
