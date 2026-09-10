import { z } from 'zod'

import { registerBulkOperation } from '../../registry'

/**
 * FEAT §20's five scraper operations — REGISTERED AND UNAVAILABLE.
 *
 * `research_products` DOES NOT EXIST UNTIL PHASE 25, and the dispositions these five perform are
 * Phase 29's. So why register them at all?
 *
 * BECAUSE THE ALTERNATIVE IS A SECOND BULK SYSTEM. A phase that arrives to find no registration
 * and a research explorer with no toolbar writes its own selection handling, its own preview, its
 * own confirmation and its own undo — and the second implementation is always the one without the
 * typed count. Registering them here means Phase 29 fills in a `preview` and an `applyItem` and
 * inherits the engine, and `scripts/bulk/check-bulk-registry.mjs` fails the build if anything
 * outside `lib/bulk/run.ts` starts mutating in bulk.
 *
 * THEY ALSO GIVE THE STUDIO SOMETHING HONEST TO RENDER. `/studio/research/explorer` and
 * `/studio/research/changes` show a toolbar in a named unavailable state — "Available from Phase
 * 29" — rather than a control that does nothing or an empty space that looks like a bug.
 *
 * `available: false` MAKES THE ENGINE REFUSE THEM, not just the interface. A crafted POST naming
 * `research.shortlist` is turned away in `previewBulkOperation` before anything is read, because
 * an unimplemented operation whose only guard is a hidden button is not guarded.
 *
 * THE THREE DISPOSITIONS AMONG THEM ARE `research.confirm` WORK, NOT `bulk.execute` WORK. Phase
 * 29 adds that check; it is noted here so the phase that implements them does not have to
 * rediscover the Phase 04 split — a researcher operates the pipeline, a merchandiser judges its
 * output.
 *
 * THE MODULE EXPORTS ITS REGISTRATION AND ALSO PERFORMS IT. The export is what makes the registry
 * re-populatable after `resetBulkOperations()`: a module's side effect runs once per process, so a
 * test that clears the register and re-imports gets an empty one. Discovered by writing that test.
 */

const OWNING_PHASE = 29

const unimplemented = async (): Promise<never> => {
  // Unreachable: the engine refuses an unavailable operation before it calls anything. It throws
  // rather than returning an empty list so that "Phase 29 wired the UI but forgot the body" is a
  // loud failure in a test rather than a bulk operation that silently applies to nothing.
  throw new Error(`This operation is implemented in Phase ${OWNING_PHASE}.`)
}

export function registerResearchOperations(): void {
  for (const [kind, isDestructive] of [
    ['research.shortlist', false],
    ['research.reject', true],
    ['research.mark_duplicate', false],
    ['research.set_tags', false],
    ['research.confirm', false],
  ] as const) {
    registerBulkOperation({
      kind,
      targetEntity: 'research_product',
      paramsSchema: z.object({}).passthrough(),
      isDestructive,
      available: false,
      owningPhase: OWNING_PHASE,
      preview: unimplemented,
      applyItem: unimplemented,
    })
  }
}

registerResearchOperations()
