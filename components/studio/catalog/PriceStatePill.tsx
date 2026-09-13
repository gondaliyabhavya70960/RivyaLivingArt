import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { t, type StudioStringKey } from '@/components/studio/strings'
import type { Database } from '@/lib/supabase/database.types'

type PriceState = Database['public']['Enums']['price_state']

/**
 * How a product's price state reads in a Studio list.
 *
 * "RFQ IS A PILL, NOT A BLANK" — §9's line for Phase D, and the defect it names is specific. A
 * product priced `REQUEST_QUOTE` has no number, so a price column that renders the number renders
 * nothing, and an empty cell in a table is indistinguishable from a cell somebody forgot to fill
 * in. Across a catalogue where MOST rows are request-for-quote — which is what this business sells
 * — a whole column of blanks reads as a broken import rather than as a deliberate commercial
 * decision.
 *
 * EVERY STATE IS A PILL, INCLUDING THE TWO THAT HAVE A NUMBER. Showing the word only for the
 * numberless states would make "request a quote" look like the exception it is not, and the reader
 * would still have to know which states carry a figure to interpret the column. The number, when
 * there is one, is the list page's business rather than this component's.
 *
 * TONES SAY "SETTLED" OR "A CONVERSATION", NOT "GOOD" OR "BAD". A fixed price is a decision the
 * studio has made and can be read at a glance; `STARTING_FROM` is a decision with a caveat;
 * the two request states are an invitation to talk, which is the whole conversion model this
 * product is built around and is not a deficiency. None of them is `danger`: there is no wrong
 * answer here, only a different kind of answer.
 */
const TONE: Record<PriceState, BadgeTone> = {
  FIXED: 'success',
  STARTING_FROM: 'info',
  REQUEST_QUOTE: 'neutral',
  PRICE_ON_REQUEST: 'neutral',
}

export function PriceStatePill({ state }: { readonly state: PriceState }) {
  return (
    <Badge tone={TONE[state]} data-price-state={state}>
      {t(`studio.catalog.priceState.${state}` as StudioStringKey)}
    </Badge>
  )
}
