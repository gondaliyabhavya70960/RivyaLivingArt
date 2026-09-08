import type { AspectRatio, TransformSpec } from './types'

/**
 * How a delivery URL is built. Provider-independent: this module produces the *decision*
 * (which width, which crop, which ratio), and the provider turns it into a URL.
 *
 * ONE WIDTH LADDER FOR THE WHOLE PRODUCT. Continuous widths look flexible and are a cache
 * disaster: every distinct width is a separate derived asset Cloudinary generates and stores, so a
 * layout that asks for 1013px on one viewport and 1014px on another pays twice for the same
 * picture. A fixed ladder means a handful of derivations serve every viewport.
 *
 * The rungs are not arbitrary — they bracket the eight FEAT §45 QA widths (360, 390, 430, 768,
 * 1024, 1280, 1440, 1920) so that each one is served by a rung at or just above it, never by one
 * scaled up.
 *
 * 160 IS ON THE LADDER BECAUSE THE `thumb` PRESET ASKS FOR IT. The first draft started at 320, and
 * a test comparing every preset's width against the ladder caught the mismatch: a 160px picker
 * thumbnail would have snapped up to 320 and quietly cost four times the pixels on every row of a
 * media table. The ladder's job is to cover the sizes this product actually renders, so the ladder
 * moved rather than the preset.
 */
export const WIDTH_LADDER = [160, 320, 480, 640, 828, 1080, 1280, 1600, 1920, 2560] as const

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

/**
 * Named presets, so a call site says what the image IS rather than how big it should be.
 *
 * The alternative — `width={1280} ratio="16:9"` at every call site — means changing the hero
 * treatment is a search across the codebase, and means two heroes drift apart without anyone
 * deciding they should.
 */
export const PRESETS = {
  /** Full-bleed page hero. Ultra-wide on desktop; the mobile slot is a separate CMS field (D6). */
  hero: { width: 1920, ratio: '21:9', crop: 'fill', gravity: 'auto' },
  /** Card in a grid — products, collections, journal. */
  card: { width: 640, ratio: '4:5', crop: 'fill', gravity: 'auto' },
  /** A product's main image on its own page. */
  detail: { width: 1280, ratio: '4:3', crop: 'fill', gravity: 'auto' },
  /** Small square, for a picker or a table row. */
  thumb: { width: 160, ratio: '1:1', crop: 'fill', gravity: 'auto' },
  /** Editorial image inside prose: keep the photographer's shape. */
  editorial: { width: 1080, crop: 'fit' },
} as const satisfies Record<string, TransformSpec>

export type PresetName = keyof typeof PRESETS

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
export function srcSetWidths(boxWidth: number): number[] {
  const smallest = snapWidth(boxWidth)
  const ceiling = snapWidth(boxWidth * 2)
  return WIDTH_LADDER.filter((rung) => rung >= smallest && rung <= ceiling)
}

/** Resolve a preset name and per-call overrides into one spec. Overrides win. */
export function resolveSpec(preset: PresetName, overrides: TransformSpec = {}): TransformSpec {
  return { ...PRESETS[preset], ...overrides }
}
