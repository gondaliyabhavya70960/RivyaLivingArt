'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { StudioFormState } from '@/components/studio/form-state'
import { writeAudit } from '@/lib/auth/audit'
import { requirePermission } from '@/lib/auth/require'
import { lexiconEntrySchema } from '@/lib/scraper/normalization'
import { PermissionError, ValidationError } from '@/lib/supabase/errors'
import {
  deleteLexiconEntry,
  upsertLexiconEntry,
} from '@/lib/supabase/repositories/research/lexicon'
import { createClient } from '@/lib/supabase/server'

/**
 * Editing the parsing vocabulary.
 *
 * `research.write` TO EDIT, `destructive.execute` TO DELETE, and the second half is the permission
 * matrix's own choice rather than this file's. Disabling a term stops it matching and keeps the
 * row; DELETING one unmatches it on every stored row the next re-normalisation touches, which is
 * why the matrix puts it beside the other irreversible operations and why the editor offers
 * disabling first.
 *
 * THE CHECK MATCHES THE POLICY DELIBERATELY. A merchandiser holds `research.confirm` and not
 * `destructive.execute`; an action that admitted them here would pass its own gate and then be
 * refused by RLS, which reads on screen as a bug rather than as a boundary.
 *
 * THE PATTERNS ARE A COMMA-SEPARATED FIELD AND ARE PARSED HERE, not in the component. A form field
 * is a string; `text[]` is a column; the translation between them is a trust boundary and belongs
 * beside the permission check rather than beside the markup.
 */

const DATA_QUALITY_PATH = '/studio/operations/data-quality'

function issue(message: string, code: string, field = '_form'): StudioFormState {
  return { status: 'error', issues: [{ field, code, message }] }
}

function refusal(error: unknown): StudioFormState {
  if (error instanceof ValidationError) {
    return {
      status: 'error',
      issues: error.issues.map((entry) => ({
        field: entry.path,
        code: 'invalid',
        message: entry.message,
      })),
    }
  }
  if (error instanceof PermissionError) return issue('You cannot do that.', 'forbidden')
  return issue('That was refused. Nothing was changed.', 'refused')
}

export async function saveLexiconEntryAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')

    const patterns = String(form.get('patterns') ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== '')

    const parsed = lexiconEntrySchema.safeParse({
      token: String(form.get('token') ?? '')
        .trim()
        .toLowerCase(),
      patterns,
      family: String(form.get('family') ?? '').trim() || null,
      isEnabled: form.get('is_enabled') === 'on',
    })
    if (!parsed.success) {
      return {
        status: 'error',
        issues: parsed.error.issues.map((entry) => ({
          field: entry.path.length === 0 ? '_form' : String(entry.path[0]),
          code: 'invalid',
          message: entry.message,
        })),
      }
    }

    const client = await createClient()
    const id = await upsertLexiconEntry(client, {
      id: String(form.get('id') ?? '') || null,
      token: parsed.data.token,
      patterns: parsed.data.patterns,
      family: parsed.data.family,
      isEnabled: parsed.data.isEnabled,
      userId: session.userId,
    })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.lexicon.save',
      result: 'SUCCESS',
      entityType: 'research_material_lexicon',
      entityId: id,
      summary: `saved material term "${parsed.data.token}"`,
      after: { token: parsed.data.token, isEnabled: parsed.data.isEnabled },
    })

    revalidatePath(DATA_QUALITY_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}

const idSchema = z.string().uuid()

export async function deleteLexiconEntryAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('destructive.execute')
    const parsed = idSchema.safeParse(String(form.get('id') ?? ''))
    if (!parsed.success) return issue('That term could not be identified.', 'required')

    const client = await createClient()
    await deleteLexiconEntry(client, parsed.data)

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.lexicon.delete',
      result: 'SUCCESS',
      entityType: 'research_material_lexicon',
      entityId: parsed.data,
      summary: 'removed a material term',
    })

    revalidatePath(DATA_QUALITY_PATH)
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
