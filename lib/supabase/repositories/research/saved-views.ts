import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../database.types'
import { toRepositoryError } from '../support'

type Client = SupabaseClient<Database>

const ENTITY = 'research saved view'

export type SavedViewRow = Database['public']['Tables']['research_saved_views']['Row']

export const VIEW_SURFACES = ['explorer', 'large-format', 'changes', 'compare'] as const
export type ViewSurface = (typeof VIEW_SURFACES)[number]

const VIEW_COLUMNS =
  'id, surface, name, filters, sort, columns, is_shared, owner_user_id, status, ' +
  'created_at, updated_at, updated_by'

/**
 * A named filter set, per surface, reproducible from its URL.
 *
 * "LARGE DINING TABLES, ONE CURRENCY, IN STOCK, LAST THIRTY DAYS" IS A LINK, NOT A SET OF
 * INSTRUCTIONS. A filter set that lives in somebody's head is one nobody else can reproduce, and
 * the first thing that happens to an analysis nobody can reproduce is that it stops being believed.
 *
 * EVERY READ AND WRITE RUNS AS THE SESSION, and that is not a detail here — it is the whole
 * security model. `research_saved_views` is the one research table with an OWNER SCOPE: five of the
 * six roles hold `research.read`, so what stops a viewer rewriting a merchandiser's views is
 * `owner_user_id = auth.uid()` in the policy, not the permission. An admin client on this table
 * would bypass exactly the check that matters, so there is no admin path in this file at all.
 *
 * THE SHARED LEG IS READ-ONLY AND THE POLICY SAYS SO. A view somebody else can edit is a view whose
 * results change under the person who linked to it.
 */

export async function listSavedViews(
  client: Client,
  surface: ViewSurface,
): Promise<readonly SavedViewRow[]> {
  // NO OWNER FILTER HERE, AND THAT IS DELIBERATE: RLS returns the caller's own views plus every
  // shared one, which is exactly the set the picker should show. Filtering by owner in the query
  // would hide the shared views the second policy leg exists to admit.
  const { data, error } = await client
    .from('research_saved_views')
    .select(VIEW_COLUMNS)
    .eq('surface', surface)
    .order('name', { ascending: true })
    .limit(200)
  if (error !== null) throw toRepositoryError(ENTITY, 'list', surface, error)
  return (data ?? []) as unknown as SavedViewRow[]
}

export async function getSavedView(client: Client, id: string): Promise<SavedViewRow | null> {
  const { data, error } = await client
    .from('research_saved_views')
    .select(VIEW_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error !== null) throw toRepositoryError(ENTITY, 'get', id, error)
  return (data ?? null) as unknown as SavedViewRow | null
}

/**
 * Save or rename a view.
 *
 * THE UPSERT KEY IS `(owner, surface, name)`, so saving twice under one name updates rather than
 * accumulating "Large tables", "Large tables (2)", "Large tables (3)" — which is what every saved
 * view feature that keys on an id alone ends up with.
 */
export async function saveView(
  client: Client,
  input: {
    readonly surface: ViewSurface
    readonly name: string
    readonly filters: Readonly<Record<string, unknown>>
    readonly sort?: Readonly<Record<string, unknown>> | null
    readonly columns?: readonly string[] | null
    readonly isShared: boolean
    readonly ownerUserId: string
  },
): Promise<void> {
  const { error } = await client.from('research_saved_views').upsert(
    {
      surface: input.surface,
      name: input.name.trim(),
      filters: input.filters as never,
      sort: (input.sort ?? null) as never,
      columns: input.columns === undefined ? null : [...(input.columns ?? [])],
      is_shared: input.isShared,
      owner_user_id: input.ownerUserId,
      updated_at: new Date().toISOString(),
      updated_by: input.ownerUserId,
    },
    { onConflict: 'owner_user_id,surface,name' },
  )
  if (error !== null) throw toRepositoryError(ENTITY, 'save', input.name, error)
}

/**
 * Delete a view.
 *
 * SCOPED BY THE POLICY, NOT BY THE QUERY. The `eq('owner_user_id', …)` is not written here on
 * purpose: adding it would make the query look like the thing keeping one person from deleting
 * another's view, and it is not — the policy is. A reader who saw the filter might reasonably
 * conclude the policy could be relaxed.
 */
export async function deleteSavedView(client: Client, id: string): Promise<void> {
  const { error } = await client.from('research_saved_views').delete().eq('id', id)
  if (error !== null) throw toRepositoryError(ENTITY, 'delete', id, error)
}

/**
 * A stored filter set, as query-string parameters.
 *
 * ONLY STRINGS AND NUMBERS SURVIVE, and anything else is dropped. The filters column is jsonb a
 * form wrote, and a view carrying an object or an array would produce `[object Object]` in a URL
 * that somebody then bookmarks — a link that silently means something different from the view it
 * came from.
 */
export function viewToSearchParams(filters: unknown): URLSearchParams {
  const params = new URLSearchParams()
  if (filters === null || typeof filters !== 'object' || Array.isArray(filters)) return params
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (typeof value === 'string' && value !== '') params.set(key, value)
    else if (typeof value === 'number' && Number.isFinite(value)) params.set(key, String(value))
    else if (typeof value === 'boolean' && value) params.set(key, 'true')
  }
  return params
}
