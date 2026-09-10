import type { ParseState, ResearchAvailability } from './schema'

/**
 * Stock posture and lead time — two fields a furniture page states in prose, if at all.
 *
 * ORDER OF TESTING IS THE SEMANTICS, AND IT IS NOT ALPHABETICAL. "Made to order — currently out of
 * stock" is a real sentence and it means made to order; "in stock, ships in 2 weeks" is in stock.
 * So the more specific posture is tested first and the generic `in stock` last, because a page that
 * says both is telling you the specific one.
 *
 * A LEAD TIME NEEDS A NUMBER **AND** A UNIT. "Ships quickly", "short lead time" and "made to order"
 * are not durations, and turning one into a number would put a figure into a comparison table that
 * the source never quoted. A range — "4–6 weeks" — is stored as a range, because that is what was
 * said.
 */

interface Posture {
  readonly value: ResearchAvailability
  readonly phrases: readonly string[]
}

/** Most specific first. See the header — a page that says two things is telling you the first. */
const POSTURES: readonly Posture[] = [
  {
    value: 'MADE_TO_ORDER',
    phrases: [
      'made to order',
      'made-to-order',
      'make to order',
      'built to order',
      'bespoke',
      'custom order',
      'commission',
      'on order',
    ],
  },
  {
    value: 'PREORDER',
    phrases: [
      'pre-order',
      'preorder',
      'pre order',
      'coming soon',
      'available from',
      'back in stock on',
    ],
  },
  {
    value: 'SOLD_OUT',
    phrases: [
      'sold out',
      'out of stock',
      'outofstock',
      'unavailable',
      'discontinued',
      'no longer available',
      'backorder',
      'back-order',
    ],
  },
  {
    value: 'IN_STOCK',
    phrases: ['in stock', 'instock', 'available now', 'ready to ship', 'ships today', 'in-stock'],
  },
]

export interface AvailabilityReading {
  readonly value: ResearchAvailability
  readonly state: ParseState
}

export function readAvailability(text: string | null): AvailabilityReading {
  if (text === null || text.trim() === '') return { value: 'UNKNOWN', state: 'ABSENT' }

  // schema.org writes `https://schema.org/InStock`; the words are the same once the case and the
  // punctuation are gone, so one table serves prose and markup rather than two that drift.
  const haystack = text
    .toLowerCase()
    .replace(/[_/]/gu, ' ')
    .replace(/([a-z])([A-Z])/gu, '$1 $2')

  for (const posture of POSTURES) {
    if (posture.phrases.some((phrase) => haystack.includes(phrase))) {
      return { value: posture.value, state: 'PARSED' }
    }
  }

  return { value: 'UNKNOWN', state: 'UNPARSED' }
}

export interface LeadTimeReading {
  readonly minDays: number | null
  readonly maxDays: number | null
  readonly state: ParseState
}

const DAYS_PER_UNIT: ReadonlyMap<string, number> = new Map([
  ['day', 1],
  ['days', 1],
  ['working day', 1],
  ['working days', 1],
  ['business day', 1],
  ['business days', 1],
  ['week', 7],
  ['weeks', 7],
  ['month', 30],
  ['months', 30],
])

/**
 * A month is thirty days here, and that is an approximation this module is allowed to make.
 *
 * IT IS NOT THE SAME KIND OF GUESS AS A UNIT. "8–12 weeks" and "2–3 months" are both statements
 * about roughly how long, made by a source that is itself estimating; converting between them
 * changes nothing anybody would act on. Inferring that `120` means centimetres, by contrast,
 * invents a fact the page never stated. The line is whether the source was precise to begin with.
 */
const LEAD_TIME =
  /(\d{1,3})(?:\s*(?:[-–—]|\bto\b)\s*(\d{1,3}))?\s*(working days|business days|working day|business day|days|day|weeks|week|months|month)\b/iu

export function readLeadTime(text: string | null): LeadTimeReading {
  if (text === null || text.trim() === '') return { minDays: null, maxDays: null, state: 'ABSENT' }

  const match = LEAD_TIME.exec(text)
  if (match === null) {
    // A number with no unit, or a unit with no number, or "ships quickly". All the same answer:
    // the page did not state a duration Rivya can compare.
    return { minDays: null, maxDays: null, state: 'UNPARSED' }
  }

  const perUnit = DAYS_PER_UNIT.get((match[3] ?? '').toLowerCase())
  if (perUnit === undefined) return { minDays: null, maxDays: null, state: 'UNPARSED' }

  const min = Number(match[1]) * perUnit
  const max = match[2] === undefined ? null : Number(match[2]) * perUnit

  if (!Number.isFinite(min) || min < 0 || min > 3_650) {
    return { minDays: null, maxDays: null, state: 'UNPARSED' }
  }
  if (max !== null && (!Number.isFinite(max) || max < min || max > 3_650)) {
    // "6–2 weeks" is a typo on the page, not a range. Reading it either way round would be an
    // invention; reading it as unparsed is the truth.
    return { minDays: null, maxDays: null, state: 'UNPARSED' }
  }

  return { minDays: min, maxDays: max, state: 'PARSED' }
}

/**
 * How many variants the page offered.
 *
 * A COUNT OF THE LIST, NOT A PARSE OF ITS CONTENTS. What Phase 31 asks is "does this competitor
 * offer choice on this piece", and the answer is a number. Parsing "Oak / Walnut / Ash" into a
 * structured option set is a different question, needs a per-source configuration nobody has
 * written, and is not this phase's.
 */
export function countVariants(variantTexts: readonly string[]): number | null {
  const entries = variantTexts.map((text) => text.trim()).filter((text) => text !== '')
  return entries.length === 0 ? null : entries.length
}
