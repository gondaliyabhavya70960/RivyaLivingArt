import * as React from 'react'

import { isBlockType } from '@/lib/cms/block-types'
import { sectionMediaFor } from '@/lib/cms/media'
import type { PageReferences } from '@/lib/cms/references'
import type { SiteStrings } from '@/lib/cms/strings'
import type { MediaAsset, PageSection } from '@/lib/supabase/schemas'

import { sectionRenderer } from './registry'
import { withDefaultTheme } from './rhythm'

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
  /** The paths a visitor can load right now. See `SectionRenderProps.livePaths`. */
  readonly livePaths: ReadonlySet<string>
}

export function SectionList({
  sections,
  assets,
  strings,
  cloudName,
  references,
  livePaths,
}: SectionListProps): React.ReactElement {
  /*
   * ONE COUNTER PER BLOCK TYPE, filled as the list is walked, so a renderer can know it is the
   * third chapter without knowing about its siblings. Counting here rather than in the renderer is
   * what keeps a section renderer a pure function of its own props: the list is the only thing
   * that can see the page.
   */
  const seen = new Map<string, number>()

  /*
   * THE PAGE'S GROUND RHYTHM, decided once, here, because it is the only place that can see the
   * sequence. `withDefaultTheme` fills `theme` on the sections that have none and leaves every
   * editor-set theme exactly as it was — see components/sections/rhythm.ts for the rule and why
   * a dark band does not advance the warm counter.
   */
  const banded = withDefaultTheme(sections)

  return (
    <>
      {banded.map((section, index) => {
        if (!isBlockType(section.block_type)) return null
        const Renderer = sectionRenderer(section.block_type)
        if (Renderer === null) return null

        const ordinal = (seen.get(section.block_type) ?? 0) + 1
        seen.set(section.block_type, ordinal)

        return (
          <Renderer
            key={section.id}
            section={section}
            media={sectionMediaFor(section, assets)}
            strings={strings}
            cloudName={cloudName}
            isFirst={index === 0}
            ordinal={ordinal}
            livePaths={livePaths}
            reference={references?.get(section.id)}
          />
        )
      })}
    </>
  )
}
