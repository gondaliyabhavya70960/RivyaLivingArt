import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SimilarityLegend } from '@/components/studio/research/SimilarityLegend'
import {
  BAND_DEFINITIONS,
  PRECISION_NOT_YET_MEASURED,
} from '@/lib/scraper/analytics/similarity/bands'

/**
 * The phase document's first named risk: a WEAK pair read as evidence that two products are the
 * same. The mitigation is that the "does not mean" column ships in the UI, not just the docs —
 * so this renders the legend and asserts every one of those sentences is in the markup, and that
 * the unmeasured-precision wording is beside every band while no sample exists.
 */
describe('SimilarityLegend', () => {
  const html = renderToStaticMarkup(<SimilarityLegend />)

  it('renders all four "does not mean" sentences', () => {
    for (const definition of BAND_DEFINITIONS) {
      expect(html).toContain(definition.doesNotMean)
      expect(html).toContain(`data-does-not-mean="${definition.band}"`)
    }
  })

  it('renders every band, threshold and meaning', () => {
    for (const definition of BAND_DEFINITIONS) {
      expect(html).toContain(definition.band)
      expect(html).toContain(definition.threshold)
      expect(html).toContain(definition.means)
    }
  })

  it('says PRECISION NOT YET MEASURED beside each band while no sample exists', () => {
    const matches = html.match(/data-precision="unmeasured"/gu) ?? []
    expect(matches).toHaveLength(BAND_DEFINITIONS.length)
    expect(html).toContain(PRECISION_NOT_YET_MEASURED)
    expect(html).not.toContain('data-precision="measured"')
  })

  it('never uses the word "same" as a band name', () => {
    const names = html.match(/data-band-row="([A-Z_]+)"/gu) ?? []
    for (const name of names) expect(name.toLowerCase()).not.toContain('same')
  })
})
