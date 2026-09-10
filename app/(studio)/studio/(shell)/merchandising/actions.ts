'use server'

import { revalidatePath } from 'next/cache'

import type { StudioFormState } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import { withAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import type { StaffSession } from '@/lib/auth/session'
import { D3_CATEGORY_SLUGS, OWNING_STUDIO_ROUTES } from '@/lib/cms/merchandising-register'
import { ConflictError, PermissionError } from '@/lib/supabase/errors'
import { insertActivityEvent } from '@/lib/supabase/repositories/activity'
import {
  listCategoriesForStudio,
  updateCategoryRow,
} from '@/lib/supabase/repositories/catalog-admin'
import { getSection, updateSection } from '@/lib/supabase/repositories/cms'
import {
  addEntry,
  getEntry,
  getSlotById,
  moveEntry,
  removeEntry,
  updateEntry,
  updateSlotSettings,
} from '@/lib/supabase/repositories/merchandising'
import { createClient } from '@/lib/supabase/server'
import type { MerchandisingSlot } from '@/lib/supabase/schemas'

/**
 * The merchandising screens' Server Actions — one file for the three editing screens, because the
 * slot editor is one component and its buttons are the same wherever a slot is drawn.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, so `requirePermission` inside each one
 * is the only check that runs, and every one calls it first. Reads and writes use the request's
 * own client so RLS refuses underneath the guard as well as beside it.
 *
 * NO SLOT IS EDITED FROM TWO PLACES, AND THE ACTION ENFORCES IT rather than the page. Every form
 * posts the Studio route it was drawn on, and the action refuses a slot whose
 * `owning_studio_route` is a different screen — so the featured slot cannot be curated through the
 * homepage screen's forms by editing a hidden field, and a future screen cannot quietly grow a
 * second editor for a slot.
 *
 * TWO ACTIONS NEED `content.write`, NOT `merchandising.write`: the hero still and the Selected Works
 * heading are `page_sections` rows, and the matrix gives those to owner, admin and editor. A
 * merchandiser sees the current values and a note; the controls are drawn only for a role that can
 * use them, and the action re-checks regardless.
 *
 * EVERY WRITE IS AUDITED AND RECORDED IN THE ACTIVITY FEED: `withAudit` for the log that answers
 * "who did what", `insertActivityEvent` for the feed the dashboard shows. The public surface the slot
 * appears on is revalidated after every write, so a curated piece shows the moment it is published
 * and not at the next cron tick.
 */

export type MerchActionState = StudioFormState

const issue = (message: string, code = 'refused'): MerchActionState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

/** The SQLSTATE or constraint name behind a repository error, when one is there to read. */
function dbSignal(error: unknown): string {
  const seen = new Set<unknown>()
  let current: unknown = error
  const parts: string[] = []
  while (current !== null && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const record = current as {
      code?: unknown
      message?: unknown
      cause?: unknown
      constraint?: unknown
    }
    if (typeof record.code === 'string') parts.push(record.code)
    if (typeof record.message === 'string') parts.push(record.message)
    if (typeof record.constraint === 'string') parts.push(record.constraint)
    current = record.cause
  }
  return parts.join(' ')
}

function refusalMessage(error: unknown): MerchActionState {
  if (error instanceof AuthenticationError) return issue('Your session has expired. Sign in again.')
  if (error instanceof AuthorizationError || error instanceof PermissionError) {
    return issue('You do not have permission to do that.', 'forbidden')
  }
  const signal = dbSignal(error)
  if (error instanceof ConflictError || signal.includes('merchandising_entries_unique_target')) {
    return issue(t('studio.merchandising.refusal.duplicate'), 'duplicate')
  }
  if (signal.includes('RV061')) return issue(t('studio.merchandising.refusal.type'), 'type')
  if (signal.includes('RV062')) return issue(t('studio.merchandising.refusal.concept'), 'concept')
  if (signal.includes('RV063') || signal.includes('RV065')) {
    return issue(t('studio.merchandising.refusal.missing'), 'missing')
  }
  if (signal.includes('merchandising_entries_window_ordered')) {
    return issue(t('studio.merchandising.refusal.window'), 'window')
  }
  if (signal.includes('merchandising_slots_rule_named')) {
    return issue(t('studio.merchandising.refusal.rule'), 'rule')
  }
  if (signal.includes('merchandising_slots_items_ordered')) {
    return issue(t('studio.merchandising.refusal.range'), 'range')
  }
  return issue(t('studio.merchandising.refusal.generic'))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function uuid(form: FormData, name: string): string | null {
  const value = text(form, name)
  return value !== null && UUID.test(value) ? value : null
}

/** A datetime-local value, or an ISO string, to ISO — or null for empty. Undefined for garbage. */
function moment(form: FormData, name: string): string | null | undefined {
  const value = text(form, name)
  if (value === null) return null
  const parsed = new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function owningRoute(form: FormData): string | null {
  const route = text(form, 'route')
  return route !== null && (OWNING_STUDIO_ROUTES as readonly string[]).includes(route)
    ? route
    : null
}

/** The slot, if this screen owns it. Null otherwise — and the caller says so. */
async function ownedSlot(
  client: Awaited<ReturnType<typeof createClient>>,
  slotId: string,
  route: string,
): Promise<MerchandisingSlot | null> {
  const slot = await getSlotById(client, slotId)
  if (slot === null || slot.owning_studio_route !== route) return null
  return slot
}

async function record(
  client: Awaited<ReturnType<typeof createClient>>,
  session: StaffSession,
  action: string,
  slot: MerchandisingSlot,
  entityId: string | null,
  summary: string,
): Promise<void> {
  await insertActivityEvent(client, {
    actor_id: session.userId,
    actor_role: session.role,
    action,
    entity_type: 'merchandising_slots',
    entity_id: slot.id,
    entity_label: slot.key,
    summary,
    metadata: { slot_key: slot.key, surface: slot.surface, entry_id: entityId },
  })
}

function revalidateSlot(slot: MerchandisingSlot): void {
  revalidatePath(slot.surface)
  revalidatePath(slot.owning_studio_route)
  revalidatePath('/studio/merchandising/scheduling')
}

// --- Entries -------------------------------------------------------------------------------------

/**
 * Add one entity to a slot. The entity arrives as `<TYPE>:<uuid>` from a single select, so a slot
 * admitting two types needs one control rather than two.
 */
export async function addEntryAction(
  _previous: MerchActionState,
  form: FormData,
): Promise<MerchActionState> {
  try {
    const session = await requirePermission('merchandising.write')
    const route = owningRoute(form)
    const slotId = uuid(form, 'slot_id')
    const entity = text(form, 'entity')
    if (route === null || slotId === null || entity === null) {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }
    const [type, id] = entity.split(':')
    if (type === undefined || id === undefined || !UUID.test(id)) {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }

    const client = await createClient()
    const slot = await ownedSlot(client, slotId, route)
    if (slot === null) return issue(t('studio.merchandising.refusal.slotOwner'), 'owner')
    if (!(slot.allowed_entity_types as readonly string[]).includes(type)) {
      return issue(t('studio.merchandising.refusal.type'), 'type')
    }

    const entry = await withAudit(
      {
        action: 'merchandising.entry.add',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'merchandising_slots',
        entityId: slot.id,
        summary: `Added ${type} ${id} to ${slot.key}`,
      },
      async () =>
        addEntry(
          client,
          {
            slotId: slot.id,
            entityType: type as MerchandisingSlot['allowed_entity_types'][number],
            entityId: id,
          },
          session.userId,
        ),
    )
    await record(
      client,
      session,
      'merchandising.entry.add',
      slot,
      entry.id,
      `Added ${type} to ${slot.key}`,
    )
    revalidateSlot(slot)
    return { status: 'saved' }
  } catch (error) {
    return refusalMessage(error)
  }
}

type EntryOp =
  'move_up' | 'move_down' | 'remove' | 'publish' | 'unpublish' | 'pin' | 'unpin' | 'window'

const ENTRY_OPS: readonly EntryOp[] = [
  'move_up',
  'move_down',
  'remove',
  'publish',
  'unpublish',
  'pin',
  'unpin',
  'window',
]

/**
 * Everything that can be done to one entry, keyed by `op`, so a row in the editor holds one form
 * state rather than seven. The window edit travels in the same form under `op = window`.
 */
export async function entryAction(
  _previous: MerchActionState,
  form: FormData,
): Promise<MerchActionState> {
  try {
    const session = await requirePermission('merchandising.write')
    const route = owningRoute(form)
    const entryId = uuid(form, 'entry_id')
    const op = text(form, 'op') as EntryOp | null
    if (route === null || entryId === null || op === null || !ENTRY_OPS.includes(op)) {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }

    const client = await createClient()
    const entry = await getEntry(client, entryId)
    if (entry === null) return issue(t('studio.merchandising.refusal.missing'), 'missing')
    const slot = await ownedSlot(client, entry.slot_id, route)
    if (slot === null) return issue(t('studio.merchandising.refusal.slotOwner'), 'owner')

    await withAudit(
      {
        action: `merchandising.entry.${op}`,
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'merchandising_entries',
        entityId: entry.id,
        summary: `${op} on ${slot.key}`,
      },
      async () => {
        switch (op) {
          case 'move_up':
            return moveEntry(client, entry.id, 'up')
          case 'move_down':
            return moveEntry(client, entry.id, 'down')
          case 'remove':
            return removeEntry(client, entry.id)
          case 'publish':
            return updateEntry(client, entry.id, { status: 'PUBLISHED' }, session.userId)
          case 'unpublish':
            return updateEntry(client, entry.id, { status: 'DRAFT' }, session.userId)
          case 'pin':
            return updateEntry(client, entry.id, { is_pinned: true }, session.userId)
          case 'unpin':
            return updateEntry(client, entry.id, { is_pinned: false }, session.userId)
          case 'window': {
            const publishAt = moment(form, 'publish_at')
            const unpublishAt = moment(form, 'unpublish_at')
            if (publishAt === undefined || unpublishAt === undefined) {
              throw new RangeError('merchandising_entries_window_ordered')
            }
            return updateEntry(
              client,
              entry.id,
              { publish_at: publishAt, unpublish_at: unpublishAt, note: text(form, 'note') },
              session.userId,
            )
          }
        }
      },
    )
    await record(
      client,
      session,
      `merchandising.entry.${op}`,
      slot,
      entry.id,
      `${op} on ${slot.key}`,
    )
    revalidateSlot(slot)
    return { status: 'saved' }
  } catch (error) {
    return refusalMessage(error)
  }
}

// --- Slot settings -------------------------------------------------------------------------------

export async function saveSlotSettingsAction(
  _previous: MerchActionState,
  form: FormData,
): Promise<MerchActionState> {
  try {
    const session = await requirePermission('merchandising.write')
    const route = owningRoute(form)
    const slotId = uuid(form, 'slot_id')
    if (route === null || slotId === null) {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }
    const client = await createClient()
    const slot = await ownedSlot(client, slotId, route)
    if (slot === null) return issue(t('studio.merchandising.refusal.slotOwner'), 'owner')

    const min = Number(text(form, 'min_items') ?? slot.min_items)
    const max = Number(text(form, 'max_items') ?? slot.max_items)
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 48) {
      return issue(t('studio.merchandising.refusal.range'), 'range')
    }
    const autoFill = form.get('auto_fill') === 'on' || form.get('auto_fill') === 'true'
    const rule = text(form, 'auto_fill_rule')
    if (autoFill && rule === null) return issue(t('studio.merchandising.refusal.rule'), 'rule')
    const mode = text(form, 'fallback_mode')
    if (mode !== 'EDITORIAL_BLOCK' && mode !== 'HIDE_SECTION' && mode !== 'SHOW_EMPTY_STATE') {
      return issue(t('studio.merchandising.refusal.generic'))
    }
    const fallbackSectionId = uuid(form, 'fallback_section_id')
    if (fallbackSectionId === null && text(form, 'fallback_section_id') !== null) {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }

    await withAudit(
      {
        action: 'merchandising.slot.settings',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'merchandising_slots',
        entityId: slot.id,
        summary: `Settings on ${slot.key}`,
      },
      async () =>
        updateSlotSettings(
          client,
          slot.id,
          {
            min_items: min,
            max_items: max,
            auto_fill: autoFill,
            auto_fill_rule: autoFill ? rule : null,
            fallback_mode: mode,
            fallback_section_id: fallbackSectionId,
          },
          session.userId,
        ),
    )
    await record(
      client,
      session,
      'merchandising.slot.settings',
      slot,
      null,
      `Settings on ${slot.key}`,
    )
    revalidateSlot(slot)
    return { status: 'saved' }
  } catch (error) {
    return refusalMessage(error)
  }
}

// --- Store: category order -----------------------------------------------------------------------

/**
 * SEED §13's order: Furniture · Collectible Design · 3D + Resin · Wall & Statement Art ·
 * Preservation · Décor · Gifts. Spaced by ten as the taxonomy seed spaces them.
 */
function recommendedOrder(slug: string): number | null {
  const index = (D3_CATEGORY_SLUGS as readonly string[]).indexOf(slug)
  return index === -1 ? null : (index + 1) * 10
}

/** SEED §56: Gifts or Décor above Furniture is the drift the guard exists to name. */
function invertsPriority(orderedSlugs: readonly string[]): boolean {
  const furniture = orderedSlugs.indexOf('furniture')
  if (furniture === -1) return false
  return ['gifts', 'decor'].some((slug) => {
    const at = orderedSlugs.indexOf(slug)
    return at !== -1 && at < furniture
  })
}

/**
 * Move one category one place. Refuses a move that puts Gifts or Décor above Furniture unless the
 * form carries `acknowledge`, which the control sends only after showing the SEED §56 warning —
 * "a warning appears before saving; save anyway" is exactly that two-step.
 */
export async function moveCategoryAction(
  _previous: MerchActionState,
  form: FormData,
): Promise<MerchActionState> {
  try {
    const session = await requirePermission('merchandising.write')
    const categoryId = uuid(form, 'category_id')
    const direction = text(form, 'direction')
    if (categoryId === null || (direction !== 'up' && direction !== 'down')) {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }
    const client = await createClient()
    const ordered = (await listCategoriesForStudio(client)).filter(
      (category) => category.parent_id === null,
    )
    const index = ordered.findIndex((category) => category.id === categoryId)
    if (index === -1) return issue(t('studio.merchandising.refusal.missing'), 'missing')
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= ordered.length) return { status: 'saved' }

    const next = [...ordered]
    const moving = next[index]
    const other = next[target]
    if (moving === undefined || other === undefined) return { status: 'saved' }
    next[index] = other
    next[target] = moving

    if (invertsPriority(next.map((category) => category.slug)) && form.get('acknowledge') !== '1') {
      return issue(t('studio.merchandising.store.priorityWarning'), 'priority')
    }

    // Swap the two sort orders; where they are equal, spread them so the column shows the intent.
    let a = moving.sort_order
    let b = other.sort_order
    if (a === b) {
      if (direction === 'up') b += 1
      else a += 1
    }
    await withAudit(
      {
        action: 'merchandising.store.reorder',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'categories',
        entityId: moving.id,
        summary: `Moved ${moving.slug} ${direction}`,
      },
      async () => {
        await updateCategoryRow(client, moving.id, { sort_order: b, updated_by: session.userId })
        await updateCategoryRow(client, other.id, { sort_order: a, updated_by: session.userId })
      },
    )
    await insertActivityEvent(client, {
      actor_id: session.userId,
      actor_role: session.role,
      action: 'merchandising.store.reorder',
      entity_type: 'categories',
      entity_id: moving.id,
      entity_label: moving.slug,
      summary: `Moved ${moving.name} ${direction}`,
      metadata: { direction },
    })
    revalidatePath('/collection')
    revalidatePath('/', 'layout')
    revalidatePath('/studio/merchandising/store')
    return { status: 'saved' }
  } catch (error) {
    return refusalMessage(error)
  }
}

export async function restoreCategoryOrderAction(
  _previous: MerchActionState,
  _form: FormData,
): Promise<MerchActionState> {
  try {
    const session = await requirePermission('merchandising.write')
    const client = await createClient()
    const categories = await listCategoriesForStudio(client)
    await withAudit(
      {
        action: 'merchandising.store.restore_order',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'categories',
        summary: 'Restored the SEED §13 category order',
      },
      async () => {
        for (const category of categories) {
          const order = recommendedOrder(category.slug)
          if (order === null || order === category.sort_order) continue
          await updateCategoryRow(client, category.id, {
            sort_order: order,
            updated_by: session.userId,
          })
        }
      },
    )
    await insertActivityEvent(client, {
      actor_id: session.userId,
      actor_role: session.role,
      action: 'merchandising.store.restore_order',
      entity_type: 'categories',
      entity_id: null,
      entity_label: null,
      summary: 'Restored the recommended category order',
      metadata: {},
    })
    revalidatePath('/collection')
    revalidatePath('/', 'layout')
    revalidatePath('/studio/merchandising/store')
    return { status: 'saved' }
  } catch (error) {
    return refusalMessage(error)
  }
}

// --- Homepage: the hero still and the Selected Works heading ----------------------------------------

/**
 * The two section edits the homepage screen owns so the owner need not move between screens.
 * `content.write`, because a `page_sections` row is content whatever screen edits it.
 */
export async function saveHeroStillAction(
  _previous: MerchActionState,
  form: FormData,
): Promise<MerchActionState> {
  try {
    const session = await requirePermission('content.write')
    const sectionId = uuid(form, 'section_id')
    if (sectionId === null) return issue(t('studio.merchandising.refusal.missing'), 'missing')
    const client = await createClient()
    const section = await getSection(client, sectionId)
    if (section === null || section.block_type !== 'hero') {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }
    const desktop = uuid(form, 'media_desktop_id')
    const mobile = uuid(form, 'media_mobile_id')
    await withAudit(
      {
        action: 'merchandising.homepage.hero',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'page_sections',
        entityId: section.id,
        summary: 'Homepage hero still',
      },
      async () =>
        updateSection(client, section.id, {
          media_desktop_id: desktop ?? section.media_desktop_id,
          media_mobile_id: mobile ?? section.media_mobile_id,
          updated_by: session.userId,
        }),
    )
    revalidatePath('/')
    revalidatePath('/studio/merchandising/homepage')
    return { status: 'saved' }
  } catch (error) {
    return refusalMessage(error)
  }
}

export async function saveSelectedWorksHeadingAction(
  _previous: MerchActionState,
  form: FormData,
): Promise<MerchActionState> {
  try {
    const session = await requirePermission('content.write')
    const sectionId = uuid(form, 'section_id')
    if (sectionId === null) return issue(t('studio.merchandising.refusal.missing'), 'missing')
    const client = await createClient()
    const section = await getSection(client, sectionId)
    if (section === null || section.block_type !== 'selected-works') {
      return issue(t('studio.merchandising.refusal.missing'), 'missing')
    }
    await withAudit(
      {
        action: 'merchandising.homepage.heading',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'page_sections',
        entityId: section.id,
        summary: 'Selected Works heading',
      },
      async () =>
        updateSection(client, section.id, {
          heading: text(form, 'heading'),
          updated_by: session.userId,
        }),
    )
    revalidatePath('/')
    revalidatePath('/studio/merchandising/homepage')
    return { status: 'saved' }
  } catch (error) {
    return refusalMessage(error)
  }
}
