import type { Signal } from './types'
import { clamp } from './types'

/**
 * Is it made of what Rivya works in?
 * `research_products.material_tokens` ∩ the `materials` vocabulary, compared IN APPLICATION CODE —
 * no SQL join crosses the research boundary. Matched share × 100. Coverage: the row carries at
 * least one material token.
 */
export const materialAdjacency: Signal = {
  key: 'material_adjacency',
  describe: () => 'Is it made of what Rivya works in?',
  inputs: () => ['research_products.material_tokens', 'materials (slug, name) vocabulary'],
  normalise(row, context) {
    const tokens = row.materialTokens
      .map((token) => token.toLowerCase().trim())
      .filter((token) => token !== '')
    if (tokens.length === 0)
      return { included: false, rawInput: null, reason: 'no_material_tokens' }
    const matched = tokens.filter((token) => context.materialVocabulary.has(token))
    return {
      included: true,
      rawInput: `${String(matched.length)} of ${String(tokens.length)} tokens: ${matched.join(', ') || '—'}`,
      normalised: clamp((100 * matched.length) / tokens.length),
    }
  },
}
