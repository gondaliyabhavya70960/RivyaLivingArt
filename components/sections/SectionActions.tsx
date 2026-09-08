import * as React from 'react'

import { Cluster } from '@/components/primitives/Cluster'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * The primary and secondary calls to action.
 *
 * A CTA NEEDS BOTH ITS LABEL AND ITS URL, and a half-filled pair renders nothing. A link with a
 * label and no destination is a dead control that looks live; a destination with no label is a
 * button a screen reader announces as its own href. Neither is better than the absence.
 *
 * THE SECONDARY CANNOT APPEAR WITHOUT THE PRIMARY. If only the secondary pair is filled it is
 * rendered as the primary — an editor who filled one row of a two-row form meant "one button
 * here", and showing it in the quieter of two styles with nothing beside it reads as a mistake.
 *
 * NO `target="_blank"` IS SET FROM THE CMS. It is not an editable field: opening a new tab takes
 * a decision away from the visitor, and every destination the site links to is its own.
 */
export type SectionActionsProps = {
  readonly section: PageSection
  readonly align?: 'start' | 'centre'
}

type Action = { readonly label: string; readonly url: string }

function actionOf(label: string | null, url: string | null): Action | null {
  if (label === null || url === null) return null
  if (label.trim() === '' || url.trim() === '') return null
  return { label, url }
}

/** Exported for the section tests: the pairing rule is the part that can be wrong. */
export function sectionActions(section: PageSection): readonly Action[] {
  const primary = actionOf(section.cta_label, section.cta_url)
  const secondary = actionOf(section.cta_secondary_label, section.cta_secondary_url)
  if (primary === null) return secondary === null ? [] : [secondary]
  return secondary === null ? [primary] : [primary, secondary]
}

export function SectionActions({
  section,
  align = 'start',
}: SectionActionsProps): React.ReactElement | null {
  const actions = sectionActions(section)
  if (actions.length === 0) return null

  return (
    <Cluster gap={3} className={align === 'centre' ? 'justify-center' : ''}>
      {actions.map((action, index) => (
        <a
          key={action.url}
          href={action.url}
          className={
            index === 0
              ? 'inline-flex h-11 items-center rounded-(--rv-radius-sm) bg-surface-accent px-6 text-base text-ink-on-accent hover:brightness-110'
              : 'inline-flex h-11 items-center rounded-(--rv-radius-sm) border border-line-strong px-6 text-base text-ink hover:bg-surface-raised'
          }
        >
          {action.label}
        </a>
      ))}
    </Cluster>
  )
}
