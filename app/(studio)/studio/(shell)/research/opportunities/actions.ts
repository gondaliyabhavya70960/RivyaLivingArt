'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { requirePermission } from '@/lib/auth/require'
import { logActivity } from '@/lib/logging/activity'
import {
  MODEL_V1,
  SIGNAL_KEYS,
  scoringModelDocumentSchema,
  type ScoringModelDocument,
} from '@/lib/scraper/analytics/opportunity/model'
import { NoActiveModelError, scoreScope } from '@/lib/scraper/workflows/score'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConflictError, PermissionError, ValidationError } from '@/lib/supabase/errors'
import {
  activateModel,
  createDraftModel,
  getScoringModel,
  toScoringModel,
} from '@/lib/supabase/repositories/research/opportunity'
import { createClient } from '@/lib/supabase/server'

/**
 * Three acts, two permissions.
 *
 * RECOMPUTE IS `research.write` — operating the pipeline under whatever model is active. It reads
 * the rows as the person and writes the scores as the system, because the score tables have no
 * session write policy; `computed_by` records who asked.
 *
 * CREATING A DRAFT AND ACTIVATING IT ARE `research.score.manage` — owner and admin — because the
 * weights decide which competitor rows sort first. Activation is audited and the rank-movement
 * diff renders before the button (see `ScoringModelPanel`); the trigger freezes the definition
 * the moment the row leaves DRAFT.
 */

const OPP_PATH = '/studio/research/opportunities'
const uuid = z.string().uuid()

const ok = (): StudioFormState => ({ status: 'saved' })
const issue = (message: string, code = 'refused'): StudioFormState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusal(error: unknown): StudioFormState {
  if (error instanceof PermissionError) return issue(t('studio.research.compareRefusalPermission'))
  if (error instanceof ValidationError || error instanceof ConflictError)
    return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
  if (error instanceof NoActiveModelError)
    return issue(t('studio.research.oppRefusalNoModel'), 'invalid')
  throw error
}

export async function recomputeScoresAction(
  _previous: StudioFormState,
  _form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const client = await createClient()
    const outcome = await scoreScope(client, createAdminClient(), { computedBy: session.userId })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.score.recompute',
      result: 'SUCCESS',
      entityType: 'research_scoring_model',
      entityId: outcome.model.id,
      summary: `${outcome.model.version}: ${String(outcome.rows)} rows, ${String(outcome.scored)} scored, ${String(outcome.insufficient)} insufficient`,
    })
    revalidatePath(OPP_PATH)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

/** A new DRAFT from a weights form. The signal descriptions are v1's; only weights and the floor change. */
export async function createDraftModelAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.score.manage')
    const version = String(form.get('version') ?? '').trim()
    if (!/^v[0-9]+(\.[0-9]+)*$/u.test(version))
      return issue(t('studio.research.oppRefusalVersion'), 'invalid')
    const name = String(form.get('name') ?? '').trim() || version
    const minConfidence = Number(form.get('min_confidence') ?? '0.5')
    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      return issue(t('studio.research.oppRefusalWeights'), 'invalid')
    }
    const signals: ScoringModelDocument = MODEL_V1.map((signal) => {
      const raw = Number(form.get(`weight_${signal.key}`) ?? signal.weight)
      return { ...signal, weight: Number.isInteger(raw) ? raw : -1 }
    })
    const parsed = scoringModelDocumentSchema.safeParse(signals)
    if (!parsed.success || signals.some((signal) => !SIGNAL_KEYS.includes(signal.key))) {
      return issue(t('studio.research.oppRefusalWeights'), 'invalid')
    }
    const client = await createClient()
    const id = await createDraftModel(client, {
      version,
      name,
      description: null,
      signals: parsed.data,
      minConfidence,
      actorUserId: session.userId,
    })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.scoring_model.create',
      result: 'SUCCESS',
      entityType: 'research_scoring_model',
      entityId: id,
      summary: version,
    })
    revalidatePath(OPP_PATH)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

/** Activate a DRAFT. A plain form action the confirm island submits; the diff has rendered above it. */
export async function activateModelFormAction(form: FormData): Promise<void> {
  const session = await requirePermission('research.score.manage')
  const modelId = uuid.safeParse(form.get('model_id'))
  if (!modelId.success) return
  const client = await createClient()
  const row = await getScoringModel(client, modelId.data)
  if (row === null || row.lifecycle !== 'DRAFT') return
  const model = toScoringModel(row)
  await activateModel(client, model.id, session.userId)
  await writeAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'research.scoring_model.activate',
    result: 'SUCCESS',
    entityType: 'research_scoring_model',
    entityId: model.id,
    summary: model.version,
  })
  await logActivity({
    action: 'research.scoring_model.activated',
    actorId: session.userId,
    actorRole: session.role,
    entityType: 'research_scoring_model',
    entityId: model.id,
    entityLabel: model.version,
    summary: model.name,
  })
  revalidatePath(OPP_PATH)
}
