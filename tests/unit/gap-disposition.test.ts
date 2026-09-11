import { describe, expect, it } from 'vitest'

import { MEDIA_SLOTS, type MediaSlot } from '@/content/media-slots'
import {
  presetWidthFor,
  proposeDisposition,
  proposeDispositions,
  resolutionFit,
} from '@/lib/media/gaps'
import { parseManifest, type ManifestAsset } from '@/lib/media/manifest'
import manifestJson from '@/data/higgsfield/asset-manifest.json'

/**
 * THE FOUR DISPOSITIONS — Phase 43, tested in Phase 42.
 *
 * Phase 07's engine answered "is this slot covered". This one answers "what should be DONE about
 * it", which is a decision — so every assertion here is about the engine NARROWING the choice
 * honestly and refusing to make it. In particular: it must never propose generating for a slot the
 * library can serve, and it must never propose generating for a slot nobody should fill.
 */

const MANIFEST = parseManifest(manifestJson)

const slot = (over: Partial<MediaSlot> = {}): MediaSlot => ({
  key: 'test.slot',
  page: '/test',
  label: 'Test slot',
  kind: 'IMAGE',
  desktopRatio: '16:9',
  mobileRatio: '4:5',
  fillableBy: [],
  minAssets: 1,
  resolution: 'GENERATE',
  ...over,
})

const asset = (over: Partial<ManifestAsset> = {}): ManifestAsset =>
  ({
    ...MANIFEST.assets[0],
    ...over,
  }) as ManifestAsset

describe('proposeDisposition', () => {
  it('says LEAVE_EMPTY for a slot declared EMPTY_STATE, whatever the library holds', () => {
    /*
     * THE ONE BRANCH THAT MUST NOT BE REACHABLE BY DATA. `/portfolio` has no assets because Rivya's
     * delivered work has not been confirmed; generating a picture of a delivered project would
     * fabricate the exact business fact D10's verification workflow exists to prevent. No amount of
     * coverage changes that answer.
     */
    const empty = slot({ resolution: 'EMPTY_STATE', fillableBy: ['decor'] })
    const proposal = proposeDisposition(empty, [asset({ family: 'decor', width: 6000 })])
    expect(proposal.proposed).toBe('LEAVE_EMPTY')
  })

  it('says GENERATE_NEW only when nothing can fill the slot', () => {
    expect(proposeDisposition(slot(), []).proposed).toBe('GENERATE_NEW')
  })

  it('says GENERATE_NEW when every candidate would be scaled up', () => {
    /*
     * UPSCALING IS THE SILENT FAILURE. Cloudinary will happily enlarge a 1280px source into a
     * 2560px hero and the result is visibly soft. A slot whose only candidate upscales is reported
     * as needing generation rather than quietly bound.
     */
    const hero = slot({ key: 'x.hero', fillableBy: ['decor'] })
    const proposal = proposeDisposition(hero, [
      asset({ family: 'decor', width: 1280, aspect_ratio: '16:9' }),
    ])
    expect(proposal.resolution).toBe('UPSCALES')
    expect(proposal.proposed).toBe('GENERATE_NEW')
  })

  it('says REUSE_FROM_FAMILY when candidates hold BOTH declared ratios natively', () => {
    const proposal = proposeDisposition(slot({ fillableBy: ['decor'] }), [
      asset({ family: 'decor', width: 4000, aspect_ratio: '16:9' }),
      asset({ family: 'decor', width: 4000, aspect_ratio: '4:5' }),
    ])
    expect(proposal.proposed).toBe('REUSE_FROM_FAMILY')
  })

  it('says RECROP_EXISTING when the resolution is there and a ratio is not', () => {
    // The phase's central economy: a 4800px master composed for 16:9 usually survives a crop to
    // 4:5, and generating a second asset for the same subject costs a generation and a review.
    const proposal = proposeDisposition(slot({ fillableBy: ['decor'] }), [
      asset({ family: 'decor', width: 4000, aspect_ratio: '16:9' }),
    ])
    expect(proposal.proposed).toBe('RECROP_EXISTING')
    expect(proposal.because).toContain('desktop')
  })

  it('reports the widest candidate and the count, so the report can show its working', () => {
    const proposal = proposeDisposition(slot({ fillableBy: ['decor'] }), [
      asset({ family: 'decor', width: 2000, aspect_ratio: '16:9' }),
      asset({ family: 'decor', width: 5000, aspect_ratio: '4:5' }),
    ])
    expect(proposal.candidateCount).toBe(2)
    expect(proposal.widestPx).toBe(5000)
  })
})

describe('resolution fit', () => {
  it('is UNKNOWN when there is nothing to measure, not FITS', () => {
    expect(resolutionFit(null, 2560)).toBe('UNKNOWN')
  })

  it('treats an exact match as fitting', () => {
    expect(resolutionFit(2560, 2560)).toBe('FITS')
    expect(resolutionFit(2559, 2560)).toBe('UPSCALES')
  })
})

describe('preset width by slot role', () => {
  it('asks most of a hero and least of a card', () => {
    expect(presetWidthFor(slot({ key: 'home.hero.poster' }))).toBe(2560)
    expect(presetWidthFor(slot({ key: 'large-format.dining.card' }))).toBe(480)
    expect(presetWidthFor(slot({ key: 'about.intro' }))).toBe(768)
  })
})

describe('against the real registry and the real manifest', () => {
  const proposals = proposeDispositions({ assets: MANIFEST.assets, bindings: [] })

  it('proposes exactly one disposition per declared slot', () => {
    expect(proposals).toHaveLength(MEDIA_SLOTS.length)
    for (const proposal of proposals) {
      expect(['REUSE_FROM_FAMILY', 'RECROP_EXISTING', 'GENERATE_NEW', 'LEAVE_EMPTY']).toContain(
        proposal.proposed,
      )
    }
  })

  it('proposes generation for the two home hero slots and nothing else', () => {
    /*
     * THE PHASE'S RESULT, PINNED. Ten briefs became two when six `fillableBy` lists and two
     * dispositions were corrected against Phase 07's own analysis. A third appearing here means a
     * mapping was removed, and the next coverage report would ask somebody to draw a picture that
     * already exists.
     */
    const generate = proposals.filter((p) => p.proposed === 'GENERATE_NEW').map((p) => p.slot.key)
    expect(generate).toEqual(['home.hero.video', 'home.hero.poster'])
  })

  it('never proposes generation for a slot declared EMPTY_STATE', () => {
    for (const proposal of proposals) {
      if (proposal.slot.resolution === 'EMPTY_STATE') {
        expect(proposal.proposed, `${proposal.slot.key} must stay empty`).toBe('LEAVE_EMPTY')
      }
    }
  })
})
