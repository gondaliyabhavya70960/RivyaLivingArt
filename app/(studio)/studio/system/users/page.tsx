import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { PostgrestError } from '@supabase/supabase-js'

import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Field } from '@/components/primitives/Field'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { VisuallyHidden } from '@/components/primitives/VisuallyHidden'
import { t, type StudioStringKey } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { ROLES, roleHasPermission, type Role } from '@/lib/auth/permissions'
import { inviteStaffMember } from '@/lib/auth/provisioning'
import { requirePermission, withPermission } from '@/lib/auth/require'
import type { StaffSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  findStaffProfile,
  listStaffProfiles,
  updateStaffRole,
  updateStaffStatus,
  isLastOwnerRefusal,
} from '@/lib/supabase/repositories/staff'

/**
 * /studio/system/users — who may sign in, as what, and whether they still may.
 *
 * THE FIRST LINE OF THE BODY IS THE AUTHORISATION. `proxy.ts` redirects an unauthenticated
 * request and decides nothing else; a Server Action reaches the server without passing through a
 * page matcher at all. So the page checks, every action checks again through withPermission(), and
 * RLS refuses underneath both.
 *
 * NO CLIENT COMPONENT, AND THEREFORE NO JAVASCRIPT. Every mutation is a plain `<form action={…}>`
 * posting to a Server Action, and every outcome comes back as a `?notice=` code the page renders
 * from the strings module. `useActionState` would read more fluently and would put the whole of
 * this surface into the client bundle for the sake of a sentence.
 *
 * THE SERVICE ROLE IS NOT IMPORTED HERE. Creating an account needs it — it is the only way to make
 * an `auth.users` row — so that one operation lives in `lib/auth/provisioning.ts`, which is on the
 * eslint allowlist for exactly that reason. Everything else on this page goes through the
 * cookie-bound client, so RLS is still deciding even after requirePermission() has.
 */

const USERS_PATH = '/studio/system/users'
const LOGIN_PATH = '/studio/login'
const ENTITY = 'staff_profiles'

/** `staff_profiles.status` is text plus a check constraint, so the allowed set lives here too. */
const STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const
type StaffStatus = (typeof STATUSES)[number]

/**
 * SQLSTATE for the `enforce_last_owner` refusal (migration 0009 raises `check_violation`).
 *
 * The only other check constraint on this table is `staff_profiles_status_allowed`, and no input
 * that fails it survives the schemas below — so a 23514 arriving here is the owner rule, and
 * turning it into its own sentence is safe rather than a guess.
 */
const LAST_OWNER_CODE = '23514'

const ROLE_LABEL: Record<Role, StudioStringKey> = {
  owner: 'studio.users.roleOwner',
  admin: 'studio.users.roleAdmin',
  editor: 'studio.users.roleEditor',
  merchandiser: 'studio.users.roleMerchandiser',
  researcher: 'studio.users.roleResearcher',
  viewer: 'studio.users.roleViewer',
}

const STATUS_LABEL: Record<StaffStatus, StudioStringKey> = {
  INVITED: 'studio.users.statusInvited',
  ACTIVE: 'studio.users.statusActive',
  SUSPENDED: 'studio.users.statusSuspended',
}

const STATUS_TONE: Record<StaffStatus, BadgeTone> = {
  INVITED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
}

/* ------------------------------------------------------------------ outcomes the page reports */

const NOTICE_CODES = [
  'invited',
  'email-in-use',
  'role-changed',
  'activated',
  'suspended',
  'last-owner',
  'owner-grant',
  'invalid',
] as const

type NoticeCode = (typeof NOTICE_CODES)[number]

const NOTICE_STRING: Record<NoticeCode, StudioStringKey> = {
  invited: 'studio.users.noticeInvited',
  'email-in-use': 'studio.users.noticeEmailInUse',
  'role-changed': 'studio.users.noticeRoleChanged',
  activated: 'studio.users.noticeActivated',
  suspended: 'studio.users.noticeSuspended',
  'last-owner': 'studio.users.noticeLastOwner',
  'owner-grant': 'studio.users.noticeOwnerGrant',
  invalid: 'studio.users.noticeInvalid',
}

/** The refusals. Rendered by ErrorText, which carries `role="alert"` and an icon, so the outcome
 *  is never carried by colour alone (WCAG 1.4.1). */
const REFUSALS = new Set<NoticeCode>(['email-in-use', 'last-owner', 'owner-grant', 'invalid'])

const noticeSchema = z.enum(NOTICE_CODES)

/**
 * A refusal this page can explain in one sentence, as opposed to a fault it should not try to.
 *
 * Everything else thrown inside an action propagates: withPermission() has already recorded it,
 * and an error boundary saying that something went wrong beats a cheerful notice that lies.
 */
class RefusedError extends Error {
  constructor(
    readonly notice: NoticeCode,
    message: string,
  ) {
    super(message)
    this.name = 'RefusedError'
  }
}

/* ------------------------------------------------------------------ input, at the trust boundary */

/** FormData values are `string | File`; anything that is not a string is not an answer. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

const roleSchema = z.enum(ROLES)

const inviteSchema = z.object({
  // Trimmed and lowercased BEFORE validation, so the value that reaches GoTrue is the value the
  // citext unique index on `staff_profiles.email` will compare.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  displayName: z.string().trim().max(120),
  role: roleSchema,
})

const roleChangeSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
})

const statusChangeSchema = z.object({
  userId: z.uuid(),
  // Only the two states a human sets. INVITED is written by the provisioning trigger and is never
  // returned to.
  status: z.enum(['ACTIVE', 'SUSPENDED']),
})

/** The row shape this page reads back. Validated on the way OUT as well as in: a row that fails
 *  here means the database holds something the model calls impossible. */
const profileSchema = z.object({
  user_id: z.uuid(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  role: roleSchema,
  status: z.enum(STATUSES),
  last_seen_at: z.iso.datetime({ offset: true }).nullable(),
})

type StaffProfileRow = z.infer<typeof profileSchema>

/**
 * Parse, or refuse.
 *
 * The message never quotes the input. A submitted email address is personal data on its way to an
 * audit summary, and a validation error is not worth putting it there.
 */
function parseOrRefuse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    throw new RefusedError('invalid', 'the submitted values did not validate')
  }
  return parsed.data
}

/* ------------------------------------------------------------------ the audited operations */

/**
 * Only an owner may create an owner.
 *
 * `system.owner.transfer` is the one permission no role but `owner` can hold (D5), which would be
 * a dead letter if `system.users.manage` could mint owners by another name: an admin would grant
 * themselves a colleague with every permission they lack, and then be granted it back. Demoting an
 * existing owner is a different act and stays with `system.users.manage`, which is why the guard
 * asks what the role is changing FROM as well as to.
 */
async function assertMayGrantOwner(
  session: StaffSession,
  action: string,
  from: Role | null,
  to: Role,
  entityId?: string,
): Promise<void> {
  if (to !== 'owner' || from === 'owner') return
  if (roleHasPermission(session.role, 'system.owner.transfer')) return

  await writeAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action,
    result: 'DENIED',
    entityType: ENTITY,
    ...(entityId === undefined ? {} : { entityId }),
    summary: `role "${session.role}" attempted to grant the owner role`,
  })
  throw new RefusedError('owner-grant', 'granting owner requires system.owner.transfer')
}

/**
 * Turn a refused write into the error to throw, recording the denial when it is one.
 *
 * The last-owner rule is enforced by a constraint trigger rather than only here, so this catches a
 * decision the database has already made and gives it words. Left uncaught it is a 500 on a button
 * press, which tells the person neither what happened nor what to do instead.
 *
 * TWO ROWS LAND FOR ONE REFUSAL, DELIBERATELY: the DENIED row below, which names the target and
 * the rule, and withPermission()'s own ERROR row for the action that did not complete. The wrapper
 * takes no entity, so it cannot say which record was involved; until its signature widens, the row
 * that carries that is written here.
 */
/**
 * Turn a failed staff-profile write into something a person can act on, and record the refusal.
 *
 * The repository layer maps SQLSTATEs onto its own error vocabulary before this sees them, so the
 * last-owner trigger's `check_violation` arrives as a ValidationError carrying the constraint's
 * name. Matching on that rather than on a raw code keeps this working through the repository
 * boundary — and the boundary is what makes every other write in the system validated.
 */
async function refusalFor(
  session: StaffSession,
  error: unknown,
  action: string,
  entityId: string,
): Promise<Error> {
  if (isLastOwnerRefusal(error)) {
    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action,
      result: 'DENIED',
      entityType: ENTITY,
      entityId,
      summary: 'refused by enforce_last_owner: the project would be left with no active owner',
    })
    return new RefusedError('last-owner', 'the last active owner cannot be demoted or suspended')
  }

  // Deliberately incurious about the detail: a database message can quote the row it refused, and
  // this string reaches a browser.
  return new Error('the staff profile could not be updated', { cause: error })
}

/** The role and status a record held before a change, for the audit row's `before`. */
async function readProfileState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ role: Role; status: string } | null> {
  const profile = await findStaffProfile(supabase, userId)
  return profile ? { role: profile.role, status: profile.status } : null
}

const inviteStaff = withPermission(
  'system.users.manage',
  'system.users.invite',
  async (
    session,
    input: z.infer<typeof inviteSchema>,
    redirectTo: string | undefined,
  ): Promise<NoticeCode> => {
    await assertMayGrantOwner(session, 'system.users.invite', null, input.role)

    const result = await inviteStaffMember({
      email: input.email,
      role: input.role,
      displayName: input.displayName === '' ? null : input.displayName,
      invitedBy: session.userId,
      redirectTo,
    })

    if (result.outcome === 'EMAIL_IN_USE') {
      throw new RefusedError('email-in-use', 'that address already has an account')
    }

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'system.users.invite',
      result: 'SUCCESS',
      entityType: ENTITY,
      entityId: result.userId,
      // No email here, at any depth: redact() strips the key anyway, and an audit row that names
      // the account by id says everything the log needs without holding a second copy of it.
      after: { role: input.role, status: 'INVITED' },
    })

    return 'invited'
  },
)

const changeRole = withPermission(
  'system.users.manage',
  'system.users.role.change',
  async (session, input: z.infer<typeof roleChangeSchema>): Promise<NoticeCode> => {
    const supabase = await createClient()
    const before = await readProfileState(supabase, input.userId)

    await assertMayGrantOwner(
      session,
      'system.users.role.change',
      before?.role ?? null,
      input.role,
      input.userId,
    )

    try {
      await updateStaffRole(supabase, input.userId, input.role, session.userId)
    } catch (error) {
      throw await refusalFor(session, error, 'system.users.role.change', input.userId)
    }

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'system.users.role.change',
      result: 'SUCCESS',
      entityType: ENTITY,
      entityId: input.userId,
      ...(before === null ? {} : { before: { role: before.role } }),
      after: { role: input.role },
    })

    return 'role-changed'
  },
)

const changeStatus = withPermission(
  'system.users.manage',
  'system.users.status.change',
  async (session, input: z.infer<typeof statusChangeSchema>): Promise<NoticeCode> => {
    const supabase = await createClient()
    const before = await readProfileState(supabase, input.userId)

    try {
      await updateStaffStatus(supabase, input.userId, input.status, session.userId)
    } catch (error) {
      throw await refusalFor(session, error, 'system.users.status.change', input.userId)
    }

    await writeAudit({
      actorUserId: session.userId,
      actorRole: session.role,
      action: 'system.users.status.change',
      result: 'SUCCESS',
      entityType: ENTITY,
      entityId: input.userId,
      ...(before === null ? {} : { before: { status: before.status } }),
      after: { status: input.status },
    })

    return input.status === 'ACTIVE' ? 'activated' : 'suspended'
  },
)

/* ------------------------------------------------------------------ the Server Actions */

/**
 * A refusal becomes a notice; anything else keeps travelling.
 *
 * Swallowing an unknown error here would turn a broken database connection into "that request was
 * not valid", which is a lie the audit log would then be the only record of.
 */
function noticeFor(error: unknown): NoticeCode {
  if (error instanceof RefusedError) return error.notice
  throw error
}

/**
 * Where the invitation link comes back to.
 *
 * `origin` is present on every Server Action request — Next compares it to the host before the
 * action runs — and using it means the link returns to the deployment the invitation was issued
 * from rather than to whatever the project's Site URL happens to be. Absent, GoTrue falls back to
 * that Site URL, which is the correct behaviour on a deployment that has one.
 */
async function invitationReturnUrl(): Promise<string | undefined> {
  const origin = (await headers()).get('origin')
  return origin === null ? undefined : `${origin}${LOGIN_PATH}`
}

async function inviteAction(formData: FormData): Promise<void> {
  'use server'

  let notice: NoticeCode
  try {
    const input = parseOrRefuse(inviteSchema, {
      email: field(formData, 'email'),
      displayName: field(formData, 'displayName'),
      role: field(formData, 'role'),
    })
    notice = await inviteStaff(input, await invitationReturnUrl())
  } catch (error) {
    notice = noticeFor(error)
  }

  // Outside the try: redirect() signals itself by throwing, and catching that would turn every
  // successful action into a caught error.
  redirect(`${USERS_PATH}?notice=${notice}`)
}

async function changeRoleAction(formData: FormData): Promise<void> {
  'use server'

  let notice: NoticeCode
  try {
    const input = parseOrRefuse(roleChangeSchema, {
      userId: field(formData, 'userId'),
      role: field(formData, 'role'),
    })
    notice = await changeRole(input)
  } catch (error) {
    notice = noticeFor(error)
  }

  redirect(`${USERS_PATH}?notice=${notice}`)
}

async function changeStatusAction(formData: FormData): Promise<void> {
  'use server'

  let notice: NoticeCode
  try {
    const input = parseOrRefuse(statusChangeSchema, {
      userId: field(formData, 'userId'),
      status: field(formData, 'status'),
    })
    notice = await changeStatus(input)
  } catch (error) {
    notice = noticeFor(error)
  }

  redirect(`${USERS_PATH}?notice=${notice}`)
}

/* ------------------------------------------------------------------ presentation */

export const metadata: Metadata = {
  title: t('studio.users.pageTitle'),
}

/** UTC, and said in the markup rather than in words: `dateTime` carries the exact instant for
 *  anything reading the page, and the rendered form is only for a person scanning the column. */
const LAST_SEEN_FORMAT = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

const CELL = 'border-b border-line px-4 py-3 align-middle'
const HEADER_CELL = 'border-b border-line-strong px-4 py-3 text-sm font-medium text-ink-secondary'

/** Distinguishes one row's controls from the next for anyone listening rather than looking. */
function personLabel(profile: StaffProfileRow): string {
  return profile.email ?? profile.display_name ?? profile.user_id
}

function NoticeBanner({ code }: { code: NoticeCode }) {
  const message = t(NOTICE_STRING[code])

  return (
    <Surface level={1} className="px-4 py-3">
      {REFUSALS.has(code) ? (
        <ErrorText>{message}</ErrorText>
      ) : (
        <Text size="sm" role="status">
          {message}
        </Text>
      )}
    </Surface>
  )
}

export default async function StaffUsersPage({
  searchParams,
}: {
  // Typed by hand rather than with the generated `PageProps<'/studio/system/users'>` helper: that
  // union is emitted from the routes Next has already seen, so it does not name this page until
  // something has built or served it once, and a type that only compiles after a dev server has
  // run is a poor gate for `tsc --noEmit`.
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requirePermission('system.users.manage')

  const supabase = await createClient()
  // Oldest first, so the account that founded the project stays at the top of the list. The
  // repository validates every row against its schema on the way out, so a drifted column surfaces
  // as a named error here rather than as a blank table.
  const data = await listStaffProfiles(supabase)

  const profiles = z.array(profileSchema).parse(data)

  const rawNotice = (await searchParams)['notice']
  const parsedNotice = noticeSchema.safeParse(rawNotice)
  const notice = parsedNotice.success ? parsedNotice.data : null

  // Visibility, not authorisation: assertMayGrantOwner() refuses the grant whatever the form
  // offered. Leaving an option in the list that is always refused would just teach people that
  // the interface guesses.
  const mayGrantOwner = roleHasPermission(session.role, 'system.owner.transfer')
  const grantableRoles = ROLES.filter((role) => role !== 'owner' || mayGrantOwner)

  return (
    // The Studio ground is BONE (§2.4). Declared here as well as in the group layout because the
    // class only redeclares the tokens: the element that carries it must also paint its ground and
    // re-resolve its ink, or a bone panel inherits the deep page's computed colour.
    <main className="rv-scheme-bone bg-surface text-ink min-h-screen">
      <div className="mx-auto max-w-(--container-wide) px-(--rv-gutter) py-16">
        <Stack gap={10}>
          <Stack gap={3}>
            <Heading level={1} size="display-md">
              {t('studio.users.heading')}
            </Heading>
            <Text tone="secondary" size="md">
              {t('studio.users.body')}
            </Text>
          </Stack>

          {notice === null ? null : <NoticeBanner code={notice} />}

          <Surface as="section" level={1}>
            {/* The table is the one thing on this page that cannot reflow at 360px, so it scrolls
                inside its own box rather than making the document scroll sideways. */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <VisuallyHidden as="caption">{t('studio.users.tableCaption')}</VisuallyHidden>
                <thead>
                  <tr>
                    <th scope="col" className={HEADER_CELL}>
                      {t('studio.users.columnPerson')}
                    </th>
                    <th scope="col" className={HEADER_CELL}>
                      {t('studio.users.columnRole')}
                    </th>
                    <th scope="col" className={HEADER_CELL}>
                      {t('studio.users.columnStatus')}
                    </th>
                    <th scope="col" className={HEADER_CELL}>
                      {t('studio.users.columnLastSeen')}
                    </th>
                    <th scope="col" className={HEADER_CELL}>
                      {t('studio.users.columnAccount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.length === 0 ? (
                    <tr>
                      <td className={CELL} colSpan={5}>
                        <Text size="sm" tone="secondary">
                          {t('studio.users.emptyTable')}
                        </Text>
                      </td>
                    </tr>
                  ) : (
                    profiles.map((profile) => {
                      const status = profile.status
                      const isActive = status === 'ACTIVE'
                      const nextStatus: StaffStatus = isActive ? 'SUSPENDED' : 'ACTIVE'
                      const statusActionLabel = isActive
                        ? t('studio.users.suspendButton')
                        : status === 'INVITED'
                          ? t('studio.users.activateButton')
                          : t('studio.users.reactivateButton')
                      const who = personLabel(profile)
                      // The row's own role is always offered, so a select never misreports the
                      // record it belongs to when the viewer may not grant that role.
                      const options = ROLES.filter(
                        (role) => grantableRoles.includes(role) || role === profile.role,
                      )

                      return (
                        <tr key={profile.user_id}>
                          <td className={CELL}>
                            <Stack gap={1}>
                              <Text as="span" size="sm">
                                {profile.email ?? t('studio.users.noEmail')}
                              </Text>
                              <Text as="span" size="xs" tone="tertiary">
                                {profile.display_name ?? t('studio.users.noDisplayName')}
                              </Text>
                            </Stack>
                          </td>

                          <td className={CELL}>
                            <form action={changeRoleAction}>
                              <input type="hidden" name="userId" value={profile.user_id} />
                              <div className="flex items-center gap-2">
                                <Select
                                  name="role"
                                  defaultValue={profile.role}
                                  aria-label={`${t('studio.users.roleControlLabel')} ${who}`}
                                  className="min-w-44"
                                >
                                  {options.map((role) => (
                                    <option key={role} value={role}>
                                      {t(ROLE_LABEL[role])}
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  type="submit"
                                  size="sm"
                                  aria-label={`${t('studio.users.roleSubmit')} ${who}`}
                                >
                                  {t('studio.users.roleSubmit')}
                                </Button>
                              </div>
                            </form>
                          </td>

                          <td className={CELL}>
                            <Badge tone={STATUS_TONE[status]}>{t(STATUS_LABEL[status])}</Badge>
                          </td>

                          <td className={CELL}>
                            {profile.last_seen_at === null ? (
                              <Text as="span" size="sm" tone="tertiary">
                                {t('studio.users.neverSeen')}
                              </Text>
                            ) : (
                              <Text as="span" size="sm" tone="secondary">
                                <time dateTime={profile.last_seen_at}>
                                  {LAST_SEEN_FORMAT.format(new Date(profile.last_seen_at))}
                                </time>
                              </Text>
                            )}
                          </td>

                          <td className={CELL}>
                            <form action={changeStatusAction}>
                              <input type="hidden" name="userId" value={profile.user_id} />
                              <input type="hidden" name="status" value={nextStatus} />
                              <Button
                                type="submit"
                                size="sm"
                                variant={isActive ? 'danger' : 'secondary'}
                                aria-label={`${statusActionLabel} ${who}`}
                              >
                                {statusActionLabel}
                              </Button>
                            </form>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface as="section" level={1} className="p-6" aria-labelledby="staff-invite-heading">
            <Stack gap={5}>
              <Stack gap={2}>
                <Heading level={2} size="display-xs" id="staff-invite-heading">
                  {t('studio.users.inviteHeading')}
                </Heading>
                <Text size="sm" tone="secondary">
                  {t('studio.users.inviteBody')}
                </Text>
              </Stack>

              <form action={inviteAction}>
                <Stack gap={5} className="max-w-(--container-prose)">
                  <Field
                    label={t('studio.users.inviteEmailLabel')}
                    help={t('studio.users.inviteEmailHelp')}
                    required
                    requiredLabel={t('studio.users.requiredLabel')}
                  >
                    <Input type="email" name="email" autoComplete="off" spellCheck={false} />
                  </Field>

                  <Field
                    label={t('studio.users.inviteNameLabel')}
                    help={t('studio.users.inviteNameHelp')}
                  >
                    <Input type="text" name="displayName" autoComplete="off" />
                  </Field>

                  <Field
                    label={t('studio.users.inviteRoleLabel')}
                    help={t('studio.users.inviteRoleHelp')}
                    required
                    requiredLabel={t('studio.users.requiredLabel')}
                  >
                    {/* Least privilege is the default the form offers, as well as the one the
                        provisioning trigger writes. */}
                    <Select name="role" defaultValue="viewer">
                      {grantableRoles.map((role) => (
                        <option key={role} value={role}>
                          {t(ROLE_LABEL[role])}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <div>
                    <Button type="submit" variant="primary">
                      {t('studio.users.inviteSubmit')}
                    </Button>
                  </div>
                </Stack>
              </form>
            </Stack>
          </Surface>
        </Stack>
      </div>
    </main>
  )
}
