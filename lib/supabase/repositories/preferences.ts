import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '../database.types'
import { parseRow, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'studio preferences'

/**
 * One staff member's Studio chrome state.
 *
 * ALWAYS THE COOKIE-BOUND CLIENT. Every policy on this table is scoped to
 * `user_id = auth.uid()`, so RLS is what makes these functions safe — not a `where` clause written
 * here. Passing the admin client would silently defeat that and let one person read or overwrite
 * another's row, which is exactly what the scope exists to prevent. There is deliberately no
 * `userId` parameter: a function that takes one invites a caller to pass somebody else's.
 */

export const studioPreferencesSchema = z.object({
  user_id: z.uuid(),
  sidebar_collapsed: z.boolean(),
  pinned_routes: z.array(z.string()),
  dashboard_card_order: z.array(z.string()),
})

export type StudioPreferences = z.infer<typeof studioPreferencesSchema>

const COLUMNS = 'user_id, sidebar_collapsed, pinned_routes, dashboard_card_order'

/** The defaults a staff member has before they have ever changed anything. */
export const DEFAULT_PREFERENCES: Omit<StudioPreferences, 'user_id'> = {
  sidebar_collapsed: false,
  pinned_routes: [],
  dashboard_card_order: [],
}

/**
 * This session's preferences, or null when no row exists yet.
 *
 * Null rather than a throw, and null rather than the defaults: "has never set a preference" is the
 * ordinary state for most accounts, and the caller decides what to do with it. Returning the
 * defaults here would make it impossible to tell "not set" from "set to the defaults", which is
 * what an upsert needs to know.
 */
export async function findMyPreferences(client: Client): Promise<StudioPreferences | null> {
  const { data, error } = await client.from('studio_preferences').select(COLUMNS).maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', 'self', error)
  if (!data) return null
  return parseRow(ENTITY, studioPreferencesSchema, data)
}

/**
 * Write this session's preferences, creating the row if it is absent.
 *
 * An UPSERT on `user_id`, which is why that column is `unique` in migration 0020: without the
 * constraint this would be a read-modify-write that races itself across two tabs, and the loser
 * silently discards the other's change.
 *
 * `user_id` is supplied by the CALLER from its own session rather than being a parameter this
 * function invents, and RLS refuses it if it is anybody else's — the insert policy's WITH CHECK is
 * `user_id = auth.uid()`.
 */
export async function saveMyPreferences(
  client: Client,
  userId: string,
  fields: Partial<Omit<StudioPreferences, 'user_id'>>,
): Promise<void> {
  const { error } = await client
    .from('studio_preferences')
    .upsert({ user_id: userId, updated_by: userId, ...fields }, { onConflict: 'user_id' })

  if (error) throw toRepositoryError(ENTITY, 'update', userId, error)
}
