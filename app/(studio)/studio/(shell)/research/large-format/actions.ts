'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { writeAudit } from '@/lib/auth/audit'
import { requirePermission } from '@/lib/auth/require'
import { SCALE_BANDS, classifyScale, type ScaleBand } from '@/lib/scraper/analytics/scale'
import { createAdminClient } from '@/lib/supabase/admin'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'
import { getResearchProduct } from '@/lib/supabase/repositories/research/products'
import {
  deleteSavedView,
  saveView,
  VIEW_SURFACES,
  type ViewSurface,
} from '@/lib/supabase/repositories/research/saved-views'
import { readScaleRules, writeClassification } from '@/lib/supabase/repositories/research/scale'
import { createClient } from '@/lib/supabase/server'

/**
 * What a person may do in the large-format workspace, and the permission that governs it.
 *
 * **EVERYTHING HERE IS `research.write`, AND NOTHING IS `research.confirm`.** A scale band says what
 * KIND of object a page describes; it carries no judgement about whether Rivya should care. The
 * Phase 04 split puts that with the normalised values — the operating half — and this phase writes
 * no `disposition`, no `duplicate_of_id` and no `stage`. The Phase 29 action bar on this screen is
 * the one that needs `research.confirm`, and it checks it in its own module.
 *
 * SAVED VIEWS ARE THE EXCEPTION AND THEY ARE `research.read`: a filter set is not a change to any
 * research row. Their security is the OWNER SCOPE in the policy, not the permission — which is why
 * every saved-view write below goes through the SESSION client and there is no admin path for them
 * at all. An admin client on that table would bypass exactly the check that matters.
 */

const ok = (): StudioFormState => ({ status: 'saved' })

const issue = (message: string, code = 'refused'): StudioFormState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusal(error: unknown): StudioFormState {
  if (error instanceof PermissionError) return issue('You do not have permission to do that.')
  if (error instanceof ValidationError)
    return issue('That could not be saved as written.', 'invalid')
  throw error
}

const LARGE_FORMAT_PATH = '/studio/research/large-format'
const uuid = z.string().uuid()

/**
 * Set a row's band or its large-format verdict by hand.
 *
 * **`large_format_source` BECOMES `EDITOR` AND THE ROW IS THEN FROZEN**, permanently, against every
 * later reclassification. A researcher correcting a band has made a judgement from evidence the
 * rules do not have — a photograph, the source's own copy, knowledge of the piece — and a threshold
 * edit two months later must not quietly undo it. `reclassify-scale.ts` skips the row and REPORTS
 * the skip, so somebody editing the rules learns how many rows their edit did not reach.
 *
 * THE LONGEST AXIS IS RE-DERIVED RATHER THAN TYPED. A person overrides the CLASSIFICATION, not the
 * measurement: `longest_axis_mm` is what the stored dimensions say, and letting it be typed would
 * put a number on the row that no page ever stated.
 */
export async function overrideScaleAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')

    const productId = uuid.safeParse(form.get('product_id'))
    if (!productId.success) return issue('That row could not be identified.', 'required')

    const rawBand = String(form.get('scale_band') ?? '')
    if (!(SCALE_BANDS as readonly string[]).includes(rawBand)) {
      return issue('That is not a scale band.', 'invalid')
    }
    const band = rawBand as ScaleBand

    const rawLarge = String(form.get('is_large_format') ?? '')
    // THREE-VALUED AT THE FORM TOO. "could not tell" is a choice a person can make, not the absence
    // of one.
    const isLarge = rawLarge === 'true' ? true : rawLarge === 'false' ? false : null

    const client = await createClient()
    const admin = createAdminClient()

    const row = await getResearchProduct(client, productId.data)
    if (row === null) return issue('That row could not be found.', 'missing')

    // Re-derived from the stored dimensions through the classifier, so an override never invents a
    // measurement. The rules' band is discarded; its longest axis is not.
    const rules = await readScaleRules(client)
    const derived = classifyScale(
      {
        dimensionsMm: row.dimensions_mm as never,
        dimensionParseState: (row.dimension_parse_state ?? 'ABSENT') as never,
        categoryIsLargeFormat: row.matched_category_id !== null,
      },
      rules,
    )

    /*
     * A ROW WITH NO MEASUREMENT MAY NOT BE GIVEN A VERDICT, EVEN BY HAND.
     *
     * `research_products_unmeasured_has_no_verdict` refuses it at the row, and refusing it here
     * turns a constraint name into a sentence. The rule is about the MEASUREMENT rather than the
     * band: a well-measured piece whose kind nobody can name is banded `UNKNOWN` and is still
     * confidently large or not, and forbidding that would push a confident answer into the bucket
     * reserved for unanswerable ones.
     */
    if (derived.longestAxisMm === null && isLarge !== null) {
      return issue(
        'This row has no measurement, so it cannot be marked large or not large. Correct its ' +
          'dimensions first.',
        'invalid',
      )
    }

    // See the header: RLS gates a table and not a column, and `research_products`' update policy is
    // written for `research.confirm`. The column split is the check above.
    await writeClassification(admin, {
      productId: productId.data,
      band,
      isLargeFormat: isLarge,
      longestAxisMm: derived.longestAxisMm,
      source: 'EDITOR',
      ruleId: null,
      actorUserId: session.userId,
    })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.scale.override',
      result: 'SUCCESS',
      entityType: 'research_product',
      entityId: productId.data,
      summary: `band ${band}, large ${String(isLarge)} — frozen against reclassification`,
    })

    revalidatePath(LARGE_FORMAT_PATH)
    revalidatePath('/studio/research/explorer')
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Save the filters on screen as a named view.
 *
 * THE FILTERS COME FROM HIDDEN FIELDS THE PAGE RENDERED, prefixed `filter_`, so what is saved is
 * exactly what a person is looking at. A save form with its own inputs would be a second way to
 * express the same state, and the two drift.
 */
export async function saveViewAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.read')

    const surface = String(form.get('surface') ?? '')
    if (!(VIEW_SURFACES as readonly string[]).includes(surface)) {
      return issue('That screen cannot hold saved views.', 'invalid')
    }

    const name = String(form.get('name') ?? '').trim()
    if (name === '') return issue('Give the view a name.', 'required')

    const filters: Record<string, string> = {}
    for (const [key, value] of form.entries()) {
      if (!key.startsWith('filter_')) continue
      const raw = String(value).trim()
      if (raw !== '') filters[key.slice('filter_'.length)] = raw
    }

    const client = await createClient()
    await saveView(client, {
      surface: surface as ViewSurface,
      name,
      filters,
      isShared: String(form.get('is_shared') ?? '') === 'true',
      ownerUserId: session.userId,
    })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.saved_view.save',
      result: 'SUCCESS',
      entityType: 'research_saved_views',
      entityId: surface,
      summary: name,
    })

    revalidatePath(LARGE_FORMAT_PATH)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Delete a view.
 *
 * NO OWNER CHECK IS WRITTEN HERE, and the absence is the design. The policy's owner scope is what
 * stops one person deleting another's view; a check here as well would read as the thing carrying
 * the security, and a later reader might reasonably conclude the policy could be relaxed.
 */
export async function deleteViewAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.read')
    const viewId = uuid.safeParse(form.get('view_id'))
    if (!viewId.success) return issue('That view could not be identified.', 'required')

    const client = await createClient()
    await deleteSavedView(client, viewId.data)

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.saved_view.delete',
      result: 'SUCCESS',
      entityType: 'research_saved_views',
      entityId: viewId.data,
      summary: 'removed a saved view',
    })

    revalidatePath(LARGE_FORMAT_PATH)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}
