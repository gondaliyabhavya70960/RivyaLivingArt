import { v2 as cloudinary } from 'cloudinary'

import { requiredEnv } from '../../env'
import type { AssetUploader, UploadRequest, UploadedAsset } from '../migration'

/**
 * The Cloudinary uploader used by `scripts/media/migrate-higgsfield.ts`. Node only.
 *
 * WHY IT LIVES IN `providers/` RATHER THAN IN `scripts/`. `media:check-provider` allows the
 * Cloudinary SDK to be imported from exactly one directory, and that rule is worth more than the
 * convenience of putting this next to its caller: the day somebody adds a second SDK importer
 * elsewhere, the gate should fail rather than shrug. Rule 2 of the same gate stops any component
 * importing anything under `providers/`, which is what keeps this file out of a browser bundle.
 *
 * IT IS DELIBERATELY *NOT* `server-only`, and that is the one difference from `cloudinary.ts`.
 * `server-only` throws when resolved outside a React Server Component build, which is exactly what
 * a `tsx` CLI is — importing it here would make the migration script unrunnable. The protection
 * that matters is unchanged: nothing in `app/` or `components/` may import this path at all.
 *
 * WHY A SEPARATE INTERFACE FROM `MediaProvider`. That contract is about DELIVERY and about signing
 * a browser upload. This is a server-side fetch-from-URL import, which `MediaProvider` has no
 * method for and should not grow one for: it would widen the interface every page depends on to
 * serve a script that runs once.
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

/** Cloudinary's REST shape, read defensively — a `raw` or partial response has none of it. */
function toUploaded(result: Record<string, unknown>, fallbackPublicId: string): UploadedAsset {
  return {
    publicId: typeof result.public_id === 'string' ? result.public_id : fallbackPublicId,
    bytes: typeof result.bytes === 'number' ? result.bytes : 0,
    width: typeof result.width === 'number' ? result.width : null,
    height: typeof result.height === 'number' ? result.height : null,
    durationSeconds: typeof result.duration === 'number' ? result.duration : null,
    format: typeof result.format === 'string' ? result.format : '',
  }
}

export function createCloudinaryUploader(): AssetUploader {
  return {
    async upload(request: UploadRequest): Promise<UploadedAsset> {
      configure()

      const result = await cloudinary.uploader.upload(request.sourceUrl, {
        // The manifest's public id is used verbatim, slashes and all — D6 makes the manifest
        // authoritative for the folder and the id, so `folder` is NOT passed separately. Passing
        // both would prepend the folder twice.
        public_id: request.publicId,
        resource_type: request.resourceType,
        // Never replace bytes already stored under a manifest id. A re-run must be a no-op, and
        // the ledger is not the only thing that should enforce that — this is the backstop for a
        // run started against a lost ledger.
        overwrite: false,
        // Without these Cloudinary appends random characters to the id it was given.
        unique_filename: false,
        use_filename: false,
        tags: [...request.tags],
        context: request.context,
      })

      return toUploaded(result as unknown as Record<string, unknown>, request.publicId)
    },

    async probe(publicId, resourceType): Promise<UploadedAsset | null> {
      configure()
      try {
        const resource = await cloudinary.api.resource(publicId, { resource_type: resourceType })
        return toUploaded(resource as unknown as Record<string, unknown>, publicId)
      } catch (error) {
        // A 404 is the ordinary answer for "not uploaded yet" and must not abort the run. Anything
        // else — a 401, a rate limit, a network failure — is re-thrown: treating an auth failure as
        // "absent" would make the migration re-upload the entire library.
        const status = (error as { error?: { http_code?: number } }).error?.http_code
        if (status === 404) return null
        throw error
      }
    },
  }
}
