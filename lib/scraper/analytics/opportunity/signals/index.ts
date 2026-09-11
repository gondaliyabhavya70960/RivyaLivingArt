import { SIGNAL_KEYS, type SignalKey } from '../model'
import { assortmentDensity } from './assortment-density'
import { categoryGap } from './category-gap'
import { changeVelocity } from './change-velocity'
import { customisationSignal } from './customisation-signal'
import { largeFormatFit } from './large-format-fit'
import { materialAdjacency } from './material-adjacency'
import { priceBandGap } from './price-band-gap'
import type { Signal } from './types'

/** The seven, keyed. `tests/unit/opportunity-signals.test.ts` asserts this covers SIGNAL_KEYS exactly. */
export const SIGNALS: Readonly<Record<SignalKey, Signal>> = {
  category_gap: categoryGap,
  large_format_fit: largeFormatFit,
  price_band_gap: priceBandGap,
  assortment_density: assortmentDensity,
  change_velocity: changeVelocity,
  customisation_signal: customisationSignal,
  material_adjacency: materialAdjacency,
}

export const SIGNAL_LIST: readonly Signal[] = SIGNAL_KEYS.map((key) => SIGNALS[key])

export type { Signal, SignalOutcome } from './types'
