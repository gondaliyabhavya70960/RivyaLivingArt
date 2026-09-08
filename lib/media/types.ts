import type { AspectRatio } from '@/components/primitives/AspectBox'

/**
 * The media provider contract.
 *
 * D1 fixes Cloudinary "behind a `MediaProvider` abstraction", and this is that boundary. Only
 * `lib/media/providers/cloudinary.ts` imports the Cloudinary SDK; everything else in the product
 * depends on these types and on `getMediaProvider()`.
 *
 * THE POINT IS NOT PROVIDER PORTABILITY. Swapping Cloudinary is unlikely and would be a large
 * piece of work whatever this file says. What the boundary actually buys is that URL construction
 * has ONE home: without it, a transformation string gets hand-written into a component, then
 * copied, and the day a preset changes there is no list of the places to change. Every URL in the
 * product comes from `url()`, `videoUrl()` or `posterUrl()`.
 *
 * THE RATIO SET IS IMPORTED, NOT RETYPED. D6 fixes eight ratios and `AspectBox` already encodes
 * them for layout. A second copy here would drift from the first, and the drift would show up as a
 * crop that does not match the box it is rendered in.
 */

export type { AspectRatio }

/** A stored asset, as the provider identifies it. */
export type MediaRef = {
  /** Cloudinary's `public_id` — the path within the account, without extension. */
  readonly publicId: string
  /** Cloudinary splits its API and its URL space by this; a video is not reachable as an image. */
  readonly resourceType: 'image' | 'video' | 'raw'
  /** Present when the asset is versioned; pins a URL to one version so a re-upload cannot change it. */
  readonly version?: number
}

/** What a transformed delivery URL should contain. */
export type TransformSpec = {
  /** Target width in CSS pixels. The ladder in `transform.ts` is the supported set. */
  readonly width?: number
  /** Crop to one of the eight D6 ratios. Omit to keep the asset's own shape. */
  readonly ratio?: AspectRatio
  /**
   * `fill` crops to fill the box, `fit` letterboxes inside it.
   *
   * `fill` is the default because a letterboxed product photograph in a fixed grid reads as a
   * mistake, and because `fit` cannot honour a ratio without adding padding the design system has
   * no colour for.
   */
  readonly crop?: 'fill' | 'fit'
  /** Where to keep the subject when cropping. `auto` asks Cloudinary; see transform.ts. */
  readonly gravity?: 'auto' | 'center'
  /** Device pixel ratio. Capped in transform.ts — see the note there on why 3 is the ceiling. */
  readonly dpr?: number
}

export type VideoTransformSpec = TransformSpec & {
  /** Strip the audio track. Muted autoplay is the only inline video the site plays (FEAT §14). */
  readonly muted?: boolean
}

/** What the browser needs to upload directly to the provider, and the limits it must respect. */
export type SignedUpload = {
  readonly signature: string
  readonly timestamp: number
  readonly apiKey: string
  readonly cloudName: string
  readonly folder: string
  readonly uploadUrl: string
  /**
   * Echoed back so the client can refuse an over-large file before spending the upload, AND so a
   * test can assert the ceiling without reading the server's config. The server enforces them
   * regardless — a client-side limit is a courtesy, never the control.
   */
  readonly maxBytes: number
  readonly allowedFormats: readonly string[]
}

export type SignUploadInput = {
  readonly folder: string
  readonly resourceType: MediaRef['resourceType']
  /** The uploader's id, recorded on the asset so provenance survives the upload. */
  readonly uploadedBy: string
}

/** What the provider knows about a stored asset. Used to fill columns rather than trusting a client. */
export type ProviderMetadata = {
  readonly bytes: number
  readonly width: number | null
  readonly height: number | null
  readonly durationSeconds: number | null
  readonly format: string
}

export interface MediaProvider {
  signUpload(input: SignUploadInput): Promise<SignedUpload>
  url(ref: MediaRef, spec?: TransformSpec): string
  videoUrl(ref: MediaRef, spec?: VideoTransformSpec): string
  posterUrl(ref: MediaRef, spec?: TransformSpec): string
  /**
   * Read dimensions, bytes and duration back from the provider.
   *
   * The application never takes these from the browser. A client that uploaded a 40 MB file can
   * report 2 MB, and the row would then claim something false about an asset an owner is deciding
   * about.
   */
  probe(ref: MediaRef): Promise<ProviderMetadata>
  move(ref: MediaRef, folder: string): Promise<MediaRef>
  /** Irreversible. Requires `media.delete` AND a ConfirmDialog — neither alone. */
  destroy(ref: MediaRef): Promise<void>
}
