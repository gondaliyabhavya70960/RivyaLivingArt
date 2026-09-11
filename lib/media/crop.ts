import type { AspectRatio } from '@/lib/media/types'

/**
 * A STORED CROP, TURNED INTO THE ONE TRANSFORMATION COMPONENT THAT MUST COME FIRST — Phase 43.
 *
 * THE ORDER IS THE WHOLE POINT. Cloudinary applies transformation components left to right, so
 * `c_crop,…/c_fill,w_480` means "take this box out of the master, then fill a 480px card with it".
 * Reversed, the preset would resize the master first and the box would name pixels that no longer
 * exist — a crop that lands somewhere else at every width on the ladder. That is why this returns a
 * PREFIX rather than merging into `TransformSpec`: a merged spec would emit one flat component and
 * the ordering would be silently lost.
 *
 * WHY THE BOX IS IN SOURCE PIXELS. It is what the editor was looking at, and it is what Cloudinary
 * measures `c_crop` against. Storing delivered pixels would make the crop depend on which rung of
 * the width ladder a visitor happened to request.
 *
 * TWO KINDS OF CROP, AND THE DIFFERENCE IS NOT COSMETIC. An explicit box is "these pixels": exact,
 * repeatable, and right when the editor can see the subject and the edges. A gravity is "keep this
 * part while you crop to this ratio": right when one master serves several ratios and the subject
 * should stay centred in each. `media_crops_box_or_gravity` refuses a row that is neither, so this
 * module never has to invent a default — which is the failure it exists to prevent, because a
 * silent centre crop looks like a decision somebody made.
 *
 * IT IS A PURE FUNCTION OVER A ROW. No client, no network, no Cloudinary SDK. The Studio's crop
 * editor previews with the same function the public renderer delivers with, so what an editor sees
 * is what a visitor gets.
 */

export interface MediaCropRow {
  readonly aspect_ratio: string
  readonly x: number | null
  readonly y: number | null
  readonly width: number | null
  readonly height: number | null
  readonly gravity: string | null
}

/** A crop indexed by the ratio it serves, which is how a renderer asks for one. */
export type CropsByRatio = ReadonlyMap<string, MediaCropRow>

export function cropsByRatio(rows: readonly MediaCropRow[]): CropsByRatio {
  // Last write wins, though the unique constraint means there is never a second row for a ratio.
  return new Map(rows.map((row) => [row.aspect_ratio, row]))
}

/**
 * The `c_crop` component for one stored crop, or null when the row says nothing usable.
 *
 * NULL RATHER THAN A FALLBACK. A caller that gets null delivers the master uncropped, which is the
 * honest answer: no editor chose anything for this ratio. Returning a guessed centre crop would put
 * a decision nobody made in front of a visitor and make the missing row invisible.
 *
 * THE PARAMETERS ARE SORTED, like every other segment this codebase emits, so the same crop always
 * produces the same URL and therefore the same CDN cache entry.
 */
export function cropSegment(crop: MediaCropRow): string | null {
  if (crop.width !== null && crop.height !== null && crop.x !== null && crop.y !== null) {
    return [
      'c_crop',
      `h_${String(crop.height)}`,
      `w_${String(crop.width)}`,
      `x_${String(crop.x)}`,
      `y_${String(crop.y)}`,
    ]
      .sort()
      .join(',')
  }

  if (crop.gravity !== null && crop.gravity !== '') {
    /*
     * `ar_` IS REQUIRED HERE AND THE BOX FORM DOES NOT TAKE IT. A gravity crop with no dimensions
     * asks Cloudinary to crop to *nothing*; the ratio is what gives it a shape to crop to. The box
     * form already states its shape in `w_`/`h_`, and adding `ar_` there would be a second,
     * conflicting answer.
     */
    return ['c_crop', `ar_${crop.aspect_ratio}`, `g_${crop.gravity}`].sort().join(',')
  }

  return null
}

/**
 * The crop that serves this ratio, if an editor stored one.
 *
 * NO NEAREST-RATIO FALLBACK, deliberately. A 4:5 crop is not a 9:16 crop with rounding — it is a
 * different decision about what may be cut — and quietly substituting one would deliver a subject
 * the editor never approved for that shape while the Studio showed the ratio as uncovered.
 */
export function cropFor(crops: CropsByRatio, ratio: AspectRatio): MediaCropRow | undefined {
  return crops.get(ratio)
}

/** True when the box falls inside a source of these dimensions. */
export function boxFitsSource(
  crop: MediaCropRow,
  source: { readonly width: number; readonly height: number },
): boolean {
  if (crop.width === null || crop.height === null || crop.x === null || crop.y === null) {
    // A gravity crop has no box to fall outside of; Cloudinary computes it against the real source.
    return true
  }
  return (
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width > 0 &&
    crop.height > 0 &&
    crop.x + crop.width <= source.width &&
    crop.y + crop.height <= source.height
  )
}

/**
 * How far the stored box departs from the ratio it claims to serve, as a fraction.
 *
 * ADVISORY, NOT A REFUSAL. A box a few pixels off its nominal ratio delivers a nearly-right shape
 * and Cloudinary's preset squares it up; a box at 16:9 filed under 9:16 is somebody's mistake and
 * worth showing them. The Studio renders this as a warning beside the crop rather than blocking a
 * save, because the editor is looking at the picture and this function is not.
 */
export function ratioDrift(crop: MediaCropRow, ratio: AspectRatio): number | null {
  if (crop.width === null || crop.height === null || crop.height === 0) return null
  const [w, h] = ratio.split(':').map(Number)
  if (w === undefined || h === undefined || h === 0) return null
  const target = w / h
  const actual = crop.width / crop.height
  return Math.abs(actual - target) / target
}
