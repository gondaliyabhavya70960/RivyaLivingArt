import type * as React from 'react'

import type { StudioFormAction } from '@/components/studio/form-state'
import { RESEARCH_BULK_CAP } from '@/lib/bulk/research-surface'

import {
  ResearchBulkToolbar,
  type ResearchOperationChoice,
  type ResearchTagChoice,
} from './BulkToolbar'

/**
 * RC-334 `PipelineBulkBar` — Phase 35's bulk bar over the shortlist and the confirmed list.
 *
 * IT IS THE PHASE 29 TOOLBAR WITH THE PHASE 35 RULES FIXED: the 200-row cap (`RESEARCH_BULK_CAP`,
 * checked again in the Server Action so a crafted form meets the same refusal), the operations
 * limited to the kinds the screen it sits on can act with, and the reason field the movement table
 * requires — rendered by the toolbar for every kind that takes one. There is no second selection
 * machinery, no second preview and no second undo: Select → Preview → Confirm → Apply is the
 * engine's, unchanged.
 */
export function PipelineBulkBar({
  surface,
  filters,
  operations,
  kinds,
  tags,
  canDestroy,
  previewAction,
  children,
}: {
  readonly surface: string
  readonly filters: string
  readonly operations: readonly ResearchOperationChoice[]
  /** The kinds this screen offers, in the order they are listed. */
  readonly kinds: readonly string[]
  readonly tags: readonly ResearchTagChoice[]
  readonly canDestroy: boolean
  readonly previewAction: StudioFormAction
  readonly children: React.ReactNode
}): React.ReactElement {
  const offered = kinds
    .map((kind) => operations.find((operation) => operation.kind === kind))
    .filter((operation): operation is ResearchOperationChoice => operation !== undefined)
  return (
    <ResearchBulkToolbar
      surface={surface}
      filters={filters}
      operations={offered}
      tags={tags}
      canDestroy={canDestroy}
      maxSelection={RESEARCH_BULK_CAP}
      previewAction={previewAction}
    >
      {children}
    </ResearchBulkToolbar>
  )
}
