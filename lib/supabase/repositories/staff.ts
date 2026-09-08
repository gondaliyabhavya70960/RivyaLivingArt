import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { Database } from '../database.types'
import { ROLES, type Role } from '../../auth/permissions'
import { NotFoundError, ValidationError } from '../errors'
import { parseRow, parseRows, toRepositoryError } from './support'

type Client = SupabaseClient<Database>

const ENTITY = 'staff profile'

/**
 * Staff profile reads and writes.
 *
 * Every caller passes its OWN client, and that is the point: `getStaffSession()` passes the
 * cookie-bound one, so the self-select policy is what makes a row visible; the Studio's user
 * management passes the same, so `system.users.manage` is what makes the whole list visible; and
 * provisioning passes the admin client, because creating a staff member is the one act no existing
 * session can be relied upon to perform. The repository does not choose — it would be choosing
 * which RLS policy applies.
 */

export const staffStatusSchema = z.enum(['INVITED', 'ACTIVE', 'SUSPENDED'])
export type StaffStatus = z.infer<typeof staffStatusSchema>

export const staffProfileSchema = z.object({
  user_id: z.uuid(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  role: z.enum(ROLES),
  status: staffStatusSchema,
  last_seen_at: z.iso.datetime({ offset: true }).nullable(),
})

export type StaffProfile = z.infer<typeof staffProfileSchema>

const COLUMNS = 'user_id, email, display_name, role, status, last_seen_at'

/**
 * One profile by user id, or null.
 *
 * Null rather than a throw: "not staff" is the ordinary answer for most sessions, and a session
 * resolving to no profile is not an error anywhere in the system.
 */
export async function findStaffProfile(
  client: Client,
  userId: string,
): Promise<StaffProfile | null> {
  const { data, error } = await client
    .from('staff_profiles')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'get', userId, error)
  if (!data) return null
  return parseRow(ENTITY, staffProfileSchema, data)
}

/** Every profile this client may see. Oldest first, so the account that founded the project leads. */
export async function listStaffProfiles(client: Client): Promise<StaffProfile[]> {
  const { data, error } = await client
    .from('staff_profiles')
    .select(COLUMNS)
    .order('created_at', { ascending: true })

  if (error) throw toRepositoryError(ENTITY, 'list', 'all', error)
  return parseRows(ENTITY, staffProfileSchema, data ?? [])
}

/**
 * Change a role.
 *
 * `updatedBy` is required rather than optional. A role change with no recorded author is the one
 * audit row nobody can act on, and making the caller supply it is cheaper than discovering later
 * that a column is always null.
 *
 * The last-owner rule is NOT enforced here. It is a database trigger (`enforce_last_owner`,
 * migration 0009), because a rule living only in the code path that offers the button is bypassed
 * by every other path — including a psql session — and its failure mode is a project nobody can
 * administer.
 */
export async function updateStaffRole(
  client: Client,
  userId: string,
  role: Role,
  updatedBy: string,
): Promise<void> {
  const { error } = await client
    .from('staff_profiles')
    .update({ role, updated_by: updatedBy })
    .eq('user_id', userId)

  if (error) throw toRepositoryError(ENTITY, 'update', userId, error)
}

export async function updateStaffStatus(
  client: Client,
  userId: string,
  status: StaffStatus,
  updatedBy: string,
): Promise<void> {
  const { error } = await client
    .from('staff_profiles')
    .update({ status, updated_by: updatedBy })
    .eq('user_id', userId)

  if (error) throw toRepositoryError(ENTITY, 'update', userId, error)
}

/**
 * Fill in the profile the `on_auth_user_created` trigger already created as INVITED/viewer.
 *
 * An UPDATE rather than an INSERT, deliberately: the row exists by the time any invite code runs,
 * and inserting would race the trigger. Elevation from `viewer` is the audited act — the trigger
 * always creates the least privilege it can.
 */
export async function elevateInvitedProfile(
  client: Client,
  userId: string,
  fields: { role: Role; displayName: string | null; invitedBy: string },
): Promise<StaffProfile> {
  const { data, error } = await client
    .from('staff_profiles')
    .update({
      role: fields.role,
      display_name: fields.displayName,
      created_by: fields.invitedBy,
      updated_by: fields.invitedBy,
    })
    .eq('user_id', userId)
    .select(COLUMNS)
    .maybeSingle()

  if (error) throw toRepositoryError(ENTITY, 'update', userId, error)
  if (!data) throw new NotFoundError(ENTITY, userId)
  return parseRow(ENTITY, staffProfileSchema, data)
}

/** The identifier the `enforce_last_owner` trigger raises with (migration 0009). */
export const LAST_OWNER_CONSTRAINT = 'staff_profiles_last_owner'

/**
 * Is this the last-owner refusal?
 *
 * Exported and tested because the Studio has to tell this refusal apart from every other failed
 * write in order to show an actionable message rather than a 500 — and because it is the kind of
 * predicate that silently stops matching.
 *
 * It checks the constraint identifier first, which is stable, and falls back to the message only
 * because a PostgREST error does not always carry the constraint through. Prose alone would break
 * on a reword; the identifier alone would break on that fallback path.
 */
export function isLastOwnerRefusal(error: unknown): boolean {
  if (!(error instanceof ValidationError)) return false
  return error.issues.some(
    (issue) =>
      issue.path.includes(LAST_OWNER_CONSTRAINT) || /no active owner/i.test(issue.message ?? ''),
  )
}
