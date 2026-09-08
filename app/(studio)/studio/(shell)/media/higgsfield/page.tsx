import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { requirePermission } from '@/lib/auth/require'

/**
 * /studio/media/higgsfield
 *
 * A route stub. It exists so navigation never dead-ends — the sidebar shows this leaf to any role
 * holding `media.read`, and a link that 404s is worse than a page saying it is not built.
 *
 * THE PERMISSION CHECK IS REAL, not a placeholder. It runs before anything renders, writes a DENIED
 * audit row when it refuses, and is the same call the finished surface will make. Phase 07
 * replaces the body below; it does not add the gate, because a gate added later is a gate that was
 * missing in between.
 */
export const metadata = studioMetadata('/studio/media/higgsfield')

export default async function Page() {
  await requirePermission('media.read')
  return <StudioPage path="/studio/media/higgsfield" />
}
