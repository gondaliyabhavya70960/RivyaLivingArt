import { describe, expect, it } from 'vitest'

import { MEDIA_SLOTS, type MediaSlot } from '@/content/media-slots'
import {
  briefSkeleton,
  briefableGaps,
  collidingFamily,
  computeGaps,
  suggestedAssetId,
  type SlotBinding,
} from '@/lib/media/gaps'
import { readManifest, type ManifestAsset } from '@/lib/media/manifest'

/**
 * The gap engine, driven by the real 250-asset manifest.
 *
 * WHY THE REAL MANIFEST RATHER THAN FIXTURES. The registry's `fillableBy` lists are claims about
 * what the library contains, and a fixture would let those claims drift from the file they
 * describe: a family renamed by a manifest rebuild would leave a slot silently uncoverable, which
 * is exactly the failure this engine exists to detect and exactly the one a fixture would hide.
 * The rules themselves are tested against synthetic slots, where the input can be controlled.
 */

const MANIFEST = readManifest()
const FAMILIES = [...new Set(MANIFEST.assets.map((a) => a.family))]

function slot(overrides: Partial<MediaSlot> = {}): MediaSlot {
  return {
    key: 'test.slot',
    page: '/test',
    label: 'Test slot',
    kind: 'IMAGE',
    desktopRatio: '16:9',
    mobileRatio: '4:5',
    fillableBy: [],
    minAssets: 1,
    resolution: 'GENERATE',
    ...overrides,
  }
}

function asset(overrides: Partial<ManifestAsset> = {}): ManifestAsset {
  return { ...MANIFEST.assets[0]!, ...overrides }
}

describe('the slot registry itself', () => {
  it('names only families that exist in the manifest', () => {
    const real = new Set(MANIFEST.assets.map((a) => a.family))
    const invented = MEDIA_SLOTS.flatMap((s) => s.fillableBy).filter((f) => !real.has(f))
    // A typo here would present a covered surface as a gap and earn it a generation brief —
    // spending credits to regenerate something the library already holds.
    expect(invented).toEqual([])
  })

  it('has a unique key per slot', () => {
    const keys = MEDIA_SLOTS.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('requires at least one asset per slot', () => {
    // `minAssets: 0` would make every state FILLED and the tab permanently empty.
    expect(MEDIA_SLOTS.filter((s) => s.minAssets < 1)).toEqual([])
  })
})

describe('classification', () => {
  it('is FILLED once bindings reach minAssets', () => {
    const report = computeGaps({
      assets: [],
      bindings: [{ slot_key: 'test.slot' }, { slot_key: 'test.slot' }],
      slots: [slot({ minAssets: 2 })],
    })
    expect(report.pages[0]!.slots[0]!.state).toBe('FILLED')
  })

  it('is GAP when no candidate family holds anything, however many are declared', () => {
    const report = computeGaps({
      assets: MANIFEST.assets,
      bindings: [],
      slots: [slot({ fillableBy: [] })],
    })
    expect(report.pages[0]!.slots[0]!.state).toBe('GAP')
  })

  it('is THIN when candidates exist but fall short of minAssets', () => {
    const report = computeGaps({
      assets: [asset({ family: 'solo' })],
      bindings: [],
      slots: [slot({ fillableBy: ['solo'], minAssets: 2 })],
    })
    const status = report.pages[0]!.slots[0]!
    expect(status.state).toBe('THIN')
    expect(status.candidateCount).toBe(1)
  })

  it('is COVERED when the library could fill it but nothing is bound', () => {
    const report = computeGaps({
      assets: [asset({ family: 'plenty' }), asset({ family: 'plenty' })],
      bindings: [],
      slots: [slot({ fillableBy: ['plenty'], minAssets: 2 })],
    })
    expect(report.pages[0]!.slots[0]!.state).toBe('COVERED')
  })

  it('does not count a partially bound slot as filled', () => {
    // Nine covers bound against ten declared is not a finished journal index.
    const report = computeGaps({
      assets: [asset({ family: 'plenty' }), asset({ family: 'plenty' })],
      bindings: [{ slot_key: 'test.slot' }],
      slots: [slot({ fillableBy: ['plenty'], minAssets: 2 })],
    })
    const status = report.pages[0]!.slots[0]!
    expect(status.state).toBe('COVERED')
    expect(status.boundCount).toBe(1)
  })

  it('counts the repeating-slot index form against the one declared slot', () => {
    // `(context_type, context_id, slot_key, role)` is unique, so a slot needing four cards mints
    // `key[0]`…`key[3]`. Without stripping the index the slot would read as unbound while four
    // rows pointed at it — the exact failure that would make the Gaps tab lie after Phase 09.
    const report = computeGaps({
      assets: [],
      bindings: [
        { slot_key: 'test.slot[0]' },
        { slot_key: 'test.slot[1]' },
        { slot_key: 'test.slot[2]' },
        { slot_key: 'test.slot[3]' },
      ],
      slots: [slot({ minAssets: 4 })],
    })
    expect(report.pages[0]!.slots[0]!.boundCount).toBe(4)
    expect(report.pages[0]!.slots[0]!.state).toBe('FILLED')
  })

  it('ignores a binding whose slot_key matches no declared slot', () => {
    const report = computeGaps({
      assets: [],
      bindings: [{ slot_key: 'invented.by.the.cms' }],
      slots: [slot()],
    })
    expect(report.pages[0]!.slots[0]!.boundCount).toBe(0)
    expect(report.pages[0]!.slots[0]!.state).toBe('GAP')
  })
})

describe('missing ratios', () => {
  it('names a declared ratio no candidate holds natively', () => {
    const report = computeGaps({
      assets: [asset({ family: 'wide', aspect_ratio: '16:9' })],
      bindings: [],
      slots: [slot({ fillableBy: ['wide'], desktopRatio: '16:9', mobileRatio: '4:5' })],
    })
    expect(report.pages[0]!.slots[0]!.missingRatios).toEqual(['4:5'])
  })

  it('is empty when there are no candidates at all', () => {
    // On a GAP the ratio list would be both declared ratios every time, which is noise: the gap
    // is the finding.
    const report = computeGaps({ assets: [], bindings: [], slots: [slot()] })
    expect(report.pages[0]!.slots[0]!.missingRatios).toEqual([])
  })

  it('does not repeat a ratio when desktop and mobile declare the same one', () => {
    const report = computeGaps({
      assets: [asset({ family: 'tall', aspect_ratio: '9:16' })],
      bindings: [],
      slots: [slot({ fillableBy: ['tall'], desktopRatio: '1:1', mobileRatio: '1:1' })],
    })
    expect(report.pages[0]!.slots[0]!.missingRatios).toEqual(['1:1'])
  })
})

describe('thin and orphan families', () => {
  it('reports the family and the slots it leaves thin', () => {
    const report = computeGaps({
      assets: [asset({ family: 'solo' })],
      bindings: [],
      slots: [slot({ key: 'a', fillableBy: ['solo'], minAssets: 2 })],
    })
    expect(report.thinFamilies).toEqual([{ family: 'solo', assetCount: 1, slotKeys: ['a'] }])
  })

  it('does not report a family that fills its slots', () => {
    const report = computeGaps({
      assets: [asset({ family: 'plenty' }), asset({ family: 'plenty' })],
      bindings: [],
      slots: [slot({ fillableBy: ['plenty'], minAssets: 2 })],
    })
    expect(report.thinFamilies).toEqual([])
  })

  it('reports a family no slot claims', () => {
    const report = computeGaps({
      assets: [asset({ family: 'unclaimed' })],
      bindings: [],
      slots: [slot({ fillableBy: [] })],
    })
    expect(report.orphanFamilies).toEqual([{ family: 'unclaimed', assetCount: 1 }])
  })
})

describe('briefableGaps', () => {
  it('excludes an EMPTY_STATE gap', () => {
    // The load-bearing test of this module. Generating for /portfolio would assert that Rivya
    // delivered a project it has not been confirmed to have delivered (D10).
    const report = computeGaps({
      assets: [],
      bindings: [],
      slots: [
        slot({ key: 'generate.me', resolution: 'GENERATE' }),
        slot({ key: 'leave.me.empty', resolution: 'EMPTY_STATE' }),
      ],
    })
    expect(report.gaps).toHaveLength(2)
    expect(briefableGaps(report).map((s) => s.slot.key)).toEqual(['generate.me'])
  })

  it('excludes the real /portfolio slot from the real registry', () => {
    const report = computeGaps({ assets: MANIFEST.assets, bindings: [] })
    const keys = briefableGaps(report).map((s) => s.slot.key)
    expect(report.gaps.map((s) => s.slot.key)).toContain('portfolio.project')
    expect(keys).not.toContain('portfolio.project')
  })
})

describe('against the real manifest, unbound', () => {
  const report = computeGaps({ assets: MANIFEST.assets, bindings: [] })

  it('finds every page the phase document names as a gap', () => {
    // Verification step 8, verbatim: open the Gaps tab and assert these all appear.
    const gapPages = new Set(report.gaps.map((s) => s.slot.page))
    for (const page of [
      '/',
      '/collection',
      '/collection/furniture',
      '/collection/collectible-design',
      '/custom-commissions',
      '/contact',
      '/faq',
    ]) {
      expect(gapPages).toContain(page)
    }
  })

  it('does not call a well-covered surface a gap', () => {
    // 79 process assets and 39 material studies. If either shows as a gap, the registry has
    // drifted from the manifest and briefs would be written for pictures that already exist.
    const byKey = new Map(report.pages.flatMap((p) => p.slots).map((s) => [s.slot.key, s]))
    expect(byKey.get('process.sections')!.state).toBe('COVERED')
    expect(byKey.get('about.hero')!.state).toBe('COVERED')
    expect(byKey.get('journal.cover')!.state).toBe('COVERED')
  })

  it('finds the two single-asset large-format families thin', () => {
    expect(report.thinFamilies.map((f) => f.family).sort()).toEqual([
      'largeformat-coffee',
      'largeformat-monumental',
    ])
  })

  it('totals add up to the number of declared slots', () => {
    const { slots, filled, covered, thin, gap } = report.totals
    expect(filled + covered + thin + gap).toBe(slots)
    expect(slots).toBe(MEDIA_SLOTS.length)
  })

  it('has no FILLED slot before the CMS exists', () => {
    // Nothing binds anything until Phase 08. A FILLED slot here would mean the engine counted a
    // binding that does not exist.
    expect(report.totals.filled).toBe(0)
  })
})

describe('bindings from a later phase', () => {
  it('turns a covered slot filled once enough rows bind it', () => {
    const bindings: SlotBinding[] = Array.from({ length: 10 }, () => ({
      slot_key: 'journal.cover',
    }))
    const report = computeGaps({ assets: MANIFEST.assets, bindings })
    const status = report.pages.flatMap((p) => p.slots).find((s) => s.slot.key === 'journal.cover')!
    expect(status.state).toBe('FILLED')
    expect(report.totals.filled).toBe(1)
  })

  it('cannot fill a gap by binding to it', () => {
    // A binding on a slot no family can fill means the CMS points at an asset the registry says
    // is not suitable. FILLED is the honest answer — a person overrode the registry — but the
    // library is still short, so `fillableBy` is what must change, not the count.
    const report = computeGaps({
      assets: MANIFEST.assets,
      bindings: [{ slot_key: 'contact.hero' }],
    })
    const status = report.pages.flatMap((p) => p.slots).find((s) => s.slot.key === 'contact.hero')!
    expect(status.state).toBe('FILLED')
    expect(status.candidateCount).toBe(0)
  })
})

describe('brief skeletons', () => {
  const report = computeGaps({ assets: MANIFEST.assets, bindings: [] })

  it('mints the IDs the phase document names', () => {
    const home = MEDIA_SLOTS.find((s) => s.key === 'home.hero.video')!
    const poster = MEDIA_SLOTS.find((s) => s.key === 'home.hero.poster')!
    expect(suggestedAssetId(home)).toBe('HOME-HERO-VIDEO-001')
    expect(suggestedAssetId(poster)).toBe('HOME-HERO-POSTER-001')
  })

  it('detects a collision that differs only by a dash', () => {
    /**
     * THE CASE THAT EARNS `collidingFamily` ITS EXISTENCE, and it is a real one: the slot key
     * `large-format.coffee` mints `LARGE-FORMAT-COFFEE-001`, while the family allocator will mint
     * `LARGEFORMAT-COFFEE-001` for `largeformat-coffee` the moment that family gains a second
     * asset. Different strings, one name — a literal comparison passes and a reader cannot tell
     * them apart. D6 as amended by A1 forbids exactly this.
     */
    expect(collidingFamily('LARGE-FORMAT-COFFEE-001', ['largeformat-coffee'])).toBe(
      'largeformat-coffee',
    )
    expect(collidingFamily('HOME-HERO-VIDEO-001', FAMILIES)).toBeNull()
  })

  it('refuses to mint a colliding ID, naming the family instead', () => {
    const coffee = MEDIA_SLOTS.find((s) => s.key === 'large-format.coffee')!
    const status = report.pages.flatMap((p) => p.slots).find((s) => s.slot === coffee)!
    const skeleton = briefSkeleton(status, FAMILIES)

    expect(skeleton).toContain('**TODO**')
    expect(skeleton).toContain('largeformat-coffee')
  })

  it('mints a clean ID for every slot the Gaps tab offers a brief button on', () => {
    // The button renders only on a GAP whose resolution is GENERATE. Those are the ones a person
    // will actually paste, so those are the ones that must not need a rename.
    for (const gap of briefableGaps(report)) {
      expect(collidingFamily(suggestedAssetId(gap.slot), FAMILIES), gap.slot.key).toBeNull()
    }
  })

  it('never collides with an existing asset ID', () => {
    const existing = new Set(MANIFEST.assets.map((a) => a.rivya_asset_id))
    for (const slot of MEDIA_SLOTS) {
      expect(existing.has(suggestedAssetId(slot)), slot.key).toBe(false)
    }
  })

  it('marks the skeleton NEW_GENERATION_REQUIRED so the guard accepts it', () => {
    // A pasted brief has to pass `assert-no-regeneration.ts` rule 2 unchanged, or every use of
    // the button produces a brief that fails CI.
    const gap = briefableGaps(report)[0]!
    expect(briefSkeleton(gap, FAMILIES)).toContain('`NEW_GENERATION_REQUIRED`')
  })

  it('leaves the judgements blank', () => {
    // Prompt, gate answers and alt text are a person's call. A prefilled plausible prompt is how
    // a brief gets approved without anyone asking whether something existing already fits.
    const skeleton = briefSkeleton(briefableGaps(report)[0]!, FAMILIES)
    expect(skeleton).toContain('Q1 ? · Q2 ? · Q3 ? · Q4 ?')
    expect(skeleton).toContain('TODO')
  })
})
