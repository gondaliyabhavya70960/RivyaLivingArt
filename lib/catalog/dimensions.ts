import { z } from 'zod'

/**
 * `products.dimensions` — the measurements a product may state, and nothing else.
 *
 * THREE COPIES OF THIS RULE EXIST AND THAT IS DELIBERATE, so this file says which is which. The
 * database holds `products_dimensions_shape` (0130) and refuses a malformed blob outright — that is
 * the one that holds when a script or a future import writes directly. `lib/catalog/validation.ts`
 * holds the imperative version that produces a readable message for an editor typing into the
 * Studio. This module holds the KEY LIST both of them read, and the parser the renderer uses, so
 * the three can disagree about wording but never about which measurements exist.
 *
 * THE UNIT IS PART OF THE KEY, and that is the whole no-inference rule in one decision. A value
 * stored under `length_mm` is millimetres, is displayed in millimetres, and is never converted to
 * inches or centimetres for anyone's convenience. The alternative — a number plus a separate unit
 * field — invites exactly the conversion the phase document forbids, because once two units are
 * expressible something will eventually normalise them.
 *
 * `seats` is the one key with no unit. It is a count, it is not a measurement, and it renders as a
 * bare number rather than acquiring a fake one.
 */

export const DIMENSION_KEYS = [
  'length_mm',
  'width_mm',
  'height_mm',
  'depth_mm',
  'diameter_mm',
  'weight_g',
  'seats',
] as const

export type DimensionKey = (typeof DIMENSION_KEYS)[number]

/**
 * The unit each key is measured in, or null for a count.
 *
 * Not derived from the key's suffix by string surgery: `seats` would need a special case anyway,
 * and a table that must be read to be understood is better than a rule that must be inferred.
 */
export const DIMENSION_UNIT: Readonly<Record<DimensionKey, string | null>> = {
  length_mm: 'mm',
  width_mm: 'mm',
  height_mm: 'mm',
  depth_mm: 'mm',
  diameter_mm: 'mm',
  weight_g: 'g',
  seats: null,
}

/**
 * A metre and a half of table is 1500; a hundred metres is a data-entry slip, not a product. The
 * database does not enforce this ceiling — it only refuses non-positive values — because "absurd"
 * is a judgement rather than a shape, and the place to argue with an editor about it is the form.
 */
export const MAX_DIMENSION = 100_000

const measurement = z
  .number()
  .finite()
  .positive()
  .max(MAX_DIMENSION)
  .refine((n) => !Number.isNaN(n), { message: 'not a number' })

/**
 * STRICT, so an unknown key is an error rather than a silently ignored field. A dimensions blob
 * carrying `length_inches` must fail loudly here and at the database, because a renderer that meets
 * a unit it cannot label has only bad options: drop it, guess at it, or print a raw key.
 *
 * Every key is optional. A product that states only its height states only its height — the absent
 * keys produce no rows at all, which is what the specification block needs.
 */
export const dimensionsSchema = z.strictObject({
  length_mm: measurement.optional(),
  width_mm: measurement.optional(),
  height_mm: measurement.optional(),
  depth_mm: measurement.optional(),
  diameter_mm: measurement.optional(),
  weight_g: measurement.optional(),
  seats: z.number().int().positive().max(MAX_DIMENSION).optional(),
})

export type Dimensions = z.infer<typeof dimensionsSchema>

/** One rendered measurement: the key to look a label up by, the number, and its unit. */
export type DimensionEntry = {
  readonly key: DimensionKey
  readonly value: number
  readonly unit: string | null
}

/**
 * The measurements a product actually states, in `DIMENSION_KEYS` order.
 *
 * RETURNS AN EMPTY ARRAY RATHER THAN THROWING for anything malformed, including a blob the database
 * would have refused. The specification block's contract is that it renders owner-entered facts and
 * nothing else; a row it cannot trust is not a row it should improvise around, and an exception
 * here would cost a visitor the whole page over one bad key.
 *
 * The caller renders NOTHING when this is empty — no heading, no empty table, no "dimensions on
 * request".
 */
export function dimensionEntries(value: unknown): readonly DimensionEntry[] {
  const parsed = dimensionsSchema.safeParse(value)
  if (!parsed.success) return []

  return DIMENSION_KEYS.flatMap((key) => {
    const measured = parsed.data[key]
    return measured === undefined ? [] : [{ key, value: measured, unit: DIMENSION_UNIT[key] }]
  })
}
