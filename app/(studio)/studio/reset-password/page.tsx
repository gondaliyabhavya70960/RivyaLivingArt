import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { Button } from '@/components/primitives/Button'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Field } from '@/components/primitives/Field'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { writeAudit } from '@/lib/auth/audit'
import { setPasswordForCurrentSession } from '@/lib/auth/password-reset'
import { getStaffSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

/**
 * `/studio/reset-password` — the third unauthenticated Studio route (D4, amendment A43).
 *
 * "UNAUTHENTICATED" IS ABOUT THE PROXY, NOT ABOUT THE PAGE. `proxy.ts` does not redirect a request
 * here, and the page still refuses to do anything without a session: the recovery link established
 * one on its way through `/api/auth/confirm`, and `setPasswordForCurrentSession()` acts on that
 * session and can act on no other. The exclusion exists so that somebody arriving with a spent link
 * is told their link expired, instead of being bounced to a login form that explains nothing about
 * why the link they just clicked did not work.
 *
 * A RECOVERY SESSION IS NOT A STUDIO SESSION. It authenticates an auth account; it grants no
 * Studio access by itself, because every Studio page resolves `getStaffSession()` separately and
 * that admits only an ACTIVE staff profile. So this page is reachable by anybody holding a valid
 * recovery link for an account, including an INVITED or SUSPENDED one — and the new password opens
 * exactly as much as the old one did.
 *
 * THE PASSWORD POLICY IS THE AUTH SERVER'S. This page checks that two fields match and that neither
 * is empty; whether the password is strong enough is GoTrue's answer to report, not this form's to
 * predict. A minimum restated here is a rule that disagrees with the configured one the day
 * somebody raises it.
 */

const RESET_PATH = '/studio/reset-password'
const LOGIN_PATH = '/studio/login'
const FORGOT_PATH = '/studio/forgot-password'

const ERROR_STRINGS = {
  fields: 'studio.resetPassword.errorFields',
  mismatch: 'studio.resetPassword.errorMismatch',
  weak: 'studio.resetPassword.errorWeak',
  same: 'studio.resetPassword.errorSame',
} as const

const errorSchema = z.enum(['fields', 'mismatch', 'weak', 'same'])

/**
 * A length bound, not a policy. The maximum is a denial-of-service guard — bcrypt on a megabyte of
 * input is a CPU bill — and the minimum of one only distinguishes "typed something" from "submitted
 * an empty form", which is this page's business rather than the auth server's.
 */
const passwordSchema = z.object({
  password: z.string().min(1).max(1024),
  confirm: z.string().min(1).max(1024),
})

function resetUrl(query: Record<string, string>): string {
  return `${RESET_PATH}?${new URLSearchParams(query).toString()}`
}

function redirectTo(path: string): never {
  redirect(path as Route)
}

/**
 * Set the password, end every session, and send the person to the sign-in form.
 *
 * WHY A GLOBAL SIGN-OUT AND NOT A LOCAL ONE. A password reset is the control somebody reaches for
 * when they think an account has been reached by somebody else, and a reset that leaves the other
 * party's session alive does not answer that at all. It is the one place where the sign-out button's
 * rule — this browser only, because staff sign in from a phone and a desktop — is the wrong default:
 * signing the other devices out costs their owner one sign-in and costs an intruder everything.
 *
 * WHY IT ENDS AT THE LOGIN PAGE rather than at the Studio. The session in hand came from a link in
 * an email, and the point of the exercise was the password. Making the new password open the door
 * once, here, is the proof that it works — and it is the same step the person would otherwise
 * discover tomorrow, at a worse moment.
 */
async function setPasswordAction(formData: FormData): Promise<void> {
  'use server'

  const parsed = passwordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) redirectTo(resetUrl({ error: 'fields' }))
  if (parsed.data.password !== parsed.data.confirm) redirectTo(resetUrl({ error: 'mismatch' }))

  const supabase = await createClient()

  // BEFORE the change, because a role is worth having on the audit row and the session is about to
  // end. A person resetting from an INVITED or SUSPENDED profile has no staff session at all, which
  // is why the actor falls back to the authenticated id below.
  const session = await getStaffSession()
  const authUserId = (await supabase.auth.getUser()).data.user?.id

  const outcome = await setPasswordForCurrentSession(parsed.data.password)

  if (outcome === 'NO_SESSION') redirectTo(`${FORGOT_PATH}?error=link`)
  if (outcome === 'WEAK_PASSWORD') redirectTo(resetUrl({ error: 'weak' }))
  if (outcome === 'SAME_PASSWORD') redirectTo(resetUrl({ error: 'same' }))

  if (authUserId !== undefined) {
    await writeAudit({
      actorUserId: authUserId,
      ...(session ? { actorRole: session.role } : {}),
      action: 'auth.password.reset',
      result: 'SUCCESS',
      // No address, no password, nothing about either. The row records that this account's password
      // was set through the recovery flow, which is the whole of what a reader needs.
      summary: 'password set through the recovery link; all sessions ended',
    })
  }

  // `global`, and the note above says why. It also ends THIS session, which is what puts the login
  // form in front of the person rather than a Studio page they are still signed into.
  await supabase.auth.signOut({ scope: 'global' })

  redirectTo(`${LOGIN_PATH}?reset=1`)
}

export const metadata: Metadata = {
  title: t('studio.resetPassword.pageTitle'),
  robots: { index: false, follow: false },
}

type ResetPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams
  const inlineError = errorSchema.safeParse(params.error)

  // getUser(), not getSession(): the cookie is whatever the browser last sent, and only the auth
  // server can say whether the recovery token behind it is still good.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-svh items-center justify-center px-(--rv-gutter) py-16">
      <Stack gap={8} className="w-full max-w-md">
        {user ? (
          <>
            <Stack gap={3}>
              <Heading level={1} size="display-sm">
                {t('studio.resetPassword.heading')}
              </Heading>
              <Text tone="secondary">{t('studio.resetPassword.body')}</Text>
            </Stack>

            <Surface as="section" level={1} className="px-6 py-6">
              <form action={setPasswordAction}>
                <Stack gap={5}>
                  {inlineError.success ? (
                    <ErrorText>{t(ERROR_STRINGS[inlineError.data])}</ErrorText>
                  ) : null}

                  <Field
                    label={t('studio.resetPassword.passwordLabel')}
                    required
                    requiredLabel={t('studio.resetPassword.requiredLabel')}
                  >
                    <Input name="password" type="password" autoComplete="new-password" />
                  </Field>

                  <Field
                    label={t('studio.resetPassword.confirmLabel')}
                    required
                    requiredLabel={t('studio.resetPassword.requiredLabel')}
                  >
                    <Input name="confirm" type="password" autoComplete="new-password" />
                  </Field>

                  <Button type="submit" variant="primary">
                    {t('studio.resetPassword.submitButton')}
                  </Button>
                </Stack>
              </form>
            </Surface>
          </>
        ) : (
          /* No session, so there is nothing to set a password on. No form: another submission
             cannot conjure the token back, and the only useful control is the one that asks for a
             fresh link. */
          <Surface as="section" level={1} className="px-6 py-6">
            <Stack gap={4}>
              <Heading level={1} size="display-xs">
                {t('studio.resetPassword.expiredHeading')}
              </Heading>
              <Text size="sm" tone="secondary">
                {t('studio.resetPassword.expiredBody')}
              </Text>
              <Text size="sm">
                <Link href={FORGOT_PATH as Route} className="underline underline-offset-4">
                  {t('studio.resetPassword.requestNewLink')}
                </Link>
              </Text>
            </Stack>
          </Surface>
        )}
      </Stack>
    </main>
  )
}
