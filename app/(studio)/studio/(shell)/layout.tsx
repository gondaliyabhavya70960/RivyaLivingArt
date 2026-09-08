import { redirect } from 'next/navigation'

import { StudioShell } from '@/components/studio/StudioShell'
import { AuthenticationError, requirePermission } from '@/lib/auth/require'

/**
 * The authenticated Studio shell.
 *
 * WHY `(shell)` IS A ROUTE GROUP. `/studio/login` is a child of `/studio` in the URL, so a layout at
 * `app/(studio)/studio/layout.tsx` would wrap the sign-in page in a permission check and a sidebar —
 * a redirect loop, and a sidebar for someone with no session to build one from. A route group adds a
 * layout without adding a URL segment, so `(shell)/page.tsx` is still `/studio` and login stays
 * outside. That is the only reason the directory exists; it is not a naming flourish.
 *
 * THIS CHECK IS NOT THE ONLY CHECK. It answers "may this person enter the Studio at all", and every
 * page below answers "may they open THIS surface" in its own body. A layout cannot stand in for the
 * page's check: Next does not re-run layouts for every navigation the way it re-runs pages, and a
 * Server Action invoked from an already-rendered page passes through no layout at all.
 *
 * `proxy.ts` has usually redirected an unauthenticated request long before this runs. Usually is not
 * always — the matcher can be edited, and a cookie can expire between the proxy and the render — so
 * the AuthenticationError is caught and turned into the same redirect rather than a 500.
 */
export default async function StudioShellLayout({ children }: { children: React.ReactNode }) {
  let session
  try {
    session = await requirePermission('studio.access')
  } catch (error) {
    if (error instanceof AuthenticationError) redirect('/studio/login')
    throw error
  }

  return <StudioShell session={session}>{children}</StudioShell>
}
