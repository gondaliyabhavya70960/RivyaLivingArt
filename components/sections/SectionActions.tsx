import * as React from 'react'

import { Cluster } from '@/components/primitives/Cluster'
import { resolveInternalTarget } from '@/lib/site/resolve-target'
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
 *
 * A CTA WHOSE DESTINATION IS NOT LIVE RENDERS NOTHING. `/large-format` links twice to
 * `/custom-commissions`, which Phase 19 builds: the route file exists, the `pages` row exists, and
 * every section on it is DRAFT, so a visitor clicking it gets a 404. `typedRoutes` cannot catch
 * that — the URL is a database value — so `resolveInternalTarget` checks it against the paths that
 * actually render, and an unresolvable one is dropped. Dropping the button rather than the whole
 * band is the narrow fix: the copy above it is still true.
 */
export type SectionActionsProps = {
  readonly section: PageSection
  readonly align?: 'start' | 'centre'
  /**
   * The paths a visitor can load right now. Omitted only by tests that are asserting the pairing
   * rule rather than the link rule; omitted means "do not check", not "nothing is live".
   */
  readonly livePaths?: ReadonlySet<string>
}

type Action = { readonly label: string; readonly url: string }

function actionOf(label: string | null, url: string | null): Action | null {
  if (label === null || url === null) return null
  if (label.trim() === '' || url.trim() === '') return null
  return { label, url }
}

/** Exported for the section tests: the pairing rule is the part that can be wrong. */
export function sectionActions(
  section: PageSection,
  livePaths?: ReadonlySet<string>,
): readonly Action[] {
  const live = (url: string | null): string | null =>
    livePaths === undefined ? url : resolveInternalTarget(url, livePaths)

  const primary = actionOf(section.cta_label, live(section.cta_url))
  const secondary = actionOf(section.cta_secondary_label, live(section.cta_secondary_url))
  // The secondary is promoted when the primary is gone — including when the primary was dropped
  // for a dead destination. One button in the loud style beats two buttons, one of which 404s.
  if (primary === null) return secondary === null ? [] : [secondary]
  return secondary === null ? [primary] : [primary, secondary]
}

export function SectionActions({
  section,
  align = 'start',
  livePaths,
}: SectionActionsProps): React.ReactElement | null {
  const actions = sectionActions(section, livePaths)
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
