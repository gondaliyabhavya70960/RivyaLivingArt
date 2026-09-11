import type { Metadata, Route } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { t } from '@/components/studio/strings'
import { Button } from '@/components/primitives/Button'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Field } from '@/components/primitives/Field'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { writeAudit } from '@/lib/auth/audit'
import { getStaffSession } from '@/lib/auth/session'
import { logSystem } from '@/lib/logging/system-log'
import {
  SIGN_IN_WINDOWS,
  addressFromHeaders,
  bucketKey,
  consume,
  hashIdentifier,
  retryAfterSeconds,
} from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { resolveNextPath } from '@/lib/auth/next-path'

/**
 * The only unauthenticated Studio route (D4, amendment A2·b).
 *
 * A Server Component with one Server Action and no client bundle: the form submits without
 * JavaScript, so the sign-in surface works before hydration and on a failed one. That is also why
 * every outcome comes back as a redirect carrying a query parameter rather than as returned action
 * state — returned state needs `useActionState`, which needs a Client Component.
 *
 * The submitted email is deliberately NOT echoed back into that redirect. Re-typing an address is a
 * smaller cost than putting one in the URL bar, the browser history, the referrer header and every
 * proxy log between here and the visitor.
 *
 * NOTHING HERE AUTHORISES ANYTHING. This page decides only whether someone may see the login form,
 * a notice, or a redirect. Every authenticated Studio page calls `requirePermission()` in its own
 * body; RLS refuses underneath that. Sign-in is the start of the chain, not a substitute for it.
 */

/** Where a signed-in staff member lands when no valid `next` was carried in. */
const LOGIN_PATH = '/studio/login'
const SIGN_OUT_PATH = '/api/auth/sign-out'

/**
 * The three failures the form reports inline. Each maps to a string; none names an account.
 *
 * `throttled` IS SEPARATE FROM `credentials` ON PURPOSE — Phase 41. Reporting a rate-limited attempt
 * as a bad password sends somebody to reset a password that was correct, and the copy has to say
 * "wait" rather than "check your details". It still names no account and reveals nothing about
 * whether the email exists.
 */
const LOGIN_ERROR_STRINGS = {
  credentials: 'studio.login.errorSignIn',
  fields: 'studio.login.errorFields',
  throttled: 'studio.login.errorThrottled',
} as const

const loginErrorSchema = z.enum(['credentials', 'fields', 'throttled'])
const flagSchema = z.literal('1')

/** Password bounds are a denial-of-service guard, not a policy: the auth server owns the policy,
 *  and duplicating it here would reject valid credentials the day it changes. */
const credentialsSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(1024),
})

function loginUrl(query: Record<string, string>): string {
  return `${LOGIN_PATH}?${new URLSearchParams(query).toString()}`
}

/**
 * `typedRoutes` checks `redirect()` against the routes the compiler can see, and not one
 * destination here is a literal: `next` is decided at request time and the failure URLs are
 * assembled from a query string. This is where the runtime guarantee meets the compile-time one —
 * every value that reaches it is either one of the two constants above or a string that has passed
 * `isStudioPath()`. Widening the cast to cover an unvalidated value re-opens the redirect hole.
 */
function redirectTo(path: string): never {
  redirect(path as Route)
}

/**
 * Sign in, then hand off to the page that will decide what this person may do.
 *
 * The staff check happens here as well as on the destination page for one reason: a person who
 * authenticates but holds no ACTIVE staff profile must not keep a session. Leaving them signed in
 * would give them a cookie that opens nothing, and a redirect loop through `proxy.ts` to prove it.
 */
async function signInAction(formData: FormData): Promise<void> {
  'use server'

  const next = resolveNextPath(formData.get('next'))

  const credentials = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!credentials.success) redirectTo(loginUrl({ error: 'fields', next }))

  /*
   * RATE LIMITED BEFORE THE CREDENTIAL IS TRIED — Phase 41. Ten attempts per fifteen minutes.
   *
   * TWO KEYS, CONSUMED SEPARATELY, because the two attacks look nothing alike. Many attempts from one
   * address is somebody who forgot their password, or a script working a wordlist against one
   * account; many attempts against one email from many addresses is credential stuffing. A single key
   * would miss whichever one it was not.
   *
   * NEITHER KEY IS A VALUE ANYBODY CAN READ BACK. The address is HMAC'd and the email is lower-cased
   * and HMAC'd, so `rate_limit_buckets` records that somebody is trying repeatedly without recording
   * who — which matters on a table that, unlike the rest of the schema, is written by an
   * unauthenticated caller.
   *
   * A REFUSAL IS ITS OWN ERROR CODE, not "credentials". Telling a person their password was wrong
   * when in fact they were throttled sends them to reset a password that was correct.
   */
  const address = addressFromHeaders(await headers())
  const [byAddress, byEmail] = await Promise.all([
    consume(bucketKey('signin_ip', address), SIGN_IN_WINDOWS),
    consume(bucketKey('signin_email', hashIdentifier(credentials.data.email)), SIGN_IN_WINDOWS),
  ])
  if (!byAddress.allowed || !byEmail.allowed) {
    /*
     * A SECURITY LOG AND NO AUDIT ROW. `audit_logs` is a record of what an ACTOR did, and a refused
     * sign-in has no actor — there is no session and the email may belong to nobody. The system log
     * is where an unattributed security event belongs (Phase 38), and it records the hashed keys so
     * the owner can see that one address or one account is being worked on without learning which.
     */
    await logSystem({
      level: 'SECURITY',
      channel: 'AUTH',
      event: 'auth.signin.rate_limited',
      message: 'Sign-in refused by the rate limiter before the credential was tried',
      context: {
        by_address: !byAddress.allowed,
        by_email: !byEmail.allowed,
        retry_after_s: retryAfterSeconds(SIGN_IN_WINDOWS),
      },
    })
    redirectTo(loginUrl({ error: 'throttled', next }))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(credentials.data)

  // No audit row for a rejected credential. It is written through the service role with no session
  // to rate-limit it, so an unauthenticated caller would be choosing how many rows the table grows
  // by; Supabase Auth records the attempt on its own side, where the throttling lives.
  if (error || !data.user) redirectTo(loginUrl({ error: 'credentials', next }))

  // Reads back through the cookies the sign-in just wrote, so the ACTIVE-profile rule and the
  // status checks stay in one place (lib/auth/session.ts) rather than being restated here.
  const session = await getStaffSession()

  if (!session) {
    await supabase.auth.signOut()
    await writeAudit({
      actorUserId: data.user.id,
      action: 'auth.signin.denied',
      result: 'DENIED',
      summary: 'authenticated account has no ACTIVE staff profile; session revoked',
    })
    redirectTo(loginUrl({ denied: '1', next }))
  }

  await writeAudit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'auth.signin',
    result: 'SUCCESS',
  })

  redirectTo(next)
}

export const metadata: Metadata = {
  title: t('studio.login.pageTitle'),
  // A staff sign-in surface has nothing to offer an index, and being absent from one removes it
  // from the list of doors an opportunist knocks on.
  robots: { index: false, follow: false },
}

type StudioLoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function StudioLoginPage({ searchParams }: StudioLoginPageProps) {
  const params = await searchParams
  const next = resolveNextPath(params.next)
  const inlineError = loginErrorSchema.safeParse(params.error)
  const expired = flagSchema.safeParse(params.expired).success
  const deniedThisAttempt = flagSchema.safeParse(params.denied).success

  const session = await getStaffSession()
  if (session) redirectTo(next)

  // Only asked once the staff lookup has already failed, and only to tell two different people
  // apart: someone with no session at all, who needs the form, and someone holding a live auth
  // session that no staff profile matches, who needs to be told so and given a way out of it.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-svh items-center justify-center px-(--rv-gutter) py-16">
      <Stack gap={8} className="w-full max-w-md">
        <Stack gap={3}>
          <Heading level={1} size="display-sm">
            {t('studio.login.heading')}
          </Heading>
          <Text tone="secondary">{t('studio.login.body')}</Text>
        </Stack>

        {expired ? (
          <Surface level={2} className="px-5 py-4">
            <Text size="sm" tone="secondary" role="status">
              {t('studio.login.noticeExpired')}
            </Text>
          </Surface>
        ) : null}

        {user ? (
          /* Signed in, and not staff. No form: another password will not change the answer, and
             the only useful control is the one that ends the session they are holding. */
          <Surface as="section" level={1} className="px-6 py-6">
            <Stack gap={4}>
              <Heading level={2} size="display-xs">
                {t('studio.login.noAccessHeading')}
              </Heading>
              <Text size="sm" tone="secondary">
                {t('studio.login.noAccessBody')}
              </Text>
              {/* The one sign-out path there is: POST, origin-checked, audited, 303 back to
                  here (app/api/auth/sign-out/route.ts). A second implementation as a Server
                  Action would be a second place for the scope and the audit row to drift. */}
              <form method="post" action={SIGN_OUT_PATH}>
                <Button type="submit" variant="secondary">
                  {t('studio.login.signOutButton')}
                </Button>
              </form>
            </Stack>
          </Surface>
        ) : (
          <Surface as="section" level={1} className="px-6 py-6">
            <form action={signInAction}>
              <Stack gap={5}>
                {deniedThisAttempt ? (
                  <Stack gap={2}>
                    <ErrorText>{t('studio.login.noAccessHeading')}</ErrorText>
                    <Text size="sm" tone="secondary">
                      {t('studio.login.noAccessBody')}
                    </Text>
                  </Stack>
                ) : null}

                {inlineError.success ? (
                  <ErrorText>{t(LOGIN_ERROR_STRINGS[inlineError.data])}</ErrorText>
                ) : null}

                {/* Revalidated by the action; a hidden field is a suggestion, never a permission. */}
                <input type="hidden" name="next" value={next} />

                <Field
                  label={t('studio.login.emailLabel')}
                  required
                  requiredLabel={t('studio.login.requiredLabel')}
                >
                  <Input name="email" type="email" autoComplete="email" spellCheck={false} />
                </Field>

                <Field
                  label={t('studio.login.passwordLabel')}
                  required
                  requiredLabel={t('studio.login.requiredLabel')}
                >
                  <Input name="password" type="password" autoComplete="current-password" />
                </Field>

                <Button type="submit" variant="primary">
                  {t('studio.login.submitButton')}
                </Button>
              </Stack>
            </form>
          </Surface>
        )}
      </Stack>
    </main>
  )
}
