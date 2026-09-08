import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { requirePermission } from '@/lib/auth/require'

/**
 * /studio/system/environment
 *
 * A route stub. It exists so navigation never dead-ends — the sidebar shows this leaf to any role
 * holding `system.environment.read`, and a link that 404s is worse than a page saying it is not built.
 *
 * THE PERMISSION CHECK IS REAL, not a placeholder. It runs before anything renders, writes a DENIED
 * audit row when it refuses, and is the same call the finished surface will make. Phase 38
 * replaces the body below; it does not add the gate, because a gate added later is a gate that was
 * missing in between.
 */
export const metadata = studioMetadata('/studio/system/environment')

export default async function Page() {
  await requirePermission('system.environment.read')
  return <StudioPage path="/studio/system/environment" />
}
