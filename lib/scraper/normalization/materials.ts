import { prepareLexicon, type Lexicon } from './lexicon'
import type { ParseState } from './schema'

/**
 * Words on somebody else's page, matched against a vocabulary a person maintains.
 *
 * WORD BOUNDARIES, NOT SUBSTRINGS, AND THIS IS THE WHOLE OF WHY THE MODULE IS NOT THREE LINES.
 * `ash` is inside `ashtray`, `oak` is inside `oakum`, `cane` is inside `cane sugar` and `iron` is
 * inside `ironing board` — a substring match turns a description that mentions none of those
 * materials into a row claiming all of them, and a material breakdown built from it is confidently
 * wrong. Every pattern is matched with a boundary on each side.
 *
 * LONGEST PATTERN WINS AND THE SPAN IS THEN CONSUMED. "Brushed stainless steel" is one material,
 * and matching both `stainless_steel` and `steel` would double-count it in every breakdown. The
 * lexicon arrives sorted longest-first; a match blanks the characters it consumed so a shorter
 * pattern cannot find them again.
 *
 * NOTHING IS INFERRED FROM AN IMAGE, A PRICE OR A CATEGORY. A page that does not name its materials
 * produces an empty token list and `ABSENT`, and an empty list is a legible answer.
 */

/** Ten is more materials than any real piece names; past that the text is a glossary, not a spec. */
export const MAX_MATERIAL_TOKENS = 10

export interface MaterialReading {
  readonly tokens: readonly string[]
  readonly state: ParseState
}

/**
 * A boundary that works either side of a phrase containing spaces and hyphens.
 *
 * `\b` ALONE IS WRONG AT THE EDGES OF A MULTI-WORD PATTERN. `\bmango wood\b` is fine, but a pattern
 * that begins or ends with a non-word character — none do today, and one will — silently never
 * matches. Explicit look-around on the letter class is what a reader can check.
 */
function boundedPattern(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    .replace(/\s+/gu, String.raw`[\s\-–]+`)
  return new RegExp(String.raw`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'giu')
}

export function matchMaterials(texts: readonly string[], lexicon: Lexicon): MaterialReading {
  const haystack = texts
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .join(' · ')
    .toLowerCase()

  if (haystack === '') return { tokens: [], state: 'ABSENT' }

  const prepared = prepareLexicon(lexicon)
  // A mutable copy the matcher blanks as it consumes spans, so a shorter pattern cannot re-match
  // characters a longer one already claimed. Blanked rather than removed, so every index stays put.
  let remaining = haystack
  const tokens: string[] = []

  for (const { token, pattern } of prepared) {
    if (tokens.length >= MAX_MATERIAL_TOKENS) break
    if (tokens.includes(token)) continue

    const expression = boundedPattern(pattern)
    const match = expression.exec(remaining)
    if (match === null) continue

    tokens.push(token)
    remaining =
      remaining.slice(0, match.index) +
      ' '.repeat(match[0].length) +
      remaining.slice(match.index + match[0].length)
  }

  // A description that names no known material is UNPARSED rather than ABSENT: the page said
  // something, and Rivya did not recognise it. That difference is what the lexicon editor exists to
  // close, and collapsing it would hide the gap.
  return { tokens, state: tokens.length > 0 ? 'PARSED' : 'UNPARSED' }
}
