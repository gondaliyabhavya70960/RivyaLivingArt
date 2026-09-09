import type { MediaRef } from './types'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The `MediaRef` a URL builder needs, from a row.
 *
 * IT LIVES HERE, NOT IN `lib/cms/media.ts`, BECAUSE CLIENT COMPONENTS NEED IT. That module opens
 * with `import 'server-only'` — correctly, since the rest of it queries Supabase — and a Client
 * Component importing anything from it fails `next build` outright:
 *
 *     Error: 'server-only' cannot be imported from a Client Component module
 *
 * The gallery's thumbnail strip and lightbox are client components and both need a ref, so the
 * pure two-field mapping moved to a module with no server dependency at all. `lib/cms/media.ts`
 * re-exports it, so every existing caller is unchanged and there is still one implementation.
 *
 * NOTHING CAUGHT THIS LOCALLY, and that was the actual defect. `tsc` does not model the RSC
 * boundary, `vitest.config.ts` deliberately aliases `server-only` to an empty module so the
 * security-critical server code is testable at all, and `site:check-client-boundary` only looked
 * for `'use client'` in route files. `next build` — three minutes, on CI, after the push — was the
 * only thing that checked it. `site:check-client-boundary` now walks the import graph out of every
 * client component (rule 3), so the same mistake fails `npm run check` in about a second with the
 * chain printed. Read that rule before moving anything else across this line.
 *
 * NO `version`, BECAUSE `media_assets` HAS NO VERSION COLUMN. `MediaRef.version` is optional and
 * is left off rather than guessed: a wrong version is a URL Cloudinary resolves to nothing, which
 * is worse than an unversioned one. The cost is that re-uploading under the same public id changes
 * what a cached page shows — acceptable while `public_id` is unique per asset and the uploader
 * never reuses one. If that ever stops holding, the column comes first and this line second.
 */
export function mediaRefOf(asset: MediaAsset): MediaRef {
  return { publicId: asset.public_id, resourceType: asset.resource_type }
}
