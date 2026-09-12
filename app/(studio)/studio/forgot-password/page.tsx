import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
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
import { requestPasswordReset } from '@/lib/auth/password-reset'
import { logSystem } from '@/lib/logging/system-log'
import {
  PASSWORD_RESET_WINDOWS,
  addressFromHeaders,
  bucketKey,
  consume,
  hashIdentifier,
  retryAfterSeconds,
} from '@/lib/security/rate-limit'

/**
 * `/studio/forgot-password` — the second unauthenticated Studio route (D4, amendment A43).
 *
 * A Server Component with one Server Action and no client bundle, for the same reason the login
 * page is one: somebody locked out of the Studio is the person least well served by a form that
 * needs JavaScript to work. Every outcome comes back as a redirect carrying a query parameter.
 *
 * THIS PAGE ANSWERS THE SAME WAY WHATEVER HAPPENS. An address with an account, an address without
 * one, and an address the auth service refused all produce the identical notice. The temptation to
 * say "no account with that address" is real — it is genuinely helpful to the person who mistyped
 * — and it is an account-enumeration oracle available to anybody on the internet, which turns a
 * public form into a list of Rivya's staff addresses. The one outcome that is reported differently
 * is the throttle, and it reveals nothing: it is a fact about the requester, not about the address.
 *
 * THERE IS NO "FORGOTTEN ID" FORM HERE, AND THERE CANNOT BE. The sign-in ID *is* the email address
 * — `staff_profiles` holds no username and GoTrue authenticates on the address — so a form that
 * recovered one would have to take some other identifier and answer "your account is <address>",
 * which is the enumeration oracle again wearing a different hat. The note beneath the form says so,
 * and names the two places a person can actually be told: an owner or admin at System → Users, and
 * `npm run auth:list-users` for whoever holds the service-role key.
 */

const FORGOT_PATH = '/studio/forgot-password'
const LOGIN_PATH = '/studio/login'

/**
 * The three states the page can be asked to render.
 *
 * `link` arrives from `/api/auth/confirm` when a recovery link could not be exchanged for a
 * session — expired, already spent, or mangled by a mail client. It is shown HERE rather than on
 * the reset page because the only useful next step is the form on this page.
 */
const ERROR_STRINGS = {
  fields: 'studio.forgotPassword.errorFields',
  throttled: 'studio.forgotPassword.errorThrottled',
  link: 'studio.forgotPassword.errorLink',
} as const

const errorSchema = z.enum(['fields', 'throttled', 'link'])
const noticeSchema = z.literal('sent')

/** Lower-cased before validation so the hash that keys the rate limit matches the one the sign-in
 *  limiter derives from the same address. */
const emailSchema = z.object({
  email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
})

function forgotUrl(query: Record<string, string>): string {
  return `${FORGOT_PATH}?${new URLSearchParams(query).toString()}`
}

/** `typedRoutes` checks `redirect()` against the routes the compiler can see; every destination
 *  here is assembled from a query string rather than written as a literal. */
function redirectTo(path: string): never {
  redirect(path as Route)
}

/**
 * Ask for a link.
 *
 * THE RATE LIMIT COMES BEFORE THE AUTH SERVICE, and it is tighter than the sign-in limiter, because
 * this action has a side effect that lands somewhere other than here: it sends mail to an address
 * the requester merely typed. Unthrottled, the form is a way to fill a colleague's inbox in Rivya's
 * name from a page that requires no account.
 */
async function requestResetAction(formData: FormData): Promise<void> {
  'use server'

  const parsed = emailSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) redirectTo(forgotUrl({ error: 'fields' }))

  const address = addressFromHeaders(await headers())
  const [byAddress, byEmail] = await Promise.all([
    consume(bucketKey('reset_ip', address), PASSWORD_RESET_WINDOWS),
    consume(bucketKey('reset_email', hashIdentifier(parsed.data.email)), PASSWORD_RESET_WINDOWS),
  ])

  if (!byAddress.allowed || !byEmail.allowed) {
    /*
     * A SECURITY LOG AND NO AUDIT ROW, exactly as the login page's throttle does it: `audit_logs`
     * records what an ACTOR did, and there is no actor here — no session, and an address that may
     * belong to nobody. The hashed keys let the owner see that one address or one mailbox is being
     * worked on without learning which.
     */
    await logSystem({
      level: 'SECURITY',
      channel: 'AUTH',
      event: 'auth.password_reset.rate_limited',
      message:
        'Password-reset request refused by the rate limiter before the auth service was asked',
      context: {
        by_address: !byAddress.allowed,
        by_email: !byEmail.allowed,
        retry_after_s: retryAfterSeconds(PASSWORD_RESET_WINDOWS),
      },
    })
    redirectTo(forgotUrl({ error: 'throttled' }))
  }

  await requestPasswordReset(parsed.data.email)

  // The same destination whatever the auth service said. See the note at the top of the file.
  redirectTo(forgotUrl({ notice: 'sent' }))
}

export const metadata: Metadata = {
  title: t('studio.forgotPassword.pageTitle'),
  // Like the login page: a staff recovery surface has nothing to offer an index, and being absent
  // from one removes it from the list of doors an opportunist knocks on.
  robots: { index: false, follow: false },
}

type ForgotPasswordPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams
  const inlineError = errorSchema.safeParse(params.error)
  const sent = noticeSchema.safeParse(params.notice).success

  return (
    <main className="flex min-h-svh items-center justify-center px-(--rv-gutter) py-16">
      <Stack gap={8} className="w-full max-w-md">
        <Stack gap={3}>
          <Heading level={1} size="display-sm">
            {t('studio.forgotPassword.heading')}
          </Heading>
          <Text tone="secondary">{t('studio.forgotPassword.body')}</Text>
        </Stack>

        {sent ? (
          <Surface level={2} className="px-5 py-4">
            {/* role="status", not an ErrorText: this is the ordinary outcome, and it is the same
                outcome whether or not the address has an account. */}
            <Text size="sm" tone="secondary" role="status">
              {t('studio.forgotPassword.noticeSent')}
            </Text>
          </Surface>
        ) : null}

        <Surface as="section" level={1} className="px-6 py-6">
          <form action={requestResetAction}>
            <Stack gap={5}>
              {inlineError.success ? (
                <ErrorText>{t(ERROR_STRINGS[inlineError.data])}</ErrorText>
              ) : null}

              <Field
                label={t('studio.forgotPassword.emailLabel')}
                required
                requiredLabel={t('studio.forgotPassword.requiredLabel')}
              >
                <Input name="email" type="email" autoComplete="email" spellCheck={false} />
              </Field>

              <Button type="submit" variant="primary">
                {t('studio.forgotPassword.submitButton')}
              </Button>
            </Stack>
          </form>
        </Surface>

        <Stack gap={3}>
          <Text size="sm" tone="tertiary">
            {t('studio.forgotPassword.identityNote')}
          </Text>
          <Text size="sm">
            <Link href={LOGIN_PATH as Route} className="underline underline-offset-4">
              {t('studio.forgotPassword.backLink')}
            </Link>
          </Text>
        </Stack>
      </Stack>
    </main>
  )
}
