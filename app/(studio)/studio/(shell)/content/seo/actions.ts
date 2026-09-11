'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { withAudit } from '@/lib/auth/audit'
import { roleHasPermission } from '@/lib/auth/permissions'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { optionalEnv } from '@/lib/env'
import { sameOriginCanonical, siteOrigin } from '@/lib/seo/canonical'
import { normaliseRedirectPath, validateRedirect } from '@/lib/seo/redirect-rules'
import { createClient } from '@/lib/supabase/server'
import { getSeoEntry } from '@/lib/supabase/repositories/cms'
import {
  deleteKeywordTheme,
  getKeywordTheme,
  insertKeywordTheme,
  updateKeywordTheme,
} from '@/lib/supabase/repositories/keywords'
import {
  deleteRedirect,
  getRedirect,
  insertRedirect,
  listRedirects,
  setRedirectStatus,
  updateRedirect,
} from '@/lib/supabase/repositories/redirects'
import {
  deleteSeoEntry,
  insertSeoEntry,
  isSeoEntityType,
  setSeoEntryStatus,
  updateGlobalString,
  updateSeoEntry,
  type SeoEntryTarget,
  type SeoEntryWrite,
} from '@/lib/supabase/repositories/seo'
import {
  keywordThemeInputSchema,
  redirectInputSchema,
  SITE_PATH_PATTERN,
  STRUCTURED_DATA_TYPES,
} from '@/lib/supabase/schemas/seo'

/**
 * The SEO workspace's actions — Phase 39.
 *
 * `seo.write` IS THE FIRST LINE OF EVERY WRITE, and RLS says the same at the table (the same three
 * roles under the name `content.write` on `seo_entries`, and under `seo.write` on the two new
 * tables — see `lib/auth/table-permissions.ts`). Publishing an entry additionally needs
 * `content.publish`, because the Phase 08 transition trigger will refuse the edge without it and
 * the refusal should be a sentence here rather than a constraint name from the database.
 *
 * NOTHING HERE BLOCKS A SAVE ON LENGTH. A 70-character title is editorial; the SERP preview shows
 * the 60/155 marks and warns, the action saves what the owner wrote.
 *
 * EVERY WRITE REVALIDATES THE ADDRESS IT CHANGED. A PATH row revalidates its path; an ENTITY row
 * revalidates the entity's address; the GLOBAL row revalidates the whole site layout's routes
 * through `/` and the listing paths, since every page reads it.
 */

const PATH = '/studio/content/seo'

const ok = (): StudioFormState => ({ status: 'saved' })
const issue = (message: string, code = 'refused', field = '_form'): StudioFormState => ({
  status: 'error',
  issues: [{ field, code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  return 'That change could not be saved.'
}

/** `''` is what an untouched input submits, and it means "not set". */
function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function checkbox(form: FormData, name: string): boolean {
  return form.get(name) !== null
}

const uuid = z.string().uuid()

function refresh(paths: readonly (string | null)[]): void {
  revalidatePath(PATH)
  for (const path of paths) if (path !== null) revalidatePath(path)
}

// --- entries ----------------------------------------------------------------------------------

function targetFrom(form: FormData): SeoEntryTarget | StudioFormState {
  const scope = text(form, 'scope')
  if (scope === 'GLOBAL') return { scope: 'GLOBAL' }
  if (scope === 'PATH') {
    const path = text(form, 'path')?.toLowerCase() ?? ''
    if (!SITE_PATH_PATTERN.test(path)) {
      return issue(
        'A path is site-relative: lowercase letters, digits, hyphens and slashes.',
        'path_shape',
        'path',
      )
    }
    return { scope: 'PATH', path }
  }
  if (scope === 'ENTITY') {
    const entityType = text(form, 'entity_type') ?? ''
    const entityId = text(form, 'entity_id') ?? ''
    if (!isSeoEntityType(entityType) || !uuid.safeParse(entityId).success) {
      return issue('The entity this entry belongs to could not be read.', 'entity_shape')
    }
    return { scope: 'ENTITY', entityType, entityId }
  }
  return issue('An entry is GLOBAL, for a path, or for an entity.', 'scope_shape')
}

function isState(value: SeoEntryTarget | StudioFormState): value is StudioFormState {
  return 'status' in value
}

function entryWrite(form: FormData): SeoEntryWrite | StudioFormState {
  const canonicalRaw = text(form, 'canonical_url')
  let canonical: string | null = null
  if (canonicalRaw !== null) {
    const origin = siteOrigin(optionalEnv('NEXT_PUBLIC_SITE_URL'))
    canonical = sameOriginCanonical(canonicalRaw, origin)
    if (canonical === null) {
      return issue(
        origin === null
          ? 'A canonical URL needs NEXT_PUBLIC_SITE_URL to be set, so it can be checked as the site’s own.'
          : `A canonical URL must be absolute and on ${origin}.`,
        'canonical_origin',
        'canonical_url',
      )
    }
  }
  const structured = text(form, 'structured_data_type')
  if (structured !== null && !(STRUCTURED_DATA_TYPES as readonly string[]).includes(structured)) {
    return issue(
      'That structured-data type is not on the allowlist.',
      'structured_type',
      'structured_data_type',
    )
  }
  const og = text(form, 'og_media_id')
  if (og !== null && !uuid.safeParse(og).success) {
    return issue('The social image could not be read.', 'og_shape', 'og_media_id')
  }
  return {
    title: text(form, 'title'),
    description: text(form, 'description'),
    social_title: text(form, 'social_title'),
    social_description: text(form, 'social_description'),
    og_media_id: og,
    canonical_url: canonical,
    structured_data_type: structured,
    noindex: checkbox(form, 'noindex'),
    nofollow: checkbox(form, 'nofollow'),
    derived: false,
  }
}

function pathOfTarget(target: SeoEntryTarget, form: FormData): string | null {
  if (target.scope === 'PATH') return target.path
  if (target.scope === 'ENTITY') return text(form, 'entity_path')
  return '/'
}

export async function saveSeoEntryAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    const client = await createClient()

    const target = targetFrom(form)
    if (isState(target)) return target
    const values = entryWrite(form)
    if ('status' in values) return values

    const id = text(form, 'id')
    const saved = await withAudit(
      {
        action: id === null ? 'seo.entry.create' : 'seo.entry.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_entries',
        entityId: id ?? undefined,
        summary: `${id === null ? 'Created' : 'Updated'} SEO entry ${target.scope} ${pathOfTarget(target, form) ?? ''}`,
        after: values as never,
      },
      async () =>
        id === null
          ? insertSeoEntry(client, target, values, session.userId)
          : updateSeoEntry(client, id, values, session.userId),
    )

    refresh([pathOfTarget(target, form)])
    // The form re-renders with the row it just made; the id is what the next save updates.
    void saved
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

export async function setSeoEntryStatusAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    if (!roleHasPermission(session.role, 'content.publish')) {
      await requirePermission('content.publish')
    }
    const client = await createClient()
    const id = text(form, 'id') ?? ''
    const status = text(form, 'status')
    if (!uuid.safeParse(id).success || (status !== 'PUBLISHED' && status !== 'DRAFT')) {
      return issue('The entry could not be read.', 'entry_shape')
    }
    const before = await getSeoEntry(client, id)
    await withAudit(
      {
        action: status === 'PUBLISHED' ? 'seo.entry.publish' : 'seo.entry.unpublish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_entries',
        entityId: id,
        summary: `${status === 'PUBLISHED' ? 'Published' : 'Unpublished'} SEO entry ${before.scope} ${before.path ?? before.entity_type ?? ''}`,
        before: { status: before.status },
        after: { status },
      },
      async () => setSeoEntryStatus(client, id, status, session.userId),
    )
    refresh([before.path, text(form, 'entity_path')])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

export async function deleteSeoEntryAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    // 0051 grants the delete to `destructive.execute` (owner, admin); an editor clears the fields
    // instead. Asking for the exact permission the policy names keeps the refusal honest.
    const session = await requirePermission('destructive.execute')
    const client = await createClient()
    const id = text(form, 'id') ?? ''
    if (!uuid.safeParse(id).success) return issue('The entry could not be read.', 'entry_shape')
    const before = await getSeoEntry(client, id)
    if (before.scope === 'GLOBAL')
      return issue('The site-wide entry cannot be deleted; edit it.', 'global_kept')
    await withAudit(
      {
        action: 'seo.entry.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_entries',
        entityId: id,
        summary: `Deleted SEO entry ${before.scope} ${before.path ?? before.entity_type ?? ''}`,
        before: before as never,
      },
      async () => deleteSeoEntry(client, id),
    )
    refresh([before.path, text(form, 'entity_path')])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

// --- the Global tab -----------------------------------------------------------------------------

const GLOBAL_STRINGS: readonly [field: string, group: string, key: string][] = [
  ['site_name', 'SEO_DEFAULT', 'site_name'],
  ['title_template', 'SEO_DEFAULT', 'title_template'],
  ['og_headline', 'SOCIAL', 'og_headline'],
  ['og_description', 'SOCIAL', 'og_description'],
]

export async function saveGlobalSeoAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    const client = await createClient()

    const template = text(form, 'title_template')
    if (template !== null && !template.includes('%s')) {
      return issue(
        'The title template needs a %s where the page title goes.',
        'template_placeholder',
        'title_template',
      )
    }
    const siteName = text(form, 'site_name')
    if (siteName === null) return issue('The site needs a name.', 'site_name_required', 'site_name')

    const values = entryWrite(form)
    if ('status' in values) return values
    const id = text(form, 'id')

    await withAudit(
      {
        action: 'seo.global.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_entries',
        entityId: id ?? undefined,
        summary: 'Updated the site-wide SEO defaults',
        after: { ...values, site_name: siteName, title_template: template } as never,
      },
      async () => {
        if (id === null) await insertSeoEntry(client, { scope: 'GLOBAL' }, values, session.userId)
        else await updateSeoEntry(client, id, values, session.userId)
        for (const [field, group, key] of GLOBAL_STRINGS) {
          const value = text(form, field)
          if (value !== null) await updateGlobalString(client, group, key, value, session.userId)
        }
      },
    )
    // Every page reads the defaults: the layout's own revalidation covers the static routes.
    refresh(['/', '/collection', '/journal', '/portfolio', '/large-format'])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

// --- keywords -----------------------------------------------------------------------------------

export async function saveKeywordThemeAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    const client = await createClient()

    const parsed = keywordThemeInputSchema.safeParse({
      theme: text(form, 'theme') ?? '',
      mapped_path: text(form, 'mapped_path')?.toLowerCase() ?? null,
      research_status: text(form, 'research_status') ?? 'UNRESEARCHED',
      notes: text(form, 'notes'),
      evidence_url: text(form, 'evidence_url'),
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return issue(
        first?.path[0] === 'evidence_url'
          ? 'An evidence link is a full URL, starting with https://.'
          : first?.path[0] === 'mapped_path'
            ? 'A mapped path is site-relative: lowercase letters, digits, hyphens and slashes.'
            : 'A theme needs a name.',
        'keyword_shape',
        String(first?.path[0] ?? '_form'),
      )
    }

    const id = text(form, 'id')
    await withAudit(
      {
        action: id === null ? 'seo.keyword.create' : 'seo.keyword.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_keyword_themes',
        entityId: id ?? undefined,
        summary: `${id === null ? 'Added' : 'Updated'} keyword theme ${parsed.data.theme}`,
        after: parsed.data,
      },
      async () => {
        if (id === null) return insertKeywordTheme(client, parsed.data, session.userId)
        const existing = await getKeywordTheme(client, id)
        const { theme: _theme, ...rest } = parsed.data
        return updateKeywordTheme(client, id, rest, session.userId, existing)
      },
    )
    refresh([])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

export async function deleteKeywordThemeAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    const client = await createClient()
    const id = text(form, 'id') ?? ''
    if (!uuid.safeParse(id).success) return issue('The theme could not be read.', 'keyword_shape')
    const before = await getKeywordTheme(client, id)
    await withAudit(
      {
        action: 'seo.keyword.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_keyword_themes',
        entityId: id,
        summary: `Removed keyword theme ${before.theme}`,
        before: before as never,
      },
      async () => deleteKeywordTheme(client, id),
    )
    refresh([])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

// --- redirects ----------------------------------------------------------------------------------

export async function saveRedirectAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    const client = await createClient()

    const parsed = redirectInputSchema.safeParse({
      from_path: normaliseRedirectPath(text(form, 'from_path') ?? ''),
      to_path: normaliseRedirectPath(text(form, 'to_path') ?? ''),
      status_code: Number(text(form, 'status_code') ?? '308'),
      reason: text(form, 'reason'),
    })
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '_form')
      return issue(
        'A redirect is two site-relative paths and a status of 301 or 308.',
        'redirect_shape',
        field,
      )
    }
    const id = text(form, 'id')
    const existing = await listRedirects(client)
    const verdict = validateRedirect(existing, {
      ...(id === null ? {} : { id }),
      from_path: parsed.data.from_path,
      to_path: parsed.data.to_path,
    })
    if (!verdict.ok) {
      return issue(
        verdict.message,
        `redirect_${verdict.code}`,
        verdict.code === 'shape' ? verdict.field : 'to_path',
      )
    }

    await withAudit(
      {
        action: id === null ? 'seo.redirect.create' : 'seo.redirect.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_redirects',
        entityId: id ?? undefined,
        summary: `${id === null ? 'Created' : 'Updated'} redirect ${parsed.data.from_path} → ${parsed.data.to_path}`,
        after: parsed.data,
      },
      async () =>
        id === null
          ? insertRedirect(client, parsed.data, session.userId)
          : updateRedirect(client, id, parsed.data, session.userId),
    )
    refresh([parsed.data.from_path])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

export async function setRedirectStatusAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    const client = await createClient()
    const id = text(form, 'id') ?? ''
    const status = text(form, 'status')
    if (!uuid.safeParse(id).success || (status !== 'PUBLISHED' && status !== 'DRAFT')) {
      return issue('The redirect could not be read.', 'redirect_shape')
    }
    const before = await getRedirect(client, id)
    await withAudit(
      {
        action: status === 'PUBLISHED' ? 'seo.redirect.resume' : 'seo.redirect.pause',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_redirects',
        entityId: id,
        summary: `${status === 'PUBLISHED' ? 'Resumed' : 'Paused'} redirect ${before.from_path}`,
        before: { status: before.status },
        after: { status },
      },
      async () => setRedirectStatus(client, id, status, session.userId),
    )
    refresh([before.from_path])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}

export async function deleteRedirectAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('seo.write')
    const client = await createClient()
    const id = text(form, 'id') ?? ''
    if (!uuid.safeParse(id).success)
      return issue('The redirect could not be read.', 'redirect_shape')
    const before = await getRedirect(client, id)
    await withAudit(
      {
        action: 'seo.redirect.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'seo_redirects',
        entityId: id,
        summary: `Deleted redirect ${before.from_path}`,
        before: before as never,
      },
      async () => deleteRedirect(client, id),
    )
    refresh([before.from_path])
    return ok()
  } catch (error) {
    return issue(refusalMessage(error))
  }
}
