'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { CHANGE_FIELDS, type ChangeField } from '@/lib/scraper/analytics/materiality'
import { upsertChangeRule } from '@/lib/supabase/repositories/research/change-rules'

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

/**
 * Create or retune one materiality threshold.
 *
 * `research.write`, THE OPERATING HALF OF THE PHASE 04 SPLIT. A threshold decides how loudly a
 * source is read, which is a parsing decision about somebody else's page — not a verdict about a
 * product, which is `research.confirm`. The write then goes through the SESSION client, so RLS
 * judges it a second time rather than a service-role key carrying it past a bug in this check.
 *
 * A THRESHOLD IS A PROPORTION OR A SIMILARITY AND BOTH LIVE IN [0, 1]. Parsed here so the person
 * gets a sentence, and constrained at the row so a hand-written INSERT gets the same answer. An
 * empty field is null rather than zero: zero is a threshold meaning "everything is material", and
 * null means "not a question of degree", which is what `variant_count` and `sku` genuinely are.
 */
export async function saveChangeRuleAction(
  _previous: StudioFormState,
  form: FormData,
): Promise<StudioFormState> {
  try {
    const session = await requirePermission('research.write')

    const field = String(form.get('field') ?? '')
    if (!CHANGE_FIELDS.includes(field as ChangeField)) {
      return issue('That is not a field this pipeline diffs.', 'invalid')
    }

    const rawSource = String(form.get('source_id') ?? '')
    const sourceId = rawSource === '' || rawSource === '__global__' ? null : rawSource
    if (sourceId !== null && !z.string().uuid().safeParse(sourceId).success) {
      return issue('That source could not be identified.', 'required')
    }

    const threshold = (name: string): number | null | 'invalid' => {
      const raw = String(form.get(name) ?? '').trim()
      if (raw === '') return null
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0 || value > 1) return 'invalid'
      return value
    }

    const material = threshold('material_threshold')
    const minor = threshold('minor_threshold')
    if (material === 'invalid' || minor === 'invalid') {
      return issue('A threshold is a proportion between 0 and 1.', 'invalid')
    }

    const status = String(form.get('status') ?? 'DRAFT') === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
    const isEnabled = String(form.get('is_enabled') ?? '') === 'true'

    const client = await createClient()
    await upsertChangeRule(client, {
      sourceId,
      field: field as ChangeField,
      materialThreshold: material,
      minorThreshold: minor,
      isEnabled,
      status,
      actorUserId: session.userId,
    })

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'research.change_rule.save',
      result: 'SUCCESS',
      entityType: 'research_change_rules',
      entityId: sourceId ?? 'global',
      // THE FIELD AND THE NUMBERS, WHICH ARE NOT SECRETS AND ARE THE WHOLE POINT OF THE ROW. A
      // threshold change that nobody can attribute is a queue that quietly went quiet.
      summary: `${field}: material ${String(material)}, minor ${String(minor)}, ${status}`,
    })

    revalidatePath(DATA_QUALITY_PATH)
    revalidatePath('/studio/research/changes')
    return { status: 'saved' }
  } catch (error) {
    return refusal(error)
  }
}
