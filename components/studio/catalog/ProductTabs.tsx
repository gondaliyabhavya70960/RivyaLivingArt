'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import * as React from 'react'

import { Text } from '@/components/primitives/Text'

/**
 * The product editor's section strip.
 *
 * A CLIENT COMPONENT FOR ONE REASON: `aria-current`. Which tab is active is a fact about the URL,
 * and a Server Component in a layout cannot read it — the layout renders once for every child
 * beneath it and `useSelectedLayoutSegment` is the only thing that knows which child that is.
 *
 * The alternative was to have each of the five pages pass its own segment down, which is five
 * places to forget and no way to notice: a missing `aria-current` is invisible to everyone except
 * the screen-reader user it was for. This is a dozen lines of client JavaScript in the Studio,
 * behind authentication, on a screen that already ships a form island. It is not the public site's
 * budget and does not touch it.
 *
 * STILL REAL LINKS. The active pane is a URL, not state — bookmarkable, openable in two windows,
 * and the back button works. This component decorates that navigation; it does not implement it,
 * which is why the strip still functions with JavaScript off, minus the `aria-current`.
 */

export interface ProductTabsProps {
  readonly basePath: string
  readonly label: string
  /** `segment` is what `useSelectedLayoutSegment` returns for that tab; null is the index page. */
  readonly tabs: readonly { readonly segment: string | null; readonly label: string }[]
}

export function ProductTabs({ basePath, label, tabs }: ProductTabsProps): React.ReactElement {
  const active = useSelectedLayoutSegment()

  return (
    <nav aria-label={label} data-product-tabs="">
      {/*
        `role="list"` is not redundant: preflight sets `list-style: none` and Safari then drops the
        semantics, so VoiceOver would announce five loose links and never say how many.
      */}
      <ul role="list" className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((tab) => {
          const current = active === tab.segment
          return (
            <li key={tab.segment ?? 'overview'}>
              <Link
                href={`${basePath}${tab.segment === null ? '' : `/${tab.segment}`}` as Route}
                // `aria-current` announces the active tab; the underline shows it. Colour alone
                // would leave the same fact unavailable to two different groups of people.
                aria-current={current ? 'page' : undefined}
                data-current={current ? '' : undefined}
                className={`inline-flex items-center px-4 py-2 rv-hit-44 underline-offset-4 hover:underline ${
                  current ? 'text-ink font-medium underline' : 'text-ink-secondary'
                }`}
              >
                <Text size="sm" as="span">
                  {tab.label}
                </Text>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
