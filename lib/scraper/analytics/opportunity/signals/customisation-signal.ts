import type { Signal } from './types'

/**
 * Does the market treat this as customisable, as Rivya's model assumes?
 * The `customization` key in the current version's normalised payload: present and true → 100,
 * present and false → 0. Coverage: the source's `attribute_extraction` declares a `customization`
 * key AND the version's payload carries it. Neither is inferred from a title.
 */
export const customisationSignal: Signal = {
  key: 'customisation_signal',
  describe: () => "Does the market treat this as customisable, as Rivya's model assumes?",
  inputs: () => [
    'research_sources.attribute_extraction',
    'research_product_versions.normalized.customization',
  ],
  normalise(row, context) {
    const declared = context.attributeKeysBySource.get(row.sourceId)?.has('customization') ?? false
    if (!declared)
      return { included: false, rawInput: null, reason: 'source_does_not_extract_customization' }
    const value = row.normalized?.['customization']
    if (typeof value !== 'boolean') {
      return { included: false, rawInput: null, reason: 'version_lacks_customization' }
    }
    return {
      included: true,
      rawInput: value ? 'customisable' : 'not customisable',
      normalised: value ? 100 : 0,
    }
  },
}
