'use client'

import * as React from 'react'

/**
 * The five strings the public error boundary needs, carried across the server/client boundary.
 *
 * WHY THIS EXISTS AT ALL, stated plainly because it is the one island in the shell whose reason is
 * not interaction. Next requires `error.tsx` to be a Client Component — it takes `reset`, which is
 * a callback — and a Client Component cannot read the database. Meanwhile D2 says every
 * visitor-readable string comes from `global_content`, and `lib/cms/strings.ts` spells out why the
 * public site gets no literal fallbacks: a default sentence is one nobody wrote, appearing at the
 * exact moment nobody is watching. Those two rules meet here, and something has to give.
 *
 * WHAT GIVES IS ONE TINY PROVIDER, NOT THE RULE. The Server Component layout reads the strings and
 * hands them to this provider, which renders `children` unchanged — the page tree stays
 * server-rendered, because it arrives as a prop rather than being constructed inside a client
 * component. The cost is a few hundred bytes and no DOM node. The alternative was five literals in
 * `app/(site)/error.tsx`, which the owner could never change and which
 * `scripts/cms/check-section-copy.ts` exists to prevent one directory over.
 *
 * `components/studio/strings.ts` DOES THE OPPOSITE, deliberately: Studio chrome has to render
 * before any content exists, so it ships literals. The public site has no such excuse.
 *
 * THE DEFAULT IS ALL-NULL, not English. If the layout never ran — which is precisely the case when
 * the layout is what threw — the boundary renders its structure with no words rather than words
 * that contradict whatever actually happened.
 */

export type SiteErrorCopy = {
  readonly heading: string | null
  readonly body: string | null
  readonly tryAgain: string | null
  readonly returnHome: string | null
  readonly referenceLabel: string | null
}

const EMPTY: SiteErrorCopy = {
  heading: null,
  body: null,
  tryAgain: null,
  returnHome: null,
  referenceLabel: null,
}

const SiteErrorCopyContext = React.createContext<SiteErrorCopy>(EMPTY)

export function SiteErrorCopyProvider({
  copy,
  children,
}: {
  readonly copy: SiteErrorCopy
  readonly children: React.ReactNode
}): React.ReactElement {
  // `useMemo` on the object identity, so the provider does not re-render every consumer on each
  // parent render. There is one consumer and it renders rarely, but a context provider handing out
  // a fresh object every render is a pattern that gets copied.
  const value = React.useMemo(() => copy, [copy])
  return <SiteErrorCopyContext value={value}>{children}</SiteErrorCopyContext>
}

export function useSiteErrorCopy(): SiteErrorCopy {
  return React.useContext(SiteErrorCopyContext)
}
