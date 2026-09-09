import * as React from 'react'

import { isBlockType } from '@/lib/cms/block-types'
import { sectionMediaFor } from '@/lib/cms/media'
import type { PageReferences } from '@/lib/cms/references'
import type { SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset, PageSection } from '@/lib/supabase/schemas'

import { sectionRenderer } from './registry'

/**
 * A resolved page's sections, in order.
 *
 * IT DECIDES NOTHING ABOUT VISIBILITY. `lib/cms/resolve.ts` has already applied status, the
 * publish window and `is_visible`; this component renders exactly what it is given. Two places
 * deciding what is live is how a page ends up with one section too many on one route and not the
 * other.
 *
 * AN UNKNOWN OR UNBUILT BLOCK RENDERS NOTHING, silently, on the public site. A `block_type` this
 * build does not know is a deploy that is behind the database — a placeholder card would tell a
 * visitor about the project's internals, and a thrown error would take a page down over one row.
 * Studio shows the same section with an explicit "no renderer" notice, which is where the person
 * who can fix it is looking.
 */
export type SectionListProps = {
  readonly sections: readonly PageSection[]
  readonly assets: ReadonlyMap<string, MediaAsset>
  readonly strings: SiteStrings
  readonly cloudName: string
  /** By section id. Empty for a page with no reference block, which is most of them. */
  readonly references?: PageReferences
}

export function SectionList({
  sections,
  assets,
  strings,
  cloudName,
  references,
}: SectionListProps): React.ReactElement {
  return (
    <>
      {sections.map((section, index) => {
        if (!isBlockType(section.block_type)) return null
        const Renderer = sectionRenderer(section.block_type)
        if (Renderer === null) return null

        return (
          <Renderer
            key={section.id}
            section={section}
            media={sectionMediaFor(section, assets)}
            strings={strings}
            cloudName={cloudName}
            isFirst={index === 0}
            reference={references?.get(section.id)}
          />
        )
      })}
    </>
  )
}
