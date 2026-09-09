import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '../database.types'
import { NotFoundError } from '../errors'
import {
  portfolioProjectMediaSchema,
  portfolioProjectSchema,
  type PortfolioProjectMedia,
} from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'portfolio project'

/**
 * Reads for the project archive.
 *
 * EVERY FUNCTION HERE RETURNS NOTHING TODAY, and that is the phase shipping as designed rather than
 * a gap. `portfolio_projects` holds zero rows, no seed will ever add one — the table has no Tier C
 * columns, so a seed module cannot even address a row in it — and a project exists only because the
 * owner entered one and verified it. `/portfolio` renders the seeded SEED §28 empty state.
 *
 * NOTHING HERE FILTERS ON `status`, AND NOTHING RE-CHECKS THE GATES. RLS filters to PUBLISHED once,
 * in a policy, for an anonymous caller; the two publication gates — owner verification, and consent
 * from anyone the row names — are enforced by `enforce_project_evidence_gate()` at the moment of
 * publication, so a row that is PUBLISHED has already satisfied them. A repository that re-tested
 * either would be a second copy of a rule that could drift from the trigger, and the trigger is the
 * one that cannot be bypassed.
 *
 * `evidence_note` IS NOT PART OF A PUBLIC READ, AND THE DATABASE IS WHAT ENFORCES THAT. RLS filters
 * ROWS, not columns, so a shape-A policy alone would publish every column of a published project —
 * including the note recording an invoice reference or where the photographs live. `0152` drops
 * anon's table-level SELECT and grants back a named column list without it, so a request asking for
 * that column is refused rather than served. The narrow select list below is what keeps the ordinary
 * path working; the grant is what makes the rule true even for a request this file never wrote.
 *
 * HENCE TWO SHAPES FOR ONE TABLE. `PublicProject` omits the column anon may not read, and the Studio
 * reads the whole row with `portfolioProjectSchema`. That is a real duplication and it buys
 * something real: a public read cannot acquire the column by accident, because the type it returns
 * does not have it.
 */

/**
 * The columns anon is granted. Kept in step with `0152`'s grant list by hand — if they drift, the
 * public read fails loudly with `permission denied for column`, which is the failure worth having.
 */
const PUBLIC_COLUMNS =
  'id, slug, page_id, title, subtitle, summary, project_type, location_label, completed_on, ' +
  'is_client_project, client_display_name, client_consent, client_consent_reference, ' +
  'client_consent_recorded_at, client_consent_recorded_by, hero_media_id, seo_entry_id, ' +
  'sort_order, status, owner_verification, fact_classification, published_at, published_by, ' +
  'created_at, updated_at, updated_by'

/** A project as the public site may see it: every column except the evidence note. */
const publicProjectSchema = portfolioProjectSchema.omit({ evidence_note: true })

export type PublicProject = z.infer<typeof publicProjectSchema>

/** Published projects, in the curator's order. */
export async function listPublishedProjects(client: Client): Promise<PublicProject[]> {
  const { data, error } = await client
    .from('portfolio_projects')
    .select(PUBLIC_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'published', error)
  return parseRows(ENTITY, publicProjectSchema, data ?? [])
}

/**
 * One project by slug.
 *
 * `NotFoundError` COVERS BOTH "no such slug" AND "not published", and they must stay
 * indistinguishable: the read runs through whichever client the caller passed, so for an anonymous
 * request RLS returns nothing in either case. Telling them apart would leak the existence of
 * unannounced work — which, for a portfolio, is exactly the thing a client may not have agreed to
 * yet.
 */
export async function getProjectBySlug(client: Client, slug: string): Promise<PublicProject> {
  const { data, error } = await client
    .from('portfolio_projects')
    .select(PUBLIC_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', slug, error)
  if (data === null) throw new NotFoundError(ENTITY, slug)
  return parseRow(ENTITY, publicProjectSchema, data)
}

/** A project's gallery rows, in the order an editor arranged them. */
export async function listProjectMedia(
  client: Client,
  projectId: string,
): Promise<PortfolioProjectMedia[]> {
  const { data, error } = await client
    .from('portfolio_project_media')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('media_asset_id', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'gallery', projectId, error)
  return parseRows(ENTITY, portfolioProjectMediaSchema, data ?? [])
}

/** The project a page belongs to, by `pages.id`. The reverse of `page_id`, for the same reason
 *  `getCollectionIdForPage` exists: a band on a project's story page needs to know whose page it is. */
export async function getProjectIdForPage(client: Client, pageId: string): Promise<string | null> {
  const { data, error } = await client
    .from('portfolio_projects')
    .select('id')
    .eq('page_id', pageId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'for-page', pageId, error)
  return data?.id ?? null
}
