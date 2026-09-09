import type { SupabaseClient } from '@supabase/supabase-js'

import type { ResolvedForm } from '@/lib/cms/forms'

import type { Database } from '../database.types'
import { PermissionError } from '../errors'
import {
  customizationFormFieldSchema,
  customizationFormSchema,
  customizationFormStepSchema,
  productCustomizationFormSchema,
  type CustomizationForm,
  type CustomizationFormField,
  type CustomizationFormStep,
  type ProductCustomizationForm,
} from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>
export type FormKind = Database['public']['Enums']['form_kind']
export type FormFieldType = Database['public']['Enums']['form_field_type']

const ENTITY = 'customization form'

/**
 * `customization_forms` and its three companions — the only module that reads or writes them.
 *
 * READS RETURN A RESOLVED FORM, NOT THREE LISTS. Every caller wants the same shape — steps in
 * order, each carrying its fields in order — and assembling it at each call site is how two
 * surfaces end up ordering the same form differently. `lib/cms/forms.ts` takes exactly this shape
 * and generates the validation from it, so the assembly happens once, here.
 *
 * VISIBILITY IS THE DATABASE'S. The public read uses the anonymous client and gets published forms
 * only, because `customization_forms_select_public` says so and the step and field policies test
 * the parent form. Nothing in this file filters on `status` for a public caller — that would be a
 * second copy of the rule, and the copy that drifts.
 */

interface FormRows {
  form: CustomizationForm
  steps: CustomizationFormStep[]
  fields: CustomizationFormField[]
}

/** Steps in order, each carrying its own fields in order. Disabled rows are KEPT — see below. */
function resolve(rows: FormRows): ResolvedForm {
  /*
   * DISABLED STEPS AND FIELDS ARE INCLUDED IN THE RESOLVED FORM, and that is deliberate rather
   * than lazy. The Studio builder has to show a disabled step in order to re-enable it, and
   * `lib/cms/forms.ts` exports `visibleSteps()` for the public path — so filtering here would make
   * the builder unable to see half its own form, while the public surface would be no safer. One
   * shape, one filter, applied by whoever is rendering.
   */
  const byStep = new Map<string, CustomizationFormField[]>()
  for (const field of rows.fields) {
    const list = byStep.get(field.step_id)
    if (list === undefined) byStep.set(field.step_id, [field])
    else list.push(field)
  }

  return {
    form: rows.form,
    steps: rows.steps.map((step) => ({
      step,
      fields: byStep.get(step.id) ?? [],
    })),
  }
}

async function loadParts(client: Client, formId: string, form: CustomizationForm) {
  const [steps, fields] = await Promise.all([
    client
      .from('customization_form_steps')
      .select('*')
      .eq('form_id', formId)
      .order('position', { ascending: true })
      .order('id', { ascending: true }),
    client
      .from('customization_form_fields')
      .select('*')
      .eq('form_id', formId)
      .order('position', { ascending: true })
      .order('id', { ascending: true }),
  ])

  if (steps.error) throw toRepositoryError(ENTITY, 'load-steps', formId, steps.error)
  if (fields.error) throw toRepositoryError(ENTITY, 'load-fields', formId, fields.error)

  return resolve({
    form,
    steps: parseRows('form step', customizationFormStepSchema, steps.data ?? []),
    fields: parseRows('form field', customizationFormFieldSchema, fields.data ?? []),
  })
}

/** One form by slug, with everything under it. Null when nothing published carries that slug. */
export async function getPublishedBySlug(
  client: Client,
  slug: string,
): Promise<ResolvedForm | null> {
  const { data, error } = await client
    .from('customization_forms')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (data === null) return null

  const form = parseRow(ENTITY, customizationFormSchema, data)
  return loadParts(client, form.id, form)
}

/** The same, by id, for the Studio — where a draft must resolve too. */
export async function getFormById(client: Client, formId: string): Promise<ResolvedForm | null> {
  const { data, error } = await client
    .from('customization_forms')
    .select('*')
    .eq('id', formId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', formId, error)
  if (data === null) return null

  const form = parseRow(ENTITY, customizationFormSchema, data)
  return loadParts(client, form.id, form)
}

/**
 * The form bound to a product, or to the product's category, or none.
 *
 * THE ORDER IS PRODUCT THEN CATEGORY, AND THERE IS NO THIRD FALLBACK. A product with no binding
 * gets no configurator and no "Customize This Piece" link, which is the phase document's rule
 * exactly. Falling back to a default form here would put a FURNITURE brief on a preservation piece
 * and ask a visitor about leg preferences for a paperweight — worse than offering nothing.
 */
export async function forProduct(
  client: Client,
  productId: string,
  categoryId: string | null,
): Promise<ResolvedForm | null> {
  const direct = await bindingTarget(client, 'product_id', productId)
  if (direct !== null) return getPublishedBySlug(client, direct)

  if (categoryId === null) return null
  return forCategory(client, categoryId)
}

/** The form bound to a category, or none. */
export async function forCategory(
  client: Client,
  categoryId: string,
): Promise<ResolvedForm | null> {
  const slug = await bindingTarget(client, 'category_id', categoryId)
  return slug === null ? null : getPublishedBySlug(client, slug)
}

/** The lowest-positioned binding's form slug, or null. */
async function bindingTarget(
  client: Client,
  column: 'product_id' | 'category_id',
  id: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('product_customization_forms')
    .select('position, customization_forms!inner(slug)')
    .eq(column, id)
    .order('position', { ascending: true })
    .limit(1)

  if (error) throw toRepositoryError(ENTITY, 'binding', `${column}:${id}`, error)

  const row = data?.[0] as { customization_forms?: { slug?: string } } | undefined
  return row?.customization_forms?.slug ?? null
}

/** Every form, for the Studio list. Drafts included — that is the point of the screen. */
export async function listFormsForStudio(client: Client): Promise<CustomizationForm[]> {
  const { data, error } = await client
    .from('customization_forms')
    .select('*')
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'studio', error)
  return parseRows(ENTITY, customizationFormSchema, data ?? [])
}

/** How many steps and fields each form has, for the list's columns. One query, not one per row. */
export async function countPartsByForm(
  client: Client,
): Promise<ReadonlyMap<string, { steps: number; fields: number }>> {
  const [steps, fields] = await Promise.all([
    client.from('customization_form_steps').select('form_id'),
    client.from('customization_form_fields').select('form_id'),
  ])

  if (steps.error) throw toRepositoryError(ENTITY, 'count-steps', 'all', steps.error)
  if (fields.error) throw toRepositoryError(ENTITY, 'count-fields', 'all', fields.error)

  const counts = new Map<string, { steps: number; fields: number }>()
  const bump = (formId: string, key: 'steps' | 'fields') => {
    const entry = counts.get(formId) ?? { steps: 0, fields: 0 }
    entry[key] += 1
    counts.set(formId, entry)
  }
  for (const row of steps.data ?? []) bump(row.form_id, 'steps')
  for (const row of fields.data ?? []) bump(row.form_id, 'fields')
  return counts
}

export async function insertForm(
  client: Client,
  values: Database['public']['Tables']['customization_forms']['Insert'],
): Promise<CustomizationForm> {
  const { data, error } = await client.from('customization_forms').insert(values).select().single()
  if (error) throw toRepositoryError(ENTITY, 'insert', values.slug ?? '(new)', error)
  return parseRow(ENTITY, customizationFormSchema, data)
}

/**
 * Update a form and READ IT BACK.
 *
 * The read-back is the check, for the reason every write in this repository carries one: RLS
 * FILTERS AN UPDATE, IT DOES NOT REFUSE ONE. A session without `catalog.write` matches no row,
 * gets no error, and would be told the form was saved.
 */
export async function updateFormRow(
  client: Client,
  formId: string,
  values: Database['public']['Tables']['customization_forms']['Update'],
): Promise<CustomizationForm> {
  const { data, error } = await client
    .from('customization_forms')
    .update(values)
    .eq('id', formId)
    .select()
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'update', formId, error)
  if (data === null) throw new PermissionError('update', ENTITY)
  return parseRow(ENTITY, customizationFormSchema, data)
}

export async function insertStep(
  client: Client,
  values: Database['public']['Tables']['customization_form_steps']['Insert'],
): Promise<CustomizationFormStep> {
  const { data, error } = await client
    .from('customization_form_steps')
    .insert(values)
    .select()
    .single()
  if (error) throw toRepositoryError('form step', 'insert', values.key, error)
  return parseRow('form step', customizationFormStepSchema, data)
}

export async function updateStepRow(
  client: Client,
  stepId: string,
  values: Database['public']['Tables']['customization_form_steps']['Update'],
): Promise<CustomizationFormStep> {
  const { data, error } = await client
    .from('customization_form_steps')
    .update(values)
    .eq('id', stepId)
    .select()
    .maybeSingle()

  if (error) throw toRepositoryError('form step', 'update', stepId, error)
  if (data === null) throw new PermissionError('update', 'form step')
  return parseRow('form step', customizationFormStepSchema, data)
}

/**
 * Remove a step, and VERIFY IT WENT.
 *
 * Two things can make this a no-op with no error: RLS filtering the delete for a session without
 * `destructive.execute`, and the contact-step trigger — which does raise, so that one arrives as a
 * ValidationError. The read-back covers the silent case.
 */
export async function deleteStep(client: Client, stepId: string): Promise<void> {
  const { error } = await client.from('customization_form_steps').delete().eq('id', stepId)
  if (error) throw toRepositoryError('form step', 'delete', stepId, error)

  const { data, error: readError } = await client
    .from('customization_form_steps')
    .select('id')
    .eq('id', stepId)
    .maybeSingle()

  if (readError) throw toRepositoryError('form step', 'delete', stepId, readError)
  if (data !== null) throw new PermissionError('delete', 'form step')
}

export async function insertField(
  client: Client,
  values: Database['public']['Tables']['customization_form_fields']['Insert'],
): Promise<CustomizationFormField> {
  const { data, error } = await client
    .from('customization_form_fields')
    .insert(values)
    .select()
    .single()
  if (error) throw toRepositoryError('form field', 'insert', values.key, error)
  return parseRow('form field', customizationFormFieldSchema, data)
}

export async function updateFieldRow(
  client: Client,
  fieldId: string,
  values: Database['public']['Tables']['customization_form_fields']['Update'],
): Promise<CustomizationFormField> {
  const { data, error } = await client
    .from('customization_form_fields')
    .update(values)
    .eq('id', fieldId)
    .select()
    .maybeSingle()

  if (error) throw toRepositoryError('form field', 'update', fieldId, error)
  if (data === null) throw new PermissionError('update', 'form field')
  return parseRow('form field', customizationFormFieldSchema, data)
}

export async function deleteField(client: Client, fieldId: string): Promise<void> {
  const { error } = await client.from('customization_form_fields').delete().eq('id', fieldId)
  if (error) throw toRepositoryError('form field', 'delete', fieldId, error)

  const { data, error: readError } = await client
    .from('customization_form_fields')
    .select('id')
    .eq('id', fieldId)
    .maybeSingle()

  if (readError) throw toRepositoryError('form field', 'delete', fieldId, readError)
  if (data !== null) throw new PermissionError('delete', 'form field')
}

/**
 * Reorder in ONE statement, through the database function.
 *
 * NOT N UPDATES FROM HERE. Each PostgREST write is its own transaction, so writing ten positions
 * one at a time means ten transactions racing the trigger that renumbers them — and the last one
 * to land decides. `cms_set_form_step_order` assigns every position in a single statement, with the
 * contact step forced last, and raises when the number of rows it moved is not the number it was
 * given: an id that belongs to another form, or a session that may not write the catalogue.
 */
export async function setStepOrder(
  client: Client,
  formId: string,
  stepIds: readonly string[],
): Promise<void> {
  const { error } = await client.rpc('cms_set_form_step_order', {
    p_form_id: formId,
    p_step_ids: [...stepIds],
  })
  if (error) throw toRepositoryError('form step', 'reorder', formId, error)
}

export async function setFieldOrder(
  client: Client,
  stepId: string,
  fieldIds: readonly string[],
): Promise<void> {
  const { error } = await client.rpc('cms_set_form_field_order', {
    p_step_id: stepId,
    p_field_ids: [...fieldIds],
  })
  if (error) throw toRepositoryError('form field', 'reorder', stepId, error)
}

/** Every binding on one form, for the builder's binding panel. */
export async function listBindings(
  client: Client,
  formId: string,
): Promise<ProductCustomizationForm[]> {
  const { data, error } = await client
    .from('product_customization_forms')
    .select('*')
    .eq('form_id', formId)
    .order('position', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw toRepositoryError('form binding', 'list', formId, error)
  return parseRows('form binding', productCustomizationFormSchema, data ?? [])
}

export async function addBinding(
  client: Client,
  formId: string,
  target: { productId: string | null; categoryId: string | null },
  actorId: string,
): Promise<ProductCustomizationForm> {
  const { data, error } = await client
    .from('product_customization_forms')
    .insert({
      form_id: formId,
      product_id: target.productId,
      category_id: target.categoryId,
      created_by: actorId,
    })
    .select()
    .single()

  if (error) throw toRepositoryError('form binding', 'insert', formId, error)
  return parseRow('form binding', productCustomizationFormSchema, data)
}

export async function removeBinding(client: Client, bindingId: string): Promise<void> {
  const { error } = await client.from('product_customization_forms').delete().eq('id', bindingId)
  if (error) throw toRepositoryError('form binding', 'delete', bindingId, error)

  const { data, error: readError } = await client
    .from('product_customization_forms')
    .select('id')
    .eq('id', bindingId)
    .maybeSingle()

  if (readError) throw toRepositoryError('form binding', 'delete', bindingId, readError)
  if (data !== null) throw new PermissionError('delete', 'form binding')
}
