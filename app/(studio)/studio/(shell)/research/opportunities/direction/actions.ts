'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { logActivity } from '@/lib/logging/activity'
import {
  EVIDENCE_TYPES,
  figuresFromSnapshotPayload,
  parseCaptured,
  type EvidenceType,
} from '@/lib/scraper/analytics/direction/capture'
import { ConflictError, PermissionError, ValidationError } from '@/lib/supabase/errors'
import {
  attachBriefEvidence,
  createDirectionBrief,
  detachBriefEvidence,
  getDirectionBrief,
  readComparisonSetRef,
  readMoodAsset,
  readNoteRef,
  readPairRef,
  readResearchProductRef,
  readScoreRef,
  readSnapshotRef,
  restoreBriefRevision,
  setDirectionBriefStatus,
  updateDirectionBriefBody,
} from '@/lib/supabase/repositories/research/direction'
import {
  BRIEF_SECTIONS,
  BRIEF_STATUSES,
  briefBodyInputSchema,
} from '@/lib/supabase/schemas/research-direction'
import { analyticsPayloadSchema } from '@/lib/supabase/schemas/research-analytics'
import { createClient } from '@/lib/supabase/server'

/**
 * The direction brief's acts, under two permissions.
 *
 * WRITING — creating a brief, saving its nine sections, attaching and detaching evidence, moving
 * between DRAFT and REVIEW, archiving, restoring a revision — is `research.direction.write`.
 * APPROVING is `research.direction.approve`, checked here and again by the trigger at the row.
 *
 * THE TOOL WRITES NO PROSE. Every section value below is exactly what the form carried; nothing is
 * suggested, filled or corrected. Evidence capture copies numbers, ids, names and dates from
 * research rows and nothing else. And NOTHING HERE IMPORTS THE PRODUCTS REPOSITORY — the
 * direction ↔ products barrier is a build gate.
 */

const LIST_PATH = '/studio/research/opportunities/direction'
const uuid = z.string().uuid()
const slugShape = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u)

const ok = (): StudioFormState => ({ status: 'saved' })
const issue = (message: string, code = 'refused'): StudioFormState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusal(error: unknown): StudioFormState {
  if (error instanceof PermissionError) return issue(t('studio.research.dirRefusalGeneric'))
  if (error instanceof ValidationError || error instanceof ConflictError)
    return issue(t('studio.research.dirRefusalGeneric'), 'invalid')
  throw error
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80)
}

function editorPath(briefId: string): string {
  return `${LIST_PATH}/${briefId}`
}

// --- create -------------------------------------------------------------------------------------

export async function createBriefAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  let briefId: string
  try {
    const session = await requirePermission('research.direction.write')
    const title = String(form.get('title') ?? '').trim()
    if (title === '') return issue(t('studio.research.dirRefusalTitle'), 'invalid')
    const typedSlug = String(form.get('slug') ?? '').trim()
    const slug = typedSlug === '' ? slugify(title) : typedSlug
    if (!slugShape.safeParse(slug).success)
      return issue(t('studio.research.dirRefusalSlug'), 'invalid')
    const client = await createClient()
    const brief = await createDirectionBrief(client, { slug, title, actorUserId: session.userId })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.direction.create',
      result: 'SUCCESS',
      entityType: 'research_direction_brief',
      entityId: brief.id,
      summary: title,
    })
    briefId = brief.id
  } catch (error) {
    if (error instanceof ConflictError) return issue(t('studio.research.dirRefusalSlug'), 'invalid')
    return refusal(error)
  }
  revalidatePath(LIST_PATH)
  redirect(editorPath(briefId) as Route)
}

// --- save the body ------------------------------------------------------------------------------

export async function saveBriefAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.direction.write')
    const briefId = uuid.safeParse(form.get('brief_id'))
    if (!briefId.success) return issue(t('studio.research.dirRefusalGeneric'), 'invalid')
    const raw: Record<string, unknown> = {
      title: String(form.get('title') ?? ''),
      target_category_slug: (() => {
        const value = String(form.get('target_category_slug') ?? '').trim()
        return value === '' ? null : value
      })(),
    }
    for (const section of BRIEF_SECTIONS) {
      const value = String(form.get(section) ?? '')
      raw[section] = value.trim() === '' ? null : value
    }
    const parsed = briefBodyInputSchema.safeParse(raw)
    if (!parsed.success) {
      const titleIssue = parsed.error.issues.some((entry) => entry.path[0] === 'title')
      return issue(
        titleIssue ? t('studio.research.dirRefusalTitle') : t('studio.research.dirRefusalGeneric'),
        'invalid',
      )
    }
    const client = await createClient()
    await updateDirectionBriefBody(client, briefId.data, parsed.data, session.userId)
    revalidatePath(editorPath(briefId.data))
    revalidatePath(LIST_PATH)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

// --- evidence -----------------------------------------------------------------------------------

async function capture(
  client: Awaited<ReturnType<typeof createClient>>,
  type: EvidenceType,
  id: string,
): Promise<Record<string, unknown> | null> {
  switch (type) {
    case 'COMPARISON_SET': {
      const set = await readComparisonSetRef(client, id)
      if (set === null) return null
      return parseCaptured('COMPARISON_SET', {
        name: set.name,
        slug: set.slug,
        memberCount: set.memberCount,
        lastComputedAt: set.last_computed_at,
      })
    }
    case 'ANALYTICS_SNAPSHOT': {
      const snapshot = await readSnapshotRef(client, id)
      if (snapshot === null) return null
      const payload = analyticsPayloadSchema.safeParse(snapshot.payload)
      return parseCaptured('ANALYTICS_SNAPSHOT', {
        metricFamily: snapshot.metric_family,
        scopeType: snapshot.scope_type,
        currency: snapshot.currency,
        computedAt: snapshot.computed_at,
        rowCount: snapshot.row_count,
        figures: payload.success ? figuresFromSnapshotPayload(payload.data) : [],
      })
    }
    case 'OPPORTUNITY_SCORE': {
      const score = await readScoreRef(client, id)
      if (score === null) return null
      return parseCaptured('OPPORTUNITY_SCORE', {
        researchProductId: score.research_product_id,
        score: score.score,
        confidence: Number(score.confidence),
        completeness: Number(score.completeness),
        state: score.state,
        modelVersion: score.model_version,
        computedAt: score.computed_at,
      })
    }
    case 'SIMILARITY_PAIR': {
      const pair = await readPairRef(client, id)
      if (pair === null) return null
      return parseCaptured('SIMILARITY_PAIR', {
        band: pair.band,
        distance: pair.distance,
        method: pair.method,
      })
    }
    case 'RESEARCH_PRODUCT': {
      const product = await readResearchProductRef(client, id)
      if (product === null) return null
      return parseCaptured('RESEARCH_PRODUCT', {
        title: product.title_normalized,
        sourceSlug: product.source_slug,
        stage: product.stage,
        priceState: product.price_state,
        scaleBand: product.scale_band,
      })
    }
    case 'RESEARCH_NOTE': {
      const note = await readNoteRef(client, id)
      if (note === null) return null
      return parseCaptured('RESEARCH_NOTE', {
        excerpt: note.body.slice(0, 200),
        createdAt: note.created_at,
      })
    }
    case 'MEDIA_ASSET': {
      const asset = await readMoodAsset(client, id)
      if (asset === null) return null
      return parseCaptured('MEDIA_ASSET', {
        rivyaAssetId: asset.rivya_asset_id,
        publicId: asset.public_id,
        isConcept: true,
        isAiGenerated: true,
      })
    }
    default:
      return null
  }
}

export async function attachEvidenceAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.direction.write')
    const briefId = uuid.safeParse(form.get('brief_id'))
    if (!briefId.success) return issue(t('studio.research.dirRefusalGeneric'), 'invalid')

    // Either the grouped select ("TYPE:id") or the by-id pair.
    let type: EvidenceType | null = null
    let evidenceId: string | null = null
    const ref = String(form.get('evidence_ref') ?? '')
    if (ref !== '') {
      const [head, tail] = ref.split(':', 2)
      if (EVIDENCE_TYPES.includes(head as EvidenceType)) type = head as EvidenceType
      evidenceId = tail ?? null
    } else {
      const head = String(form.get('evidence_type') ?? '')
      if (EVIDENCE_TYPES.includes(head as EvidenceType)) type = head as EvidenceType
      evidenceId = String(form.get('evidence_id') ?? '').trim()
    }
    const rationale = String(form.get('rationale') ?? '').trim()
    if (rationale === '') return issue(t('studio.research.dirRefusalRationale'), 'invalid')
    if (type === null || !uuid.safeParse(evidenceId).success || evidenceId === null) {
      return issue(t('studio.research.dirRefusalTarget'), 'invalid')
    }

    const client = await createClient()
    const captured = await capture(client, type, evidenceId)
    if (captured === null) return issue(t('studio.research.dirRefusalTarget'), 'invalid')
    await attachBriefEvidence(client, {
      briefId: briefId.data,
      evidenceType: type,
      evidenceId,
      captured,
      rationale,
      actorUserId: session.userId,
    })
    revalidatePath(editorPath(briefId.data))
    return ok()
  } catch (error) {
    if (error instanceof ConflictError)
      return issue(t('studio.research.dirRefusalTarget'), 'invalid')
    return refusal(error)
  }
}

export async function detachEvidenceFormAction(form: FormData): Promise<void> {
  await requirePermission('research.direction.write')
  const briefId = uuid.safeParse(form.get('brief_id'))
  const rowId = uuid.safeParse(form.get('evidence_row_id'))
  if (!briefId.success || !rowId.success) return
  const client = await createClient()
  await detachBriefEvidence(client, briefId.data, rowId.data)
  revalidatePath(editorPath(briefId.data))
}

// --- lifecycle ----------------------------------------------------------------------------------

export async function setBriefStatusFormAction(form: FormData): Promise<void> {
  const session = await requirePermission('research.direction.write')
  const briefId = uuid.safeParse(form.get('brief_id'))
  const status = z.enum(BRIEF_STATUSES).safeParse(form.get('status'))
  if (!briefId.success || !status.success) return
  if (
    status.data === 'APPROVED' &&
    !roleHasPermission(session.role, 'research.direction.approve')
  ) {
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.direction.approve',
      result: 'DENIED',
      entityType: 'research_direction_brief',
      entityId: briefId.data,
      summary: 'research.direction.approve is required.',
    })
    return
  }
  const client = await createClient()
  const brief = await getDirectionBrief(client, briefId.data)
  if (brief === null) return
  await setDirectionBriefStatus(client, briefId.data, status.data, session.userId)
  await writeAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: status.data === 'APPROVED' ? 'research.direction.approve' : 'research.direction.status',
    result: 'SUCCESS',
    entityType: 'research_direction_brief',
    entityId: briefId.data,
    summary: `${brief.status} → ${status.data}: ${brief.title}`,
  })
  if (status.data === 'APPROVED') {
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: 'research.direction.approved',
      entityType: 'research_direction_brief',
      entityId: briefId.data,
      summary: brief.title,
    })
  }
  revalidatePath(editorPath(briefId.data))
  revalidatePath(LIST_PATH)
}

export async function restoreRevisionFormAction(form: FormData): Promise<void> {
  const session = await requirePermission('research.direction.write')
  const briefId = uuid.safeParse(form.get('brief_id'))
  const revision = z.coerce.number().int().positive().safeParse(form.get('revision'))
  if (!briefId.success || !revision.success) return
  const client = await createClient()
  await restoreBriefRevision(client, briefId.data, revision.data, session.userId)
  revalidatePath(editorPath(briefId.data))
}
