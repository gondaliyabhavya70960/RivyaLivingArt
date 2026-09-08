'use server'

import { setSidebarCollapsed, togglePinnedRoute } from '@/lib/auth/preferences'

/**
 * The Studio chrome's Server Actions.
 *
 * A SEPARATE FILE FROM `lib/auth/preferences.ts` ON PURPOSE. `'use server'` marks every export in a
 * module as a callable HTTP endpoint, so putting the directive on the library would publish
 * `readMyChrome` — and anything else added there later — as an endpoint by accident. Here the
 * exported surface is two functions that were chosen to be endpoints, and the library keeps
 * ordinary function semantics.
 *
 * Both re-check the permission inside `lib/auth/preferences.ts`. That is not belt and braces: a
 * Server Action is reachable with `curl` and a session cookie, so it passes through no page, no
 * layout and no proxy matcher, and the check in its own body is the only one that runs.
 */

export async function collapseSidebarAction(formData: FormData): Promise<void> {
  // The intended NEXT state is submitted rather than a "toggle", so two rapid clicks converge on
  // what the person asked for instead of racing to opposite answers.
  await setSidebarCollapsed(formData.get('collapsed') === 'true')
}

export async function togglePinnedRouteAction(formData: FormData): Promise<void> {
  const path = formData.get('path')
  if (typeof path !== 'string') return
  await togglePinnedRoute(path)
}
