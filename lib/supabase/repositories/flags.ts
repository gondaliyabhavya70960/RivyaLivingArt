import type { SupabaseClient } from '@supabase/supabase-js'

import type { FeatureFlagKey } from '@/lib/flags/flags'

import type { Database } from '../database.types'
import { PermissionError } from '../errors'
import { featureFlagSchema, type FeatureFlag } from '../schemas'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'feature flag'

/**
 * `feature_flags` — the only module that reads or writes it.
 *
 * READS RETURN ROWS, NOT BOOLEANS. Deciding that a missing row means "off" is `lib/flags/index.ts`'s
 * job, because that is where the register of which flags exist lives; a repository that returned
 * `false` for an unknown key would be answering a question about a flag it has no way to know is
 * real.
 *
 * `feature_flags` is shape C — no anon policy at all — so every one of these calls needs a staff
 * session or the service client. That is deliberate: a flag is evaluated server-side and the
 * browser is never told a flag exists. It is told markup that is present or absent.
 */

/** Every row that exists. Absent flags are not rows and are not returned. */
export async function listFeatureFlags(client: Client): Promise<FeatureFlag[]> {
  const { data, error } = await client.from('feature_flags').select('*').order('key')

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, featureFlagSchema, data ?? [])
}

/**
 * Switch a flag, creating its row the first time.
 *
 * AN UPSERT, BECAUSE OFF AND ABSENT ARE THE SAME STATE. Switching a never-touched flag ON has to
 * create the row; switching it OFF again has to leave a row saying so, with a name and a timestamp
 * against it — deleting the row would erase who turned it off, which is precisely the fact somebody
 * later wants.
 *
 * THE ROW IS READ BACK, and the read-back is not decoration: `feature_flags` carries a write policy
 * for `system.flags.write` only, and RLS FILTERS AN UPDATE RATHER THAN REFUSING ONE. Without this,
 * an editor's toggle would return no error and change nothing, and the screen would show them a
 * switch that moves and does not stick.
 */
export async function setFeatureFlag(
  client: Client,
  key: FeatureFlagKey,
  description: string,
  isEnabled: boolean,
  actorId: string,
): Promise<FeatureFlag> {
  const { data, error } = await client
    .from('feature_flags')
    .upsert(
      {
        key,
        description,
        is_enabled: isEnabled,
        updated_by: actorId,
        // `set_updated_at` fires on UPDATE only, so an INSERT needs the value the row will be read
        // back with. Leaving it to the column default would work; stating it keeps the two paths
        // producing the same row rather than nearly the same one.
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    .select('*')
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'set', key, error)
  // No row came back, no error was raised: the upsert was FILTERED, not refused. That is what a
  // caller without `system.flags.write` sees, and reporting it as success is the failure this
  // read-back exists to prevent.
  if (data === null) throw new PermissionError('set-flag', ENTITY)
  return parseRow(ENTITY, featureFlagSchema, data)
}
