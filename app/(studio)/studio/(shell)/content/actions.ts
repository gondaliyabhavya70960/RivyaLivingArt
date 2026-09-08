'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { blockModuleFor } from '@/lib/cms/registry'
import { blockTypeSchema } from '@/lib/cms/block-types'
import { publishSection as publishSectionService } from '@/lib/cms/publishing'
import { restoreRevision as restoreRevisionService } from '@/lib/cms/revisions'
import { writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  contentStatusSchema,
  factClassificationSchema,
  ownerVerificationSchema,
} from '@/lib/supabase/schemas'
import {
  deleteSection,
  getSection,
  insertSection,
  isCmsRefusal,
  listSectionsForPage,
  reorderSections as reorderSectionsRow,
  updateSection,
} from '@/lib/supabase/repositories/cms'
import { getPageByIdOrSlug } from '@/lib/supabase/repositories/cms'
import { createClient } from '@/lib/supabase/server'

/**
 * The content editor's Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, which is why this is a separate file
 * from the repository and why every function below begins with `requirePermission`. A Server
 * Action passes through no page body, no layout and no proxy matcher: it is reachable with `curl`
 * and a session cookie, so the check inside it is the only one that runs.
 *
 * WRITES GO THROUGH THE REQUEST-SCOPED CLIENT, NOT THE SERVICE ROLE. The generated RLS policies on
 * `page_sections` already encode who may write what, and using the anon-key client means an editor
 * whose role was revoked between page load and save is refused by the database as well as by the
 * guard. The one exception is a STATUS transition, which must call `cms_publish_section` — granted
 * to `service_role` alone, deliberately, so a leaked anon key cannot publish. That path re-checks
 * the permission in `lib/cms/publishing.ts` before it reaches the service client.
 *
 * EVERY REFUSAL RETURNS A RESULT, NEVER THROWS. A thrown Server Action renders the error boundary
 * and loses the editor's unsaved form. The refusal codes RV001–RV007 carry the reason, and the
 * caller renders it beside the control that caused it.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { value?: undefined } : { value: T }))
  | { ok: false; error: string }

/** Turn any thrown error into a message an editor can act on, without leaking internals. */
function refusalMessage(error: unknown): string {
  if (isCmsRefusal(error)) return error.message
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  return 'That change could not be saved.'
}

/**
 * A page's public path, for revalidation.
 *
 * NULL FOR A SYSTEM PAGE, which has none — `pages.path` is nullable exactly so the reserved
 * `slug = 'global'` row cannot be served, and revalidating `null` would throw.
 */
async function pathOfPage(pageId: string): Promise<string | null> {
  const page = await getPageByIdOrSlug(await createClient(), pageId)
  return page?.path ?? null
}

/** Revalidate the Studio editor and, when the page is addressable, the public route. */
async function revalidateForPage(pageId: string): Promise<void> {
  revalidatePath(`/studio/content/pages/${pageId}`)
  const path = await pathOfPage(pageId)
  if (path !== null) revalidatePath(path)
}

// ---------------------------------------------------------------------------------------------
// Adding a block
// ---------------------------------------------------------------------------------------------

const createSchema = z.object({
  pageId: z.uuid(),
  blockType: blockTypeSchema,
})

export async function createSectionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requirePermission('content.write')

    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'That block type is not one this build knows.' }

    const block = blockModuleFor(parsed.data.blockType)
    /**
     * A PLANNED BLOCK CANNOT BE ADDED. It has no renderer, so adding one would put a section on a
     * page that the public site skips entirely — an editor would fill it in, publish, and see
     * nothing, with no error anywhere to explain why.
     */
    if (block === null || block.state !== 'BUILT') {
      return { ok: false, error: 'That block is in the catalogue but is not built yet.' }
    }

    const section = await insertSection(await createClient(), parsed.data.pageId, block.type, {
      // The block's own defaults, so a new section parses against its schema from the first render.
      payload: block.defaults as never,
      is_visible: true,
      updated_by: session.userId,
    })

    await writeAudit({
      action: 'content.section.create',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'page_sections',
      entityId: section.id,
      summary: `Added a ${block.label} block`,
    })

    await revalidateForPage(parsed.data.pageId)
    return { ok: true, value: { id: section.id } }
  } catch (error) {
    return { ok: false, error: refusalMessage(error) }
  }
}

// ---------------------------------------------------------------------------------------------
// Saving a section
// ---------------------------------------------------------------------------------------------

/**
 * `''` MEANS "CLEARED", AND BECOMES NULL. An HTML form cannot send "absent" for a text input the
 * editor emptied — it sends an empty string. Storing that would put a present-but-blank heading in
 * the database, which `SectionCopy` would then render as an empty element rather than skipping,
 * and which reads to every other query as "there is a heading" when there is not.
 */
const optionalText = z
  .string()
  .max(5000)
  .transform((value) => (value.trim() === '' ? null : value))
  .nullable()

const updateSchema = z.object({
  sectionId: z.uuid(),
  pageId: z.uuid(),
  isVisible: z.boolean(),
  theme: z.enum(['DEEP', 'INK', 'BONE']).nullable(),
  layoutVariant: z.string().max(80).nullable(),
  eyebrow: optionalText,
  heading: optionalText,
  headingHighlight: optionalText,
  body: optionalText,
  supporting: optionalText,
  ctaLabel: optionalText,
  ctaUrl: optionalText,
  ctaSecondaryLabel: optionalText,
  ctaSecondaryUrl: optionalText,
  mediaDesktopId: z.uuid().nullable(),
  mediaMobileId: z.uuid().nullable(),
  mediaAltOverride: optionalText,
  mediaSlotKey: z.string().max(200).nullable(),
  publishAt: z.string().nullable(),
  unpublishAt: z.string().nullable(),
  // The schemas of record, not a re-listing. Hand-copying these is how a form comes to offer a
  // classification the enum does not have — which is what the first draft of this file did.
  factClassification: factClassificationSchema,
  ownerVerification: ownerVerificationSchema,
  payload: z.unknown(),
})

export async function updateSectionAction(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission('content.write')

    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Some of those values were not valid.' }
    const v = parsed.data

    const client = await createClient()
    const existing = await getSection(client, v.sectionId)
    if (existing === null) return { ok: false, error: 'That section no longer exists.' }

    /**
     * THE PAYLOAD IS PARSED AGAINST THE BLOCK'S OWN SCHEMA, and a payload that fails is refused
     * rather than coerced to defaults. `parseBlockPayload` falls back on READ, because one stale
     * row must not take a page down; on WRITE the opposite is right — silently replacing what an
     * editor typed with a default would discard their work and tell them it saved.
     */
    const block = blockModuleFor(existing.block_type)
    if (block === null) return { ok: false, error: 'This build does not know that block type.' }
    const payload = block.schema.safeParse(v.payload ?? {})
    if (!payload.success) {
      return { ok: false, error: `This block's own fields are not valid: ${payload.error.message}` }
    }

    /**
     * 0054: a bound asset must name its slot, or every media gate in the system stops seeing the
     * binding. Caught here so the editor reads a sentence rather than a constraint name.
     */
    const bindsMedia = v.mediaDesktopId !== null || v.mediaMobileId !== null
    if (bindsMedia && (v.mediaSlotKey === null || v.mediaSlotKey.trim() === '')) {
      return {
        ok: false,
        error:
          'A section that uses an image must name its media slot, or the approval and ' +
          'verification checks cannot see the binding.',
      }
    }

    await updateSection(client, v.sectionId, {
      is_visible: v.isVisible,
      theme: v.theme,
      layout_variant: v.layoutVariant,
      eyebrow: v.eyebrow,
      heading: v.heading,
      heading_highlight: v.headingHighlight,
      body: v.body,
      supporting: v.supporting,
      cta_label: v.ctaLabel,
      cta_url: v.ctaUrl,
      cta_secondary_label: v.ctaSecondaryLabel,
      cta_secondary_url: v.ctaSecondaryUrl,
      media_desktop_id: v.mediaDesktopId,
      media_mobile_id: v.mediaMobileId,
      media_alt_override: v.mediaAltOverride,
      media_slot_key: bindsMedia ? v.mediaSlotKey : null,
      publish_at: v.publishAt,
      unpublish_at: v.unpublishAt,
      fact_classification: v.factClassification,
      owner_verification: v.ownerVerification,
      payload: payload.data as never,
      updated_by: session.userId,
    })

    await writeAudit({
      action: 'content.section.update',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'page_sections',
      entityId: v.sectionId,
      summary: existing.block_type,
    })

    await revalidateForPage(v.pageId)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: refusalMessage(error) }
  }
}

// ---------------------------------------------------------------------------------------------
// Removing, reordering, transitioning, restoring
// ---------------------------------------------------------------------------------------------

const deleteSchema = z.object({ sectionId: z.uuid(), pageId: z.uuid() })

export async function deleteSectionAction(input: unknown): Promise<ActionResult> {
  try {
    // `destructive.execute`, not `content.write`. Removing a section destroys copy that no
    // revision can put back on the page by itself — the trail keeps the snapshot, but the section
    // is gone — so it takes the same permission as any other irreversible act.
    const session = await requirePermission('destructive.execute')

    const parsed = deleteSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'That section could not be identified.' }

    await deleteSection(await createClient(), parsed.data.sectionId)

    await writeAudit({
      action: 'content.section.delete',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'page_sections',
      entityId: parsed.data.sectionId,
      summary: 'Section removed',
    })

    await revalidateForPage(parsed.data.pageId)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: refusalMessage(error) }
  }
}

const reorderSchema = z.object({
  pageId: z.uuid(),
  sectionIds: z.array(z.uuid()).min(1).max(200),
})

export async function reorderSectionsAction(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission('content.write')

    const parsed = reorderSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'That ordering could not be read.' }

    /**
     * `cms_reorder_sections` is SECURITY DEFINER and granted to `service_role` alone, because it
     * writes every position on the page in one statement under a deferrable unique constraint.
     * The permission was checked a line above; this is the only reason the admin client appears.
     */
    const count = await reorderSectionsRow(
      createAdminClient(),
      parsed.data.pageId,
      parsed.data.sectionIds,
      session.userId,
    )

    await writeAudit({
      action: 'content.section.reorder',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'pages',
      entityId: parsed.data.pageId,
      summary: `Reordered ${count} section(s)`,
    })

    await revalidateForPage(parsed.data.pageId)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: refusalMessage(error) }
  }
}

const transitionSchema = z.object({
  sectionId: z.uuid(),
  pageId: z.uuid(),
  from: contentStatusSchema,
  to: contentStatusSchema,
  changeSummary: z.string().max(500).nullable(),
})

export async function transitionSectionAction(input: unknown): Promise<ActionResult> {
  try {
    // No `requirePermission` here: `publishSection` resolves the edge to its own permission and
    // checks THAT. Checking `content.write` first would let an editor past the guard on an edge
    // that needs `content.publish`, and then be refused deeper down for a different reason.
    const parsed = transitionSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'That transition could not be read.' }

    const session = await requirePermission('content.read')

    await publishSectionService(
      {
        sectionId: parsed.data.sectionId,
        from: parsed.data.from,
        to: parsed.data.to,
        changeSummary: parsed.data.changeSummary,
      },
      {
        client: createAdminClient(),
        actorId: session.userId,
        revalidate: (paths) => {
          for (const path of paths) revalidatePath(path)
        },
      },
    )

    revalidatePath(`/studio/content/pages/${parsed.data.pageId}`)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: refusalMessage(error) }
  }
}

const restoreSchema = z.object({
  sectionId: z.uuid(),
  pageId: z.uuid(),
  revisionNo: z.number().int().positive(),
})

export async function restoreRevisionAction(input: unknown): Promise<ActionResult> {
  try {
    const session = await requirePermission('content.write')

    const parsed = restoreSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'That revision could not be identified.' }

    /**
     * `restoreRevision` decides its own permission from the section's CURRENT status — restoring
     * onto a live page needs `content.publish`, because it changes what the public sees without
     * passing through the status workflow. So the row is read first, and a section that vanished
     * between render and click is refused rather than restored into nothing.
     */
    const client = await createClient()
    const section = await getSection(client, parsed.data.sectionId)
    if (section === null) return { ok: false, error: 'That section no longer exists.' }

    await restoreRevisionService(
      {
        entityType: 'page_section',
        entityId: parsed.data.sectionId,
        revisionNo: parsed.data.revisionNo,
        currentStatus: section.status,
        path: await pathOfPage(parsed.data.pageId),
      },
      {
        client: createAdminClient(),
        actorId: session.userId,
        revalidate: (paths) => {
          for (const path of paths) revalidatePath(path)
        },
      },
    )

    await writeAudit({
      action: 'content.section.restore',
      result: 'SUCCESS',
      actorUserId: session.userId,
      actorRole: session.role,
      entityType: 'page_sections',
      entityId: parsed.data.sectionId,
      summary: `Restored revision ${parsed.data.revisionNo}`,
    })

    await revalidateForPage(parsed.data.pageId)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: refusalMessage(error) }
  }
}

/** Re-export so a client component can list sections without importing the repository. */
export async function listSectionsAction(pageId: string): Promise<ActionResult<number>> {
  try {
    await requirePermission('content.read')
    const sections = await listSectionsForPage(await createClient(), pageId)
    return { ok: true, value: sections.length }
  } catch (error) {
    return { ok: false, error: refusalMessage(error) }
  }
}
