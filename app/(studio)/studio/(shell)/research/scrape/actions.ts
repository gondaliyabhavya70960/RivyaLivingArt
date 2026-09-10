'use server'

import { revalidatePath } from 'next/cache'

import type { StudioFormState } from '@/components/studio/form-state'
import { requirePermission } from '@/lib/auth/require'
import { isEnabled } from '@/lib/flags'
import { createAdminClient } from '@/lib/supabase/admin'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'
import { createResearchRun, cancelResearchRun } from '@/lib/supabase/repositories/research/runs'
import { getResearchSource } from '@/lib/supabase/repositories/research/sources'
import {
  enqueueWorkItems,
  retryFailedWorkItems,
} from '@/lib/supabase/repositories/research/work-items'
import { createClient } from '@/lib/supabase/server'
import { readJobScope } from '@/lib/scraper/workflows/schedule'

/**
 * Starting, cancelling and retrying a run.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, so `requirePermission` is the first
 * statement of each. `research.write` — owner, admin, researcher — operates the pipeline; a
 * merchandiser holds `research.confirm` and judges its output, and cannot start a run.
 *
 * THE SOURCE GATE IS RE-CHECKED HERE EVEN THOUGH THE ROW ENFORCES IT. A run against a source that
 * is disabled or unapproved would be created and then never drained, leaving a QUEUED row that
 * looks like work in progress and is not. Refusing at the action means the operator is told why
 * instead of watching a run that never starts.
 *
 * THE URLS ARE CHECKED AGAINST THE SOURCE'S OWN ORIGIN. A run whose seed URL points somewhere else
 * would fetch a host nobody approved — the approval is per source, and a source is a website. This
 * is the one validation that cannot be delegated to the database, because it is a relationship
 * between two columns on different tables.
 */

function issue(message: string, code: string): StudioFormState {
  return { status: 'error', issues: [{ field: '_form', code, message }] }
}

function refusal(error: unknown): StudioFormState {
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      issues: error.issues.map((i) => ({ field: i.path, code: 'invalid', message: i.message })),
    }
  }
  if (error instanceof PermissionError) return issue('You cannot do that.', 'forbidden')
  return issue('That was refused. Nothing was changed.', 'refused')
}

export async function startRunAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')

    if (!(await isEnabled('research_enabled'))) {
      return issue(
        'Research is switched off, so a run would never fetch anything. Turn it on under System › Feature flags first.',
        'disabled',
      )
    }

    const sourceId = String(form.get('source_id') ?? '')
    if (sourceId === '') return issue('Choose a source.', 'required')

    const client = await createClient()
    const source = await getResearchSource(client, sourceId)
    if (source === null) return issue('That source could not be found.', 'not_found')

    if (source.policy_status !== 'APPROVED') {
      return issue(
        'That source has not been approved for reading. An owner or admin records the policy review before it can be used.',
        'unapproved',
      )
    }
    if (!source.is_enabled) {
      return issue('That source is switched off.', 'disabled')
    }

    const urls = String(form.get('urls') ?? '')
      .split(/\s+/)
      .map((value) => value.trim())
      .filter((value) => value !== '')

    const scope = readJobScope({ seedUrls: urls, maxDepth: 0 })
    if (scope.seedUrls.length === 0) {
      return issue('Give at least one URL to fetch.', 'required')
    }

    // EVERY URL MUST BE ON THE SOURCE'S OWN HOST. See the header: approval is per website.
    const origin = new URL(source.base_url).host.toLowerCase()
    const offHost = scope.seedUrls.filter((url) => {
      try {
        return new URL(url).host.toLowerCase() !== origin
      } catch {
        return true
      }
    })
    if (offHost.length > 0) {
      return issue(
        `Those URLs are not on ${origin}: ${offHost.slice(0, 3).join(', ')}. A source is approved for one website.`,
        'off_host',
      )
    }

    const isDryRun = form.get('dry_run') === 'on'

    const admin = createAdminClient()
    const runId = await createResearchRun(admin, {
      jobId: null,
      sourceId,
      trigger: 'MANUAL',
      requestedBy: session.userId,
      isDryRun,
    })
    await enqueueWorkItems(admin, {
      runId,
      sourceId,
      urls: scope.seedUrls,
      depth: 0,
      notBefore: new Date(),
    })

    revalidatePath('/studio/research/runs')
    revalidatePath('/studio/research/dashboard')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function cancelRunAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    await requirePermission('research.write')
    const runId = String(form.get('run_id') ?? '')
    if (runId === '') return issue('That run could not be identified.', 'required')

    const client = await createClient()
    await cancelResearchRun(client, runId)

    revalidatePath('/studio/research/runs')
    /*
     * WHAT CANCELLING ACTUALLY DOES IS SAID BESIDE THE BUTTON, NOT AFTERWARDS. It does not abort a
     * request already in flight — the drain loop checks between items, so at most one more page is
     * fetched — and that is a fact an operator needs BEFORE they press, which is why it is
     * `studio.research.cancelNote` on the control rather than a message in the response.
     * `StudioFormState` carries no message field, and this is one of the cases where that
     * constraint pushed the copy to the better place.
     */
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

export async function retryFailedAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    await requirePermission('research.write')
    const runId = String(form.get('run_id') ?? '')
    if (runId === '') return issue('That run could not be identified.', 'required')

    const client = await createClient()
    await retryFailedWorkItems(client, runId)

    revalidatePath('/studio/research/runs')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
