import type { MediaRef, TransformSpec } from './types'
import { imageUrl, posterUrl } from './url'

/**
 * Poster policy, and its other half: when a video is allowed to play instead of showing one.
 *
 * These two live together because they are one decision. A poster is not a loading placeholder —
 * it is what the visitor sees whenever the video does not autoplay, which per FEAT §14 and §46 is
 * a case the site is expected to hit routinely (reduced motion, a long clip, a missing duration).
 * Splitting them across two modules would let the rules drift until a surface autoplays a video it
 * has no poster for, or renders a poster with no way to start the video.
 */

/** The minimum a poster decision needs to know about a video asset. */
export type PosterSubject = {
  /** The video's own Cloudinary public_id. */
  readonly publicId: string
  /** A separately uploaded poster image, when an editor chose one. Null otherwise. */
  readonly posterPublicId: string | null
  /** Pins the derived frame to one upload of the video. */
  readonly version?: number
}

export type PosterDecision = {
  readonly ref: MediaRef
  /**
   * `explicit` — an editor uploaded a still and it is delivered as an ordinary image.
   * `derived`  — the video's own first frame, transcoded by Cloudinary.
   */
  readonly origin: 'explicit' | 'derived'
}

/**
 * Which image to use as a video's poster.
 *
 * An explicit `poster_public_id` always wins, and the reason is editorial rather than technical:
 * the first frame of a video is frequently the worst frame of it — a fade from black, a hand still
 * entering the shot. When an editor has chosen a still, they have chosen it precisely because
 * frame zero was not good enough, so falling back to frame zero for any reason would override a
 * decision somebody made deliberately.
 *
 * There is no third branch. A video always has a first frame, so this cannot fail to produce a
 * poster — which is what lets `MediaVideo` render one unconditionally rather than carrying an
 * empty state nobody has designed.
 */
export function posterFor(video: PosterSubject): PosterDecision {
  if (video.posterPublicId !== null && video.posterPublicId !== '') {
    return {
      ref: { publicId: video.posterPublicId, resourceType: 'image' },
      origin: 'explicit',
    }
  }
  return {
    ref: {
      publicId: video.publicId,
      resourceType: 'video',
      ...(video.version === undefined ? {} : { version: video.version }),
    },
    origin: 'derived',
  }
}

/**
 * The poster's delivery URL, dispatching on where it came from.
 *
 * The dispatch is the point: an explicit poster is an image resource and a derived one is a frame
 * pulled out of a video resource, and Cloudinary serves those from two different namespaces. A
 * caller that built the URL itself would get this wrong in exactly one of the two cases, and only
 * for assets where an editor had bothered to upload a still.
 */
export function posterUrlFor(
  cloudName: string,
  video: PosterSubject,
  spec: TransformSpec = {},
): string {
  const decision = posterFor(video)
  return decision.origin === 'explicit'
    ? imageUrl(cloudName, decision.ref, spec)
    : posterUrl(cloudName, decision.ref, spec)
}

/**
 * The longest clip that may autoplay inline, in seconds (FEAT §14).
 *
 * All 26 manifest videos run 5–10 s, so the ceiling excludes nothing that exists today. It is
 * here for what comes later: the first 40-second walkthrough somebody uploads would otherwise
 * autoplay in a card and loop forever behind the text.
 */
export const MAX_AUTOPLAY_SECONDS = 12

export type AutoplayConditions = {
  /** Null when the probe has not run yet, which is treated as "unknown", not as "short". */
  readonly durationSeconds: number | null
  /** True when the visitor's OS asks for reduced motion. */
  readonly prefersReducedMotion: boolean
}

/**
 * Whether a video may autoplay inline.
 *
 * FEAT §14: muted, `playsInline`, under 12 s, and only under `prefers-reduced-motion:
 * no-preference`. Muting and `playsInline` are properties of how `MediaVideo` renders the element
 * and are not decided here; what this function answers is the part that depends on the asset and
 * the visitor.
 *
 * AN UNKNOWN DURATION DOES NOT AUTOPLAY. `duration_s` is null until `probe()` has run, and the
 * tempting reading — "no duration recorded, so probably a short clip" — gets it backwards: an
 * unprobed asset is most likely one that was just uploaded, which is exactly when nobody has
 * checked how long it is.
 */
export function mayAutoplayInline(conditions: AutoplayConditions): boolean {
  if (conditions.prefersReducedMotion) return false
  if (conditions.durationSeconds === null) return false
  return conditions.durationSeconds > 0 && conditions.durationSeconds <= MAX_AUTOPLAY_SECONDS
}
