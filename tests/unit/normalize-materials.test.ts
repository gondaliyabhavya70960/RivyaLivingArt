import { describe, expect, it } from 'vitest'

import {
  MAX_MATERIAL_TOKENS,
  matchMaterials,
  prepareLexicon,
  readAvailability,
  readLeadTime,
  countVariants,
  type Lexicon,
} from '@/lib/scraper/normalization'

/**
 * Words on somebody else's page, matched against a vocabulary a person maintains.
 *
 * THE SUBSTRING TESTS ARE THE ONES WORTH HAVING. `ash` is inside `ashtray`, `oak` is inside
 * `oakum`, `cane` is inside `cane sugar` and `iron` is inside `ironing board`. A three-line
 * implementation using `includes` passes every other test in this file and turns a description
 * mentioning none of those materials into a row claiming all of them — and a material breakdown
 * built from it is confidently, invisibly wrong.
 *
 * THE LEXICON IS A FIXTURE HERE, WHICH IS THE POINT OF IT BEING DATA. `research_material_lexicon`
 * seeds forty terms and a person edits them in Studio; the normalizer never reads the table, so
 * every rule below runs against a table written in this file with no database at all.
 */

const LEXICON: Lexicon = [
  { token: 'oak', patterns: ['oak', 'white oak'], family: 'wood', isEnabled: true },
  { token: 'ash', patterns: ['ash', 'ash wood'], family: 'wood', isEnabled: true },
  { token: 'mango_wood', patterns: ['mango wood', 'mangowood'], family: 'wood', isEnabled: true },
  { token: 'steel', patterns: ['steel', 'mild steel'], family: 'metal', isEnabled: true },
  {
    token: 'stainless_steel',
    patterns: ['stainless steel', 'stainless'],
    family: 'metal',
    isEnabled: true,
  },
  { token: 'brass', patterns: ['brass'], family: 'metal', isEnabled: true },
  { token: 'rattan', patterns: ['rattan', 'cane'], family: 'natural', isEnabled: true },
  {
    token: 'epoxy_resin',
    patterns: ['epoxy', 'epoxy resin', 'resin'],
    family: 'resin',
    isEnabled: true,
  },
  { token: 'teak', patterns: ['teak'], family: 'wood', isEnabled: false },
]

describe('prepareLexicon', () => {
  it('drops disabled terms', () => {
    expect(prepareLexicon(LEXICON).some((entry) => entry.token === 'teak')).toBe(false)
  })

  it('sorts longest pattern first, so the specific term wins', () => {
    const patterns = prepareLexicon(LEXICON).map((entry) => entry.pattern)
    expect(patterns.indexOf('stainless steel')).toBeLessThan(patterns.indexOf('steel'))
  })
})

describe('matchMaterials', () => {
  it('matches a single term', () => {
    expect(matchMaterials(['Solid oak'], LEXICON).tokens).toEqual(['oak'])
  })

  it('matches several, in longest-pattern order', () => {
    const reading = matchMaterials(['Oak top with a brass base'], LEXICON)
    expect([...reading.tokens].sort()).toEqual(['brass', 'oak'])
  })

  it('DOES NOT MATCH A SUBSTRING INSIDE ANOTHER WORD', () => {
    /*
     * THE ASSERTION THIS MODULE IS THREE TIMES LONGER THAN IT LOOKS FOR. Every one of these is a
     * real English word a furniture page prints, and every one of them contains a material token.
     */
    for (const text of [
      'A glass ashtray',
      'Sealed with oakum',
      'A hurricane lamp',
      'An ironing board',
      'Steelworks Lane, Hackney',
    ]) {
      expect(matchMaterials([text], LEXICON).tokens, text).toEqual([])
    }
  })

  it('DOES match a lexicon word used in another sense, and that limit is the editor’s to fix', () => {
    /*
     * THE HONEST LIMIT OF A KEYWORD LEXICON, ASSERTED RATHER THAN GLOSSED. "Cane sugar bowl" is a
     * page about a bowl, and `cane` is a whole word in it, so `rattan` matches. Word boundaries
     * cannot tell the two senses apart — only context can, and nothing in this system reads
     * context.
     *
     * WHICH IS WHY THE LEXICON IS A TABLE WITH A STUDIO EDITOR RATHER THAN A LIST IN THIS FILE. A
     * source where this misfires is fixed by a person narrowing or disabling the pattern and
     * re-running `research:renormalize` over stored pages — no deploy, no re-fetch. The failure is
     * visible (a bowl listed as rattan, in the explorer, beside the words that produced it) and the
     * remedy is one screen away. Hiding it behind a cleverer matcher would make it invisible
     * instead of rare.
     */
    expect(matchMaterials(['Cane sugar bowl'], LEXICON).tokens).toEqual(['rattan'])
  })

  it('COUNTS "BRUSHED STAINLESS STEEL" ONCE, NOT TWICE', () => {
    // Matching both `stainless_steel` and `steel` double-counts the piece in every material
    // breakdown, and the breakdown is what a merchandiser reads to decide what Rivya should make.
    expect(matchMaterials(['Brushed stainless steel frame'], LEXICON).tokens).toEqual([
      'stainless_steel',
    ])
  })

  it('still matches plain steel when that is what the page says', () => {
    expect(matchMaterials(['Mild steel frame'], LEXICON).tokens).toEqual(['steel'])
  })

  it('matches a multi-word pattern across a hyphen', () => {
    expect(matchMaterials(['Mango-wood sideboard'], LEXICON).tokens).toEqual(['mango_wood'])
  })

  it('ignores a disabled term', () => {
    expect(matchMaterials(['Solid teak'], LEXICON).tokens).toEqual([])
  })

  it('reads an unmatched description as UNPARSED, not ABSENT', () => {
    // The page said something and Rivya did not recognise it. That gap is what the Studio lexicon
    // editor exists to close, and collapsing it into "the page said nothing" would hide it.
    const reading = matchMaterials(['Microcement over a birch core'], LEXICON)
    expect(reading.tokens).toEqual([])
    expect(reading.state).toBe('UNPARSED')
  })

  it('reads no description at all as ABSENT', () => {
    expect(matchMaterials([], LEXICON).state).toBe('ABSENT')
    expect(matchMaterials(['', ' '], LEXICON).state).toBe('ABSENT')
  })

  it('caps the token list, because past ten the text is a glossary', () => {
    const many: Lexicon = Array.from({ length: 20 }, (_entry, index) => ({
      token: `m${String(index)}`,
      patterns: [`material${String(index)}`],
      family: null,
      isEnabled: true,
    }))
    const text = many.map((entry) => entry.patterns[0]).join(' ')
    expect(matchMaterials([text], many).tokens.length).toBeLessThanOrEqual(MAX_MATERIAL_TOKENS)
  })

  it('never throws on hostile input', () => {
    const hostile: Lexicon = [
      { token: 'weird', patterns: ['a.*b', '(('], family: null, isEnabled: true },
    ]
    expect(() => matchMaterials(['aXXXb (('], hostile)).not.toThrow()
    // A pattern containing regex metacharacters is matched LITERALLY, not compiled as an
    // expression — otherwise a lexicon row typed in Studio is a regular expression an editor can
    // run against every stored description.
    expect(matchMaterials(['aXXXb'], hostile).tokens).toEqual([])
    expect(matchMaterials(['(('], hostile).tokens).toEqual(['weird'])
  })
})

describe('readAvailability', () => {
  it.each([
    ['In stock', 'IN_STOCK'],
    ['Ready to ship', 'IN_STOCK'],
    ['https://schema.org/InStock', 'IN_STOCK'],
    ['Made to order', 'MADE_TO_ORDER'],
    ['Bespoke — 8 weeks', 'MADE_TO_ORDER'],
    ['Pre-order', 'PREORDER'],
    ['Sold out', 'SOLD_OUT'],
    ['Discontinued', 'SOLD_OUT'],
  ])('reads %s as %s', (text, expected) => {
    expect(readAvailability(text).value).toBe(expected)
  })

  it('PREFERS THE SPECIFIC POSTURE WHEN A PAGE SAYS TWO THINGS', () => {
    // "Made to order — currently out of stock" means made to order. Alphabetical or first-match
    // ordering would read it as sold out, and the piece would drop out of every availability chart.
    expect(readAvailability('Made to order — currently out of stock').value).toBe('MADE_TO_ORDER')
  })

  it('reads nothing as ABSENT and something unrecognised as UNPARSED', () => {
    expect(readAvailability(null).state).toBe('ABSENT')
    expect(readAvailability('Ships when the moon is right').state).toBe('UNPARSED')
  })
})

describe('readLeadTime', () => {
  it('reads a range', () => {
    expect(readLeadTime('4–6 weeks')).toEqual({ minDays: 28, maxDays: 42, state: 'PARSED' })
  })

  it('reads a single duration', () => {
    expect(readLeadTime('Ships in 10 working days')).toEqual({
      minDays: 10,
      maxDays: null,
      state: 'PARSED',
    })
  })

  it('NEEDS A NUMBER AND A UNIT, and refuses anything short of both', () => {
    for (const text of ['Ships quickly', 'Short lead time', 'Made to order', '6', 'weeks']) {
      expect(readLeadTime(text).state, text).toBe('UNPARSED')
    }
  })

  it('refuses a backwards range rather than reading it either way round', () => {
    expect(readLeadTime('6–2 weeks').state).toBe('UNPARSED')
  })
})

describe('countVariants', () => {
  it('counts the list rather than parsing it', () => {
    expect(countVariants(['Oak', 'Walnut', 'Ash'])).toBe(3)
  })

  it('is null when the page offered none', () => {
    expect(countVariants([])).toBeNull()
    expect(countVariants(['', '  '])).toBeNull()
  })
})
