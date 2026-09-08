import { clampDpr, heightFor } from './transform'
import type { MediaRef, TransformSpec, VideoTransformSpec } from './types'

/**
 * Cloudinary delivery URLs, built by hand.
 *
 * WHY THIS IS A SEPARATE FILE FROM `providers/cloudinary.ts`. The phase document says only
 * `providers/cloudinary.ts` may import the Cloudinary SDK, and that file is `server-only` because
 * it holds the API secret. But a URL is not a secret: `MediaVideo` is a Client Component by
 * specification, and the uploader needs to show a thumbnail of the file it has just uploaded. If
 * URL construction lived behind the server boundary, either those components could not render
 * media or the secret-holding module would end up in a client bundle.
 *
 * So: this module is client-safe, imports no SDK, and needs nothing but the public cloud name.
 * `providers/cloudinary.ts` delegates its three URL methods here, which keeps the single-home
 * property `types.ts` argues for — every URL in the product still comes from one implementation.
 *
 * WHY NOT THE SDK'S URL BUILDER. It would pull the whole SDK — Node crypto, HTTP client and all —
 * into any bundle that renders an image, to concatenate a string. It also emits parameters in an
 * order that has changed between versions, and a delivery URL that changes shape invalidates every
 * CDN cache entry for the same picture.
 */

const DELIVERY_HOST = 'https://res.cloudinary.com'

/**
 * A public_id is a path within the account, and it lands in a URL path segment.
 *
 * Cloudinary treats `/` as a folder separator, so it is NOT encoded. Everything else that would
 * change how the path parses — a `?`, a `#`, a space — is. `encodeURIComponent` would escape the
 * slashes too and produce a 404 for every foldered asset, which is why this is per-segment.
 */
function encodePublicId(publicId: string): string {
  return publicId.split('/').map(encodeURIComponent).join('/')
}

/**
 * The transformation segment, in a FIXED parameter order.
 *
 * Order is deliberate and alphabetical-by-Cloudinary-convention rather than insertion-ordered:
 * `c_fill,w_480` and `w_480,c_fill` are the same transformation but two different URLs, so two
 * cache entries, two derived assets and two bills for one picture.
 */
function transformationSegment(spec: TransformSpec, extra: readonly string[] = []): string {
  const parts: string[] = [...extra]

  if (spec.crop !== undefined) parts.push(`c_${spec.crop}`)
  if (spec.format !== undefined) parts.push(`f_${spec.format}`)
  if (spec.gravity !== undefined) parts.push(`g_${spec.gravity}`)

  // Height comes from an explicit `height` when one is set (the `og` preset), otherwise from the
  // ratio. Both at once is a contradiction, and `TransformSpec` says the explicit one wins.
  const height =
    spec.height ??
    (spec.ratio !== undefined && spec.width !== undefined
      ? heightFor(spec.width, spec.ratio)
      : undefined)
  if (height !== undefined) parts.push(`h_${height}`)

  if (spec.quality !== undefined) parts.push(`q_${spec.quality}`)
  if (spec.width !== undefined) parts.push(`w_${spec.width}`)

  // dpr_1 is the default and adding it would fork the cache for no effect, so it is omitted.
  const dpr = clampDpr(spec.dpr)
  if (dpr !== 1) parts.push(`dpr_${dpr}`)

  return parts.sort().join(',')
}

function buildUrl(cloudName: string, ref: MediaRef, segment: string, extension?: string): string {
  const path = [
    cloudName,
    ref.resourceType,
    'upload',
    segment,
    // A version pins the URL to one upload, so a re-upload under the same public_id cannot change
    // what a cached page renders. Omitted when unknown rather than guessed.
    ref.version === undefined ? undefined : `v${ref.version}`,
    encodePublicId(ref.publicId) + (extension === undefined ? '' : `.${extension}`),
  ].filter((part): part is string => part !== undefined && part !== '')

  return `${DELIVERY_HOST}/${path.join('/')}`
}

/** An image delivery URL. */
export function imageUrl(cloudName: string, ref: MediaRef, spec: TransformSpec = {}): string {
  return buildUrl(cloudName, ref, transformationSegment(spec))
}

/**
 * A video delivery URL.
 *
 * `f_auto:video,q_auto,vc_auto` is the phase document's video policy: negotiate the container,
 * let Cloudinary pick the quality, and let it pick the codec. `ac_none` strips the audio track
 * when the caller asks for muted — muted autoplay is the only inline video the site plays
 * (FEAT §14), and shipping an audio track nobody can hear is bytes on a mobile connection.
 */
export function videoUrl(cloudName: string, ref: MediaRef, spec: VideoTransformSpec = {}): string {
  const { muted, format, quality, ...rest } = spec
  const extra = ['f_auto:video', 'q_auto', 'vc_auto', ...(muted === true ? ['ac_none'] : [])]
  // `format` and `quality` are dropped rather than merged: the video policy fixes both, and a
  // spec carrying an image preset's `f_auto`/`q_auto:good` would emit each parameter twice.
  void format
  void quality
  return buildUrl(cloudName, ref, transformationSegment(rest, extra))
}

/**
 * A poster frame for a video, delivered as an image.
 *
 * `so_0` is "start offset zero" — the first frame. The `.jpg` extension is what makes Cloudinary
 * transcode the video resource into an image; without it the URL returns the video.
 *
 * The resource type stays `video`, because that is where the asset lives. Asking for it under
 * `image/upload` is a 404: Cloudinary's resource types are separate namespaces, not a hint.
 */
export function posterUrl(cloudName: string, ref: MediaRef, spec: TransformSpec = {}): string {
  const { format, ...rest } = spec
  void format
  return buildUrl(
    cloudName,
    { ...ref, resourceType: 'video' },
    transformationSegment(rest, ['so_0']),
    'jpg',
  )
}
