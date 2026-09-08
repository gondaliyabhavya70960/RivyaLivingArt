import type { AspectRatio, TransformSpec } from './types'

/**
 * How a delivery URL is built. Provider-independent: this module produces the *decision*
 * (which width, which crop, which ratio, which quality), and the provider turns it into a URL.
 *
 * THE PRESET TABLE AND THE LADDER ARE THE PHASE DOCUMENT'S, NOT AN OPINION. PHASE-05-09.md §06
 * "Transformation policy" fixes six presets and their exact transformation strings, and a separate
 * width ladder for `srcSet()`. An earlier draft of this file invented a different set — five
 * presets on a ten-rung ladder — which was wrong in a way worth recording: SECURITY.md §7.2 refers
 * to "the Phase 06 `og` preset's output size" when telling the owner what to supply for a default
 * social card, and that draft had no `og` preset at all. A specification that other documents
 * already cite is not a starting point to improve on.
 *
 * ONE WIDTH LADDER FOR THE WHOLE PRODUCT. Continuous widths look flexible and are a cache
 * disaster: every distinct width is a separate derived asset Cloudinary generates and stores, so a
 * layout that asks for 1013px on one viewport and 1014px on another pays twice for the same
 * picture. A fixed ladder means a handful of derivations serve every viewport.
 *
 * The rungs bracket the eight FEAT §45 QA widths (360, 390, 430, 768, 1024, 1280, 1440, 1920) so
 * each is served by a rung at or just above it, never by one scaled up. Delivery stops at 2560
 * even though manifest sources reach 6336px wide.
 */
export const WIDTH_LADDER = [320, 480, 640, 768, 1024, 1280, 1536, 1920, 2560] as const

/** Ratios as numbers, for computing the height a crop implies. Keys are D6's eight. */
const RATIO_VALUE: Record<AspectRatio, number> = {
  '21:9': 21 / 9,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '1:1': 1,
  '4:5': 4 / 5,
  '3:4': 3 / 4,
  '9:16': 9 / 16,
}

export const ASPECT_RATIOS = Object.keys(RATIO_VALUE) as readonly AspectRatio[]

/**
 * The six named presets, so a call site says what the image IS rather than how big it should be.
 *
 * The alternative — `width={1600} crop="fill"` at every call site — means changing the hero
 * treatment is a search across the codebase, and means two heroes drift apart without anyone
 * deciding they should.
 *
 * NONE OF THEM CARRIES A RATIO, and that is deliberate rather than an omission. The phase
 * document's transformations are `c_fill,g_auto,w_<n>` — a width and a smart crop, letting the
 * source keep its own shape. A ratio is a per-call decision made by the box the image lands in,
 * which is why it arrives through `ratioCrop()` or a `resolveSpec` override. `og` is the one
 * exception: a social card is 1200 × 630 by external specification, not by layout.
 *
 * PRESET WIDTHS AND THE LADDER ARE INDEPENDENT SETS, and three of the six presets sit off the
 * ladder (160, 1200, 1600). That is not a discrepancy to reconcile: the ladder is the `srcSet()`
 * ladder — the widths a RESPONSIVE image offers the browser to choose between — while a preset
 * width is one fixed delivery size for a box that never negotiates. A 160px Studio table row and
 * a 1200px social card are both exactly one derivation.
 *
 * An earlier draft added 160 to the ladder so that preset and ladder would agree. That had it
 * backwards twice over: it would have put a rung on every responsive image's srcset that no layout
 * would ever pick, and it only "fixed" one of the three cases anyway.
 */
export const PRESETS = {
  /** Studio table rows. `q_auto:eco` because a 160px row is not where quality is noticed. */
  thumb: { width: 160, crop: 'fill', gravity: 'auto', format: 'auto', quality: 'auto:eco' },
  /** Product and collection cards. */
  card: { width: 480, crop: 'fill', gravity: 'auto', format: 'auto', quality: 'auto:good' },
  /** Gallery grids. */
  grid: { width: 768, crop: 'fill', gravity: 'auto', format: 'auto', quality: 'auto:good' },
  /** Section heroes. */
  hero: { width: 1600, crop: 'fill', gravity: 'auto', format: 'auto', quality: 'auto:good' },
  /** Full-bleed 21:9 heroes. The ratio comes from the slot, not from here. */
  'hero-xl': { width: 2560, crop: 'fill', gravity: 'auto', format: 'auto', quality: 'auto:good' },
  /**
   * Social cards. `f_jpg` and NOT `f_auto`: format negotiation depends on an `Accept` header, and
   * the crawlers that fetch an OG image do not send a useful one. A WebP served to a scraper that
   * wanted JPEG is a card that does not render.
   */
  og: {
    width: 1200,
    height: 630,
    crop: 'fill',
    gravity: 'auto',
    format: 'jpg',
    quality: 'auto:good',
  },
} as const satisfies Record<string, TransformSpec>

export type PresetName = keyof typeof PRESETS

/**
 * The same presets, widened to `TransformSpec`.
 *
 * `PRESETS` is `as const satisfies`, which keeps the KEYS literal — that is what makes `PresetName`
 * a union of real names rather than `string`. The cost is that each entry's type is its own literal
 * shape, so `og` (the only one with a `height`) makes the union non-uniform and a consumer
 * iterating the presets cannot read a field off one.
 *
 * The same trade-off, and the same fix, as `TABLE_POLICY_MAP` in lib/auth/table-permissions.ts.
 */
export const PRESET_MAP: Record<PresetName, TransformSpec> = PRESETS

/**
 * Snap a requested width UP to the nearest rung.
 *
 * Up rather than down, and never past the top: serving 480px into a 500px box is a visibly soft
 * image, while serving 640 into 500 is invisible. Above the ladder's top the largest rung is used
 * — a 4K hero is not worth a bespoke derivation, and the source may not be that wide anyway.
 */
export function snapWidth(requested: number): number {
  const top = WIDTH_LADDER[WIDTH_LADDER.length - 1] ?? 2560
  if (!Number.isFinite(requested) || requested <= 0) return WIDTH_LADDER[0] ?? 320
  return WIDTH_LADDER.find((rung) => rung >= requested) ?? top
}

/** The height a ratio implies at a width. Rounded, because a fractional pixel is not a size. */
export function heightFor(width: number, ratio: AspectRatio): number {
  return Math.round(width / RATIO_VALUE[ratio])
}

/**
 * Thrown when a caller asks for a ratio outside D6's eight.
 *
 * The phase document says "any other ratio throws", and it is right to: the alternative is
 * silently falling back to the source's own shape, which produces a picture that does not fill
 * the box it was placed in and looks like a CSS bug rather than a bad argument.
 */
export class UnsupportedRatioError extends Error {
  readonly kind = 'unsupported-ratio' as const
  constructor(readonly ratio: string) {
    super(
      `Unsupported aspect ratio "${ratio}". D6 fixes eight: ${ASPECT_RATIOS.join(', ')}. ` +
        'Add one to CANONICAL-DECISIONS.md D6 before using it.',
    )
    this.name = 'UnsupportedRatioError'
  }
}

/**
 * Resolve a ratio crop to concrete pixel dimensions, snapping the width to the ladder first.
 *
 * Returns both dimensions rather than a ratio string because the provider needs `w_` and `h_`,
 * and because the caller usually needs the height too — to reserve the box before the image
 * loads, which is the whole of the CLS budget.
 */
export function ratioCrop(width: number, ratio: AspectRatio): { width: number; height: number } {
  if (!Object.hasOwn(RATIO_VALUE, ratio)) throw new UnsupportedRatioError(ratio)
  const snapped = snapWidth(width)
  return { width: snapped, height: heightFor(snapped, ratio) }
}

/**
 * Cap the device pixel ratio at 3.
 *
 * Phones report up to 4. The difference between 3× and 4× is not perceptible at arm's length and
 * costs ~78% more pixels — which on a mobile connection is the whole point of the image budget.
 * Below 1 is meaningless and is treated as 1.
 */
export function clampDpr(dpr: number | undefined): number {
  if (dpr === undefined || !Number.isFinite(dpr)) return 1
  return Math.min(3, Math.max(1, Math.round(dpr * 2) / 2))
}

/**
 * The widths a `srcset` should offer for a box of this CSS width.
 *
 * Every rung from the smallest that can serve the box up to twice it — 2× covers a Retina display
 * without offering a 4× rung no layout will ever pick. Returning more rungs than that inflates the
 * attribute on every page for no visible gain.
 */
export function srcSet(boxWidth: number): number[] {
  const smallest = snapWidth(boxWidth)
  const ceiling = snapWidth(boxWidth * 2)
  return WIDTH_LADDER.filter((rung) => rung >= smallest && rung <= ceiling)
}

/**
 * Resolve a preset name and per-call overrides into one spec. Overrides win.
 *
 * A `ratio` override is resolved here rather than left to the provider, so an unsupported ratio
 * throws at the call site that asked for it instead of producing a URL nobody checks.
 *
 * THE WIDTH IS NOT SNAPPED HERE, and the first version of this function got that wrong. A preset
 * width is a deliberate fixed size, and three of the six do not sit on the ladder (160, 1200,
 * 1600); running them through `snapWidth` turned `hero` into 1920 and `thumb` into 320, so the
 * preset delivered something other than what its own table entry promised. Snapping is for a
 * width a LAYOUT asked for — `ratioCrop` and `srcSet` — not for one this module chose.
 */
export function resolveSpec(preset: PresetName, overrides: TransformSpec = {}): TransformSpec {
  const merged: TransformSpec = { ...PRESET_MAP[preset], ...overrides }
  if (merged.ratio === undefined) return merged
  if (!Object.hasOwn(RATIO_VALUE, merged.ratio)) throw new UnsupportedRatioError(merged.ratio)
  const width = merged.width ?? (WIDTH_LADDER[0] as number)
  return { ...merged, width, height: heightFor(width, merged.ratio) }
}
