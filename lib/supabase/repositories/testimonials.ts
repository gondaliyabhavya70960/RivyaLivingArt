import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../database.types'
import { testimonialSchema, type Testimonial } from '../schemas'
import { parseRows, toRepositoryError } from './support'

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
