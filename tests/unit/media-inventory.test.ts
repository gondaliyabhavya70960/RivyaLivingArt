import { describe, expect, it } from 'vitest'

import { ASSET_PURPOSE_BY_FAMILY, purposeFor } from '@/content/asset-purposes'
import {
  activeFilterCount,
  buildInventory,
  filterInventory,
  inventoryFacets,
  parseInventoryFilters,
} from '@/lib/media/inventory'
import { readManifest } from '@/lib/media/manifest'

/**
 * The Inventory tab's filters, against the real manifest.
 *
 * THE THREE COUNTS IN `phase verification` ARE ASSERTED HERE. Step 7 opens the tracker and checks
 * family `material-macro` → 39, page `process` → 79, type video → 26. Those numbers come from the
 * manifest, so a unit test proves the predicate against the same data the page will use, on every
 * commit, without a database or a browser. The e2e spec then proves the UI is wired to it.
 */

const MANIFEST = readManifest()
const NONE = new Set<string>()
const NO_PLACEMENTS = new Map<string, readonly string[]>()

const ALL = buildInventory(MANIFEST.assets, NONE, NO_PLACEMENTS)

describe('the counts verification step 7 asserts', () => {
  it('family material-macro returns 39', () => {
    expect(filterInventory(ALL, { family: 'material-macro' })).toHaveLength(39)
  })

  it('page process returns 79', () => {
    expect(filterInventory(ALL, { page: 'process' })).toHaveLength(79)
  })

  it('type video returns 26, and image returns 224', () => {
    expect(filterInventory(ALL, { type: 'video' })).toHaveLength(26)
    expect(filterInventory(ALL, { type: 'image' })).toHaveLength(224)
  })

  it('no filter returns all 250', () => {
    expect(filterInventory(ALL, {})).toHaveLength(250)
  })
})

describe('filters compose', () => {
  it('narrows on two fields at once', () => {
    const processVideos = filterInventory(ALL, { page: 'process', type: 'video' })
    expect(processVideos.length).toBeGreaterThan(0)
    expect(processVideos.length).toBeLessThan(79)
    expect(processVideos.every((e) => e.asset.page === 'process')).toBe(true)
    expect(processVideos.every((e) => e.asset.type === 'video')).toBe(true)
  })

  it('returns nothing for a combination the library does not hold', () => {
    // `workshop-session` is 5 assets, all 16:9. Asking for a 9:16 one is a legitimately empty
    // answer, and the table must say "no match" rather than "no data".
    expect(filterInventory(ALL, { family: 'workshop-session', ratio: '9:16' })).toEqual([])
  })
})

describe('migration and usage filters', () => {
  const half = new Set(MANIFEST.assets.slice(0, 100).map((a) => a.higgsfield_generation_id))
  const partly = buildInventory(MANIFEST.assets, half, NO_PLACEMENTS)

  it('splits on migration state', () => {
    expect(filterInventory(partly, { migrated: true })).toHaveLength(100)
    expect(filterInventory(partly, { migrated: false })).toHaveLength(150)
  })

  it('splits on whether anything is bound', () => {
    const placements = new Map<string, readonly string[]>([
      [MANIFEST.assets[0]!.rivya_asset_id, ['about.hero']],
    ])
    const withUse = buildInventory(MANIFEST.assets, NONE, placements)
    expect(filterInventory(withUse, { used: true })).toHaveLength(1)
    expect(filterInventory(withUse, { used: false })).toHaveLength(249)
  })

  it('treats "unused" as no bindings rather than as a missing key', () => {
    // The bug this guards: `!entry.slotKeys.length === filters.used` reads an empty array as
    // truthy in some formulations and silently inverts the filter.
    expect(filterInventory(ALL, { used: false })).toHaveLength(250)
    expect(filterInventory(ALL, { used: true })).toEqual([])
  })
})

describe('the purpose vocabulary', () => {
  it('labels every family in the manifest', () => {
    // An unlabelled family renders "Unclassified family" in the Studio and blanks a column in the
    // generated status document. Catching it here names the family; catching it there does not.
    const unlabelled = [...new Set(MANIFEST.assets.map((a) => a.family))]
      .filter((f) => purposeFor(f) === null)
      .sort()
    expect(unlabelled).toEqual([])
  })

  it('labels no family that does not exist', () => {
    // The other direction. A stale label survives a family rename invisibly, and the map would
    // then be documentation of a library that no longer exists.
    const real = new Set(MANIFEST.assets.map((a) => a.family))
    expect(Object.keys(ASSET_PURPOSE_BY_FAMILY).filter((f) => !real.has(f))).toEqual([])
  })

  it('keeps gallery-scene out of the portfolio vocabulary', () => {
    // D10. These five are rooms, not delivered projects; a project label would make them
    // candidates for a portfolio entry that asserts work Rivya has not been confirmed to have done.
    expect(purposeFor('gallery-scene')).toBe('EXHIBITION_ATMOSPHERE')
  })
})

describe('candidate slots', () => {
  it('names the slots an asset family can fill', () => {
    const materialMacro = ALL.find((e) => e.asset.family === 'material-macro')!
    expect(materialMacro.candidateSlotKeys).toContain('about.hero')
  })

  it('is empty for a family no slot claims', () => {
    // gallery-scene: atmosphere, not project media. /portfolio deliberately declares no family.
    const gallery = ALL.find((e) => e.asset.family === 'gallery-scene')!
    expect(gallery.candidateSlotKeys).toEqual([])
  })
})

describe('facets', () => {
  const facets = inventoryFacets(MANIFEST.assets)

  it('offers exactly the values present in the manifest', () => {
    expect(facets.families).toHaveLength(24)
    expect(facets.pages).toHaveLength(11)
    expect(facets.ratios).toHaveLength(8)
  })

  it('offers no option that would return nothing', () => {
    for (const family of facets.families) {
      expect(filterInventory(ALL, { family }).length).toBeGreaterThan(0)
    }
  })
})

describe('parsing searchParams', () => {
  it('treats an empty string as no filter', () => {
    // This is what the "All" option in a `<select>` submits. Read as a value it filters
    // everything out, and the page looks broken the first time anyone clears a filter.
    expect(parseInventoryFilters({ family: '', page: '', type: '' })).toEqual({})
  })

  it('ignores an unrecognised type', () => {
    expect(parseInventoryFilters({ type: 'model' })).toEqual({})
  })

  it('reads yes/no into booleans', () => {
    expect(parseInventoryFilters({ migrated: 'yes', used: 'no' })).toEqual({
      migrated: true,
      used: false,
    })
  })

  it('ignores an array value', () => {
    // A repeated query parameter. Taking the first would be a guess about which the reader meant.
    expect(parseInventoryFilters({ family: ['a', 'b'] })).toEqual({})
  })

  it('counts the filters that are on', () => {
    expect(activeFilterCount(parseInventoryFilters({ family: 'decor', type: 'video' }))).toBe(2)
    expect(activeFilterCount(parseInventoryFilters({}))).toBe(0)
  })
})
