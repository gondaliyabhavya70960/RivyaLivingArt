import { UnavailableBulkToolbar } from '@/components/studio/bulk/UnavailableToolbar'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { requirePermission } from '@/lib/auth/require'

/**
 * /studio/research/changes
 *
 * A route stub. It exists so navigation never dead-ends — the sidebar shows this leaf to any role
 * holding `research.read`, and a link that 404s is worse than a page saying it is not built.
 *
 * THE PERMISSION CHECK IS REAL, not a placeholder. It runs before anything renders, writes a DENIED
 * audit row when it refuses, and is the same call the finished surface will make. Phase 29
 * replaces the body below; it does not add the gate, because a gate added later is a gate that was
 * missing in between.
 *
 * PHASE 24 ADDED THE BULK TOOLBAR IN ITS UNAVAILABLE STATE. The five research operations are
 * registered against the one bulk engine with `available: false`, so Phase 29 fills in a `preview`
 * and an `applyItem` and inherits the preview step, the typed-count confirmation, the per-item
 * snapshot and the 24-hour undo — rather than building a second bulk system, which is what a phase
 * arriving to find no registration and no toolbar would do.
 */
export const metadata = studioMetadata('/studio/research/changes')

export default async function Page() {
  await requirePermission('research.read')
  return (
    <StudioPage path="/studio/research/changes">
      <UnavailableBulkToolbar />
    </StudioPage>
  )
}
