import 'server-only'

import { v2 as cloudinary } from 'cloudinary'

import { requiredEnv } from '../../env'
import { assertFolder } from '../folders'
import type {
  MediaProvider,
  MediaRef,
  ProviderMetadata,
  SignUploadInput,
  SignedUpload,
  TransformSpec,
  VideoTransformSpec,
} from '../types'
import { UPLOAD_LIMITS } from '../upload-limits'
import { imageUrl, posterUrl, videoUrl } from '../url'

/**
 * The Cloudinary implementation of `MediaProvider`.
 *
 * THIS IS THE ONLY FILE IN THE REPOSITORY THAT IMPORTS THE CLOUDINARY SDK (D1, and the phase
 * document's deliverables table). `scripts/media/check-provider-boundary.mjs` fails the build if
 * that stops being true, because the rule is worth more than the comment: the day a component
 * imports `cloudinary` directly to "just build one URL", the secret-holding SDK is in a client
 * bundle and nobody notices until it ships.
 *
 * `server-only` is the first line for the same reason. It is not a convention — importing this
 * module from a Client Component is a build error, which is the only form of the rule that holds
 * under a refactor nobody reviews carefully.
 *
 * URL BUILDING IS DELEGATED TO `../url.ts`, WHICH USES NO SDK. See that file's header: a Client
 * Component legitimately needs to render media, and the choice was between shipping the SDK to the
 * browser or building the string ourselves. The provider still exposes the three methods, so the
 * contract in `types.ts` is honoured and there is still one implementation of a delivery URL.
 */

/**
 * Configuration is read lazily, on first use, and never at module scope.
 *
 * A module-scope `cloudinary.config({...})` runs at import time — which in Next means during the
 * build, on a machine that legitimately may not have the secret. The build would fail with a
 * missing-variable error on a page that renders no media at all. Reading it here means a surface
 * that never uploads never needs the credential.
 */
let configured = false

function configure(): void {
  if (configured) return
  cloudinary.config({
    cloud_name: requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'),
    api_key: requiredEnv('CLOUDINARY_API_KEY'),
    api_secret: requiredEnv('CLOUDINARY_API_SECRET'),
    secure: true,
  })
  configured = true
}

function cloudName(): string {
  return requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
}

/**
 * How long a signature is honoured, in seconds.
 *
 * SECURITY.md §7.1 fixes ten minutes. Cloudinary's own window is an hour and cannot be shortened
 * from here, so this is the value the sign endpoint records and re-checks — the signature is not
 * useless after ten minutes, but a request presenting one older than that is refused by us. Said
 * plainly because the difference matters to anyone reasoning about the exposure: the ceiling on a
 * leaked signature is Cloudinary's hour, not our ten minutes.
 */
export const SIGNATURE_TTL_SECONDS = 600

function uploadEndpoint(resourceType: MediaRef['resourceType']): string {
  return `https://api.cloudinary.com/v1_1/${cloudName()}/${resourceType}/upload`
}

export const cloudinaryProvider: MediaProvider = {
  async signUpload(input: SignUploadInput): Promise<SignedUpload> {
    configure()
    // Belt and braces: the route asserts this too. Here because `signUpload` is what produces the
    // credential, so the folder check has to be the last thing before the signature — not a check
    // some other caller might forget to run first.
    assertFolder(input.folder)

    const limits = UPLOAD_LIMITS[input.kind]
    const timestamp = Math.floor(Date.now() / 1000)

    /**
     * Every parameter signed here must also be sent by the browser, and vice versa: Cloudinary
     * recomputes the signature over what it receives, so one extra field on either side is a
     * rejected upload.
     *
     * `overwrite: false` is signed rather than left to the client (SECURITY.md §7.1). Signed, it
     * cannot be flipped by whoever holds the signature — which is the difference between "we ask
     * the browser not to overwrite" and "an upload cannot replace an existing asset".
     */
    const params: Record<string, string> = {
      folder: input.folder,
      overwrite: 'false',
      timestamp: String(timestamp),
      // Provenance survives the upload even if the row is written later or not at all. Cloudinary
      // context values are `key=value|key=value`, so a `|` or `=` in the value would inject a
      // second pair; a uuid contains neither, and the route validates it as one.
      context: `uploaded_by=${input.uploadedBy}`,
    }

    const signature = cloudinary.utils.api_sign_request(
      params,
      requiredEnv('CLOUDINARY_API_SECRET'),
    )

    return {
      signature,
      timestamp,
      apiKey: requiredEnv('CLOUDINARY_API_KEY'),
      cloudName: cloudName(),
      folder: input.folder,
      uploadUrl: uploadEndpoint(limits.resourceType),
      // Echoed from the one table, never restated. A client that honours these refuses an
      // over-large file before spending the upload; the server has already applied them anyway.
      maxBytes: limits.maxBytes,
      allowedFormats: limits.mimeTypes,
    }
  },

  url(ref: MediaRef, spec: TransformSpec = {}): string {
    return imageUrl(cloudName(), ref, spec)
  },

  videoUrl(ref: MediaRef, spec: VideoTransformSpec = {}): string {
    return videoUrl(cloudName(), ref, spec)
  },

  posterUrl(ref: MediaRef, spec: TransformSpec = {}): string {
    return posterUrl(cloudName(), ref, spec)
  },

  async probe(ref: MediaRef): Promise<ProviderMetadata> {
    configure()
    const resource = await cloudinary.api.resource(ref.publicId, {
      resource_type: ref.resourceType,
    })

    // Read defensively. These come back from an HTTP API, and a `raw` resource (a GLB, a PDF) has
    // no width, height or duration at all — so the nulls here are the normal case for two of the
    // five kinds, not an error path.
    return {
      bytes: typeof resource.bytes === 'number' ? resource.bytes : 0,
      width: typeof resource.width === 'number' ? resource.width : null,
      height: typeof resource.height === 'number' ? resource.height : null,
      durationSeconds: typeof resource.duration === 'number' ? resource.duration : null,
      format: typeof resource.format === 'string' ? resource.format : '',
    }
  },

  async move(ref: MediaRef, folder: string): Promise<MediaRef> {
    configure()
    assertFolder(folder)

    // Cloudinary has no "move": a public_id encodes the folder, so moving is renaming. The leaf
    // name is preserved so that the asset keeps the identity D6 gives it.
    const leaf = ref.publicId.split('/').pop() ?? ref.publicId
    const target = `${folder}/${leaf}`

    const result = await cloudinary.uploader.rename(ref.publicId, target, {
      resource_type: ref.resourceType,
      // Never clobber an asset that already occupies the target id. A move that silently replaced
      // one would destroy an asset that other rows still point at.
      overwrite: false,
    })

    return {
      publicId: typeof result.public_id === 'string' ? result.public_id : target,
      resourceType: ref.resourceType,
      ...(typeof result.version === 'number' ? { version: result.version } : {}),
    }
  },

  async destroy(ref: MediaRef): Promise<void> {
    configure()
    // `invalidate` purges the CDN. Without it a deleted asset keeps being served from edge caches
    // for as long as they hold it — which for a takedown is the whole of the problem.
    await cloudinary.uploader.destroy(ref.publicId, {
      resource_type: ref.resourceType,
      invalidate: true,
    })
  },
}
