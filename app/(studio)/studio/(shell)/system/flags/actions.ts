'use server'

import { revalidatePath } from 'next/cache'

import { type StudioFormState } from '@/components/studio/form-state'
import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { FLAGS, isRegisteredFlag } from '@/lib/flags'
import { PermissionError } from '@/lib/supabase/errors'
import { setFeatureFlag } from '@/lib/supabase/repositories/flags'
import { createClient } from '@/lib/supabase/server'

/**
 * The one action behind /studio/system/flags: move a switch.
 *
 * THE KEY IS CHECKED AGAINST THE REGISTER, NOT AGAINST THE TABLE. `'use server'` publishes this as
 * an HTTP endpoint, so the key arrives as data from whoever calls it; `isRegisteredFlag` is what
 * stops a request inventing `admin_bypass` and leaving a row in `feature_flags` that reads like a
 * feature. A flag exists because the code declares it, and only then.
 *
 * THE DESCRIPTION IS COPIED FROM THE REGISTER RATHER THAN SUBMITTED. It is documentation of what
 * the flag gates, owned by the module that declares it — accepting it from the form would let the
 * row and the code disagree about what the switch does, which is the one thing the register exists
 * to prevent.
 *
 * THE WRITE IS DONE WITH THE SESSION CLIENT, NOT THE ADMIN ONE. Reading flags for a public page
 * uses the service role because there is no session to check; writing one has a session by
 * definition, so `feature_flags`'s `system.flags.write` policy does its own work underneath the
 * permission check here. `setFeatureFlag` reads the row back, because RLS filters an update rather
 * than refusing one and a switch that moves without sticking is worse than one that refuses.
 */

export type FlagActionState = StudioFormState

const issue = (message: string, code: string): FlagActionState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  if (error instanceof PermissionError) return 'You do not have permission to do that.'
  return 'That switch could not be moved.'
}

const FLAGS_PATH = '/studio/system/flags'

export async function setFlagAction(
  _previous: FlagActionState,
  form: FormData,
): Promise<FlagActionState> {
  try {
    const session = await requirePermission('system.flags.write')

    const key = form.get('key')
    if (typeof key !== 'string' || !isRegisteredFlag(key)) {
      return issue('That is not a feature this site has.', 'flag_unknown')
    }

    // The target state travels in the payload rather than being inferred from what the page was
    // rendered with: a toggle computed from stale markup sends the wrong instruction the moment two
    // people have the screen open.
    const enabled = form.get('enabled') === 'true'

    const client = await createClient()
    await withAudit(
      {
        action: enabled ? 'system.flag.enable' : 'system.flag.disable',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'feature_flags',
        entityId: key,
        summary: `${enabled ? 'Switched on' : 'Switched off'} ${key}`,
      },
      async () => setFeatureFlag(client, key, FLAGS[key], enabled, session.userId),
    )

    revalidatePath(FLAGS_PATH)
    // The only consumer today. `/custom-commissions` is rendered per request anyway, so this is
    // belt-and-braces rather than load-bearing — but a flag whose consumer is a static route will
    // need its own path here, and the omission would be invisible until somebody switched it.
    revalidatePath('/custom-commissions')
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}
