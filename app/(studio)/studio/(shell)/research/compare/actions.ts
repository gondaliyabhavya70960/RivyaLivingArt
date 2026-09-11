'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { requirePermission } from '@/lib/auth/require'
import { logActivity } from '@/lib/logging/activity'
import { fixedEdges } from '@/lib/scraper/analytics/bands'
import { resolveSetScope, snapshotScope } from '@/lib/scraper/workflows/analytics'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConflictError, PermissionError, ValidationError } from '@/lib/supabase/errors'
import {
  addMember,
  createComparisonSet,
  deleteComparisonSet,
  getComparisonSet,
  listMembers,
  removeMember,
  reorderMembers,
  updateComparisonSet,
} from '@/lib/supabase/repositories/research/analytics'
import { createClient } from '@/lib/supabase/server'

/**
 * What a person may do to a comparison set, and the permission that governs it.
 *
 * EVERYTHING HERE IS `research.write` EXCEPT READING, WHICH IS `research.read`. Naming a set of
 * rows to look at judges none of them — no `disposition`, no `stage`, no `duplicate_of_id` is
 * written by this module — so it is the operating half of the Phase 04 split.
 *
 * SETS AND MEMBERS ARE WRITTEN AS THE PERSON. Every write below goes through the session client so
 * RLS judges it again. The one exception is `recomputeSetAction`, whose SNAPSHOT is written as the
 * system because the snapshot tables have no session write policy at all — a snapshot a session
 * could insert is a market figure nobody computed. The rows it reads are still read as the person,
 * so the result is exactly what that person could see.
 */

const COMPARE_PATH = '/studio/research/compare'

const ok = (): StudioFormState => ({ status: 'saved' })
const issue = (message: string, code = 'refused'): StudioFormState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

function refusal(error: unknown): StudioFormState {
  if (error instanceof PermissionError) return issue(t('studio.research.compareRefusalPermission'))
  if (error instanceof ValidationError || error instanceof ConflictError) {
    return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
  }
  throw error
}

const uuid = z.string().uuid()
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u)

function readEdges(raw: string): readonly number[] | null {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  if (parts.length === 0) return null
  const numbers = parts.map((part) => Number(part))
  if (numbers.some((value) => !Number.isInteger(value))) throw new RangeError('edges')
  return fixedEdges(numbers)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}

/** Create a set from the list page's form. Slug derives from the name when not typed. */
export async function createSetAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const name = String(form.get('name') ?? '').trim()
    if (name === '') return issue(t('studio.research.compareRefusalName'), 'required')
    const typedSlug = String(form.get('slug') ?? '').trim()
    const finalSlug = typedSlug === '' ? slugify(name) : typedSlug
    if (!slug.safeParse(finalSlug).success) {
      return issue(t('studio.research.compareRefusalSlug'), 'invalid')
    }
    const bandRule = String(form.get('band_rule') ?? 'QUANTILE') === 'FIXED' ? 'FIXED' : 'QUANTILE'
    let edges: readonly number[] | null = null
    if (bandRule === 'FIXED') {
      try {
        edges = readEdges(String(form.get('band_edges') ?? ''))
        if (edges === null) return issue(t('studio.research.compareRefusalEdges'), 'invalid')
      } catch {
        return issue(t('studio.research.compareRefusalEdges'), 'invalid')
      }
    }

    const client = await createClient()
    const created = await createComparisonSet(client, {
      name,
      slug: finalSlug,
      description: String(form.get('description') ?? '').trim() || null,
      scopeNote: String(form.get('scope_note') ?? '').trim() || null,
      bandRule,
      bandEdges: edges,
      actorUserId: session.userId,
    })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.comparison_set.create',
      result: 'SUCCESS',
      entityType: 'research_comparison_set',
      entityId: created.id,
      summary: name,
    })

    revalidatePath(COMPARE_PATH)
    redirect(`${COMPARE_PATH}/${created.id}`)
  } catch (error) {
    return refusal(error)
  }
}

export async function updateSetAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const setId = uuid.safeParse(form.get('set_id'))
    if (!setId.success) return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
    const name = String(form.get('name') ?? '').trim()
    if (name === '') return issue(t('studio.research.compareRefusalName'), 'required')
    const bandRule = String(form.get('band_rule') ?? 'QUANTILE') === 'FIXED' ? 'FIXED' : 'QUANTILE'
    let edges: readonly number[] | null = null
    if (bandRule === 'FIXED') {
      try {
        edges = readEdges(String(form.get('band_edges') ?? ''))
        if (edges === null) return issue(t('studio.research.compareRefusalEdges'), 'invalid')
      } catch {
        return issue(t('studio.research.compareRefusalEdges'), 'invalid')
      }
    }
    const client = await createClient()
    await updateComparisonSet(client, setId.data, {
      name,
      description: String(form.get('description') ?? '').trim() || null,
      scopeNote: String(form.get('scope_note') ?? '').trim() || null,
      bandRule,
      bandEdges: edges,
      actorUserId: session.userId,
    })
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.comparison_set.update',
      result: 'SUCCESS',
      entityType: 'research_comparison_set',
      entityId: setId.data,
      summary: name,
    })
    revalidatePath(`${COMPARE_PATH}/${setId.data}`)
    revalidatePath(COMPARE_PATH)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Delete a set. A PLAIN FORM ACTION, submitted by the confirm dialog's hidden form: the island
 * asks the question, the server performs the act, and there is no second delete path.
 */
export async function deleteSetFormAction(form: FormData): Promise<void> {
  const session = await requirePermission('research.write')
  const setId = uuid.safeParse(form.get('set_id'))
  if (!setId.success) return
  const client = await createClient()
  const existing = await getComparisonSet(client, setId.data)
  await deleteComparisonSet(client, setId.data)
  await writeAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'research.comparison_set.delete',
    result: 'SUCCESS',
    entityType: 'research_comparison_set',
    entityId: setId.data,
    summary: existing?.name ?? undefined,
  })
  revalidatePath(COMPARE_PATH)
  redirect(COMPARE_PATH)
}

/** Copy a set and its members under a new slug. Snapshots are not copied: a copy has no history yet. */
export async function duplicateSetAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const setId = uuid.safeParse(form.get('set_id'))
    if (!setId.success) return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
    const client = await createClient()
    const source = await getComparisonSet(client, setId.data)
    if (source === null) return issue(t('studio.research.compareRefusalGeneric'), 'missing')
    const copy = await createComparisonSet(client, {
      name: `${source.name} (copy)`,
      slug: `${source.slug}-copy-${Date.now().toString(36)}`,
      description: source.description,
      scopeNote: source.scope_note,
      bandRule: source.band_rule,
      bandEdges: source.band_edges,
      actorUserId: session.userId,
    })
    for (const member of await listMembers(client, source.id)) {
      await addMember(client, {
        setId: copy.id,
        memberType: member.member_type,
        sourceId: member.source_id,
        researchProductId: member.research_product_id,
        position: member.position,
        note: member.note,
        actorUserId: session.userId,
      })
    }
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.comparison_set.duplicate',
      result: 'SUCCESS',
      entityType: 'research_comparison_set',
      entityId: copy.id,
      summary: `from ${source.slug}`,
    })
    revalidatePath(COMPARE_PATH)
    redirect(`${COMPARE_PATH}/${copy.id}`)
  } catch (error) {
    return refusal(error)
  }
}

export async function addMemberAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const setId = uuid.safeParse(form.get('set_id'))
    if (!setId.success) return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
    const sourceId = String(form.get('source_id') ?? '').trim()
    const productId = String(form.get('research_product_id') ?? '').trim()
    const hasSource = uuid.safeParse(sourceId).success
    const hasProduct = uuid.safeParse(productId).success
    if (hasSource === hasProduct)
      return issue(t('studio.research.compareRefusalMember'), 'required')

    const client = await createClient()
    const members = await listMembers(client, setId.data)
    await addMember(client, {
      setId: setId.data,
      memberType: hasSource ? 'SOURCE' : 'RESEARCH_PRODUCT',
      sourceId: hasSource ? sourceId : null,
      researchProductId: hasProduct ? productId : null,
      position: members.length,
      note: String(form.get('note') ?? '').trim() || null,
      actorUserId: session.userId,
    })
    revalidatePath(`${COMPARE_PATH}/${setId.data}`)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

export async function removeMemberAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    await requirePermission('research.write')
    const setId = uuid.safeParse(form.get('set_id'))
    const memberId = uuid.safeParse(form.get('member_id'))
    if (!setId.success || !memberId.success) {
      return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
    }
    const client = await createClient()
    await removeMember(client, setId.data, memberId.data)
    revalidatePath(`${COMPARE_PATH}/${setId.data}`)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

/** Move one member up or down by swapping with its neighbour, then renumbering the whole list. */
export async function moveMemberAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    await requirePermission('research.write')
    const setId = uuid.safeParse(form.get('set_id'))
    const memberId = uuid.safeParse(form.get('member_id'))
    const direction = String(form.get('direction') ?? '')
    if (!setId.success || !memberId.success || (direction !== 'up' && direction !== 'down')) {
      return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
    }
    const client = await createClient()
    const ids = (await listMembers(client, setId.data)).map((member) => member.id)
    const index = ids.indexOf(memberId.data)
    const target = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || target < 0 || target >= ids.length) return ok()
    const reordered = [...ids]
    reordered[index] = ids[target]!
    reordered[target] = ids[index]!
    await reorderMembers(client, setId.data, reordered)
    revalidatePath(`${COMPARE_PATH}/${setId.data}`)
    return ok()
  } catch (error) {
    return refusal(error)
  }
}

/**
 * Recompute the three analyses over the set and store a snapshot.
 *
 * READ AS THE PERSON, WRITTEN AS THE SYSTEM — see the module header. `computed_by` records who
 * asked, and an activity line tells colleagues the numbers changed.
 */
export async function recomputeSetAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')
    const setId = uuid.safeParse(form.get('set_id'))
    if (!setId.success) return issue(t('studio.research.compareRefusalGeneric'), 'invalid')
    const client = await createClient()
    const set = await getComparisonSet(client, setId.data)
    if (set === null) return issue(t('studio.research.compareRefusalGeneric'), 'missing')

    const outcome = await snapshotScope(
      client,
      createAdminClient(),
      {
        scopeType: 'SET',
        scopeId: set.id,
        scope: await resolveSetScope(client, set.id),
        bandRule: set.band_rule,
        bandEdges: set.band_edges,
      },
      { computedBy: session.userId },
    )

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.comparison_set.recompute',
      result: 'SUCCESS',
      entityType: 'research_comparison_set',
      entityId: set.id,
      summary: `${String(outcome.rows)} rows, ${String(outcome.snapshotIds.length)} snapshots`,
    })
    await logActivity({
      action: 'research.comparison.recomputed',
      actorId: session.userId,
      actorRole: session.role,
      entityType: 'research_comparison_set',
      entityId: set.id,
      entityLabel: set.name,
      summary: `${String(outcome.rows)} rows`,
    })

    revalidatePath(`${COMPARE_PATH}/${set.id}`)
    revalidatePath(COMPARE_PATH)
    revalidatePath('/studio/research/dashboard')
    return ok()
  } catch (error) {
    return refusal(error)
  }
}
