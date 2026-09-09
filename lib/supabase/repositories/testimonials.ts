import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { NotFoundError } from '../errors'
import { testimonialSchema, type Testimonial } from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'testimonial'

/**
 * Quotes from real people, of which there are none.
 *
 * THIS FUNCTION RETURNS `[]` TODAY AND THAT IS THE CORRECT, PERMANENT ANSWER until a real person
 * says something and agrees to be quoted. D10 names testimonials outright; a testimonial written
 * in-house is the purest form of the fabrication it forbids, and `testimonials` therefore has no
 * seed columns at all — nothing can address a row in it.
 *
 * THE RENDERER DRAWS NOTHING FOR AN EMPTY SET, rather than a placeholder or a skeleton. A quote
 * card with lorem ipsum in it is a fabricated endorsement for as long as it is on the page.
 *
 * TWO GATES ALREADY STAND BEHIND `PUBLISHED`, so nothing here re-checks them: the owner has
 * verified the quote is real, and anyone it names has consented to be named
 * (`enforce_testimonial_evidence_gate()`). Consent withdrawal archives the row on the same
 * statement it arrives, so a person who changes their mind leaves the site immediately rather than
 * at the next deploy.
 */
export async function listPublishedTestimonials(client: Client): Promise<Testimonial[]> {
  const { data, error } = await client
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'published', error)
  return parseRows(ENTITY, testimonialSchema, data ?? [])
}

/**
 * Every testimonial, for the Studio. All statuses.
 *
 * Returns `[]` today, and the Studio screen says why in words rather than showing an error state:
 * an empty testimonials table is the correct condition of a business that has not collected any,
 * not a failure to load.
 */
export async function listTestimonialsForStudio(client: Client): Promise<Testimonial[]> {
  const { data, error } = await client
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'studio', error)
  return parseRows(ENTITY, testimonialSchema, data ?? [])
}

/**
 * One testimonial, by id, for the Studio.
 *
 * A `NotFoundError` COVERS BOTH "no such row" AND "not yours to see", and must keep doing so: RLS
 * filters the read, so a role without `content.read` gets nothing back, and distinguishing the two
 * would answer a question the policy declined to answer.
 */
export async function getTestimonialById(client: Client, id: string): Promise<Testimonial> {
  const { data, error } = await client.from('testimonials').select('*').eq('id', id).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, testimonialSchema, data)
}

/**
 * Record a quote somebody actually said.
 *
 * IT TAKES THE QUOTE AND WHO SAID IT, AND NOTHING THAT DECIDES PUBLICATION. `consent` defaults to
 * PENDING and `owner_verification` to OWNER_VERIFICATION_REQUIRED, both from the table, and neither
 * is accepted here. A quote arrives unverified and unconsented because that is what a quote is until
 * somebody has checked; the two acts that change either are separate, and one of them is owner-only.
 *
 * THAT THIS FUNCTION EXISTS AT ALL IS A REVERSAL, and the reasoning is worth keeping. The Studio
 * screen first shipped with no way to add a testimonial, on the grounds that a box to type a quote
 * into is an invitation to write one. But the gates are what prevent a fabricated endorsement
 * reaching the public site — a quote with no consent cannot be published, whoever typed it — and
 * a surface with no create prevents nothing while making it impossible to record a REAL quote
 * through the Studio at all. The guard belongs at publication, where it is, not at the keyboard.
 */
export async function insertTestimonial(
  client: Client,
  values: {
    readonly quote: string
    readonly attributedTo: string | null
    readonly attributionRole: string | null
    readonly projectId: string | null
    readonly createdBy: string
  },
): Promise<Testimonial> {
  const { data, error } = await client
    .from('testimonials')
    .insert({
      quote: values.quote,
      attributed_to: values.attributedTo,
      attribution_role: values.attributionRole,
      project_id: values.projectId,
      updated_by: values.createdBy,
    })
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'insert', values.quote.slice(0, 24), error)
  return parseRow(ENTITY, testimonialSchema, data)
}

/** Update one testimonial. The gates are triggers, so a refusal arrives as a thrown error. */
export async function updateTestimonialRow(
  client: Client,
  id: string,
  values: Partial<Testimonial>,
): Promise<Testimonial> {
  const { data, error } = await client
    .from('testimonials')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  return parseRow(ENTITY, testimonialSchema, data)
}
