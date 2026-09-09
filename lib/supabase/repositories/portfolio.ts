import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '../database.types'
import { NotFoundError, PermissionError } from '../errors'
import {
  portfolioProjectMediaSchema,
  portfolioProjectSchema,
  type PortfolioProject,
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

/**
 * Every project, for the Studio. All statuses, all columns.
 *
 * `'*'` IS CORRECT HERE AND WOULD BE WRONG ON A PUBLIC READ. `0152` grants anon a named column list
 * that excludes `evidence_note`, so `select *` is refused for a visitor — deliberately, so a
 * careless public read fails loudly. Staff hold the full grant, and the Verification panel needs
 * that column: it is what the owner looks at while deciding whether the project is real.
 */
export async function listProjectsForStudio(client: Client): Promise<PortfolioProject[]> {
  const { data, error } = await client
    .from('portfolio_projects')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'studio', error)
  return parseRows(ENTITY, portfolioProjectSchema, data ?? [])
}

/** One project for the editor, by id. NotFoundError covers "no such row" and "not visible to you". */
export async function getProjectByIdForStudio(
  client: Client,
  id: string,
): Promise<PortfolioProject> {
  const { data, error } = await client
    .from('portfolio_projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', id, error)
  if (data === null) throw new NotFoundError(ENTITY, id)
  return parseRow(ENTITY, portfolioProjectSchema, data)
}

/** Update one project. The gates are triggers, so a refusal arrives as a thrown error. */
export async function updateProjectRow(
  client: Client,
  id: string,
  values: Partial<PortfolioProject>,
): Promise<PortfolioProject> {
  const { data, error } = await client
    .from('portfolio_projects')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'update', id, error)
  return parseRow(ENTITY, portfolioProjectSchema, data)
}

/** Create one project, as a DRAFT that has been verified by nobody. Both defaults come from the
 *  table, and neither is overridable here: a project that arrives already confirmed is the thing
 *  the evidence gate exists to prevent. */
export async function insertProject(
  client: Client,
  values: { readonly slug: string; readonly title: string; readonly createdBy: string },
): Promise<PortfolioProject> {
  const { data, error } = await client
    .from('portfolio_projects')
    .insert({ slug: values.slug, title: values.title, updated_by: values.createdBy })
    .select('*')
    .single()

  if (error) throw toRepositoryError(ENTITY, 'insert', values.slug, error)
  return parseRow(ENTITY, portfolioProjectSchema, data)
}

/**
 * Point a project at its story page.
 *
 * A READ-BACK, NOT A FIRE-AND-FORGET, for the reason every join write in this repository is one:
 * RLS filters an UPDATE rather than refusing it, so a role that may not write this row gets zero
 * rows changed, no error, and a page that exists but belongs to nothing. `0153` derives
 * `pages.path` from the slug on this write, so a silent failure would also leave the page at
 * whatever path it was created with.
 */
export async function linkProjectPage(
  client: Client,
  projectId: string,
  pageId: string,
): Promise<void> {
  const { data, error } = await client
    .from('portfolio_projects')
    .update({ page_id: pageId })
    .eq('id', projectId)
    .select('page_id')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'link-page', projectId, error)
  if (data?.page_id !== pageId) throw new PermissionError('link-page', ENTITY)
}

/**
 * The roles a project photograph may carry.
 *
 * A SECOND COPY OF `portfolio_project_media_role_allowed`, and named here so a grep for one finds
 * the other. It is deliberately NOT `PRODUCT_MEDIA_ROLES`: that list has `lifestyle`, this one does
 * not, and sharing the constant would offer an editor a role the check constraint refuses.
 */
export const PROJECT_MEDIA_ROLES = [
  'hero',
  'gallery',
  'detail',
  'process',
  'video',
  'model',
] as const

export type ProjectMediaRole = (typeof PROJECT_MEDIA_ROLES)[number]

/** One row of a project's gallery, as the Studio edits it. */
export interface ProjectMediaEdge {
  readonly mediaAssetId: string
  readonly role: ProjectMediaRole
  readonly caption: string | null
  readonly altOverride: string | null
  readonly sortOrder: number
}

/**
 * Replace a project's gallery with exactly this set, in exactly this order.
 *
 * THE SAME VERIFIED DIFF AS `setProductMediaEdges`, and the same three reasons: an edge that only
 * moved is UPDATEd rather than deleted and reinserted, so rearranging a gallery needs no destructive
 * permission; a DELETE is filtered by RLS rather than refused, so removals are read back; and an
 * UPDATE is filtered the same way, so changes are too.
 *
 * NOTHING HERE CHECKS `is_concept`. `reject_concept_project_media` refuses a concept render on
 * insert or update and the picker filters them out of the choices offered. A third copy of the rule
 * in this file would be a third place for it to drift; what this file owes the caller is that the
 * trigger's refusal arrives unswallowed, which `toRepositoryError` does.
 */
export async function setProjectMediaEdges(
  client: Client,
  projectId: string,
  edges: readonly ProjectMediaEdge[],
  actorId: string,
): Promise<void> {
  // Last write wins on a duplicated asset id, matching the composite primary key, rather than
  // sending two rows and letting the insert fail with a 23505 no editor can read.
  const wanted = new Map(edges.map((edge) => [edge.mediaAssetId, edge]))
  const current = await listProjectMedia(client, projectId)
  const currentById = new Map(current.map((row) => [row.media_asset_id, row]))

  const removed = current.filter((row) => !wanted.has(row.media_asset_id))
  if (removed.length > 0) {
    const { error } = await client
      .from('portfolio_project_media')
      .delete()
      .eq('project_id', projectId)
      .in(
        'media_asset_id',
        removed.map((row) => row.media_asset_id),
      )
    if (error) throw toRepositoryError(ENTITY, 'set-media', projectId, error)

    const survivors = new Set(
      (await listProjectMedia(client, projectId)).map((row) => row.media_asset_id),
    )
    if (removed.some((row) => survivors.has(row.media_asset_id))) {
      throw new PermissionError('set-media', ENTITY)
    }
  }

  const added = [...wanted.values()].filter((edge) => !currentById.has(edge.mediaAssetId))
  if (added.length > 0) {
    const { error } = await client.from('portfolio_project_media').insert(
      added.map((edge) => ({
        project_id: projectId,
        media_asset_id: edge.mediaAssetId,
        role: edge.role,
        caption: edge.caption,
        alt_override: edge.altOverride,
        sort_order: edge.sortOrder,
        created_by: actorId,
      })),
    )
    if (error) throw toRepositoryError(ENTITY, 'set-media', projectId, error)
  }

  const differs = (edge: ProjectMediaEdge, row: PortfolioProjectMedia) =>
    row.role !== edge.role ||
    row.caption !== edge.caption ||
    row.alt_override !== edge.altOverride ||
    row.sort_order !== edge.sortOrder

  const changed = [...wanted.values()].filter((edge) => {
    const existing = currentById.get(edge.mediaAssetId)
    return existing !== undefined && differs(edge, existing)
  })

  for (const edge of changed) {
    const { error } = await client
      .from('portfolio_project_media')
      .update({
        role: edge.role,
        caption: edge.caption,
        alt_override: edge.altOverride,
        sort_order: edge.sortOrder,
      })
      .eq('project_id', projectId)
      .eq('media_asset_id', edge.mediaAssetId)
    if (error) throw toRepositoryError(ENTITY, 'set-media', projectId, error)
  }

  if (changed.length > 0) {
    const after = new Map(
      (await listProjectMedia(client, projectId)).map((row) => [row.media_asset_id, row]),
    )
    const stale = changed.some((edge) => {
      const now = after.get(edge.mediaAssetId)
      return now === undefined || differs(edge, now)
    })
    if (stale) throw new PermissionError('set-media', ENTITY)
  }
}
