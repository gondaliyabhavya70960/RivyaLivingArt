'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { roleHasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require'
import { isEnabled } from '@/lib/flags'
import {
  extraRunPermission,
  isSheetEntity,
  requiresScope,
  validateColumns,
  FILTER_SCHEMAS,
} from '@/lib/sheets/definitions'
import { SheetsError } from '@/lib/sheets/errors'
import { runDefinition } from '@/lib/sheets/run'
import { validateSchedule } from '@/lib/sheets/schedule'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConflictError } from '@/lib/supabase/errors'
import {
  createDefinition,
  getDefinition,
  setDefinitionEnabled,
  setDefinitionPaused,
  updateDefinition,
} from '@/lib/supabase/repositories/sheets'
import { exportDefinitionInputSchema } from '@/lib/supabase/schemas/sheets'
import { createClient } from '@/lib/supabase/server'

/**
 * The Sheets page's actions — Phase 36.
 *
 * MANAGE AND RUN ARE TWO PERMISSIONS, CHECKED AS THE FIRST LINE OF EVERY ACTION. Creating, editing,
 * pausing and resuming a definition is `integrations.sheets.manage` (owner, admin) and RLS says the
 * same at the table. Running is `integrations.sheets.run`, plus the entity's extra permission —
 * `inquiries.export` for enquiries — checked by a second `requirePermission`, which writes the
 * DENIED audit row the phase document asks for when a researcher tries the enquiry export.
 *
 * THE FLAG IS CHECKED BEFORE ANY NETWORK CALL. With `google_sheets` off the run action returns the
 * flag reason and touches nothing.
 */

const PATH = '/studio/research/sheets'

const ok = (): StudioFormState => ({ status: 'saved' })
const issue = (message: string, code = 'refused'): StudioFormState => ({
  status: 'error',
  issues: [{ field: '_form', code, message }],
})

const uuid = z.string().uuid()

function refresh(): void {
  revalidatePath(PATH)
  revalidatePath('/studio/operations/exports')
}

export async function saveDefinitionAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const session = await requirePermission('integrations.sheets.manage')

  const entityRaw = form.get('entity')
  if (!isSheetEntity(entityRaw)) return issue('Choose an entity.', 'required')
  const entity = entityRaw

  const columns = form
    .getAll('columns')
    .map((value) => String(value))
    .filter((value) => value !== '')
  const includesPii = String(form.get('includes_pii') ?? '') === 'true'
  const validated = validateColumns(entity, columns, includesPii)
  if (!validated.ok) {
    return issue(
      'A column outside the entity’s allowlist was named, or a personal-data column without the flag.',
      'invalid',
    )
  }

  const schedule = String(form.get('schedule') ?? 'MANUAL').trim() || 'MANUAL'
  const scheduleCheck = validateSchedule(schedule)
  if (!scheduleCheck.ok) return issue(scheduleCheck.error, 'invalid')

  let filter: Record<string, unknown>
  try {
    const raw = String(form.get('filter') ?? '').trim()
    const parsedJson: unknown = raw === '' ? {} : JSON.parse(raw)
    filter = FILTER_SCHEMAS[entity].parse(parsedJson)
  } catch {
    return issue('The filter is not valid JSON for this entity.', 'invalid')
  }

  const scopeRaw = String(form.get('scope_id') ?? '').trim()
  const scopeId = scopeRaw === '' ? null : uuid.safeParse(scopeRaw).success ? scopeRaw : undefined
  if (scopeId === undefined) return issue('The scope must be a comparison set id.', 'invalid')
  if (requiresScope(entity) && scopeId === null) {
    return issue('The comparison-set entity needs a set id as its scope.', 'required')
  }

  const spreadsheetRaw = String(form.get('spreadsheet_id') ?? '').trim()
  const parsed = exportDefinitionInputSchema.safeParse({
    slug: String(form.get('slug') ?? ''),
    name: String(form.get('name') ?? ''),
    entity,
    scopeId,
    columns: [...validated.columns],
    filter,
    spreadsheetId: spreadsheetRaw === '' ? null : spreadsheetRaw,
    tabName: String(form.get('tab_name') ?? ''),
    schedule,
    includesPii,
  })
  if (!parsed.success) {
    return {
      status: 'error',
      issues: parsed.error.issues.map((entry) => ({
        field: entry.path.join('.') || '_form',
        code: 'invalid',
        message: entry.message,
      })),
    }
  }

  const client = await createClient()
  const definitionId = form.get('definition_id')
  try {
    if (typeof definitionId === 'string' && uuid.safeParse(definitionId).success) {
      await updateDefinition(client, definitionId, { ...parsed.data, actorUserId: session.userId })
    } else {
      await createDefinition(client, { ...parsed.data, actorUserId: session.userId })
    }
  } catch (error) {
    if (error instanceof ConflictError) {
      return issue('That slug is already used by another definition.', 'conflict')
    }
    throw error
  }
  refresh()
  return ok()
}

export async function runNowAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const session = await requirePermission('integrations.sheets.run')
  const id = uuid.safeParse(form.get('definition_id'))
  if (!id.success) return issue('That definition could not be identified.', 'required')

  const admin = createAdminClient()
  const definition = await getDefinition(admin, id.data)
  if (definition === null) return issue('That definition could not be found.', 'missing')

  // THE ENTITY'S EXTRA PERMISSION, checked so the refusal is audited (DENIED) like any other.
  const extra = extraRunPermission(definition.entity)
  if (!roleHasPermission(session.role, extra)) await requirePermission(extra)

  if (!(await isEnabled('google_sheets'))) {
    return issue('The google_sheets flag is off. Nothing was written.', 'flag_off')
  }

  try {
    await runDefinition(admin, {
      definitionId: definition.id,
      trigger: 'MANUAL',
      actor: { userId: session.userId, role: session.role },
      flagEnabled: true,
    })
  } catch (error) {
    if (error instanceof SheetsError) return issue(error.message, error.code.toLowerCase())
    throw error
  }
  refresh()
  return ok()
}

async function setPaused(form: FormData, paused: boolean): Promise<StudioFormState> {
  const session = await requirePermission('integrations.sheets.manage')
  const id = uuid.safeParse(form.get('definition_id'))
  if (!id.success) return issue('That definition could not be identified.', 'required')
  const client = await createClient()
  await setDefinitionPaused(client, id.data, {
    paused,
    reason: paused ? 'PAUSED' : null,
    actorUserId: session.userId,
  })
  refresh()
  return ok()
}

export async function pauseAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  return setPaused(form, true)
}

export async function resumeAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  return setPaused(form, false)
}

export async function setEnabledAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  const session = await requirePermission('integrations.sheets.manage')
  const id = uuid.safeParse(form.get('definition_id'))
  if (!id.success) return issue('That definition could not be identified.', 'required')
  const enabled = String(form.get('enabled') ?? '') === 'true'
  const client = await createClient()
  await setDefinitionEnabled(client, id.data, { enabled, actorUserId: session.userId })
  refresh()
  return ok()
}
