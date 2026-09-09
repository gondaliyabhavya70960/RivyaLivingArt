'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { type StudioFormState } from '@/components/studio/form-state'
import { fieldOptions } from '@/lib/cms/forms'
import { withAudit, writeAudit } from '@/lib/auth/audit'
import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { ConflictError, PermissionError, ValidationError } from '@/lib/supabase/errors'
import {
  addBinding,
  deleteField,
  deleteStep,
  getFormById,
  insertField,
  insertStep,
  removeBinding,
  setFieldOrder,
  setStepOrder,
  updateFieldRow,
  updateFormRow,
  updateStepRow,
} from '@/lib/supabase/repositories/customization-forms'
import { createClient } from '@/lib/supabase/server'

/**
 * The form builder's Server Actions.
 *
 * `'use server'` PUBLISHES EVERY EXPORT AS AN HTTP ENDPOINT, so `requirePermission` inside each one
 * is the only check that runs for a request that never touched the page. Every action here calls it
 * first, and every write goes through a repository that reads its row back — because RLS FILTERS an
 * update rather than refusing one, and a filtered write returns no error at all.
 *
 * PUBLICATION IS `catalog.publish`, EVERYTHING ELSE IS `catalog.write`, DELETION IS
 * `destructive.execute`. That is the same split the products editor uses and the same one the
 * generated policies enforce: a merchandiser builds and publishes forms, only an owner or an
 * administrator removes a step somebody has already answered.
 *
 * THE PUBLISH BLOCKERS ARE COMPUTED HERE AND ENFORCED IN THE DATABASE. `enforce_form_publishable()`
 * is the rule; this file states the same three conditions in advance so the editor is told what is
 * missing BEFORE pressing publish rather than after. The two agree, and if they ever stop agreeing
 * the trigger wins — which is the right way round, because the trigger also runs for a write that
 * never came through this screen.
 *
 * ORDER IS SET FOR THE WHOLE LIST AT ONCE, never one row at a time. Each PostgREST write is its own
 * transaction, so ten individual position updates are ten transactions racing the trigger that
 * renumbers them, and the last to land decides. `setStepOrder` and `setFieldOrder` hand the entire
 * sequence to a single statement.
 *
 * NOTHING HERE EDITS `validation`. The column carries an allowlist CHECK — nine Zod keys, and
 * `price_multiplier` is not among them — and the seeded templates set what they need. A free-text
 * JSON box on this screen would be an editor's only way to trip that CHECK, and its refusal names a
 * constraint rather than a field. Phase 20 revisits it with a typed control per key.
 */

export type FormBuilderActionState = StudioFormState

const issue = (message: string, code: string, field = '_form'): FormBuilderActionState => ({
  status: 'error',
  issues: [{ field, code, message }],
})

function refusalMessage(error: unknown): string {
  if (error instanceof AuthenticationError) return 'Your session has expired. Sign in again.'
  if (error instanceof AuthorizationError) return 'You do not have permission to do that.'
  if (error instanceof PermissionError) return 'You do not have permission to do that.'
  if (error instanceof ConflictError) return 'That address or key is already in use on this form.'
  // A trigger's wording names internal identifiers, so the refusals an editor can act on are
  // spelled out beside the controls that raise them rather than passed through from the database.
  if (error instanceof ValidationError) return 'That change was refused: check the values entered.'
  return 'That change could not be saved.'
}

function text(form: FormData, name: string): string | null {
  const value = form.get(name)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** An unchecked checkbox submits nothing at all — its absence is the value. */
function checkbox(form: FormData, name: string): boolean {
  return form.get(name) !== null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuid(form: FormData, name: string): string | null {
  const value = text(form, name)
  if (value === null) return null
  return UUID.test(value) ? value : null
}

const editorPath = (formId: string) => `/studio/catalog/customization-forms/${formId}`
const LIST = '/studio/catalog/customization-forms'

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const keySchema = z.string().regex(/^[a-z][a-z0-9_]*$/)
/** `GROUP.key` — the shape `customization_forms_submit_label_key_shape` enforces. */
const labelKeySchema = z.string().regex(/^[A-Z][A-Z_]*\.[a-z0-9_.]+$/)
const kindSchema = z.enum(['FURNITURE', 'PRESERVATION', 'THREE_D_RESIN', 'CUSTOM'])
const fieldTypeSchema = z.enum([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DIMENSION',
  'SELECT',
  'MULTISELECT',
  'RADIO',
  'CHECKBOX',
  'COLOUR_DIRECTION',
  'FILE',
  'CITY',
  'CONTACT_NAME',
  'CONTACT_PHONE',
  'CONTACT_EMAIL',
])

/** The four types a visitor picks from a list, and therefore the four that need choices. */
const CHOICE_TYPES = new Set(['SELECT', 'MULTISELECT', 'RADIO', 'COLOUR_DIRECTION'])

/**
 * Choices, typed as `value | label` one per line.
 *
 * A TEXTAREA RATHER THAN A JSON BOX. The column takes `[{"value": "...", "label": "..."}]` and
 * `enforce_form_field_shape()` checks every element, so a mistyped brace would come back as a
 * trigger error naming a field key. One pair per line cannot be mistyped into a different shape.
 *
 * A LINE WITH NO BAR IS BOTH HALVES. "Round" becomes `{value: "round", label: "Round"}` — the
 * common case, written the shortest way, with the machine-readable half derived rather than typed
 * twice and allowed to disagree.
 */
function parseOptions(raw: string | null): {
  options: { value: string; label: string }[]
  invalid: string[]
} {
  if (raw === null) return { options: [], invalid: [] }
  const options: { value: string; label: string }[] = []
  const invalid: string[] = []

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    const bar = trimmed.indexOf('|')
    const label = bar === -1 ? trimmed : trimmed.slice(bar + 1).trim()
    const value =
      bar === -1
        ? trimmed
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
        : trimmed.slice(0, bar).trim()

    if (value === '' || label === '') invalid.push(trimmed)
    else options.push({ value, label })
  }

  return { options, invalid }
}

/**
 * The positions submitted by one order form, sorted into a sequence of ids.
 *
 * The inputs are named `order:<uuid>` so the ids travel with their numbers and nothing depends on
 * the order the browser serialises them in. Ties keep the order the page rendered, which is the
 * behaviour an editor who numbered two rows the same expects: the one that was already first stays
 * first rather than swapping on save.
 */
function submittedOrder(form: FormData): string[] {
  const entries: { id: string; position: number; seen: number }[] = []
  let seen = 0

  for (const [name, value] of form.entries()) {
    if (!name.startsWith('order:')) continue
    const id = name.slice('order:'.length)
    if (!UUID.test(id)) continue
    const position = Number.parseInt(typeof value === 'string' ? value : '', 10)
    entries.push({
      id,
      position: Number.isFinite(position) ? position : Number.MAX_SAFE_INTEGER,
      seen,
    })
    seen += 1
  }

  entries.sort((a, b) => a.position - b.position || a.seen - b.seen)
  return entries.map((entry) => entry.id)
}

// -------------------------------------------------------------------------------------------------
// The form itself
// -------------------------------------------------------------------------------------------------

export async function saveFormAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const id = uuid(form, 'id')
    if (id === null) return issue('That form could not be identified.', 'id_missing')

    const name = text(form, 'name')
    if (name === null) return issue('A form needs a name.', 'name_required', 'name')

    const slug = (text(form, 'slug') ?? '').toLowerCase()
    if (!slugSchema.safeParse(slug).success) {
      return issue(
        'An address is lower-case letters, digits and single hyphens.',
        'slug_shape',
        'slug',
      )
    }

    const kind = kindSchema.safeParse(text(form, 'kind') ?? '')
    if (!kind.success) return issue('That is not a kind of form.', 'kind_unknown', 'kind')

    const submitLabelKey = text(form, 'submit_label_key')
    if (submitLabelKey !== null && !labelKeySchema.safeParse(submitLabelKey).success) {
      return issue(
        'A submit key looks like CTA.send_an_enquiry — a group in capitals, a dot, then the key.',
        'label_key_shape',
        'submit_label_key',
      )
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.update',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_forms',
        entityId: id,
      },
      async () =>
        updateFormRow(client, id, {
          name,
          slug,
          kind: kind.data,
          description: text(form, 'description'),
          intro_heading: text(form, 'intro_heading'),
          intro_body: text(form, 'intro_body'),
          submit_label_key: submitLabelKey,
          is_default: checkbox(form, 'is_default'),
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

/**
 * Offer this form to visitors.
 *
 * THE THREE BLOCKERS ARE READ FROM THE FORM ITSELF, not guessed. They restate
 * `enforce_form_publishable()` so the editor sees every missing piece at once, with the reason,
 * instead of discovering them one refusal at a time.
 */
export async function publishFormAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.publish')
    const id = uuid(form, 'id')
    if (id === null) return issue('That form could not be identified.', 'id_missing')

    const client = await createClient()
    const resolved = await getFormById(client, id)
    if (resolved === null) return issue('That form could not be found.', 'not_found')

    const blockers: { code: string; message: string }[] = []
    const contact = resolved.steps.find(
      (entry) => entry.step.key === 'contact' && entry.step.is_enabled,
    )

    if (contact === undefined) {
      blockers.push({
        code: 'no_contact_step',
        message:
          'This form has no enabled step keyed "contact". A brief that arrives with nobody to reply to cannot be answered.',
      })
    } else if (
      !contact.fields.some(
        (field) =>
          field.is_enabled &&
          (field.field_type === 'CONTACT_PHONE' || field.field_type === 'CONTACT_EMAIL'),
      )
    ) {
      blockers.push({
        code: 'no_contact_field',
        message:
          'The contact step asks for neither a phone number nor an email address, so a completed brief could not be answered.',
      })
    }

    const emptyChoices = resolved.steps
      .flatMap((entry) => entry.fields)
      .filter(
        (field) =>
          field.is_enabled &&
          CHOICE_TYPES.has(field.field_type) &&
          fieldOptions(field).length === 0,
      )
      .map((field) => field.key)

    if (emptyChoices.length > 0) {
      blockers.push({
        code: 'empty_choices',
        message: `These questions offer no choices, so a visitor would see a control with nothing in it: ${emptyChoices.join(', ')}.`,
      })
    }

    if (blockers.length > 0) {
      await writeAudit({
        action: 'catalog.form.publish',
        result: 'DENIED',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_forms',
        entityId: id,
        summary: `Publication refused: ${blockers.map((blocker) => blocker.code).join(', ')}`,
      })
      return {
        status: 'error',
        issues: blockers.map((blocker) => ({ field: 'publish', ...blocker })),
      }
    }

    await withAudit(
      {
        action: 'catalog.form.publish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_forms',
        entityId: id,
        summary: `Published customization form ${resolved.form.slug}`,
      },
      async () =>
        updateFormRow(client, id, {
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
          published_by: session.userId,
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    revalidatePath(LIST)
    revalidatePath('/custom-commissions')
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

/** Take the form off the site. No gate: withdrawing is always safe and never argues. */
export async function unpublishFormAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.publish')
    const id = uuid(form, 'id')
    if (id === null) return issue('That form could not be identified.', 'id_missing')

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.unpublish',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_forms',
        entityId: id,
      },
      async () =>
        updateFormRow(client, id, {
          status: 'DRAFT',
          published_at: null,
          published_by: null,
          updated_by: session.userId,
        }),
    )

    revalidatePath(editorPath(id))
    revalidatePath(LIST)
    revalidatePath('/custom-commissions')
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

// -------------------------------------------------------------------------------------------------
// Steps
// -------------------------------------------------------------------------------------------------

/**
 * Create a step, or save one that exists. One action, because they are the same form.
 *
 * THE KEY IS SET ONCE AND NEVER EDITED. `customization_form_fields` does not reference it, but the
 * database knows one key by name — `contact` — and the seed runner matches its rows by `seed_key`.
 * A key that could be renamed would silently detach a seeded step from the template that owns it.
 */
export async function saveStepAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const formId = uuid(form, 'form_id')
    if (formId === null) return issue('That form could not be identified.', 'form_id_missing')

    const title = text(form, 'title')
    if (title === null) return issue('A step needs a title.', 'title_required', 'title')

    const stepId = uuid(form, 'id')
    const client = await createClient()

    if (stepId === null) {
      const key = (text(form, 'key') ?? '').toLowerCase()
      if (!keySchema.safeParse(key).success) {
        return issue(
          'A key is lower-case letters, digits and underscores, starting with a letter.',
          'key_shape',
          'key',
        )
      }

      await withAudit(
        {
          action: 'catalog.form.step.create',
          actorUserId: session.userId,
          actorRole: session.role,
          entityType: 'customization_form_steps',
          summary: `Added step ${key}`,
        },
        async () =>
          insertStep(client, {
            form_id: formId,
            key,
            title,
            description: text(form, 'description'),
            is_enabled: checkbox(form, 'is_enabled'),
            is_required: checkbox(form, 'is_required'),
            updated_by: session.userId,
          }),
      )
    } else {
      await withAudit(
        {
          action: 'catalog.form.step.update',
          actorUserId: session.userId,
          actorRole: session.role,
          entityType: 'customization_form_steps',
          entityId: stepId,
        },
        async () =>
          updateStepRow(client, stepId, {
            title,
            description: text(form, 'description'),
            is_enabled: checkbox(form, 'is_enabled'),
            is_required: checkbox(form, 'is_required'),
            updated_by: session.userId,
          }),
      )
    }

    revalidatePath(editorPath(formId))
    return { status: 'saved' }
  } catch (error) {
    // `customization_form_steps_contact_enabled` refuses a disabled contact step at the column, and
    // that refusal is worth its own sentence: the checkbox looks like every other checkbox.
    if (error instanceof ValidationError || error instanceof ConflictError) {
      const raw = error.message
      if (/contact/i.test(raw)) {
        return issue(
          'The contact step cannot be switched off. Without it a completed brief arrives with no way to reply.',
          'contact_required',
          'is_enabled',
        )
      }
    }
    return issue(refusalMessage(error), 'refused')
  }
}

/** Remove a step and everything asked on it. `destructive.execute` — owner and administrator. */
export async function deleteStepAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('destructive.execute')
    const formId = uuid(form, 'form_id')
    const stepId = uuid(form, 'id')
    if (formId === null || stepId === null) {
      return issue('That step could not be identified.', 'id_missing')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.step.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_form_steps',
        entityId: stepId,
      },
      async () => deleteStep(client, stepId),
    )

    revalidatePath(editorPath(formId))
    return { status: 'saved' }
  } catch (error) {
    if (error instanceof ValidationError && /contact/i.test(error.message)) {
      return issue(
        'The contact step cannot be deleted while the form has one. It is the step that makes a brief answerable.',
        'contact_required',
      )
    }
    return issue(refusalMessage(error), 'refused')
  }
}

/** Renumber every step in one statement. The contact step is forced last by the database. */
export async function reorderStepsAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const formId = uuid(form, 'form_id')
    if (formId === null) return issue('That form could not be identified.', 'form_id_missing')

    const ordered = submittedOrder(form)
    if (ordered.length === 0) return { status: 'saved' }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.step.reorder',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_forms',
        entityId: formId,
        summary: `Reordered ${ordered.length} steps`,
      },
      async () => setStepOrder(client, formId, ordered),
    )

    revalidatePath(editorPath(formId))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

// -------------------------------------------------------------------------------------------------
// Questions
// -------------------------------------------------------------------------------------------------

export async function saveFieldAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const formId = uuid(form, 'form_id')
    const stepId = uuid(form, 'step_id')
    if (formId === null || stepId === null) {
      return issue('That question could not be placed.', 'id_missing')
    }

    const label = text(form, 'label')
    if (label === null) return issue('A question needs wording.', 'label_required', 'label')

    const fieldType = fieldTypeSchema.safeParse(text(form, 'field_type') ?? '')
    if (!fieldType.success)
      return issue('That is not an answer type.', 'type_unknown', 'field_type')

    const { options, invalid } = parseOptions(
      typeof form.get('options') === 'string' ? (form.get('options') as string) : null,
    )
    if (invalid.length > 0) {
      return issue(
        `A choice is written as "value | Label", and both halves must have something in them. Check: ${invalid.join(' / ')}.`,
        'options_shape',
        'options',
      )
    }

    const fieldId = uuid(form, 'id')
    const client = await createClient()

    const shared = {
      label,
      help_text: text(form, 'help_text'),
      placeholder: text(form, 'placeholder'),
      field_type: fieldType.data,
      options,
      is_enabled: checkbox(form, 'is_enabled'),
      is_required: checkbox(form, 'is_required'),
      include_in_whatsapp: checkbox(form, 'include_in_whatsapp'),
      updated_by: session.userId,
    }

    if (fieldId === null) {
      const key = (text(form, 'key') ?? '').toLowerCase()
      if (!keySchema.safeParse(key).success) {
        return issue(
          'A key is lower-case letters, digits and underscores, starting with a letter.',
          'key_shape',
          'key',
        )
      }

      await withAudit(
        {
          action: 'catalog.form.field.create',
          actorUserId: session.userId,
          actorRole: session.role,
          entityType: 'customization_form_fields',
          summary: `Added question ${key}`,
        },
        async () => insertField(client, { form_id: formId, step_id: stepId, key, ...shared }),
      )
    } else {
      await withAudit(
        {
          action: 'catalog.form.field.update',
          actorUserId: session.userId,
          actorRole: session.role,
          entityType: 'customization_form_fields',
          entityId: fieldId,
        },
        async () => updateFieldRow(client, fieldId, shared),
      )
    }

    revalidatePath(editorPath(formId))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

export async function deleteFieldAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('destructive.execute')
    const formId = uuid(form, 'form_id')
    const fieldId = uuid(form, 'id')
    if (formId === null || fieldId === null) {
      return issue('That question could not be identified.', 'id_missing')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.field.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_form_fields',
        entityId: fieldId,
      },
      async () => deleteField(client, fieldId),
    )

    revalidatePath(editorPath(formId))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

/** Renumber one step's questions in a single statement. */
export async function reorderFieldsAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const formId = uuid(form, 'form_id')
    const stepId = uuid(form, 'step_id')
    if (formId === null || stepId === null) {
      return issue('That step could not be identified.', 'id_missing')
    }

    const ordered = submittedOrder(form)
    if (ordered.length === 0) return { status: 'saved' }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.field.reorder',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'customization_form_steps',
        entityId: stepId,
        summary: `Reordered ${ordered.length} questions`,
      },
      async () => setFieldOrder(client, stepId, ordered),
    )

    revalidatePath(editorPath(formId))
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

// -------------------------------------------------------------------------------------------------
// Bindings
// -------------------------------------------------------------------------------------------------

/**
 * Offer this form somewhere.
 *
 * EXACTLY ONE TARGET, checked here and again by `product_customization_forms_one_target`. Two
 * selects are shown and one must be left empty: a row naming both would be ambiguous about which
 * binding wins, and a row naming neither would sit in the table looking like a binding.
 */
export async function addBindingAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const formId = uuid(form, 'form_id')
    if (formId === null) return issue('That form could not be identified.', 'form_id_missing')

    const productId = uuid(form, 'product_id')
    const categoryId = uuid(form, 'category_id')

    if (productId === null && categoryId === null) {
      return issue('Choose a product or a category to bind this form to.', 'target_missing')
    }
    if (productId !== null && categoryId !== null) {
      return issue(
        'Choose one or the other. A form bound to a product and a category at once would be ambiguous about which binding wins.',
        'target_ambiguous',
      )
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.binding.create',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_customization_forms',
        summary: `Bound form to ${productId === null ? 'category' : 'product'}`,
      },
      async () => addBinding(client, formId, { productId, categoryId }, session.userId),
    )

    revalidatePath(editorPath(formId))
    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}

export async function removeBindingAction(
  _previous: FormBuilderActionState,
  form: FormData,
): Promise<FormBuilderActionState> {
  try {
    const session = await requirePermission('catalog.write')
    const formId = uuid(form, 'form_id')
    const bindingId = uuid(form, 'id')
    if (formId === null || bindingId === null) {
      return issue('That binding could not be identified.', 'id_missing')
    }

    const client = await createClient()
    await withAudit(
      {
        action: 'catalog.form.binding.delete',
        actorUserId: session.userId,
        actorRole: session.role,
        entityType: 'product_customization_forms',
        entityId: bindingId,
      },
      async () => removeBinding(client, bindingId),
    )

    revalidatePath(editorPath(formId))
    revalidatePath(LIST)
    return { status: 'saved' }
  } catch (error) {
    return issue(refusalMessage(error), 'refused')
  }
}
